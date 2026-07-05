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
        headline: entries.length
          ? `Node Mesh expoe ${entries.length} node(s) registrados no control plane.`
          : 'Node Mesh does not have nodes registered in the control plane yet.',
        operatorSummary: entries.length
          ? `${summary.paired} pareado(s), ${summary.pending} pendente(s), ${summary.online} online, ${summary.queued} invocacao(oes) na fila, ${summary.expiredDrafts || 0} pairing(s) expirado(s), ${summary.staleQueued || 0} item(ns) antigo(s), ${maintenanceCapable} host(s) com node.maintenance e perfis ${desktopCount} desktop / ${mobileCount} mobile / ${browserCount} browser.${this.buildRecoveryNarrative(summary.expiredDrafts || 0, summary.staleQueued || 0, hasMaintenanceRecoverCandidate)}`
          : 'Crie o primeiro pairing para ligar um node headless, desktop ou bridge remoto ao Zavorth.',
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
        headline: selected.capabilities.length
          ? `${selected.label || selected.id} anuncia ${selected.capabilities.length} capability(ies) no mesh.`
          : `${selected.label || selected.id} has not declared capabilities for the mesh yet.`,
        operatorSummary: selected.capabilities.length
          ? `${risky} capability(ies) marcada(s) como sensivel(is) e categorias ${categories.join(', ') || 'misc'}.${maintenanceNarrative ? ` ${maintenanceNarrative}` : ''}`
          : 'Atualize o catalogo do node host antes de invocar a malha remota.',
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
            ? `Node ${selected.label || selected.id} tem fila remota ativa.`
            : 'Node selecionado sem fila remota pendente agora.',
        operatorSummary: queueSummary.stalePending || queueSummary.staleClaimed
          ? (selected.capabilityIds.includes('node.maintenance')
              ? `${queueSummary.stalePending} pendente(s) e ${queueSummary.staleClaimed} claimed antiga(s) precisam de revisao operacional. Use doctor/recover com queue-node-host-maintenance antes de liberar novas invocacoes.`
              : `${queueSummary.stalePending} pendente(s) e ${queueSummary.staleClaimed} claimed antiga(s) precisam de revisao operacional. Use doctor/recover com release-stale-claims para higienizar a fila.`)
            : (latest
                ? (maintenanceActivity || `Ultima activity: ${latest.capabilityId} em status ${latest.status}.`)
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
        ? ((entry.approvedCapabilityIds?.length || 0) > 0 && (entry.approvedCapabilityIds?.length || 0) < entry.capabilityIds.length
          ? 'pareado restrito'
          : 'pareado')
        : (entry.pairingStatus === 'pending' ? 'aguardando pairing' : 'revogado'),
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
      return `Gerar um novo pairing draft para ${contextualProfileLabel}; o codigo anterior expirou e foi invalidado.`;
    }
    if ((entry.approvedCapabilityIds?.length || 0) > 0 && (entry.approvedCapabilityIds?.length || 0) < entry.capabilityIds.length) {
      return `${contextualProfileLabel} operates with a restricted allowlist (${entry.approvedCapabilityIds?.length || 0}/${entry.capabilityIds.length} approved capability(s)).`;
    }
    if (queueSummary.stalePending > 0 || queueSummary.staleClaimed > 0) {
      if (supportsMaintenance) {
        return `Acionar maintenance de ${contextualProfileLabel}: ${queueSummary.stalePending} item(ns) expirado(s) e ${queueSummary.staleClaimed} claim(s) antiga(s) podem ser reparados pelo proprio host.`;
      }
      return `Higienizar a fila de ${contextualProfileLabel}: ${queueSummary.stalePending} item(ns) expirado(s) e ${queueSummary.staleClaimed} claim(s) antigo(s) precisam de revisao.`;
    }
    if (entry.pairingStatus === 'pending') {
      return `Consumir o pairing code do perfil ${contextualProfileLabel} e publicar o primeiro heartbeat.`;
    }
    if (entry.pairingStatus === 'revoked') {
      return `Reautorizar o ${contextualProfileLabel} antes de qualquer transporte remoto.`;
    }
    if (entry.status === 'online' && canInvoke) {
      return `${contextualProfileLabel} pronto. O heartbeat remoto ja pode consumir a fila de invocacoes.`;
    }
    if (entry.status === 'offline' || entry.status === 'idle') {
      return `Religar o ${contextualProfileLabel} para atualizar o heartbeat e revalidar o transporte.`;
    }
    return `Revisar o catalogo de capabilities e o transporte configurado para este ${contextualProfileLabel}.`;
  }

  private buildSuggestedActions(entries: NodeMeshSnapshotEntry[]): NodeMeshSuggestedAction[] {
    if (!entries.length) {
      return this.deviceProfileService.listRecommendedProfiles().map((profile) => ({
        label: `Parear ${profile.label}`,
        reason: profile.operatorSummary,
        actionHint: `Gere um pairing draft para ${profile.label.toLowerCase()} e siga o bootstrap sugerido.`,
      }));
    }

    const stalePairing = entries.find((entry) => entry.lifecycle?.pairingDraftStale);
    if (stalePairing) {
      const profile = this.deviceProfileService.describeProfile(stalePairing.profileId);
      return [
        {
          label: `Regenerar pairing de ${profile?.label || stalePairing.label}`,
          reason: `O draft de pairing expirou para ${profile?.label || stalePairing.label}.`,
          actionHint: 'Use o recover do Node Mesh com regenerate-pairing-draft para substituir o codigo expirado e refazer o bootstrap do node.',
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
          label: supportsMaintenance
            ? `Acionar maintenance de ${staleQueue.label}`
            : `Revisar fila antiga de ${staleQueue.label}`,
          reason: `${staleQueue.stalePendingInvocations || 0} pendente(s) e ${staleQueue.staleClaimedInvocations || 0} claimed antiga(s) ficaram presas na malha.`,
          actionHint: supportsMaintenance
            ? 'Use o recover do Node Mesh com queue-node-host-maintenance para enfileirar node.maintenance/repair e acompanhe o proximo heartbeat do host.'
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
          actionHint: 'Compartilhe o pairing code com o node host e aguarde o primeiro heartbeat.',
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
          actionHint: 'Religue o node host ou reconecte o bridge remoto antes de invocar.',
        },
      ];
    }

    return [
      {
        label: 'Conectar transporte remoto',
        reason: 'O registry ja conhece o node. Falta manter um node host rodando para claim, heartbeat e invoke.',
        actionHint: 'Use o script nodes:host com pairing code ou shared secret para ligar o transporte remoto.',
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
      return hasMaintenanceRecoverCandidate
        ? ' Use doctor/recover com regenerate-pairing-draft e queue-node-host-maintenance para regenerar drafts expirados e estabilizar a fila.'
        : ' Use doctor/recover com regenerate-pairing-draft e release-stale-claims para regenerar drafts expirados e liberar claims antigas na fila.';
    }

    if (expiredDrafts > 0) {
      return ' Use doctor/recover com regenerate-pairing-draft para regenerar os pairing drafts expirados.';
    }

    return hasMaintenanceRecoverCandidate
      ? ' Use doctor/recover com queue-node-host-maintenance para acionar maintenance local e estabilizar a fila do mesh.'
      : ' Use doctor/recover com release-stale-claims para liberar claims antigas e higienizar a fila do mesh.';
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
      return 'Maintenance local disponivel via node.maintenance (doctor/repair).';
    }

    if (selected.maintenance.latestStatus === 'completed') {
      return 'Maintenance local disponivel via node.maintenance; ultimo ciclo de repair concluiu com sucesso.';
    }

    if (selected.maintenance.latestStatus === 'failed') {
      return 'Maintenance local disponivel via node.maintenance; o ultimo ciclo de repair falhou e pode ser reenfileirado.';
    }

    if (selected.maintenance.latestStatus === 'pending' || selected.maintenance.latestStatus === 'claimed') {
      return 'Maintenance local disponivel via node.maintenance; existe um ciclo de doctor/repair em andamento na fila.';
    }

    return 'Maintenance local disponivel via node.maintenance (doctor/repair).';
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
      return `Ultima activity: ${actionLabel} concluiu com sucesso.${summary ? ` ${summary}` : ''}`;
    }

    if (latest.status === 'failed') {
      return `Ultima activity: ${actionLabel} falhou.${summary ? ` ${summary}` : ''}`;
    }

    if (latest.status === 'pending' || latest.status === 'claimed') {
      return `Ultima activity: ${actionLabel} segue em andamento no node host.`;
    }

    return `Ultima activity: ${actionLabel} em status ${latest.status}.`;
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
