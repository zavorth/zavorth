export const ZAVORTH_CLI_EXPERIENCE_PARITY_CONTRACT_VERSION = '2026-05-15.experience-layer.phase-13' as const;

export type ZavorthCliExperienceParityCommandKind =
  | 'guided_mission'
  | 'runtime_question'
  | 'trust'
  | 'receipt'
  | 'satellite'
  | 'dashboard';

export type ZavorthCliExperienceParityCommand = {
  id: string;
  label: string;
  command: string;
  description: string;
  kind: ZavorthCliExperienceParityCommandKind;
  risk: 'read_only' | 'approval_gated';
  mirrorsDashboardHome: boolean;
  cliCanExecuteTargetAction: false;
};

export type ZavorthCliExperienceParitySnapshot = {
  contractVersion: typeof ZAVORTH_CLI_EXPERIENCE_PARITY_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'cli-experience-parity';
  generatedAt: string;
  entryCommands: string[];
  headline: string;
  promise: string;
  commands: ZavorthCliExperienceParityCommand[];
  recommendedFlow: string[];
  safety: {
    cliCanExecuteTargetAction: false;
    projectionOnly: true;
    policyBrokerRequiredForActions: true;
    rawSecretsSerialized: false;
  };
  invariants: string[];
};
