import { SandboxPolicyService } from './sandbox/SandboxPolicyService.js';
import { logger } from '../logger.js';
import { ZavorthRuntimeModesService, type ZavorthRuntimeModeSnapshot } from './ZavorthRuntimeModesService.js';
import { OperationsHealthService, type OperationsHealthSnapshot } from '../observability/OperationsHealthService.js';

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
    } as any);
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
          `${runtimeModes.summary.coreReady}/${coreModes.length} tier(s) core prontos.`,
          `${runtimeModes.summary.extensionReady}/${extensionModes.length} extensao(oes) ja podem ampliar o runtime.`,
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
        label: 'Zero-trust pronto',
        summary: 'Container endurecido, gVisor e microVM estao prontos para o plano oficial de isolamento.',
      };
    }

    if (health.docker.canRun || health.firecracker.enabled || health.firecracker.kernelPresent || health.firecracker.rootfsPresent) {
      return {
        level: 'guarded',
        label: 'Guarded',
        summary: 'O mesh ja protege o runtime, mas ainda existe pelo menos um tier em preparo.',
      };
    }

    return {
      level: 'baseline',
      label: 'Baseline',
      summary: 'O mesh ainda esta no nivel base e depende de preparar os tiers fortes de isolamento.',
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
        label: 'Validar container endurecido',
        command: health.docker.recommendedAction,
        severity: health.docker.canRun ? 'info' : 'warn',
        reason: health.docker.canRun
          ? 'O container ja responde; este smoke confirma o hardening atual.'
          : health.docker.detail || 'O tier de container ainda pede diagnostico.',
      });
    }

    if (!policies.gvisorActive && health.docker.canRun) {
      actions.push({
        id: 'gvisor-smoke',
        label: 'Confirmar gVisor',
        command: 'npm run sandbox:doctor:smoke',
        severity: 'warn',
        reason: 'O container esta pronto, mas o runtime seguro ainda nao confirmou gVisor ativo.',
      });
    }

    if (!policies.firecrackerReady) {
      actions.push({
        id: 'microvm-smoke',
        label: 'Validar microVM',
        command: health.firecracker.recommendedAction || 'npm run sandbox:firecracker:smoke',
        severity: 'warn',
        reason: health.firecracker.detail || 'A microVM ainda precisa de um smoke de prontidao.',
      });
    }

    if (health.wasm.recommendedAction) {
      actions.push({
        id: 'validate-wasm-smoke',
        label: 'Validar tier Wasm',
        command: health.wasm.recommendedAction,
        severity: policies.wasmReady ? 'info' : 'warn',
        reason: health.wasm.detail || 'O tier Wasm ainda precisa de um smoke de prontidao.',
      });
    }

    if (!policies.nodeHostAvailable) {
      actions.push({
        id: 'node-host-pair',
        label: 'Parear node host',
        command: '/nodepair headless',
        severity: 'info',
        reason: 'Node host ainda nao esta disponivel como extensao do mesh.',
      });
    }

    if (health.nodeMeshSmoke?.status !== 'passed' || health.nodeMeshSmoke?.stale) {
      actions.push({
        id: 'node-mesh-validate',
        label: 'Validar malha de nodes',
        command:
          health.nodeMeshSmoke?.recommendedAction
          || health.nodeMeshSmoke?.command
          || 'npm run test:nodes:smoke',
        severity: health.nodeMeshSmoke?.status === 'failed' ? 'warn' : 'info',
        reason:
          health.nodeMeshSmoke?.status === 'failed'
            ? (health.nodeMeshSmoke.error || 'O ultimo smoke real do Node Mesh falhou e precisa ser repetido.')
            : health.nodeMeshSmoke?.stale
              ? 'O ultimo smoke real do Node Mesh venceu e precisa ser renovado antes de confiar na malha.'
            : health.nodeMeshSmoke?.status === 'running'
              ? 'Existe um smoke real do Node Mesh em andamento; aguarde a conclusao antes de confiar na malha.'
              : 'Ainda nao existe um smoke real recente do Node Mesh neste host.',
      });
    }

    if (!policies.remoteSidecarAvailable) {
      actions.push({
        id: 'sidecar-connect',
        label: 'Preparar sidecar remoto',
        command: '/connect AIGateway',
        severity: 'info',
        reason: 'O sidecar remoto ainda nao foi promovido para o mesh de runtime.',
      });
    }

    if (health.security.lastAudit.ok === false) {
      actions.push({
        id: 'audit-trail-check',
        label: 'Revisar trilha de auditoria',
        command: 'npm run security:preflight',
        severity: 'warn',
        reason: health.security.lastAudit.summary || 'A trilha de auditoria criptografica reportou degradacao recente.',
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
      recentChain: Array.isArray(audit.recentChain) ? audit.recentChain.slice(0, 4) : [],
    };
  }

  private buildAuditTrailNarrative(health: OperationsHealthSnapshot): string {
    const audit = health.security.lastAudit;
    if (audit.totalEvents > 0) {
      return `Trilha criptografica com ${audit.totalEvents} evento(s); ultimo ${audit.latestEventType || 'evento'} em ${audit.latestTaskId || 'task desconhecida'}.`;
    }

    if (audit.available) {
      return 'Status da auditoria criptografica disponivel, mas a cadeia ainda nao recebeu eventos.';
    }

    return 'A trilha de auditoria criptografica ainda nao foi observada neste host.';
  }

  private buildNodeMeshNarrative(health: OperationsHealthSnapshot): string {
    const smoke = health.nodeMeshSmoke;
    if (!smoke || smoke.status === 'missing') {
      return 'A malha de nodes ainda nao tem smoke real recente registrado.';
    }

    if (smoke.status === 'running') {
      return 'A malha de nodes esta em validacao por smoke real neste momento.';
    }

    if (smoke.status === 'failed') {
      return smoke.error
        ? `A malha de nodes falhou no ultimo smoke real: ${smoke.error}.`
        : 'A malha de nodes falhou no ultimo smoke real e pede nova validacao.';
    }

    if (smoke.stale) {
      return `A malha de nodes teve smoke real valido em ${smoke.checkedAt || 'data desconhecida'}, mas o relatorio venceu e precisa de nova validacao antes de invokes pareados sensiveis.`;
    }

    return `A malha de nodes foi validada por smoke real em ${smoke.checkedAt || 'data desconhecida'} com ultimo invoke ${smoke.recentCapabilityId || 'n/d'}.`;
  }

  private buildTrustBoundaryNarrative(
    health: OperationsHealthSnapshot,
    policies: ZavorthSecurityMeshSnapshot['policies'],
  ): string {
    const base = policies.firecrackerReady
      ? 'Conteudo de alto risco sobe para microVM sem rebaixar para container.'
      : 'Conteudo de alto risco continua bloqueando em vez de cair para tiers mais fracos.';
    const smoke = health.nodeMeshSmoke;

    if (!smoke || smoke.status === 'missing') {
      return `${base} A malha de nodes ainda nao foi validada por smoke real recente.`;
    }

    if (smoke.status === 'running') {
      return `${base} A validacao real da malha de nodes esta em andamento.`;
    }

    if (smoke.status === 'failed') {
      return `${base} O ultimo smoke real da malha de nodes falhou, entao invokes pareados ainda pedem cautela adicional.`;
    }

    if (smoke.stale) {
      return `${base} A malha de nodes teve smoke real valido anteriormente, mas a evidencia operacional venceu e precisa ser renovada antes de confiar plenamente em invokes pareados.`;
    }

    return `${base} A malha de nodes ja foi validada por smoke real para pairing, heartbeat e invoke end-to-end.`;
  }
}

