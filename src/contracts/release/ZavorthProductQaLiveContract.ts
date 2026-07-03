export const ZAVORTH_PRODUCT_QA_LIVE_CONTRACT_VERSION =
  '2026-05-24.product-qa-live-phase-9' as const;

export type ZavorthProductQaLiveAction =
  | 'qa.status'
  | 'qa.matrix'
  | 'qa.require-live'
  | 'qa.receipts';

export type ZavorthProductQaLiveStatus =
  | 'passed'
  | 'needs-live-credentials'
  | 'needs-operator-action'
  | 'blocked';

export type ZavorthProductQaLiveRowId =
  | 'fresh-install'
  | 'real-provider'
  | 'real-telegram'
  | 'mutation-approval'
  | 'receipt'
  | 'zavorthControl'
  | 'cli'
  | 'llm-brain-session'
  | 'learning-candidate'
  | 'long-tail-adapters'
  | 'rollback-sandbox';

export type ZavorthProductQaLiveRowStatus =
  | 'passed'
  | 'dry-run-certified'
  | 'needs-live-credentials'
  | 'needs-operator-action'
  | 'blocked';

export type ZavorthProductQaLiveMode =
  | 'local-proof'
  | 'live-required'
  | 'hybrid';

export type ZavorthProductQaLiveProof =
  | 'not-required'
  | 'optional'
  | 'required';

export type ZavorthProductQaLiveRow = {
  id: ZavorthProductQaLiveRowId;
  label: string;
  status: ZavorthProductQaLiveRowStatus;
  mode: ZavorthProductQaLiveMode;
  liveProof: ZavorthProductQaLiveProof;
  evidence: string[];
  commands: string[];
  requiredEnv: string[];
  receiptsRequired: true;
  secretValuesSerialized: false;
  nextSafeAction: string;
};

export type ZavorthProductQaLiveSummary = {
  total: number;
  passed: number;
  dryRunCertified: number;
  needsLiveCredentials: number;
  needsOperatorAction: number;
  blocked: number;
  liveRequired: number;
};

export type ZavorthProductQaLiveReadiness = {
  providerConfigured: boolean;
  telegramTokenConfigured: boolean;
  telegramAllowlistConfigured: boolean;
  zavorthControlCovered: boolean;
  cliCovered: boolean;
  sandboxCovered: boolean;
  receiptsCovered: boolean;
  learningCovered: boolean;
  llmBrainCovered: boolean;
  sessionStreamingCovered: boolean;
  longTailAdaptersCovered: boolean;
};

export type ZavorthProductQaLivePolicy = {
  dryRunDoesNotClaimLiveProvider: true;
  dryRunDoesNotClaimLiveTelegram: true;
  secretsNeverSerialized: true;
  mutationRequiresApproval: true;
  rollbackSandboxRequired: true;
  receiptsRequired: true;
};

export type ZavorthProductQaLiveInput = {
  action?: ZavorthProductQaLiveAction | 'status' | 'matrix' | 'require-live' | 'receipts' | null;
  workspace?: string | null;
  requireLive?: boolean;
  sourceSurface?: string | null;
  actorId?: string | null;
};

export type ZavorthProductQaLiveSnapshot = {
  contractVersion: typeof ZAVORTH_PRODUCT_QA_LIVE_CONTRACT_VERSION;
  generatedAt: string;
  source: 'ZavorthProductQaLiveService';
  action: ZavorthProductQaLiveAction;
  status: ZavorthProductQaLiveStatus;
  workspace: string;
  requireLive: boolean;
  matrix: ZavorthProductQaLiveRow[];
  summary: ZavorthProductQaLiveSummary;
  liveReadiness: ZavorthProductQaLiveReadiness;
  policy: ZavorthProductQaLivePolicy;
  commands: {
    status: 'npm run zavorth:product-qa-live';
    json: 'npm run zavorth:product-qa-live:json';
    requireLive: 'npm run zavorth:product-qa-live -- --require-live';
    check: 'npm run zavorth:product-qa-live:check --silent';
    productGate: 'npm run zavorth:product-readiness:check --silent';
  };
  nextSafeAction: string;
};
