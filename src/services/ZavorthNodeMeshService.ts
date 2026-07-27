import type {
  NodeMeshCapabilitiesSnapshot,
  NodeMeshActivitySnapshot,
  NodeMeshMaintenanceSnapshot,
  NodeMeshSnapshot,
  NodeMeshSnapshotEntry,
  NodeMeshSuggestedAction,
  NodeInvocationRecord,
} from '../contracts/NodeMeshContract.js';
import { NodeCapabilityService } from './NodeCapabilityService.js';

import { NodeDeviceProfileService } from './NodeDeviceProfileService.js';
import { NodeInvokeService } from './NodeInvokeService.js';
import { NodeRegistryService } from './NodeRegistryService.js';

type ZavorthNodeMeshRuntime = {
  now?: () => Date;
  registryService?: NodeRegistryService;
  capabilityService?: NodeCapabilityService;
  invokeService?: NodeInvokeService;
  deviceProfileService?: NodeDeviceProfileService;
};

export class ZavorthNodeMeshService {
  private readonly now: () => Date;
  private readonly registryService: NodeRegistryService;
  private readonly capabilityService: NodeCapabilityService;
  private readonly invokeService: NodeInvokeService;
  private readonly deviceProfileService: NodeDeviceProfileService;

  constructor(runtime: ZavorthNodeMeshRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.registryService = runtime.registryService || new NodeRegistryService();
    this.capabilityService = runtime.capabilityService || new NodeCapabilityService();
    this.invokeService = runtime.invokeService || new NodeInvokeService({
      registryService: this.registryService,
      capabilityService: this.capabilityService,
    });
    this.deviceProfileService = runtime.deviceProfileService || new NodeDeviceProfileService();
  }

  public buildSnapshot(input: { selectedNodeId?: string | null } = {}): NodeMeshSnapshot {
    const generatedAt = this.now().toISOString();
    const entries = this.registryService.listNodes().map((entry) => this.buildEntry(entry));
    const selected = this.selectEntry(entries, input.selectedNodeId);
    const queueSummaries = entries.map((entry) => this.invokeService.summarizeNodeQueue(entry.id));
    const desktopCount = entries.filter((entry) => entry.kind === 'desktop').length;
    const mobileCount = entries.filter((entry) => entry.kind === 'mobile').length;
    const browserCount = entries.filter((entry) => entry.kind === 'browser').length;
    const maintenanceCapable = entries.filter((entry) => entry.capabilityIds.includes('node.maintenance')).length;
    const selectedActivity = this.buildSelectedActivity(selected);
    const hasMaintenanceRecoverCandidate = entries.some((entry) =>
      ((entry.stalePendingInvocations || 0) > 0 || (entry.staleClaimedInvocations || 0) > 0)
      && entry.capabilityIds.includes('node.maintenance'),
    );
    const summary = {
      total: entries.length,
      paired: entries.filter((entry) => entry.paired).length,
      pending: entries.filter((entry) => entry.pairingStatus === 'pending').length,
      online: entries.filter((entry) => entry.status === 'online').length,
      offline: entries.filter((entry) => entry.status === 'offline' || entry.status === 'idle').length,
      invokable: entries.filter((entry) => entry.canInvoke).length,
      capabilities: Array.from(new Set(entries.flatMap((entry) => entry.capabilityIds))).length,
      queued: queueSummaries.reduce((total, item) => total + item.pending + item.claimed, 0),
      completedRecently: queueSummaries.reduce((total, item) => total + item.completedRecently, 0),
      expiredDrafts: entries.filter((entry) => entry.lifecycle?.pairingDraftStale).length,
      staleQueued: queueSummaries.reduce((total, item) => total + item.stalePending + item.staleClaimed, 0),
      staleClaimedInvocations: queueSummaries.reduce((total, item) => total + item.staleClaimed, 0),
    };
    const suggestedActions = this.buildSuggestedActions(entries);

    return {
      generatedAt,
      summary,
      entries,
      selected,
      capabilityCatalog: this.capabilityService.listCatalog(),
      deviceProfiles: this.deviceProfileService.listProfiles(),
      recommendedProfiles: this.deviceProfileService.listRecommendedProfiles(),
      suggestedActions,
      selectedActivity,
      narrative: {
        headline: entries.length ? `Node Mesh exposes ${entries.length} node(s) registered in the control plane.`
          : 'Node Mesh does not have nodes registered in the control plane yet.',
        operatorSummary: entries.length ? `${summary.paired} paired(s), ${summary.pending} pending(s), ${summary.online} online, ${summary.queued} invocation(s) na queue, ${summary.expiredDrafts || 0} pairing(s) expired, ${summary.staleQueued || 0} item(s) old, ${maintenanceCapable} host(s) with node.maintenance e profiles ${desktopCount} desktop / ${mobileCount} mobile / ${browserCount} browser.${this.buildRecoveryNarrative(summary.expiredDrafts || 0, summary.staleQueued || 0, hasMaintenanceRecoverCandidate)}`
          : 'Create the first pairing to connect a headless node, desktop node, or remote bridge to Zavorth.',
      },
    };
  }

