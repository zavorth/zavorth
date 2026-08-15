import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type {
  ModeEscalationEvaluation,
  ModeEscalationGrant,
  ModeEscalationRequest,
  ModeEscalationResolution,
  ModeEscalationScope,
  ModeEscalationSnapshot,
} from '../contracts/ModeEscalationContract.js';
import type { TaskResourceImpact } from '../contracts/TaskResourcePlannerContract.js';
import type { CapabilityLifecycleService } from './CapabilityLifecycleService.js';
import { logger } from '../logger.js';
import {
  buildZavorthProductModeSnapshot,
  type ZavorthProductMode,
  type ZavorthProductModeSnapshot,
} from './ProductModeService.js';

type CapabilityLifecyclePort = Pick<
  CapabilityLifecycleService,
  'buildProductModeSnapshot' | 'getProductMode' | 'getProfile'
>;

type PersistedModeEscalationRequest = {
  id: string;
  createdAt: string;
  updatedAt: string;
  sessionId: string;
  requestedBy: string | null;
  intent: string;
  currentMode: ZavorthProductMode;
  effectiveMode: ZavorthProductMode;
  requiredMode: ZavorthProductMode;
  reason: string;
  reasons: string[];
  recommendedScope: ModeEscalationScope;
  supportedScopes: ModeEscalationScope[];
  fallback: string;
  status: 'pending' | 'approved' | 'rejected';
  resourceImpact: TaskResourceImpact | null;
  resolution: {
    decidedAt: string | null;
    decidedBy: string | null;
    scope: ModeEscalationScope | null;
    grantId: string | null;
  };
};

type PersistedModeEscalationGrant = {
  id: string;
  createdAt: string;
  updatedAt: string;
  sessionId: string | null;
  requestedBy: string | null;
  scope: ModeEscalationScope;
  targetMode: ZavorthProductMode;
  reason: string;
  sourceRequestId: string | null;
  remainingUses: number | null;
};

type PersistedModeEscalationState = {
  version: 1;
  grants: PersistedModeEscalationGrant[];
  requests: PersistedModeEscalationRequest[];
};

type RequiredModeResolution = {
  requiredMode: ZavorthProductMode;
  reason: string;
  reasons: string[];
  recommendedScope: ModeEscalationScope;
  fallback: string;
};

type ModeEscalationRuntime = {
  now?: () => Date;
  stateFilePath?: string;
  capabilityLifecycle?: CapabilityLifecyclePort | null;
};

const MODE_ORDER: ZavorthProductMode[] = ['chat', 'assistant', 'builder', 'operator'];

export class ModeEscalationService {
  private readonly now: () => Date;
  private readonly stateFilePath: string;
  private readonly capabilityLifecycle: CapabilityLifecyclePort;
  private state: PersistedModeEscalationState;

  constructor(runtime: ModeEscalationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.stateFilePath = runtime.stateFilePath || config.modeEscalationStateFile;
    this.capabilityLifecycle = runtime.capabilityLifecycle || {
      buildProductModeSnapshot: () => buildZavorthProductModeSnapshot(config.zavorthProductMode, config.zavorthProfile),
      getProductMode: () => config.zavorthProductMode,
      getProfile: () => config.zavorthProfile,
    };
    this.state = this.readState();
  }

