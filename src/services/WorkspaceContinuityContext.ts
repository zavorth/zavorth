import path from 'path';
import type { Task } from '../contracts/TaskContract.js';
import type { WorkflowRunSnapshot } from '../runtime/workflows/WorkflowRunService.js';

export type WorkspaceContinuityWorkflowRun = {
  workflowRunId: string | null;
  workflow: string | null;
  status: string | null;
  operatorState: 'active' | 'closed';
  operatorCloseReason: string | null;
  checkpointCount: number;
  lastEvent: string | null;
  resumeStage: {
    id: string | null;
    label: string | null;
    status: string | null;
    reason: string | null;
    prompt: string | null;
  } | null;
};

export type WorkspaceContinuityAction = {
  kind: 'resume_workflow' | 'open_latest_delivery' | 'approve_task';
  label: string;
  command: string;
  reason: string | null;
  workflowRunId?: string | null;
  stageId?: string | null;
  taskId?: string | null;
};

export type WorkspaceContinuityContext = {
  titleHint: string | null;
  operationalSummary: string | null;
  operationalInsight: string | null;
  responseStyle: string | null;
  workflowRecommendation: {
    workflow: string | null;
    label: string | null;
    reason: string | null;
  } | null;
  activeFocus: {
    label: string | null;
    reason: string | null;
    taskId: string | null;
    source: string | null;
  } | null;
  recentArtifact: {
    name: string | null;
    kind: string | null;
    path: string | null;
    taskId: string | null;
  } | null;
  workflowRun: WorkspaceContinuityWorkflowRun | null;
  followupPrompt: string | null;
  nextActions: WorkspaceContinuityAction[];
};

type TelegramSurfaceSummary = {
  titleHint: string | null;
  summary: string | null;
  operationalInsight: string | null;
  followupPrompt: string | null;
  workflowLabel: string | null;
  recentArtifact: string | null;
  activeFocus: string | null;
  isContinuationRequest: boolean;
};

export function hasWorkspaceContinuitySignals(task: Task | null | undefined): boolean {
  if (!task || !task.metadata || typeof task.metadata !== 'object') {
    return false;
  }

  const metadata = task.metadata as Record<string, any>;
  const routingAdvice =
    metadata.workspace_routing_advice && typeof metadata.workspace_routing_advice === 'object'
      ? metadata.workspace_routing_advice
      : {};
  const operationalMemory =
    metadata.workspace_operational_memory && typeof metadata.workspace_operational_memory === 'object'
      ? metadata.workspace_operational_memory
      : {};

  return Boolean(
    metadata.workspace_operational_memory_summary ||
      metadata.telegram_surface_summary ||
      metadata.workspace_response_style ||
      metadata.workspace_workflow_recommendation ||
      routingAdvice.workflow_recommendation ||
      (Array.isArray(operationalMemory.active_focuses) && operationalMemory.active_focuses.length) ||
      (Array.isArray(operationalMemory.recent_artifacts) && operationalMemory.recent_artifacts.length) ||
      (Array.isArray(operationalMemory.continuity_recommendations) &&
        operationalMemory.continuity_recommendations.length),
  );
}

