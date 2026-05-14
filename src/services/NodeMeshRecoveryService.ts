import type {
  NodeMeshDoctorIssue,
  NodeMeshDoctorReport,
  NodeMeshPairingDraft,
  NodeMeshRecoveryAction,
} from '../contracts/NodeMeshContract.js';
import type { ZavorthNodeMeshService } from './ZavorthNodeMeshService.js';
import type { NodeInvokeService } from './NodeInvokeService.js';
import type { NodePairingService } from './NodePairingService.js';

type NodeMeshRecoveryRuntime = {
  now?: () => Date;
  nodeMeshService?: ZavorthNodeMeshService | null;
  nodePairingService?: NodePairingService | null;
  nodeInvokeService?: NodeInvokeService | null;
};

type RecoveryActionInput = {
  actionId?: string | null;
  kind?: string | null;
  nodeId?: string | null;
  limit?: number | null;
  profileId?: string | null;
  label?: string | null;
  notes?: string[] | null;
};

export class NodeMeshRecoveryService {
  private readonly now: () => Date;
  private readonly nodeMeshService: ZavorthNodeMeshService | null;
  private readonly nodePairingService: NodePairingService | null;
  private readonly nodeInvokeService: NodeInvokeService | null;

  constructor(runtime: NodeMeshRecoveryRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.nodeMeshService = runtime.nodeMeshService || null;
    this.nodePairingService = runtime.nodePairingService || null;
    this.nodeInvokeService = runtime.nodeInvokeService || null;
  }

  public runDoctor(): NodeMeshDoctorReport {
    if (!this.nodeMeshService) {
      return {
        checkedAt: this.now().toISOString(),
        status: 'attention',
        summary: 'Node Mesh indisponivel para doctor neste runtime.',
        selectedNodeId: null,
        issues: [],
      };
    }

    const snapshot = this.nodeMeshService.buildSnapshot();
    const expiredDrafts = snapshot.entries.filter((entry) =>
      entry.pairingStatus === 'pending' && entry.lifecycle?.pairingDraftStale,
    );
    const staleQueue = snapshot.entries.filter((entry) =>
      (entry.stalePendingInvocations || 0) > 0 || (entry.staleClaimedInvocations || 0) > 0,
    );

    const issues: NodeMeshDoctorIssue[] = [];
    if (expiredDrafts.length > 0) {
      for (const entry of expiredDrafts) {
        issues.push({
          nodeId: entry.id,
          label: entry.label || entry.id,
          kind: 'expired-pairing-draft',
          recoverable: true,
          recoverKind: 'regenerate-pairing-draft',
          summary: `Pairing draft expirado para ${entry.label || entry.id}.`,
          actionHint: entry.nextAction || entry.operatorSummary || null,
        });
      }
    }

    if (staleQueue.length > 0) {
      for (const entry of staleQueue) {
        const pending = entry.stalePendingInvocations || 0;
        const claimed = entry.staleClaimedInvocations || 0;
        const supportsMaintenance = entry.capabilityIds.includes('node.maintenance');
        const recoverKind = supportsMaintenance
          ? 'queue-node-host-maintenance'
          : (claimed > 0 ? 'release-stale-claims' : null);
        issues.push({
          nodeId: entry.id,
          label: entry.label || entry.id,
          kind: pending > 0 ? 'stale-queue-debt' : 'stale-claimed-queue',
          recoverable: Boolean(recoverKind),
          recoverKind,
          summary: `Fila remota antiga em ${entry.label || entry.id}.`,
          actionHint: entry.nextAction || null,
        });
      }
    }

    if (issues.length === 0) {
      return {
        checkedAt: this.now().toISOString(),
        status: 'healthy',
        summary: snapshot.entries.length
          ? 'Node Mesh sem pendencias operacionais relevantes.'
          : 'Node Mesh sem nodes registrados para avaliar.',
        selectedNodeId: snapshot.selected?.id || null,
        issues: [],
      };
    }

    return {
      checkedAt: this.now().toISOString(),
      status: 'attention',
      summary: `Node Mesh com ${issues.length} pendencia(s) operacional(is) a revisar.`,
      selectedNodeId: snapshot.selected?.id || issues[0]?.nodeId || null,
      issues,
    };
  }

