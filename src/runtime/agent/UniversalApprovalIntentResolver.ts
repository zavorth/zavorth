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
        reason: ref ? `No pending approval found for ${ref}.`
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
          'Several approvals are waiting. Pick one by number or tap its Approve/Reject button - you should not need a long id.',
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
      `Or reply ${verb} 1  -  ${verb} 2  - … (short number, not a long id).`,
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

  // Explicit slash only (deterministic tokens) - not free-text NLU.
  const slash = parseSlashApprovalCommand(normalized);
  if (slash) {
    return {
      decision: slash.decision,
      ref: explicitRef || slash.ref || null,
    };
  }

  // callback_data / structured control tokens (not chat free text).
  const callback = parseStructuredApprovalCallback(normalized);
  if (callback) {
    return {
      decision: callback.decision,
      ref: explicitRef || callback.ref,
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
  if (['rejected', 'reject'].includes(normalized)) {
    return 'rejected';
  }
  return null;
}

function inferSource(text: string | null | undefined): UniversalApprovalIntentSource {
  const normalized = normalizeText(text);
  if (normalized.startsWith('/approve') || normalized.startsWith('/reject')) {
    return 'slash-command';
  }
  if (parseStructuredApprovalCallback(normalized)) {
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
    // Short ordinal: /approve 1, /approve #2 - never force long UUID when listing is available.
    const ordinal = parseApprovalOrdinal(input.ref);
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
      return `${n}. ${title}  -  risk=${candidate.risk}  -  ${verb} ${n}`;
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
  const explicit = extractKeyedApprovalRef(raw);
  if (explicit) {
    return explicit;
  }
  for (const token of tokenizeApprovalRefText(raw)) {
    if (isUuidToken(token) || isPrefixedApprovalRef(token)) {
      return token;
    }
  }
  return null;
}

function parseSlashApprovalCommand(text: string): { decision: UniversalApprovalDecision; ref: string | null } | null {
  const trimmed = text.trim();
  const first = firstToken(trimmed);
  const command = first === '/approve' || first.startsWith('/approve@') ? '/approve'
    : first === '/reject' || first.startsWith('/reject@') ? '/reject'
      : null;
  if (!command) return null;
  const remainder = trimmed.slice(first.length).trim();
  return {
    decision: command === '/reject' ? 'rejected' : 'approved',
    ref: firstToken(remainder) || null,
  };
}

function parseStructuredApprovalCallback(text: string): { decision: UniversalApprovalDecision; ref: string } | null {
  const trimmed = text.trim();
  const parts = trimmed.split(':').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const decisionPart = parts[parts.length - 2];
  const ref = parts[parts.length - 1];
  const decision = normalizeDecision(decisionPart);
  const namespace = parts.slice(0, -2).join(':');
  if (!decision || !['approval', 'agent', 'run', 'task'].includes(namespace)) return null;
  return ref ? { decision, ref } : null;
}

function parseApprovalOrdinal(value: string): string | null {
  const text = value.startsWith('#') ? value.slice(1) : value;
  if (text.length < 1 || text.length > 2) return null;
  for (const char of text) {
    if (char < '0' || char > '9') return null;
  }
  return text;
}

function extractKeyedApprovalRef(raw: string): string | null {
  const normalized = raw.trim();
  for (const separator of [':', '=']) {
    const index = normalized.indexOf(separator);
    if (index <= 0) continue;
    const key = normalized.slice(0, index).trim().toLowerCase();
    if (!['approval', 'approvalid', 'run', 'runid', 'task', 'id'].includes(key)) continue;
    const value = firstToken(normalized.slice(index + 1));
    if (value.length >= 3) return value;
  }
  return null;
}

function firstToken(value: string): string {
  return tokenizeApprovalRefText(value)[0] || '';
}

function normalizeText(value: unknown): string {
  return collapseSpaces(
    String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD'),
  );
}

function tokenizeApprovalRefText(value: string): string[] {
  const tokens: string[] = [];
  let current = '';
  for (const char of String(value || '').trim()) {
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

function isUuidToken(value: string): boolean {
  const parts = value.toLowerCase().split('-');
  const expected = [8, 4, 4, 4, 12];
  return parts.length === expected.length && parts.every((part, index) =>
    part.length === expected[index] && Array.from(part).every(isHexChar));
}

function isPrefixedApprovalRef(value: string): boolean {
  const lower = value.toLowerCase();
  for (const prefix of ['approval', 'agent-run', 'run', 'task', 'ztx', 'perm']) {
    if (lower.startsWith(`${prefix}-`) || lower.startsWith(`${prefix}_`) || lower.startsWith(`${prefix}:`) || lower.startsWith(`${prefix}.`)) {
      return lower.length > prefix.length + 1 && Array.from(lower).every(isApprovalRefChar);
    }
  }
  return false;
}

function isApprovalRefChar(char: string): boolean {
  return isHexChar(char) || (char >= 'g' && char <= 'z') || char === '-' || char === '_' || char === ':' || char === '.';
}

function isHexChar(char: string): boolean {
  return (char >= '0' && char <= '9') || (char >= 'a' && char <= 'f');
}

function collapseSpaces(value: string): string {
  let output = '';
  let previousWasSpace = false;
  for (const char of value) {
    const isSpace = char === ' ' || char === '\t' || char === '\n' || char === '\r';
    if (isSpace) {
      if (!previousWasSpace) output += ' ';
      previousWasSpace = true;
      continue;
    }
    const code = char.charCodeAt(0);
    if (code >= 0x0300 && code <= 0x036f) {
      continue;
    }
    output += char;
    previousWasSpace = false;
  }
  return output.trim();
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
