import type { ProviderMeshParitySnapshot } from './ProviderMeshParityContract.js';
import type { ParityCertificationSnapshot } from './ParityCertificationContract.js';

export const ZAVORTH_PROVIDER_P0_CLOSURE_CONTRACT_VERSION = '2026-05-04.phase-10';

export type ProviderP0ClosureStatus = 'closed' | 'blocked';

export type ProviderP0ClosureEntry = {
  providerId: string;
  previousBlocker: 'unsupported_anthropic';
  closureStrategy: 'anthropic-compatible-runtime';
  status: 'template-ready' | 'generic-compatible' | 'first-class';
  runtimeSupported: boolean;
  adapterStrategy: string;
  p0Closed: boolean;
  remainingTier: 'p1-template' | 'none';
  command: string;
  receipt: string;
};

export type ProviderP0ClosureSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_PROVIDER_P0_CLOSURE_CONTRACT_VERSION;
  status: ProviderP0ClosureStatus;
  summary: {
    closedProviders: number;
    remainingProviderP0: number;
    providerUnsupported: number;
    providerTemplateReady: number;
    certificationP0Gaps: number;
    certificationStatus: ParityCertificationSnapshot['status'];
    releaseReady: boolean;
    liveExternalCallRequired: false;
    secretValuesSerialized: false;
  };
  entries: ProviderP0ClosureEntry[];
  providerSnapshot: Pick<ProviderMeshParitySnapshot, 'contractVersion' | 'summary'>;
  certification: Pick<ParityCertificationSnapshot, 'contractVersion' | 'profile' | 'status' | 'summary'>;
  commands: {
    check: string;
    providerParity: string;
    certify: string;
    nextPhase: 'Fase 11 - P1 Provider Adapter Runtime';
  };
  policy: {
    closureIsClassificationOnly: true;
    noProviderCalls: true;
    noSecretsSerialized: true;
    remainingTemplatesStayVisible: true;
  };
};
