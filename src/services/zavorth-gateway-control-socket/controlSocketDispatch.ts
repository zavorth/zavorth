import { normalizeGatewayControlReplayMode } from './controlSocketProtocol.js';
import type {
  GatewayConnectionState,
  GatewayControlReplayMode,
  GatewayControlSocketDeps,
  GatewayControlSocketRequest,
  GatewayControlSocketSendError,
  GatewayControlSocketSendResponse,
} from './controlSocketTypes.js';
import type { ZavorthGatewayRuntimeSnapshot } from '../ZavorthGatewayRuntimeService.js';

function parseGatewayControlSocketRequest(rawMessage: string): GatewayControlSocketRequest {
  return JSON.parse(rawMessage);
}

function getRequestParams(request: GatewayControlSocketRequest): Record<string, unknown> {
  return request.params && typeof request.params === 'object'
    ? request.params
    : {};
}

function getTargetSessionId(params: Record<string, unknown>, state: GatewayConnectionState): string {
  return String(params.sessionId || '').trim() || state.sessionId;
}

async function buildRuntimeForSession(
  deps: GatewayControlSocketDeps,
  sessionId: string,
): Promise<ZavorthGatewayRuntimeSnapshot> {
  return deps.buildRuntime({
    sessionId,
    chatId: deps.getChatId(sessionId),
    userId: deps.getUserId(),
  });
}