  public getNodeEntry(nodeId: string | null | undefined): NodeMeshSnapshotEntry | null {
    const node = this.registryService.getNode(nodeId);
    return node ? this.buildEntry(node) : null;
  }

  public buildActivitySnapshot(nodeId: string | null | undefined): NodeMeshActivitySnapshot | null {
    const selected = this.getNodeEntry(nodeId);
    return this.buildSelectedActivity(selected);
  }

  public buildCapabilitiesSnapshot(nodeId: string | null | undefined): NodeMeshCapabilitiesSnapshot | null {
    const selected = this.getNodeEntry(nodeId);
    if (!selected) {
      return null;
    }

    const categories = Array.from(new Set(selected.capabilities.map((entry) => entry.category))).sort((left, right) =>
      left.localeCompare(right, 'en-US'),
    );
    const risky = selected.capabilities.filter((entry) => entry.risky).length;
    const maintenanceNarrative = this.describeMaintenanceCapability(selected);

    return {
      nodeId: selected.id,
      label: selected.label,
      kind: selected.kind,
      transport: selected.transport,
      paired: selected.paired,
      capabilities: selected.capabilities,
      maintenance: selected.maintenance,
      summary: {
        total: selected.capabilities.length,
        risky,
        categories,
      },
      narrative: {
        headline: selected.capabilities.length ? `${selected.label || selected.id} anuncia ${selected.capabilities.length} capability(ies) no mesh.`
          : `${selected.label || selected.id} has not declared capabilities for the mesh yet.`,
        operatorSummary: selected.capabilities.length
          ? `${risky} capability(ies) marcada(s) como sensitive(is) e categorias ${categories.join(', ') || 'misc'}.${maintenanceNarrative ? ` ${maintenanceNarrative}` : ''}`
          : 'Refresh the node-host catalog before invoking the remote mesh.',
      },
    };
  }

  private buildSelectedActivity(
    selected: NodeMeshSnapshotEntry | null,
  ): NodeMeshActivitySnapshot | null {
    if (!selected?.id) {
      return null;
    }

    const activeInvocations = this.invokeService.listActive(selected.id, 6);
    const recentInvocations = this.invokeService.listRecent(selected.id, 6);
    const pending = activeInvocations.filter((entry) => entry.status === 'pending').length;
    const claimed = activeInvocations.filter((entry) => entry.status === 'claimed').length;
    const completedRecently = recentInvocations.filter((entry) =>
      entry.status === 'completed' || entry.status === 'failed',
    ).length;
    const latest = recentInvocations[0] || activeInvocations[0] || null;
    const queueSummary = this.invokeService.summarizeNodeQueue(selected.id);
    const maintenanceActivity = this.describeMaintenanceActivity(latest);

    return {
      nodeId: selected.id,
      activeInvocations,
      recentInvocations,
      maintenance: this.buildMaintenanceSnapshot({
        capabilityIds: selected.capabilityIds,
        activeInvocations,
        recentInvocations,
        stalePending: queueSummary.stalePending,
        staleClaimed: queueSummary.staleClaimed,
      }),
      summary: {
        pending,
        claimed,
        completedRecently,
        active: activeInvocations.length,
        recent: recentInvocations.length,
        stalePending: queueSummary.stalePending,
        staleClaimed: queueSummary.staleClaimed,
      },
        narrative: {
          headline: activeInvocations.length > 0
            ? `Node ${selected.label || selected.id} has an active remote queue.`
            : 'Selected node has no pending remote queue right now.',
        operatorSummary: queueSummary.stalePending || queueSummary.staleClaimed
          ? (selected.capabilityIds.includes('node.maintenance') ? `${queueSummary.stalePending} pending(s) and ${queueSummary.staleClaimed} claimed old need operational review. Use doctor/recover with queue-node-host-maintenance before enable new invocations.`
              : `${queueSummary.stalePending} pending(s) and ${queueSummary.staleClaimed} old claimed item(s) need operational review. Use doctor/recover with release-stale-claims to clean the queue.`)
            : (latest
                ? (maintenanceActivity || `Latest activity: ${latest.capabilityId} with status ${latest.status}.`)
                : 'There is no recent invocation history for this node yet.'),
        },
    };
  }

