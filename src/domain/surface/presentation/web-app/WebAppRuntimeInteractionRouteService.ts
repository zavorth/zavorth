import * as http from 'http';
import {
  isWebAppRuntimeCanonicalSessionSendRoute,
  isWebAppRuntimeCanonicalSessionSpawnRoute,
} from './web-app-runtime-route/WebAppRuntimeRouteHelpers.js';
import { shouldPersistZavorthArtifacts } from '../../../../contracts/ZavorthResponseDecisionContract.js';
import { RemoteMeshNotebookMcpProxyService } from '../../../../services/RemoteMeshNotebookMcpProxyService.js';
import type { WebAppRuntimeRouteDeps } from './WebAppRuntimeRouteService.js';

export type WebAppRuntimeInteractionRouteHelpers = {
  buildCanonicalSessionBundle: (
    sessionId: string,
    options: {
      includeSessionsList?: boolean;
      historyMode?: 'none' | 'fast' | 'full';
      includeGateway?: boolean;
    },
  ) => Promise<Record<string, any>>;
  handleChatSend: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) => Promise<boolean>;
  handleSpawn: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) => Promise<boolean>;
};

export class WebAppRuntimeInteractionRouteService {
  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    pathname: string,
    deps: WebAppRuntimeRouteDeps,
    helpers: WebAppRuntimeInteractionRouteHelpers,
  ): Promise<boolean> {
    if (pathname === '/api/web/catalog' && req.method === 'GET') {
      const requestedSessionId = String(url.searchParams.get('sessionId') || '').trim();
      const chatId = requestedSessionId
        ? deps.realtime.getChatId(requestedSessionId)
        : null;
      const catalog = await deps.getComposerCatalog().getCatalog(chatId);
      deps.writeJson(res, { ok: true, catalog }, 200);
      return true;
    }

    if (pathname === '/api/web/file-preview' && req.method === 'GET') {
      try {
        const targetPath = String(url.searchParams.get('path') || '').trim();
        if (!targetPath) {
          deps.writeJson(res, { ok: false, error: 'path obrigatorio.' }, 400);
          return true;
        }

        const preview = deps.consoleAssets.readPreviewFile(targetPath);
        deps.writeJson(res, { ok: true, preview }, 200);
      } catch (error: any) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao carregar preview.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/file-asset' && req.method === 'GET') {
      return this.handleFileAssetRequest(res, url, deps);
    }

    if (pathname === '/api/web/tasks' && req.method === 'GET') {
      const sessionId = deps.resolveSessionId(url);
      const canonicalBundle = await helpers.buildCanonicalSessionBundle(sessionId, {
        includeSessionsList: false,
        historyMode: 'fast',
        includeGateway: false,
      });
      const tasks = canonicalBundle.session?.tasks || (await deps.realtime.getResolvedSnapshot(sessionId)).tasks;
      deps.writeJson(
        res,
        {
          ok: true,
          tasks,
          gateway: canonicalBundle.gateway,
          session: canonicalBundle.session,
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/artifacts' && req.method === 'GET') {
      return this.handleArtifactsRequest(res, url, deps);
    }

    if (pathname === '/api/web/dashboard/events' && req.method === 'GET') {
      return this.handleDashboardEventsRequest(res, url, deps);
    }

    if (pathname === '/api/web/tool-runs' && req.method === 'GET') {
      const sessionId = deps.resolveSessionId(url);
      const snapshot = await deps.realtime.getResolvedSnapshot(sessionId);
      const toolRuns = Array.isArray((snapshot as any).toolRuns) ? (snapshot as any).toolRuns : [];
      deps.writeJson(
        res,
        {
          ok: true,
          sessionId,
          toolRuns,
          filesTouched: Array.from(new Set(toolRuns.flatMap((run: any) => this.shouldExposeArtifactsForRecord(run) && Array.isArray(run?.filesTouched) ? run.filesTouched : []))),
          artifacts: Array.from(new Map(
            toolRuns
              .flatMap((run: any) => this.shouldExposeArtifactsForRecord(run) && Array.isArray(run?.artifacts) ? run.artifacts : [])
              .map((artifact: any) => [
                String(artifact?.id || artifact?.key || artifact?.path || artifact?.name || ''),
                artifact,
              ]),
          ).values()).filter((artifact: any) => artifact && (artifact.id || artifact.key || artifact.path || artifact.name)),
        },
        200,
      );
      return true;
    }

    if (pathname.startsWith('/api/web/tool-runs/') && pathname.endsWith('/diff') && req.method === 'GET') {
      const sessionId = deps.resolveSessionId(url);
      const runId = decodeURIComponent(pathname.slice('/api/web/tool-runs/'.length, -'/diff'.length));
      const snapshot = await deps.realtime.getResolvedSnapshot(sessionId);
      const toolRuns = Array.isArray((snapshot as any).toolRuns) ? (snapshot as any).toolRuns : [];
      const toolRun = toolRuns.find((run: any) => String(run?.runId || '').trim() === runId) || null;
      if (!toolRun) {
        deps.writeJson(res, { ok: false, error: 'Tool run nao encontrado para esta sessao.' }, 404);
        return true;
      }
      deps.writeJson(
        res,
        {
          ok: true,
          sessionId,
          runId,
          diff: this.shouldExposeArtifactsForRecord(toolRun) ? toolRun.diff || { summary: null, patches: [] } : { summary: null, patches: [] },
          filesTouched: this.shouldExposeArtifactsForRecord(toolRun) && Array.isArray(toolRun.filesTouched) ? toolRun.filesTouched : [],
          artifacts: this.shouldExposeArtifactsForRecord(toolRun) && Array.isArray(toolRun.artifacts) ? toolRun.artifacts : [],
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/permissions' && req.method === 'GET') {
      const sessionId = deps.resolveSessionId(url);
      const canonicalBundle = await helpers.buildCanonicalSessionBundle(sessionId, {
        includeSessionsList: false,
        historyMode: 'fast',
        includeGateway: false,
      });
      const permissions = canonicalBundle.session?.permissions || (await deps.realtime.getResolvedSnapshot(sessionId)).permissions;
      deps.writeJson(
        res,
        {
          ok: true,
          permissions,
          gateway: canonicalBundle.gateway,
          session: canonicalBundle.session,
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/remote-mesh/notebook/mcp' && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      const result = await RemoteMeshNotebookMcpProxyService.fromEnv().apply({
        toolName: body.toolName,
        arguments: body.arguments,
      });
      deps.writeJson(res, result, result.ok ? 200 : result.status === 'blocked' ? 400 : 502);
      return true;
    }

    if (isWebAppRuntimeCanonicalSessionSendRoute(pathname) && req.method === 'POST') {
      return helpers.handleChatSend(req, res);
    }

    if (isWebAppRuntimeCanonicalSessionSpawnRoute(pathname) && req.method === 'POST') {
      return helpers.handleSpawn(req, res);
    }

    if (pathname === '/api/web/permissions/approve' && req.method === 'POST') {
      return this.handlePermissionDecision(req, res, deps, 'approve');
    }

    if (pathname === '/api/web/permissions/reject' && req.method === 'POST') {
      return this.handlePermissionDecision(req, res, deps, 'reject');
    }

    if (pathname === '/api/web/tasks/approve' && req.method === 'POST') {
      return this.handleTaskDecision(req, res, deps, 'approve');
    }

    if (pathname === '/api/web/tasks/reject' && req.method === 'POST') {
      return this.handleTaskDecision(req, res, deps, 'reject');
    }

    if (pathname === '/api/web/agent-runs/approve' && req.method === 'POST') {
      return this.handleAgentRunDecision(req, res, deps, 'approve');
    }

    if (pathname === '/api/web/agent-runs/reject' && req.method === 'POST') {
      return this.handleAgentRunDecision(req, res, deps, 'reject');
    }

    if (pathname === '/api/web/agent-runs/apply-draft' && req.method === 'POST') {
      return this.handleAgentRunDraftApply(req, res, deps);
    }

    if (pathname === '/api/web/agent-runs/demote-fabric' && req.method === 'POST') {
      return this.handleAgentRunFabricDemote(req, res, deps);
    }

    if (pathname === '/api/web/events' && req.method === 'GET') {
      const sessionId = deps.resolveSessionId(url);
      deps.realtime.ensureSession(sessionId);
      await deps.realtime.captureBaseline(sessionId);
      deps.openEventStream(req, res, sessionId);
      return true;
    }

    return false;
  }

  private handleFileAssetRequest(
    res: http.ServerResponse,
    url: URL,
    deps: WebAppRuntimeRouteDeps,
  ): boolean {
    try {
      const targetPath = String(url.searchParams.get('path') || '').trim();
      if (!targetPath) {
        deps.writeJson(res, { ok: false, error: 'path obrigatorio.' }, 400);
        return true;
      }

      const asset = deps.consoleAssets.readPreviewAsset(targetPath);
      res.statusCode = 200;
      res.setHeader('Content-Type', asset.contentType);
      res.setHeader('Content-Length', String(asset.size));
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(asset.filename)}"`);
      res.end(asset.content);
    } catch (error: any) {
      deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao carregar asset.' }, 400);
    }
    return true;
  }

  private async handleArtifactsRequest(
    res: http.ServerResponse,
    url: URL,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<boolean> {
    const sessionId = deps.resolveSessionId(url);
    const snapshot = await deps.realtime.getResolvedSnapshot(sessionId);
    const toolRuns = Array.isArray((snapshot as any).toolRuns) ? (snapshot as any).toolRuns : [];
    const agentSnapshot = deps.agentGateway?.buildSnapshot({
      activeSessionId: sessionId,
    }) || null;
    const runs = Array.isArray(agentSnapshot?.runs) ? agentSnapshot.runs : [];
    const artifacts = this.collectArtifactEntries({
      sessionId,
      toolRuns,
      runs,
    });
    deps.writeJson(
      res,
      {
        ok: true,
        generatedAt: new Date().toISOString(),
        sessionId,
        artifacts,
        filesTouched: Array.from(new Set(
          toolRuns.flatMap((run: any) => Array.isArray(run?.filesTouched) ? run.filesTouched : []),
        )),
        toolRuns,
        runs,
      },
      200,
    );
    return true;
  }

  private async handleDashboardEventsRequest(
    res: http.ServerResponse,
    url: URL,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<boolean> {
    const sessionId = deps.resolveSessionId(url);
    deps.realtime.ensureSession(sessionId);
    const snapshot = await deps.realtime.getResolvedSnapshot(sessionId);
    const agentSnapshot = deps.agentGateway?.buildSnapshot({
      activeSessionId: sessionId,
    }) || null;
    const runs = Array.isArray(agentSnapshot?.runs) ? agentSnapshot.runs : [];
    const runId = String(url.searchParams.get('runId') || '').trim();
    const traceId = String(url.searchParams.get('traceId') || '').trim();
    const events = this.buildDashboardEvents({
      sessionId,
      snapshot,
      runs,
      runId,
      traceId,
    });
    deps.writeJson(
      res,
      {
        ok: true,
        generatedAt: new Date().toISOString(),
        sessionId,
        query: {
          runId: runId || null,
          traceId: traceId || null,
        },
        source: 'persistent-session-history',
        summary: this.buildDashboardEventSummary(events),
        events,
      },
      200,
    );
    return true;
  }

  private buildDashboardEvents(input: {
    sessionId: string;
    snapshot: any;
    runs: any[];
    runId?: string;
    traceId?: string;
  }): Record<string, any>[] {
    const events: Record<string, any>[] = [];
    const pushEvent = (event: Record<string, any>) => {
      const id = String(event.id || '').trim();
      if (!id) return;
      events.push({
        ...event,
        id,
        source: event.source || 'dashboard-history',
        sessionId: input.sessionId,
      });
    };

    const messages = Array.isArray(input.snapshot?.messages) ? input.snapshot.messages : [];
    for (const message of messages) {
      const messageId = String(message?.id || '').trim();
      const role = String(message?.role || '').trim().toLowerCase();
      const content = String(message?.content || '').trim();
      if (!messageId || !content) continue;
      pushEvent({
        id: `message:${messageId}`,
        type: role === 'user' ? 'request' : 'reply',
        title: role === 'user' ? 'Pedido recebido' : 'Resposta registrada',
        detail: content,
        meta: String(message?.kind || role || 'message').trim(),
        status: role || 'message',
        time: message?.createdAt || message?.created_at || null,
        runId: message?.runId || message?.agentRunId || null,
        traceId: message?.traceId || null,
      });
    }

    const tasks = Array.isArray(input.snapshot?.tasks) ? input.snapshot.tasks : [];
    for (const task of tasks) {
      const taskId = String(task?.task_id || task?.id || '').trim();
      if (!taskId) continue;
      const status = String(task?.status || 'queued').trim();
      pushEvent({
        id: `task:${taskId}:${status}`,
        type: this.isFailureStatus(status) ? 'error' : 'step',
        title: String(task?.command_type || task?.title || 'Task runtime').trim(),
        detail: String(task?.result_summary || task?.error_summary || task?.raw_message || '').trim(),
        meta: String(task?.risk_level || task?.executor_used || 'task').trim(),
        status,
        time: task?.updated_at || task?.created_at || null,
        runId: task?.runId || task?.agentRunId || null,
        traceId: task?.traceId || null,
      });
    }

    const permissions = Array.isArray(input.snapshot?.permissions) ? input.snapshot.permissions : [];
    for (const permission of permissions) {
      const permissionId = String(permission?.permission_id || permission?.id || '').trim();
      if (!permissionId) continue;
      const status = String(permission?.status || 'pending').trim();
      pushEvent({
        id: `permission:${permissionId}:${status}`,
        type: 'approval',
        title: String(permission?.kind || permission?.executor || 'Approval pendente').trim(),
        detail: String(permission?.reason || permission?.requested_value || '').trim(),
        meta: String(permission?.scope || permission?.executor || 'permission').trim(),
        status,
        time: permission?.updated_at || permission?.created_at || null,
        runId: permission?.runId || permission?.agentRunId || permission?.correlation?.runId || null,
        traceId: permission?.traceId || permission?.correlation?.traceId || null,
      });
    }

    const toolRuns = Array.isArray(input.snapshot?.toolRuns) ? input.snapshot.toolRuns : [];
    for (const toolRun of toolRuns) {
      const toolRunId = String(toolRun?.runId || toolRun?.id || '').trim();
      if (!toolRunId) continue;
      const status = String(toolRun?.status || 'done').trim();
      pushEvent({
        id: `tool:${toolRunId}:${status}`,
        type: this.isFailureStatus(status) ? 'error' : 'receipt',
        title: String(toolRun?.toolName || toolRun?.name || 'Tool receipt').trim(),
        detail: String(toolRun?.summary || toolRun?.resultSummary || toolRun?.error || '').trim(),
        meta: 'tool-run',
        status,
        time: toolRun?.updatedAt || toolRun?.updated_at || toolRun?.createdAt || toolRun?.created_at || null,
        runId: toolRun?.runId || toolRun?.agentRunId || null,
        traceId: toolRun?.traceId || null,
        receipt: {
          id: toolRun?.receiptId || toolRunId,
          status,
          summary: toolRun?.summary || toolRun?.resultSummary || toolRun?.error || '',
          artifact: Array.isArray(toolRun?.artifacts) ? toolRun.artifacts[0]?.id || toolRun.artifacts[0]?.path : null,
        },
        replay: {
          runId: toolRun?.runId || toolRun?.agentRunId || toolRunId,
          traceId: toolRun?.traceId || null,
          sessionId: input.sessionId,
          policy: 'receipts only',
        },
      });
    }

    const workflowRuns = Array.isArray(input.snapshot?.workflowRuns) ? input.snapshot.workflowRuns : [];
    for (const workflow of workflowRuns) {
      const workflowId = String(workflow?.workflow_run_id || workflow?.id || '').trim();
      if (!workflowId) continue;
      const status = String(workflow?.status || 'running').trim();
      pushEvent({
        id: `workflow:${workflowId}:${status}`,
        type: this.isFailureStatus(status) ? 'error' : 'step',
        title: String(workflow?.workflow_name || workflow?.objective || 'Workflow runtime').trim(),
        detail: String(workflow?.objective || workflow?.resume_prompt || '').trim(),
        meta: 'workflow',
        status,
        time: workflow?.updated_at || workflow?.created_at || null,
        runId: workflow?.runId || workflow?.agentRunId || null,
        traceId: workflow?.traceId || null,
      });
    }

    for (const run of input.runs) {
      const runId = String(run?.id || run?.runId || '').trim();
      if (!runId) continue;
      const status = String(run?.status || 'running').trim();
      pushEvent({
        id: `agent-run:${runId}:${status}`,
        type: this.isFailureStatus(status) ? 'error' : 'step',
        title: String(run?.title || run?.objective || 'Agent run').trim(),
        detail: String(run?.summary || run?.text || run?.objective || '').trim(),
        meta: String(run?.modelProfile?.modelLabel || run?.model || 'agent-run').trim(),
        status,
        time: run?.updatedAt || run?.createdAt || null,
        runId,
        traceId: run?.traceId || null,
        replay: {
          runId,
          traceId: run?.traceId || null,
          sessionId: run?.sessionId || input.sessionId,
          policy: 'receipts only',
        },
      });
    }

    const runFilter = String(input.runId || '').trim();
    const traceFilter = String(input.traceId || '').trim();
    return Array.from(new Map(events.map((event) => [event.id, event])).values())
      .filter((event) => {
        if (!runFilter && !traceFilter) return true;
        const eventRunId = String(event.runId || event.agentRunId || event.toolRunId || event.workflowRunId || event.replay?.runId || '').trim();
        const eventTraceId = String(event.traceId || event.replay?.traceId || '').trim();
        return Boolean((runFilter && eventRunId === runFilter) || (traceFilter && eventTraceId === traceFilter));
      })
      .sort((a, b) => this.eventTimeMs(a) - this.eventTimeMs(b))
      .slice(-90);
  }

  private buildDashboardEventSummary(events: Record<string, any>[]): Record<string, number> {
    const byType = (type: string) => events.filter((event) => String(event.type || '') === type).length;
    return {
      totalEvents: events.length,
      runs: byType('request'),
      approvals: byType('approval'),
      artifacts: byType('receipt'),
      errors: byType('error'),
    };
  }

  private eventTimeMs(event: Record<string, any>): number {
    const date = new Date(String(event.time || event.createdAt || event.created_at || ''));
    return Number.isFinite(date.getTime()) ? date.getTime() : 0;
  }

  private isFailureStatus(status: unknown): boolean {
    return /failed|error|blocked|rejected|cancelled|canceled/i.test(String(status || ''));
  }

  private collectArtifactEntries(input: {
    sessionId: string;
    toolRuns: any[];
    runs: any[];
  }): any[] {
    const artifacts: any[] = [];
    const pushArtifact = (artifact: Record<string, any>) => {
      const id = String(artifact.id || artifact.key || '').trim();
      if (!id) return;
      artifacts.push({
        ...artifact,
        id,
        title: String(artifact.title || artifact.name || artifact.path || id).trim(),
        kind: this.resolveArtifactKind(artifact),
        status: String(artifact.status || 'ready').trim(),
      });
    };

    for (const run of input.toolRuns) {
      if (!this.shouldExposeArtifactsForRecord(run)) {
        continue;
      }
      const toolRunId = String(run?.runId || run?.id || '').trim();
      const runArtifacts = Array.isArray(run?.artifacts) ? run.artifacts : [];
      runArtifacts.forEach((artifact: any, index: number) => {
        const path = String(artifact?.path || artifact?.filePath || '').trim();
        const name = String(artifact?.name || artifact?.title || this.basename(path) || '').trim();
        pushArtifact({
          ...artifact,
          id: String(artifact?.id || artifact?.key || `${toolRunId}:artifact:${path || name || index}`).trim(),
          source: 'tool-run',
          sessionId: input.sessionId,
          toolRunId,
          path: path || null,
          name: name || null,
          summary: artifact?.summary || artifact?.description || run?.summary || null,
        });
      });

      const filesTouched = Array.isArray(run?.filesTouched) ? run.filesTouched : [];
      filesTouched.forEach((filePath: any, index: number) => {
        const normalizedPath = String(filePath || '').trim();
        if (!normalizedPath) return;
        pushArtifact({
          id: `file:${toolRunId || 'session'}:${normalizedPath || index}`,
          source: 'file',
          sessionId: input.sessionId,
          toolRunId,
          kind: 'file',
          path: normalizedPath,
          title: this.basename(normalizedPath) || normalizedPath,
          summary: 'Arquivo tocado por uma execução real.',
        });
      });

      if (run?.diff && (Array.isArray(run.diff?.patches) || run.diff?.summary)) {
        pushArtifact({
          id: `diff:${toolRunId || input.sessionId}`,
          source: 'tool-run',
          sessionId: input.sessionId,
          toolRunId,
          kind: 'diff',
          title: `Diff ${toolRunId || 'da sessão'}`,
          summary: run.diff.summary || `${Array.isArray(run.diff.patches) ? run.diff.patches.length : 0} patch(es)`,
          diff: run.diff,
        });
      }
    }

    for (const run of input.runs) {
      if (!this.shouldExposeArtifactsForRecord(run)) {
        continue;
      }
      const runId = String(run?.id || '').trim();
      const runArtifacts = Array.isArray(run?.artifacts) ? run.artifacts : [];
      runArtifacts.forEach((artifact: any, index: number) => {
        pushArtifact({
          ...artifact,
          id: String(artifact?.id || `${runId}:artifact:${index}`).trim(),
          source: 'agent-run',
          sessionId: artifact?.sessionId || run?.sessionId || input.sessionId,
          runId,
          summary: artifact?.summary || run?.summary || null,
        });
      });
    }

    return Array.from(new Map(artifacts.map((artifact) => [artifact.id, artifact])).values());
  }

  private resolveArtifactKind(artifact: Record<string, any>): string {
    const explicit = String(artifact.kind || artifact.type || '').trim().toLowerCase();
    if (explicit) return explicit;
    const extension = String(artifact.path || artifact.name || '').split('.').pop()?.toLowerCase() || '';
    if (extension === 'pdf') return 'pdf';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) return 'image';
    if (['diff', 'patch'].includes(extension)) return 'diff';
    if (['md', 'txt', 'log', 'json', 'csv'].includes(extension)) return 'report';
    return 'file';
  }

  private basename(value: unknown): string {
    const normalized = String(value || '').trim().replace(/\\/g, '/');
    return normalized.split('/').filter(Boolean).pop() || '';
  }

  private shouldExposeArtifactsForRecord(record: any): boolean {
    return shouldPersistZavorthArtifacts(this.resolveArtifactPolicyMetadata(record));
  }

  private resolveArtifactPolicyMetadata(record: any): Record<string, unknown> {
    const metadata = record && typeof record.metadata === 'object' ? record.metadata : {};
    return {
      ...metadata,
      responseDecision: record?.responseDecision || (metadata as any)?.responseDecision,
      artifactPolicy: record?.artifactPolicy || (metadata as any)?.artifactPolicy,
    };
  }

  private async handlePermissionDecision(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: WebAppRuntimeRouteDeps,
    decision: 'approve' | 'reject',
  ): Promise<boolean> {
    try {
      const body = await deps.readJsonBody(req);
      const permission = await deps.runtime.permissionController.resolvePermissionReference(
        String(body.permissionId || '').trim(),
      );
      const sessionId = await deps.resolveSessionIdFromPermission(permission, String(body.sessionId || '').trim());
      const permissionId = deps.runtime.permissionController.shortPermissionId(permission);

      if (decision === 'approve') {
        const scope = String(body.scope || 'once').trim().toLowerCase();
        await deps.runtime.permissionController.handlePermissionCallback(
          deps.createWebContext(sessionId),
          `perm:approve:${permissionId}:${scope}`,
        );
      } else {
        await deps.runtime.permissionController.handlePermissionCallback(
          deps.createWebContext(sessionId),
          `perm:reject:${permissionId}`,
        );
      }

      await deps.realtime.captureBaseline(sessionId);
      const snapshot = await deps.realtime.getResolvedSnapshot(sessionId);
      deps.writeJson(res, { ok: true, snapshot }, 200);
    } catch (error: any) {
      deps.writeJson(
        res,
        { ok: false, error: error?.message || (decision === 'approve' ? 'Falha ao aprovar permissao.' : 'Falha ao rejeitar permissao.') },
        409,
      );
    }
    return true;
  }

  private async handleTaskDecision(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: WebAppRuntimeRouteDeps,
    decision: 'approve' | 'reject',
  ): Promise<boolean> {
    try {
      const body = await deps.readJsonBody(req);
      const taskId = String(body.taskId || '').trim();
      if (!taskId) {
        deps.writeJson(res, { ok: false, error: 'taskId obrigatorio.' }, 400);
        return true;
      }
      const task = deps.runtime.taskManager.getTask(taskId);
      if (!task) {
        deps.writeJson(res, { ok: false, error: 'Tarefa nao encontrada.' }, 404);
        return true;
      }
      const sessionId = deps.resolveSessionIdFromTask(task, String(body.sessionId || '').trim());

      if (decision === 'approve') {
        const approvalCode = String(body.approvalCode || body.pin || '').trim();
        const approvalArgs = approvalCode
          ? `${task.task_id} pin=${approvalCode}`
          : task.task_id;
        await deps.runtime.permissionController.handleApproval(
          deps.createWebContext(sessionId),
          approvalArgs,
        );
      } else {
        await deps.runtime.permissionController.handleRejection(
          deps.createWebContext(sessionId),
          task.task_id,
        );
      }

      await deps.realtime.captureBaseline(sessionId);
      const snapshot = await deps.realtime.getResolvedSnapshot(sessionId);
      deps.writeJson(res, { ok: true, snapshot }, 200);
    } catch (error: any) {
      deps.writeJson(
        res,
        { ok: false, error: error?.message || (decision === 'approve' ? 'Falha ao aprovar task gate.' : 'Falha ao rejeitar task gate.') },
        409,
      );
    }
    return true;
  }

  private async handleAgentRunDecision(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: WebAppRuntimeRouteDeps,
    decision: 'approve' | 'reject',
  ): Promise<boolean> {
    try {
      if (!deps.agentGateway) {
        deps.writeJson(
          res,
          { ok: false, error: 'Zavorth Agent Gateway indisponivel para approvals universais.' },
          503,
        );
        return true;
      }

      const body = await deps.readJsonBody(req);
      const approvalRef = String(
        body.approvalId
        || body.runId
        || body.id
        || '',
      ).trim();
      if (!approvalRef) {
        deps.writeJson(res, { ok: false, error: 'approvalId ou runId obrigatorio.' }, 400);
        return true;
      }

      const intentResult = deps.agentGateway.resolveApprovalIntent
        ? await deps.agentGateway.resolveApprovalIntent({
          decision: decision === 'approve' ? 'approved' : 'rejected',
          ref: approvalRef,
          text: String(body.text || body.message || '').trim(),
          source: String(body.source || '').trim() === 'button' ? 'button' : 'dashboard',
          channel: 'dashboard',
          userId: String(body.userId || '').trim() || null,
          sessionId: String(body.sessionId || '').trim() || null,
        })
        : null;
      const result = intentResult
        ? intentResult.result
        : decision === 'approve'
          ? await deps.agentGateway.approve(approvalRef)
          : await deps.agentGateway.reject(approvalRef);
      if (!result) {
        deps.writeJson(
          res,
          { ok: false, error: intentResult?.error || 'Approval universal nao encontrado ou ja resolvido.' },
          404,
        );
        return true;
      }

      const snapshot = deps.agentGateway.buildSnapshot({
        activeRunId: result.run?.id || String(body.runId || '').trim() || null,
        activeSessionId: result.run?.sessionId || String(body.sessionId || '').trim() || null,
      });
      deps.writeJson(
        res,
        {
          ok: true,
          requestedDecision: decision,
          approvalIntent: intentResult?.resolution || null,
          decision: result.decision,
          approval: result.approval,
          run: result.run,
          replies: result.replies,
          resumed: result.resumed,
          queued: Boolean(result.queued),
          workflowJob: result.workflowJob || null,
          error: result.error || null,
          generatedAt: snapshot.generatedAt,
          snapshot,
        },
        200,
      );
    } catch (error: any) {
      deps.writeJson(
        res,
        { ok: false, error: error?.message || (decision === 'approve' ? 'Falha ao aprovar run universal.' : 'Falha ao rejeitar run universal.') },
        409,
      );
    }
    return true;
  }

  private async handleAgentRunDraftApply(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<boolean> {
    try {
      if (!deps.agentGateway?.handle) {
        deps.writeJson(
          res,
          { ok: false, error: 'Zavorth Agent Gateway indisponivel para aplicar rascunho do Intelligence Fabric.' },
          503,
        );
        return true;
      }

      const body = await deps.readJsonBody(req);
      const planId = String(body.planId || '').trim();
      if (!planId) {
        deps.writeJson(res, { ok: false, error: 'planId obrigatorio.' }, 400);
        return true;
      }
      if (body.confirmOwnerControlledApply !== true) {
        deps.writeJson(res, { ok: false, error: 'confirmOwnerControlledApply=true obrigatorio para aplicar rascunho.' }, 400);
        return true;
      }

      const requestedRunId = String(body.runId || '').trim();
      const requestedSessionId = String(body.sessionId || '').trim();
      const seedSnapshot = deps.agentGateway.buildSnapshot({
        activeRunId: requestedRunId || null,
        activeSessionId: requestedSessionId || null,
      });
      const sourceRun = requestedRunId
        ? seedSnapshot.runs.find((run: any) => String(run?.id || '') === requestedRunId) || seedSnapshot.activeRun
        : seedSnapshot.activeRun;
      const sessionId = requestedSessionId || String(sourceRun?.sessionId || '').trim() || deps.runtime.webUserId;
      const userId = String(body.approvedBy || sourceRun?.userId || deps.runtime.webUserId || 'web-owner').trim();
      const result = await deps.agentGateway.handle({
        requestId: `command-center-apply-draft-${planId}`,
        traceId: String(sourceRun?.traceId || '').trim() || null,
        userId,
        sessionId,
        channel: 'web',
        text: `aplicar rascunho ${planId}`,
        workspace: String(body.workspace || sourceRun?.workspace || '').trim() || null,
        replyPort: {
          id: 'command-center',
          label: 'Command Center',
          kind: 'web',
          status: 'available',
          primary: true,
        },
        requestedTools: [],
        modelProfile: sourceRun?.modelProfile || undefined,
        metadata: {
          intelligenceFabricApplyDraftPlanId: planId,
          intelligenceFabricApplyDraftGuidance: true,
          intelligenceFabricApproveDraftPlan: true,
          intelligenceFabricApprovalId: String(body.approvalId || `command-center:${planId}`).trim(),
          approvedBy: userId,
          commandCenterApplyDraft: {
            source: 'CommandCenter',
            runId: requestedRunId || null,
            sessionId,
            confirmOwnerControlledApply: true,
          },
        },
      });
      const snapshot = deps.agentGateway.buildSnapshot({
        activeRunId: result.run.id,
        activeSessionId: result.run.sessionId,
      });
      deps.writeJson(
        res,
        {
          ok: result.ok,
          planId,
          run: result.run,
          replies: result.replies,
          generatedAt: snapshot.generatedAt,
          snapshot,
        },
        result.ok ? 200 : 409,
      );
    } catch (error: any) {
      deps.writeJson(
        res,
        { ok: false, error: error?.message || 'Falha ao aplicar rascunho do Intelligence Fabric.' },
        409,
      );
    }
    return true;
  }

  private async handleAgentRunFabricDemote(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<boolean> {
    try {
      if (!deps.agentGateway?.handle) {
        deps.writeJson(
          res,
          { ok: false, error: 'Zavorth Agent Gateway indisponivel para desativar o Intelligence Fabric.' },
          503,
        );
        return true;
      }

      const body = await deps.readJsonBody(req);
      if (body.confirmOwnerControlledDemote !== true) {
        deps.writeJson(res, { ok: false, error: 'confirmOwnerControlledDemote=true obrigatorio para demote controlado.' }, 400);
        return true;
      }

      const requestedRunId = String(body.runId || '').trim();
      const requestedSessionId = String(body.sessionId || '').trim();
      const seedSnapshot = deps.agentGateway.buildSnapshot({
        activeRunId: requestedRunId || null,
        activeSessionId: requestedSessionId || null,
      });
      const sourceRun = requestedRunId
        ? seedSnapshot.runs.find((run: any) => String(run?.id || '') === requestedRunId) || seedSnapshot.activeRun
        : seedSnapshot.activeRun;
      const sessionId = requestedSessionId || String(sourceRun?.sessionId || '').trim() || deps.runtime.webUserId;
      const userId = String(body.approvedBy || sourceRun?.userId || deps.runtime.webUserId || 'web-owner').trim();
      const recommendation = String(body.recommendation || body.reason || 'auto_demote_controlled').trim();
      const result = await deps.agentGateway.handle({
        requestId: 'command-center-demote-fabric',
        traceId: String(sourceRun?.traceId || '').trim() || null,
        userId,
        sessionId,
        channel: 'web',
        text: 'desativar Intelligence Fabric por health degradado',
        workspace: String(body.workspace || sourceRun?.workspace || '').trim() || null,
        replyPort: {
          id: 'command-center',
          label: 'Command Center',
          kind: 'web',
          status: 'available',
          primary: true,
        },
        requestedTools: [],
        modelProfile: sourceRun?.modelProfile || undefined,
        metadata: {
          intelligenceFabricMode: 'disabled',
          intelligenceFabricDemoteControlled: true,
          approvedBy: userId,
          commandCenterDemoteFabric: {
            source: 'CommandCenter',
            runId: requestedRunId || null,
            sessionId,
            status: String(body.status || '').trim() || null,
            recommendation,
            rollbackInstruction: String(body.rollbackInstruction || 'Reativar o Fabric removendo intelligenceFabricMode=disabled quando o health estiver pronto.').trim(),
            confirmOwnerControlledDemote: true,
          },
        },
      });
      const snapshot = deps.agentGateway.buildSnapshot({
        activeRunId: result.run.id,
        activeSessionId: result.run.sessionId,
      });
      deps.writeJson(
        res,
        {
          ok: result.ok,
          demote: {
            mode: 'disabled',
            appliedTo: 'request',
            globalRuntimeChanged: false,
            rollbackInstruction: String(body.rollbackInstruction || 'Reativar o Fabric removendo intelligenceFabricMode=disabled quando o health estiver pronto.').trim(),
          },
          run: result.run,
          replies: result.replies,
          generatedAt: snapshot.generatedAt,
          snapshot,
        },
        result.ok ? 200 : 409,
      );
    } catch (error: any) {
      deps.writeJson(
        res,
        { ok: false, error: error?.message || 'Falha ao aplicar demote controlado do Intelligence Fabric.' },
        409,
      );
    }
    return true;
  }
}
