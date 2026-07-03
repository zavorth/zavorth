export const ZAVORTH_MNEMOS_LIFECYCLE_HOOK_VERSION = 'zavorth-mnemos-lifecycle-hooks-v1' as const;

export type ZavorthMnemosLifecycleHookType =
  | 'session.started'
  | 'session.ended'
  | 'user.prompt.submitted'
  | 'tool.previewed'
  | 'tool.used'
  | 'tool.completed'
  | 'approval.requested'
  | 'approval.granted'
  | 'approval.denied'
  | 'artifact.created'
  | 'receipt.emitted'
  | 'decision.confirmed'
  | 'memory.candidate.created';

export type ZavorthMnemosLifecycleHookSource = {
  surface: 'zavorthControl' | 'cli' | 'telegram' | 'api' | 'runtime-adapter' | 'runtime' | 'unknown';
  agent?: string | null;
  provider?: string | null;
  channel?: string | null;
};

export type ZavorthMnemosLifecycleHookTrust = {
  level: 'raw' | 'derived' | 'receipt-backed' | 'operator-approved';
  durableTruth: boolean;
  approvalId?: string | null;
  receiptId?: string | null;
};

export type ZavorthMnemosLifecycleHookInput = {
  workspaceRoot?: string;
  sessionId: string;
  type: ZavorthMnemosLifecycleHookType;
  payload?: Record<string, any>;
  createdAt?: string;
  source?: Partial<ZavorthMnemosLifecycleHookSource>;
  trust?: Partial<ZavorthMnemosLifecycleHookTrust>;
};

export type ZavorthMnemosLifecycleHookSnapshot = {
  version: typeof ZAVORTH_MNEMOS_LIFECYCLE_HOOK_VERSION;
  generatedAt: string;
  status: 'captured';
  eventId: string;
  eventType: ZavorthMnemosLifecycleHookType;
  sessionId: string;
  source: ZavorthMnemosLifecycleHookSource;
  trust: ZavorthMnemosLifecycleHookTrust;
  safety: {
    providerCall: false;
    networkCall: false;
    durableSemanticMutation: false;
    rawEventOnly: true;
    promotionRequiresApproval: true;
  };
  receipt: {
    id: string;
    providerCall: false;
    durableMutation: false;
  };
};