  public evaluateChatRequest(input: {
    sessionId: string;
    message: string;
    resourceImpact: TaskResourceImpact | null;
    requestedBy?: string | null;
  }): ModeEscalationEvaluation {
    const sessionId = String(input.sessionId || '').trim();
    const message = String(input.message || '').trim();
    if (!sessionId || !message) {
      return {
        allowed: true,
        request: null,
        snapshot: this.buildSnapshot(sessionId || 'unknown-session'),
      };
    }

    this.pruneResolvedRequests();
    const baseMode = this.buildBaseSnapshot();
    const required = this.resolveRequiredMode(message, input.resourceImpact);
    const matchingGrant = this.findMatchingGrant(sessionId, required.requiredMode);
    const effectiveMode = matchingGrant ? this.buildModeSnapshot(matchingGrant.targetMode) : baseMode;

    if (this.compareModes(effectiveMode.id, required.requiredMode) >= 0) {
      if (matchingGrant?.scope === 'once') {
        this.consumeGrant(matchingGrant.id);
      }
      return {
        allowed: true,
        request: null,
        snapshot: this.buildSnapshot(sessionId),
      };
    }

    const pending = this.findPendingRequest(sessionId, required.requiredMode, message);
    if (pending) {
      return {
        allowed: false,
        request: this.toRequest(pending),
        snapshot: this.buildSnapshot(sessionId),
      };
    }

    const nowIso = this.now().toISOString();
    const request: PersistedModeEscalationRequest = {
      id: this.buildId('mode-escalation', sessionId, required.requiredMode, message),
      createdAt: nowIso,
      updatedAt: nowIso,
      sessionId,
      requestedBy: this.nullableText(input.requestedBy),
      intent: message,
      currentMode: baseMode.id,
      effectiveMode: effectiveMode.id,
      requiredMode: required.requiredMode,
      reason: required.reason,
      reasons: required.reasons,
      recommendedScope: required.recommendedScope,
      supportedScopes: ['once', 'session', 'host'],
      fallback: required.fallback,
      status: 'pending',
      resourceImpact: input.resourceImpact || null,
      resolution: {
        decidedAt: null,
        decidedBy: null,
        scope: null,
        grantId: null,
      },
    };
    this.state.requests.unshift(request);
    this.persistState();
    return {
      allowed: false,
      request: this.toRequest(request),
      snapshot: this.buildSnapshot(sessionId),
    };
  }

  public resolveRequest(input: {
    requestId: string;
    decision: 'approve' | 'reject';
    scope?: ModeEscalationScope | null;
    requestedBy?: string | null;
    sessionId?: string | null;
  }): ModeEscalationResolution {
    const sessionId = String(input.sessionId || '').trim();
    let requestId = String(input.requestId || '').trim();
    if (sessionId) {
      const resolved = this.resolveRequestRef(sessionId, requestId || null);
      if (resolved) requestId = resolved;
    } else if (!requestId) {
      // Bare approve without session: use newest global pending if unique.
      const pending = this.state.requests.filter((entry) => entry.status === 'pending');
      if (pending.length === 1) requestId = pending[0].id;
    }
    if (!requestId) {
      throw new Error('Use /mode approve or /mode approve 1 (from /mode) - not a long id.');
    }
    const request = this.state.requests.find((entry) => entry.id === requestId);
    if (!request) {
      throw new Error('Use /mode approve or /mode approve 1 (pending escalation not found).');
    }
    if (request.status !== 'pending') {
      return {
        ok: true,
        decision: input.decision,
        request: this.toRequest(request),
        grant: request.resolution.grantId ? this.findGrantById(request.resolution.grantId) : null,
        snapshot: this.buildSnapshot(request.sessionId),
        summary: 'Esse mode escalation already foi resolvido anteriormente.',
      };
    }

    const requestedBy = this.nullableText(input.requestedBy) || 'operator';
    const decidedAt = this.now().toISOString();
    if (input.decision === 'reject') {
      request.status = 'rejected';
      request.updatedAt = decidedAt;
      request.resolution = {
        decidedAt,
        decidedBy: requestedBy,
        scope: null,
        grantId: null,
      };
      this.persistState();
      return {
        ok: true,
        decision: 'reject',
        request: this.toRequest(request),
        grant: null,
        snapshot: this.buildSnapshot(request.sessionId),
        summary: `Escalation to ${request.requiredMode} rejected; Zavorth stays in the current mode.`,
      };
    }

    const scope = this.normalizeScope(input.scope || request.recommendedScope);
    const grant: PersistedModeEscalationGrant = {
      id: this.buildId('mode-grant', request.sessionId, request.requiredMode, `${scope}:${request.id}`),
      createdAt: decidedAt,
      updatedAt: decidedAt,
      sessionId: scope === 'host' ? null : request.sessionId,
      requestedBy,
      scope,
      targetMode: request.requiredMode,
      reason: request.reason,
      sourceRequestId: request.id,
      remainingUses: scope === 'once' ? 1 : null,
    };
    request.status = 'approved';
    request.updatedAt = decidedAt;
    request.resolution = {
      decidedAt,
      decidedBy: requestedBy,
      scope,
      grantId: grant.id,
    };
    this.state.grants.unshift(grant);
    this.persistState();
    return {
      ok: true,
      decision: 'approve',
      request: this.toRequest(request),
      grant: this.toGrant(grant),
      snapshot: this.buildSnapshot(request.sessionId),
      summary: `Escalonamento approved para ${request.requiredMode} com escopo ${scope}.`,
    };
  }

