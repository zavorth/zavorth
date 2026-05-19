import {
  AI_FIRST_ROUTE_ACTION_KINDS,
  AI_FIRST_ROUTE_NEXT_SAFE_ACTIONS,
  AI_FIRST_ROUTE_PLAN_AUDIENCES,
  AI_FIRST_ROUTE_PLAN_CONTRACT_VERSION,
  AI_FIRST_ROUTE_PLAN_INTENTS,
  AI_FIRST_ROUTE_PLAN_RISKS,
  AI_FIRST_ROUTE_PLAN_SIDE_EFFECTS,
  type AiFirstRouteAction,
  type AiFirstRouteActionKind,
  type AiFirstRouteNextSafeAction,
  type AiFirstRoutePlan,
  type AiFirstRoutePlanAudience,
  type AiFirstRoutePlanIntent,
  type AiFirstRoutePlanNormalizationInput,
  type AiFirstRoutePlanNormalizationResult,
  type AiFirstRoutePlanReceipt,
  type AiFirstRoutePlanRisk,
  type AiFirstRoutePlanSideEffect,
  type AiFirstRouteQuestion,
  type AiFirstRouteRiskNote,
  type AiFirstRouteTarget,
} from '../contracts/AiFirstRoutePlanContract.js';

type AiFirstRoutePlanContractRuntime = {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
};

type DiagnosticsDraft = {
  warnings: string[];
  errors: string[];
};

type ReceiptDraft = AiFirstRoutePlanReceipt[];

type RawRecord = Record<string, unknown>;

const DEFAULT_LANGUAGE = 'en-US';
const DEFAULT_SURFACE = 'conversation';
const REDACTED_SECRET = '[redacted-secret]';

const RISK_RANK: Record<AiFirstRoutePlanRisk, number> = {
  safe: 0,
  attention: 1,
  danger: 2,
};

const SIDE_EFFECT_RISK: Record<AiFirstRoutePlanSideEffect, AiFirstRoutePlanRisk> = {
  none: 'safe',
  'local-read': 'safe',
  network: 'attention',
  'local-write': 'attention',
  command: 'danger',
  'external-send': 'danger',
  destructive: 'danger',
};

export class AiFirstRoutePlanContractService {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private sequence = 0;

  constructor(runtime: AiFirstRoutePlanContractRuntime = {}) {
    this.now = runtime.now ?? (() => new Date());
    this.idFactory = runtime.idFactory ?? ((prefix) => `${prefix}-${this.now().getTime().toString(36)}-${++this.sequence}`);
  }

