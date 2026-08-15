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
        headline: 'Fleet and transports monitored',
        operatorSummary:
          `${summary.onlineNodes}/${summary.totalNodes} node(s) online, `
          + `${summary.readyTransports}/${summary.totalTransports} ready transport(s) and `
          + `${summary.recoverableIssues} recoverable issue(s) in the current mesh. `
          + `Stability gate: ${gate.status}.`,
        nextAction: gate.blockingReasons[0] || actions[0]?.label || 'Run keepalive, doctor and recover for the distributed runtime.',
      },
    };
  }

  public renderReport(input: { deepDoctor?: boolean } = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      'Fleet and transports monitored',
      '',
      snapshot.narrative.operatorSummary,
      `Posture: ${snapshot.summary.posture}.`,
      `Node Mesh: ${snapshot.summary.onlineNodes}/${snapshot.summary.totalNodes} online | paired ${snapshot.summary.pairedNodes} | queue ${snapshot.summary.queuedInvocations} | stale ${snapshot.summary.staleQueued}.`,
      `Transports: ${snapshot.summary.readyTransports}/${snapshot.summary.totalTransports} ready(s) | attention ${snapshot.summary.transportAttention}.`,
      `Keepalive: ${snapshot.summary.keepaliveActive ? 'active' : 'missing'} | processes ${snapshot.summary.keepaliveReadyProcesses}/${snapshot.summary.keepaliveTotalProcesses}${snapshot.summary.keepaliveStale ? ' | stale' : ''}.`,
      `Gate: ${snapshot.gate.status} | rollout ${snapshot.gate.canProceedToRollout ? 'allowed' : 'blocked'}.`,
      '',
      'Operational cards:',
      ...snapshot.cards.map((entry) =>
        `- ${entry.label}: ${entry.posture} | ${entry.summary}${entry.command ? ` | ${entry.command}` : ''}`),
    ];
    if (snapshot.actions.length > 0) {
      lines.push(
        '',
        'Suggested actions:',
        ...snapshot.actions.map((entry) =>
          `- ${entry.label}: ${entry.reason}${entry.command ? ` | ${entry.command}` : ''}`),
      );
    }
    if (snapshot.gate.blockingReasons.length > 0 || snapshot.gate.warnings.length > 0) {
      lines.push(
        '',
        'Stability gate:',
        ...snapshot.gate.blockingReasons.map((entry) => `- blocking reason: ${entry}`),
        ...snapshot.gate.warnings.map((entry) => `- warning: ${entry}`),
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
        label: 'Node Mesh Fleet',
        posture:
          Number(input.nodes?.summary?.total || 0) === 0
            ? 'attention'
            : (String(input.nodeDoctor?.status || '') === 'attention' ? 'attention' : 'healthy'),
        summary:
          `${Number(input.nodes?.summary?.online || 0) || 0}/${Number(input.nodes?.summary?.total || 0) || 0} node(s) online | `
          + `queued ${Number(input.nodes?.summary?.queued || 0) || 0} | stale ${Number(input.nodes?.summary?.staleQueued || 0) || 0}.`,
        nextAction: Number(input.nodes?.summary?.total || 0) > 0
          ? 'Use doctor/recover to clean expired pairing drafts and old queue items.'
          : 'Pair at least one node host to enable the supervised mesh.',
        command: 'npm run nodes:doctor',
      },
      {
        id: 'transports',
        label: 'Remote transports',
        posture:
          String(input.transportDoctor?.status || '') === 'failed'
            ? 'critical'
            : ((Number(input.transports?.summary?.attentionRequired || 0) || 0) > 0 ? 'attention' : 'healthy'),
        summary:
          `${Number(input.transports?.summary?.ready || 0) || 0}/${Number(input.transports?.summary?.total || 0) || 0} ready(s) | `
          + `attention ${Number(input.transports?.summary?.attentionRequired || 0) || 0}.`,
        nextAction: Number(input.transports?.summary?.attentionRequired || 0) > 0
          ? 'Run the transport smoke/doctor and repair pending sidecars or bridges.'
          : 'Keep the transport doctor fresh before the next rollout.',
        command: 'npm run test:transports:smoke',
      },
      {
        id: 'keepalive',
        label: 'Monitored keepalive',
        posture: keepaliveReady ? 'healthy' : 'attention',
        summary: input.keepalive
          ? `${input.keepalive.summary.ready}/${input.keepalive.summary.total} process(es) ready | ${input.keepalive.summary.restarts} restart(s).`
          : 'No keepalive snapshot exists yet for sidecars and node host.',
        nextAction: keepaliveReady
          ? 'Renew the keepalive and track the recurring snapshot.'
          : 'Run the official keepalive to revalidate AIGateway, proxy, and node host.',
        command: 'npm run ops:remote:keepalive -- --once',
      },
      {
        id: 'recovery',
        label: 'Canonical recovery',
        posture: recoverableIssues > 0 || String(input.transportDoctor?.status || '') === 'failed'
          ? 'attention'
          : 'healthy',
        summary:
          `${recoverableIssues} recoverable issue(s) in the Node Mesh`
          + `${String(input.transportDoctor?.status || '') === 'failed' ? ' and transport doctor with failure.' : '.'}`,
        nextAction: recoverableIssues > 0
          ? 'Apply recover-all and revalidate the remote queue.'
          : 'No urgent repair needed; keep doctor and keepalive active.',
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
        label: 'Revalidate monitored keepalive',
        severity: 'warn',
        reason: input.keepalive
          ? 'The keepalive snapshot is stale or has unhealthy processes.'
          : 'No official keepalive snapshot exists yet for this mesh.',
        command: 'npm run ops:remote:keepalive -- --once',
      });
    }
    if (String(input.nodeDoctor?.status || '') === 'attention') {
      actions.push({
        id: 'node-doctor',
        label: 'Run Node Mesh doctor/recover',
        severity: 'warn',
        reason: this.text(input.nodeDoctor?.summary, 'The Node Mesh still has pending operational issues.'),
        command: 'npm run nodes:doctor -- --repair-all',
      });
    }
    if (String(input.transportDoctor?.status || '') === 'failed') {
      actions.push({
        id: 'transport-doctor',
        label: 'Renew transport doctor',
        severity: 'critical',
        reason: this.text(input.transportDoctor?.summary, 'The transport doctor still found failures.'),
        command: 'npm run test:transports:smoke',
      });
    }
    if ((Number(input.nodes?.summary?.online || 0) || 0) === 0) {
      actions.push({
        id: 'node-host-bootstrap',
        label: 'Start a supervised node host',
        severity: 'warn',
        reason: 'No node is online right now; the fleet does not support remote invokes yet.',
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
        summary: this.text(entry?.nextAction, 'Node Mesh has a recoverable stale queue or pairing draft.'),
      }));

    return {
      checkedAt: this.now().toISOString(),
      status: issues.length > 0 ? 'attention' : 'healthy',
      summary: issues.length > 0
        ? `Node Mesh has ${issues.length} recoverable issue(s) in the fast doctor.`
        : 'Node Mesh has no recoverable issues in the fast doctor.',
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
        detail: 'Stability gate does not accept critical posture or critical action.',
      },
      {
        id: 'paired-node-online-when-queued',
        ok: summary.pairedNodes === 0 || summary.onlineNodes >= 1 || summary.queuedInvocations <= 0,
        severity: 'critical',
        detail: 'Paired offline node blocks rollout only when there is an active remote queue.',
      },
      {
        id: 'paired-node-online-for-clean-pass',
        ok: summary.pairedNodes === 0 || summary.onlineNodes >= 1,
        severity: 'warn',
        detail: 'Paired offline node leaves the mesh in lazy mode; start a node host for passed status.',
      },
      {
        id: 'stale-queue-budget',
        ok: summary.staleQueued <= 0,
        severity: 'warn',
        detail: 'Stale queue must be zero for a clean rollout.',
      },
      {
        id: 'transport-attention-budget',
        ok: summary.transportAttention <= 0,
        severity: 'warn',
        detail: 'Transports must not require attention before rollout.',
      },
      {
        id: 'keepalive-fresh',
        ok: summary.keepaliveActive && !summary.keepaliveStale && summary.keepaliveReadyProcesses === summary.keepaliveTotalProcesses,
        severity: 'warn',
        detail: 'Fresh and complete keepalive is required for passed status.',
      },
      {
        id: 'recoverable-issues-budget',
        ok: summary.recoverableIssues <= 0,
        severity: 'warn',
        detail: 'Recoverable issues must be cleared before promoting rollout.',
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
    } catch (error: unknown) {logger.warn('[Zavorth Runtime Stability Control Plane] array operation failed', error); return fallback; }
  }

  private text(value: unknown, fallback = ''): string {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  }
}