  private buildEntry(entry: ReturnType<NodeRegistryService['listNodes']>[number]): NodeMeshSnapshotEntry {
    const capabilities = this.capabilityService.describeCapabilityIds(entry.capabilityIds);
    const preview = capabilities[0]
      ? this.invokeService.preview({
          nodeId: entry.id,
          capabilityId: capabilities[0].id,
          action: 'preview',
        })
      : null;
    const canInvoke = Boolean(preview?.ok && preview.status === 'queued' && entry.status === 'online');
    const queueSummary = this.invokeService.summarizeNodeQueue(entry.id);
    const maintenance = this.buildEntryMaintenanceSnapshot(entry.id, entry.capabilityIds, queueSummary);

    return {
      ...entry,
      capabilities,
      canInvoke,
      nextAction: this.buildNextAction(entry, canInvoke, queueSummary),
      trustLabel: entry.pairingStatus === 'paired'
        ? ((entry.approvedCapabilityIds?.length || 0) > 0 && (entry.approvedCapabilityIds?.length || 0) < entry.capabilityIds.length ? 'paired restrito'
          : 'paired')
        : (entry.pairingStatus === 'pending' ? 'waiting for pairing' : 'revoked'),
      pendingInvocations: queueSummary.pending,
      claimedInvocations: queueSummary.claimed,
      stalePairingDraft: Boolean(entry.lifecycle?.pairingDraftStale),
      stalePendingInvocations: queueSummary.stalePending,
      staleClaimedInvocations: queueSummary.staleClaimed,
      recentInvocation: queueSummary.recent,
      maintenance,
    };
  }

  private buildNextAction(
    entry: Pick<NodeMeshSnapshotEntry, 'pairingStatus' | 'status' | 'profileId' | 'kind' | 'hostHints' | 'lifecycle' | 'capabilityIds' | 'approvedCapabilityIds'>,
    canInvoke: boolean,
    queueSummary: ReturnType<NodeInvokeService['summarizeNodeQueue']>,
  ): string {
    const profile = this.deviceProfileService.describeProfile(entry.profileId);
    const hostIdentity = entry.hostHints?.deviceModel
      || entry.hostHints?.hostname
      || entry.hostHints?.locationLabel
      || null;
    const profileLabel = profile?.label || this.describeKind(entry.kind);
    const contextualProfileLabel = hostIdentity ? `${profileLabel} (${hostIdentity})` : profileLabel;
    const supportsMaintenance = entry.capabilityIds.includes('node.maintenance');
    if (entry.lifecycle?.pairingDraftStale) {
      return `Generate a new pairing draft for ${contextualProfileLabel}; the previous code expired and was invalidated.`;
    }
    if ((entry.approvedCapabilityIds?.length || 0) > 0 && (entry.approvedCapabilityIds?.length || 0) < entry.capabilityIds.length) {
      return `${contextualProfileLabel} operates with a restricted allowlist (${entry.approvedCapabilityIds?.length || 0}/${entry.capabilityIds.length} approved capability(s)).`;
    }
    if (queueSummary.stalePending > 0 || queueSummary.staleClaimed > 0) {
      if (supportsMaintenance) {
        return `Trigger maintenance de ${contextualProfileLabel}: ${queueSummary.stalePending} expired item(s) and ${queueSummary.staleClaimed} claim(s) old podem ser reparados pelo own host.`;
      }
      return `Clean the queue for ${contextualProfileLabel}: ${queueSummary.stalePending} expired item(s) and ${queueSummary.staleClaimed} old claim(s) need review.`;
    }
    if (entry.pairingStatus === 'pending') {
      return `Consume the pairing code for profile ${contextualProfileLabel} and publish the first heartbeat.`;
    }
    if (entry.pairingStatus === 'revoked') {
      return `Reauthorize ${contextualProfileLabel} before using any remote transport.`;
    }
    if (entry.status === 'online' && canInvoke) {
      return `${contextualProfileLabel} ready. O heartbeat remote already pode consumir a queue de invocations.`;
    }
    if (entry.status === 'offline' || entry.status === 'idle') {
      return `Reconnect the ${contextualProfileLabel} to update heartbeat and revalidate transport.`;
    }
    return `Review the capability catalog and configured transport for this ${contextualProfileLabel}.`;
  }

