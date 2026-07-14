import path from 'node:path';
import type {
  ConversationalPermissionGrant,
  ConversationalPermissionRequest,
  ConversationalPermissionUseDecision,
  ConversationalPermissionUsage,
  PermissionNarrative,
  UniversalIntentInput,
  UniversalIntentPermissionScope,
  UniversalIntentRiskLevel,
  UniversalIntentSafetyClassification,
  UniversalIntentSideEffect,
} from './UniversalIntentContracts.js';
import { PermissionNarrativeService } from './PermissionNarrativeService.js';

type ConversationalPermissionServiceRuntime = {
  now?: () => Date;
  narrativeService?: PermissionNarrativeService;
};

export class ConversationalPermissionService {
  private readonly now: () => Date;
  private readonly narrativeService: PermissionNarrativeService;
  private readonly grants = new Map<string, ConversationalPermissionGrant>();

  constructor(runtime: ConversationalPermissionServiceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.narrativeService = runtime.narrativeService || new PermissionNarrativeService();
  }

  public requiresPermission(input: UniversalIntentInput, classification: UniversalIntentSafetyClassification): boolean {
    if (Boolean(input.riskHints?.approvalRequired)) {
      return true;
    }
    if (classification.risk === 'danger') {
      return true;
    }
    const signals = classification.signals;
    return signals.mutation || signals.automation || signals.operatorRequired;
  }

  public buildRequest(
    input: UniversalIntentInput,
    classification: UniversalIntentSafetyClassification,
  ): ConversationalPermissionRequest {
    const sideEffect = classification.sideEffect;
    const kind = this.inferPermissionKind(classification, sideEffect);
    const scope = this.inferScope(input, classification);
    const requestedTools = classification.capabilityRequired.length > 0
      ? classification.capabilityRequired
      : ['agent.runtime'];
    const where = this.describeWhere(input, classification);
    const validity = this.describeValidity(scope);
    const narrative = this.narrativeService.forRequest({
      classification,
      where,
      permission: this.describePermission(scope, kind),
      validity,
      technicalDetails: [
        `intent:${classification.intent}`,
        `sideEffect:${sideEffect}`,
        `scope:${scope}`,
      ],
    });

    return {
      id: this.buildPermissionId(input.surface, kind, requestedTools, scope),
      kind,
      prompt: this.buildPermissionPrompt(kind, sideEffect),
      reason: this.describePermissionReason(classification, sideEffect),
      risk: classification.risk,
      scope,
      scopeBoundary: {
        sessionId: input.contextHints?.sessionId || null,
        workspaceRoot: input.contextHints?.workspaceRoot || input.contextHints?.workspacePath || null,
        targetPath: input.contextHints?.targetPath || null,
        hostAllowed: false,
      },
      requestedTools,
      previewRequired: sideEffect !== 'none',
      approvalRequired: classification.risk !== 'safe' || sideEffect !== 'none',
      sideEffect,
      narrative,
    };
  }

  public grant(
    request: ConversationalPermissionRequest,
    input: {
      scope?: UniversalIntentPermissionScope | null;
      sessionId?: string | null;
      workspaceRoot?: string | null;
    } = {},
  ): ConversationalPermissionGrant {
    const scope = input.scope || request.scope;
    const grant: ConversationalPermissionGrant = {
      permissionId: request.id,
      request: {
        ...request,
        scope,
        scopeBoundary: {
          ...request.scopeBoundary,
          sessionId: input.sessionId !== undefined ? input.sessionId : request.scopeBoundary.sessionId,
          workspaceRoot: input.workspaceRoot !== undefined ? input.workspaceRoot : request.scopeBoundary.workspaceRoot,
        },
      },
      scope,
      sessionId: input.sessionId !== undefined ? input.sessionId : request.scopeBoundary.sessionId,
      workspaceRoot: input.workspaceRoot !== undefined ? input.workspaceRoot : request.scopeBoundary.workspaceRoot,
      consumed: false,
      approvedAt: this.now().toISOString(),
    };
    this.grants.set(grant.permissionId, grant);
    return grant;
  }

  public use(permissionId: string, usage: ConversationalPermissionUsage): ConversationalPermissionUseDecision {
    const grant = this.grants.get(permissionId);
    if (!grant) {
      return { allowed: false, consumed: false, reason: 'Permissao inexistente.' };
    }
    const decision = this.canUse(grant, usage);
    if (decision.allowed && grant.scope === 'once') {
      grant.consumed = true;
    }
    return {
      ...decision,
      consumed: grant.consumed,
    };
  }

  public canUse(
    grant: ConversationalPermissionGrant,
    usage: ConversationalPermissionUsage,
  ): ConversationalPermissionUseDecision {
    if (usage.hostScopeRequested || grant.request.scopeBoundary.hostAllowed) {
      return {
        allowed: false,
        consumed: grant.consumed,
        reason: 'Permissao conversacional nao autoriza host inteiro.',
      };
    }
    if (grant.scope === 'once' && grant.consumed) {
      return {
        allowed: false,
        consumed: true,
        reason: 'Permissao once ja foi consumida.',
      };
    }
    if (grant.scope === 'session' && this.normalizeSession(usage.sessionId) !== this.normalizeSession(grant.sessionId)) {
      return {
        allowed: false,
        consumed: grant.consumed,
        reason: 'Permissao de sessao nao vale para outra sessao.',
      };
    }
    if (grant.scope === 'workspace' && !this.isWithinWorkspace(usage.targetPath || usage.workspacePath || '', grant.workspaceRoot)) {
      return {
        allowed: false,
        consumed: grant.consumed,
        reason: 'Permissao de workspace nao cobre caminho fora do workspace.',
      };
    }
    return {
      allowed: true,
      consumed: grant.consumed,
      reason: 'Permissao valida para este uso.',
    };
  }

