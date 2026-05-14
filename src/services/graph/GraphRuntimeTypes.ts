import type {
  SupervisorGraphDependencies,
  SupervisorGraphResult,
  SupervisorGraphStatus,
} from '../../orchestrator/graph/SupervisorGraph.js';
import type { ChatMessage } from '../../providers/ILlmProvider.js';
import type { ExecutionIntentClassification } from '../ExecutionIntentClassifierService.js';
import type { LlmRuntimeService } from '../llm/LlmRuntimeService.js';
import type { ProviderStrategyDecision } from '../ProviderStrategyService.js';
import type { SkillRoutingDecision } from '../SkillRoutingService.js';
import type { CostBudgetService } from '../telemetry/CostBudgetService.js';
import type { TelemetryRuntimeService } from '../telemetry/TelemetryRuntimeService.js';
import type { TokenBudgetService } from '../telemetry/TokenBudgetService.js';
import type { ToolRuntimeService } from '../tools/ToolRuntimeService.js';
import type {
  WorkspaceResponseStyle,
  WorkspaceTaskKind,
  WorkspaceTaskSubtype,
} from '../WorkspaceTaskKind.js';

export type GraphRuntimeDecisionTrace = {
  executionRoute: string;
  taskKind: WorkspaceTaskKind;
  taskSubtype: WorkspaceTaskSubtype;
  responseStyle: WorkspaceResponseStyle;
  provider: {
    providerName: string;
    modelName?: string;
    profileId: string | null;
    profileLabel: string | null;
    selectionSource: ProviderStrategyDecision['selectionSource'];
    fallbackOrder: string[];
  };
  skills: {
    primarySkillName: string | null;
    supportingSkillNames: string[];
    matchedBundleTags: string[];
  };
  rationale: string[];
};

export type GraphRuntimeResult = {
  ok: boolean;
  approved: boolean;
  status: SupervisorGraphStatus;
  finalReply: string;
  iterations: number;
  criticFeedback: string | null;
  error: string | null;
  messages: SupervisorGraphResult['messages'];
  traceId: string;
  providerName: string;
  modelName?: string;
  tokenBudget: {
    used: number;
    limit: number;
    withinBudget: boolean;
  };
  costBudget: {
    estimatedCostUsd: number;
    limitUsd: number;
    withinBudget: boolean;
  };
  decisionTrace: GraphRuntimeDecisionTrace;
};

export type GraphRuntimeTaskContext = {
  initialMessages?: ChatMessage[];
  metadata?: Record<string, unknown>;
};

export type GraphExecutionProfile = {
  taskKind: WorkspaceTaskKind;
  taskSubtype: WorkspaceTaskSubtype;
  depthProfile: 'concise' | 'balanced' | 'deep';
  toolingProfile: 'minimal' | 'targeted' | 'evidence_heavy' | 'checkpointed';
  toolSelectionProfile:
    | 'general'
    | 'research'
    | 'research_summary'
    | 'code_readonly'
    | 'code_write'
    | 'automation';
  preferredToolNames: string[];
  blockedToolNames: string[];
  deliveryProfile:
    | 'direct'
    | 'summary_first'
    | 'findings_first'
    | 'decision_brief'
    | 'checkpointed'
    | 'diagnostic'
    | 'implementation_ready';
  verificationProfile: 'balanced' | 'strict' | 'evidence_required' | 'stepwise';
  providerName: string;
  modelName?: string;
  allowFallback: boolean;
  fallbackOrder: string[];
  maxIterations: number;
  maxToolRounds: number;
  intentDecision: ExecutionIntentClassification;
  providerDecision: ProviderStrategyDecision;
  skillDecision: SkillRoutingDecision;
};

export type ToolRuntimeLike = Pick<ToolRuntimeService, 'getToolDefinitions' | 'executeTool'>;

export type GraphRuntimeServiceOptions = Omit<SupervisorGraphDependencies, 'llmRuntime' | 'toolRuntime'> & {
  llmRuntime: LlmRuntimeService;
  toolRuntime?: ToolRuntimeLike;
  telemetryRuntime?: TelemetryRuntimeService;
  tokenBudgetService?: TokenBudgetService;
  costBudgetService?: CostBudgetService;
  executionIntentClassifierService?: { classify: (input: any) => ExecutionIntentClassification };
  providerStrategyService?: { resolve: (input: any) => ProviderStrategyDecision };
  skillRoutingService?: { recommend: (input: any) => SkillRoutingDecision };
};
