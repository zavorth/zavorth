import fs from 'fs';
import path from 'path';
import { spawn, type ChildProcess } from 'child_process';
import type {
  MinimalCapabilityManifest,
  MinimalCapabilityRegistrySnapshot,
  MinimalCapabilitySidecarSpec,
} from './MinimalCapabilityRegistry.js';
import type { MinimalRuntimeProfile } from './MinimalRuntimeProfileRegistry.js';
import { safeFetch } from '../security/SafeFetchService.js';

export type MinimalSidecarState = 'disabled' | 'planned' | 'stopped' | 'starting' | 'running' | 'ready' | 'failed';

export type MinimalSidecarSnapshot = {
  id: string;
  label: string;
  kind: string;
  profileId: string;
  state: MinimalSidecarState;
  launchable: boolean;
  running: boolean;
  ready: boolean;
  pid: number | null;
  spawnedByZavorth: boolean;
  command: string | null;
  args: string[];
  cwd: string | null;
  healthUrl: string | null;
  statusFile: string;
  logFile: string | null;
  idleTimeoutMs: number;
  checkedAt: string;
  message: string;
};

export type MinimalSidecarManagerSnapshot = {
  version: 1;
  generatedAt: string;
  profileId: string;
  maxActiveSidecars: number;
  sidecarIdleTimeoutMs: number;
  total: number;
  launchable: number;
  running: number;
  ready: number;
  sidecars: MinimalSidecarSnapshot[];
};

export type MinimalSidecarManagerOptions = {
  projectRoot: string;
  dataDir: string;
  runtimeProfile: MinimalRuntimeProfile;
  capabilityRegistry: MinimalCapabilityRegistrySnapshot;
};

type PersistedSidecarStatus = Partial<MinimalSidecarSnapshot> & {
  updatedAt?: string;
};

export class MinimalSidecarManager {
  private readonly projectRoot: string;
  private readonly dataDir: string;
  private readonly runtimeProfile: MinimalRuntimeProfile;
  private readonly capabilityRegistry: MinimalCapabilityRegistrySnapshot;
  private readonly children = new Map<string, ChildProcess>();

  constructor(options: MinimalSidecarManagerOptions) {
    this.projectRoot = options.projectRoot;
    this.dataDir = options.dataDir;
    this.runtimeProfile = options.runtimeProfile;
    this.capabilityRegistry = options.capabilityRegistry;
  }

  public buildSnapshot(): MinimalSidecarManagerSnapshot {
    const sidecars = this.getSidecarCapabilities().map((capability) => this.buildSidecarSnapshot(capability));
    return this.buildManagerSnapshot(sidecars);
  }

  public async inspectLive(): Promise<MinimalSidecarManagerSnapshot> {
    const sidecars = await Promise.all(
      this.getSidecarCapabilities().map(async (capability) => this.checkHealth(this.buildSidecarSnapshot(capability))),
    );
    return this.buildManagerSnapshot(sidecars);
  }

