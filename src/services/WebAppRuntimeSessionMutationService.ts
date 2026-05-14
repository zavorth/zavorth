import * as http from 'http';
import type { GatewayCanonicalStatePayload } from '../contracts/GatewayContract.js';
import type { WebAppRuntimeRouteDeps } from '../domain/surface/presentation/web-app/WebAppRuntimeRouteService.js';

export type WebAppRuntimeSessionMutationHelpers = {
  buildCanonicalStatePayload: (
    sessionId: string,
    options: {
      includeSessionsList?: boolean;
      historyMode?: 'none' | 'fast' | 'full';
      sessionPlaneMode?: 'none' | 'summary' | 'full';
      snapshotMode?: 'cached' | 'resolved';
      includeMemoryRecall?: boolean;
      includeGateway?: boolean;
      includeApprovalPlane?: boolean;
      includeCapabilityPlane?: boolean;
      includeArtifactPlane?: boolean;
      includeSelfmodPlane?: boolean;
      includeResourcePlane?: boolean;
      includeCompanionPlane?: boolean;
      includeModeEscalation?: boolean;
    },
  ) => Promise<GatewayCanonicalStatePayload>;
};

export class WebAppRuntimeSessionMutationService {
  public async executeCanonicalChatSend(
    body: Record<string, any>,
    deps: WebAppRuntimeRouteDeps,
    helpers: WebAppRuntimeSessionMutationHelpers,
  ): Promise<Record<string, any>> {
    const result = await deps.processChatSend(body);
    const canonicalState = await helpers.buildCanonicalStatePayload(result.sessionId, {
      includeSessionsList: false,
      historyMode: 'fast',
      sessionPlaneMode: 'summary',
      snapshotMode: 'cached',
      includeMemoryRecall: false,
      includeGateway: false,
      includeCapabilityPlane: false,
      includeArtifactPlane: false,
      includeSelfmodPlane: false,
      includeResourcePlane: false,
      includeCompanionPlane: false,
      includeModeEscalation: false,
    });
    return this.buildCanonicalMutationResponse(
      {
        ok: true,
        ...result,
      },
      canonicalState,
    );
  }

  public async executeCanonicalSpawn(
    body: Record<string, any>,
    deps: WebAppRuntimeRouteDeps,
    helpers: WebAppRuntimeSessionMutationHelpers,
  ): Promise<Record<string, any>> {
    const sourceSessionId = String(body.sessionId || '').trim();
    const spawned = await deps.getGatewaySessionTools().spawnSession({
      userId: deps.runtime.webUserId,
      platform: String(body.platform || '').trim() || 'web',
    });
    const newSessionId = String(spawned.sessionId || '').trim();
    if (!newSessionId) {
      throw new Error('O gateway nao conseguiu abrir uma sessao canonica.');
    }
    deps.realtime.ensureSession(newSessionId);

    let seedMessage = String(body.message || '').trim();
    if (!seedMessage && sourceSessionId) {
      const sourceSnapshot = await deps.realtime.getResolvedSnapshot(sourceSessionId);
      seedMessage =
        String(sourceSnapshot.handoff?.handoffPrompt || '').trim()
        || String(sourceSnapshot.continuity?.suggestedAction?.prompt || '').trim();
    }

    if (seedMessage) {
      const result = await deps.processChatSend({
        ...body,
        sessionId: newSessionId,
        message: seedMessage,
      });
      const canonicalState = await helpers.buildCanonicalStatePayload(newSessionId, {
        includeSessionsList: false,
        historyMode: 'fast',
        sessionPlaneMode: 'summary',
        snapshotMode: 'cached',
        includeMemoryRecall: false,
        includeGateway: false,
        includeCapabilityPlane: false,
        includeArtifactPlane: false,
        includeSelfmodPlane: false,
        includeResourcePlane: false,
        includeCompanionPlane: false,
        includeModeEscalation: false,
      });
      return this.buildCanonicalMutationResponse(
        {
          ok: true,
          spawnedFrom: sourceSessionId || null,
          seededPrompt: seedMessage,
          spawn: spawned,
          ...result,
        },
        canonicalState,
      );
    }

    await deps.realtime.captureBaseline(newSessionId);
    const snapshot = await deps.realtime.getResolvedSnapshot(newSessionId);
    const canonicalState = await helpers.buildCanonicalStatePayload(newSessionId, {
      includeSessionsList: false,
      historyMode: 'fast',
      sessionPlaneMode: 'summary',
      snapshotMode: 'cached',
      includeMemoryRecall: false,
      includeGateway: false,
      includeCapabilityPlane: false,
      includeArtifactPlane: false,
      includeSelfmodPlane: false,
      includeResourcePlane: false,
      includeCompanionPlane: false,
      includeModeEscalation: false,
    });
    return this.buildCanonicalMutationResponse(
      {
        ok: true,
        sessionId: newSessionId,
        spawnedFrom: sourceSessionId || null,
        seededPrompt: null,
        spawn: spawned,
        taskId: null,
        snapshot: canonicalState.snapshot || snapshot,
      },
      canonicalState,
    );
  }

