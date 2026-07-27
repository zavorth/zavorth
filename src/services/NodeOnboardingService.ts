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
    const selected =
      this.resolveSelectedNode(input.nodeMeshSnapshot || null, input.selectedNodeId) ||
      (input.bootstrapDraft?.entry as NodeMeshRegistryEntry | undefined) ||
      null;
    const bootstrap = this.resolveBootstrap(input.bootstrapDraft || null);
    const pairingDraftReady = Boolean(selected && selected.pairingStatus === 'pending');
    const paired = Boolean(selected?.paired || selected?.pairingStatus === 'paired');
    const firstHeartbeat = Boolean(selected?.lastSeenAt || selected?.status === 'online');
    const ready = Boolean(
      (selected && 'canInvoke' in selected && selected.canInvoke) || (selected?.status === 'online' && paired),
    );
    const blocked = Boolean(selected?.status === 'blocked' || selected?.pairingStatus === 'revoked');
    const declaredCapabilities = Array.isArray(selected?.capabilityIds) ? selected.capabilityIds.length : 0;
    const approvedCapabilities = Array.isArray(selected?.approvedCapabilityIds)
      ? selected.approvedCapabilityIds.length
      : 0;
    const needsPolicyReview = declaredCapabilities > 0 && approvedCapabilities === 0;
    const steps: NodeOnboardingStep[] = [
      {
        id: 'select_profile',
        label: 'Choose profile',
        status: selected ? 'completed' : 'current',
        summary: selected ? `Profile ${selected.profileId || selected.kind || 'node'} selected.`
          : 'Choose desktop, headless, browser, or mobile before generating pairing.',
        actionHint: selected ? null : 'Create a pairing draft with the profile closest to the real device.',
      },
      {
        id: 'create_pairing_draft',
        label: 'Create pairing',
        status: selected ? (pairingDraftReady || paired ? 'completed' : 'current') : 'pending',
        summary: pairingDraftReady ? 'Pairing draft active and ready for bootstrap.'
          : paired ? 'Pairing was already consumed by the companion.'
            : 'Generate a pairing code for this node.',
        actionHint: pairingDraftReady || paired ? null : 'Use /api/web/nodes/pairing-draft or the panel wizard.',
      },
      {
        id: 'download_companion',
        label: 'Prepare companion',
        status: !selected ? 'pending'
          : bootstrap.available ? 'completed'
            : pairingDraftReady ? 'current'
              : paired ? 'completed'
                : 'pending',
        summary: bootstrap.available ? 'Canonical bootstrap available to start the companion.'
          : 'Download or run the official companion on the target device.',
        actionHint: bootstrap.command || 'Use the official companion bundle when available.',
      },
      {
        id: 'claim_pairing',
        label: 'Claim pairing',
        status: !selected ? 'pending' : paired ? 'completed' : pairingDraftReady ? 'current' : 'blocked',
        summary: paired ? 'Companion completed claim and received the shared secret.'
          : 'Run the companion with the pairing token to complete the claim.',
        actionHint: paired ? null : bootstrap.command,
      },
      {
        id: 'first_heartbeat',
        label: 'First heartbeat',
        status: !paired ? 'pending' : firstHeartbeat ? 'completed' : 'current',
        summary: firstHeartbeat ? 'Node published heartbeat and already appears in the mesh.'
          : 'Waiting for heartbeat from the paired companion.',
        actionHint: firstHeartbeat ? null : 'Keep the companion running until status changes to online.',
      },
      {
        id: 'approve_capabilities',
        label: 'Review capabilities',
        status: !selected ? 'pending'
          : needsPolicyReview ? 'current'
            : declaredCapabilities > 0
              ? 'completed'
              : 'pending',
        summary: needsPolicyReview ? 'Declared capabilities still need an explicit allowlist.'
          : `${approvedCapabilities || declaredCapabilities} capability(s) ready for local policy.`,
        actionHint: needsPolicyReview ? 'Approve only the capabilities needed for this device.' : null,
      },
      {
        id: 'verify_ready',
        label: 'Validate ready',
        status: blocked ? 'blocked' : ready ? 'completed' : firstHeartbeat ? 'current' : 'pending',
        summary: ready ? 'Node ready to receive invocations.'
          : blocked ? 'Node blocked or pairing revoked.'
            : 'Run device.info or node.maintenance to validate the first invocation.',
        actionHint: ready ? null : 'Test device.info before using more sensitive capabilities.',
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
        operatorSummary: nextStep ? `${nextStep.label}: ${nextStep.summary}` : 'Node onboarding is complete.',
      },
    };
  }

  private resolveSelectedNode(
    snapshot: Partial<NodeMeshSnapshot> | null,
    selectedNodeId: string | null | undefined,
  ): (NodeMeshSnapshotEntry | NodeMeshRegistryEntry) | null {
    const normalizedId = String(selectedNodeId || '').trim();
    const entries = Array.isArray(snapshot?.entries) ? snapshot.entries : [];
    return (
      (normalizedId ? entries.find((entry) => String(entry?.id || '').trim() === normalizedId) : null) ||
      snapshot?.selected ||
      entries[0] ||
      null
    );
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
        return 'Node ready to operate.';
      case 'online':
        return 'Node online, waiting for final validation.';
      case 'paired':
        return 'Pairing completed, waiting for heartbeat.';
      case 'draft':
        return 'Pairing draft ready for bootstrap.';
      case 'blocked':
        return 'Node blocked or pairing revoked.';
      default:
        return 'Node Mesh onboarding ready to start.';
    }
  }
}
