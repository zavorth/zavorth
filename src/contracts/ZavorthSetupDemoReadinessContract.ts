export const ZAVORTH_SETUP_DEMO_READINESS_CONTRACT_VERSION = '2026-05-16.phase-d.setup-demo' as const;

export type ZavorthSetupDemoReadinessStatus = 'ready' | 'blocked';

export type ZavorthSetupDemoStep = {
  id: string;
  label: string;
  command: string;
  estimatedMinutes: number;
  writesFiles: boolean;
  requiresNetwork: boolean;
  outcome: string;
};

export type ZavorthSetupDemoFixture = {
  id: 'product-home' | 'github-governed-review' | 'daily-assistant' | 'receipts';
  label: string;
  entrypoint: string;
  seed: string;
  externalIo: 'none' | 'mocked' | 'approval-gated';
  successSignal: string;
};

export type ZavorthSetupDemoSmokeCheck = {
  id: string;
  label: string;
  covers: Array<'phase-a' | 'phase-b' | 'phase-c' | 'phase-d'>;
  command: string;
  requiresSecrets: boolean;
  requiresNetwork: boolean;
  expectedSignal: string;
};

export type ZavorthSetupDemoReadinessSnapshot = {
  contractVersion: typeof ZAVORTH_SETUP_DEMO_READINESS_CONTRACT_VERSION;
  schemaVersion: 1;
  phase: 'D';
  surface: 'setup-demo-readiness';
  generatedAt: string;
  status: ZavorthSetupDemoReadinessStatus;
  installOnboard: {
    targetMinutes: 10;
    estimatedMinutes: number;
    promise: string;
    steps: ZavorthSetupDemoStep[];
  };
  demoSeed: {
    id: 'phase-d-local-demo-seed';
    description: string;
    fixtures: ZavorthSetupDemoFixture[];
  };
  smoke: {
    command: string;
    checks: ZavorthSetupDemoSmokeCheck[];
  };
  safety: {
    noRawSecretsSerialized: true;
    noLiveExternalIoInSeed: true;
    approvalsRequiredForWritesAndSends: true;
    receiptsRequiredForDemoActions: true;
    deterministicWithoutGitHubOrTelegramTokens: true;
  };
  invariants: string[];
  nextSafeAction: string;
};
