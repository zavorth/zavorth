export const ZAVORTH_OPERATIONAL_REFINEMENT_CONTRACT_VERSION = 'zavorth-operational-refinement/1' as const;

export type ZavorthOperationalRefinementStatus = 'ready' | 'partial' | 'attention' | 'blocked';

export type ZavorthOperationalRefinementEvidence = {
  id: string;
  status: ZavorthOperationalRefinementStatus;
  summary: string;
};

export type ZavorthOperationalRefinementReceipt = {
  id: string;
  kind:
    | 'a2ui-canvas'
    | 'mnemos-unified-memory'
    | 'satellite-approval'
    | 'wake-detector-setup'
    | 'skill-quarantine';
  status: ZavorthOperationalRefinementStatus;
  summary: string;
  createdAt: string;
};

export type ZavorthOperationalA2UICanvas = {
  status: ZavorthOperationalRefinementStatus;
  surfaceId: string;
  routeReady: boolean;
  zavorthControlHandlersReady: boolean;
  actionBridgeReady: boolean;
  riskDryRunReady: boolean;
  security: {
    hostAccess: 'blocked';
    tokenAccess: 'blocked';
    filesystemAccess: 'blocked';
    actionDispatch: 'transaction-plane';
  };
  evidence: ZavorthOperationalRefinementEvidence[];
};

export type ZavorthOperationalMnemosUnifiedMemory = {
  status: ZavorthOperationalRefinementStatus;
  sources: Array<{
    id: 'wiki' | 'sessions' | 'receipts' | 'transactions' | 'chat';
    status: ZavorthOperationalRefinementStatus;
    documents: number;
    summary: string;
  }>;
  outputPath: string;
  documentsIndexed: number;
  applyPerformed: boolean;
  safety: {
    providerCall: false;
    networkCall: false;
    secretsRedacted: true;
    rawSecretsSerialized: false;
  };
};

export type ZavorthOperationalSatelliteDaily = {
  status: ZavorthOperationalRefinementStatus;
  route: '/satellite';
  approvalCards: number;
  offlineQueueSupported: boolean;
  pushPlanReady: boolean;
  pairingPreviewReady: boolean;
  executionAuthority: false;
  nextAction: string;
};

export type ZavorthOperationalWakeDetectorSetup = {
  status: ZavorthOperationalRefinementStatus;
  selected: 'disabled' | 'default-local' | 'custom-command';
  envUpdates: Array<{
    key: string;
    redactedValue: string;
    reason: string;
  }>;
  applyPerformed: boolean;
  privacy: {
    defaultOff: true;
    localFirst: true;
    ttlRequired: true;
    rawAudioPersisted: false;
    visibleIndicatorRequired: true;
  };
  commands: string[];
};

export type ZavorthOperationalSkillQuarantine = {
  status: ZavorthOperationalRefinementStatus;
  skillId: string;
  quarantinePath: string;
  promotedPath: string | null;
  draftWritten: boolean;
  sandboxPreviewReady: boolean;
  approvalRequired: boolean;
  promotionPerformed: boolean;
  receipts: ZavorthOperationalRefinementReceipt[];
  safety: {
    noSkillExecutionDuringDraft: true;
    sandboxBeforePromotion: true;
    approvalRequiredForPromotion: true;
    secretsRedacted: true;
  };
};

export type ZavorthOperationalRefinementSnapshot = {
  contractVersion: typeof ZAVORTH_OPERATIONAL_REFINEMENT_CONTRACT_VERSION;
  generatedAt: string;
  status: ZavorthOperationalRefinementStatus;
  summary: {
    ready: number;
    partial: number;
    attention: number;
    blocked: number;
  };
  a2uiCanvas: ZavorthOperationalA2UICanvas;
  mnemosUnifiedMemory: ZavorthOperationalMnemosUnifiedMemory;
  satelliteApprovals: ZavorthOperationalSatelliteDaily;
  wakeDetectorSetup: ZavorthOperationalWakeDetectorSetup;
  skillQuarantine: ZavorthOperationalSkillQuarantine;
  receipts: ZavorthOperationalRefinementReceipt[];
  commands: {
    inspect: string;
    applyMemory: string;
    wakeSetup: string;
    skillDraft: string;
    qa: string;
  };
  safety: {
    noSilentMutation: true;
    secretsRedacted: true;
    approvalsForRiskyPromotion: true;
    a2uiCannotAccessHost: true;
    satelliteCannotExecuteActions: true;
  };
};
