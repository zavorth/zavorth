import * as http from 'http';
import fs from 'fs';
import path from 'path';
import {
  isWebAppRuntimeCanonicalSessionCompactRoute,
  isWebAppRuntimeCanonicalSessionSendRoute,
  isWebAppRuntimeCanonicalSessionSpawnRoute,
  resolveWebAppRuntimeCanonicalSessionCommand,
} from './web-app-runtime-route/WebAppRuntimeRouteHelpers.js';
import { config } from '../../../../config/index.js';

import { shouldPersistZavorthArtifacts } from '../../../../contracts/ZavorthResponseDecisionContract.js';
import type { RemoteMeshNotebookMcpApplyToolName } from '../../../../contracts/RemoteMeshNotebookMcpProxyContract.js';
import { RemoteMeshNotebookMcpProxyService } from '../../../../services/RemoteMeshNotebookMcpProxyService.js';
import { ZavorthMnemosQueryService } from '../../../../services/ZavorthMnemosQueryService.js';
import type { WebAppRuntimeRouteDeps } from './WebAppRuntimeRouteService.js';
import { WebAppRuntimeDecisionRouteService } from './WebAppRuntimeDecisionRouteService.js';
import { logger } from '../../../../logger';
import { asErrorLike } from '../../../../utils/errorLike.js';
type LooseRecord = Record<string, unknown>;
type LearningState = LooseRecord & {
  entries: Record<string, LooseRecord>;
};

interface MnemosLifecyclePayload {
  objective?: string;
  content?: string;
  toolName?: string;
  status?: string;
  runId?: string;
  workflowRunId?: string;
  traceId?: string;
}

interface MnemosLifecycleTrust {
  level?: string;
  receiptId?: string;
  approvalId?: string;
}

interface MnemosLifecycleSource {
  surface?: string;
}

export type WebAppRuntimeInteractionRouteHelpers = {
  buildCanonicalSessionBundle: (
    sessionId: string,
    options: {
      includeSessionsList?: boolean;
      historyMode?: 'none' | 'fast' | 'full';
      includeGateway?: boolean;
    },
  ) => Promise<Record<string, unknown>>;
  handleChatSend: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) => Promise<boolean>;
  handleSpawn: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) => Promise<boolean>;
  handleCompact: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) => Promise<boolean>;
  handleSessionCommand: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    command: string,
  ) => Promise<boolean>;
};

