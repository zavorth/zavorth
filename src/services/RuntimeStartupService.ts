import type { RuntimeAccessManifest } from '../runtime/access/RuntimeAccessManifestService.js';
import { RuntimeAccessManifestService } from '../runtime/access/RuntimeAccessManifestService.js';
import type { RuntimeAccessReadinessReport } from '../runtime/access/RuntimeAccessReadinessService.js';
import { RuntimeAccessReadinessService } from '../runtime/access/RuntimeAccessReadinessService.js';
import type { GatewayHealthRenewalReport } from './GatewayHealthRenewalService.js';
import { PathSafeProcessLauncherService } from './PathSafeProcessLauncherService.js';
import { RuntimeRecoveryService } from './RuntimeRecoveryService.js';
import type { SupervisorBootStateSnapshot } from './SupervisorBootStateMachine.js';
import { SupervisorBootStateMachine } from './SupervisorBootStateMachine.js';

export type RuntimeStartupOptions = {
  timeoutMs?: number;
  pollIntervalMs?: number;
  requireMutableAccess?: boolean;
};

export type RuntimeStartupResult = {
  ok: boolean;
  timedOut: boolean;
  attempts: number;
  durationMs: number;
  readiness: RuntimeAccessReadinessReport;
  manifest: RuntimeAccessManifest;
  summary: string;
  bootState: SupervisorBootStateSnapshot;
  healthRenewal: GatewayHealthRenewalReport;
};

type RuntimeStartupRuntime = {
  prepareRuntime?: () => Promise<void>;
  launchRuntime?: () => Promise<void>;
  readinessService?: Pick<RuntimeAccessReadinessService, 'inspectLive'>;
  manifestService?: Pick<RuntimeAccessManifestService, 'buildManifest' | 'buildManifestFromReadiness'>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  recoveryService?: RuntimeRecoveryService;
  pathSafeLauncher?: PathSafeProcessLauncherService;
};

export class RuntimeStartupService {
  private readonly prepareRuntime: () => Promise<void>;
  private readonly launchRuntime: () => Promise<void>;
  private readonly readinessService: Pick<RuntimeAccessReadinessService, 'inspectLive'>;
  private readonly manifestService: Pick<RuntimeAccessManifestService, 'buildManifest' | 'buildManifestFromReadiness'>;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly recoveryService: RuntimeRecoveryService;
  private readonly pathSafeLauncher: PathSafeProcessLauncherService;

  constructor(runtime: RuntimeStartupRuntime = {}) {
    this.prepareRuntime = runtime.prepareRuntime || (async () => undefined);
    this.launchRuntime = runtime.launchRuntime || (async () => undefined);
    this.readinessService = runtime.readinessService || new RuntimeAccessReadinessService();
    this.manifestService = runtime.manifestService || new RuntimeAccessManifestService();
    this.sleep = runtime.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = runtime.now || (() => Date.now());
    this.recoveryService = runtime.recoveryService || new RuntimeRecoveryService();
    this.pathSafeLauncher = runtime.pathSafeLauncher || new PathSafeProcessLauncherService();
  }

  public async startAndWait(options: RuntimeStartupOptions = {}): Promise<RuntimeStartupResult> {
    const timeoutMs = Math.max(5_000, Number(options.timeoutMs || 60_000));
    const pollIntervalMs = Math.max(250, Number(options.pollIntervalMs || 2_000));
    const requireMutableAccess = options.requireMutableAccess !== false;
    const startedAt = this.now();
    const bootState = new SupervisorBootStateMachine(this.now);

    bootState.startPhase('prepare', 'Preparando o runtime supervisionado.');
    await this.prepareRuntime();
    bootState.startPhase('launch', `Abrindo o runtime supervisionado com trilha segura para paths com espaco via ${this.pathSafeLauncher.buildPlan({
      executable: process.platform === 'win32' ? 'npm.cmd' : 'npm',
      args: ['run', 'ops:start'],
    }).displayCommand}.`);
    await this.launchRuntime();

    let attempts = 0;
    let readiness = await this.readinessService.inspectLive();
    attempts += 1;
    let recovery = this.recoveryService.assess(readiness, requireMutableAccess);
    bootState.recordProbeAttempt(recovery.summary);

    while (!recovery.readyForUse) {
      if (this.now() - startedAt >= timeoutMs) {
        bootState.markTimedOut(recovery.summary);
        const manifest = this.manifestService.buildManifestFromReadiness
          ? this.manifestService.buildManifestFromReadiness(readiness)
          : await this.manifestService.buildManifest();
        return {
          ok: false,
          timedOut: true,
          attempts,
          durationMs: this.now() - startedAt,
          readiness,
          manifest,
          summary: `Timeout aguardando o Zavorth ficar pronto. ${recovery.summary}`,
          bootState: bootState.getSnapshot(),
          healthRenewal: recovery.healthRenewal,
        };
      }

      if (recovery.warnings.length > 0) {
        bootState.markRecovering(recovery.summary);
      }
      await this.sleep(pollIntervalMs);
      readiness = await this.readinessService.inspectLive();
      attempts += 1;
      recovery = this.recoveryService.assess(readiness, requireMutableAccess);
      bootState.recordProbeAttempt(recovery.summary);
    }

    const manifest = this.manifestService.buildManifestFromReadiness
      ? this.manifestService.buildManifestFromReadiness(readiness)
      : await this.manifestService.buildManifest();
    bootState.markReady(recovery.summary);
    return {
      ok: true,
      timedOut: false,
      attempts,
      durationMs: this.now() - startedAt,
      readiness,
      manifest,
      summary: recovery.summary,
      bootState: bootState.getSnapshot(),
      healthRenewal: recovery.healthRenewal,
    };
  }
}