  private buildSuggestedActions(entries: NodeMeshSnapshotEntry[]): NodeMeshSuggestedAction[] {
    if (!entries.length) {
      return this.deviceProfileService.listRecommendedProfiles().map((profile) => ({
        label: `Parear ${profile.label}`,
        reason: profile.operatorSummary,
        actionHint: `Generate a pairing draft for ${profile.label.toLowerCase()} and follow the suggested bootstrap.`,
      }));
    }

    const stalePairing = entries.find((entry) => entry.lifecycle?.pairingDraftStale);
    if (stalePairing) {
      const profile = this.deviceProfileService.describeProfile(stalePairing.profileId);
      return [
        {
          label: `Regenerar pairing de ${profile?.label || stalePairing.label}`,
          reason: `The pairing draft expired for ${profile?.label || stalePairing.label}.`,
          actionHint: 'Use Node Mesh recover with regenerate-pairing-draft to replace the expired code and redo node bootstrap.',
        },
      ];
    }

    const staleQueue = entries.find((entry) =>
      (entry.stalePendingInvocations || 0) > 0 || (entry.staleClaimedInvocations || 0) > 0,
    );
    if (staleQueue) {
      const supportsMaintenance = staleQueue.capabilityIds.includes('node.maintenance');
      return [
        {
          label: supportsMaintenance ? `Trigger maintenance de ${staleQueue.label}`
            : `review queue antiga de ${staleQueue.label}`,
          reason: `${staleQueue.stalePendingInvocations || 0} pending(s) and ${staleQueue.staleClaimedInvocations || 0} claimed old ficaram presas na malha.`,
          actionHint: supportsMaintenance ? 'Use Node Mesh recover with queue-node-host-maintenance to enqueue node.maintenance/repair and watch the next host heartbeat.'
            : 'Use Node Mesh recovery with release-stale-claims and check the latest heartbeat before continuing invocation.',
        },
      ];
    }

    const pending = entries.find((entry) => entry.pairingStatus === 'pending');
    if (pending) {
      const profile = this.deviceProfileService.describeProfile(pending.profileId);
      return [
        {
          label: `Finalizar pairing de ${profile?.label || pending.label}`,
          reason: pending.nextAction,
          actionHint: 'Compartilhe o pairing code with o node host e wait for o primeiro heartbeat.',
        },
      ];
    }

    const offline = entries.find((entry) => entry.pairingStatus === 'paired' && entry.status !== 'online');
    if (offline) {
      const profile = this.deviceProfileService.describeProfile(offline.profileId);
      return [
        {
          label: `Reativar ${profile?.label || offline.label}`,
          reason: offline.nextAction,
          actionHint: 'Restart the node host or reconnect the remote bridge before invoking.',
        },
      ];
    }

    return [
      {
        label: 'Conectar transporte remote',
        reason: 'The registry already knows the node. Keep a node host running for claim, heartbeat, and invoke.',
        actionHint: 'Use the nodes:host script with pairing code or shared secret to connect the remote transport.',
      },
    ];
  }

  private describeKind(kind: string | null | undefined): string {
    switch (String(kind || '').trim().toLowerCase()) {
      case 'desktop':
        return 'Desktop Companion';
      case 'mobile':
        return 'Mobile Companion';
      case 'browser':
        return 'Browser Companion';
      default:
        return 'Headless Worker';
    }
  }

  private buildRecoveryNarrative(
    expiredDrafts: number,
    staleQueued: number,
    hasMaintenanceRecoverCandidate: boolean,
  ): string {
    if (expiredDrafts <= 0 && staleQueued <= 0) {
      return '';
    }

    if (expiredDrafts > 0 && staleQueued > 0) {
      return hasMaintenanceRecoverCandidate ? ' Use doctor/recover with regenerate-pairing-draft and queue-node-host-maintenance to regenerate expired drafts and stabilize the queue.'
        : ' Use doctor/recover with regenerate-pairing-draft and release-stale-claims to regenerate expired drafts and enable old claims in the queue.';
    }

    if (expiredDrafts > 0) {
      return ' Use doctor/recover with regenerate-pairing-draft to regenerate expired pairing drafts.';
    }

    return hasMaintenanceRecoverCandidate ? ' Use doctor/recover with queue-node-host-maintenance to trigger local maintenance and stabilize the mesh queue.'
      : ' Use doctor/recover with release-stale-claims to enable old claims and clean the mesh queue.';
  }