  normalize(input: AiFirstRoutePlanNormalizationInput = {}): AiFirstRoutePlanNormalizationResult {
    const diagnostics: DiagnosticsDraft = { warnings: [], errors: [] };
    const receipts: ReceiptDraft = [
      {
        id: this.idFactory('receipt'),
        kind: 'normalization',
        detail: 'AI-first route proposal normalized before policy or execution.',
      },
    ];

    const originalUserMessage = stringOr(input.userMessage, '');
    const redactedUserMessage = redactSensitiveText(originalUserMessage);
    if (redactedUserMessage !== originalUserMessage) {
      receipts.push({
        id: this.idFactory('receipt'),
        kind: 'redaction',
        detail: 'Sensitive values were removed from the captured user message.',
      });
    }

    const rawPlanRecord = recordOrNull(input.rawPlan);
    const hasRawPlan = input.rawPlan !== undefined && input.rawPlan !== null;
    if (hasRawPlan && !rawPlanRecord) {
      diagnostics.errors.push('raw-plan-not-an-object');
    }

    if (!rawPlanRecord || Object.keys(rawPlanRecord).length === 0) {
      diagnostics.warnings.push('ai-plan-missing-or-empty');
    }

    const audienceRecord = recordOrNull(rawPlanRecord?.audience);
    const intentRecord = recordOrNull(rawPlanRecord?.intent);
    const goalRecord = recordOrNull(rawPlanRecord?.goal);
    const responseRecord = recordOrNull(rawPlanRecord?.response);

    const audienceLevel = normalizeLiteral<AiFirstRoutePlanAudience>(
      firstDefined(audienceRecord?.level, rawPlanRecord?.audienceLevel, rawPlanRecord?.audience),
      AI_FIRST_ROUTE_PLAN_AUDIENCES,
      'guided',
    );
    const hideTechnicalJargon = booleanOr(audienceRecord?.hideTechnicalJargon, audienceLevel !== 'technical');
    const explainBeforeActing = booleanOr(audienceRecord?.explainBeforeActing, true);

    const intent = normalizeLiteral<AiFirstRoutePlanIntent>(
      firstDefined(intentRecord?.primary, rawPlanRecord?.intent),
      AI_FIRST_ROUTE_PLAN_INTENTS,
      inferIntentFromText(redactedUserMessage),
    );
    const confidence = clampConfidence(firstDefined(intentRecord?.confidence, rawPlanRecord?.confidence), 0.5);
    const assumptions = uniqueStrings(collectStrings(firstDefined(intentRecord?.assumptions, rawPlanRecord?.assumptions)))
      .map(redactSensitiveText);
    const intentSummary = safeText(
      firstString(intentRecord?.summary, rawPlanRecord?.intentSummary, summarizeIntent(intent, redactedUserMessage)),
      'Pedido natural recebido pelo Zavorth.',
    );

    const goalUserFacing = safeText(
      firstString(goalRecord?.userFacing, rawPlanRecord?.goal, redactedUserMessage, 'Entender o pedido do usuario.'),
      'Entender o pedido do usuario.',
    );
    const goalInternalSummary = safeText(
      firstString(goalRecord?.internalSummary, rawPlanRecord?.internalSummary, intentSummary),
      intentSummary,
    );

    const missingInformation = this.normalizeMissingInformation(rawPlanRecord, diagnostics);
    const proposedActions = this.normalizeActions(rawPlanRecord, intent, diagnostics);
    const requestedTools = uniqueStrings([
      ...collectStrings(rawPlanRecord?.requestedTools).map(redactSensitiveText),
      ...proposedActions.flatMap((action) => action.requestedToolIds),
    ]);

    if (missingInformation.length === 0 && proposedActions.length === 0) {
      proposedActions.push(this.buildClarificationAction(diagnostics));
      diagnostics.warnings.push('ai-plan-had-no-actions');
    }

    const sideEffects = uniqueStrings(proposedActions.map((action) => action.sideEffect)) as AiFirstRoutePlanSideEffect[];
    const actionRisk = maxRisk(proposedActions.map((action) => action.risk));
    const explicitRisk = normalizeLiteral<AiFirstRoutePlanRisk>(
      firstDefined(recordOrNull(rawPlanRecord?.risk)?.level, rawPlanRecord?.risk),
      AI_FIRST_ROUTE_PLAN_RISKS,
      actionRisk,
    );
    const riskLevel = maxRisk([explicitRisk, actionRisk]);
    const riskNotes = this.buildRiskNotes(riskLevel, sideEffects, proposedActions);

    const requiresApproval = proposedActions.some((action) => action.requiresApproval);
    const requiresPreview = proposedActions.some((action) => action.requiresPreview);
    const nextSafeAction = chooseNextSafeAction({
      missingInformation,
      proposedActions,
      requiresApproval,
      requiresPreview,
      riskLevel,
    });
    const approvalReason = requiresApproval
      ? 'A proposta envolve mudanca, comando, envio externo ou risco que precisa de aprovacao explicita.'
      : null;

    if (requiresApproval || requiresPreview) {
      receipts.push({
        id: this.idFactory('receipt'),
        kind: 'policy',
        detail: 'The normalized plan is preview/approval gated and cannot execute itself.',
      });
    }

    const nextReply = safeText(
      firstString(
        responseRecord?.nextReply,
        responseRecord?.userFacingSummary,
        buildDefaultReply(nextSafeAction, goalUserFacing),
      ),
      buildDefaultReply(nextSafeAction, goalUserFacing),
    );

    const normalized: AiFirstRoutePlan = {
      contractVersion: AI_FIRST_ROUTE_PLAN_CONTRACT_VERSION,
      source: 'ai-first-route-plan',
      planId: this.idFactory('plan'),
      generatedAt: this.now().toISOString(),
      input: {
        surface: safeText(input.surface, DEFAULT_SURFACE),
        userMessage: redactedUserMessage,
        rawMessageStored: false,
        language: safeText(input.language, DEFAULT_LANGUAGE),
      },
      audience: {
        level: audienceLevel,
        explainBeforeActing,
        hideTechnicalJargon,
      },
      intent: {
        primary: intent,
        confidence,
        summary: intentSummary,
        assumptions,
      },
      goal: {
        userFacing: goalUserFacing,
        internalSummary: goalInternalSummary,
      },
      missingInformation,
      proposedActions,
      requestedTools,
      risk: {
        level: riskLevel,
        sideEffects,
        notes: riskNotes,
      },
      policy: {
        requiresApproval,
        requiresPreview,
        canExecuteNow: false,
        approvalReason,
        nextSafeAction,
        planCannotAuthorizeExecution: true,
        naturalLanguageDoesNotBypassPolicy: true,
      },
      response: {
        style: audienceLevel,
        userFacingSummary: safeText(
          firstString(responseRecord?.userFacingSummary, goalUserFacing),
          goalUserFacing,
        ),
        nextReply,
      },
      receipts,
      diagnostics,
    };

    const accepted = diagnostics.errors.length === 0 && !diagnostics.warnings.includes('ai-plan-missing-or-empty');
    return { normalized, accepted };
  }

