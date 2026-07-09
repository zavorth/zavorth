import fs from 'fs';
import path from 'path';
import { findProjectRoot } from '../config/configHelpers.js';
import { ProcessLockService } from '../services/ProcessLockService.js';
import {
  RuntimeResourceBudgetService,
  type RuntimeBudgetProfile,
  type RuntimeBudgetReport,
} from '../services/RuntimeResourceBudgetService.js';
import {
  MinimalCapabilityRegistry,
  type MinimalCapabilityRegistrySnapshot,
} from './MinimalCapabilityRegistry.js';
import {
  MinimalRuntimeProfileRegistry,
  type MinimalRuntimeProfile,
  type MinimalRuntimeProfileRegistrySnapshot,
} from './MinimalRuntimeProfileRegistry.js';
import {
  MinimalSidecarManager,
  type MinimalSidecarManagerSnapshot,
} from './MinimalSidecarManager.js';
import {
  MinimalRuntimeEventBus,
  type MinimalRuntimeEventBusSnapshot,
  type MinimalRuntimeEventListener,
} from './MinimalRuntimeEventBus.js';
import {
  MinimalRuntimeScheduler,
  type MinimalRuntimeSchedulerSnapshot,
} from './MinimalRuntimeScheduler.js';
export type MinimalRuntimeKernelSnapshot = {
  version: 1;
  generatedAt: string;
  profile: RuntimeBudgetProfile;
  runtimeProfile: MinimalRuntimeProfile;
  runtimeProfileRegistry: MinimalRuntimeProfileRegistrySnapshot;
  projectRoot: string;
  dataDir: string;
  stateFilePath: string;
  lockFilePath: string;
  status: 'starting' | 'running' | 'stopped';
  eventBus: MinimalRuntimeEventBusSnapshot;
  scheduler: MinimalRuntimeSchedulerSnapshot;
  capabilityRegistry: MinimalCapabilityRegistrySnapshot;
  sidecarManager: MinimalSidecarManagerSnapshot;
  capabilities: Array<{
    id: string;
    kind: string;
    boot: string;
    status: 'active';
  }>;
  budget: RuntimeBudgetReport;
};

export type MinimalRuntimeKernelOptions = {
  profile?: RuntimeBudgetProfile | string;
  projectRoot?: string;
  dataDir?: string;
  stateFilePath?: string;
  lockFilePath?: string;
  capabilityManifestDir?: string;
  runtimeProfileDir?: string;
  registerSignalHandlers?: boolean;
  writer?: Pick<typeof console, 'log' | 'error'>;
};

export class MinimalRuntimeKernel {
  private readonly budgetService = new RuntimeResourceBudgetService();
  private readonly eventBus = new MinimalRuntimeEventBus();
  private readonly scheduler: MinimalRuntimeScheduler;
  private readonly projectRoot: string;
  private readonly dataDir: string;
  private readonly stateFilePath: string;
  private readonly lockFilePath: string;
  private readonly capabilityManifestDir: string;
  private readonly runtimeProfileDir: string;
  private readonly profile: RuntimeBudgetProfile;
  private readonly writer: Pick<typeof console, 'log' | 'error'>;
  private readonly lock: ProcessLockService;
  private readonly capabilityRegistry: MinimalCapabilityRegistry;
  private readonly runtimeProfileRegistry: MinimalRuntimeProfileRegistry;
  private readonly runtimeProfileSnapshot: MinimalRuntimeProfileRegistrySnapshot;
  private sidecarManagerSnapshot: MinimalSidecarManagerSnapshot | null = null;
  private status: MinimalRuntimeKernelSnapshot['status'] = 'stopped';
  private signalHandlersRegistered = false;

  constructor(options: MinimalRuntimeKernelOptions = {}) {
    this.projectRoot = options.projectRoot || findProjectRoot();
    this.dataDir = options.dataDir || path.resolve(this.projectRoot, 'data', 'runtime');
    this.stateFilePath = options.stateFilePath || path.resolve(this.dataDir, 'minimal-kernel-state.json');
    this.lockFilePath = options.lockFilePath || path.resolve(this.dataDir, 'minimal-kernel.lock');
    this.capabilityManifestDir = options.capabilityManifestDir || path.resolve(this.projectRoot, 'config', 'capability-manifests');
    this.runtimeProfileDir = options.runtimeProfileDir || path.resolve(this.projectRoot, 'config', 'runtime-profiles');
    this.runtimeProfileRegistry = new MinimalRuntimeProfileRegistry({
      profileDir: this.runtimeProfileDir,
    });
    this.runtimeProfileSnapshot = this.runtimeProfileRegistry.load(options.profile || 'minimal');
    this.profile = this.runtimeProfileSnapshot.selectedProfile.id;
    this.writer = options.writer || console;
    this.lock = new ProcessLockService(this.lockFilePath);
    this.capabilityRegistry = new MinimalCapabilityRegistry({
      manifestDir: this.capabilityManifestDir,
      profileId: this.runtimeProfileSnapshot.selectedProfile.id,
      bootOverrides: this.runtimeProfileSnapshot.selectedProfile.capabilityBootOverrides,
    });
    this.scheduler = new MinimalRuntimeScheduler(this.runtimeProfileSnapshot.selectedProfile, this.eventBus);
    this.registerSchedulerTasks();

    if (options.registerSignalHandlers !== false) {
      this.registerSignalHandlers();
    }
  }

