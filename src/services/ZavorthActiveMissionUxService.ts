import {
  ZAVORTH_ACTIVE_MISSION_UX_CONTRACT_VERSION,
  type ZavorthActiveMissionUxAction,
  type ZavorthActiveMissionUxSnapshot,
  type ZavorthActiveMissionUxStatus,
  type ZavorthActiveMissionUxTimelineEvent,
  type ZavorthActiveMissionUxTone,
} from '../contracts/ZavorthActiveMissionUxContract.js';

export type ZavorthActiveMissionUxInput = {
  runtimeSnapshot?: Record<string, any> | null;
  sensitiveActionFlowUx?: Record<string, any> | null;
  visualReceipts?: Record<string, any> | null;
  providerSelectionUx?: Record<string, any> | null;
  providerPreference?: Record<string, any> | null;
};

type ZavorthActiveMissionUxRuntime = {
  now?: () => Date;
};

export class ZavorthActiveMissionUxService {
  private readonly now: () => Date;

  constructor(runtime: ZavorthActiveMissionUxRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: ZavorthActiveMissionUxInput = {}): ZavorthActiveMissionUxSnapshot {
    const generatedAt = this.now().toISOString();
    const runtime = asRecord(input.runtimeSnapshot);
    const run = asRecord(runtime?.activeRun);
    const sensitive = asRecord(input.sensitiveActionFlowUx);
    const sensitiveCard = asRecord(sensitive?.card);
    const visualReceipts = asRecord(input.visualReceipts);
    const providerSelection = asRecord(input.providerSelectionUx);
    const status = resolveStatus({ run, sensitiveCard });
    const timeline = buildTimeline({
      generatedAt,
      run,
      sensitiveCard,
      visualReceipts,
      providerSelection,
    });
    const actions = buildActions({
      run,
      sensitiveCard,
      visualReceipts,
      providerSelection,
    });
    const counts = {
      timelineEvents: timeline.length,
      approvalsPending: timeline.filter((event) => event.source === 'sensitive-flow' && event.status === 'pending').length,
      artifactsReady: Array.isArray(runtime?.artifacts) ? runtime.artifacts.filter((artifact: any) => artifact?.status === 'ready').length : 0,
      receiptsReady: Array.isArray(visualReceipts?.cards) ? visualReceipts.cards.length : 0,
      blockers: timeline.filter((event) => event.status === 'blocked').length,
    };
    const tone = toneForStatus(status, counts.blockers);

    return sanitizeSnapshot({
      contractVersion: ZAVORTH_ACTIVE_MISSION_UX_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'active-mission-ux',
      generatedAt,
      status,
      tone,
      mission: {
        id: text(run?.id) || text(sensitiveCard?.id) || 'mission-local-preview',
        title: text(run?.title) || text(sensitiveCard?.title) || 'No active mission',
        summary: text(run?.summary) || text(sensitiveCard?.subtitle) || 'Zavorth is ready for the next request.',
        request: text(sensitiveCard?.request) || text(run?.metadata?.request) || text(run?.title) || 'No request selected.',
        runId: text(run?.id) || null,
        traceId: text(run?.traceId) || null,
        sessionId: text(run?.sessionId) || null,
        providerLabel: text(run?.providerLabel) || text(providerSelection?.selected?.providerId) || 'provider not selected',
        modelLabel: text(run?.modelLabel) || text(providerSelection?.selected?.model) || 'model not selected',
        risk: text(sensitiveCard?.risk) as any || 'unknown',
      },
      counts,
      timeline,
      actions,
      commandCenterProjection: {
        route: '/dashboard',
        renderMode: 'mission-timeline',
        executionAuthority: false,
      },
      safety: {
        projectionOnly: true,
        commandCenterCanExecute: false,
        rawSecretsSerialized: false,
        approvalsStillRequired: true,
      },
      nextAction: nextActionForStatus(status, counts),
    });
  }

  public renderText(snapshot: ZavorthActiveMissionUxSnapshot): string {
    return [
      '[active-mission-ux]',
      `status=${snapshot.status}`,
      `risk=${snapshot.mission.risk}`,
      `provider=${snapshot.mission.providerLabel}`,
      `model=${snapshot.mission.modelLabel}`,
      snapshot.mission.title,
      snapshot.mission.summary,
      '',
      '[timeline]',
      ...snapshot.timeline.map((event) => `- ${event.status} ${event.label}: ${event.summary}`),
      '',
      '[actions]',
      ...snapshot.actions.map((action) => `- ${action.id}: ${action.command}`),
      '',
      `next=${snapshot.nextAction}`,
      '',
    ].join('\n');
  }
}

