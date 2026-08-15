export type DailyReturnContinuitySnapshot = {
  generatedAt: string;
  version: 'daily-return-continuity/v1';
  hasHistory: boolean;
  lastSessionId: string | null;
  lastSessionTitle: string | null;
  lastActivityAt: string | null;
  pendingApprovals: number;
  /** Short list of unfinished items from yesterday (product ritual, not launch R2). */
  pendingTasks: string[];
  nextAction: {
    kind: 'review-approval' | 'continue-session' | 'start-chat' | 'setup-provider' | 'resume-task';
    title: string;
    detail: string;
    command: string;
  };
  day1ReturnEligible: boolean;
};

export type DailyReturnContinuityInput = {
  now?: Date | string;
  sessions?: Array<{
    id: string;
    title?: string | null;
    updatedAt?: string | null;
    lastActivityAt?: string | null;
  }>;
  pendingApprovals?: number;
  /** Optional unfinished work items carried from last session. */
  pendingTasks?: string[];
  memoryDraftCount?: number;
  providerReady?: boolean;
  previousOpenAt?: string | null;
  currentOpenAt?: string | null;
};

export class DailyReturnContinuityService {
  public buildSnapshot(input: DailyReturnContinuityInput = {}): DailyReturnContinuitySnapshot {
    const now = input.now ? new Date(input.now) : new Date();
    const sessions = Array.isArray(input.sessions) ? input.sessions : [];
    const sorted = [...sessions].sort((left, right) => {
      const leftTs = Date.parse(String(left.lastActivityAt || left.updatedAt || 0)) || 0;
      const rightTs = Date.parse(String(right.lastActivityAt || right.updatedAt || 0)) || 0;
      return rightTs - leftTs;
    });
    const latest = sorted[0] || null;
    const pendingApprovals = Math.max(0, Number(input.pendingApprovals || 0));
    const providerReady = input.providerReady !== false;
    const previousOpenAt = input.previousOpenAt ? new Date(input.previousOpenAt) : null;
    const currentOpenAt = input.currentOpenAt ? new Date(input.currentOpenAt) : now;
    const day1ReturnEligible = Boolean(
      previousOpenAt
      && !Number.isNaN(previousOpenAt.getTime())
      && calendarDayKey(previousOpenAt) !== calendarDayKey(currentOpenAt)
      && (currentOpenAt.getTime() - previousOpenAt.getTime()) >= 12 * 60 * 60 * 1000
      && (currentOpenAt.getTime() - previousOpenAt.getTime()) <= 48 * 60 * 60 * 1000,
    );

    const pendingTasks = buildPendingTasks(input, latest, pendingApprovals);

    let nextAction: DailyReturnContinuitySnapshot['nextAction'];
    if (pendingApprovals > 0) {
      nextAction = {
        kind: 'review-approval',
        title: pendingApprovals === 1 ? '1 approval waiting' : `${pendingApprovals} approvals waiting`,
        detail: 'Decide before risky work continues.',
        command: 'zavorth approve',
      };
    } else if (!providerReady) {
      nextAction = {
        kind: 'setup-provider',
        title: 'Prove one provider',
        detail: 'Chat needs a live or local model route.',
        command: 'zavorth setup',
      };
    } else if (pendingTasks.length > 0) {
      nextAction = {
        kind: 'resume-task',
        title: pendingTasks[0],
        detail: pendingTasks.length === 1
          ? 'One unfinished item from last session.'
          : `${pendingTasks.length} unfinished items — primary next action first.`,
        command: 'zavorth open',
      };
    } else if (latest) {
      nextAction = {
        kind: 'continue-session',
        title: 'Continue where you left off',
        detail: latest.title?.trim() || `Session ${latest.id}`,
        command: 'zavorth open',
      };
    } else {
      nextAction = {
        kind: 'start-chat',
        title: 'Ready for a request',
        detail: 'Start in chat with a useful first ask.',
        command: 'zavorth open',
      };
    }

    return {
      generatedAt: now.toISOString(),
      version: 'daily-return-continuity/v1',
      hasHistory: Boolean(latest),
      lastSessionId: latest?.id || null,
      lastSessionTitle: latest?.title?.trim() || null,
      lastActivityAt: latest?.lastActivityAt || latest?.updatedAt || null,
      pendingApprovals,
      pendingTasks,
      nextAction,
      day1ReturnEligible,
    };
  }

  public renderText(snapshot: DailyReturnContinuitySnapshot): string {
    return [
      'Zavorth daily return',
      `history: ${snapshot.hasHistory ? 'yes' : 'no'}`,
      snapshot.lastSessionId ? `last session: ${snapshot.lastSessionId}` : 'last session: none',
      `pending approvals: ${snapshot.pendingApprovals}`,
      `next: ${snapshot.nextAction.title} (${snapshot.nextAction.command})`,
      `day-1 return eligible: ${snapshot.day1ReturnEligible ? 'yes' : 'no'}`,
    ].join('\n');
  }
}

function calendarDayKey(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
}

function buildPendingTasks(
  input: DailyReturnContinuityInput,
  latest: { id: string; title?: string | null } | null,
  pendingApprovals: number,
): string[] {
  const tasks: string[] = [];
  if (Array.isArray(input.pendingTasks)) {
    for (const entry of input.pendingTasks) {
      const text = String(entry || '').trim();
      if (text && !tasks.includes(text)) tasks.push(text);
    }
  }
  if (pendingApprovals > 0) {
    const approvalTask = pendingApprovals === 1
      ? 'Review 1 pending approval'
      : `Review ${pendingApprovals} pending approvals`;
    if (!tasks.includes(approvalTask)) tasks.unshift(approvalTask);
  }
  const drafts = Math.max(0, Number(input.memoryDraftCount || 0));
  if (drafts > 0) {
    const draftTask = drafts === 1
      ? 'Review 1 memory draft'
      : `Review ${drafts} memory drafts`;
    if (!tasks.includes(draftTask)) tasks.push(draftTask);
  }
  // Do not invent tasks from session title alone — that stays continue-session.
  return tasks.slice(0, 5);
}