  renderMarkdown(result: AiFirstRoutePlanNormalizationResult): string {
    const plan = result.normalized;
    const lines: string[] = [];
    lines.push('# Zavorth AI-first Router Intent model');
    lines.push('');
    lines.push(`- status: ${result.accepted ? 'accepted' : 'fallback'}`);
    lines.push(`- contract: ${plan.contractVersion}`);
    lines.push(`- intent: ${plan.intent.primary} (${plan.intent.confidence.toFixed(2)})`);
    lines.push(`- audience: ${plan.audience.level}`);
    lines.push(`- risk: ${plan.risk.level}`);
    lines.push(`- nextSafeAction: ${plan.policy.nextSafeAction}`);
    lines.push(`- requiresApproval: ${String(plan.policy.requiresApproval)}`);
    lines.push(`- requiresPreview: ${String(plan.policy.requiresPreview)}`);
    lines.push(`- canExecuteNow: ${String(plan.policy.canExecuteNow)}`);
    lines.push('');
    lines.push('## Proposed actions');
    for (const action of plan.proposedActions) {
      lines.push(`- ${action.id}: ${action.kind} / ${action.sideEffect} / ${action.risk} - ${action.summary}`);
    }
    if (plan.missingInformation.length > 0) {
      lines.push('');
      lines.push('## Missing information');
      for (const question of plan.missingInformation) {
        lines.push(`- ${question.id}: ${question.prompt}`);
      }
    }
    if (plan.diagnostics.warnings.length > 0 || plan.diagnostics.errors.length > 0) {
      lines.push('');
      lines.push('## Diagnostics');
      for (const warning of plan.diagnostics.warnings) {
        lines.push(`- warning: ${warning}`);
      }
      for (const error of plan.diagnostics.errors) {
        lines.push(`- error: ${error}`);
      }
    }
    return lines.join('\n');
  }

  private normalizeMissingInformation(rawPlanRecord: RawRecord | null, diagnostics: DiagnosticsDraft): AiFirstRouteQuestion[] {
    const rawQuestions = firstDefined(rawPlanRecord?.missingInformation, rawPlanRecord?.questions);
    const values = Array.isArray(rawQuestions) ? rawQuestions : [];
    const questions = values.map((value, index) => {
      const record = recordOrNull(value);
      const prompt = safeText(firstString(record?.prompt, record?.question, value), 'Qual detalhe falta para continuar?');
      return {
        id: safeId(firstString(record?.id, `missing-${index + 1}`), `missing-${index + 1}`),
        prompt,
        reason: safeText(firstString(record?.reason, 'Informacao necessaria para evitar suposicao.'), 'Informacao necessaria.'),
        required: booleanOr(record?.required, true),
      };
    });

    const seenPrompts = new Set<string>();
    const unique = questions.filter((question) => {
      const key = question.prompt.toLowerCase();
      if (seenPrompts.has(key)) {
        return false;
      }
      seenPrompts.add(key);
      return true;
    });

    if (!Array.isArray(rawQuestions) && rawQuestions !== undefined) {
      diagnostics.warnings.push('missing-information-ignored-non-array');
    }
    return unique;
  }

  private normalizeActions(
    rawPlanRecord: RawRecord | null,
    intent: AiFirstRoutePlanIntent,
    diagnostics: DiagnosticsDraft,
  ): AiFirstRouteAction[] {
    const rawActions = firstDefined(rawPlanRecord?.proposedActions, rawPlanRecord?.actions, rawPlanRecord?.steps);
    const values = Array.isArray(rawActions) ? rawActions : [];
    if (!Array.isArray(rawActions) && rawActions !== undefined) {
      diagnostics.warnings.push('actions-ignored-non-array');
    }

    return values.map((value, index) => this.normalizeAction(value, index, intent));
  }

