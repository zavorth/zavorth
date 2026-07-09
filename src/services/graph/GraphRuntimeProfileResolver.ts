import type {
  ExecutionIntentClassifierService,
  ExecutionIntentClassification,
} from '../ExecutionIntentClassifierService.js';
import type { ProviderStrategyDecision, ProviderStrategyService } from '../ProviderStrategyService.js';
import type { SkillRoutingDecision, SkillRoutingService } from '../SkillRoutingService.js';
import type {
  WorkspaceResponseStyle,
  WorkspaceTaskKind,
  WorkspaceTaskSubtype,
} from '../WorkspaceTaskKind.js';
import { resolveToolSelectionStrategy, toGraphRecord } from './GraphRuntimeDirectives.js';

import type { GraphExecutionProfile } from './GraphRuntimeTypes.js';

type ResolveGraphExecutionProfileInput = {
  taskGoal: string;
  metadata?: Record<string, unknown>;
  maxIterations: number;
  maxToolRounds: number;
  providerName: string;
  executionIntentClassifier: Pick<ExecutionIntentClassifierService, 'classify'>;
  providerStrategyService: Pick<ProviderStrategyService, 'resolve'>;
  skillRoutingService: Pick<SkillRoutingService, 'recommend'>;
  isProviderUsable: (name: string) => boolean;
};

export function resolveGraphExecutionProfile(input: ResolveGraphExecutionProfileInput): GraphExecutionProfile {
  const { taskGoal, metadata, maxIterations: defaultMaxIterations, maxToolRounds: defaultMaxToolRounds } = input;
  const intentDecision = input.executionIntentClassifier.classify({
    text: taskGoal,
    commandType: String(metadata?.commandType || ''),
    intent: String(metadata?.intent || ''),
    executor: String(metadata?.executor || ''),
    taskKind: normalizeTaskKind(metadata?.taskKind),
    taskSubtype: normalizeTaskSubtype(metadata?.taskSubtype),
    modeHint: 'graph',
  });
  const taskKind = intentDecision.taskKind;
  const taskSubtype = intentDecision.taskSubtype;
  const providerDecision = input.providerStrategyService.resolve({
    taskKind,
    taskSubtype,
    configuredProviderName: input.providerName,
    isProviderUsable: input.isProviderUsable,
    workspaceMemory: toGraphRecord(metadata?.workspaceOperationalMemory),
  });
  const skillDecision = input.skillRoutingService.recommend({
    taskGoal,
    taskKind,
    taskSubtype,
    modeHint: 'graph',
  });

  let depthProfile: GraphExecutionProfile['depthProfile'] = 'balanced';
  let toolingProfile: GraphExecutionProfile['toolingProfile'] = 'targeted';
  let toolSelectionProfile: GraphExecutionProfile['toolSelectionProfile'] = 'general';
  let deliveryProfile: GraphExecutionProfile['deliveryProfile'] = mapResponseStyleToDeliveryProfile(
    intentDecision.responseStyle,
  );
  let verificationProfile: GraphExecutionProfile['verificationProfile'] = 'balanced';
  let maxIterations = defaultMaxIterations;
  let maxToolRounds = defaultMaxToolRounds;

  if (
    taskSubtype === 'comparison'
    || taskSubtype === 'web_research'
    || taskSubtype === 'debugging'
  ) {
    depthProfile = 'deep';
    toolingProfile = 'evidence_heavy';
    toolSelectionProfile = 'research';
    if (taskSubtype === 'debugging') {
      deliveryProfile = 'diagnostic';
      verificationProfile = 'evidence_required';
    } else {
      deliveryProfile = 'decision_brief';
      verificationProfile = 'evidence_required';
    }
    maxIterations = Math.max(defaultMaxIterations, 2);
    maxToolRounds = Math.max(defaultMaxToolRounds, 3);
  } else if (taskSubtype === 'summarization') {
    depthProfile = 'concise';
    toolingProfile = 'minimal';
    toolSelectionProfile = 'research_summary';
    deliveryProfile = 'summary_first';
    maxToolRounds = Math.min(defaultMaxToolRounds, 2);
  } else if (taskSubtype === 'review' || taskSubtype === 'testing') {
    toolingProfile = 'evidence_heavy';
    toolSelectionProfile = 'code_readonly';
    deliveryProfile = 'findings_first';
    verificationProfile = taskSubtype === 'testing' ? 'evidence_required' : 'strict';
    maxToolRounds = Math.max(defaultMaxToolRounds, 2);
  } else if (taskKind === 'automation') {
    toolingProfile = 'checkpointed';
    toolSelectionProfile = 'automation';
    deliveryProfile = 'checkpointed';
    verificationProfile = 'stepwise';
    maxToolRounds = Math.max(defaultMaxToolRounds, 2);
  } else if (taskKind === 'code') {
    toolSelectionProfile = 'code_write';
  }

  const toolSelectionStrategy = resolveToolSelectionStrategy(toolSelectionProfile);
  const providerName =
    providerDecision.selectionSource === 'configured'
      ? input.providerName
      : providerDecision.providerName;

  return {
    taskKind,
    taskSubtype,
    depthProfile,
    toolingProfile,
    toolSelectionProfile,
    preferredToolNames: toolSelectionStrategy.preferredToolNames,
    blockedToolNames: toolSelectionStrategy.blockedToolNames,
    deliveryProfile,
    verificationProfile,
    providerName,
    modelName: providerDecision.modelName,
    allowFallback: providerDecision.allowFallback,
    fallbackOrder: providerDecision.fallbackOrder,
    maxIterations,
    maxToolRounds,
    intentDecision,
    providerDecision: {
      ...providerDecision,
      providerName,
    } as ProviderStrategyDecision,
    skillDecision: skillDecision as SkillRoutingDecision,
  };
}

export function normalizeTaskKind(value: unknown): WorkspaceTaskKind | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'code' || normalized === 'research' || normalized === 'design' || normalized === 'automation' || normalized === 'unknown') {
    return normalized as WorkspaceTaskKind;
  }

  return null;
}

export function normalizeTaskSubtype(value: unknown): WorkspaceTaskSubtype | null {
  const normalized = String(value || '').trim().toLowerCase();
  const supported = new Set<WorkspaceTaskSubtype>([
    'implementation',
    'debugging',
    'review',
    'testing',
    'web_research',
    'comparison',
    'summarization',
    'ui_design',
    'figma_design',
    'navigation',
    'form_fill',
    'app_control',
    'general',
    'unknown',
  ]);
  return supported.has(normalized as WorkspaceTaskSubtype) ? (normalized as WorkspaceTaskSubtype) : null;
}

export function mapResponseStyleToDeliveryProfile(
  responseStyle: WorkspaceResponseStyle,
): GraphExecutionProfile['deliveryProfile'] {
  switch (responseStyle) {
    case 'summary_first':
    case 'findings_first':
    case 'decision_brief':
    case 'checkpointed':
    case 'diagnostic':
    case 'implementation_ready':
      return responseStyle;
    default:
      return 'direct';
  }
}