  public on(type: string, listener: MinimalRuntimeEventListener): () => void {
    return this.eventBus.on(type, listener);
  }

  public async start(): Promise<MinimalRuntimeKernelSnapshot> {
    if (this.status === 'running') {
      return this.snapshot();
    }

    this.status = 'starting';
    this.lock.acquire('minimal-runtime-kernel');
    await this.eventBus.emit('kernel.starting');
    this.status = 'running';
    const snapshot = await this.persistSnapshot();
    await this.eventBus.emit('kernel.running', snapshot);
    return snapshot;
  }

  public async stop(reason = 'manual'): Promise<MinimalRuntimeKernelSnapshot> {
    if (this.status === 'stopped') {
      return this.snapshot();
    }

    await this.eventBus.emit('kernel.stopping', { reason });
    this.status = 'stopped';
    this.scheduler.stopAll();
    this.lock.release();
    const snapshot = await this.persistSnapshot();
    await this.eventBus.emit('kernel.stopped', { reason, snapshot });
    return snapshot;
  }

  public async runUntilSignal(): Promise<void> {
    await this.start();
    this.writer.log('[zavorth-core] minimal runtime kernel ativo. Pressione Ctrl+C para encerrar.');
    await new Promise<void>(() => {
      // Mantem o processo vivo sem timers. O encerramento acontece via signal handlers.
    });
  }

  public snapshot(): MinimalRuntimeKernelSnapshot {
    const capabilityRegistry = this.capabilityRegistry.getSnapshot();
    const sidecarManager = new MinimalSidecarManager({
      projectRoot: this.projectRoot,
      dataDir: this.dataDir,
      runtimeProfile: this.runtimeProfileSnapshot.selectedProfile,
      capabilityRegistry,
    }).buildSnapshot();
    this.sidecarManagerSnapshot = sidecarManager;
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      profile: this.profile,
      runtimeProfile: this.runtimeProfileSnapshot.selectedProfile,
      runtimeProfileRegistry: this.runtimeProfileSnapshot,
      projectRoot: this.projectRoot,
      dataDir: this.dataDir,
      stateFilePath: this.stateFilePath,
      lockFilePath: this.lockFilePath,
      status: this.status,
      eventBus: this.eventBus.snapshot(),
      scheduler: this.scheduler.snapshot(),
      capabilityRegistry,
      sidecarManager,
      capabilities: this.capabilityRegistry.getBootCapabilities().map((capability) => ({
        id: capability.id,
        kind: capability.kind,
        boot: capability.boot,
        status: 'active',
      })),
      budget: this.budgetService.buildBudgetReport(this.runtimeProfileSnapshot.selectedProfile.budgetProfile),
    };
  }

  private async persistSnapshot(): Promise<MinimalRuntimeKernelSnapshot> {
    const snapshot = this.snapshot();
    fs.mkdirSync(path.dirname(this.stateFilePath), { recursive: true });
    fs.writeFileSync(this.stateFilePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    return snapshot;
  }

  private registerSchedulerTasks(): void {
    this.scheduler.register({
      id: 'kernel-state-events',
      label: 'Kernel state event accounting',
      mode: 'event',
      enabled: true,
      eventTypes: ['kernel.starting', 'kernel.running', 'kernel.stopping', 'kernel.stopped'],
    });
    this.scheduler.register({
      id: 'sidecar-health-refresh',
      label: 'Sidecar health refresh trigger',
      mode: 'event',
      enabled: true,
      eventTypes: ['kernel.running', 'sidecar.started', 'sidecar.stopped'],
    });
    this.scheduler.register({
      id: 'runtime-maintenance',
      label: 'Adaptive runtime maintenance slot',
      mode: 'adaptive',
      enabled: this.runtimeProfileSnapshot.selectedProfile.maintenanceMode !== 'off',
      baseIntervalMs: 300_000,
      idleIntervalMs: 900_000,
      pressureIntervalMs: 1_800_000,
    });
  }

  private registerSignalHandlers(): void {
    if (this.signalHandlersRegistered) {
      return;
    }
    this.signalHandlersRegistered = true;
    const shutdown = async (signal: string) => {
      try {
        await this.stop(signal);
      } catch (error: unknown) {
        this.writer.error(error instanceof Error ? error.message : String(error));
      } finally {
        process.exit(0);
      }
    };
    process.once('SIGINT', () => void shutdown('SIGINT'));
    process.once('SIGTERM', () => void shutdown('SIGTERM'));
    process.once('exit', () => {
      this.lock.release();
    });
  }
}
