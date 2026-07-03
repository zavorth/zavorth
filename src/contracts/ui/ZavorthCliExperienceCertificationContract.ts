export const ZAVORTH_CLI_EXPERIENCE_CONSISTENCY_CONTRACT_VERSION = '2026-05-15.experience-layer.checkpoint-13' as const;

export type ZavorthCliExperienceCertificationCommandKind =
  | 'home_area'
  | 'guided_mission'
  | 'runtime_question'
  | 'trust'
  | 'receipt'
  | 'satellite'
  | 'zavorthControl';

export type ZavorthCliExperienceCertificationCommand = {
  id: string;
  label: string;
  command: string;
  description: string;
  kind: ZavorthCliExperienceCertificationCommandKind;
  risk: 'read_only' | 'approval_gated';
  mirrorsZavorthControlHome: boolean;
  cliCanExecuteTargetAction: false;
};

export type ZavorthCliExperienceCertificationSnapshot = {
  contractVersion: typeof ZAVORTH_CLI_EXPERIENCE_CONSISTENCY_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'cli-experience-consistency';
  generatedAt: string;
  entryCommands: string[];
  headline: string;
  promise: string;
  commands: ZavorthCliExperienceCertificationCommand[];
  recommendedFlow: string[];
  safety: {
    cliCanExecuteTargetAction: false;
    projectionOnly: true;
    policyBrokerRequiredForActions: true;
    rawSecretsSerialized: false;
  };
  invariants: string[];
};
