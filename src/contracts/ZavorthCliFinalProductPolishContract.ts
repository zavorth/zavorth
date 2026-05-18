export const ZAVORTH_CLI_FINAL_PRODUCT_POLISH_CONTRACT_VERSION =
  '2026-05-14.phase-12-cli-final-product-polish' as const;

export type ZavorthCliFinalProductPolishStatus = 'passed' | 'attention' | 'blocked';

export type ZavorthCliFinalProductPolishEntryKind =
  | 'command'
  | 'ink'
  | 'surface'
  | 'language'
  | 'safety'
  | 'workspace';

export type ZavorthCliFinalProductPolishEntry = {
  id: string;
  label: string;
  kind: ZavorthCliFinalProductPolishEntryKind;
  status: ZavorthCliFinalProductPolishStatus;
  userVisible: boolean;
  evidence: string[];
  blockers: string[];
};

export type ZavorthCliFinalProductPolishSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_CLI_FINAL_PRODUCT_POLISH_CONTRACT_VERSION;
  source: 'ZavorthCliFinalProductPolishService';
  status: ZavorthCliFinalProductPolishStatus;
  files: {
    bin: string;
    registry: string;
    helpers: string;
    inkIndex: string;
    inkPackage: string;
  };
  entries: ZavorthCliFinalProductPolishEntry[];
  summary: {
    entries: number;
    passed: number;
    attention: number;
    blocked: number;
    requiredCommands: string[];
    dashboardPath: '/dashboard';
    inkPreviewRendersOnce: boolean;
    inkInteractiveMode: boolean;
    zavorthNativeCommandIdentity: boolean;
    noInfiniteRenderLoop: boolean;
    englishDefaultCriticalPath: boolean;
    noControlSurfaceByDefault: boolean;
    cliCanExecuteMutations: false;
    rawSecretsSerialized: false;
  };
  safety: {
    cliProjectionsAreReadOnly: true;
    mutableExecutionStaysInRuntime: true;
    approvalsRemainPolicyBrokerBound: true;
    rawSecretsSerialized: false;
  };
  commands: {
    inspect: 'npm run zavorth:cli-final-product-polish';
    inspectJson: 'npm run zavorth:cli-final-product-polish:json';
    check: 'npm run zavorth:cli-final-product-polish:check --silent';
    nextPhase: 'Phase 13 - Live Certification Matrix';
  };
};