  public recover(input: RecoveryActionInput = {}): {
    ok: boolean;
    action: NodeMeshRecoveryAction | null;
    result: unknown | null;
    nodeMesh: ReturnType<ZavorthNodeMeshService['buildSnapshot']> | null;
  } {
    const actionKind = this.normalizeRecoveryKind(input.kind || input.actionId);
    if (!actionKind) {
      return {
        ok: false,
        action: null,
        result: null,
        nodeMesh: this.nodeMeshService?.buildSnapshot() || null,
      };
    }

    if (actionKind === 'regenerate-pairing-draft') {
      const draft = this.regeneratePairing(input);
      return {
        ok: Boolean(draft),
        action: {
          kind: actionKind,
          summary: 'Regenera um novo pairing draft para o node selecionado.',
        },
        result: draft,
        nodeMesh: this.nodeMeshService?.buildSnapshot({ selectedNodeId: draft?.entry?.id || null }) || null,
      };
    }

    if (actionKind === 'release-stale-claims') {
      const nodeId = String(input.nodeId || '').trim();
      const requeued = nodeId && this.nodeInvokeService
        ? this.nodeInvokeService.requeueStaleClaimed(nodeId, Number(input.limit || 10))
        : [];
      return {
        ok: requeued.length > 0,
        action: {
          kind: actionKind,
          summary: 'Libera claims antigas e recoloca a fila remota em pending.',
        },
        result: {
          nodeId: nodeId || null,
          requeuedCount: requeued.length,
          requeued,
        },
        nodeMesh: this.nodeMeshService?.buildSnapshot({ selectedNodeId: nodeId || null }) || null,
      };
    }

    if (actionKind === 'queue-node-host-maintenance') {
      const nodeId = String(input.nodeId || '').trim();
      const invoke = nodeId && this.nodeInvokeService
        ? this.nodeInvokeService.invoke({
          nodeId,
          capabilityId: 'node.maintenance',
          action: 'repair',
          payload: {
            reason: 'node-mesh-recover',
          },
          requestedBy: 'node-mesh-recovery',
        })
        : {
          ok: false,
          status: 'unavailable',
          nodeId: null,
          capabilityId: 'node.maintenance',
          action: 'repair',
          reason: 'Node Mesh indisponivel para maintenance recovery.',
          transport: null,
          commandHint: null,
          queuedAt: null,
          invocationId: null,
        };
      return {
        ok: Boolean(invoke?.ok),
        action: {
          kind: actionKind,
          summary: 'Enfileira uma manutencao local no node host selecionado.',
        },
        result: invoke,
        nodeMesh: this.nodeMeshService?.buildSnapshot({ selectedNodeId: nodeId || null }) || null,
      };
    }

    return {
      ok: false,
      action: {
        kind: actionKind,
        summary: 'Recover do Node Mesh nao produziu alteracoes neste runtime.',
      },
      result: null,
      nodeMesh: this.nodeMeshService?.buildSnapshot() || null,
    };
  }

  private normalizeRecoveryKind(input: string | null | undefined): NodeMeshRecoveryAction['kind'] | null {
    const normalized = String(input || '').trim().toLowerCase();
    switch (normalized) {
      case 'regenerate-pairing':
      case 'regenerate-pairing-draft':
        return 'regenerate-pairing-draft';
      case 'requeue-stale-claimed':
      case 'release-stale-claims':
        return 'release-stale-claims';
      case 'queue-node-host-maintenance':
      case 'repair-node-host':
        return 'queue-node-host-maintenance';
      default:
        return null;
    }
  }

  private regeneratePairing(input: RecoveryActionInput): NodeMeshPairingDraft | null {
    if (!this.nodePairingService) {
      return null;
    }
    const nodeId = String(input.nodeId || '').trim();
    if (!nodeId) {
      return null;
    }
    return this.nodePairingService.regeneratePairingDraft(nodeId, {
      profileId: input.profileId || null,
      label: input.label || null,
      notes: input.notes || null,
    });
  }
}