  private buildEntryMaintenanceSnapshot(
    nodeId: string,
    capabilityIds: string[],
    queueSummary: ReturnType<NodeInvokeService['summarizeNodeQueue']>,
  ): NodeMeshMaintenanceSnapshot {
    if (!capabilityIds.includes('node.maintenance')) {
      return {
        supported: false,
        pending: 0,
        claimed: 0,
        latestStatus: null,
        latestAction: null,
        latestResultSummary: null,
        recoverKind: null,
      };
    }

    return this.buildMaintenanceSnapshot({
      capabilityIds,
      activeInvocations: this.invokeService.listActive(nodeId, 6),
      recentInvocations: this.invokeService.listRecent(nodeId, 6),
      stalePending: queueSummary.stalePending,
      staleClaimed: queueSummary.staleClaimed,
    });
  }

  private buildMaintenanceSnapshot(input: {
    capabilityIds: string[];
    activeInvocations: NodeInvocationRecord[];
    recentInvocations: NodeInvocationRecord[];
    stalePending: number;
    staleClaimed: number;
  }): NodeMeshMaintenanceSnapshot {
    const supported = input.capabilityIds.includes('node.maintenance');
    if (!supported) {
      return {
        supported: false,
        pending: 0,
        claimed: 0,
        latestStatus: null,
        latestAction: null,
        latestResultSummary: null,
        recoverKind: null,
      };
    }

    const maintenanceActive = input.activeInvocations.filter((entry) => entry.capabilityId === 'node.maintenance');
    const maintenanceRecent = input.recentInvocations.filter((entry) => entry.capabilityId === 'node.maintenance');
    const latest = maintenanceRecent[0] || maintenanceActive[0] || null;

    return {
      supported: true,
      pending: maintenanceActive.filter((entry) => entry.status === 'pending').length,
      claimed: maintenanceActive.filter((entry) => entry.status === 'claimed').length,
      latestStatus: latest?.status || null,
      latestAction: latest?.action || null,
      latestResultSummary: latest?.resultSummary || null,
      recoverKind: input.stalePending > 0 || input.staleClaimed > 0 ? 'queue-node-host-maintenance' : null,
    };
  }

  private describeMaintenanceCapability(selected: NodeMeshSnapshotEntry): string {
    if (!selected.maintenance.supported) {
      return '';
    }

    if (!selected.maintenance.latestStatus) {
      return 'Maintenance local available via node.maintenance (doctor/repair).';
    }

    if (selected.maintenance.latestStatus === 'completed') {
      return 'Maintenance local available via node.maintenance; latest ciclo de repair completed with success.';
    }

    if (selected.maintenance.latestStatus === 'failed') {
      return 'Maintenance local available via node.maintenance; o latest ciclo de repair failed e pode ser reenfileirado.';
    }

    if (selected.maintenance.latestStatus === 'pending' || selected.maintenance.latestStatus === 'claimed') {
      return 'Maintenance local available via node.maintenance; existe um ciclo de doctor/repair running na queue.';
    }

    return 'Maintenance local available via node.maintenance (doctor/repair).';
  }

  private describeMaintenanceActivity(
    latest: ReturnType<NodeInvokeService['listRecent']>[number] | ReturnType<NodeInvokeService['listActive']>[number] | null,
  ): string | null {
    if (!latest || latest.capabilityId !== 'node.maintenance') {
      return null;
    }

    const actionLabel = latest.action === 'repair'
      ? 'node.maintenance/repair'
      : latest.action === 'doctor'
        ? 'node.maintenance/doctor'
        : `node.maintenance/${latest.action}`;
    const summary = String(latest.resultSummary || '').trim();

    if (latest.status === 'completed' && latest.ok) {
      return `Latest activity: ${actionLabel} completed with success.${summary ? ` ${summary}` : ''}`;
    }

    if (latest.status === 'failed') {
      return `Latest activity: ${actionLabel} failed.${summary ? ` ${summary}` : ''}`;
    }

    if (latest.status === 'pending' || latest.status === 'claimed') {
      return `Latest activity: ${actionLabel} is still running on the node host.`;
    }

    return `Latest activity: ${actionLabel} with status ${latest.status}.`;
  }

  private selectEntry(
    entries: NodeMeshSnapshotEntry[],
    selectedNodeId?: string | null,
  ): NodeMeshSnapshotEntry | null {
    const normalizedId = String(selectedNodeId || '').trim().toLowerCase();
    if (normalizedId) {
      const direct = entries.find((entry) => entry.id === normalizedId);
      if (direct) {
        return direct;
      }
    }

    return entries.find((entry) => entry.pairingStatus === 'pending')
      || entries.find((entry) => entry.status === 'online')
      || entries[0]
      || null;
  }
}
