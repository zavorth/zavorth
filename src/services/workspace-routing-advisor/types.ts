import type { ParsedCommand } from '../../channels/commands/ChannelCommandParser.js';
import type { RouteIntent } from '../../orchestrator/IntentRouter.js';
import type { WorkspaceProfile } from '../WorkspaceProfileService.js';
import type { WorkspaceOperationalMemory } from '../WorkspaceOperationalMemoryService.js';
import type {
  WorkspaceResponseStyle,
  WorkspaceTaskKind,
  WorkspaceTaskSubtype,
} from '../WorkspaceTaskKind.js';
import type { WorkflowKind } from '../../runtime/workflows/WorkflowRunService.js';

import type {
  ApprovedPolicyAggregate,
  RouteOutcomeAggregate,
  WorkflowFrictionRecommendationAggregate as WorkflowFrictionRecommendation,
  ApprovalFrictionAggregate as ApprovalFrictionRecommendation,
  WorkflowStageExecutorRecommendationAggregate as WorkflowStageExecutorRecommendation,
} from '../WorkspaceOperationalMemoryService.js';

export type {
  ApprovedPolicyAggregate,
  RouteOutcomeAggregate,
  WorkflowFrictionRecommendation,
  ApprovalFrictionRecommendation,
  WorkflowStageExecutorRecommendation,
};

export type RoutingCandidateSource =
  | 'active_focus'
  | 'workflow_memory'
  | 'workflow_stage_memory'
  | 'subtype_memory'
  | 'kind_memory'
  | 'profile_default'
  | 'success_history';

export type RoutingCandidate = {
  executor: string;
  source: RoutingCandidateSource;
  confidence: number;
  rationale: string;
};

export type LlmRecommendation = {
  provider: string;
  model: string | null;
  source: 'subtype_memory' | 'kind_memory';
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
} | null;

export type WorkflowRecommendation = {
  workflow: WorkflowKind;
  confidence: number;
  rationale: string;
  recovered_count?: number;
};

export type AdviceInput = {
  parsed: ParsedCommand;
  route: RouteIntent;
  surface_source?: string | null;
  workspaceProfile?: WorkspaceProfile | null;
  workspaceOperationalMemory?: WorkspaceOperationalMemory | Record<string, unknown> | null;
};

export type WorkspaceRoutingAdvice = {
  executor: string | null;
  source: RoutingCandidateSource | 'none';
  confidence: number;
  task_kind: WorkspaceTaskKind;
  task_subtype: WorkspaceTaskSubtype;
  response_style: WorkspaceResponseStyle;
  llm_recommendation: LlmRecommendation;
  workflow_recommendation: WorkflowRecommendation | null;
  rationale: string[];
  blocked_executors: string[];
};