  public buildSnapshot(sessionId: string): ModeEscalationSnapshot {
    const normalizedSessionId = String(sessionId || '').trim() || 'unknown-session';
    this.pruneResolvedRequests();
    const baseMode = this.buildBaseSnapshot();
    const activeGrant = this.findBestGrant(normalizedSessionId);
    const effectiveMode = activeGrant ? this.buildModeSnapshot(activeGrant.targetMode) : baseMode;
    const pendingRequest = this.state.requests.find(
      (entry) => entry.sessionId === normalizedSessionId && entry.status === 'pending',
    );
    const activeGrants = this.state.grants
      .filter((entry) => this.isGrantVisibleForSession(entry, normalizedSessionId))
      .map((entry) => this.toGrant(entry))
      .filter((entry): entry is ModeEscalationGrant => Boolean(entry));
    const recentRequests = this.state.requests
      .filter((entry) => entry.sessionId === normalizedSessionId)
      .slice(0, 5)
      .map((entry) => this.toRequest(entry));
    return {
      generatedAt: this.now().toISOString(),
      sessionId: normalizedSessionId,
      baseMode,
      effectiveMode,
      status: pendingRequest ? 'pending'
        : activeGrants.length > 0 && effectiveMode.id !== baseMode.id ? 'elevated'
          : 'clear',
      activeGrants,
      pendingRequest: pendingRequest ? this.toRequest(pendingRequest) : null,
      recentRequests,
      commands: {
        show: '/mode',
        // Prefer bare / ordinal - not long request ids.
        approve: pendingRequest ? '/mode approve  [once|session|host]  or  /mode approve 1'
          : '/mode approve 1 [once|session|host]',
        reject: pendingRequest ? '/mode reject  or  /mode reject 1' : '/mode reject 1',
        inspect: '/api/web/runtime/mode-escalation?sessionId=:id',
        resolve: '/api/web/runtime/mode-escalation/resolve',
      },
    };
  }

  /**
   * Resolve a request ref for a session: bare, ordinal 1, short prefix, or full id.
   */
  public resolveRequestRef(sessionId: string, ref: string | null | undefined): string | null {
    const normalizedSessionId = String(sessionId || '').trim() || 'unknown-session';
    const pending = this.state.requests.filter(
      (entry) => entry.sessionId === normalizedSessionId && entry.status === 'pending',
    );
    const token = String(ref || '').trim();
    if (!token) {
      return pending.length === 1 ? pending[0].id : pending[0]?.id || null;
    }
    const ordinal = parseModeEscalationOrdinal(token);
    if (ordinal !== null) {
      const index = ordinal - 1;
      if (Number.isFinite(index) && index >= 0 && index < pending.length) {
        return pending[index].id;
      }
      return null;
    }
    const exact =
      pending.find((entry) => entry.id === token) || this.state.requests.find((entry) => entry.id === token);
    if (exact) return exact.id;
    const prefixHits = pending.filter((entry) => entry.id.startsWith(token));
    if (prefixHits.length === 1) return prefixHits[0].id;
    return null;
  }

