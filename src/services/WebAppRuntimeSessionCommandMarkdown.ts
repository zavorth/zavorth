type RuntimeRecord = Record<string, unknown>;

export function renderSessionCommandMarkdown(result: RuntimeRecord): string {
  const activeRun = recordOrNull(result.activeRun);
  const catalog = recordOrNull(result.catalog);
  const catalogSummary = recordOrNull(catalog?.summary);
  const available = arrayOfStrings(result.available);
  const items = arrayOfRecords(result.items);
  const runs = arrayOfRecords(result.runs);
  const tasks = arrayOfRecords(result.tasks);
  const workflowRuns = arrayOfRecords(result.workflowRuns);
  const selectedTools = arrayOfRecords(result.selectedTools);
  const workspaceSelection = recordOrNull(result.workspaceSelection);
  const workflowIntent = recordOrNull(result.workflowIntent);
  const composer = recordOrNull(result.composer) || {};
  const totalTokens = Number(result.totalTokens);
  const totalCostUsd = Number(result.totalCostUsd);
  const hasTotalTokens = result.totalTokens !== null && result.totalTokens !== undefined && Number.isFinite(totalTokens);
  const hasTotalCostUsd = result.totalCostUsd !== null && result.totalCostUsd !== undefined && Number.isFinite(totalCostUsd);
  switch (result.kind) {
    case 'status':
      return [
        'Zavorth status',
        '',
        `Session: \`${result.sessionId}\``,
        `Profile: \`${result.profile}\``,
        `Model route: \`${result.modelRoute}\``,
        `Effort: \`${result.effort}\``,
        `Active run: \`${activeRun?.id || 'none'}\``,
        `Queue: \`${result.queueLength}\``,
        `Pending approvals: \`${result.pendingApprovals}\``,
        `Open tasks: \`${result.openTasks}\``,
        `Active workflows: \`${result.activeWorkflows}\``,
      ].join('\n');
    case 'usage':
      return [
        'Usage summary',
        '',
        `Runs visible: \`${result.visibleRuns}\``,
        `Tool runs: \`${result.toolRuns}\``,
        `Active run: \`${activeRun?.id || 'none'}\``,
        `Tokens: \`${hasTotalTokens ? totalTokens.toLocaleString() : 'not reported'}\``,
        `Cost: \`${hasTotalCostUsd ? `$${totalCostUsd.toFixed(4)}` : 'not reported'}\``,
        result.mode === 'full' && Array.isArray(result.recentRuns) && result.recentRuns.length ? `\nRecent runs:\n${result.recentRuns.map((run: RuntimeRecord) => `- ${run.id}: ${run.status}`).join('\n')}`
          : '',
      ].filter(Boolean).join('\n');
    case 'model':
      return result.mutationPerformed
        ? [
            `Model route set to \`${result.modelRoute}\`.`,
            '',
            'The next turns can send this session route through the runtime provider resolver.',
          ].join('\n')
        : [
            'Model route',
            '',
            `Current route: \`${result.currentModelRoute || result.modelRoute || 'auto'}\``,
            'Use `/model provider/model` to route upcoming turns.',
          ].join('\n');
    case 'models':
      return [
        'Available model routing',
        '',
        `Current route: \`${result.currentModelRoute || 'auto'}\``,
        catalogSummary ? `Catalog: \`${catalogSummary.catalogReadyRoutes || 0}/${catalogSummary.providerRoutes || 0} routes ready, ${catalogSummary.effectiveModelSurface || 0} effective models\``
          : '',
        'Zavorth only uses providers/models configured in the local runtime.',
        '',
        'Examples:',
        ...modelExamples().map((example) => `- \`${example}\``),
      ].filter(Boolean).join('\n');
    case 'profile':
      return [
        `Current profile: \`${result.currentProfile}\``,
        '',
        `Available: ${available.map((profile) => `\`${profile}\``).join(', ')}`,
      ].join('\n');
    case 'tools':
    case 'skills':
      return [
        result.kind === 'tools' ? 'Available tools' : 'Available skills',
        '',
        ...(items.length ? items.map((item) => `- ${item.title} (\`${item.id}\`, ${item.status})`) : ['No items reported by the runtime.']),
      ].join('\n');
    case 'agents':
      return [
        'Agents and tasks',
        '',
        `Active run: \`${activeRun?.id || 'none'}\``,
        `Visible runs: \`${runs.length}\``,
        `Tasks: \`${tasks.length}\``,
        `Workflow jobs: \`${workflowRuns.length}\``,
        '',
        ...runs.slice(0, 6).map((run) => `- ${run.title || run.id}: ${run.status}`),
      ].filter(Boolean).join('\n');
    case 'whoami':
      return [
        'local identity',
        '',
        `Profile: \`${result.profile}\``,
        `Session: \`${result.sessionId}\``,
        `Model route: \`${result.modelRoute}\``,
        `Platform: \`${result.platform}\``,
      ].join('\n');
    case 'context':
      return [
        'Next request context',
        '',
        `Session: \`${result.sessionId}\``,
        `Messages visible: \`${result.messagesCount}\``,
        `Attachments: \`${result.attachmentsCount}\``,
        `Selected tools: \`${selectedTools.length ? selectedTools.map((tool) => tool.title || tool.id).join(', ') : 'none'}\``,
        `Workspace selection: \`${workspaceSelection?.root || 'none'}\``,
        `Workflow intent: \`${workflowIntent?.kind || 'none'}\``,
        `Composer: model=${composer.model}, effort=${composer.effort}, tools=${composer.tools ? 'on' : 'off'}, thinking=${composer.thinking ? 'on' : 'off'}`,
      ].join('\n');
    case 'plan-review':
      return [
        'Plan review mode',
        '',
        `Command: \`${result.publicCommand}\``,
        `Native skill: \`${result.nativeSkillId}\``,
        `Scope: \`${result.objectivePreview}\``,
        '',
        'I will ask one question at a time, record the decision as a receipt, and avoid changing anything directly.',
      ].join('\n');
    case 'brief-reply':
      return [
        'Brief reply mode',
        '',
        `Command: \`${result.publicCommand}\``,
        `Native skill: \`${result.nativeSkillId}\``,
        `Target: \`${result.targetPreview}\``,
        `Limit: \`${result.maxLines} lines\``,
        '',
        'I will keep the next draft short, channel-ready, and profile-aware.',
      ].join('\n');
    case 'test-loop':
      return [
        'Governed test loop',
        '',
        `Command: \`${result.publicCommand}\``,
        `Native skill: \`${result.nativeSkillId}\``,
        `Request: \`${result.requestPreview}\``,
        '',
        ...arrayOfStrings(result.loop).map((step) => `- ${step}`),
        '',
        'Writes still go through preview, terminal/sandbox gates, approval when needed, and receipts.',
      ].join('\n');
    default:
      return `${result.kind || 'Command'} completed.`;
  }
}

function arrayOfRecords(value: unknown): RuntimeRecord[] {
  return Array.isArray(value)
    ? value.filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry)) as RuntimeRecord[]
    : [];
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => String(entry || '')).filter(Boolean)
    : [];
}

function recordOrNull(value: unknown): RuntimeRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as RuntimeRecord
    : null;
}

function modelExamples(): string[] {
  return [
    '/model auto',
    '/model openai/gpt-5.5',
    '/model anthropic/claude-opus',
    '/model local/llama',
  ];
}
