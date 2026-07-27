import type {
  ZavorthTerminalBackendDescriptor,
  ZavorthTerminalBackendId,
  ZavorthTerminalBackendSnapshot,
} from '../contracts/runtime/ZavorthTerminalBackendsContract.js';
import { ZavorthTerminalBackendsService } from './ZavorthTerminalBackendsService.js';

export const ZAVORTH_CLOUD_SANDBOX_POOL_CONTRACT_VERSION =
  '2026-07-02.cloud-sandbox-pool' as const;

export type ZavorthCloudSandboxPoolStatus = 'ready' | 'partial' | 'missing-config';

export type ZavorthCloudSandboxPoolBackend = {
  id: ZavorthTerminalBackendId;
  label: string;
  status: ZavorthTerminalBackendDescriptor['status'];
  isolation: ZavorthTerminalBackendDescriptor['isolation'];
  liveReady: boolean;
  liveCapable: boolean;
  remoteTier: 'local-container' | 'remote-shell' | 'managed-cloud' | 'cloud-function' | 'cloud-workspace';
  configureCommand: string;
  nextAction: string;
};

export type ZavorthCloudSandboxPoolSnapshot = {
  contractVersion: typeof ZAVORTH_CLOUD_SANDBOX_POOL_CONTRACT_VERSION;
  generatedAt: string;
  status: ZavorthCloudSandboxPoolStatus;
  summary: {
    totalPoolBackends: number;
    readyCloudBackends: number;
    extendedBackends: number;
    liveReady: boolean;
  };
  preferredBackend: ZavorthCloudSandboxPoolBackend | null;
  backends: ZavorthCloudSandboxPoolBackend[];
  swarmIntegration: {
    enabled: true;
    configureCommand: string;
    dynamicConfigKey: 'executionBackend';
    appliesToQueuedWorkersOnly: true;
  };
  receipts: Array<{
    id: string;
    status: 'done' | 'waiting';
    summary: string;
    rawSecretSerialized: false;
  }>;
  safety: {
    noLiveWorkloadDuringPoolBuild: true;
    reusesTerminalBackendPolicy: true;
    approvalStillRequiredForExecution: true;
    terminalLiveFlagStillRequired: true;
    secretsNeverSerialized: true;
  };
};

type Runtime = {
  now?: () => Date;
  terminalBackends?: Pick<ZavorthTerminalBackendsService, 'execute'>;
};

type BuildInput = {
  preferredBackend?: ZavorthTerminalBackendId | null;
};

const POOL_BACKENDS = new Set<ZavorthTerminalBackendId>([
  'docker',
  'ssh',
  'wsl',
  'vercel-sandbox',
  'modal',
  'daytona',
  'singularity',
]);

export class ZavorthCloudSandboxPoolService {
  private readonly now: () => Date;
  private readonly terminalBackends: Pick<ZavorthTerminalBackendsService, 'execute'>;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.terminalBackends = runtime.terminalBackends || new ZavorthTerminalBackendsService();
  }

  public buildSnapshot(input: BuildInput = {}): ZavorthCloudSandboxPoolSnapshot {
    const terminal = this.terminalBackends.execute({
      action: 'terminal.status',
      backend: normalizePreferredBackend(input.preferredBackend),
    }) as ZavorthTerminalBackendSnapshot;
    const backends = terminal.backends
      .filter((backend) => POOL_BACKENDS.has(backend.id))
      .map((backend) => this.mapBackend(backend));
    const readyCloudBackends = backends.filter((backend) => backend.liveReady).length;
    const preferredBackend = this.resolvePreferred(backends, input.preferredBackend);
    const status: ZavorthCloudSandboxPoolStatus = readyCloudBackends > 0
      ? 'ready'
      : backends.some((backend) => backend.status !== 'needs-configuration') ? 'partial'
        : 'missing-config';
    const configureBackend = preferredBackend?.id || backends.find((backend) => backend.liveReady)?.id || 'docker';

    return {
      contractVersion: ZAVORTH_CLOUD_SANDBOX_POOL_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      status,
      summary: {
        totalPoolBackends: backends.length,
        readyCloudBackends,
        extendedBackends: backends.length,
        liveReady: readyCloudBackends > 0,
      },
      preferredBackend,
      backends,
      swarmIntegration: {
        enabled: true,
        configureCommand: `zavorth swarm configure --execution-backend ${configureBackend} --cloud-sandbox on`,
        dynamicConfigKey: 'executionBackend',
        appliesToQueuedWorkersOnly: true,
      },
      receipts: [
        {
          id: 'cloud-sandbox-pool:terminal-backends',
          status: 'done',
          summary: 'Pool was projected from terminal backend readiness without executing a workload.',
          rawSecretSerialized: false,
        },
        {
          id: 'cloud-sandbox-pool:ready-backends',
          status: readyCloudBackends > 0 ? 'done' : 'waiting',
          summary: `${readyCloudBackends}/${backends.length} pool backend(s) are live-ready.`,
          rawSecretSerialized: false,
        },
      ],
      safety: {
        noLiveWorkloadDuringPoolBuild: true,
        reusesTerminalBackendPolicy: true,
        approvalStillRequiredForExecution: true,
        terminalLiveFlagStillRequired: true,
        secretsNeverSerialized: true,
      },
    };
  }

  private mapBackend(backend: ZavorthTerminalBackendDescriptor): ZavorthCloudSandboxPoolBackend {
    return {
      id: backend.id,
      label: backend.label,
      status: backend.status,
      isolation: backend.isolation,
      liveReady: backend.liveReady,
      liveCapable: backend.liveCapable,
      remoteTier: remoteTier(backend),
      configureCommand: `zavorth swarm configure --execution-backend ${backend.id}${isCloudTier(backend) ? ' --cloud-sandbox on' : ''}`,
      nextAction: backend.liveReady ? 'Ready for queued swarm workers after approval.' : backend.nextCommand,
    };
  }

  private resolvePreferred(
    backends: ZavorthCloudSandboxPoolBackend[],
    preferred: ZavorthTerminalBackendId | null | undefined,
  ): ZavorthCloudSandboxPoolBackend | null {
    const normalized = normalizePreferredBackend(preferred);
    return backends.find((backend) => backend.id === normalized)
      || backends.find((backend) => backend.liveReady)
      || backends[0]
      || null;
  }
}

function normalizePreferredBackend(value: ZavorthTerminalBackendId | null | undefined): ZavorthTerminalBackendId {
  return value && POOL_BACKENDS.has(value) ? value : 'local';
}

function remoteTier(backend: ZavorthTerminalBackendDescriptor): ZavorthCloudSandboxPoolBackend['remoteTier'] {
  if (backend.id === 'modal') return 'cloud-function';
  if (backend.id === 'daytona') return 'cloud-workspace';
  if (backend.id === 'vercel-sandbox') return 'managed-cloud';
  if (backend.id === 'ssh') return 'remote-shell';
  return 'local-container';
}

function isCloudTier(backend: ZavorthTerminalBackendDescriptor): boolean {
  return backend.id === 'modal' || backend.id === 'daytona' || backend.id === 'vercel-sandbox';
}