  private normalizeAction(value: unknown, index: number, intent: AiFirstRoutePlanIntent): AiFirstRouteAction {
    const record = recordOrNull(value);
    const label = safeText(firstString(record?.label, record?.title, `Acao ${index + 1}`), `Acao ${index + 1}`);
    const summary = safeText(firstString(record?.summary, record?.description, record?.command, label), label);
    const requestedToolIds = uniqueStrings(collectStrings(firstDefined(record?.requestedToolIds, record?.tools, record?.tool)))
      .map(redactSensitiveText);
    const kind = normalizeLiteral<AiFirstRouteActionKind>(
      firstDefined(record?.kind, record?.type),
      AI_FIRST_ROUTE_ACTION_KINDS,
      inferActionKind(summary, requestedToolIds, intent),
    );
    const explicitSideEffect = normalizeLiteral<AiFirstRoutePlanSideEffect>(
      record?.sideEffect,
      AI_FIRST_ROUTE_PLAN_SIDE_EFFECTS,
      inferSideEffect(kind, summary, requestedToolIds),
    );
    const sideEffect = destructiveText(summary) ? 'destructive' : explicitSideEffect;
    const explicitRisk = normalizeLiteral<AiFirstRoutePlanRisk>(
      record?.risk,
      AI_FIRST_ROUTE_PLAN_RISKS,
      SIDE_EFFECT_RISK[sideEffect],
    );
    const risk = maxRisk([explicitRisk, SIDE_EFFECT_RISK[sideEffect]]);
    const requiresApproval = record?.requiresApproval === true || actionRequiresApproval(kind, sideEffect, risk);
    const requiresPreview = record?.requiresPreview === true || actionRequiresPreview(kind, sideEffect, requiresApproval);
    const target = normalizeTarget(record?.target);
    const rawPayload = firstDefined(record?.payloadPreview, record?.payload, record?.values, record?.data);
    const payloadPreview = normalizePayloadPreview(rawPayload);

    return {
      id: safeId(firstString(record?.id, `action-${index + 1}`), `action-${index + 1}`),
      kind,
      label,
      summary,
      target,
      requestedToolIds,
      sideEffect,
      risk,
      requiresApproval,
      requiresPreview,
      status: 'proposed',
      ...(payloadPreview ? { payloadPreview } : {}),
    };
  }

  private buildClarificationAction(diagnostics: DiagnosticsDraft): AiFirstRouteAction {
    diagnostics.warnings.push('clarification-action-added');
    return {
      id: this.idFactory('action'),
      kind: 'ask-clarification',
      label: 'Pedir detalhe',
      summary: 'Pedir ao usuario o detalhe minimo necessario para continuar.',
      target: { type: 'conversation', value: null },
      requestedToolIds: [],
      sideEffect: 'none',
      risk: 'safe',
      requiresApproval: false,
      requiresPreview: false,
      status: 'proposed',
    };
  }

  private buildRiskNotes(
    riskLevel: AiFirstRoutePlanRisk,
    sideEffects: AiFirstRoutePlanSideEffect[],
    actions: AiFirstRouteAction[],
  ): AiFirstRouteRiskNote[] {
    const notes: AiFirstRouteRiskNote[] = [];
    if (riskLevel !== 'safe') {
      notes.push({
        id: this.idFactory('risk'),
        severity: riskLevel,
        message: 'O plano contem efeito colateral e precisa passar por preview/aprovacao.',
      });
    }
    if (sideEffects.includes('destructive')) {
      notes.push({
        id: this.idFactory('risk'),
        severity: 'danger',
        message: 'Foi detectada uma acao potencialmente destrutiva.',
      });
    }
    if (actions.some((action) => action.kind === 'run-command')) {
      notes.push({
        id: this.idFactory('risk'),
        severity: 'danger',
        message: 'Comandos de sistema exigem aprovacao explicita e ambiente governado.',
      });
    }
    return notes;
  }
}

function recordOrNull(value: unknown): RawRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as RawRecord;
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return '';
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function safeText(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
  return redactSensitiveText(raw);
}

function safeId(value: string, fallback: string): string {
  const candidate = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return candidate.length > 0 ? candidate : fallback;
}

function normalizeLiteral<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  if (typeof value === 'string' && allowed.includes(value as T)) {
    return value as T;
  }
  return fallback;
}