export async function handleGatewayControlSocketMessage(input: {
  rawMessage: string;
  state: GatewayConnectionState;
  deps: GatewayControlSocketDeps;
  activateSession: (sessionId: string, replayMode: GatewayControlReplayMode) => Promise<void>;
  sendResponse: GatewayControlSocketSendResponse;
  sendError: GatewayControlSocketSendError;
}): Promise<void> {
  let request: GatewayControlSocketRequest;
  try {
    request = parseGatewayControlSocketRequest(input.rawMessage);
  } catch (error: any) {
    input.sendError(null, 'invalid_json', 'A mensagem do gateway precisa ser JSON valido.');
    return;
  }

  const method = String(request.method || '').trim();
  const params = getRequestParams(request);
  const requestId = request.id ? String(request.id) : null;
  const targetSessionId = getTargetSessionId(params, input.state);

  try {
    if (method === 'hello') {
      const runtime = await buildRuntimeForSession(input.deps, input.state.sessionId);
      input.sendResponse(requestId, {
        sessionId: input.state.sessionId,
        chatId: input.deps.getChatId(input.state.sessionId),
        controlPlane: runtime.controlPlane,
      });
      return;
    }

    if (method === 'ping') {
      input.sendResponse(requestId, {
        pong: true,
        sessionId: input.state.sessionId,
        createdAt: new Date().toISOString(),
      });
      return;
    }

    if (method === 'subscribe') {
      const replayMode = normalizeGatewayControlReplayMode(params.replayMode);
      await input.activateSession(targetSessionId, replayMode);
      input.sendResponse(requestId, {
        sessionId: input.state.sessionId,
        chatId: input.deps.getChatId(input.state.sessionId),
        replayMode,
      });
      return;
    }

    if (method === 'session.create') {
      const payload = await input.deps.spawnSession({
        sessionId: String(params.sessionId || '').trim() || input.state.sessionId,
        message: String(params.message || '').trim() || undefined,
        platform: String(params.platform || '').trim() || 'web',
      });
      const newSessionId = String((payload as { sessionId?: string; spawn?: { sessionId?: string } }).sessionId || (payload as { sessionId?: string; spawn?: { sessionId?: string } }).spawn?.sessionId || '').trim();
      if (newSessionId) {
        await input.activateSession(newSessionId, 'full');
      }
      input.sendResponse(requestId, payload);
      return;
    }

    if (method === 'session.state') {
      const activate = params.activate === true;
      if (activate && targetSessionId !== input.state.sessionId) {
        await input.activateSession(
          targetSessionId,
          normalizeGatewayControlReplayMode(params.replayMode),
        );
      }
      const payload = await input.deps.buildCanonicalState(targetSessionId);
      input.sendResponse(requestId, payload);
      return;
    }

    if (method === 'session.list') {
      const payload = await input.deps.buildCanonicalHistory(targetSessionId);
      input.sendResponse(requestId, {
        sessionId: targetSessionId,
        sessions: payload.sessions,
        sessionsSummary: payload.sessionsSummary,
        gatewaySessionTools: payload.gatewaySessionTools,
      });
      return;
    }

    if (method === 'session.patch') {
      const payload = await input.deps.patchSession({
        sessionId: targetSessionId,
        label: typeof params.label === 'string' ? params.label : (params.label === null ? null : undefined),
        workspaceHint: typeof params.workspaceHint === 'string' ? params.workspaceHint : (params.workspaceHint === null ? null : undefined),
        pinned: typeof params.pinned === 'boolean' ? params.pinned : undefined,
        modelProfile: typeof params.modelProfile === 'string' ? params.modelProfile : (params.modelProfile === null ? null : undefined),
      });
      input.sendResponse(requestId, payload);
      return;
    }

    if (method === 'chat.history') {
      const payload = await input.deps.buildCanonicalHistory(targetSessionId);
      input.sendResponse(requestId, payload);
      return;
    }

    if (method === 'chat.send') {
      const payload = await input.deps.processChatSend({
        ...params,
        sessionId: targetSessionId,
        platform: String(params.platform || '').trim() || 'web',
      });
      const resultSessionId = String(payload.sessionId || '').trim() || targetSessionId;
      if (resultSessionId && resultSessionId !== input.state.sessionId) {
        await input.activateSession(resultSessionId, 'state');
      }
      input.sendResponse(requestId, payload);
      return;
    }

    if (method === 'approval.list') {
      const payload = await input.deps.listApprovals(targetSessionId, Number(params.limit || 20) || 20);
      input.sendResponse(requestId, payload);
      return;
    }

    if (method === 'approval.resolve') {
      const decision = String(params.decision || '').trim().toLowerCase();
      if (decision !== 'approve' && decision !== 'reject') {
        input.sendError(requestId, 'invalid_params', 'approval.resolve exige decision approve|reject.');
        return;
      }
      const payload = await input.deps.resolveApproval({
        approvalId: String(params.approvalId || '').trim(),
        decision,
        sessionId: targetSessionId,
        scope: String(params.scope || params.mode || '').trim() || null,
        approvalCode: String(params.approvalCode || '').trim() || null,
        requestedBy: input.deps.getUserId(),
      });
      input.sendResponse(requestId, payload);
      return;
    }

    if (method === 'artifact.list') {
      const payload = await input.deps.listArtifacts({
        sessionId: targetSessionId,
        toolRunId: String(params.toolRunId || '').trim() || null,
      });
      input.sendResponse(requestId, payload);
      return;
    }

    if (method === 'artifact.diff') {
      const toolRunId = String(params.toolRunId || '').trim();
      if (!toolRunId) {
        input.sendError(requestId, 'invalid_params', 'artifact.diff exige toolRunId.');
        return;
      }
      const payload = await input.deps.readArtifactDiff({
        sessionId: targetSessionId,
        toolRunId,
        path: String(params.path || '').trim() || null,
      });
      input.sendResponse(requestId, payload);
      return;
    }

    if (method === 'memory.recall.preview') {
      const payload = await input.deps.previewMemoryRecall({
        sessionId: targetSessionId,
        query: String(params.query || params.q || '').trim() || null,
        limit: Number(params.limit || 0) || null,
      });
      input.sendResponse(requestId, payload);
      return;
    }

    if (method === 'memory.sources.list') {
      const payload = await input.deps.listMemorySources({
        sessionId: targetSessionId,
      });
      input.sendResponse(requestId, payload);
      return;
    }

    if (method === 'runtime.mode.get') {
      const payload = await input.deps.getProductMode();
      input.sendResponse(requestId, payload);
      return;
    }

    if (method === 'runtime.mode.set') {
      const mode = String(params.mode || '').trim();
      if (!mode) {
        input.sendError(requestId, 'invalid_params', 'runtime.mode.set exige mode.');
        return;
      }
      const payload = await input.deps.setProductMode({
        mode,
        requestedBy: input.deps.getUserId(),
      });
      input.sendResponse(requestId, payload);
      return;
    }

    if (method === 'runtime.modeEscalation.get') {
      const payload = await input.deps.getModeEscalation({
        sessionId: targetSessionId,
      });
      input.sendResponse(requestId, payload);
      return;
    }

    if (method === 'runtime.modeEscalation.resolve') {
      const requestIdParam = String(params.requestId || '').trim();
      const decision = String(params.decision || '').trim().toLowerCase();
      if (!requestIdParam || (decision !== 'approve' && decision !== 'reject')) {
        input.sendError(
          requestId,
          'invalid_params',
          'runtime.modeEscalation.resolve exige requestId e decision approve/reject.',
        );
        return;
      }
      const payload = await input.deps.resolveModeEscalation({
        requestId: requestIdParam,
        decision,
        scope: String(params.scope || '').trim() || null,
        requestedBy: String(params.requestedBy || input.deps.getUserId() || '').trim() || 'gateway-ws',
      });
      input.sendResponse(requestId, payload);
      return;
    }

    if (method === 'capability.list') {
      const payload = await input.deps.listCapabilities();
      input.sendResponse(requestId, payload);
      return;
    }

    if (method === 'capability.enable') {
      const capabilityId = String(params.capabilityId || '').trim();
      if (!capabilityId) {
        input.sendError(requestId, 'invalid_params', 'capability.enable exige capabilityId.');
        return;
      }
      const payload = await input.deps.enableCapability({
        capabilityId,
        sessionId: targetSessionId,
        scope: String(params.scope || '').trim() || null,
        reason: String(params.reason || '').trim() || null,
        requestedBy: input.deps.getUserId(),
        sourceSurface: 'gateway-ws',
      });
      input.sendResponse(requestId, payload);
      return;
    }

    if (method === 'capability.disable') {
      const capabilityId = String(params.capabilityId || '').trim();
      if (!capabilityId) {
        input.sendError(requestId, 'invalid_params', 'capability.disable exige capabilityId.');
        return;
      }
      const payload = await input.deps.disableCapability({
        capabilityId,
        requestedBy: input.deps.getUserId(),
      });
      input.sendResponse(requestId, payload);
      return;
    }

    if (method === 'selfmod.preview') {
      const mode = String(params.mode || '').trim().toLowerCase() === 'goal' ? 'goal' : 'file';
      const payload = await input.deps.previewSelfmod({
        mode,
        filePath: String(params.filePath || '').trim() || null,
        instruction: String(params.instruction || '').trim() || null,
        goal: String(params.goal || '').trim() || null,
        requestedBy: input.deps.getUserId(),
      });
      input.sendResponse(requestId, payload);
      return;
    }

    if (method === 'selfmod.apply') {
      const previewId = String(params.previewId || '').trim();
      if (!previewId) {
        input.sendError(requestId, 'invalid_params', 'selfmod.apply exige previewId.');
        return;
      }
      const payload = await input.deps.applySelfmod({
        previewId,
        sessionId: targetSessionId,
        requestedBy: input.deps.getUserId(),
      });
      input.sendResponse(requestId, payload);
      return;
    }

    if (method === 'selfmod.rollback') {
      const changeId = String(params.changeId || '').trim();
      if (!changeId) {
        input.sendError(requestId, 'invalid_params', 'selfmod.rollback exige changeId.');
        return;
      }
      const payload = await input.deps.rollbackSelfmod({
        changeId,
        requestedBy: input.deps.getUserId(),
      });
      input.sendResponse(requestId, payload);
      return;
    }

    if (method === 'gateway.runtime') {
      const payload = await buildRuntimeForSession(input.deps, targetSessionId);
      input.sendResponse(requestId, payload);
      return;
    }

    if (method === 'chat.abort') {
      const payload = await input.deps.abortChat({
        sessionId: targetSessionId,
        requestedBy: input.deps.getUserId(),
      });
      input.sendResponse(requestId, payload);
      return;
    }

    input.sendError(
      requestId,
      'unknown_method',
      `Metodo ${method || '(vazio)'} ainda nao existe neste gateway.`,
    );
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Falha ao executar o metodo do gateway.';
    input.sendError(
      requestId,
      'request_failed',
      message,
    );
  }
}
