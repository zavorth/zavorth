import * as http from 'http';
import { randomUUID } from 'crypto';
import type { GatewayCanonicalStatePayload } from '../contracts/GatewayContract.js';
import type { WebAppRuntimeRouteDeps } from '../domain/surface/presentation/web-app/WebAppRuntimeRouteService.js';

type RuntimeRecord = Record<string, unknown>;

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
    body: RuntimeRecord,
    deps: WebAppRuntimeRouteDeps,
    helpers: WebAppRuntimeSessionMutationHelpers,
  ): Promise<RuntimeRecord> {
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
    body: RuntimeRecord,
    deps: WebAppRuntimeRouteDeps,
    helpers: WebAppRuntimeSessionMutationHelpers,
  ): Promise<RuntimeRecord> {
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

  public async executeCanonicalCompact(
    body: RuntimeRecord,
    deps: WebAppRuntimeRouteDeps,
    helpers: WebAppRuntimeSessionMutationHelpers,
  ): Promise<RuntimeRecord> {
    const sessionId = String(body.sessionId || '').trim() || deps.realtime.createSession();
    deps.realtime.ensureSession(sessionId);
    const snapshot = await deps.realtime.getResolvedSnapshot(sessionId);
    const reason = this.redactText(String(body.reason || body.message || '').trim()).slice(0, 500);
    const keepLastMessages = Math.max(0, Math.min(12, Number(body.keepLastMessages || 0) || 0));
    const receiptId = `session-compact-${randomUUID()}`;
    const summary = this.buildCompactionSummary({
      sessionId,
      reason,
      receiptId,
      messages: Array.isArray(snapshot.messages) ? snapshot.messages : [],
      tasks: Array.isArray(snapshot.tasks) ? snapshot.tasks : [],
      permissions: Array.isArray(snapshot.permissions) ? snapshot.permissions : [],
      workflowRuns: Array.isArray(snapshot.workflowRuns) ? snapshot.workflowRuns : [],
      toolRuns: Array.isArray(snapshot.toolRuns) ? snapshot.toolRuns : [],
    });
    const compacted = deps.realtime.compactSessionTranscript(sessionId, summary, {
      receiptId,
      keepLastMessages,
    });
    await deps.realtime.captureBaseline(sessionId);
    const compactedSnapshot = await deps.realtime.getResolvedSnapshot(sessionId);
    const canonicalState = await helpers.buildCanonicalStatePayload(sessionId, {
      includeSessionsList: false,
      historyMode: 'fast',
      sessionPlaneMode: 'summary',
      snapshotMode: 'resolved',
      includeMemoryRecall: false,
      includeGateway: false,
      includeCapabilityPlane: false,
      includeArtifactPlane: false,
      includeSelfmodPlane: false,
      includeResourcePlane: false,
      includeCompanionPlane: false,
      includeModeEscalation: false,
    });
    const receipt = {
      receiptId,
      kind: 'session.compaction',
      generatedAt: compacted.message.createdAt,
      sessionId,
      originalMessageCount: compacted.originalMessageCount,
      retainedMessageCount: compacted.retainedMessageCount,
      keepLastMessages,
      memoryWrite: false,
      rawSecretsSerialized: false,
      activeTranscriptReplaced: true,
      undoAvailable: false,
    };
    return this.buildCanonicalMutationResponse(
      {
        ok: true,
        sessionId,
        taskId: null,
        snapshot: compactedSnapshot,
        compaction: {
          status: 'compacted',
          summary,
          receipt,
        },
        receipt,
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
      deps.writeJson(res, { ok: false, error: errorMessage(error, 'Falha ao enviar mensagem.') }, 400);
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
      deps.writeJson(res, { ok: false, error: errorMessage(error, 'Falha ao abrir sessao derivada.') }, 400);
    }
    return true;
  }

  public async handleCompact(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: WebAppRuntimeRouteDeps,
    helpers: WebAppRuntimeSessionMutationHelpers,
  ): Promise<boolean> {
    try {
      const body = await deps.readJsonBody(req);
      const payload = await this.executeCanonicalCompact(body, deps, helpers);
      deps.writeJson(res, payload, 200);
    } catch (error: any) {
      deps.writeJson(res, { ok: false, error: errorMessage(error, 'Falha ao compactar sessao.') }, 500);
    }
    return true;
  }

  private buildCompactionSummary(input: {
    sessionId: string;
    reason: string;
    receiptId: string;
    messages: RuntimeRecord[];
    tasks: RuntimeRecord[];
    permissions: RuntimeRecord[];
    workflowRuns: RuntimeRecord[];
    toolRuns: RuntimeRecord[];
  }): string {
    const userMessages = input.messages.filter((message) => String(message.role || '').toLowerCase() === 'user');
    const assistantMessages = input.messages.filter((message) => String(message.role || '').toLowerCase() === 'assistant');
    const latestMessages = input.messages
      .filter((message) => String(message.content || '').trim())
      .slice(-12)
      .map((message) => `- ${this.roleLabel(message.role)}: ${this.compactLine(message.content, 220)}`);
    const pendingPermissions = input.permissions
      .filter((permission) => String(permission.status || '').toLowerCase() === 'pending')
      .slice(0, 8)
      .map((permission) => `- approval ${this.compactLine(permission.permissionId || permission.permission_id || permission.id || permission.taskId || permission.task_id || 'pending', 80)}: ${this.compactLine(permission.reason || permission.summary || permission.description || 'waiting for user decision', 160)}`);
    const openTasks = input.tasks
      .filter((task) => !['done', 'completed', 'failed', 'cancelled', 'canceled'].includes(String(task.status || '').toLowerCase()))
      .slice(0, 8)
      .map((task) => `- task ${this.compactLine(task.task_id || task.id || 'open', 80)}: ${this.compactLine(task.title || task.description || task.status || 'open', 160)}`);
    const activeWorkflows = input.workflowRuns
      .filter((run) => !['done', 'completed', 'failed', 'cancelled', 'canceled'].includes(String(run.status || '').toLowerCase()))
      .slice(0, 6)
      .map((run) => `- workflow ${this.compactLine(run.id || run.runId || run.workflowRunId || run.workflow_run_id || 'active', 80)}: ${this.compactLine(run.title || run.workflowName || run.workflow_name || run.status || 'active', 140)}`);
    return [
      'Session compacted.',
      '',
      `Receipt: \`${input.receiptId}\``,
      `Session: \`${this.compactLine(input.sessionId, 120)}\``,
      `Messages read: ${input.messages.length} (${userMessages.length} user, ${assistantMessages.length} assistant).`,
      `Tool runs visible: ${input.toolRuns.length}.`,
      input.reason ? `Reason: ${input.reason}` : '',
      '',
      'Working summary',
      latestMessages.length
        ? latestMessages.join('\n')
        : '- No previous transcript content was available.',
      '',
      'Open items',
      openTasks.length || pendingPermissions.length || activeWorkflows.length
        ? [...openTasks, ...pendingPermissions, ...activeWorkflows].join('\n')
        : '- No open task, workflow, or approval was visible in the current snapshot.',
      '',
      'Safety',
      '- Secrets, tokens, API keys, credentials, and long token-like values were redacted before this summary was written.',
      '- No memory candidate was approved or persisted by this compaction.',
      '- The active transcript was replaced by this summary to reduce future context size.',
    ].filter(Boolean).join('\n');
  }

  private roleLabel(value: unknown): string {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'user') return 'user';
    if (normalized === 'assistant') return 'assistant';
    if (normalized === 'system') return 'system';
    return 'message';
  }

  private compactLine(value: unknown, maxLength: number): string {
    const text = this.redactText(String(value || '').replace(/\s+/g, ' ').trim());
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
  }

  private redactText(value: string): string {
    return String(value || '')
      .replace(/\b(sk-[A-Za-z0-9_-]{8,})\b/g, 'sk-[redacted]')
      .replace(/\b(xox[baprs]-[A-Za-z0-9-]{8,})\b/g, 'xox-[redacted]')
      .replace(/\b(gh[pousr]_[A-Za-z0-9_]{8,})\b/g, 'gh_[redacted]')
      .replace(/\b([A-Za-z0-9+/]{40,}={0,2})\b/g, '[redacted-secret-like-token]')
      .replace(/\b([A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL|AUTHORIZATION)[A-Z0-9_]*)\s*[:=]\s*([^\s"'`,;]+)/gi, '$1=[redacted]');
  }

  private buildCanonicalMutationResponse(
    payload: RuntimeRecord,
    canonicalState: GatewayCanonicalStatePayload,
  ): RuntimeRecord {
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

  private buildLightweightGatewaySnapshot(canonicalState: GatewayCanonicalStatePayload): RuntimeRecord {
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

function errorMessage(error: unknown, fallback: string): string {
  void error;
  return fallback;
}