function clampConfidence(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, value));
}

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string' && value.trim().length > 0) {
    return [value.trim()];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }
  return [];
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    const key = normalized.toLowerCase();
    if (normalized.length === 0 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(normalized);
  }
  return unique;
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, `Bearer ${REDACTED_SECRET}`)
    .replace(/\bxox[pbarfs]-[A-Za-z0-9-]{6,}\b/gi, REDACTED_SECRET)
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, REDACTED_SECRET)
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{12,}\b/g, REDACTED_SECRET)
    .replace(
      /\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|ACCESS_KEY|PRIVATE_KEY|CREDENTIAL)[A-Z0-9_]*)\s*[:=]\s*([^\s,;]+)/gi,
      `$1=${REDACTED_SECRET}`,
    )
    .replace(
      /\b(token|secret|senha|password|api key|chave)\s*(?:e|is|=|:)\s*([^\s,;]+)/gi,
      `$1=${REDACTED_SECRET}`,
    );
}

function redactUnknown(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactSensitiveText(value);
  }
  if (Array.isArray(value)) {
    return value.map(redactUnknown);
  }
  const record = recordOrNull(value);
  if (!record) {
    return value;
  }
  const redacted: RawRecord = {};
  for (const [key, rawValue] of Object.entries(record)) {
    if (/(token|secret|password|api[_-]?key|access[_-]?key|private[_-]?key|credential|senha)/i.test(key)) {
      redacted[key] = REDACTED_SECRET;
      continue;
    }
    redacted[key] = redactUnknown(rawValue);
  }
  return redacted;
}

function normalizePayloadPreview(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const redacted = redactUnknown(value);
  const record = recordOrNull(redacted);
  if (record) {
    return record;
  }
  return { value: redacted };
}

function normalizeTarget(value: unknown): AiFirstRouteTarget {
  const record = recordOrNull(value);
  if (!record) {
    return { type: 'unknown', value: null };
  }
  const type = normalizeTargetType(record.type);
  const rawValue = firstString(record.value, record.path, record.name, record.id);
  return {
    type,
    value: rawValue.length > 0 ? redactSensitiveText(rawValue) : null,
  };
}

function normalizeTargetType(value: unknown): AiFirstRouteTarget['type'] {
  if (
    value === 'none' ||
    value === 'conversation' ||
    value === 'workspace' ||
    value === 'file' ||
    value === 'service' ||
    value === 'account' ||
    value === 'external' ||
    value === 'unknown'
  ) {
    return value;
  }
  return 'unknown';
}

function inferIntentFromText(value: string): AiFirstRoutePlanIntent {
  const text = value.toLowerCase();
  if (/(configur|setup|conectar|token|senha|chave|credential|secret)/.test(text)) {
    return 'configuration';
  }
  if (/(editar|alterar|salvar|criar arquivo|aplicar|corrigir)/.test(text)) {
    return 'workspace-mutation';
  }
  if (/(ler|verificar|inspecionar|listar|mostrar)/.test(text)) {
    return 'workspace-inspection';
  }
  if (/(rodar|executar|terminal|comando|shell)/.test(text)) {
    return 'command-execution';
  }
  if (/(pesquisar|buscar|internet|web|fonte)/.test(text)) {
    return 'research';
  }
  if (/(lembre|memoria|guardar)/.test(text)) {
    return 'memory';
  }
  if (/(agendar|todo dia|toda semana|automacao)/.test(text)) {
    return 'automation';
  }
  return value.trim().length > 0 ? 'conversation' : 'unknown';
}

function summarizeIntent(intent: AiFirstRoutePlanIntent, userMessage: string): string {
  if (userMessage.trim().length > 0) {
    return `Interpretar pedido como ${intent}.`;
  }
  return 'Pedido vazio ou incompleto.';
}

function inferActionKind(
  summary: string,
  requestedToolIds: string[],
  intent: AiFirstRoutePlanIntent,
): AiFirstRouteActionKind {
  const text = `${summary} ${requestedToolIds.join(' ')}`.toLowerCase();
  if (/(perguntar|clarification|clarificar)/.test(text)) {
    return 'ask-clarification';
  }
  if (/(preview|plano|mostrar antes)/.test(text)) {
    return 'preview';
  }
  if (/(rodar|executar|terminal|shell|command|exec)/.test(text) || intent === 'command-execution') {
    return 'run-command';
  }
  if (/(configur|setup|conectar|secret|credential)/.test(text) || intent === 'configuration') {
    return 'configure';
  }
  if (/(editar|alterar|salvar|write|apply|patch|criar arquivo)/.test(text) || intent === 'workspace-mutation') {
    return 'write';
  }
  if (/(ler|inspecionar|listar|read)/.test(text) || intent === 'workspace-inspection') {
    return 'read';
  }
  if (/(pesquisar|buscar|web|search)/.test(text) || intent === 'research') {
    return 'search';
  }
  if (/(testar|validar|check|doctor)/.test(text)) {
    return 'test';
  }
  if (/(enviar|send|postar|publicar)/.test(text)) {
    return 'send';
  }
  if (/(delegar|delegate|subagente)/.test(text)) {
    return 'delegate';
  }
  return 'answer';
}