  private resolveRequiredMode(_message: string, impact: TaskResourceImpact | null): RequiredModeResolution {
    let requiredMode: ZavorthProductMode = 'chat';
    const reasons: string[] = [];

    const capabilityIds = impact?.budget?.capabilityIds || [];
    if (capabilityIds.some((entry) => ['workspace', 'artifact', 'file', 'media'].includes(String(entry || '').trim()))) {
      requiredMode = this.maxMode(requiredMode, 'assistant');
      reasons.push('Structured planner requested workspace or artifact context.');
    }

    if (capabilityIds.some((entry) => ['qa', 'sandbox', 'diff', 'patch', 'selfmod', 'build', 'test'].includes(String(entry || '').trim()))) {
      requiredMode = this.maxMode(requiredMode, 'builder');
      reasons.push('Structured planner requested builder-level capabilities.');
    }

    if (
      (impact?.budget?.companionDependencies?.length || 0) > 0 ||
      capabilityIds.some((entry) =>
        ['watch-mode', 'remote', 'public-tunnel', 'recurring-automation'].includes(String(entry || '').trim()),
      )
    ) {
      requiredMode = this.maxMode(requiredMode, 'operator');
      reasons.push('Structured planner requested operator-level control, companion dependencies, or exposure.');
    }

    const recommendedScope =
      impact?.budget?.recurring || impact?.budget?.externalExposure === 'public'
        ? 'host'
        : impact?.heavy || (impact?.budget?.companionDependencies?.length || 0) > 0
          ? 'session'
          : 'once';

    const fallback =
      impact?.budget?.fallback ||
      (requiredMode === 'operator'
        ? 'I can continue in the current mode and suggest a lighter path without companions or extra exposure.'
        : requiredMode === 'builder'
          ? 'I can continue in the current mode and keep the response conceptual only, without diff or execution.'
          : 'I can continue in simple conversation mode only.');

    return {
      requiredMode,
      reason: reasons[0] || 'The current request requires a stronger mode than the active mode.',
      reasons: reasons.length > 0 ? reasons : ['The current request exceeds the active Zavorth mode.'],
      recommendedScope,
      fallback,
    };
  }

  private buildBaseSnapshot(): ZavorthProductModeSnapshot {
    return this.capabilityLifecycle.buildProductModeSnapshot();
  }

  private buildModeSnapshot(mode: ZavorthProductMode): ZavorthProductModeSnapshot {
    return buildZavorthProductModeSnapshot(mode, this.capabilityLifecycle.getProfile());
  }

  private findPendingRequest(
    sessionId: string,
    requiredMode: ZavorthProductMode,
    intent: string,
  ): PersistedModeEscalationRequest | null {
    return (
      this.state.requests.find(
        (entry) =>
          entry.sessionId === sessionId &&
          entry.requiredMode === requiredMode &&
          entry.status === 'pending' &&
          entry.intent === intent,
      ) || null
    );
  }

  private findMatchingGrant(sessionId: string, requiredMode: ZavorthProductMode): PersistedModeEscalationGrant | null {
    return (
      this.state.grants.find(
        (entry) =>
          this.isGrantVisibleForSession(entry, sessionId) && this.compareModes(entry.targetMode, requiredMode) >= 0,
      ) || null
    );
  }

  private findBestGrant(sessionId: string): PersistedModeEscalationGrant | null {
    return (
      this.state.grants
        .filter((entry) => this.isGrantVisibleForSession(entry, sessionId))
        .sort((left, right) => this.compareModes(right.targetMode, left.targetMode))[0] || null
    );
  }

  private findGrantById(grantId: string): ModeEscalationGrant | null {
    const grant = this.state.grants.find((entry) => entry.id === grantId);
    return grant ? this.toGrant(grant) : null;
  }

  private isGrantVisibleForSession(grant: PersistedModeEscalationGrant, sessionId: string): boolean {
    if (grant.scope === 'host') {
      return true;
    }
    if (grant.scope === 'session' || grant.scope === 'once') {
      return grant.sessionId === sessionId && (grant.remainingUses === null || grant.remainingUses > 0);
    }
    return false;
  }

  private consumeGrant(grantId: string): void {
    const grantIndex = this.state.grants.findIndex((entry) => entry.id === grantId);
    if (grantIndex < 0) {
      return;
    }
    const grant = this.state.grants[grantIndex];
    if (grant.scope !== 'once') {
      return;
    }
    if ((grant.remainingUses || 0) <= 1) {
      this.state.grants.splice(grantIndex, 1);
    } else {
      grant.remainingUses = (grant.remainingUses || 1) - 1;
      grant.updatedAt = this.now().toISOString();
    }
    this.persistState();
  }