export function buildWorkspaceContinuityContext(
  task: Task | null | undefined,
  sourceHint?: string | null,
): WorkspaceContinuityContext | null {
  if (!task || !hasWorkspaceContinuitySignals(task)) {
    return null;
  }

  const metadata =
    task.metadata && typeof task.metadata === 'object' ? (task.metadata as Record<string, any>) : {};
  const routingAdvice =
    metadata.workspace_routing_advice && typeof metadata.workspace_routing_advice === 'object'
      ? metadata.workspace_routing_advice
      : {};
  const operationalMemory =
    metadata.workspace_operational_memory && typeof metadata.workspace_operational_memory === 'object'
      ? metadata.workspace_operational_memory
      : {};
  const telegramSurfaceSummary = getTelegramSurfaceSummary(metadata.telegram_surface_summary);
  const continuityRecommendation = Array.isArray(operationalMemory.continuity_recommendations)
    ? operationalMemory.continuity_recommendations[0]
    : null;
  const activeFocus = Array.isArray(operationalMemory.active_focuses)
    ? operationalMemory.active_focuses[0]
    : null;
  const recentArtifact = Array.isArray(operationalMemory.recent_artifacts)
    ? operationalMemory.recent_artifacts[0]
    : null;
  const workflowRecommendation =
    metadata.workspace_workflow_recommendation || routingAdvice.workflow_recommendation || null;
  const workflow = asText(workflowRecommendation?.workflow || workflowRecommendation?.name)?.toLowerCase() || null;
  const workflowLabel = telegramSurfaceSummary?.workflowLabel || formatWorkflowLabel(workflow);
  const operationalSummary = asText(
    metadata.workspace_operational_memory_summary ||
      telegramSurfaceSummary?.summary ||
      operationalMemory.summary ||
      metadata.workspace_profile_summary,
  );
  const operationalInsight =
    asText(telegramSurfaceSummary?.operationalInsight) ||
    buildOperationalInsight(operationalMemory);
  const responseStyle = asText(metadata.workspace_response_style || routingAdvice.response_style);
  const titleHint =
    cleanTitleCandidate(telegramSurfaceSummary?.titleHint ?? null) ||
    buildTitleHint(task, continuityRecommendation, activeFocus, recentArtifact);
  const recentArtifactName =
    telegramSurfaceSummary?.recentArtifact ||
    humanizeArtifactLabel(recentArtifact?.name || recentArtifact?.path);
  const followupPrompt = buildFollowupPrompt({
    source: String(sourceHint || task.source || '').trim(),
    titleHint,
    continuityLabel: asText(continuityRecommendation?.label),
    continuityReason: asText(continuityRecommendation?.reason),
    workflowLabel,
    recentArtifactName,
    operationalSummary,
    explicitPrompt: telegramSurfaceSummary?.followupPrompt,
  });

  return {
    titleHint,
    operationalSummary,
    operationalInsight,
    responseStyle,
    workflowRecommendation:
      workflow || workflowLabel || asText(workflowRecommendation?.reason || workflowRecommendation?.rationale)
        ? {
            workflow,
            label: workflowLabel,
            reason: asText(workflowRecommendation?.reason || workflowRecommendation?.rationale),
          }
        : null,
    activeFocus: activeFocus
      ? {
          label:
            cleanTitleCandidate(telegramSurfaceSummary?.activeFocus ?? null) || cleanTitleCandidate(asText(activeFocus.summary)),
          reason: asText(telegramSurfaceSummary?.activeFocus ?? null) || asText(activeFocus.summary),
          taskId: asText(activeFocus.task_id),
          source: asText(sourceHint || task.source),
        }
      : null,
    recentArtifact: recentArtifact
      ? {
          name: recentArtifactName,
          kind: asText(recentArtifact.kind || recentArtifact.type),
          path: asText(recentArtifact.path),
          taskId: asText(recentArtifact.task_id),
        }
      : null,
    workflowRun: null,
    followupPrompt,
    nextActions: buildBaseNextActions({
      task,
      workflowRunId: asText(metadata.workflow_run_id),
      stageId: asText(metadata.workflow_resume_stage_id || metadata.workflow_stage_id),
      stageLabel: asText(metadata.workflow_resume_stage_label),
      workflowLabel,
      recentArtifactTaskId: asText(recentArtifact?.task_id),
      recentArtifactName,
    }),
  };
}

