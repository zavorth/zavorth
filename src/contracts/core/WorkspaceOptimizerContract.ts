import type { ZavorthMutationPlan } from '../ZavorthMutationPlaneContract.js';
import type { TrustDecision } from '../../services/TrustDecisionService.js';

export type IDECompanionPresetId =
  | 'zavorthBridge'
  | 'vscode'
  | 'vscode-derivative';

export type WorkspaceLoadPressure = 'low' | 'moderate' | 'high';

export type WorkspaceLoadProfile = {
  generatedAt: string;
  workspaceRoot: string;
  workspaceName: string;
  workspaceSlug: string;
  pressure: WorkspaceLoadPressure;
  recommendedPresetId: IDECompanionPresetId;
  noisyPaths: string[];
  watchCandidates: string[];
  searchCandidates: string[];
  currentSettingsPath: string;
  currentSettingsKeys: string[];
  instructionSources: string[];
  skillDirectories: string[];
  warnings: string[];
  recommendations: string[];
  summary: string;
};

export type IDECompanionPreset = {
  id: IDECompanionPresetId;
  label: string;
  description: string;
  settings: Record<string, unknown>;
  watchExcludes: string[];
  searchExcludes: string[];
  notes: string[];
};

export type WorkspaceOptimizationChange = {
  key: string;
  before: unknown;
  after: unknown;
};

export type WorkspaceOptimizationPreview = {
  generatedAt: string;
  workspaceRoot: string;
  workspaceName: string;
  settingsFilePath: string;
  preset: IDECompanionPreset;
  profile: WorkspaceLoadProfile;
  changedKeys: string[];
  changes: WorkspaceOptimizationChange[];
  summary: string;
  mutationPlan: ZavorthMutationPlan;
  trustDecision: TrustDecision | null;
  waitingApproval: boolean;
  blocked: boolean;
};

export type WorkspaceOptimizationApplyResult = {
  generatedAt: string;
  ok: boolean;
  applied: boolean;
  waitingApproval: boolean;
  blocked: boolean;
  summary: string;
  workspaceRoot: string;
  workspaceName: string;
  settingsFilePath: string;
  preset: IDECompanionPreset;
  profile: WorkspaceLoadProfile;
  changedKeys: string[];
  mutationPlan: ZavorthMutationPlan;
  trustDecision: TrustDecision | null;
};

export type WorkspaceLoadProfileStateRecord = {
  workspaceRoot: string;
  workspaceName: string;
  workspaceSlug: string;
  lastProfile: WorkspaceLoadProfile | null;
  lastPreviewPlanId: string | null;
  lastAppliedPresetId: IDECompanionPresetId | null;
  lastUpdatedAt: string;
};

export type WorkspaceLoadProfilesState = {
  updatedAt: string;
  workspaces: WorkspaceLoadProfileStateRecord[];
};
