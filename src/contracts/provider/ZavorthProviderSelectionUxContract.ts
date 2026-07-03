import type {
  ZavorthProviderProbeStatus,
  ZavorthProviderReadinessStatus,
} from './ZavorthProviderReadinessMatrixContract.js';

export const ZAVORTH_PROVIDER_SELECTION_UX_CONTRACT_VERSION = '2026-05-13.checkpoint-11' as const;

export type ZavorthProviderSelectionIntent =
  | 'explicit'
  | 'fast'
  | 'smart'
  | 'local'
  | 'openai-compatible'
  | 'coding'
  | 'research'
  | 'budget';

export type ZavorthProviderSelectionDecision =
  | 'use_now'
  | 'test_first'
  | 'configure_first'
  | 'choose_fallback'
  | 'blocked';

export type ZavorthProviderSelectionCandidate = {
  providerId: string;
  label: string;
  model: string | null;
  status: ZavorthProviderReadinessStatus;
  liveStatus: ZavorthProviderProbeStatus;
  score: number;
  reasons: string[];
  canUseNow: boolean;
  canTestNow: boolean;
  requiresConfiguration: boolean;
  userAction: string;
  commands: {
    use: string;
    inspect: string;
    test: string;
    liveTest: string;
  };
};

export type ZavorthProviderSelectionUxSnapshot = {
  contractVersion: typeof ZAVORTH_PROVIDER_SELECTION_UX_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'provider-selection-ux';
  generatedAt: string;
  request: {
    target: string | null;
    intent: ZavorthProviderSelectionIntent;
    requireLiveEvidence: boolean;
    includeAdvanced: boolean;
  };
  active: {
    provider: string;
    model: string;
  };
  decision: ZavorthProviderSelectionDecision;
  selected: ZavorthProviderSelectionCandidate | null;
  fallbacks: ZavorthProviderSelectionCandidate[];
  blocked: ZavorthProviderSelectionCandidate[];
  explanation: string[];
  safety: {
    catalogIsNotLiveProof: true;
    selectionDoesNotWriteConfig: true;
    liveProbeRequiresExplicitCommand: true;
    rawSecretsSerialized: false;
    zavorthControlExecutionAuthority: false;
  };
  commands: Array<{
    id: string;
    label: string;
    command: string;
    liveNetworkUsed: boolean;
    mutatesConfig: boolean;
  }>;
  nextAction: string;
};