function inferSideEffect(
  kind: AiFirstRouteActionKind,
  summary: string,
  requestedToolIds: string[],
): AiFirstRoutePlanSideEffect {
  const text = `${summary} ${requestedToolIds.join(' ')}`.toLowerCase();
  if (destructiveText(text)) {
    return 'destructive';
  }
  if (kind === 'run-command') {
    return 'command';
  }
  if (kind === 'write' || kind === 'configure' || kind === 'test') {
    return 'local-write';
  }
  if (kind === 'send') {
    return 'external-send';
  }
  if (kind === 'search') {
    return 'network';
  }
  if (kind === 'read') {
    return 'local-read';
  }
  return 'none';
}

function destructiveText(value: string): boolean {
  return /(delete|remove|rm\s+-rf|format|drop\s+table|destroy|apagar|deletar|remover|destruir)/i.test(value);
}

function actionRequiresApproval(
  kind: AiFirstRouteActionKind,
  sideEffect: AiFirstRoutePlanSideEffect,
  risk: AiFirstRoutePlanRisk,
): boolean {
  if (risk === 'danger' || sideEffect === 'command' || sideEffect === 'external-send' || sideEffect === 'destructive') {
    return true;
  }
  return kind === 'write' || kind === 'configure' || kind === 'test' || kind === 'send' || kind === 'delegate';
}

function actionRequiresPreview(
  kind: AiFirstRouteActionKind,
  sideEffect: AiFirstRoutePlanSideEffect,
  requiresApproval: boolean,
): boolean {
  if (requiresApproval || kind === 'preview') {
    return true;
  }
  return sideEffect !== 'none' && sideEffect !== 'local-read';
}

function maxRisk(values: AiFirstRoutePlanRisk[]): AiFirstRoutePlanRisk {
  return values.reduce<AiFirstRoutePlanRisk>((current, next) => {
    return RISK_RANK[next] > RISK_RANK[current] ? next : current;
  }, 'safe');
}

function chooseNextSafeAction(input: {
  missingInformation: AiFirstRouteQuestion[];
  proposedActions: AiFirstRouteAction[];
  requiresApproval: boolean;
  requiresPreview: boolean;
  riskLevel: AiFirstRoutePlanRisk;
}): AiFirstRouteNextSafeAction {
  if (input.missingInformation.some((question) => question.required)) {
    return 'ask-clarification';
  }
  if (input.riskLevel === 'danger' || input.requiresPreview) {
    return 'preview-then-request-permission';
  }
  if (input.requiresApproval) {
    return 'request-permission';
  }
  if (input.proposedActions.some((action) => action.kind === 'read')) {
    return 'execute-governed-safe-read';
  }
  if (input.proposedActions.some((action) => action.kind === 'answer' || action.kind === 'ask-clarification')) {
    return 'answer';
  }
  return normalizeLiteral<AiFirstRouteNextSafeAction>('answer', AI_FIRST_ROUTE_NEXT_SAFE_ACTIONS, 'answer');
}

function buildDefaultReply(nextSafeAction: AiFirstRouteNextSafeAction, goal: string): string {
  if (nextSafeAction === 'ask-clarification') {
    return 'Posso fazer isso, mas preciso de um detalhe antes.';
  }
  if (nextSafeAction === 'preview-then-request-permission' || nextSafeAction === 'request-permission') {
    return `Vou te mostrar o que farei para "${goal}" e pedir sua aprovacao antes de agir.`;
  }
  if (nextSafeAction === 'execute-governed-safe-read') {
    return `Vou verificar "${goal}" sem fazer alteracoes.`;
  }
  if (nextSafeAction === 'decline') {
    return 'Nao posso fazer essa acao desse jeito.';
  }
  return `Vou responder sobre "${goal}".`;
}
