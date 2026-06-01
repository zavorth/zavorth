export const ZAVORTH_PRODUCT_HARDENING_CONTRACT_VERSION = 'zavorth-product-hardening/1' as const;

export type ZavorthProductHardeningStatus = 'ready' | 'attention' | 'blocked';

export type ZavorthProductHardeningAreaId =
  | 'quality-gates'
  | 'surface-consolidation'
  | 'install-ux'
  | 'dashboard-ux'
  | 'certification'
  | 'repo-hygiene';

export type ZavorthProductHardeningGate = {
  id: string;
  label: string;
  status: ZavorthProductHardeningStatus;
  summary: string;
  command?: string;
  evidence: string[];
  nextActions: string[];
};

export type ZavorthProductHardeningArea = {
  id: ZavorthProductHardeningAreaId;
  title: string;
  status: ZavorthProductHardeningStatus;
  summary: string;
  gates: ZavorthProductHardeningGate[];
};

export type ZavorthProductHardeningSnapshot = {
  contractVersion: typeof ZAVORTH_PRODUCT_HARDENING_CONTRACT_VERSION;
  generatedAt: string;
  status: ZavorthProductHardeningStatus;
  summary: {
    totalAreas: number;
    ready: number;
    attention: number;
    blocked: number;
  };
  areas: ZavorthProductHardeningArea[];
  surfacePolicy: {
    canonicalEntry: string;
    retiredSurfaces: string[];
    legacyRoutesRetired: boolean;
    duplicateSurfacesRemoved: boolean;
  };
  installPolicy: {
    homeIsExplicit: true;
    setupExplainsGovernance: true;
    wakeDetectorChoiceIsExplicit: true;
    migrationRequiresApproval: true;
  };
  safety: {
    dirtyWorktreeIsNotAReleaseBlocker: true;
    noSilentMutation: true;
    secretValuesSerialized: false;
    oldSurfacesRemoved: true;
    checksAreRepeatable: true;
  };
  commands: {
    inspect: 'npm run zavorth:product-hardening -- --json';
    doctor: 'zavorth doctor product-hardening';
    qa: 'npm run qa:zavorth-product-hardening --silent';
    dashboard: 'npm run zavorth-control-vite:check --silent';
    convergence: 'npm run zavorth:native-convergence:check --silent';
    refinement: 'npm run zavorth:operational-refinement:check --silent';
  };
};
