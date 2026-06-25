import type {
  IntelligenceCapabilityManifest,
  IntelligenceFabricSnapshot,
  IntelligenceProposedAction,
  IntelligenceRiskLevel,
} from './IntelligenceFabricContract.js';
import type { ProjectConstitutionImportedSourceSummary } from './ProjectConstitutionImportContract.js';

export const PRACTICAL_AGENCY_CONTRACT_VERSION = 'zavorth-practical-agency/v1' as const;

export type PracticalAgencyPhaseStatus = 'passed' | 'warning' | 'blocked';

export type ConversationalAgencyMessage = {
  headline: string;
  body: string;
  nextAction: string;
  detailsHiddenByDefault: true;
  dashboardDetailsAvailable: true;
  zavorthControlDetailsAvailable: true;
  internalTermsSuppressed: string[];
};

export type FabricToolIntentSnapshot = {
  source: 'FabricToolIntentService';
  safeThinkingAllowed: true;
  safeToolIntents: IntelligenceProposedAction[];
  draftToolIntents: IntelligenceProposedAction[];
  gatedToolIntents: IntelligenceProposedAction[];
  blockedToolIntents: IntelligenceProposedAction[];
  highestRisk: IntelligenceRiskLevel;
  nextStep: 'answer' | 'read_or_inspect' | 'draft_or_simulate' | 'ask_approval_or_sandbox' | 'block';
  liveActionApplied: false;
};

export type CapabilityBuilderScaffold = {
  manifestPath: string;
  testPath: string;
  readmePath: string;
  filesWritten: false;
};

export type CapabilityBuilderProposal = {
  source: 'ZavorthCapabilityBuilderService';
  status: 'not_needed' | 'use_existing' | 'draft_ready';
  requestedCapability: string | null;
  matchedCapabilityId: string | null;
  manifest: IntelligenceCapabilityManifest | null;
  scaffold: CapabilityBuilderScaffold | null;
  activation: {
    defaultEnabled: false;
    liveAllowed: false;
    requiresOwnerApproval: true;
  };
  receipts: string[];
};

export type CapabilityLabCheck = {
  id: string;
  status: PracticalAgencyPhaseStatus;
  message: string;
};

export type CapabilityLabSnapshot = {
  source: 'CapabilityLabService';
  status: PracticalAgencyPhaseStatus;
  simulated: boolean;
  activationAllowed: false;
  checks: CapabilityLabCheck[];
};

export type OperationalPreferenceSnapshot = {
  source: 'OperationalPreferenceLearner';
  rawSecretsSerialized: false;
  preferences: {
    aiFirst: boolean;
    hideInternalJargon: boolean;
    portugueseReplies: boolean;
    localWorkspaceAutonomy: boolean;
    proposalBeforeImpact: boolean;
  };
  receipts: string[];
};

export type SkillMiningSuggestion = {
  id: string;
  kind: 'skill' | 'workflow' | 'recipe';
  title: string;
  summary: string;
  activationDefault: 'disabled';
};

export type SkillMiningSnapshot = {
  source: 'SkillMiningService';
  suggestions: SkillMiningSuggestion[];
  activatesAutomatically: false;
  receipts: string[];
};

export type SecurityRedTeamFinding = {
  id: string;
  severity: 'info' | 'warning' | 'blocker';
  message: string;
};

export type SecurityRedTeamSnapshot = {
  source: 'ZavorthSecurityRedTeamService';
  status: PracticalAgencyPhaseStatus;
  findings: SecurityRedTeamFinding[];
  blocksUnsafeImpact: boolean;
};

export type CompiledPolicyRule = {
  id: string;
  decision: 'allow' | 'require_approval' | 'require_sandbox' | 'deny';
  action: string;
  target: string;
};

export type PolicyCompilerSnapshot = {
  source: 'ZavorthPolicyCompilerService';
  status: PracticalAgencyPhaseStatus;
  rules: CompiledPolicyRule[];
  hardBlocksPreserved: true;
  error: string | null;
};

export type ProjectConstitutionSnapshot = {
  source: 'ProjectConstitutionLoader';
  found: boolean;
  path: string | null;
  contextHints: string[];
  importedSources: ProjectConstitutionImportedSourceSummary[];
  policyBypassAllowed: false;
};

export type PracticalAgencySnapshot = {
  contractVersion: typeof PRACTICAL_AGENCY_CONTRACT_VERSION;
  generatedAt: string;
  fabric: {
    taskKind: IntelligenceFabricSnapshot['classification']['taskKind'];
    riskLevel: IntelligenceRiskLevel;
    recommendedMode: IntelligenceFabricSnapshot['classification']['recommendedMode'];
  };
  conversation: ConversationalAgencyMessage;
  toolIntent: FabricToolIntentSnapshot;
  capabilityBuilder: CapabilityBuilderProposal;
  capabilityLab: CapabilityLabSnapshot;
  operationalPreferences: OperationalPreferenceSnapshot;
  skillMining: SkillMiningSnapshot;
  redTeam: SecurityRedTeamSnapshot;
  policyCompiler: PolicyCompilerSnapshot;
  projectConstitution: ProjectConstitutionSnapshot;
  safety: {
    thinkingBlocked: false;
    liveActivationApplied: false;
    dangerousImpactRequiresGate: true;
    rawSecretsSerialized: false;
  };
  readiness: {
    status: PracticalAgencyPhaseStatus;
    phasesPassed: number;
    phasesWarning: number;
    phasesBlocked: number;
  };
};
