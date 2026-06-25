import type { CapabilityHubItemKind } from './CapabilityHubContract.js';

export const CAPABILITY_PACK_READINESS_CONTRACT_VERSION = 'zavorth-capability-pack-readiness/v1';

export type CapabilityPackReadinessStatus =
  | 'ready_for_activation_request'
  | 'needs_configuration'
  | 'needs_probe'
  | 'blocked';

export type CapabilityPackReadinessCheckKind =
  | 'secret-ref'
  | 'env-key'
  | 'binary'
  | 'manual-step'
  | 'local-route'
  | 'readiness-check'
  | 'policy';

export type CapabilityPackReadinessCheck = {
  id: string;
  kind: CapabilityPackReadinessCheckKind;
  status: 'passed' | 'missing' | 'manual' | 'pending' | 'blocked';
  summary: string;
};

export type CapabilityPackItemReadiness = {
  itemId: string;
  label: string;
  kind: CapabilityHubItemKind;
  status: CapabilityPackReadinessStatus;
  checks: CapabilityPackReadinessCheck[];
  blockers: string[];
  nextAction: string;
};

export type CapabilityPackReadinessInput = {
  packId?: string | null;
  targetItemId?: string | null;
  availableSecretRefs?: string[];
  availableEnvKeys?: string[];
  availableBinaries?: string[];
  completedManualSteps?: string[];
  completedReadinessChecks?: string[];
  localRoutes?: Record<string, boolean>;
};

export type CapabilityPackReadinessSnapshot = {
  contractVersion: typeof CAPABILITY_PACK_READINESS_CONTRACT_VERSION;
  generatedAt: string;
  policy: {
    canonicalRoot: 'zavorth-core/Zavorth';
    readsSecretValues: false;
    secretsSerialized: false;
    checksPresenceOnly: true;
    liveActivationApplied: false;
  };
  query: {
    packId: string | null;
    targetItemId: string | null;
  };
  summary: {
    packs: number;
    items: number;
    ready: number;
    needsConfiguration: number;
    needsProbe: number;
    blocked: number;
  };
  items: CapabilityPackItemReadiness[];
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
