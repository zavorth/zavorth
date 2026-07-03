export const ZAVORTH_PRODUCT_DEMO_CONTRACT_VERSION = '2026-05-16.phase-f.connector-demo' as const;

export type ZavorthProductDemoStatus = 'ready' | 'needs_setup';

export type ZavorthProductDemoQuickstartStep = {
  id: string;
  minute: string;
  command: string;
  label: string;
  outcome: string;
  sideEffect: 'none' | 'dependencies' | 'local-profile' | 'local-runtime';
};

export type ZavorthProductDemoConnectorStatus = 'ready' | 'needs_setup' | 'needs_check';

export type ZavorthProductDemoConnectorCheck = {
  id: 'github' | 'github-pr-comment' | 'telegram' | 'discord';
  label: string;
  status: ZavorthProductDemoConnectorStatus;
  missing: string[];
  command: string;
  setupCommand: string;
  doctorCommand: string;
  docsPath: string;
  safeByDefault: boolean;
};

export type ZavorthProductDemoDoctorCheck = {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  missing: string[];
  nextCommand: string;
};

export type ZavorthProductDemoSnapshot = {
  contractVersion: typeof ZAVORTH_PRODUCT_DEMO_CONTRACT_VERSION;
  schemaVersion: 1;
  phase: 'F';
  surface: 'product-demo';
  generatedAt: string;
  status: ZavorthProductDemoStatus;
  command: {
    primary: 'zavorth start';
    demo: 'zavorth demo';
    json: 'zavorth demo --json';
    doctor: 'zavorth demo doctor';
    connectors: 'zavorth connectors doctor';
    openHome: 'zavorth go';
  };
  quickstart: {
    targetMinutes: 10;
    estimatedMinutes: number;
    steps: ZavorthProductDemoQuickstartStep[];
  };
  visualHome: {
    route: '/zavorthControl';
    title: 'Zavorth Home';
    areas: Array<'Inbox' | 'Tasks' | 'Approvals' | 'Receipts' | 'Connectors'>;
    openCommand: 'zavorth go';
    dryRunCommand: 'zavorth go --dry-run';
    browserDemoCommand: 'zavorth demo browser';
    browserDemoPath: string;
    localVisualDemo: true;
  };
  connectors: {
    checklist: ZavorthProductDemoConnectorCheck[];
    summary: string;
  };
  doctor: {
    status: ZavorthProductDemoStatus;
    checks: ZavorthProductDemoDoctorCheck[];
    exactMissing: string[];
  };
  smoke: {
    command: 'npm run zavorth:demo:check';
    deterministic: true;
    requiresSecrets: false;
    covers: Array<'quickstart' | 'visual-home' | 'github' | 'telegram' | 'discord' | 'doctor'>;
  };
  safety: {
    noRawSecretsSerialized: true;
    noExternalMutationBeforeApproval: true;
    demoDoesNotPretendLiveConnectors: true;
    internalRuntimeNamesHiddenFromPrimaryPath: true;
  };
  nextSafeAction: string;
};
