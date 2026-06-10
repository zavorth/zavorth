export type WorkflowSlashCommand = 'go' | 'workflows';

export type WorkflowIntentKind = 'focused-mission' | 'governed-workflow';

export type WorkflowSlashIntent = {
  source: 'slash-command';
  command: '/go' | '/workflows';
  kind: WorkflowIntentKind;
  effort: 'deep' | 'ultra';
  objectivePreview: string | null;
  approvalMode: 'risk-based';
  dynamicWorkflow: boolean;
  budgetGuardRequired: boolean;
  maxFanout: number;
  finalSynthesisRequired: boolean;
  rawSecretsSerialized: false;
};

export type WorkflowSlashRequest = {
  command: WorkflowSlashCommand;
  autoSubmit: boolean;
  effort: 'deep' | 'ultra';
  guidedFlow: string;
  text: string;
  workflowIntent: WorkflowSlashIntent;
};

export function normalizeWorkflowSlashCommand(value: string): WorkflowSlashCommand | null {
  const normalized = String(value || '').trim().replace(/^\//, '').toLowerCase().replace(/_/g, '-');
  if (normalized === 'go') return 'go';
  if (normalized === 'workflow' || normalized === 'workflows') return 'workflows';
  return null;
}

export function buildWorkflowSlashRequest(commandValue: string, args = ''): WorkflowSlashRequest {
  const command = normalizeWorkflowSlashCommand(commandValue) || 'go';
  const objective = String(args || '').trim();
  const isWorkflow = command === 'workflows';
  const effort = isWorkflow ? 'ultra' : 'deep';
  const kind: WorkflowIntentKind = isWorkflow ? 'governed-workflow' : 'focused-mission';
  const guidedFlow = isWorkflow ? 'slash-workflows-governed-workflow' : 'slash-go-focused-mission';
  const objectiveLine = objective ? `Objective: ${objective}` : 'Objective: ';
  const text = isWorkflow
    ? [
        'Run this as a governed workflow.',
        'Split it into parallel-safe tasks, choose cheap workers where possible, set budget/depth caps, define receipts, and keep final synthesis controlled.',
        objectiveLine,
      ].join('\n')
    : [
        'Run this as a focused mission.',
        'First define the goal, plan, risks, verification, and stop condition. Then continue only through the safe route.',
        objectiveLine,
      ].join('\n');

  return {
    command,
    autoSubmit: objective.length > 0,
    effort,
    guidedFlow,
    text,
    workflowIntent: {
      source: 'slash-command',
      command: isWorkflow ? '/workflows' : '/go',
      kind,
      effort,
      objectivePreview: objective ? redactPreview(objective) : null,
      approvalMode: 'risk-based',
      dynamicWorkflow: isWorkflow,
      budgetGuardRequired: true,
      maxFanout: isWorkflow ? 30 : 12,
      finalSynthesisRequired: true,
      rawSecretsSerialized: false,
    },
  };
}

function redactPreview(value: string): string {
  return value
    .slice(0, 600)
    .replace(/\b(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|AIza[A-Za-z0-9_-]{12,})\b/g, '[redacted-secret]')
    .replace(/\b(token|secret|password|api[_-]?key)\s*[:=]\s*[^,\s]+/gi, '$1=[redacted]');
}
