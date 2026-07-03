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
        reason: 'A mensagem nao parece uma aprovacao ou rejeicao.',
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
          ? `Nenhum approval pendente encontrado para ${ref}.`
          : 'Nenhum approval pendente inequívoco foi encontrado nesse contexto.',
      });
    }

    if (candidates.length > 1) {
      return resolution({
        status: 'ambiguous',
        decision: parsed.decision,
        ref,
        source,
        channel,
        userId: clean(input.userId),
        sessionId: clean(input.sessionId),
        target: null,
        candidates: candidates.map(toCandidate),
        reason: 'Ha mais de um approval pendente possivel para essa resposta.',
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
      bareNaturalText
      && parsed.decision === 'approved'
      && target.approval.risk === 'danger'
      && input.allowBareDangerApproval !== true
      && !bareTextIsScopedToTarget
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
        reason: 'Approval de risco danger precisa de contexto identico, referencia explicita, botao autenticado, PIN ou frase de confirmacao.',
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
      reason: parsed.decision === 'approved'
        ? 'Approval resolvido com contexto suficiente.'
        : 'Rejeicao resolvida com contexto suficiente.',
    });
  }
}

export function renderUniversalApprovalIntentDecisionResult(
  result: UniversalApprovalIntentDecisionResult,
): string {
  if (result.ok && result.result) {
    const decisionLabel = result.result.decision === 'approved' ? 'Aprovado' : 'Rejeitado';
    const reply = result.result.replies[0]?.text || result.result.run.summary || result.resolution.reason;
    return `${decisionLabel}. ${reply}`.trim();
  }

  if (result.resolution.status === 'ambiguous') {
    return [
      result.resolution.reason,
      'Use um botao especifico ou informe o ID:',
      renderApprovalCandidates(result.resolution.candidates),
    ].filter(Boolean).join('\n');
  }

  if (result.resolution.status === 'confirmation_required') {
    return [
      result.resolution.reason,
      result.resolution.commandHint ? `Confirmacao explicita: ${result.resolution.commandHint}` : null,
    ].filter(Boolean).join('\n');
  }

  return result.error || result.resolution.reason;
}

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

  const slashApprove = normalized.match(/^\/?(approve|aprovar|aprova)\s+(.+)$/i);
  if (slashApprove?.[2]) {
    return { decision: 'approved', ref: explicitRef || firstToken(slashApprove[2]) };
  }
  const slashReject = normalized.match(/^\/?(reject|rejeitar|rejeite|negar|nega)\s+(.+)$/i);
  if (slashReject?.[2]) {
    return { decision: 'rejected', ref: explicitRef || firstToken(slashReject[2]) };
  }

  const callback = normalized.match(/\b(?:approval|agent|run|task):?(approve|reject|aprovar|rejeitar):([a-z0-9._:-]+)/i);
  if (callback?.[1] && callback[2]) {
    return {
      decision: normalizeDecision(callback[1]),
      ref: explicitRef || callback[2],
    };
  }

  const inferredRef = explicitRef || extractApprovalRef(text);
  const approve =
    /\b(aprovo|aprovado|aprovar|aprova|aprove|approve|autorizo|autorizar|autorize|libero|liberar|libere)\b/.test(normalized)
    || /\b(pode continuar|pode seguir|pode prosseguir|pode fazer|pode executar|vai em frente|segue|seguir|prossiga|continue|continuar)\b/.test(normalized)
    || isBareAffirmation(normalized);
  if (approve) {
    return { decision: 'approved', ref: inferredRef };
  }

  const reject =
    /\b(rejeito|rejeitar|rejeite|reject|nego|negar|negue|nao aprovo|não aprovo|cancela|cancelar|pare|stop)\b/.test(normalized)
    || isBareRejection(normalized);
  if (reject) {
    return { decision: 'rejected', ref: inferredRef };
  }

  return { decision: null, ref: inferredRef };
}

function normalizeDecision(value: UniversalApprovalIntentResolveInput['decision'] | string | null | undefined): UniversalApprovalDecision | null {
  const normalized = normalizeText(value);
  if (['approved', 'approve', 'aprovar', 'aprova'].includes(normalized)) {
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
    run.approvals
      .filter((approval) => approval.status === 'pending')
      .map((approval) => ({ run, approval })),
  );
}

function selectCandidates(input: {
  pending: PendingTarget[];
  ref: string | null;
  userId: string | null;
  sessionId: string | null;
  channel: UniversalApprovalIntentChannel;
}): PendingTarget[] {
  if (input.ref) {
    return input.pending.filter(({ run, approval }) =>
      approval.id === input.ref || approval.runId === input.ref || run.id === input.ref,
    );
  }

  const sameSession = input.sessionId
    ? input.pending.filter(({ run }) => run.sessionId === input.sessionId)
    : [];
  if (sameSession.length > 0) {
    return sameSession;
  }

  const sameUser = input.userId
    ? input.pending.filter(({ run }) => run.userId === input.userId)
    : [];
  if (sameUser.length > 0) {
    return sameUser;
  }

  const sameChannel = input.channel && input.channel !== 'unknown' && input.channel !== 'zavorthControl'
    ? input.pending.filter(({ run }) => run.channel === input.channel)
    : [];
  return sameChannel;
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

function renderApprovalCandidates(candidates: UniversalApprovalIntentCandidate[]): string {
  return candidates
    .slice(0, 5)
    .map((candidate) => `- ${candidate.approvalId}: ${candidate.title} (${candidate.risk})`)
    .join('\n');
}

function resolution(input: Omit<UniversalApprovalIntentResolution, 'commandHint'> & { commandHint?: string | null }): UniversalApprovalIntentResolution {
  const candidate = input.candidates[0] || null;
  const commandHint = candidate
    ? `${input.decision === 'rejected' ? '/reject' : '/approve'} ${candidate.approvalId}`
    : input.ref
      ? `${input.decision === 'rejected' ? '/reject' : '/approve'} ${input.ref}`
      : null;
  return {
    ...input,
    commandHint: input.commandHint ?? commandHint,
  };
}

function extractApprovalRef(text: string | null | undefined): string | null {
  const raw = String(text || '').trim();
  const explicit = raw.match(/\b(?:approval|approvalid|run|runid|task|tarefa|id)\s*[:=]?\s*([a-z0-9][a-z0-9._:-]{2,})\b/i)?.[1];
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

function isBareAffirmation(normalized: string): boolean {
  return /^(sim|ok|okay|beleza|feito|pode|autorizado|aprovado|aprovo|continue|segue|prossiga)(\.|!)*$/.test(normalized);
}

function isBareRejection(normalized: string): boolean {
  return /^(nao|não|negado|rejeito|cancela|cancelar|pare|stop)(\.|!)*$/.test(normalized);
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
  const sameChannel = input.channel === 'zavorthControl'
    || input.channel === 'unknown'
    || input.target.run.channel === input.channel;
  return sameSession && sameUser && sameChannel;
}
