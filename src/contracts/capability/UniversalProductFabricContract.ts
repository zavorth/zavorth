/**
 * Universal Product Fabric
 *
 * Daily-product plane: first-run readiness, public command surface,
 * hermetic certification of Capability / Reach / Power fabrics.
 * Brand-agnostic. Catalog ≠ live.
 */

export const UNIVERSAL_PRODUCT_FABRIC_CONTRACT_VERSION =
  'zavorth-universal-product-fabric/v1' as const;

export type ProductReadinessLevel =
  | 'ready'
  | 'attention'
  | 'blocked'
  | 'not-checked';

export type ProductFirstRunStepId =
  | 'install-cli'
  | 'setup-providers'
  | 'start-runtime'
  | 'open-control'
  | 'first-safe-ask'
  | 'optional-channel'
  | 'optional-absorb'
  | 'optional-trusted-operator';

export type ProductFirstRunStep = {
  id: ProductFirstRunStepId;
  label: string;
  status: 'done' | 'current' | 'pending' | 'optional';
  command: string | null;
  summary: string;
};

export type ProductPublicCommand = {
  command: string;
  group: 'daily' | 'capability' | 'reach' | 'power' | 'ops';
  summary: string;
  mutation: boolean;
};

export type ProductCertificationCheckId =
  | 'capability-absorb-preview'
  | 'workspace-import-preview'
  | 'reach-inventory-truth'
  | 'channel-synthesis-preview'
  | 'node-capability-taxonomy'
  | 'power-backend-elastic'
  | 'trusted-operator-red-lane'
  | 'learning-promote-consent'
  | 'harness-readonly-default'
  | 'context-discipline'
  | 'public-command-surface'
  | 'first-run-path';

export type ProductCertificationCheck = {
  id: ProductCertificationCheckId;
  title: string;
  fabric: 'capability' | 'reach' | 'power' | 'product';
  status: ProductReadinessLevel;
  summary: string;
  evidence: string[];
  hermetic: true;
  liveIoPerformed: false;
};

export type ProductFabricReceipt = {
  id: string;
  kind: 'inventory' | 'first-run' | 'certify' | 'doctor' | 'deny';
  status: 'pass' | 'attention' | 'blocked' | 'preview';
  summary: string;
  createdAt: string;
  rawSecretsSerialized: false;
};

export type ProductFabricPolicy = {
  catalogIsNotLive: true;
  hermeticCertificationDefault: true;
  brandAgnostic: true;
  publicCommandsPreferZavorthCli: true;
  monorepoScriptsAreInternal: true;
  rawSecretsSerialized: false;
};

export type ProductFabricSnapshot = {
  contractVersion: typeof UNIVERSAL_PRODUCT_FABRIC_CONTRACT_VERSION;
  generatedAt: string;
  status: ProductReadinessLevel;
  firstRun: {
    progress: number;
    steps: ProductFirstRunStep[];
    nextCommand: string | null;
  };
  publicCommands: ProductPublicCommand[];
  certification: {
    status: ProductReadinessLevel;
    checks: ProductCertificationCheck[];
    passed: number;
    attention: number;
    blocked: number;
  };
  fabrics: {
    capability: ProductReadinessLevel;
    reach: ProductReadinessLevel;
    power: ProductReadinessLevel;
    product: ProductReadinessLevel;
  };
  receipts: ProductFabricReceipt[];
  policy: ProductFabricPolicy;
  narrative: {
    headline: string;
    operatorSummary: string;
    nextSafeAction: string;
    productThesis: string;
  };
};