  private buildManagerSnapshot(sidecars: MinimalSidecarSnapshot[]): MinimalSidecarManagerSnapshot {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      profileId: this.runtimeProfile.id,
      maxActiveSidecars: this.runtimeProfile.maxActiveSidecars,
      sidecarIdleTimeoutMs: this.runtimeProfile.sidecarIdleTimeoutMs,
      total: sidecars.length,
      launchable: sidecars.filter((sidecar) => sidecar.launchable).length,
      running: sidecars.filter((sidecar) => sidecar.running).length,
      ready: sidecars.filter((sidecar) => sidecar.ready).length,
      sidecars,
    };
  }

  public async start(id: string, options: { dryRun?: boolean } = {}): Promise<MinimalSidecarSnapshot> {
    const capability = this.findSidecarCapability(id);
    if (!capability) {
      throw new Error(`Sidecar ${id} nao esta disponivel no perfil ${this.runtimeProfile.id}.`);
    }
    const snapshot = this.buildSidecarSnapshot(capability);
    if (!snapshot.launchable) {
      return this.writeStatus({
        ...snapshot,
        state: 'failed',
        message: 'Sidecar declarado, mas sem command/cwd suficiente para iniciar automaticamente.',
      });
    }
    if (snapshot.running) {
      return snapshot;
    }
    if (options.dryRun) {
      return {
        ...snapshot,
        state: 'planned',
        message: `Dry-run: iniciaria ${snapshot.command} ${snapshot.args.join(' ')}`.trim(),
      };
    }

    const spec = capability.sidecar as MinimalCapabilitySidecarSpec;
    const cwd = this.resolvePath(spec.cwd || '.') as string;
    const logFile = snapshot.logFile;
    if (logFile) {
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
    }
    fs.mkdirSync(path.dirname(snapshot.statusFile), { recursive: true });
    const logFd = logFile ? fs.openSync(logFile, 'a') : 'ignore';
    const child = spawn(snapshot.command as string, snapshot.args, {
      cwd,
      env: {
        ...process.env,
        ...spec.env,
      },
      detached: true,
      stdio: ['ignore', logFd, logFd],
      windowsHide: true,
    });
    child.unref();
    this.children.set(capability.id, child);
    child.on('exit', (code, signal) => {
      this.children.delete(capability.id);
      const previous = this.buildSidecarSnapshot(capability);
      this.writeStatus({
        ...previous,
        state: code === 0 || signal === 'SIGTERM' ? 'stopped' : 'failed',
        running: false,
        ready: false,
        pid: null,
        spawnedByZavorth: false,
        message: `Sidecar saiu (code=${code}, signal=${signal}).`,
      });
    });
    child.on('error', (error) => {
      if (typeof logFd === 'number') {
        fs.writeSync(logFd, `[sidecar:${capability.id}] ${error.message}\n`);
      }
    });

    return this.writeStatus({
      ...snapshot,
      state: 'running',
      running: true,
      ready: false,
      pid: child.pid || null,
      spawnedByZavorth: true,
      message: 'Sidecar iniciado pelo MinimalSidecarManager.',
    });
  }

  public async stop(id: string, options: { dryRun?: boolean } = {}): Promise<MinimalSidecarSnapshot> {
    const capability = this.findSidecarCapability(id);
    if (!capability) {
      throw new Error(`Sidecar ${id} nao esta disponivel no perfil ${this.runtimeProfile.id}.`);
    }
    const snapshot = this.buildSidecarSnapshot(capability);
    if (options.dryRun) {
      return {
        ...snapshot,
        state: 'planned',
        message: `Dry-run: encerraria sidecar ${capability.id}.`,
      };
    }
    const child = this.children.get(capability.id);
    if (child) {
      child.kill('SIGTERM');
      this.children.delete(capability.id);
    } else if (snapshot.pid && snapshot.spawnedByZavorth && this.isProcessAlive(snapshot.pid)) {
      process.kill(snapshot.pid, 'SIGTERM');
    }
    return this.writeStatus({
      ...snapshot,
      state: 'stopped',
      running: false,
      ready: false,
      pid: null,
      spawnedByZavorth: false,
      message: 'Sidecar parado pelo MinimalSidecarManager.',
    });
  }

  private getSidecarCapabilities(): MinimalCapabilityManifest[] {
    return this.capabilityRegistry.capabilities.filter((capability) => capability.boot === 'sidecar');
  }

  private findSidecarCapability(id: string): MinimalCapabilityManifest | null {
    const normalized = String(id || '').trim().toLowerCase();
    return this.getSidecarCapabilities().find((capability) => capability.id === normalized) || null;
  }

  private buildSidecarSnapshot(capability: MinimalCapabilityManifest): MinimalSidecarSnapshot {
    const spec = capability.sidecar || {};
    const statusFile = this.resolvePath(spec.statusFile || path.join(this.dataDir, `${capability.id}-sidecar.json`)) as string;
    const persisted = this.readPersistedStatus(statusFile);
    const command = spec.command || null;
    const cwd = this.resolvePath(spec.cwd || null);
    const logFile = this.resolvePath(spec.logFile || null);
    const pid = typeof persisted.pid === 'number' ? persisted.pid : null;
    const running = Boolean(pid && this.isProcessAlive(pid));
    const ready = Boolean(running && persisted.ready);
    const launchable = Boolean(command && cwd);
    return {
      id: capability.id,
      label: capability.label,
      kind: capability.kind,
      profileId: this.runtimeProfile.id,
      state: capability.enabled === false ? 'disabled' : running ? (ready ? 'ready' : 'running') : 'stopped',
      launchable,
      running,
      ready,
      pid: running ? pid : null,
      spawnedByZavorth: Boolean(running && persisted.spawnedByZavorth),
      command,
      args: spec.args || [],
      cwd,
      healthUrl: spec.healthUrl || null,
      statusFile,
      logFile,
      idleTimeoutMs: spec.idleTimeoutMs || this.runtimeProfile.sidecarIdleTimeoutMs,
      checkedAt: new Date().toISOString(),
      message: running
        ? String(persisted.message || 'Sidecar registrado como ativo.')
        : launchable
          ? 'Sidecar pronto para start sob demanda.'
          : 'Sidecar sem launcher automatico; use capability-specific runner futuro.',
    };
  }

  private async checkHealth(snapshot: MinimalSidecarSnapshot): Promise<MinimalSidecarSnapshot> {
    if (!snapshot.healthUrl) {
      return snapshot;
    }
    try {
      const response = await safeFetch(snapshot.healthUrl, { method: 'GET' }, {
        serviceName: 'Minimal sidecar healthcheck',
        allowLoopback: true,
      });
      const ready = response.ok || (response.status > 0 && response.status < 500);
      return {
        ...snapshot,
        state: ready ? 'ready' : snapshot.state,
        running: ready || snapshot.running,
        ready,
        message: ready ? `Healthcheck respondeu em ${snapshot.healthUrl}.` : snapshot.message,
      };
    } catch (error: any) { const err = error; const e = error;
      return snapshot;
    }
  }

  private writeStatus(snapshot: MinimalSidecarSnapshot): MinimalSidecarSnapshot {
    fs.mkdirSync(path.dirname(snapshot.statusFile), { recursive: true });
    fs.writeFileSync(
      snapshot.statusFile,
      `${JSON.stringify({ ...snapshot, updatedAt: new Date().toISOString() }, null, 2)}\n`,
      'utf8',
    );
    return snapshot;
  }

  private readPersistedStatus(statusFile: string): PersistedSidecarStatus {
    try {
      if (!fs.existsSync(statusFile)) {
        return {};
      }
      return JSON.parse(fs.readFileSync(statusFile, 'utf8')) as PersistedSidecarStatus;
    } catch (error: any) { const err = error; const e = error;
      return {};
    }
  }

  private resolvePath(value: string | null): string | null {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return null;
    }
    return path.isAbsolute(normalized) ? normalized : path.resolve(this.projectRoot, normalized);
  }

  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error: any) { const err = error; const e = error;
      return error?.code !== 'ESRCH';
    }
  }
}
