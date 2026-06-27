import type { RuntimeBudgetProfile } from '../../services/RuntimeResourceBudgetService.js';

export const RUNTIME_PROFILE_PLAYBOOK_VERSION = 'runtime-profile-playbook/v1' as const;

export type RuntimeDeploymentTarget =
  | 'vps-24-7'
  | 'safe-8gb-desktop'
  | 'developer-workstation'
  | 'full-lab';

export type RuntimeProfilePlaybookStep = {
  id: string;
  label: string;
  status: 'done' | 'next' | 'pending' | 'blocked';
  command: string | null;
  details: string[];
};

export type RuntimeProfilePlaybook = {
  id: RuntimeDeploymentTarget;
  label: string;
  recommendedProfile: RuntimeBudgetProfile;
  fallbackProfile: RuntimeBudgetProfile;
  summary: string;
  expectedPosture: 'lean' | 'balanced' | 'expanded';
  alwaysOnReady: boolean;
  maxActiveSidecars: number;
  disabledOnBoot: string[];
  onDemandCapabilities: string[];
  steps: RuntimeProfilePlaybookStep[];
  commands: {
    inspect: string;
    select: string;
    budgetCheck: string;
    temporaryElevate: string;
  };
};

export type RuntimeProfilePlaybookSnapshot = {
  generatedAt: string;
  version: typeof RUNTIME_PROFILE_PLAYBOOK_VERSION;
  status: 'ready' | 'attention' | 'blocked';
  selectedTarget: RuntimeDeploymentTarget;
  selected: RuntimeProfilePlaybook;
  playbooks: RuntimeProfilePlaybook[];
  summary: {
    targets: number;
    builtinProfiles: number;
    manifestProfiles: number;
    invalidProfiles: number;
    alwaysOnTargets: number;
  };
  safety: {
    profileSwitchIsExplicit: true;
    directMinimalToFullEscalationBlocked: true;
    heavySidecarsLazyByDefault: true;
    liveMutationUnaffectedByProfile: true;
  };
};
