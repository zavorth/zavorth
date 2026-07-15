import type {
  UniversalAgentApprovalDecisionResult,
  UniversalAgentChannel,
  UniversalAgentRun,
  UniversalApprovalDecision,
  UniversalApprovalRequest,
} from './UniversalAgentRuntimeTypes.js';

export type UniversalApprovalIntentSource =
  | 'button'
  | 'text'
  | 'slash-command'
  | 'zavorthControl'
  | 'api'
  | 'callback'
  | 'unknown';

export type UniversalApprovalIntentChannel =
  | UniversalAgentChannel
  | 'zavorthControl'
  | 'whatsapp'
  | 'slack'
  | 'teams'
  | 'unknown';

export type UniversalApprovalIntentResolveInput = {
  text?: string | null;
  ref?: string | null;
  decision?: UniversalApprovalDecision | 'approve' | 'reject' | null;
  source?: UniversalApprovalIntentSource;
  channel?: UniversalApprovalIntentChannel;
  userId?: string | null;
  sessionId?: string | null;
  allowBareDangerApproval?: boolean;
  runs: UniversalAgentRun[];
};

export type UniversalApprovalIntentCandidate = {
  runId: string;
  approvalId: string;
  userId: string;
  sessionId: string;
  channel: UniversalAgentChannel;
  title: string;
  risk: UniversalApprovalRequest['risk'];
  createdAt: string;
};

export type UniversalApprovalIntentStatus =
  | 'not_approval_intent'
  | 'resolved'
  | 'not_found'
  | 'ambiguous'
  | 'confirmation_required';

export type UniversalApprovalIntentResolution = {
  status: UniversalApprovalIntentStatus;
  decision: UniversalApprovalDecision | null;
  ref: string | null;
  source: UniversalApprovalIntentSource;
  channel: UniversalApprovalIntentChannel;
  userId: string | null;
  sessionId: string | null;
  target: { run: UniversalAgentRun; approval: UniversalApprovalRequest } | null;
  candidates: UniversalApprovalIntentCandidate[];
  reason: string;
  commandHint: string | null;
};

export type UniversalApprovalIntentDecisionResult = {
  ok: boolean;
  resolution: UniversalApprovalIntentResolution;
  result: UniversalAgentApprovalDecisionResult | null;
  error: string | null;
};

type PendingTarget = {
  run: UniversalAgentRun;
  approval: UniversalApprovalRequest;
};

export class UniversalApprovalIntentResolver {
  public resolve(input: UniversalApprovalIntentResolveInput): UniversalApprovalIntentResolution {
    const source = input.source ?? inferSource(input.text);
    const channel = input.channel ?? 'unknown';
    const parsed = parseApprovalIntent(input.text, input.decision, input.ref);
    if (!parsed.decision) {
      return resolution({
        status: 'not_approval_intent',
        decision: null,
        ref: parsed.ref,
        source,
        channel,
        userId: clean(input.userId),
        sessionId: clean(input.sessionId),
        target: null,
        candidates: [],
        reason: 'Message does not look like an approval or rejection.',
      });
    }

    const pending = collectPendingTargets(input.runs);
    const ref = parsed.ref;
    const candidates = selectCandidates({
      pending,
      ref,
      userId: clean(input.userId),
      sessionId: clean(input.sessionId),
      channel,
    });

    if (candidates.length === 0) {
      return resolution({
        status: 'not_found',
        decision: parsed.decision,
        ref,
        source,
        channel,
        userId: clean(input.userId),
        sessionId: clean(input.sessionId),
        target: null,
        candidates: [],
        reason: ref
          ? `No pending approval found for ${ref}.`
          : 'No unambiguous pending approval was found in this context.',
      });
    }

    if (candidates.length > 1) {
      const listed = candidates.map(toCandidate);
      return resolution({
        status: 'ambiguous',
        decision: parsed.decision,
        ref,
        source,
        channel,
        userId: clean(input.userId),
        sessionId: clean(input.sessionId),
        target: null,
        candidates: listed,
        reason:
          'Several approvals are waiting. Pick one by number or tap its Approve/Reject button — you should not need a long id.',
        commandHint: listed.length
          ? `${parsed.decision === 'rejected' ? '/reject' : '/approve'} 1  (or 2…${Math.min(listed.length, 9)})`
          : null,
      });
    }

    const target = candidates[0];
    const explicitRef = Boolean(ref);
    const bareNaturalText = !explicitRef && source === 'text';
    const bareTextIsScopedToTarget = isScopedBareTextApproval({
      target,
      userId: clean(input.userId),
      sessionId: clean(input.sessionId),
      channel,
    });
    if (
      bareNaturalText &&
      parsed.decision === 'approved' &&
      target.approval.risk === 'danger' &&
      input.allowBareDangerApproval !== true &&
      !bareTextIsScopedToTarget
    ) {
      return resolution({
        status: 'confirmation_required',
        decision: parsed.decision,
        ref,
        source,
        channel,
        userId: clean(input.userId),
        sessionId: clean(input.sessionId),
        target: null,
        candidates: candidates.map(toCandidate),
        reason:
          'Danger-risk approval needs matching context, an explicit reference, authenticated button, PIN, or confirmation phrase.',
      });
    }

    return resolution({
      status: 'resolved',
      decision: parsed.decision,
      ref: ref || target.approval.id,
      source,
      channel,
      userId: clean(input.userId),
      sessionId: clean(input.sessionId),
      target,
      candidates: [toCandidate(target)],
      reason:
        parsed.decision === 'approved'
          ? 'Approval resolved with sufficient context.'
          : 'Rejection resolved with sufficient context.',
    });
  }
}

