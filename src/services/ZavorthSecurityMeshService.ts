import { SandboxPolicyService } from './sandbox/SandboxPolicyService.js';
import { ZavorthRuntimeModesService, type ZavorthRuntimeModeSnapshot } from './ZavorthRuntimeModesService.js';
import { OperationsHealthService, type OperationsHealthSnapshot } from '../observability/OperationsHealthService.js';
import type { LogRepository } from '../storage/LogRepository.js';

type OperationsHealthLike = Pick<OperationsHealthService, 'readSnapshot'> &
  Partial<Pick<OperationsHealthService, 'readSnapshotFast'>>;
type RuntimeModesLike = Pick<ZavorthRuntimeModesService, 'buildSnapshot'>;

type ZavorthSecurityMeshRuntime = {
  now?: () => Date;
  operationsHealthService?: OperationsHealthLike;
  runtimeModesService?: RuntimeModesLike;
};

export type ZavorthSecurityMeshPosture = 'baseline' | 'guarded' | 'zero-trust-ready';

export type ZavorthSecurityMeshSnapshot = {
  generatedAt: string;
  posture: {
    level: ZavorthSecurityMeshPosture;
    label: string;
    summary: string;
  };
  summary: {
    totalModes: number;
    coreReady: number;
    extensionsReady: number;
    wasmReady: boolean;
    gvisorActive: boolean;
    firecrackerReady: boolean;
    neverDowngrade: boolean;
  };
  policies: {
    lowRiskToLocalJail: boolean;
    mediumRiskToContainer: boolean;
    highRiskToMicrovm: boolean;
    neverDowngrade: boolean;
    containerHardening: boolean;
    gvisorActive: boolean;
    firecrackerReady: boolean;
    wasmReady: boolean;
    nodeHostAvailable: boolean;
    remoteSidecarAvailable: boolean;
  };
  modes: {
    core: ZavorthRuntimeModeSnapshot[];
    extensions: ZavorthRuntimeModeSnapshot[];
  };
  auditTrail: {
    available: boolean;
    ok: boolean | null;
    totalEvents: number;
    latestEventType: string | null;
    latestTaskId: string | null;
    latestTimestamp: string | null;
    latestChainHash: string | null;
    recentChain: Array<{
      eventId: string;
      eventType: string;
      taskId: string;
      timestamp: string | null;
      chainHash: string;
      previousChainHash: string | null;
    }>;
  };
  suggestedActions: Array<{
    id: string;
    label: string;
    command: string;
    severity: 'info' | 'warn';
    reason: string;
  }>;
  narrative: {
    headline: string;
    operatorSummary: string;
    trustBoundary: string;
  };
};

export class ZavorthSecurityMeshService {
  private readonly now: () => Date;
  private readonly operationsHealth: OperationsHealthLike;
  private readonly runtimeModes: RuntimeModesLike;
  private readonly policy = new SandboxPolicyService();

  constructor(runtime: ZavorthSecurityMeshRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.operationsHealth = runtime.operationsHealthService || new OperationsHealthService({
      log: () => undefined,
      getRecentLogs: () => [],
    } as unknown as LogRepository);
    this.runtimeModes = runtime.runtimeModesService || new ZavorthRuntimeModesService();
  }

  public buildSnapshot(input: { live?: boolean } = {}): ZavorthSecurityMeshSnapshot {
    const health = input.live || typeof this.operationsHealth.readSnapshotFast !== 'function'
      ? this.operationsHealth.readSnapshot()
      : this.operationsHealth.readSnapshotFast();
    const runtimeModes = this.runtimeModes.buildSnapshot(input);
    const coreModes = runtimeModes.entries.filter((entry) => entry.tier === 'core');
    const extensionModes = runtimeModes.entries.filter((entry) => entry.tier === 'extension');
    const policies = this.buildPolicies(health, runtimeModes.entries);
    const posture = this.resolvePosture(policies, health);
    const suggestedActions = this.buildSuggestedActions(health, policies);

    return {
      generatedAt: this.now().toISOString(),
      posture,
      summary: {
        totalModes: runtimeModes.summary.total,
        coreReady: runtimeModes.summary.coreReady,
        extensionsReady: runtimeModes.summary.extensionReady,
        wasmReady: policies.wasmReady,
        gvisorActive: policies.gvisorActive,
        firecrackerReady: policies.firecrackerReady,
        neverDowngrade: policies.neverDowngrade,
      },
      policies,
      modes: {
        core: coreModes,
        extensions: extensionModes,
      },
      auditTrail: this.buildAuditTrailSnapshot(health),
      suggestedActions,
      narrative: {
        headline: 'Runtime & Security Mesh',
        operatorSummary: [
          posture.summary,
          `${runtimeModes.summary.coreReady}/${coreModes.length} tier(s) core ready.`,
          `${runtimeModes.summary.extensionReady}/${extensionModes.length} extension(s) already podem ampliar o runtime.`,
          this.buildNodeMeshNarrative(health),
          this.buildAuditTrailNarrative(health),
        ].join(' '),
        trustBoundary: this.buildTrustBoundaryNarrative(health, policies),
      },
    };
  }