function buildTimeline(input: {
  generatedAt: string;
  run: Record<string, any> | null;
  sensitiveCard: Record<string, any> | null;
  visualReceipts: Record<string, any> | null;
  providerSelection: Record<string, any> | null;
}): ZavorthActiveMissionUxTimelineEvent[] {
  const events: ZavorthActiveMissionUxTimelineEvent[] = [];
  if (input.run) {
    events.push({
      id: `run:${text(input.run.id) || 'active'}`,
      label: 'Run',
      summary: text(input.run.summary) || text(input.run.title) || 'Agent run is active.',
      status: runStatusToTimeline(text(input.run.status)),
      tone: runTone(text(input.run.status)),
      source: 'run',
    });
    const runEvents = Array.isArray(input.run.events) ? input.run.events.slice(0, 3) : [];
    for (const event of runEvents) {
      events.push({
        id: `run-event:${text(event?.id) || events.length}`,
        label: text(event?.title) || 'Run event',
        summary: text(event?.detail) || text(event?.kind) || 'Runtime event.',
        status: eventStatusToTimeline(text(event?.status)),
        tone: eventStatusTone(text(event?.status)),
        source: 'run',
      });
    }
  } else {
    events.push({
      id: 'system:idle',
      label: 'Ready',
      summary: 'No live run selected; Command Center is waiting for a mission.',
      status: 'pending',
      tone: 'info',
      source: 'system',
    });
  }

  if (input.sensitiveCard) {
    const steps = Array.isArray(input.sensitiveCard.steps) ? input.sensitiveCard.steps.slice(0, 4) : [];
    for (const step of steps) {
      events.push({
        id: `sensitive:${text(step?.id) || events.length}`,
        label: text(step?.label) || 'Sensitive flow',
        summary: text(step?.summary) || 'Sensitive flow step.',
        status: stepStatusToTimeline(text(step?.status)),
        tone: toneValue(step?.tone),
        source: 'sensitive-flow',
      });
    }
  }

  const receiptCards = Array.isArray(input.visualReceipts?.cards) ? input.visualReceipts.cards.slice(0, 2) : [];
  for (const receipt of receiptCards) {
    events.push({
      id: `receipt:${text(receipt?.id) || events.length}`,
      label: text(receipt?.title) || 'Receipt',
      summary: text(receipt?.simpleText) || text(receipt?.subtitle) || 'Receipt evidence ready.',
      status: 'done',
      tone: toneValue(receipt?.tone),
      source: 'receipt',
    });
  }

  if (input.providerSelection) {
    events.push({
      id: 'provider:selection',
      label: 'Provider',
      summary: text(input.providerSelection?.selected?.providerId)
        ? `${text(input.providerSelection?.selected?.providerId)} selected by ${text(input.providerSelection?.decision) || 'projection'}.`
        : 'Provider selection is available as projection.',
      status: 'done',
      tone: input.providerSelection?.decision === 'blocked' ? 'danger' : input.providerSelection?.decision === 'use_now' ? 'ok' : 'info',
      source: 'provider',
    });
  }

  return events.slice(0, 10);
}

function buildActions(input: {
  run: Record<string, any> | null;
  sensitiveCard: Record<string, any> | null;
  visualReceipts: Record<string, any> | null;
  providerSelection: Record<string, any> | null;
}): ZavorthActiveMissionUxAction[] {
  const actions: ZavorthActiveMissionUxAction[] = [];
  if (input.run?.id) {
    actions.push({
      id: 'inspect-run',
      label: 'Inspect run',
      command: `zavorth runs inspect ${escapeCommandValue(text(input.run.id))}`,
      kind: 'inspect_run',
      requiresApproval: false,
      mutatesState: false,
      dashboardCanExecute: false,
    });
  }
  const sensitiveActions = Array.isArray(input.sensitiveCard?.actions) ? input.sensitiveCard.actions : [];
  for (const action of sensitiveActions.slice(0, 3)) {
    actions.push({
      id: `sensitive-${text(action?.id) || actions.length}`,
      label: text(action?.label) || 'Review',
      command: text(action?.command) || 'zavorth sensitive-flow --json',
      kind: sensitiveActionKind(text(action?.kind)),
      requiresApproval: Boolean(action?.requiresApproval),
      mutatesState: false,
      dashboardCanExecute: false,
    });
  }
  const receiptAction = Array.isArray(input.visualReceipts?.cards)
    ? input.visualReceipts.cards[0]?.actions?.[0]
    : null;
  if (receiptAction) {
    actions.push({
      id: 'inspect-receipts',
      label: 'Inspect receipts',
      command: text(receiptAction.command) || 'zavorth receipts',
      kind: 'inspect_receipts',
      requiresApproval: false,
      mutatesState: false,
      dashboardCanExecute: false,
    });
  }
  if (input.providerSelection) {
    actions.push({
      id: 'provider-status',
      label: 'Provider status',
      command: 'zavorth providers cockpit',
      kind: 'provider_status',
      requiresApproval: false,
      mutatesState: false,
      dashboardCanExecute: false,
    });
  }
  if (actions.length === 0) {
    actions.push({
      id: 'start-mission',
      label: 'Start mission',
      command: 'zavorth go',
      kind: 'inspect_run',
      requiresApproval: false,
      mutatesState: false,
      dashboardCanExecute: false,
    });
  }
  return actions.slice(0, 5);
}