  private pruneResolvedRequests(): void {
    if (this.state.requests.length <= 40) {
      return;
    }
    this.state.requests = this.state.requests.slice(0, 40);
    this.persistState();
  }

  private toRequest(entry: PersistedModeEscalationRequest): ModeEscalationRequest {
    const currentMode = this.buildModeSnapshot(entry.currentMode);
    const effectiveMode = this.buildModeSnapshot(entry.effectiveMode);
    const requiredMode = this.buildModeSnapshot(entry.requiredMode);
    return {
      id: entry.id,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      sessionId: entry.sessionId,
      requestedBy: entry.requestedBy,
      intent: entry.intent,
      currentMode,
      effectiveMode,
      requiredMode,
      reason: entry.reason,
      reasons: [...entry.reasons],
      recommendedScope: entry.recommendedScope,
      supportedScopes: [...entry.supportedScopes],
      fallback: entry.fallback,
      summary: `To complete "${entry.intent}", Zavorth needs to move from ${entry.effectiveMode} to ${entry.requiredMode}. Main reason: ${entry.reason}.`,
      status: entry.status,
      resourceImpact: entry.resourceImpact || null,
      resolution: { ...entry.resolution },
    };
  }

  private toGrant(entry: PersistedModeEscalationGrant): ModeEscalationGrant {
    return {
      id: entry.id,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      sessionId: entry.sessionId,
      requestedBy: entry.requestedBy,
      scope: entry.scope,
      targetMode: entry.targetMode,
      targetModeSnapshot: this.buildModeSnapshot(entry.targetMode),
      reason: entry.reason,
      sourceRequestId: entry.sourceRequestId,
      status: entry.scope === 'once' && (entry.remainingUses || 0) <= 0 ? 'consumed' : 'active',
      remainingUses: entry.remainingUses,
    };
  }

  private compareModes(left: ZavorthProductMode, right: ZavorthProductMode): number {
    return MODE_ORDER.indexOf(left) - MODE_ORDER.indexOf(right);
  }

  private maxMode(left: ZavorthProductMode, right: ZavorthProductMode): ZavorthProductMode {
    return this.compareModes(left, right) >= 0 ? left : right;
  }

  private normalizeScope(scope: string | null | undefined): ModeEscalationScope {
    const normalized = String(scope || '')
      .trim()
      .toLowerCase();
    if (normalized === 'session' || normalized === 'host') {
      return normalized;
    }
    return 'once';
  }

  private buildId(prefix: string, sessionId: string, mode: ZavorthProductMode, seed: string): string {
    const hash = crypto.createHash('sha1').update(`${prefix}:${sessionId}:${mode}:${seed}`).digest('hex').slice(0, 10);
    return `${prefix}-${mode}-${hash}`;
  }

  private nullableText(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }

  private readState(): PersistedModeEscalationState {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.stateFilePath, 'utf8')) as PersistedModeEscalationState;
        return {
          version: 1,
          grants: Array.isArray(parsed.grants) ? parsed.grants : [],
          requests: Array.isArray(parsed.requests) ? parsed.requests : [],
        };
      }
    } catch (error: unknown) {
      // Keep runtime resilient even if the persisted file was corrupted.
      logger.warn('[Mode Escalation] JSON parse failed', error);
    }
    return {
      version: 1,
      grants: [],
      requests: [],
    };
  }

  private persistState(): void {
    fs.mkdirSync(path.dirname(this.stateFilePath), { recursive: true });
    fs.writeFileSync(this.stateFilePath, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
  }
}

function parseModeEscalationOrdinal(value: string): number | null {
  const token = value.startsWith('#') ? value.slice(1) : value;
  if (!token || token.length > 2) {
    return null;
  }
  for (const char of token) {
    if (char < '0' || char > '9') {
      return null;
    }
  }
  const parsed = Number(token);
  return Number.isFinite(parsed) ? parsed : null;
}
