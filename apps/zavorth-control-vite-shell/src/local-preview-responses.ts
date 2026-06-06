import { buildBusinessAuditCards, buildDeveloperReviewCards, buildDeveloperWorkspacePickerCard, buildPersonalDayFlowCards, shouldHandleBusinessAuditFlow, shouldHandleDeveloperReviewFlow, shouldHandlePersonalDayFlow } from './guided-flow-cards';

type LocalPreviewOptions = {
  appendEcho: (role: string, text: string, logicCells?: string) => void;
  buildInteractiveButtons: () => string;
  buildLogicCell: (name: string, icon: string, detail: string, content: string) => string;
  buildSystemTrace: (message: string) => string;
  getCurrentModelLabel: () => string;
  getCurrentModelRouteLabel: () => string;
  getPendingWorkspaceSelection: () => any;
  getSelectedExperienceProfile: () => string;
  recordTraceEvent: (event: Record<string, unknown>) => void;
  setSelectedExperienceProfile: (profile: string) => void;
};

export function createLocalPreviewResponses({
  appendEcho,
  buildInteractiveButtons,
  buildLogicCell,
  buildSystemTrace,
  getCurrentModelLabel,
  getCurrentModelRouteLabel,
  getPendingWorkspaceSelection,
  getSelectedExperienceProfile,
  recordTraceEvent,
  setSelectedExperienceProfile,
}: LocalPreviewOptions) {
  function renderPersonalDayFlow(userText: string) {
    const profile = getSelectedExperienceProfile() || 'personal';
    const planId = `personal-day-${Date.now().toString(36)}`;
    recordTraceEvent({
      type: 'receipt',
      title: 'Personal mission receipt',
      detail: 'Daily plan generated without external changes.',
      meta: planId,
      status: 'preview',
      receipt: {
        id: planId,
        status: 'preview',
        summary: 'Read-only daily plan. No reminders, messages, files or calendar events were created.',
        rollback: 'not needed',
      },
    });
    const body = [
      'Personal mode is active. I can help organize the day without touching anything outside this dashboard.',
      '',
      'Here is a simple plan you can use now. I did not create reminders, send messages, edit files or change your calendar.',
      '',
      'If you later ask me to create a reminder, send a message, edit a calendar or change an external app, I will pause and ask for approval first.',
    ].join('\n');
    appendEcho('core', body, buildPersonalDayFlowCards({ planId, profile, userText }));
  }

  function renderDeveloperWorkspacePicker(userText: string) {
    const body = [
      'Developer mode is active.',
      '',
      'To review a repository safely, choose a folder or use the current runtime workspace. I will start read-only, list risks, show a patch preview, and require approval before any edit.',
    ].join('\n');
    appendEcho('core', body, buildDeveloperWorkspacePickerCard(userText));
  }

  function renderDeveloperReviewFlow(userText: string, workspace: any) {
    const receiptId = `developer-review-${Date.now().toString(36)}`;
    const safeWorkspace = workspace || {
      root: 'current runtime workspace',
      fileCount: 0,
      sampledFileCount: 0,
      totalBytes: 0,
      topExtensions: [],
      sampleFiles: [],
      source: 'runtime',
    };
    recordTraceEvent({
      type: 'artifact',
      title: 'Patch preview prepared',
      detail: `${safeWorkspace.root}: preview only, no files edited.`,
      meta: 'developer',
      status: 'preview',
      receipt: {
        id: receiptId,
        status: 'preview',
        summary: 'Developer review completed as read-only preview. Patch proposal requires approval before editing.',
        rollback: 'git diff / reverse patch evidence required before mutation',
      },
    });
    recordTraceEvent({
      type: 'approval',
      title: 'Patch approval required',
      detail: 'Editing files is blocked until the operator approves a scoped patch.',
      meta: receiptId,
      status: 'pending',
    });
    const body = [
      `Developer mode is active for ${safeWorkspace.root}.`,
      '',
      'I reviewed the workspace in preview mode. No files were edited, no commands were executed, and no network access was used.',
      '',
      'A patch proposal is ready below. Applying it requires scoped approval and rollback evidence.',
    ].join('\n');
    appendEcho('core', body, buildDeveloperReviewCards({ receiptId, workspace: safeWorkspace, userText }));
  }

  function renderBusinessAuditFlow(userText: string) {
    const receiptId = `business-audit-${Date.now().toString(36)}`;
    const ttlMinutes = 15;
    recordTraceEvent({
      type: 'receipt',
      title: 'Business audit receipt',
      detail: 'Governed audit projected with policy, approval channel, scope, TTL, blocked actions and evidence.',
      meta: receiptId,
      status: 'preview',
      receipt: {
        id: receiptId,
        status: 'preview',
        summary: 'Read-only business audit. No policy, channel or workspace mutation occurred.',
        artifact: 'business-audit-preview',
        rollback: 'not needed; no mutable action executed',
      },
    });
    const body = [
      'Business mode is active.',
      '',
      'I prepared a governed audit preview. This is safe to inspect: no policy was changed, no channel was modified, no message was sent and no workspace files were edited.',
      'Nothing outside this zavorthControl was changed.',
      '',
      'The approval channel, policy scope, TTL, blocked actions and receipt evidence are below.',
    ].join('\n');
    appendEcho('core', body, buildBusinessAuditCards({ receiptId, ttlMinutes, userText }));
  }

  function generateCoreResponse(userText: string) {
    const lower = userText.toLowerCase();

    if (shouldHandlePersonalDayFlow(userText, '')) {
      renderPersonalDayFlow(userText);
    } else if (shouldHandleDeveloperReviewFlow(userText, '')) {
      const workspace = getPendingWorkspaceSelection();
      if (workspace) renderDeveloperReviewFlow(userText, workspace);
      else renderDeveloperWorkspacePicker(userText);
    } else if (shouldHandleBusinessAuditFlow(userText, '')) {
      renderBusinessAuditFlow(userText);
    } else if (lower.includes('status') || lower.includes('health') || lower.includes('teste')) {
      const traces = buildSystemTrace('Scanning the gateway...') + buildSystemTrace('Checking PID 4821...');
      const cells = buildLogicCell(
        'system_health_check',
        'M22 12h-4l-3 9L9 3l-3 9H2',
        '0.4s',
        `Gateway:   Connected\nAgent:     Running\nModel:     ${getCurrentModelLabel()}\nRoute:     ${getCurrentModelRouteLabel()}`,
      );
      appendEcho('core', 'Systems are operational. Full report below:', traces + cells);
    } else if (lower.includes('agente') || lower.includes('criar')) {
      const traces = buildSystemTrace('Compiling the new agent manifest...') + buildSystemTrace('Waiting for operator approval.');
      const cells = buildLogicCell(
        'generate_manifest',
        'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z',
        '1.2s',
        `{\n  "name": "Data Analyst",\n  "model": ${JSON.stringify(getCurrentModelLabel())},\n  "tools": ["python_exec", "db_read"]\n}`,
      );
      appendEcho('core', 'Manifest created successfully. Do you want me to deploy it to the mesh?', traces + cells + buildInteractiveButtons());
    } else if (lower.includes('run') || lower.includes('exec') || lower.includes('comando')) {
      const traces = buildSystemTrace('Conectando ao shell TTY1...');
      const cells = buildLogicCell(
        'run_command',
        'M4 17l6-6-6-6M12 19h8',
        '2.1s',
        '$ pnpm check:changed\n\nCore prod typecheck passed\nLint passed (0 warnings)\n47 tests passed\n\nAll gates green.',
      );
      appendEcho('core', 'Command completed successfully:', traces + cells);
    } else {
      const traces = buildSystemTrace('Analyzing operator intent...') + buildSystemTrace('Mapping required tools...');
      appendEcho('core', `Understood: "${userText}"\n\nStarting governed execution. The system feed will update in real time.`, traces);
    }
  }

  return {
    generateCoreResponse,
    renderBusinessAuditFlow,
    renderDeveloperReviewFlow,
    renderDeveloperWorkspacePicker,
    renderPersonalDayFlow,
  };
}