export class WebAppRuntimeInteractionRouteService {
  private readonly decisionRoutes = new WebAppRuntimeDecisionRouteService();

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
      } catch (error: unknown) {
        const err = asErrorLike(error);
        deps.writeJson(res, { ok: false, error: (error instanceof Error ? err.message : String(error)) || 'Failed to load preview.' }, 400);
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
      const tasks = (canonicalBundle.session as LooseRecord)?.tasks || (await deps.realtime.getResolvedSnapshot(sessionId)).tasks;
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

    if (pathname === '/api/web/zavorthControl/events' && req.method === 'GET') {
      return this.handleZavorthControlEventsRequest(res, url, deps);
    }

    if (pathname === '/api/web/mnemos/recall' && req.method === 'GET') {
      return this.handleMnemosRecallRequest(res, url, deps);
    }

    if (pathname === '/api/web/learning-dreams' && req.method === 'GET') {
      return this.handleLearningDreamsRequest(res, url, deps);
    }

    if (pathname === '/api/web/learning-dreams/action' && req.method === 'POST') {
      return this.handleLearningDreamsActionRequest(req, res, deps);
    }

    if (pathname === '/api/web/tool-runs' && req.method === 'GET') {
      const sessionId = deps.resolveSessionId(url);
      const snapshot = await deps.realtime.getResolvedSnapshot(sessionId);
      const toolRuns = asLooseRecordArray(asLooseRecord(snapshot)?.toolRuns);
      deps.writeJson(
        res,
        {
          ok: true,
          sessionId,
          toolRuns,
          filesTouched: Array.from(new Set(toolRuns.flatMap((run: LooseRecord) => this.shouldExposeArtifactsForRecord(run) && Array.isArray(run?.filesTouched) ? run.filesTouched : []))),
          artifacts: (Array.from(new Map<string, LooseRecord>(
            toolRuns
              .flatMap((run: LooseRecord) => this.shouldExposeArtifactsForRecord(run) && Array.isArray(run?.artifacts) ? run.artifacts as LooseRecord[] : [])
              .map((artifact: LooseRecord) => [
                String(artifact?.id || artifact?.key || artifact?.path || artifact?.name || ''),
                artifact,
              ]),
          ).values()) as LooseRecord[]).filter((artifact: LooseRecord) => artifact && (artifact.id || artifact.key || artifact.path || artifact.name)),
        },
        200,
      );
      return true;
    }

    if (pathname.startsWith('/api/web/tool-runs/') && pathname.endsWith('/diff') && req.method === 'GET') {
      const sessionId = deps.resolveSessionId(url);
      const runId = decodeURIComponent(pathname.slice('/api/web/tool-runs/'.length, -'/diff'.length));
      const snapshot = await deps.realtime.getResolvedSnapshot(sessionId);
      const toolRuns = asLooseRecordArray(asLooseRecord(snapshot)?.toolRuns);
      const toolRun = toolRuns.find((run: LooseRecord) => String(run?.runId || '').trim() === runId) || null;
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
      const permissions = (canonicalBundle.session as LooseRecord)?.permissions || (await deps.realtime.getResolvedSnapshot(sessionId)).permissions;
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
      const toolName = normalizeRemoteMeshNotebookMcpApplyToolName(body.toolName);
      const args = asRemoteMeshNotebookApplyArguments(body.arguments);
      if (!toolName || !args) {
        deps.writeJson(res, { ok: false, error: 'toolName, arguments e approval validos sao obrigatorios.' }, 400);
        return true;
      }
      const result = await RemoteMeshNotebookMcpProxyService.fromEnv().apply({
        toolName,
        arguments: args,
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

    if (isWebAppRuntimeCanonicalSessionCompactRoute(pathname) && req.method === 'POST') {
      return helpers.handleCompact(req, res);
    }

    const sessionCommand = resolveWebAppRuntimeCanonicalSessionCommand(pathname);
    const safeGetSessionCommands = new Set([
      'status',
      'usage',
      'models',
      'profile',
      'tools',
      'skills',
      'agents',
      'whoami',
      'context',
      'plan-review',
      'brief-reply',
      'test-loop',
    ]);
    if (sessionCommand && req.method === 'POST') {
      return helpers.handleSessionCommand(req, res, sessionCommand);
    }
    if (sessionCommand && req.method === 'GET' && safeGetSessionCommands.has(sessionCommand)) {
      return helpers.handleSessionCommand(req, res, sessionCommand);
    }
    if (sessionCommand) {
      deps.writeJson(res, {
        ok: false,
        error: `Session command ${sessionCommand} requires POST.`,
        rawSecretsSerialized: false,
      }, 405);
      return true;
    }

    if (pathname === '/api/web/permissions/approve' && req.method === 'POST') {
      return this.decisionRoutes.handlePermissionDecision(req, res, deps, 'approve');
    }

    if (pathname === '/api/web/permissions/reject' && req.method === 'POST') {
      return this.decisionRoutes.handlePermissionDecision(req, res, deps, 'reject');
    }

    if (pathname === '/api/web/tasks/approve' && req.method === 'POST') {
      return this.decisionRoutes.handleTaskDecision(req, res, deps, 'approve');
    }

    if (pathname === '/api/web/tasks/reject' && req.method === 'POST') {
      return this.decisionRoutes.handleTaskDecision(req, res, deps, 'reject');
    }

    if (pathname === '/api/web/agent-runs/approve' && req.method === 'POST') {
      return this.decisionRoutes.handleAgentRunDecision(req, res, deps, 'approve');
    }

    if (pathname === '/api/web/agent-runs/reject' && req.method === 'POST') {
      return this.decisionRoutes.handleAgentRunDecision(req, res, deps, 'reject');
    }

    if (pathname === '/api/web/agent-runs/apply-draft' && req.method === 'POST') {
      return this.decisionRoutes.handleAgentRunDraftApply(req, res, deps);
    }

    if (pathname === '/api/web/agent-runs/demote-fabric' && req.method === 'POST') {
      return this.decisionRoutes.handleAgentRunFabricDemote(req, res, deps);
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
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (error instanceof Error ? err.message : String(error)) || 'Failed to load asset.' }, 400);
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
    const toolRuns = asLooseRecordArray(asLooseRecord(snapshot)?.toolRuns);
    const agentSnapshot = deps.agentGateway?.buildSnapshot({
      activeSessionId: sessionId,
    }) || null;
    const runs = asLooseRecordArray(agentSnapshot?.runs);
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
          toolRuns.flatMap((run: LooseRecord) => Array.isArray(run?.filesTouched) ? run.filesTouched : []),
        )),
        toolRuns,
        runs,
      },
      200,
    );
    return true;
  }

  private async handleZavorthControlEventsRequest(
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
    const runs = asLooseRecordArray(agentSnapshot?.runs);
    const runId = String(url.searchParams.get('runId') || '').trim();
    const traceId = String(url.searchParams.get('traceId') || '').trim();
    const events = this.buildZavorthControlEvents({
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
        summary: this.buildZavorthControlEventSummary(events),
        events,
      },
      200,
    );
    return true;
  }

  private handleMnemosRecallRequest(
    res: http.ServerResponse,
    url: URL,
    deps: WebAppRuntimeRouteDeps,
  ): boolean {
    const query = String(url.searchParams.get('query') || url.searchParams.get('q') || '').trim();
    if (!query) {
      deps.writeJson(res, { ok: false, error: 'query is required' }, 400);
      return true;
    }
    try {
      const topK = Math.min(20, Math.max(1, Number(url.searchParams.get('topK') || 6) || 6));
      const snapshot = new ZavorthMnemosQueryService({
        projectRoot: config.projectRoot || process.cwd(),
      }).query({ query, topK });
      deps.writeJson(res, { ok: true, recall: snapshot }, 200);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (error instanceof Error ? err.message : String(error)) || 'Mnemos recall failed.' }, 500);
    }
    return true;
  }

  private async handleLearningDreamsRequest(
    res: http.ServerResponse,
    url: URL,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<boolean> {
    const sessionId = deps.resolveSessionId(url);
    const state = this.readLearningState();
    const snapshot = await deps.realtime.getResolvedSnapshot(sessionId);
    const agentSnapshot = deps.agentGateway?.buildSnapshot({ activeSessionId: sessionId }) || null;
    const runs = [
      ...asLooseRecordArray(agentSnapshot?.runs),
      ...asLooseRecordArray(asLooseRecord(snapshot)?.workflowRuns),
    ];
    const lifecycleEvents = this.readMnemosLifecycleEvents(sessionId);
    const runCandidates = runs
      .filter((run: LooseRecord) => /completed|approval|blocked|done/i.test(String(run?.status || 'completed')))
      .slice(-30)
      .map((run: LooseRecord) => this.buildLearningCandidateFromRun(run, state.entries));
    const hookCandidates = lifecycleEvents
      .filter((event) => String(event.type || '').includes('memory') || /receipt|approval|artifact|tool|workflow|message/i.test(String(event.type || '')))
      .slice(-20)
      .map((event) => this.buildLearningCandidateFromLifecycleEvent(event, state.entries));
    const candidates = Array.from(new Map([...hookCandidates, ...runCandidates].map((candidate) => [candidate.id, candidate])).values())
      .sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')))
      .slice(0, 40);
    const summary = {
      total: candidates.length,
      pending: candidates.filter((candidate) => candidate.reviewState === 'pending').length,
      approved: candidates.filter((candidate) => candidate.reviewState === 'approved').length,
      rejected: candidates.filter((candidate) => candidate.reviewState === 'rejected').length,
      promoted: candidates.filter((candidate) => candidate.lifecycle === 'trusted_local').length,
      published: candidates.filter((candidate) => candidate.lifecycle === 'published').length,
      quarantined: candidates.filter((candidate) => candidate.lifecycle === 'quarantined').length,
      highConfidence: candidates.filter((candidate) => Number(candidate.score || 0) >= 0.8).length,
      fromHooks: hookCandidates.length,
    };
    deps.writeJson(res, {
      ok: true,
      generatedAt: new Date().toISOString(),
      learning: {
        generatedAt: new Date().toISOString(),
        summary,
        candidates,
      },
      lifecycle: {
        generatedAt: new Date().toISOString(),
        sessionId,
        events: lifecycleEvents.slice(-30).reverse(),
      },
      memory: {
        generatedAt: new Date().toISOString(),
        summary: {
          total: lifecycleEvents.length + summary.approved + summary.promoted,
          episodic: lifecycleEvents.length,
          semantic: summary.approved + summary.promoted,
          procedural: candidates.filter((candidate) => candidate.kind === 'playbook').length,
        },
      },
    }, 200);
    return true;
  }

  private async handleLearningDreamsActionRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<boolean> {
    const body = await deps.readJsonBody(req);
    const candidateId = String(body.candidateId || '').trim();
    const actionId = normalizeLearningDreamActionId(body.actionId);
    const approvalId = String(body.approvalId || body.approval || '').trim() || null;
    if (!candidateId || !actionId) {
      deps.writeJson(res, { ok: false, error: 'candidateId and supported actionId are required' }, 400);
      return true;
    }

    if (typeof deps.executeLearningAction === 'function') {
      try {
        const execution = await deps.executeLearningAction({
          candidateId,
          actionId,
          approvalId,
        });
        if (execution) {
          const now = String(execution.generatedAt || new Date().toISOString());
          const status = String(execution.status || 'applied');
          const ok = execution.ok !== false && status !== 'blocked';
          const lifecycle = status === 'blocked' && (actionId === 'promoteSkill' || actionId === 'promote')
            ? 'learned_draft'
            : actionId === 'promote' || actionId === 'promoteSkill' || actionId === 'promoteProcedure'
              ? (ok ? 'trusted_local' : 'learned_draft')
              : actionId === 'reject' || actionId === 'forget'
                ? 'quarantined'
                : 'learned_draft';
          const state = this.readLearningState();
          const current = state.entries[candidateId] || {
            reviewState: 'pending',
            lifecycle: 'learned_draft',
            updatedAt: now,
          };
          state.entries[candidateId] = {
            ...current,
            reviewState: actionId === 'reject' || actionId === 'forget' ? 'rejected' : 'approved',
            lifecycle: execution.snapshot
              ? String(
                (asLooseRecord(execution.snapshot)?.candidates as LooseRecord[] | undefined)
                  ?.find((entry) => String(entry?.id || '') === candidateId)?.lifecycle
                || lifecycle,
              )
              : lifecycle,
            updatedAt: now,
            promotedAt: lifecycle === 'trusted_local' ? now : current.promotedAt || null,
            rejectedAt: actionId === 'reject' || actionId === 'forget' ? now : current.rejectedAt || null,
            skillCandidateId: execution.skillCandidateId || null,
            silentInstallBlocked: execution.silentInstallBlocked ?? true,
          };
          state.updatedAt = now;
          this.writeLearningState(state);
          deps.writeJson(res, {
            ok,
            generatedAt: now,
            candidateId,
            actionId,
            status,
            summary: execution.summary || null,
            details: execution.details || [],
            approvalId: execution.approvalId || approvalId,
            skillCandidateId: execution.skillCandidateId || null,
            silentInstallBlocked: execution.silentInstallBlocked ?? true,
            skillInstalled: execution.skillInstalled || false,
            execution,
          }, ok ? 200 : 409);
          return true;
        }
      } catch (error: unknown) {
        logger.warn('[Web App Runtime Interaction] learning-dreams gate path failed', error);
      }
    }

    if (actionId === 'promote' || actionId === 'promoteSkill' || actionId === 'promoteProcedure') {
      const gateResult = await this.promoteLearningDreamViaSkillGate({
        candidateId,
        actionId,
        approvalId,
      });
      const now = new Date().toISOString();
      const state = this.readLearningState();
      const current = state.entries[candidateId] || {
        reviewState: 'pending',
        lifecycle: 'learned_draft',
        updatedAt: now,
      };
      const lifecycle = gateResult.installed
        ? 'trusted_local'
        : actionId === 'promoteSkill'
          ? 'learned_draft'
          : 'trusted_local';
      state.entries[candidateId] = {
        ...current,
        reviewState: 'approved',
        lifecycle,
        updatedAt: now,
        promotedAt: lifecycle === 'trusted_local' ? now : current.promotedAt || null,
        skillCandidateId: gateResult.skillCandidateId,
        silentInstallBlocked: true,
      };
      state.updatedAt = now;
      this.writeLearningState(state);
      deps.writeJson(res, {
        ok: gateResult.ok,
        generatedAt: now,
        candidateId,
        actionId,
        status: gateResult.status,
        summary: gateResult.summary,
        details: gateResult.details,
        approvalId,
        skillCandidateId: gateResult.skillCandidateId,
        silentInstallBlocked: true,
        skillInstalled: gateResult.installed,
      }, gateResult.ok ? 200 : 409);
      return true;
    }

    const now = new Date().toISOString();
    const state = this.readLearningState();
    const current = state.entries[candidateId] || {
      reviewState: 'pending',
      lifecycle: 'learned_draft',
      updatedAt: now,
    };
    state.entries[candidateId] = {
      ...current,
      reviewState: actionId === 'reject' || actionId === 'forget' ? 'rejected' : 'approved',
      lifecycle: actionId === 'reject' || actionId === 'forget'
        ? 'quarantined'
        : current.lifecycle,
      updatedAt: now,
      rejectedAt: actionId === 'reject' || actionId === 'forget' ? now : current.rejectedAt || null,
    };
    state.updatedAt = now;
    this.writeLearningState(state);
    deps.writeJson(res, {
      ok: true,
      generatedAt: now,
      candidateId,
      actionId,
      status: 'applied',
      silentInstallBlocked: true,
    }, 200);
    return true;
  }

  private async promoteLearningDreamViaSkillGate(input: {
    candidateId: string;
    actionId: 'promote' | 'promoteSkill' | 'promoteProcedure';
    approvalId: string | null;
  }): Promise<{
    ok: boolean;
    status: string;
    summary: string;
    details: string[];
    skillCandidateId: string | null;
    installed: boolean;
  }> {
    try {
      const { SkillPromotionGate } = await import('../../../../services/SkillPromotionGate.js');
      const gate = new SkillPromotionGate();
      const state = this.readLearningState();
      const entry = state.entries[input.candidateId] || {};
      const intentText = [
        String(entry.title || input.candidateId),
        String(entry.summary || ''),
        `learning-dreams:${input.candidateId}`,
      ].filter(Boolean).join('\n');
      const materialized = gate.materializeCandidate({
        intentText,
        candidateKind: input.actionId === 'promoteProcedure' ? 'procedure' : 'auto-skill',
        requestedBy: 'learning-dreams',
        sourceSurface: 'web:learning-dreams',
        approvalRequired: true,
      });
      const skillCandidateId = materialized.candidateId;
      const details = [
        materialized.summary,
        'silentInstallBlocked=true',
        skillCandidateId ? `skillCandidateId=${skillCandidateId}` : 'skillCandidateId=none',
      ];
      if (!skillCandidateId) {
        return {
          ok: false,
          status: 'blocked',
          summary: materialized.summary,
          details,
          skillCandidateId: null,
          installed: false,
        };
      }
      if (input.approvalId) {
        const applied = await gate.apply({
          candidateId: skillCandidateId,
          approvalId: input.approvalId,
          requestedBy: 'learning-dreams',
          sourceSurface: 'web:learning-dreams',
        });
        return {
          ok: applied.ok && applied.installed,
          status: applied.status,
          summary: applied.summary,
          details: [...details, applied.summary, ...(applied.details || []).slice(0, 4)],
          skillCandidateId,
          installed: applied.installed,
        };
      }
      const previewed = await gate.preview(skillCandidateId, {
        requestedBy: 'learning-dreams',
        sourceSurface: 'web:learning-dreams',
      });
      return {
        ok: input.actionId !== 'promoteSkill',
        status: input.actionId === 'promoteSkill' ? 'blocked' : 'applied',
        summary: input.actionId === 'promoteSkill'
          ? `${previewed.summary} Install waits for approvalId.`
          : previewed.summary,
        details: [
          ...details,
          previewed.summary,
          previewed.mutationPlanId ? `mutationPlanId=${previewed.mutationPlanId}` : 'mutationPlanId=none',
          'Provide approvalId to apply SkillPromotionGate install.',
        ],
        skillCandidateId,
        installed: false,
      };
    } catch (error: unknown) {
      logger.warn('[Web App Runtime Interaction] SkillPromotionGate promote failed', error);
      return {
        ok: input.actionId !== 'promoteSkill',
        status: input.actionId === 'promoteSkill' ? 'blocked' : 'applied',
        summary: error instanceof Error ? error.message : String(error),
        details: ['SkillPromotionGate unavailable; soft lifecycle may still apply for non-skill promote.'],
        skillCandidateId: null,
        installed: false,
      };
    }
  }

  private buildZavorthControlEvents(input: {
    sessionId: string;
    snapshot: LooseRecord;
    runs: LooseRecord[];
    runId?: string;
    traceId?: string;
  }): LooseRecord[] {
    const events: LooseRecord[] = [];
    const pushEvent = (event: LooseRecord) => {
      const id = String(event.id || '').trim();
      if (!id) return;
      events.push({
        ...event,
        id,
        source: event.source || 'zavorthControl-history',
        sessionId: input.sessionId,
      });
    };

    const messages = asLooseRecordArray(input.snapshot?.messages);
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

    const tasks = asLooseRecordArray(input.snapshot?.tasks);
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
        title: String(permission?.kind || permission?.executor || 'Pending approval').trim(),
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

    const workflowRuns = asLooseRecordArray(input.snapshot?.workflowRuns);
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
      const modelProfile = asLooseRecord(run?.modelProfile);
      pushEvent({
        id: `agent-run:${runId}:${status}`,
        type: this.isFailureStatus(status) ? 'error' : 'step',
        title: String(run?.title || run?.objective || 'Agent run').trim(),
        detail: String(run?.summary || run?.text || run?.objective || '').trim(),
        meta: String(modelProfile?.modelLabel || run?.model || 'agent-run').trim(),
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

    for (const lifecycleEvent of this.readMnemosLifecycleEvents(input.sessionId)) {
      const eventId = String(lifecycleEvent.id || '').trim();
      if (!eventId) continue;
      const payload: MnemosLifecyclePayload = lifecycleEvent.payload && typeof lifecycleEvent.payload === 'object' ? lifecycleEvent.payload as MnemosLifecyclePayload : {};
      const trust: MnemosLifecycleTrust = lifecycleEvent.trust && typeof lifecycleEvent.trust === 'object' ? lifecycleEvent.trust as MnemosLifecycleTrust : {};
      const source: MnemosLifecycleSource = lifecycleEvent.source && typeof lifecycleEvent.source === 'object' ? lifecycleEvent.source as MnemosLifecycleSource : {};
      pushEvent({
        id: `mnemos:${eventId}`,
        type: 'lifecycle',
        title: String(lifecycleEvent.type || 'Mnemos lifecycle').trim(),
        detail: String(payload.objective || payload.content || payload.toolName || payload.status || 'Session lifecycle event captured by Mnemos.').trim(),
        meta: `mnemos - ${String(source.surface || 'runtime')} - ${String(trust.level || 'raw')}`,
        status: String(payload.status || trust.level || 'captured').trim(),
        time: lifecycleEvent.timestamp || lifecycleEvent.createdAt || null,
        runId: payload.runId || payload.workflowRunId || null,
        traceId: payload.traceId || null,
        lifecycle: {
          source,
          trust,
          receiptId: trust.receiptId || null,
          approvalId: trust.approvalId || null,
        },
        replay: {
          runId: payload.runId || payload.workflowRunId || eventId,
          traceId: payload.traceId || null,
          sessionId: input.sessionId,
          policy: 'mnemos lifecycle',
        },
      });
    }

    const runFilter = String(input.runId || '').trim();
    const traceFilter = String(input.traceId || '').trim();
    return Array.from(new Map(events.map((event) => [event.id, event])).values())
      .filter((event) => {
        if (!runFilter && !traceFilter) return true;
        const replay = asLooseRecord(event.replay);
        const eventRunId = String(event.runId || event.agentRunId || event.toolRunId || event.workflowRunId || replay?.runId || '').trim();
        const eventTraceId = String(event.traceId || replay?.traceId || '').trim();
        return Boolean((runFilter && eventRunId === runFilter) || (traceFilter && eventTraceId === traceFilter));
      })
      .sort((a, b) => this.eventTimeMs(a) - this.eventTimeMs(b))
      .slice(-90);
  }

  private buildZavorthControlEventSummary(events: LooseRecord[]): Record<string, number> {
    const byType = (type: string) => events.filter((event) => String(event.type || '') === type).length;
    return {
      totalEvents: events.length,
      runs: byType('request'),
      approvals: byType('approval'),
      artifacts: byType('receipt'),
      errors: byType('error'),
      lifecycle: byType('lifecycle'),
    };
  }

  private readMnemosLifecycleEvents(sessionId = ''): Record<string, unknown>[] {
    try {
      const filePath = path.resolve(config.projectRoot || process.cwd(), '.zavorth', 'memory', 'session-events.json');
      if (!fs.existsSync(filePath)) return [];
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
      const events = Array.isArray(parsed.events) ? parsed.events : [];
      return events
        .map((event) => event && typeof event === 'object' && !Array.isArray(event) ? event as Record<string, unknown> : null)
        .filter((event): event is Record<string, unknown> => Boolean(event))
        .filter((event) => !sessionId || !event.sessionId || event.sessionId === sessionId)
        .slice(-120);
    } catch (error: unknown) {logger.warn('[Web App Runtime Interaction] parsing failed', error); return []; }
  }

  private readLearningState(): LearningState {
    try {
      const filePath = this.learningStatePath();
      if (!fs.existsSync(filePath)) return { version: 1, updatedAt: new Date(0).toISOString(), entries: {} };
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const record = asLooseRecord(parsed);
      const entries = asLearningEntries(record?.entries);
      return record
        ? { version: 1, updatedAt: new Date(0).toISOString(), ...record, entries }
        : { version: 1, updatedAt: new Date(0).toISOString(), entries: {} };
    } catch (error: unknown) {logger.warn('[Web App Runtime Interaction] JSON parse failed', error);
    return { version: 1, updatedAt: new Date(0).toISOString(), entries: {} };
  }
  }

  private writeLearningState(state: LearningState): void {
    const filePath = this.learningStatePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
  }

  private learningStatePath(): string {
    return path.resolve(config.projectRoot || process.cwd(), 'data', 'runtime', 'learning-plane-state.json');
  }

  private buildLearningCandidateFromRun(run: LooseRecord, entries: Record<string, LooseRecord>): Record<string, unknown> {
    const id = String(run?.workflow_run_id || run?.id || run?.requestId || run?.runId || '').trim() || `run-${Date.now()}`;
    const entry = entries[id] || {};
    const artifactCount = Array.isArray(run?.artifacts) ? run.artifacts.length : 0;
    const completed = Array.isArray(run?.events) ? run.events.filter((event: LooseRecord) => /done|completed/i.test(String(event?.status || ''))).length : 0;
    return {
      id,
      title: String(run?.title || run?.objective || run?.input || 'Recent run').trim().slice(0, 96),
      kind: artifactCount > 0 ? 'playbook' : 'recipe',
      summary: String(run?.summary || run?.objective || run?.input || 'Reusable behavior from a recent run.').trim(),
      score: Number(Math.max(0.42, Math.min(0.96, 0.55 + artifactCount * 0.04 + completed * 0.03)).toFixed(2)),
      reviewState: entry.reviewState || 'pending',
      lifecycle: entry.lifecycle || 'learned_draft',
      createdAt: String(run?.createdAt || run?.created_at || new Date().toISOString()),
      updatedAt: String(run?.updatedAt || run?.updated_at || run?.createdAt || run?.created_at || new Date().toISOString()),
      source: {
        workflow: String(run?.channel || 'runtime'),
        workspace: String(run?.workspace || 'local'),
        objective: String(run?.objective || run?.input || run?.title || ''),
        sourceSurface: String(run?.channel || 'web'),
        sourceKind: 'run',
      },
      steps: ['Review activity', 'Extract reusable behavior', 'Keep only with approval'],
    };
  }

  private buildLearningCandidateFromLifecycleEvent(event: Record<string, unknown>, entries: Record<string, LooseRecord>): Record<string, unknown> {
    const id = `hook-${String(event.id || '').trim() || Date.now()}`;
    const entry = entries[id] || {};
    const payload: MnemosLifecyclePayload = event.payload && typeof event.payload === 'object' ? event.payload as MnemosLifecyclePayload : {};
    const trust: MnemosLifecycleTrust = event.trust && typeof event.trust === 'object' ? event.trust as MnemosLifecycleTrust : {};
    const source: MnemosLifecycleSource = event.source && typeof event.source === 'object' ? event.source as MnemosLifecycleSource : {};
    return {
      id,
      title: String(payload.objective || payload.toolName || payload.content || event.type || 'Lifecycle signal').trim().slice(0, 96),
      kind: String(event.type || '').includes('artifact') || String(event.type || '').includes('tool') ? 'playbook' : 'session-signal',
      summary: `Captured from ${String(source.surface || 'runtime')} with ${String(trust.level || 'raw')} trust.`,
      score: trust.level === 'operator-approved' ? 0.9 : trust.level === 'receipt-backed' ? 0.82 : 0.58,
      reviewState: entry.reviewState || 'pending',
      lifecycle: entry.lifecycle || 'learned_draft',
      createdAt: String(event.timestamp || new Date().toISOString()),
      updatedAt: String(event.timestamp || new Date().toISOString()),
      source: {
        workflow: String(event.type || 'lifecycle'),
        workspace: 'local',
        objective: String(payload.objective || payload.content || payload.toolName || ''),
        sourceSurface: String(source.surface || 'runtime'),
        sourceKind: 'lifecycle-hook',
        trustLevel: String(trust.level || 'raw'),
        receiptId: String(trust.receiptId || ''),
        approvalId: String(trust.approvalId || ''),
      },
      steps: ['Captured by lifecycle hook', 'Review before promotion', 'Keep receipt-backed facts preferred'],
    };
  }

  private eventTimeMs(event: Record<string, unknown>): number {
    const date = new Date(String(event.time || event.createdAt || event.created_at || ''));
    return Number.isFinite(date.getTime()) ? date.getTime() : 0;
  }

  private isFailureStatus(status: unknown): boolean {
    return /failed|error|blocked|rejected|cancelled|canceled/i.test(String(status || ''));
  }

  private collectArtifactEntries(input: {
    sessionId: string;
    toolRuns: LooseRecord[];
    runs: LooseRecord[];
  }): LooseRecord[] {
    const artifacts: LooseRecord[] = [];
    const pushArtifact = (artifact: Record<string, unknown>) => {
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
      runArtifacts.forEach((artifact: LooseRecord, index: number) => {
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
      filesTouched.forEach((filePath: unknown, index: number) => {
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
          summary: 'File touched by a real execution.',
        });
      });

      const diff = asLooseRecord(run.diff);
      if (diff && (Array.isArray(diff.patches) || diff.summary)) {
        pushArtifact({
          id: `diff:${toolRunId || input.sessionId}`,
          source: 'tool-run',
          sessionId: input.sessionId,
          toolRunId,
          kind: 'diff',
          title: `Diff ${toolRunId || 'of the session'}`,
          summary: diff.summary || `${Array.isArray(diff.patches) ? diff.patches.length : 0} patch(es)`,
          diff,
        });
      }
    }

    for (const run of input.runs) {
      if (!this.shouldExposeArtifactsForRecord(run)) {
        continue;
      }
      const runId = String(run?.id || '').trim();
      const runArtifacts = Array.isArray(run?.artifacts) ? run.artifacts : [];
      runArtifacts.forEach((artifact: LooseRecord, index: number) => {
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

  private resolveArtifactKind(artifact: Record<string, unknown>): string {
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

  private shouldExposeArtifactsForRecord(record: LooseRecord | null | undefined): boolean {
    return shouldPersistZavorthArtifacts(this.resolveArtifactPolicyMetadata(record));
  }

  private resolveArtifactPolicyMetadata(record: LooseRecord | null | undefined): Record<string, unknown> {
    const metadata = asLooseRecord(record?.metadata) || {};
    return {
      ...metadata,
      responseDecision: record?.responseDecision || metadata?.responseDecision,
      artifactPolicy: record?.artifactPolicy || metadata?.artifactPolicy,
    };
  }

}


function asLooseRecord(value: unknown): LooseRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as LooseRecord
    : null;
}

function asLooseRecordArray(value: unknown): LooseRecord[] {
  return Array.isArray(value)
    ? value.map(asLooseRecord).filter((entry): entry is LooseRecord => Boolean(entry))
    : [];
}

function asLearningEntries(value: unknown): Record<string, LooseRecord> {
  const record = asLooseRecord(value);
  if (!record) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(record)
      .map(([key, entry]) => [key, asLooseRecord(entry)])
      .filter((entry): entry is [string, LooseRecord] => Boolean(entry[1])),
  );
}

function normalizeRemoteMeshNotebookMcpApplyToolName(
  value: unknown,
): RemoteMeshNotebookMcpApplyToolName | null {
  const toolName = String(value || '').trim();
  return toolName === 'notebook.docker.apply_control' || toolName === 'notebook.project_files.apply_read'
    ? toolName
    : null;
}

function asRemoteMeshNotebookApplyArguments(
  value: unknown,
): { approvalId: string; approvalPhrase: string } | null {
  const record = asLooseRecord(value);
  const approvalId = String(record?.approvalId || '').trim();
  const approvalPhrase = String(record?.approvalPhrase || '').trim();
  return approvalId && approvalPhrase ? { approvalId, approvalPhrase } : null;
}

function normalizeLearningDreamActionId(value: unknown):
  | 'approve'
  | 'reject'
  | 'promote'
  | 'forget'
  | 'promoteProcedure'
  | 'promoteSkill'
  | null {
  const normalized = String(value || '').trim().replace(/_/g, '-').toLowerCase();
  if (normalized === 'approve' || normalized === 'reject' || normalized === 'promote' || normalized === 'forget') {
    return normalized;
  }
  if (normalized === 'promote-procedure' || normalized === 'promoteprocedure') {
    return 'promoteProcedure';
  }
  if (normalized === 'promote-skill' || normalized === 'promoteskill') {
    return 'promoteSkill';
  }
  return null;
}
