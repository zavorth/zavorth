import type {
  NodeMeshCapabilityId,
  NodeMeshRegistryEntry,
} from '../contracts/NodeMeshContract.js';
import { NodeCapabilityService } from './NodeCapabilityService.js';
import { NodeRegistryService } from './NodeRegistryService.js';
import type { LiveNodeCapabilityDelta } from './LiveNodeRegistryService.js';

export type NodeCapabilityReapprovalDecision =
  | {
      allowed: true;
      node: NodeMeshRegistryEntry;
      delta: LiveNodeCapabilityDelta;
      reason: string;
    }
  | {
      allowed: false;
      node: NodeMeshRegistryEntry;
      delta: LiveNodeCapabilityDelta;
      reason: string;
      commandHint: string;
    };

type Runtime = {
  now?: () => Date;
  registryService?: NodeRegistryService;
  capabilityService?: NodeCapabilityService;
};

function asSet(entries: NodeMeshCapabilityId[]): Set<NodeMeshCapabilityId> {
  return new Set(entries.map((entry) => String(entry || '').trim()).filter(Boolean));
}

function diffCapabilities(
  previous: NodeMeshCapabilityId[],
  declared: NodeMeshCapabilityId[],
): LiveNodeCapabilityDelta {
  const previousSet = asSet(previous);
  const declaredSet = asSet(declared);
  return {
    added: declared.filter((entry) => !previousSet.has(entry)),
    removed: previous.filter((entry) => !declaredSet.has(entry)),
    unchanged: declared.filter((entry) => previousSet.has(entry)),
  };
}

export class NodeCapabilityReapprovalService {
  private readonly now: () => Date;
  private readonly registryService: NodeRegistryService;
  private readonly capabilityService: NodeCapabilityService;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.registryService = runtime.registryService || new NodeRegistryService();
    this.capabilityService = runtime.capabilityService || new NodeCapabilityService();
  }

  public reconcileHeartbeat(input: {
    nodeId: string | null | undefined;
    declaredCapabilityIds?: Array<string | null | undefined> | null;
    approvedCapabilityIds?: Array<string | null | undefined> | null;
  }): NodeCapabilityReapprovalDecision | null {
    const current = this.registryService.getNode(input.nodeId);
    if (!current || !current.paired || current.pairingStatus !== 'paired') {
      return null;
    }

    const declared = this.capabilityService.normalizeCapabilityIds(input.declaredCapabilityIds || current.capabilityIds);
    if (declared.length === 0) {
      return {
        allowed: true,
        node: current,
        delta: diffCapabilities(current.capabilityIds, declared),
        reason: 'Heartbeat did not declare any capability changes.',
      };
    }

    const delta = diffCapabilities(current.capabilityIds, declared);
    if (delta.added.length === 0) {
      return {
        allowed: true,
        node: current,
        delta,
        reason: delta.removed.length
          ? 'Node removed capabilities; no extra approval is required.'
          : 'Node capabilities match the approved live profile.',
      };
    }

    const approvedBaseline = this.resolveApprovedBaseline(current);
    const approvedSet = asSet(approvedBaseline);
    const unapprovedAdded = delta.added.filter((capabilityId) => !approvedSet.has(capabilityId));
    if (unapprovedAdded.length === 0) {
      return {
        allowed: true,
        node: current,
        delta,
        reason: 'Node declared only capabilities that are already approved.',
      };
    }

    const riskyAdded = unapprovedAdded.filter((capabilityId) => this.capabilityService.describeCapability(capabilityId).risky);
    const updated = this.registryService.patchNode(current.id, {
      status: 'blocked',
      capabilityIds: declared,
      approvedCapabilityIds: approvedBaseline.filter((capabilityId) => declared.includes(capabilityId)),
      allowlistAudit: {
        approvedAt: current.allowlistAudit?.approvedAt || current.pairedAt || this.now().toISOString(),
        approvedBy: current.allowlistAudit?.approvedBy || current.requestedBy || 'node-mesh',
        reason: `Capability upgrade requires reapproval: ${unapprovedAdded.join(', ')}`,
        mode: 'reapproval-required',
      },
      notes: [
        ...current.notes,
        `Capability upgrade blocked pending approval: ${unapprovedAdded.join(', ')}`,
      ],
      operatorSummary: riskyAdded.length
        ? `Node requested sensitive capability upgrade (${riskyAdded.join(', ')}). Reapproval is required before new work is delivered.`
        : `Node requested capability upgrade (${unapprovedAdded.join(', ')}). Reapproval is required before new work is delivered.`,
    }) || current;

    return {
      allowed: false,
      node: updated,
      delta,
      reason: updated.operatorSummary || 'Node capability upgrade requires reapproval.',
      commandHint: `Approve the new node allowlist before invoking ${updated.label}: ${unapprovedAdded.join(', ')}`,
    };
  }

  private resolveApprovedBaseline(current: NodeMeshRegistryEntry): NodeMeshCapabilityId[] {
    const approved = this.capabilityService.normalizeCapabilityIds(current.approvedCapabilityIds || []);
    if (approved.length > 0) {
      return approved;
    }
    return this.capabilityService.normalizeCapabilityIds(current.capabilityIds);
  }
}
