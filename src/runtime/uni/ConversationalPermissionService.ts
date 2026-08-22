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
    if (input.riskHints?.approvalRequired) {
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
      return { allowed: false, consumed: false, reason: 'Nonexistent permission.' };
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
        reason: 'Conversational permission does not authorize the whole host.',
      };
    }
    if (grant.scope === 'once' && grant.consumed) {
      return {
        allowed: false,
        consumed: true,
        reason: 'Once permission has already been consumed.',
      };
    }
    if (grant.scope === 'session' && this.normalizeSession(usage.sessionId) !== this.normalizeSession(grant.sessionId)) {
      return {
        allowed: false,
        consumed: grant.consumed,
        reason: 'Session permission does not apply to another session.',
      };
    }
    if (grant.scope === 'workspace' && !this.isWithinWorkspace(usage.targetPath || usage.workspacePath || '', grant.workspaceRoot)) {
      return {
        allowed: false,
        consumed: grant.consumed,
        reason: 'Workspace permission does not cover paths outside the workspace.',
      };
    }
    return {
      allowed: true,
      consumed: grant.consumed,
      reason: 'Valid permission for this use.',
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
      return 'The request requires operator posture before continuing.';
    }
    if (sideEffect === 'destructive') {
      return 'The request may delete or replace resources and requires explicit authorization.';
    }
    if (sideEffect === 'external') {
      return 'The request may send, publish, or expose information outside the workspace.';
    }
    if (sideEffect === 'system') {
      return 'The request may execute a command, automation, or persistent system control.';
    }
    if (sideEffect === 'local_workspace') {
      return 'The request may change workspace files or local state.';
    }
    return 'The request requires a governed tool.';
  }

  private buildPermissionPrompt(
    kind: ConversationalPermissionRequest['kind'],
    sideEffect: UniversalIntentSideEffect,
  ): string {
    if (kind === 'operator_control') {
      return 'May I pause and ask for operator permission before continuing...';
    }
    if (kind === 'external_side_effect') {
      return 'Can I prepare a preview before sending or publishing...';
    }
    if (kind === 'dangerous_operation') {
      return 'May I prepare a safe preview before any dangerous execution...';
    }
    if (kind === 'automation') {
      return 'I can prepare the plan and request approval before enabling the automation.';
    }
    if (sideEffect === 'local_workspace') {
      return 'I can prepare a preview of the changes before applying...';
    }
    return 'Can I continue with this governed tool...';
  }

  private describeWhere(input: UniversalIntentInput, classification: UniversalIntentSafetyClassification): string {
    if (classification.signals.hostScopeRequested) {
      return 'Request mentions the whole host; that will not be authorized by normal conversational permission.';
    }
    return input.contextHints?.targetPath
      || input.contextHints?.workspaceRoot
      || input.contextHints?.workspacePath
      || 'Target will be confirmed in preview before execution.';
  }

  private describePermission(scope: UniversalIntentPermissionScope, kind: ConversationalPermissionRequest['kind']): string {
    if (kind === 'operator_control') {
      return 'Requires Overlord mode and explicit approval.';
    }
    if (scope === 'session') {
      return 'Authorization applies only to this session.';
    }
    if (scope === 'workspace') {
      return 'Authorization is limited to the declared workspace.';
    }
    if (scope === 'persistent') {
      return 'Persistent authorization requires separate control.';
    }
    return 'Authorization once, consumed on first use.';
  }

  private describeValidity(scope: UniversalIntentPermissionScope): string {
    if (scope === 'session') {
      return 'Until this session ends, without leaking into another session.';
    }
    if (scope === 'workspace') {
      return 'Only inside the declared workspace.';
    }
    if (scope === 'persistent') {
      return 'Persistent until explicit revocation.';
    }
    return 'A single execution.';
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
