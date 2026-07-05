import type {
  NodeMeshPairingDraft,
  NodeMeshRegistryEntry,
  NodeMeshSnapshot,
  NodeMeshSnapshotEntry,
} from '../contracts/NodeMeshContract.js';

export type NodeOnboardingStepId =
  | 'select_profile'
  | 'create_pairing_draft'
  | 'download_companion'
  | 'claim_pairing'
  | 'first_heartbeat'
  | 'approve_capabilities'
  | 'verify_ready';

export type NodeOnboardingStepStatus = 'completed' | 'current' | 'pending' | 'blocked';

export type NodeOnboardingStep = {
  id: NodeOnboardingStepId;
  label: string;
  status: NodeOnboardingStepStatus;
  summary: string;
  actionHint: string | null;
};

export type NodeOnboardingSnapshot = {
  generatedAt: string;
  nodeId: string | null;
  profileId: string | null;
  state: 'empty' | 'draft' | 'paired' | 'online' | 'ready' | 'blocked';
  progress: number;
  steps: NodeOnboardingStep[];
  bootstrap: {
    available: boolean;
    command: string | null;
    fallbackCommand: string | null;
    packageScript: string | null;
    pairingToken: string | null;
    bundleUrl: string | null;
    manifestUrl: string | null;
  };
  policy: {
    declaredCapabilities: number;
    approvedCapabilities: number;
    needsReview: boolean;
  };
  nextStep: NodeOnboardingStep | null;
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

type BuildOnboardingSnapshotInput = {
  nodeMeshSnapshot?: Partial<NodeMeshSnapshot> | null;
  selectedNodeId?: string | null;
  bootstrapDraft?: Partial<NodeMeshPairingDraft> | null;
  now?: Date;
};

export class NodeOnboardingService {
  public buildOnboardingSnapshot(input: BuildOnboardingSnapshotInput = {}): NodeOnboardingSnapshot {
    const now = input.now || new Date();
    const selected = this.resolveSelectedNode(input.nodeMeshSnapshot || null, input.selectedNodeId)
      || (input.bootstrapDraft?.entry as NodeMeshRegistryEntry | undefined)
      || null;
    const bootstrap = this.resolveBootstrap(input.bootstrapDraft || null);
    const pairingDraftReady = Boolean(selected && selected.pairingStatus === 'pending');
    const paired = Boolean(selected?.paired || selected?.pairingStatus === 'paired');
    const firstHeartbeat = Boolean(selected?.lastSeenAt || selected?.status === 'online');
    const ready = Boolean(
      (selected && 'canInvoke' in selected && selected.canInvoke) ||
      (selected?.status === 'online' && paired)
    );
    const blocked = Boolean(selected?.status === 'blocked' || selected?.pairingStatus === 'revoked');
    const declaredCapabilities = Array.isArray(selected?.capabilityIds) ? selected.capabilityIds.length : 0;
    const approvedCapabilities = Array.isArray(selected?.approvedCapabilityIds) ? selected.approvedCapabilityIds.length : 0;
    const needsPolicyReview = declaredCapabilities > 0 && approvedCapabilities === 0;
    const steps: NodeOnboardingStep[] = [
      {
        id: 'select_profile',
        label: 'Escolher perfil',
        status: selected ? 'completed' : 'current',
        summary: selected
          ? `Perfil ${selected.profileId || selected.kind || 'node'} selecionado.`
          : 'Escolha desktop, headless, browser ou mobile antes de gerar o pairing.',
        actionHint: selected ? null : 'Crie um pairing draft com o perfil mais proximo do device real.',
      },
      {
        id: 'create_pairing_draft',
        label: 'Gerar pairing',
        status: selected
          ? (pairingDraftReady || paired ? 'completed' : 'current')
          : 'pending',
        summary: pairingDraftReady
          ? 'Pairing draft ativo e pronto para bootstrap.'
          : paired
            ? 'Pairing ja foi consumido pelo companion.'
            : 'Gere um codigo de pairing para este node.',
        actionHint: pairingDraftReady || paired ? null : 'Use /api/web/nodes/pairing-draft ou o wizard do painel.',
      },
      {
        id: 'download_companion',
        label: 'Preparar companion',
        status: !selected
          ? 'pending'
          : bootstrap.available
            ? 'completed'
            : pairingDraftReady
              ? 'current'
              : paired
                ? 'completed'
                : 'pending',
        summary: bootstrap.available
          ? 'Bootstrap canonico disponivel para iniciar o companion.'
          : 'Baixe ou execute o companion oficial no device alvo.',
        actionHint: bootstrap.command || 'Use o bundle oficial do companion quando estiver disponivel.',
      },
      {
        id: 'claim_pairing',
        label: 'Consumir pairing',
        status: !selected
          ? 'pending'
          : paired
            ? 'completed'
            : pairingDraftReady
              ? 'current'
              : 'blocked',
        summary: paired
          ? 'Companion concluiu claim e recebeu shared secret.'
          : 'Execute o companion com o pairing token para concluir o claim.',
        actionHint: paired ? null : bootstrap.command,
      },
      {
        id: 'first_heartbeat',
        label: 'Primeiro heartbeat',
        status: !paired
          ? 'pending'
          : firstHeartbeat
            ? 'completed'
            : 'current',
        summary: firstHeartbeat
          ? 'Node publicou heartbeat e ja aparece no mesh.'
          : 'Aguardando heartbeat do companion pareado.',
        actionHint: firstHeartbeat ? null : 'Mantenha o companion rodando ate o status mudar para online.',
      },
      {
        id: 'approve_capabilities',
        label: 'Revisar capabilities',
        status: !selected
          ? 'pending'
          : needsPolicyReview
            ? 'current'
            : declaredCapabilities > 0
              ? 'completed'
              : 'pending',
        summary: needsPolicyReview
          ? 'Capabilities declaradas ainda precisam de allowlist explicita.'
          : `${approvedCapabilities || declaredCapabilities} capability(s) prontas para policy local.`,
        actionHint: needsPolicyReview ? 'Aprove apenas as capabilities necessarias para este device.' : null,
      },
      {
        id: 'verify_ready',
        label: 'Validar pronto',
        status: blocked
          ? 'blocked'
          : ready
            ? 'completed'
            : firstHeartbeat
              ? 'current'
              : 'pending',
        summary: ready
          ? 'Node pronto para receber invocacoes.'
          : blocked
            ? 'Node bloqueado ou pairing revogado.'
            : 'Rode device.info ou node.maintenance para validar a primeira invocacao.',
        actionHint: ready ? null : 'Teste device.info antes de usar capabilities mais sensiveis.',
      },
    ];
    const completed = steps.filter((step) => step.status === 'completed').length;
    const nextStep = steps.find((step) => step.status === 'current' || step.status === 'blocked') || null;
    const state = this.resolveState(selected, {
      blocked,
      paired,
      firstHeartbeat,
      ready,
      pairingDraftReady,
    });

    return {
      generatedAt: now.toISOString(),
      nodeId: selected?.id || null,
      profileId: selected?.profileId || null,
      state,
      progress: Math.round((completed / steps.length) * 100),
      steps,
      bootstrap,
      policy: {
        declaredCapabilities,
        approvedCapabilities,
        needsReview: needsPolicyReview,
      },
      nextStep,
      narrative: {
        headline: this.buildHeadline(state),
        operatorSummary: nextStep
          ? `${nextStep.label}: ${nextStep.summary}`
          : 'Onboarding do node esta completo.',
      },
    };
  }

  private resolveSelectedNode(
    snapshot: Partial<NodeMeshSnapshot> | null,
    selectedNodeId: string | null | undefined,
  ): (NodeMeshSnapshotEntry | NodeMeshRegistryEntry) | null {
    const normalizedId = String(selectedNodeId || '').trim();
    const entries = Array.isArray(snapshot?.entries) ? snapshot.entries : [];
    return (normalizedId
      ? entries.find((entry) => String(entry?.id || '').trim() === normalizedId)
      : null)
      || snapshot?.selected
      || entries[0]
      || null;
  }

  private resolveBootstrap(draft: Partial<NodeMeshPairingDraft> | null): NodeOnboardingSnapshot['bootstrap'] {
    const bootstrap = draft?.bootstrap || null;
    return {
      available: Boolean(bootstrap?.command || bootstrap?.fallbackCommand || bootstrap?.pairingToken),
      command: String(bootstrap?.command || '').trim() || null,
      fallbackCommand: String(bootstrap?.fallbackCommand || '').trim() || null,
      packageScript: String(bootstrap?.packageScript || '').trim() || null,
      pairingToken: String(bootstrap?.pairingToken || '').trim() || null,
      bundleUrl: '/api/web/nodes/companion/download',
      manifestUrl: '/api/web/nodes/companion/manifest',
    };
  }

  private resolveState(
    selected: (NodeMeshSnapshotEntry | NodeMeshRegistryEntry) | null,
    flags: {
      blocked: boolean;
      paired: boolean;
      firstHeartbeat: boolean;
      ready: boolean;
      pairingDraftReady: boolean;
    },
  ): NodeOnboardingSnapshot['state'] {
    if (!selected) {
      return 'empty';
    }
    if (flags.blocked) {
      return 'blocked';
    }
    if (flags.ready) {
      return 'ready';
    }
    if (flags.firstHeartbeat) {
      return 'online';
    }
    if (flags.paired) {
      return 'paired';
    }
    if (flags.pairingDraftReady) {
      return 'draft';
    }
    return 'empty';
  }

  private buildHeadline(state: NodeOnboardingSnapshot['state']): string {
    switch (state) {
      case 'ready':
        return 'Node pronto para operar.';
      case 'online':
        return 'Node online aguardando validacao final.';
      case 'paired':
        return 'Pairing concluido, aguardando heartbeat.';
      case 'draft':
        return 'Pairing draft pronto para bootstrap.';
      case 'blocked':
        return 'Node bloqueado ou pairing revogado.';
      default:
        return 'Onboarding de Node Mesh pronto para iniciar.';
    }
  }
}