  private buildPolicies(
    health: OperationsHealthSnapshot,
    entries: ZavorthRuntimeModeSnapshot[],
  ): ZavorthSecurityMeshSnapshot['policies'] {
    const lowRiskToLocalJail =
      this.policy.resolveCodeExecutionPolicy('javascript', "logger.info('ok')").securityLevel === 'local-jail';
    const mediumRiskToContainer =
      this.policy.resolveCodeExecutionPolicy('shell', 'curl https://example.com').securityLevel === 'container';
    const highRiskToMicrovm =
      this.policy.resolveCodeExecutionPolicy('shell', 'sudo whoami').securityLevel === 'microvm';

    return {
      lowRiskToLocalJail,
      mediumRiskToContainer,
      highRiskToMicrovm,
      neverDowngrade: true,
      containerHardening: health.docker.hardeningActive,
      gvisorActive: health.docker.gvisorActive,
      firecrackerReady: health.firecracker.canRun,
      wasmReady: health.wasm.canRun,
      nodeHostAvailable: entries.some((entry) => entry.family === 'node-host' && entry.available),
      remoteSidecarAvailable: entries.some((entry) => entry.family === 'remote-sidecar' && entry.available),
    };
  }

  private resolvePosture(
    policies: ZavorthSecurityMeshSnapshot['policies'],
    health: OperationsHealthSnapshot,
  ): ZavorthSecurityMeshSnapshot['posture'] {
    if (policies.containerHardening && policies.gvisorActive && policies.firecrackerReady) {
      return {
        level: 'zero-trust-ready',
        label: 'Zero-trust ready',
        summary: 'Hardened container, gVisor, and microVM are ready for the official isolation plan.',
      };
    }

    if (health.docker.canRun || health.firecracker.enabled || health.firecracker.kernelPresent || health.firecracker.rootfsPresent) {
      return {
        level: 'guarded',
        label: 'Guarded',
        summary: 'The mesh already protects the runtime, but at least one tier is still preparing.',
      };
    }

    return {
      level: 'baseline',
      label: 'Baseline',
      summary: 'The mesh is still at baseline level and depends on preparing stronger isolation tiers.',
    };
  }

  private buildSuggestedActions(
    health: OperationsHealthSnapshot,
    policies: ZavorthSecurityMeshSnapshot['policies'],
  ): ZavorthSecurityMeshSnapshot['suggestedActions'] {
    const actions: ZavorthSecurityMeshSnapshot['suggestedActions'] = [];

    if (health.docker.recommendedAction) {
      actions.push({
        id: 'container-doctor',
        label: 'validate hardened container',
        command: health.docker.recommendedAction,
        severity: health.docker.canRun ? 'info' : 'warn',
        reason: health.docker.canRun ? 'The container already responds; this smoke confirms current hardening.'
          : health.docker.detail || 'The container tier still needs diagnostics.',
      });
    }

    if (!policies.gvisorActive && health.docker.canRun) {
      actions.push({
        id: 'gvisor-smoke',
        label: 'Confirm gVisor',
        command: 'npm run sandbox:doctor:smoke',
        severity: 'warn',
        reason: 'The container is ready, but the secure runtime has not confirmed active gVisor yet.',
      });
    }

    if (!policies.firecrackerReady) {
      actions.push({
        id: 'microvm-smoke',
        label: 'validate microVM',
        command: health.firecracker.recommendedAction || 'npm run sandbox:firecracker:smoke',
        severity: 'warn',
        reason: health.firecracker.detail || 'The microVM still needs a readiness smoke.',
      });
    }

    if (health.wasm.recommendedAction) {
      actions.push({
        id: 'validate-wasm-smoke',
        label: 'validate Wasm tier',
        command: health.wasm.recommendedAction,
        severity: policies.wasmReady ? 'info' : 'warn',
        reason: health.wasm.detail || 'The Wasm tier still needs a readiness smoke.',
      });
    }

    if (!policies.nodeHostAvailable) {
      actions.push({
        id: 'node-host-pair',
        label: 'Pair node host',
        command: '/nodepair headless',
        severity: 'info',
        reason: 'Node host is not available as a mesh extension yet.',
      });
    }

    if (health.nodeMeshSmoke?.status !== 'passed' || health.nodeMeshSmoke?.stale) {
      actions.push({
        id: 'node-mesh-validate',
        label: 'validate node mesh',
        command:
          health.nodeMeshSmoke?.recommendedAction
          || health.nodeMeshSmoke?.command
          || 'npm run test:nodes:smoke',
        severity: health.nodeMeshSmoke?.status === 'failed' ? 'warn' : 'info',
        reason:
          health.nodeMeshSmoke?.status === 'failed'
            ? (health.nodeMeshSmoke.error || 'The last real Node Mesh smoke failed and needs to be repeated.')
            : health.nodeMeshSmoke?.stale ? 'The last real Node Mesh smoke expired and must be renewed before trusting the mesh.'
            : health.nodeMeshSmoke?.status === 'running'
              ? 'A real Node Mesh smoke is running; wait for completion before trusting the mesh.'
              : 'There is no recent real Node Mesh smoke on this host yet.',
      });
    }

    if (!policies.remoteSidecarAvailable) {
      actions.push({
        id: 'sidecar-connect',
        label: 'Prepare remote sidecar',
        command: '/connect AIGateway',
        severity: 'info',
        reason: 'The remote sidecar has not been promoted to the runtime mesh yet.',
      });
    }

    if (health.security.lastAudit.ok === false) {
      actions.push({
        id: 'audit-trail-check',
        label: 'Review audit trail',
        command: 'npm run security:preflight',
        severity: 'warn',
        reason: health.security.lastAudit.summary || 'The cryptographic audit trail reported recent degradation.',
      });
    }

    return actions;
  }