export function mergeWorkflowRunIntoWorkspaceContinuityContext(
  context: WorkspaceContinuityContext | null | undefined,
  run: WorkflowRunSnapshot | null | undefined,
): WorkspaceContinuityContext | null {
  if (!context && !run) {
    return null;
  }

  const normalizedContext: WorkspaceContinuityContext = context || {
    titleHint: null,
    operationalSummary: null,
    operationalInsight: null,
    responseStyle: null,
    workflowRecommendation: null,
    activeFocus: null,
    recentArtifact: null,
    workflowRun: null,
    followupPrompt: null,
    nextActions: [],
  };

  if (!run) {
    return normalizedContext;
  }

  const runWorkflow = asText(run.workflow_name)?.toLowerCase() || null;
  const operatorClosed = run.operator_state === 'closed';
  const operatorCloseReason = asText(run.operator_close_reason);
  const resumeStage = run.resume_stage
    ? {
        id: asText(run.resume_stage.id),
        label: asText(run.resume_stage.label),
        status: asText(run.resume_stage.status),
        reason: asText(run.resume_stage.reason),
        prompt: asText(run.resume_prompt),
      }
    : null;
  const latestArtifact = Array.isArray(run.artifacts) ? run.artifacts[0] : null;

  return {
    ...normalizedContext,
    workflowRecommendation: normalizedContext.workflowRecommendation || (runWorkflow
      ? {
          workflow: runWorkflow,
          label: formatWorkflowLabel(runWorkflow),
          reason: operatorCloseReason || resumeStage?.reason || null,
        }
      : null),
    recentArtifact: normalizedContext.recentArtifact || (latestArtifact
      ? {
          name: humanizeArtifactLabel(latestArtifact.name || latestArtifact.path),
          kind: asText(latestArtifact.kind || latestArtifact.type),
          path: asText(latestArtifact.path),
          taskId: null,
        }
      : null),
    workflowRun: {
      workflowRunId: asText(run.workflow_run_id),
      workflow: runWorkflow,
      status: asText(run.status),
      operatorState: operatorClosed ? 'closed' : 'active',
      operatorCloseReason,
      checkpointCount: Math.max(0, Number(run.externalized_state?.checkpoint_count || 0)),
      lastEvent: asText(run.externalized_state?.last_event),
      resumeStage,
    },
    followupPrompt: operatorClosed
      ? buildClosedWorkflowFollowupPrompt({
        titleHint: normalizedContext.titleHint,
        recentArtifactName: normalizedContext.recentArtifact?.name || null,
        closeReason: operatorCloseReason,
        explicitPrompt: normalizedContext.followupPrompt,
      })
      : (normalizedContext.followupPrompt || asText(run.resume_prompt)),
    nextActions: mergeContinuityActions(
      operatorClosed
        ? normalizedContext.nextActions.filter((entry) => entry.kind !== 'resume_workflow')
        : normalizedContext.nextActions,
      buildWorkflowRunActions({
        runId: asText(run.workflow_run_id),
        stageId: resumeStage?.id || null,
        stageLabel: resumeStage?.label || null,
        reason: resumeStage?.reason || null,
        resumable: !operatorClosed,
      }),
    ),
  };
}