  private inferScope(
    input: UniversalIntentInput,
    classification: UniversalIntentSafetyClassification,
  ): UniversalIntentPermissionScope {
    if (classification.intent === 'automation') {
      return 'session';
    }
    if (classification.sideEffect === 'local_workspace' && (input.contextHints?.workspaceRoot || input.contextHints?.workspacePath)) {
      return 'once';
    }
    return 'once';
  }

  private inferPermissionKind(
    classification: UniversalIntentSafetyClassification,
    sideEffect: UniversalIntentSideEffect,
  ): ConversationalPermissionRequest['kind'] {
    if (classification.signals.operatorRequired) {
      return 'operator_control';
    }
    if (sideEffect === 'destructive' || classification.signals.shell) {
      return 'dangerous_operation';
    }
    if (classification.signals.automation) {
      return 'automation';
    }
    if (sideEffect === 'external') {
      return 'external_side_effect';
    }
    if (classification.signals.mutation) {
      return 'workspace_mutation';
    }
    return 'tool_execution';
  }

  private describePermissionReason(
    classification: UniversalIntentSafetyClassification,
    sideEffect: UniversalIntentSideEffect,
  ): string {
    if (classification.signals.operatorRequired) {
      return 'A solicitacao exige postura Overlord/operador antes de prosseguir.';
    }
    if (sideEffect === 'destructive') {
      return 'A solicitacao pode apagar ou substituir recursos e exige autorizacao explicita.';
    }
    if (sideEffect === 'external') {
      return 'A solicitacao pode enviar, publicar ou expor informacao fora do workspace.';
    }
    if (sideEffect === 'system') {
      return 'A solicitacao pode executar comando, automacao ou controle persistente do sistema.';
    }
    if (sideEffect === 'local_workspace') {
      return 'A solicitacao pode alterar arquivos ou estado local do workspace.';
    }
    return 'The request requires a governed tool.';
  }

  private buildPermissionPrompt(
    kind: ConversationalPermissionRequest['kind'],
    sideEffect: UniversalIntentSideEffect,
  ): string {
    if (kind === 'operator_control') {
      return 'Posso pausar e pedir permissao de operador antes de continuar?';
    }
    if (kind === 'external_side_effect') {
      return 'Posso preparar um preview antes de enviar ou publicar?';
    }
    if (kind === 'dangerous_operation') {
      return 'Posso preparar um preview seguro antes de qualquer execucao perigosa?';
    }
    if (kind === 'automation') {
      return 'Posso preparar o plano e pedir approval antes de ativar a automacao?';
    }
    if (sideEffect === 'local_workspace') {
      return 'Posso preparar um preview das alteracoes antes de aplicar?';
    }
    return 'Posso continuar com esta ferramenta governada?';
  }

  private describeWhere(input: UniversalIntentInput, classification: UniversalIntentSafetyClassification): string {
    if (classification.signals.hostScopeRequested) {
      return 'Pedido menciona host inteiro; isso nao sera autorizado por permissao conversacional comum.';
    }
    return input.contextHints?.targetPath
      || input.contextHints?.workspaceRoot
      || input.contextHints?.workspacePath
      || 'Alvo sera confirmado no preview antes da execucao.';
  }

  private describePermission(scope: UniversalIntentPermissionScope, kind: ConversationalPermissionRequest['kind']): string {
    if (kind === 'operator_control') {
      return 'Exige modo Overlord e approval explicito.';
    }
    if (scope === 'session') {
      return 'Autorizacao vale somente para esta sessao.';
    }
    if (scope === 'workspace') {
      return 'Autorizacao fica limitada ao workspace declarado.';
    }
    if (scope === 'persistent') {
      return 'Autorizacao persistente exige controle separado.';
    }
    return 'Autorizacao once, consumida no primeiro uso.';
  }

  private describeValidity(scope: UniversalIntentPermissionScope): string {
    if (scope === 'session') {
      return 'Ate o fim desta sessao, sem vazar para outra sessao.';
    }
    if (scope === 'workspace') {
      return 'Somente dentro do workspace declarado.';
    }
    if (scope === 'persistent') {
      return 'Persistente ate revogacao explicita.';
    }
    return 'Uma unica execucao.';
  }

  private buildPermissionId(
    surface: string,
    kind: ConversationalPermissionRequest['kind'],
    requestedTools: string[],
    scope: UniversalIntentPermissionScope,
  ): string {
    const source = `${surface}:${kind}:${scope}:${requestedTools.join(',')}`;
    let hash = 0;
    for (let index = 0; index < source.length; index += 1) {
      hash = Math.imul(31, hash) + source.charCodeAt(index);
      hash |= 0;
    }
    return `uni-${kind}-${Math.abs(hash).toString(36)}`;
  }

  private normalizeSession(sessionId: string | null | undefined): string {
    return String(sessionId || '').trim();
  }

  private isWithinWorkspace(targetPath: string, workspaceRoot: string | null): boolean {
    const root = String(workspaceRoot || '').trim();
    const target = String(targetPath || '').trim();
    if (!root || !target) {
      return false;
    }
    const normalizedRoot = path.resolve(root).toLowerCase();
    const normalizedTarget = path.resolve(target).toLowerCase();
    return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`);
  }
}