export function renderUniversalApprovalIntentDecisionResult(result: UniversalApprovalIntentDecisionResult): string {
  if (result.ok && result.result) {
    const decisionLabel = result.result.decision === 'approved' ? 'Approved' : 'Rejected';
    const reply = result.result.replies[0]?.text || result.result.run.summary || result.resolution.reason;
    return `${decisionLabel}. ${reply}`.trim();
  }

  if (result.resolution.status === 'ambiguous') {
    const verb = result.resolution.decision === 'rejected' ? '/reject' : '/approve';
    return [
      result.resolution.reason,
      '',
      'Pick one:',
      renderApprovalCandidates(result.resolution.candidates, verb),
      '',
      'Best UX: tap the Approve/Reject button on the matching card.',
      `Or reply ${verb} 1  ·  ${verb} 2  · … (short number, not a long id).`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (result.resolution.status === 'confirmation_required') {
    return [
      result.resolution.reason,
      result.resolution.commandHint ? `Explicit confirmation: ${result.resolution.commandHint}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  return result.error || result.resolution.reason;
}

/**
 * Agent-first: free-text phrase dictionaries do not activate approvals.
 * Only structured decision fields, explicit slash tokens, or callback_data forms.
 */
function parseApprovalIntent(
  text: string | null | undefined,
  decision: UniversalApprovalIntentResolveInput['decision'],
  ref: string | null | undefined,
): { decision: UniversalApprovalDecision | null; ref: string | null } {
  const explicitDecision = normalizeDecision(decision);
  const explicitRef = clean(ref);
  if (explicitDecision) {
    return {
      decision: explicitDecision,
      ref: explicitRef || extractApprovalRef(text),
    };
  }

  const normalized = normalizeText(text);
  if (!normalized) {
    return { decision: null, ref: explicitRef };
  }

  // Explicit slash only (deterministic tokens) — not free-text NLU.
  const slashApprove = normalized.match(/^\/(approve|aprovar|aprova)(?:\s+(.+))?$/i);
  if (slashApprove) {
    return {
      decision: 'approved',
      ref: explicitRef || firstToken(slashApprove[2] || '') || null,
    };
  }
  const slashReject = normalized.match(/^\/(reject|rejeitar|rejeite|negar|nega)(?:\s+(.+))?$/i);
  if (slashReject) {
    return {
      decision: 'rejected',
      ref: explicitRef || firstToken(slashReject[2] || '') || null,
    };
  }

  // callback_data / structured control tokens (not chat free text).
  const callback = normalized.match(
    /\b(?:approval|agent|run|task):?(approve|reject|aprovar|rejeitar):([a-z0-9._:-]+)/i,
  );
  if (callback?.[1] && callback[2]) {
    return {
      decision: normalizeDecision(callback[1]),
      ref: explicitRef || callback[2],
    };
  }

  // Free text never keyword-routes into approve/reject; agent owns the turn.
  return { decision: null, ref: explicitRef || extractApprovalRef(text) };
}

function normalizeDecision(
  value: UniversalApprovalIntentResolveInput['decision'] | string | null | undefined,
): UniversalApprovalDecision | null {
  const normalized = normalizeText(value);
  if (['approved', 'approve', 'allow'].includes(normalized)) {
    return 'approved';
  }
  if (['rejected', 'reject', 'rejeitar', 'rejeite', 'negar'].includes(normalized)) {
    return 'rejected';
  }
  return null;
}

function inferSource(text: string | null | undefined): UniversalApprovalIntentSource {
  const normalized = normalizeText(text);
  if (normalized.startsWith('/approve') || normalized.startsWith('/reject')) {
    return 'slash-command';
  }
  if (/\b(?:approval|agent|run|task):?(approve|reject|aprovar|rejeitar):/i.test(String(text || ''))) {
    return 'callback';
  }
  return 'text';
}

function collectPendingTargets(runs: UniversalAgentRun[]): PendingTarget[] {
  return runs.flatMap((run) =>
    run.approvals.filter((approval) => approval.status === 'pending').map((approval) => ({ run, approval })),
  );
}

function scopedPending(input: {
  pending: PendingTarget[];
  userId: string | null;
  sessionId: string | null;
  channel: UniversalApprovalIntentChannel;
}): PendingTarget[] {
  const sameSession = input.sessionId ? input.pending.filter(({ run }) => run.sessionId === input.sessionId) : [];
  if (sameSession.length > 0) return sameSession;

  const sameUser = input.userId ? input.pending.filter(({ run }) => run.userId === input.userId) : [];
  if (sameUser.length > 0) return sameUser;

  const sameChannel =
    input.channel && input.channel !== 'unknown' && input.channel !== 'zavorthControl'
      ? input.pending.filter(({ run }) => run.channel === input.channel)
      : [];
  return sameChannel.length > 0 ? sameChannel : input.pending;
}

/**
 * Sort pending approvals newest-first so /approve 1 is stable and human-friendly.
 */
function sortPendingNewestFirst(pending: PendingTarget[]): PendingTarget[] {
  return [...pending].sort((a, b) =>
    String(b.approval.createdAt || '').localeCompare(String(a.approval.createdAt || '')),
  );
}

function selectCandidates(input: {
  pending: PendingTarget[];
  ref: string | null;
  userId: string | null;
  sessionId: string | null;
  channel: UniversalApprovalIntentChannel;
}): PendingTarget[] {
  const scoped = sortPendingNewestFirst(scopedPending(input));

  if (input.ref) {
    // Short ordinal: /approve 1, /approve #2 — never force long UUID when listing is available.
    const ordinal = input.ref.match(/^#?(\d{1,2})$/)?.[1];
    if (ordinal) {
      const index = Number(ordinal) - 1;
      if (Number.isFinite(index) && index >= 0 && index < scoped.length) {
        return [scoped[index]];
      }
      return [];
    }
    return input.pending.filter(
      ({ run, approval }) => approval.id === input.ref || approval.runId === input.ref || run.id === input.ref,
    );
  }

  return scoped;
}

function toCandidate(target: PendingTarget): UniversalApprovalIntentCandidate {
  return {
    runId: target.run.id,
    approvalId: target.approval.id,
    userId: target.run.userId,
    sessionId: target.run.sessionId,
    channel: target.run.channel,
    title: target.approval.title,
    risk: target.approval.risk,
    createdAt: target.approval.createdAt,
  };
}

function renderApprovalCandidates(candidates: UniversalApprovalIntentCandidate[], verb = '/approve'): string {
  return candidates
    .slice(0, 9)
    .map((candidate, index) => {
      const n = index + 1;
      const title = String(candidate.title || 'Approval').slice(0, 80);
      return `${n}. ${title}  ·  risk=${candidate.risk}  ·  ${verb} ${n}`;
    })
    .join('\n');
}

function resolution(
  input: Omit<UniversalApprovalIntentResolution, 'commandHint'> & { commandHint?: string | null },
): UniversalApprovalIntentResolution {
  const candidate = input.candidates[0] || null;
  const multi = input.candidates.length > 1;
  const verb = input.decision === 'rejected' ? '/reject' : '/approve';
  const commandHint = multi ? `${verb} 1` : candidate ? `${verb}` : input.ref ? `${verb} ${input.ref}` : null;
  return {
    ...input,
    commandHint: input.commandHint ?? commandHint,
  };
}

function extractApprovalRef(text: string | null | undefined): string | null {
  const raw = String(text || '').trim();
  const explicit = raw.match(
    /\b(?:approval|approvalid|run|runid|task|tarefa|id)\s*[:=]?\s*([a-z0-9][a-z0-9._:-]{2})\b/i,
  )?.[1];
  if (explicit) {
    return explicit;
  }
  const uuid = raw.match(/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i)?.[1];
  if (uuid) {
    return uuid;
  }
  const prefixed = raw.match(/\b((?:approval|agent-run|run|task|ztx|perm)[-_:.][a-z0-9._:-]+)\b/i)?.[1];
  return prefixed || null;
}

function firstToken(value: string): string {
  return value.trim().split(/\s+/).filter(Boolean)[0] || '';
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function clean(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function isScopedBareTextApproval(input: {
  target: PendingTarget;
  userId: string | null;
  sessionId: string | null;
  channel: UniversalApprovalIntentChannel;
}): boolean {
  const sameSession = Boolean(input.sessionId && input.target.run.sessionId === input.sessionId);
  const sameUser = !input.userId || input.target.run.userId === input.userId;
  const sameChannel =
    input.channel === 'zavorthControl' || input.channel === 'unknown' || input.target.run.channel === input.channel;
  return sameSession && sameUser && sameChannel;
}
