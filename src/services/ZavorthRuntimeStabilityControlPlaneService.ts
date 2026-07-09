import { config } from '../config/index.js';
import { ZavorthNodeMeshService } from './ZavorthNodeMeshService.js';
import { ZavorthRemoteTransportService } from './ZavorthRemoteTransportService.js';
import { KeepaliveStatusService, type KeepaliveStatusSnapshot } from './KeepaliveStatusService.js';
import { NodeMeshRecoveryService } from './NodeMeshRecoveryService.js';
import { RemoteTransportDoctorService } from './RemoteTransportDoctorService.js';
import { logger } from '../logger.js';
type RuntimeStabilityDynamic = any;

type RuntimeStabilityPosture = 'healthy' | 'attention' | 'critical';
type RuntimeStabilitySeverity = 'info' | 'warn' | 'critical';
type RuntimeStabilityGateStatus = 'passed' | 'warning' | 'failed';

type SyncSnapshotLike = {
  buildSnapshot: (input?: RuntimeStabilityDynamic) => RuntimeStabilityDynamic;
};

type RuntimeStabilityDeps = {
  now?: () => Date;
  workspaceRoot?: string | null;
  nodeMeshService?: SyncSnapshotLike | null;
  remoteTransportService?: SyncSnapshotLike | null;
  nodeMeshRecoveryService?: Pick<NodeMeshRecoveryService, 'runDoctor'> | null;
  remoteTransportDoctorService?: Pick<RemoteTransportDoctorService, 'readLastReport'> | null;
  keepaliveStatusService?: Pick<KeepaliveStatusService, 'readSnapshot'> | null;
};

export type ZavorthRuntimeStabilityCard = {
  id: 'fleet' | 'transports' | 'keepalive' | 'recovery';
  label: string;
  posture: RuntimeStabilityPosture;
  summary: string;
  nextAction: string;
  command: string | null;
};

export type ZavorthRuntimeStabilityGate = {
  status: RuntimeStabilityGateStatus;
  canProceedToRollout: boolean;
  blockingReasons: string[];
  warnings: string[];
  budgets: {
    maxStaleQueued: number;
    maxTransportAttention: number;
    minOnlineNodesWhenPaired: number;
    keepaliveFreshRequiredForPass: boolean;
  };
  checks: Array<{
    id: string;
    ok: boolean;
    severity: 'warn' | 'critical';
    detail: string;
  }>;
};