function resolveStatus(input: {
  run: Record<string, any> | null;
  sensitiveCard: Record<string, any> | null;
}): ZavorthActiveMissionUxStatus {
  const sensitiveStatus = text(input.sensitiveCard?.status);
  if (sensitiveStatus === 'blocked' || sensitiveStatus === 'denied') return 'blocked';
  if (sensitiveStatus === 'needs_approval') return 'needs_approval';
  if (sensitiveStatus === 'dry_run_only') return 'dry_run';
  const runStatus = text(input.run?.status);
  if (runStatus === 'waiting_approval') return 'needs_approval';
  if (runStatus === 'running' || runStatus === 'thinking' || runStatus === 'queued') return 'running';
  if (runStatus === 'completed') return 'completed';
  if (runStatus === 'failed' || runStatus === 'cancelled') return 'blocked';
  return input.run ? 'running' : 'idle';
}

function nextActionForStatus(
  status: ZavorthActiveMissionUxStatus,
  counts: ZavorthActiveMissionUxSnapshot['counts'],
): string {
  if (status === 'needs_approval') return 'Review the pending approval before any live mutation.';
  if (status === 'dry_run') return 'Inspect preview and enable sandbox/approval before apply.';
  if (status === 'blocked') return 'Open the blocked step and resolve the policy or denial.';
  if (status === 'completed') return 'Inspect receipts and artifacts for the final evidence.';
  if (counts.timelineEvents <= 1) return 'Start a mission with zavorth go or a guided template.';
  return 'Continue monitoring the active mission timeline.';
}

function runStatusToTimeline(status: string): ZavorthActiveMissionUxTimelineEvent['status'] {
  if (status === 'completed') return 'done';
  if (status === 'failed' || status === 'cancelled') return 'blocked';
  if (status === 'running' || status === 'thinking') return 'running';
  return 'pending';
}

function eventStatusToTimeline(status: string): ZavorthActiveMissionUxTimelineEvent['status'] {
  if (status === 'done') return 'done';
  if (status === 'failed') return 'blocked';
  if (status === 'running') return 'running';
  return 'pending';
}

function stepStatusToTimeline(status: string): ZavorthActiveMissionUxTimelineEvent['status'] {
  if (status === 'done') return 'done';
  if (status === 'blocked') return 'blocked';
  return 'pending';
}

function toneForStatus(status: ZavorthActiveMissionUxStatus, blockers: number): ZavorthActiveMissionUxTone {
  if (status === 'blocked' || blockers > 0) return 'danger';
  if (status === 'needs_approval' || status === 'dry_run') return 'warn';
  if (status === 'completed') return 'ok';
  return 'info';
}

function runTone(status: string): ZavorthActiveMissionUxTone {
  if (status === 'completed') return 'ok';
  if (status === 'failed' || status === 'cancelled') return 'danger';
  if (status === 'waiting_approval') return 'warn';
  return 'info';
}

function eventStatusTone(status: string): ZavorthActiveMissionUxTone {
  if (status === 'done') return 'ok';
  if (status === 'failed') return 'danger';
  if (status === 'pending' || status === 'running') return 'warn';
  return 'info';
}

function sensitiveActionKind(value: string): ZavorthActiveMissionUxAction['kind'] {
  if (value === 'approve_once') return 'approve_once';
  if (value === 'deny') return 'deny';
  if (value === 'rollback') return 'rollback';
  if (value === 'inspect_receipt') return 'inspect_receipts';
  return 'inspect_preview';
}

function toneValue(value: unknown): ZavorthActiveMissionUxTone {
  const raw = text(value).toLowerCase();
  if (raw === 'ok' || raw === 'warn' || raw === 'danger') return raw;
  return 'info';
}

function asRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? redactText(value).trim() : '';
}

function escapeCommandValue(value: string): string {
  return redactText(value).replace(/["`$\\]/g, ' ').slice(0, 160);
}

function sanitizeSnapshot(snapshot: ZavorthActiveMissionUxSnapshot): ZavorthActiveMissionUxSnapshot {
  return sanitizeValue(snapshot) as ZavorthActiveMissionUxSnapshot;
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map((entry) => sanitizeValue(entry));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, sanitizeValue(entry)]),
  );
}

function redactText(value: string): string {
  return value
    .replace(/\b([A-Z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)[A-Z0-9_]*)\s*=\s*[^\s"'`]+/gi, '$1=[REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{4,}\b/g, '[REDACTED_SECRET]')
    .replace(/\b(?:ghp|github_pat|xoxb|xoxp|xoxa)-[A-Za-z0-9_-]{4,}\b/g, '[REDACTED_SECRET]');
}