  public async handleChatSend(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: WebAppRuntimeRouteDeps,
    helpers: WebAppRuntimeSessionMutationHelpers,
  ): Promise<boolean> {
    try {
      const body = await deps.readJsonBody(req);
      const payload = await this.executeCanonicalChatSend(body, deps, helpers);
      deps.writeJson(res, payload, 200);
    } catch (error: any) {
      deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao enviar mensagem.' }, 400);
    }
    return true;
  }

  public async handleSpawn(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: WebAppRuntimeRouteDeps,
    helpers: WebAppRuntimeSessionMutationHelpers,
  ): Promise<boolean> {
    try {
      const body = await deps.readJsonBody(req);
      const payload = await this.executeCanonicalSpawn(body, deps, helpers);
      deps.writeJson(res, payload, 200);
    } catch (error: any) {
      deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao abrir sessao derivada.' }, 400);
    }
    return true;
  }

  private buildCanonicalMutationResponse(
    payload: Record<string, any>,
    canonicalState: GatewayCanonicalStatePayload,
  ): Record<string, any> {
    return {
      ...payload,
      snapshot: payload.snapshot ?? canonicalState.snapshot,
      agentRuntime: payload.agentRuntime ?? canonicalState.agentRuntime,
      productMode: canonicalState.productMode,
      modeEscalation: canonicalState.modeEscalation,
      gateway: canonicalState.gateway || this.buildLightweightGatewaySnapshot(canonicalState),
      session: canonicalState.session,
      sessions: canonicalState.sessions,
      sessionsSummary: canonicalState.sessionsSummary,
      gatewaySessionTools: canonicalState.gatewaySessionTools,
      memoryPlane: canonicalState.memoryPlane,
      memoryRecall: canonicalState.memoryRecall,
      controlPlane: canonicalState.controlPlane,
      sessionPlane: canonicalState.sessionPlane,
      approvalPlane: canonicalState.approvalPlane,
      capabilityPlane: canonicalState.capabilityPlane,
      artifactPlane: canonicalState.artifactPlane,
      selfmodPlane: canonicalState.selfmodPlane,
      resourcePlane: canonicalState.resourcePlane,
      companionPlane: canonicalState.companionPlane,
      uiSurfaceHints: canonicalState.uiSurfaceHints,
      runtimeWarnings: canonicalState.runtimeWarnings,
      actionRecommendations: canonicalState.actionRecommendations,
    };
  }

  private buildLightweightGatewaySnapshot(canonicalState: GatewayCanonicalStatePayload): Record<string, any> {
    const sessionTargets = Number(
      canonicalState.sessionsSummary?.total
      ?? canonicalState.gatewaySessionTools?.sessionsSummary?.total
      ?? canonicalState.sessions?.total
      ?? (Array.isArray((canonicalState.sessions as { entries?: unknown[] } | null)?.entries)
        ? ((canonicalState.sessions as { entries: unknown[] }).entries.length)
        : Array.isArray(canonicalState.sessions)
          ? canonicalState.sessions.length
          : 0),
    );

    return {
      generatedAt: canonicalState.snapshot?.generatedAt || new Date().toISOString(),
      summary: {
        sessionTargets,
      },
      narrative: {
        headline: sessionTargets > 0
          ? 'Gateway resumido para mutacao canonicamente rastreada.'
          : 'Gateway resumido sem sessoes vinculadas.',
        operatorSummary: `${sessionTargets} alvo(s) de sessao disponivel(is) para continuidade rapida.`,
      },
    };
  }
}