function asText(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function formatWorkflowLabel(workflow: string | null): string | null {
  const normalized = String(workflow || '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === 'ship') return 'Delivery workflow';
  if (normalized === 'review') return 'Review workflow';
  if (normalized === 'research') return 'Research workflow';
  return `Workflow ${normalized}`;
}

function humanizeArtifactLabel(value: unknown): string | null {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return null;
  }

  const base = path.basename(normalized).replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  if (!base) {
    return null;
  }

  return base.charAt(0).toUpperCase() + base.slice(1);
}

function cleanTitleCandidate(value: string | null): string | null {
  const cleaned = String(value || '')
    .replace(/\bworkflow\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : null;
}

function buildTitleHint(task: Task, continuityRecommendation: any, activeFocus: any, recentArtifact: any): string | null {
  return cleanTitleCandidate(
    asText(continuityRecommendation?.label) ||
      humanizeArtifactLabel(recentArtifact?.name || recentArtifact?.path) ||
      asText(activeFocus?.summary) ||
      asText(task.result_summary) ||
      asText(task.raw_message),
  );
}

function buildBaseNextActions(input: {
  task: Task;
  workflowRunId: string | null;
  stageId: string | null;
  stageLabel: string | null;
  workflowLabel: string | null;
  recentArtifactTaskId: string | null;
  recentArtifactName: string | null;
}): WorkspaceContinuityAction[] {
  const actions: WorkspaceContinuityAction[] = [];
  const normalizedTaskId = asText(input.task.task_id);

  if (String(input.task.status || '').trim() === 'waiting_approval' && normalizedTaskId) {
    actions.push({
      kind: 'approve_task',
      label: 'Approve and resume',
      command: `/approve ${normalizedTaskId}`,
      reason: 'The task still depends on your confirmation to continue.',
      taskId: normalizedTaskId,
    });
  }

  if (input.recentArtifactTaskId) {
    actions.push({
      kind: 'open_latest_delivery',
      label: input.recentArtifactName ? `Open ${input.recentArtifactName}`
        : 'Open latest delivery',
      command: `/files ${shortId(input.recentArtifactTaskId)}`,
      reason: input.recentArtifactName ? `Inspect the recent delivery ${input.recentArtifactName}.`
        : 'Inspect the last delivery before continuing.',
      taskId: input.recentArtifactTaskId,
    });
  }

  actions.push(
    ...buildWorkflowRunActions({
      runId: input.workflowRunId,
      stageId: input.stageId,
      stageLabel: input.stageLabel,
      reason: input.workflowLabel ? `${input.workflowLabel} can still resume from the current point.`
        : null,
    }),
  );

  return mergeContinuityActions(actions);
}

function buildWorkflowRunActions(input: {
  runId: string | null;
  stageId: string | null;
  stageLabel: string | null;
  reason: string | null;
  resumable?: boolean;
}): WorkspaceContinuityAction[] {
  if (!input.runId || input.resumable === false) {
    return [];
  }

  const command = input.stageId ? `/workflow resume ${input.runId} ${input.stageId}`
    : `/workflow resume ${input.runId}`;

  return [
    {
      kind: 'resume_workflow',
      label: input.stageLabel ? `resume workflow in ${input.stageLabel}`
        : 'Resume workflow',
      command,
      reason: input.reason,
      workflowRunId: input.runId,
      stageId: input.stageId,
    },
  ];
}

function buildClosedWorkflowFollowupPrompt(input: {
  titleHint: string | null;
  recentArtifactName: string | null;
  closeReason: string | null;
  explicitPrompt?: string | null;
}): string | null {
  const titleHint = cleanTitleCandidate(input.titleHint);
  const parts: string[] = [];

  parts.push(
    titleHint ? `Continue the conversation about ${titleHint}.`
      : 'Continue the current conversation.',
  );
  parts.push(
    input.closeReason ? `The previous workflow was closed by the operator: ${input.closeReason}.`
      : 'The previous workflow was closed by the operator.',
  );
  if (input.recentArtifactName) {
    parts.push(`Use ${input.recentArtifactName} as the basis for deciding the next useful step.`);
  } else {
    parts.push('Continue from the current context without automatically resuming the previous workflow.');
  }

  const prompt = parts.join(' ').replace(/\s+/g, ' ').trim();
  return prompt || asText(input.explicitPrompt) || null;
}

function mergeContinuityActions(
  ...groups: Array<WorkspaceContinuityAction[] | null | undefined>
): WorkspaceContinuityAction[] {
  const byKey = new Map<string, WorkspaceContinuityAction>();
  for (const group of groups) {
    for (const action of Array.isArray(group) ? group : []) {
      if (!action || !action.kind || !action.command) {
        continue;
      }
      const key = `${action.kind}:${action.command}`;
      if (!byKey.has(key)) {
        byKey.set(key, action);
      }
    }
  }
  return Array.from(byKey.values());
}

function shortId(value: string): string {
  const normalized = String(value || '').trim();
  return normalized ? normalized.substring(0, 8) : '';
}

function buildOperationalInsight(operationalMemory: Record<string, any>): string | null {
  const workflowFriction = Array.isArray(operationalMemory.workflow_friction_recommendations)
    ? operationalMemory.workflow_friction_recommendations[0]
    : null;
  if (workflowFriction) {
    const workflow = asText(workflowFriction.workflow) || 'workflow';
    const phase = asText(workflowFriction.last_resume_stage_label);
    const rationale = asText(workflowFriction.rationale);
    return normalizeInsightText(
      `Operational attention: ${workflow}${phase ? ` often stalls in ${phase}` : ' requires care during resumption'}${rationale ? ` (${rationale})` : ''}.`,
    );
  }

  const approvalFriction = Array.isArray(operationalMemory.approval_friction_recommendations)
    ? operationalMemory.approval_friction_recommendations[0]
    : null;
  if (approvalFriction) {
    const executor = asText(approvalFriction.executor) || 'executor';
    const kind = asText(approvalFriction.kind) || 'action';
    const subtype = asText(approvalFriction.subtype);
    const rationale = asText(approvalFriction.rationale);
    return normalizeInsightText(
      `Recent friction: ${executor} usually asks for confirmation in ${kind}${subtype && subtype !== 'general' ? `/${subtype}` : ''}${rationale ? ` (${rationale})` : ''}.`,
    );
  }

  const routeOutcome = Array.isArray(operationalMemory.route_outcomes)
    ? operationalMemory.route_outcomes[0]
    : null;
  if (routeOutcome) {
    const executor = asText(routeOutcome.executor) || 'executor';
    const kind = asText(routeOutcome.task_kind) || 'task';
    const subtype = asText(routeOutcome.task_subtype);
    const rationale = asText(routeOutcome.rationale);
    return normalizeInsightText(
      `Recent better route: ${executor} closes ${kind}${subtype && subtype !== 'general' ? `/${subtype}` : ''}${rationale ? ` (${rationale})` : ''}.`,
    );
  }

  const workflowExecutor = Array.isArray(operationalMemory.workflow_executor_recommendations)
    ? operationalMemory.workflow_executor_recommendations[0]
    : null;
  if (workflowExecutor) {
    const workflow = asText(workflowExecutor.workflow) || 'workflow';
    const executor = asText(workflowExecutor.executor) || 'executor';
    const successCount = Math.max(0, Number(workflowExecutor.success_count || 0));
    return normalizeInsightText(
      `Most trusted executor by workflow: ${workflow} -> ${executor}${successCount ? ` (${successCount} stage(s) completed(s))` : ''}.`,
    );
  }

  const approvedPolicy = Array.isArray(operationalMemory.approved_policies)
    ? operationalMemory.approved_policies[0]
    : null;
  if (approvedPolicy) {
    const executor = asText(approvedPolicy.executor) || 'executor';
    const kind = asText(approvedPolicy.kind) || 'policy';
    return normalizeInsightText(`Policy already reused in this workspace: ${executor}/${kind}.`);
  }

  const successfulExecutor = Array.isArray(operationalMemory.successful_executors)
    ? operationalMemory.successful_executors[0]
    : null;
  if (successfulExecutor) {
    const executor = asText(successfulExecutor.executor) || 'executor';
    const count = Math.max(0, Number(successfulExecutor.count || 0));
    return normalizeInsightText(
      `Most trusted executor now: ${executor}${count ? ` (${count} success(s))` : ''}.`,
    );
  }

  return null;
}

function normalizeInsightText(value: string | null): string | null {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  return normalized || null;
}

function buildFollowupPrompt(input: {
  source: string;
  titleHint: string | null;
  continuityLabel: string | null;
  continuityReason: string | null;
  workflowLabel: string | null;
  recentArtifactName: string | null;
  operationalSummary: string | null;
  explicitPrompt?: string | null;
}): string | null {
  const directPrompt = String(input.explicitPrompt || '').trim();
  if (directPrompt) {
    return directPrompt;
  }

  const parts: string[] = [];
  const titleHint = cleanTitleCandidate(input.titleHint);
  if (input.source === 'telegram') {
    parts.push(
      titleHint ? `Resume the conversation that came from Telegram about ${titleHint}.`
        : 'Resume the conversation that came from Telegram.',
    );
  } else {
    parts.push(titleHint ? `Continue the conversation about ${titleHint}.` : 'Continue the current conversation.');
  }

  if (input.continuityReason) {
    parts.push(input.continuityReason.endsWith('.') ? input.continuityReason : `${input.continuityReason}.`);
  } else if (input.continuityLabel) {
    parts.push(`${cleanTitleCandidate(input.continuityLabel)}.`);
  } else if (input.operationalSummary) {
    parts.push(`Take this context into account: ${input.operationalSummary}.`);
  }

  if (input.workflowLabel) {
    parts.push(`Follow the ${input.workflowLabel.toLowerCase()} suggested path to reach the next useful step.`);
  }

  if (input.recentArtifactName) {
    parts.push(`Use ${input.recentArtifactName} as the basis for what comes next.`);
  }

  const prompt = parts.join(' ').replace(/\s+/g, ' ').trim();
  return prompt || null;
}

function getTelegramSurfaceSummary(value: unknown): TelegramSurfaceSummary | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const summary = value as Record<string, unknown>;
  const titleHint = cleanTitleCandidate(asText(summary.titleHint));
  const summaryText = asText(summary.summary);
  const operationalInsight = asText(summary.operationalInsight);
  const followupPrompt = asText(summary.followupPrompt);
  const workflowLabel = asText(summary.workflowLabel);
  const recentArtifact = humanizeArtifactLabel(summary.recentArtifact) || cleanTitleCandidate(asText(summary.recentArtifact));
  const activeFocus = cleanTitleCandidate(asText(summary.activeFocus));
  const isContinuationRequest = Boolean(summary.isContinuationRequest);

  if (!titleHint && !summaryText && !operationalInsight && !followupPrompt && !workflowLabel && !recentArtifact && !activeFocus) {
    return null;
  }

  return {
    titleHint,
    summary: summaryText,
    operationalInsight,
    followupPrompt,
    workflowLabel,
    recentArtifact,
    activeFocus,
    isContinuationRequest,
  };
}
