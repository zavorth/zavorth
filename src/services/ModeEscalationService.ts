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
    const effectiveMode = matchingGrant
      ? this.buildModeSnapshot(matchingGrant.targetMode)
      : baseMode;

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
  }): ModeEscalationResolution {
    const requestId = String(input.requestId || '').trim();
    if (!requestId) {
      throw new Error('requestId obrigatorio para resolver o mode escalation.');
    }
    const request = this.state.requests.find((entry) => entry.id === requestId);
    if (!request) {
      throw new Error(`Mode escalation nao encontrado: ${requestId}.`);
    }
    if (request.status !== 'pending') {
      return {
        ok: true,
        decision: input.decision,
        request: this.toRequest(request),
        grant: request.resolution.grantId ? this.findGrantById(request.resolution.grantId) : null,
        snapshot: this.buildSnapshot(request.sessionId),
        summary: 'Esse mode escalation ja foi resolvido anteriormente.',
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
        summary: `Escalonamento para ${request.requiredMode} rejeitado; o Zavorth fica no modo atual.`,
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
      summary: `Escalonamento aprovado para ${request.requiredMode} com escopo ${scope}.`,
    };
  }

  public buildSnapshot(sessionId: string): ModeEscalationSnapshot {
    const normalizedSessionId = String(sessionId || '').trim() || 'unknown-session';
    this.pruneResolvedRequests();
    const baseMode = this.buildBaseSnapshot();
    const activeGrant = this.findBestGrant(normalizedSessionId);
    const effectiveMode = activeGrant
      ? this.buildModeSnapshot(activeGrant.targetMode)
      : baseMode;
    const pendingRequest = this.state.requests.find((entry) =>
      entry.sessionId === normalizedSessionId
      && entry.status === 'pending');
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
      status: pendingRequest
        ? 'pending'
        : activeGrants.length > 0 && effectiveMode.id !== baseMode.id
          ? 'elevated'
          : 'clear',
      activeGrants,
      pendingRequest: pendingRequest ? this.toRequest(pendingRequest) : null,
      recentRequests,
      commands: {
        show: '/mode',
        approve: '/mode approve <requestId> [once|session|host]',
        reject: '/mode reject <requestId>',
        inspect: '/api/web/runtime/mode-escalation?sessionId=:id',
        resolve: '/api/web/runtime/mode-escalation/resolve',
      },
    };
  }

  private resolveRequiredMode(message: string, impact: TaskResourceImpact | null): RequiredModeResolution {
    const normalized = String(message || '').toLowerCase();
    let requiredMode: ZavorthProductMode = 'chat';
    const reasons: string[] = [];

    if (/(arquivo|anexo|pdf|documento|planilha|artifact|artifacts|workspace)/i.test(normalized)) {
      requiredMode = this.maxMode(requiredMode, 'assistant');
      reasons.push('a tarefa pede contexto de arquivos ou artifacts do workspace');
    }

    if (/(codigo|code|diff|patch|editar|edit|commit|terminal|shell|build|teste|test|refactor|selfmod)/i.test(normalized)) {
      requiredMode = this.maxMode(requiredMode, 'builder');
      reasons.push('a tarefa pede trilha de construcao com diff, tool cards ou selfmod');
    }

    const capabilityIds = impact?.budget?.capabilityIds || [];
    if (capabilityIds.some((entry) => ['qa', 'media', 'sandbox'].includes(String(entry || '').trim()))) {
      requiredMode = this.maxMode(requiredMode, 'builder');
      reasons.push('o planner detectou capability tecnica que costuma exigir modo builder');
    }

    if (
      /(watch mode|computer use|runtime|mesh|node host|node mesh|companion|docker|wsl|rollout|observability|gateway|tunnel|cloudflare|discord|zavorthBridge|remote)/i.test(normalized)
      || (impact?.budget?.companionDependencies?.length || 0) > 0
      || capabilityIds.some((entry) => ['watch-mode', 'remote', 'public-tunnel', 'recurring-automation'].includes(String(entry || '').trim()))
    ) {
      requiredMode = this.maxMode(requiredMode, 'operator');
      reasons.push('a tarefa pede controle operacional, companion ou exposure alem do modo basico');
    }

    const recommendedScope =
      impact?.budget?.recurring || impact?.budget?.externalExposure === 'public'
        ? 'host'
        : (impact?.heavy || (impact?.budget?.companionDependencies?.length || 0) > 0)
          ? 'session'
          : 'once';

    const fallback = impact?.budget?.fallback
      || (requiredMode === 'operator'
        ? 'Posso continuar no modo atual e sugerir um caminho mais leve, sem companions nem exposicao adicional.'
        : requiredMode === 'builder'
          ? 'Posso continuar no modo atual e manter a resposta apenas conceitual, sem diff nem execucao.'
          : 'Posso continuar apenas no modo de conversa simples.');

    return {
      requiredMode,
      reason: reasons[0] || 'a tarefa pede uma trilha mais poderosa do que o modo atual',
      reasons: reasons.length > 0 ? reasons : ['o pedido atual excede o modo visivel/ativo do Zavorth'],
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
    return this.state.requests.find((entry) =>
      entry.sessionId === sessionId
      && entry.requiredMode === requiredMode
      && entry.status === 'pending'
      && entry.intent === intent) || null;
  }

  private findMatchingGrant(
    sessionId: string,
    requiredMode: ZavorthProductMode,
  ): PersistedModeEscalationGrant | null {
    return this.state.grants.find((entry) =>
      this.isGrantVisibleForSession(entry, sessionId)
      && this.compareModes(entry.targetMode, requiredMode) >= 0) || null;
  }

  private findBestGrant(sessionId: string): PersistedModeEscalationGrant | null {
    return this.state.grants
      .filter((entry) => this.isGrantVisibleForSession(entry, sessionId))
      .sort((left, right) => this.compareModes(right.targetMode, left.targetMode))[0] || null;
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
      summary: `Para cumprir "${entry.intent}", eu preciso subir de ${entry.effectiveMode} para ${entry.requiredMode}. Motivo principal: ${entry.reason}.`,
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
    const normalized = String(scope || '').trim().toLowerCase();
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
    } catch (error: unknown) {// Keep runtime resilient even if the persisted file was corrupted.
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
