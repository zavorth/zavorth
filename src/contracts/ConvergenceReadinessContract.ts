export const ZAVORTH_NATIVE_CONVERGENCE_CONTRACT_VERSION = '2026-06-01.zavorth-native-convergence' as const;

export type ConvergencePillarId =
  | 'action-harness'
  | 'provider-mesh'
  | 'channel-mesh'
  | 'mnemos-learning'
  | 'curator-plane'
  | 'runtime-tui'
  | 'swarm-scale'
  | 'sandbox-control'
  | 'satellite-voice'
  | 'qa-product';

export type ConvergenceReadinessStatus = 'ready' | 'partial' | 'missing_config' | 'blocked';

export type ConvergenceReadinessPillar = {
  id: ConvergencePillarId;
  title: string;
  status: ConvergenceReadinessStatus;
  summary: string;
  evidence: string[];
  nextActions: string[];
  publicInterfaces: string[];
};

export type ConvergenceReadinessSnapshot = {
  contractVersion: typeof ZAVORTH_NATIVE_CONVERGENCE_CONTRACT_VERSION;
  generatedAt: string;
  status: ConvergenceReadinessStatus;
  summary: {
    total: number;
    ready: number;
    partial: number;
    missingConfig: number;
    blocked: number;
  };
  pillars: ConvergenceReadinessPillar[];
  safety: {
    zavorthNativeContractsOnly: true;
    noSilentMutation: true;
    actionHarnessRequiredForMutation: true;
    secretValuesSerialized: false;
    doctorsAndCanariesRedactSecrets: true;
    externalProjectNamesInPublicSurface: false;
  };
  commands: {
    doctor: 'zavorth doctor convergence';
    json: 'zavorth doctor convergence --json';
    qa: 'npm run qa:zavorth-native-convergence --silent';
    hygiene: 'node scripts/zavorth-native-convergence-hygiene-check.mjs';
  };
};