export type ZavorthRuntimeStabilitySnapshot = {
  generatedAt: string;
  workspaceRoot: string;
  summary: {
    posture: RuntimeStabilityPosture;
    totalNodes: number;
    onlineNodes: number;
    pairedNodes: number;
    queuedInvocations: number;
    staleQueued: number;
    totalTransports: number;
    readyTransports: number;
    transportAttention: number;
    keepaliveActive: boolean;
    keepaliveStale: boolean;
    keepaliveReadyProcesses: number;
    keepaliveTotalProcesses: number;
    recoverableIssues: number;
  };
  cards: ZavorthRuntimeStabilityCard[];
  actions: Array<{
    id: string;
    label: string;
    severity: RuntimeStabilitySeverity;
    reason: string;
    command: string | null;
  }>;
  gate: ZavorthRuntimeStabilityGate;
  keepalive: KeepaliveStatusSnapshot | null;
  sourceSnapshots: {
    nodes: RuntimeStabilityDynamic;
    nodeDoctor: RuntimeStabilityDynamic;
    transports: RuntimeStabilityDynamic;
    transportDoctor: RuntimeStabilityDynamic;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};

export class ZavorthRuntimeStabilityControlPlaneService {
  private readonly now: () => Date;
  private readonly workspaceRoot: string;
  private readonly nodeMesh: SyncSnapshotLike;
  private readonly remoteTransports: SyncSnapshotLike;
  private readonly nodeRecovery: Pick<NodeMeshRecoveryService, 'runDoctor'>;
  private readonly transportDoctor: Pick<RemoteTransportDoctorService, 'readLastReport'>;
  private readonly keepaliveStatus: Pick<KeepaliveStatusService, 'readSnapshot'>;
  private readonly injectedNodeRecovery: boolean;

  constructor(runtime: RuntimeStabilityDeps = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceRoot = this.text(runtime.workspaceRoot, config.projectRoot || process.cwd());
    this.nodeMesh = runtime.nodeMeshService || new ZavorthNodeMeshService();
    this.remoteTransports =
      runtime.remoteTransportService
      || new ZavorthRemoteTransportService({
        nodeMeshService: this.nodeMesh as RuntimeStabilityDynamic,
      });
    this.nodeRecovery =
      runtime.nodeMeshRecoveryService
      || new NodeMeshRecoveryService({
        nodeMeshService: this.nodeMesh as RuntimeStabilityDynamic,
      });
    this.injectedNodeRecovery = Boolean(runtime.nodeMeshRecoveryService);
    this.transportDoctor =
      runtime.remoteTransportDoctorService
      || new RemoteTransportDoctorService({
        remoteTransportService: this.remoteTransports as RuntimeStabilityDynamic,
      });
    this.keepaliveStatus = runtime.keepaliveStatusService || new KeepaliveStatusService();
  }

  public buildSnapshot(input: { deepDoctor?: boolean } = {}): ZavorthRuntimeStabilitySnapshot {
    const nodes = this.safeSnapshot(() => this.nodeMesh.buildSnapshot(), { entries: [], summary: {} });
    const nodeDoctor = input.deepDoctor || this.injectedNodeRecovery
      ? this.safeSnapshot(() => this.nodeRecovery.runDoctor(), this.buildLightweightNodeDoctor(nodes))
      : this.buildLightweightNodeDoctor(nodes);
    const transports = this.safeSnapshot(() => this.remoteTransports.buildSnapshot(), { entries: [], summary: {}, suggestedActions: [] });
    const transportDoctor = this.transportDoctor.readLastReport() || null;
    const keepalive = this.keepaliveStatus.readSnapshot();
    const cards = this.buildCards({ nodes, nodeDoctor, transports, transportDoctor, keepalive });
    const actions = this.buildActions({ nodes, nodeDoctor, transports, transportDoctor, keepalive });
    const summary = {
      posture: this.resolvePosture(cards, actions),
      totalNodes: Number(nodes?.summary?.total || 0) || 0,
      onlineNodes: Number(nodes?.summary?.online || 0) || 0,
      pairedNodes: Number(nodes?.summary?.paired || 0) || 0,
      queuedInvocations: Number(nodes?.summary?.queued || 0) || 0,
      staleQueued: Number(nodes?.summary?.staleQueued || 0) || 0,
      totalTransports: Number(transports?.summary?.total || 0) || 0,
      readyTransports: Number(transports?.summary?.ready || 0) || 0,
      transportAttention: Number(transports?.summary?.attentionRequired || 0) || 0,
      keepaliveActive: Boolean(keepalive),
      keepaliveStale: Boolean(keepalive?.stale),
      keepaliveReadyProcesses: Number(keepalive?.summary?.ready || 0) || 0,
      keepaliveTotalProcesses: Number(keepalive?.summary?.total || 0) || 0,
      recoverableIssues: Array.isArray(nodeDoctor?.issues)
        ? nodeDoctor.issues.filter((entry: RuntimeStabilityDynamic) => entry?.recoverable).length
        : 0,
    };
    const gate = this.buildGate(summary, actions);
    return {
      generatedAt: this.now().toISOString(),
      workspaceRoot: this.workspaceRoot,
      summary,
      cards,
      actions,
      gate,
      keepalive,
      sourceSnapshots: {
        nodes,
        nodeDoctor,
        transports,
        transportDoctor,
      },
      narrative: {
        headline: 'Fleet e transports supervisionados',
        operatorSummary:
          `${summary.onlineNodes}/${summary.totalNodes} node(s) online, `
          + `${summary.readyTransports}/${summary.totalTransports} transporte(s) prontos e `
          + `${summary.recoverableIssues} issue(s) recuperavel(is) no mesh atual. `
          + `Gate de estabilidade: ${gate.status}.`,
        nextAction: gate.blockingReasons[0] || actions[0]?.label || 'Rodar keepalive, doctor e recover do runtime distribuido.',
      },
    };
  }

  public renderReport(input: { deepDoctor?: boolean } = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      'Fleet e transports supervisionados',
      '',
      snapshot.narrative.operatorSummary,
      `Postura: ${snapshot.summary.posture}.`,
      `Node Mesh: ${snapshot.summary.onlineNodes}/${snapshot.summary.totalNodes} online | paired ${snapshot.summary.pairedNodes} | fila ${snapshot.summary.queuedInvocations} | stale ${snapshot.summary.staleQueued}.`,
      `Transports: ${snapshot.summary.readyTransports}/${snapshot.summary.totalTransports} pronto(s) | attention ${snapshot.summary.transportAttention}.`,
      `Keepalive: ${snapshot.summary.keepaliveActive ? 'ativo' : 'ausente'} | processos ${snapshot.summary.keepaliveReadyProcesses}/${snapshot.summary.keepaliveTotalProcesses}${snapshot.summary.keepaliveStale ? ' | stale' : ''}.`,
      `Gate: ${snapshot.gate.status} | rollout ${snapshot.gate.canProceedToRollout ? 'permitido' : 'bloqueado'}.`,
      '',
      'Cards operacionais:',
      ...snapshot.cards.map((entry) =>
        `- ${entry.label}: ${entry.posture} | ${entry.summary}${entry.command ? ` | ${entry.command}` : ''}`),
    ];
    if (snapshot.actions.length > 0) {
      lines.push(
        '',
        'Acoes sugeridas:',
        ...snapshot.actions.map((entry) =>
          `- ${entry.label}: ${entry.reason}${entry.command ? ` | ${entry.command}` : ''}`),
      );
    }
    if (snapshot.gate.blockingReasons.length > 0 || snapshot.gate.warnings.length > 0) {
      lines.push(
        '',
        'Gate de estabilidade:',
        ...snapshot.gate.blockingReasons.map((entry) => `- bloqueio: ${entry}`),
        ...snapshot.gate.warnings.map((entry) => `- aviso: ${entry}`),
      );
    }
    return lines.join('\n');
  }

  private buildCards(input: {
    nodes: RuntimeStabilityDynamic;
    nodeDoctor: RuntimeStabilityDynamic;
    transports: RuntimeStabilityDynamic;
    transportDoctor: RuntimeStabilityDynamic;
    keepalive: KeepaliveStatusSnapshot | null;
  }): ZavorthRuntimeStabilityCard[] {
    const recoverableIssues = Array.isArray(input.nodeDoctor?.issues)
      ? input.nodeDoctor.issues.filter((entry: RuntimeStabilityDynamic) => entry?.recoverable).length
      : 0;
    const keepaliveReady = input.keepalive?.ok === true;
    return [
      {
        id: 'fleet',
        label: 'Fleet do Node Mesh',
        posture:
          Number(input.nodes?.summary?.total || 0) === 0
            ? 'attention'
            : (String(input.nodeDoctor?.status || '') === 'attention' ? 'attention' : 'healthy'),
        summary:
          `${Number(input.nodes?.summary?.online || 0) || 0}/${Number(input.nodes?.summary?.total || 0) || 0} node(s) online | `
          + `queued ${Number(input.nodes?.summary?.queued || 0) || 0} | stale ${Number(input.nodes?.summary?.staleQueued || 0) || 0}.`,
        nextAction: Number(input.nodes?.summary?.total || 0) > 0
          ? 'Usar o doctor/recover para limpar pairing drafts expirados e fila antiga.'
          : 'Parear ao menos um node host para ligar a malha supervisionada.',
        command: 'npm run nodes:doctor',
      },
      {
        id: 'transports',
        label: 'Transports remotos',
        posture:
          String(input.transportDoctor?.status || '') === 'failed'
            ? 'critical'
            : ((Number(input.transports?.summary?.attentionRequired || 0) || 0) > 0 ? 'attention' : 'healthy'),
        summary:
          `${Number(input.transports?.summary?.ready || 0) || 0}/${Number(input.transports?.summary?.total || 0) || 0} pronto(s) | `
          + `attention ${Number(input.transports?.summary?.attentionRequired || 0) || 0}.`,
        nextAction: Number(input.transports?.summary?.attentionRequired || 0) > 0
          ? 'Rodar o smoke/doctor dos transports e reparar sidecars ou bridges pendentes.'
          : 'Manter o doctor dos transports fresco antes do proximo rollout.',
        command: 'npm run test:transports:smoke',
      },
      {
        id: 'keepalive',
        label: 'Keepalive supervisionado',
        posture: keepaliveReady ? 'healthy' : 'attention',
        summary: input.keepalive
          ? `${input.keepalive.summary.ready}/${input.keepalive.summary.total} processo(s) ready | ${input.keepalive.summary.restarts} restart(s).`
          : 'Ainda nao existe snapshot de keepalive para sidecars e node host.',
        nextAction: keepaliveReady
          ? 'Renovar o keepalive e acompanhar o snapshot recorrente.'
          : 'Executar o keepalive oficial para revalidar AIGateway, proxy e node host.',
        command: 'npm run ops:remote:keepalive -- --once',
      },
      {
        id: 'recovery',
        label: 'Recover canônico',
        posture: recoverableIssues > 0 || String(input.transportDoctor?.status || '') === 'failed'
          ? 'attention'
          : 'healthy',
        summary:
          `${recoverableIssues} issue(s) recuperavel(is) no Node Mesh`
          + `${String(input.transportDoctor?.status || '') === 'failed' ? ' e transport doctor com falha.' : '.'}`,
        nextAction: recoverableIssues > 0
          ? 'Aplicar recover-all e revalidar a fila remota.'
          : 'Sem repair urgente; manter doctor e keepalive ativos.',
        command: 'npm run nodes:doctor -- --repair-all',
      },
    ];
  }

  private buildActions(input: {
    nodes: RuntimeStabilityDynamic;
    nodeDoctor: RuntimeStabilityDynamic;
    transports: RuntimeStabilityDynamic;
    transportDoctor: RuntimeStabilityDynamic;
    keepalive: KeepaliveStatusSnapshot | null;
  }): ZavorthRuntimeStabilitySnapshot['actions'] {
    const actions: ZavorthRuntimeStabilitySnapshot['actions'] = [];
    if (!input.keepalive || input.keepalive.stale || input.keepalive.ok !== true) {
      actions.push({
        id: 'keepalive-once',
        label: 'Revalidar keepalive supervisionado',
        severity: 'warn',
        reason: input.keepalive
          ? 'O snapshot do keepalive esta stale ou com processos unhealthy.'
          : 'Ainda nao existe snapshot oficial de keepalive para esta malha.',
        command: 'npm run ops:remote:keepalive -- --once',
      });
    }
    if (String(input.nodeDoctor?.status || '') === 'attention') {
      actions.push({
        id: 'node-doctor',
        label: 'Rodar doctor/recover do Node Mesh',
        severity: 'warn',
        reason: this.text(input.nodeDoctor?.summary, 'O Node Mesh ainda tem pendencias operacionais.'),
        command: 'npm run nodes:doctor -- --repair-all',
      });
    }
    if (String(input.transportDoctor?.status || '') === 'failed') {
      actions.push({
        id: 'transport-doctor',
        label: 'Renovar o doctor dos transports',
        severity: 'critical',
        reason: this.text(input.transportDoctor?.summary, 'O doctor dos transports ainda encontrou falhas.'),
        command: 'npm run test:transports:smoke',
      });
    }
    if ((Number(input.nodes?.summary?.online || 0) || 0) === 0) {
      actions.push({
        id: 'node-host-bootstrap',
        label: 'Subir um node host supervisionado',
        severity: 'warn',
        reason: 'Nenhum node esta online neste momento; a fleet ainda nao sustenta invokes remotos.',
        command: 'npm run nodes:host',
      });
    }
    return actions.slice(0, 6);
  }

  private resolvePosture(
    cards: ZavorthRuntimeStabilityCard[],
    actions: ZavorthRuntimeStabilitySnapshot['actions'],
  ): RuntimeStabilityPosture {
    if (cards.some((entry) => entry.posture === 'critical') || actions.some((entry) => entry.severity === 'critical')) {
      return 'critical';
    }
    if (cards.some((entry) => entry.posture === 'attention') || actions.length > 0) {
      return 'attention';
    }
    return 'healthy';
  }

  private buildLightweightNodeDoctor(nodes: RuntimeStabilityDynamic): {
    checkedAt: string;
    status: 'healthy' | 'attention';
    summary: string;
    selectedNodeId: string | null;
    issues: Array<{
      nodeId: string;
      label: string;
      kind: string;
      recoverable: boolean;
      summary: string;
    }>;
  } {
    const entries = Array.isArray(nodes?.entries) ? nodes.entries : [];
    const issues = entries
      .filter((entry: RuntimeStabilityDynamic) =>
        Boolean(entry?.lifecycle?.pairingDraftStale)
        || (Number(entry?.stalePendingInvocations || 0) || 0) > 0
        || (Number(entry?.staleClaimedInvocations || 0) || 0) > 0)
      .map((entry: RuntimeStabilityDynamic) => ({
        nodeId: this.text(entry?.id, 'node'),
        label: this.text(entry?.label, entry?.id || 'node'),
        kind: Boolean(entry?.lifecycle?.pairingDraftStale)
          ? 'expired-pairing-draft'
          : 'stale-queue-debt',
        recoverable: true,
        summary: this.text(entry?.nextAction, 'Node Mesh tem fila ou pairing stale recuperavel.'),
      }));

    return {
      checkedAt: this.now().toISOString(),
      status: issues.length > 0 ? 'attention' : 'healthy',
      summary: issues.length > 0
        ? `Node Mesh com ${issues.length} pendencia(s) recuperavel(is) no fast doctor.`
        : 'Node Mesh sem pendencias recuperaveis no fast doctor.',
      selectedNodeId: this.text(nodes?.selected?.id, '') || issues[0]?.nodeId || null,
      issues,
    };
  }

  private buildGate(
    summary: ZavorthRuntimeStabilitySnapshot['summary'],
    actions: ZavorthRuntimeStabilitySnapshot['actions'],
  ): ZavorthRuntimeStabilityGate {
    const checks: ZavorthRuntimeStabilityGate['checks'] = [
      {
        id: 'posture-not-critical',
        ok: summary.posture !== 'critical' && !actions.some((entry) => entry.severity === 'critical'),
        severity: 'critical',
        detail: 'Stability gate nao aceita postura critical ou action critical.',
      },
      {
        id: 'paired-node-online-when-queued',
        ok: summary.pairedNodes === 0 || summary.onlineNodes >= 1 || summary.queuedInvocations <= 0,
        severity: 'critical',
        detail: 'Node pareado offline bloqueia rollout somente quando existe fila remota ativa.',
      },
      {
        id: 'paired-node-online-for-clean-pass',
        ok: summary.pairedNodes === 0 || summary.onlineNodes >= 1,
        severity: 'warn',
        detail: 'Node pareado offline deixa a malha em modo lazy; ligue um node host para status passed.',
      },
      {
        id: 'stale-queue-budget',
        ok: summary.staleQueued <= 0,
        severity: 'warn',
        detail: 'Fila stale deve ficar em zero para rollout limpo.',
      },
      {
        id: 'transport-attention-budget',
        ok: summary.transportAttention <= 0,
        severity: 'warn',
        detail: 'Transports nao devem pedir attention antes de rollout.',
      },
      {
        id: 'keepalive-fresh',
        ok: summary.keepaliveActive && !summary.keepaliveStale && summary.keepaliveReadyProcesses === summary.keepaliveTotalProcesses,
        severity: 'warn',
        detail: 'Keepalive fresco e completo e necessario para status passed.',
      },
      {
        id: 'recoverable-issues-budget',
        ok: summary.recoverableIssues <= 0,
        severity: 'warn',
        detail: 'Issues recuperaveis precisam ser zeradas antes de promover rollout.',
      },
    ];
    const failedCritical = checks.filter((entry) => !entry.ok && entry.severity === 'critical');
    const failedWarning = checks.filter((entry) => !entry.ok && entry.severity === 'warn');
    const status: RuntimeStabilityGateStatus =
      failedCritical.length > 0
        ? 'failed'
        : failedWarning.length > 0
          ? 'warning'
          : 'passed';

    return {
      status,
      canProceedToRollout: status !== 'failed',
      blockingReasons: failedCritical.map((entry) => entry.detail),
      warnings: failedWarning.map((entry) => entry.detail),
      budgets: {
        maxStaleQueued: 0,
        maxTransportAttention: 0,
        minOnlineNodesWhenPaired: 1,
        keepaliveFreshRequiredForPass: true,
      },
      checks,
    };
  }

  private safeSnapshot<T>(reader: () => T, fallback: T): T {
    try {
      return reader();
    } catch (error: any) { logger.warn('[Zavorth Runtime Stability Control Plane] array operation failed', error); return fallback; }
  }

  private text(value: unknown, fallback = ''): string {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  }
}