  private buildAuditTrailSnapshot(
    health: OperationsHealthSnapshot,
  ): ZavorthSecurityMeshSnapshot['auditTrail'] {
    const audit = health.security.lastAudit;
    return {
      available: audit.trailAvailable || audit.available,
      ok: audit.ok,
      totalEvents: Number(audit.totalEvents || 0),
      latestEventType: audit.latestEventType || null,
      latestTaskId: audit.latestTaskId || null,
      latestTimestamp: audit.latestTimestamp || null,
      latestChainHash: audit.latestChainHash || null,
      recentChain: Array.isArray(audit.recentChain)
        ? (audit.recentChain as Array<{
            eventId: string;
            eventType: string;
            taskId: string;
            timestamp: string | null;
            chainHash: string;
            previousChainHash: string | null;
          }>).slice(0, 4)
        : [],
    };
  }

  private buildAuditTrailNarrative(health: OperationsHealthSnapshot): string {
    const audit = health.security.lastAudit;
    if (audit.totalEvents > 0) {
      return `Cryptographic trail has ${audit.totalEvents} event(s); latest ${audit.latestEventType || 'event'} at ${audit.latestTaskId || 'unknown task'}.`;
    }

    if (audit.available) {
      return 'Cryptographic audit status is available, but the chain has not received events yet.';
    }

    return 'The cryptographic audit trail has not been observed on this host yet.';
  }

  private buildNodeMeshNarrative(health: OperationsHealthSnapshot): string {
    const smoke = health.nodeMeshSmoke;
    if (!smoke || smoke.status === 'missing') {
      return 'The node mesh has no recent real smoke registered yet.';
    }

    if (smoke.status === 'running') {
      return 'The node mesh is being validated by a real smoke right now.';
    }

    if (smoke.status === 'failed') {
      return smoke.error ? `The node mesh failed the latest real smoke: ${smoke.error}.`
        : 'The node mesh failed the latest real smoke and needs new validation.';
    }

    if (smoke.stale) {
      return `The node mesh had a valid real smoke at ${smoke.checkedAt || 'unknown date'}, but the report expired and needs new validation before sensitive paired invokes.`;
    }

    return `The node mesh was validated by real smoke at ${smoke.checkedAt || 'unknown date'} with latest invoke ${smoke.recentCapabilityId || 'n/d'}.`;
  }

  private buildTrustBoundaryNarrative(
    health: OperationsHealthSnapshot,
    policies: ZavorthSecurityMeshSnapshot['policies'],
  ): string {
    const base = policies.firecrackerReady ? 'High-risk content is elevated to microVM without downgrading to container.'
      : 'High-risk content stays blocked instead of falling back to weaker tiers.';
    const smoke = health.nodeMeshSmoke;

    if (!smoke || smoke.status === 'missing') {
      return `${base} The node mesh has not been validated by a recent real smoke test.`;
    }

    if (smoke.status === 'running') {
      return `${base} Real node mesh validation is running.`;
    }

    if (smoke.status === 'failed') {
      return `${base} The latest real node mesh smoke failed, so paired invokes still require additional caution.`;
    }

    if (smoke.stale) {
      return `${base} The node mesh had a valid real smoke previously, but the operational evidence expired and must be renewed before fully trusting paired invokes.`;
    }

    return `${base} The node mesh has already been validated by real smoke for pairing, heartbeat, and end-to-end invoke.`;
  }
}
