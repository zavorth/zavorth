
import * as http from 'http';
import { buildNaturalSetupMutationPlanner } from './WebAppSurfaceRouteActions.js';
import {
  readBooleanSearchParam,
  readNumberSearchParam,
  readTrimmedSearchParam,
} from './WebAppSurfaceRouteParsing.js';
import type { WebAppSurfaceRouteDeps } from './WebAppSurfaceRouteTypes.js';
import { KanbanSQLiteDispatcherService } from '../plugins/KanbanSQLiteDispatcherService.js';
import { asErrorLike } from '../../utils/errorLike.js';

export async function handleWebAppSurfaceOperationRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  pathname: string,
  deps: WebAppSurfaceRouteDeps,
): Promise<boolean> {
  if (pathname === '/api/web/operations/product-observability' && req.method === 'GET') {
    if (!deps.productObservability) {
      deps.writeJson(res, { ok: false, error: 'Observabilidade de produto unavailable.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        observability: await deps.productObservability.buildSnapshot({
          workspace: readTrimmedSearchParam(url, 'workspace'),
          sourceSurface: readTrimmedSearchParam(url, ['surface', 'sourceSurface']),
          executor: readTrimmedSearchParam(url, 'executor'),
          workflow: readTrimmedSearchParam(url, 'workflow'),
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/operations/evals' && req.method === 'GET') {
    if (!deps.evalControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane de evals unavailable.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        evals: await deps.evalControlPlane.buildSnapshot({
          workspace: readTrimmedSearchParam(url, 'workspace'),
          sourceSurface: readTrimmedSearchParam(url, ['surface', 'sourceSurface']),
          executor: readTrimmedSearchParam(url, 'executor'),
          workflow: readTrimmedSearchParam(url, 'workflow'),
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/operations/qa' && req.method === 'GET') {
    if (!deps.qaControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane de QA unavailable.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        qa: deps.qaControlPlane.buildSnapshot({
          profile: readTrimmedSearchParam(url, 'profile'),
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/operations/governance' && req.method === 'GET') {
    if (!deps.governanceControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane de governance unavailable.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        governance: deps.governanceControlPlane.buildSnapshot({
          limit: readNumberSearchParam(url, 'limit', 8),
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/operations/replay-learning' && req.method === 'GET') {
    if (!deps.replayLearningControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane de replay/learning unavailable.' }, 503);
      return true;
    }

    const sessionId = deps.resolveSessionId(url);
    deps.writeJson(
      res,
      {
        ok: true,
        replayLearning: await deps.replayLearningControlPlane.buildSnapshot({
          sessionId,
          userId: deps.runtime?.webUserId || null,
          platform: 'web',
          chatId: deps.realtime?.getChatId(sessionId) || null,
          workspace: deps.workspaceRoot,
          limit: readNumberSearchParam(url, 'limit', 8),
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/operations/ecosystem' && req.method === 'GET') {
    if (!deps.ecosystemControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane do ecossistema unavailable.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        ecosystem: deps.ecosystemControlPlane.buildSnapshot({
          selectedId: readTrimmedSearchParam(url, 'selectedId'),
          query: readTrimmedSearchParam(url, ['q', 'query']),
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/operations/distributed-runtime' && req.method === 'GET') {
    if (!deps.distributedRuntimeControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane do runtime distribuido unavailable.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        distributedRuntime: await deps.distributedRuntimeControlPlane.buildSnapshot({
          selectedId: readTrimmedSearchParam(url, 'selectedId'),
          query: readTrimmedSearchParam(url, ['q', 'query']),
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/operations/runtime-stability' && req.method === 'GET') {
    if (!deps.runtimeStabilityControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane de estabilidade do runtime unavailable.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        runtimeStability: deps.runtimeStabilityControlPlane.buildSnapshot(),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/operations/rollout-readiness' && req.method === 'GET') {
    if (!deps.rolloutReadinessControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane de rollout readiness unavailable.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        rolloutReadiness: await deps.rolloutReadinessControlPlane.buildSnapshot({
          profile: readTrimmedSearchParam(url, 'profile'),
          scope: readTrimmedSearchParam(url, 'scope'),
          refresh: readBooleanSearchParam(url, 'refresh'),
          includeSources: readBooleanSearchParam(url, 'includeSources') || readBooleanSearchParam(url, 'full'),
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/operations/natural-setup' && req.method === 'GET') {
    if (!deps.naturalSetupControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane de natural setup unavailable.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        naturalSetup: await deps.naturalSetupControlPlane.buildSnapshot({
          channelId: readTrimmedSearchParam(url, 'channelId'),
          mode: readTrimmedSearchParam(url, 'mode'),
          intentText: readTrimmedSearchParam(url, ['text', 'intent']),
          autoApply: readBooleanSearchParam(url, 'apply'),
          autoDoctor: readBooleanSearchParam(url, 'doctor'),
          autoTest: readBooleanSearchParam(url, 'test'),
          localOnly: readBooleanSearchParam(url, 'localOnly'),
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/operations/natural-setup/actions' && req.method === 'POST') {
    if (!deps.naturalSetupControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane de natural setup unavailable.' }, 503);
      return true;
    }

    try {
      const body = await deps.readJsonBody(req);
      const planner = buildNaturalSetupMutationPlanner(deps);
      const actionId = String(body?.actionId || body?.action || 'preview').trim().toLowerCase();
      const planId = String(body?.planId || body?.mutationPlanId || '').trim();
      const requestedBy = deps.runtime?.webUserId || 'web-user';
      if ((actionId === 'apply' || actionId === 'apply-plan') && planId) {
        const applied = await planner.apply({ planId, requestedBy });
        deps.writeJson(
          res,
          {
            ok: applied.ok,
            status: applied.status,
            naturalSetup: applied.snapshot,
            mutationPlan: applied.mutationPlan,
            results: applied.results,
            summary: applied.summary,
          },
          applied.status === 'waiting_approval' ? 202 : applied.ok ? 200 : 409,
        );
        return true;
      }

      const preview = await planner.preview({
        channelId: String(body?.channelId || body?.selectedId || '').trim() || null,
        mode: String(body?.mode || '').trim() || null,
        intentText: String(body?.intentText || body?.intent || '').trim() || null,
        apply: body?.apply === true || actionId === 'apply-scaffold' || actionId === 'scaffold',
        doctor: body?.doctor === true || actionId === 'doctor',
        test: body?.test === true || actionId === 'test' || actionId === 'send-test',
        localOnly: body?.localOnly === true,
        requestedBy,
        sourceSurface: 'web',
      });
      deps.writeJson(
        res,
        {
          ok: false,
          status: 'waiting_approval',
          naturalSetup: preview.snapshot,
          mutationPlan: preview.mutationPlan,
          trustDecision: preview.trustDecision,
        },
        202,
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const errorMessage = error instanceof Error ? err.message : 'Failure no action seguro de Natural Setup.';
      deps.writeJson(res, { ok: false, error: errorMessage }, 400);
    }
    return true;
  }

  if (pathname === '/api/web/operations/automations' && req.method === 'GET') {
    if (!deps.automationControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane de automations unavailable.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        automations: await deps.automationControlPlane.buildSnapshot({
          query: readTrimmedSearchParam(url, ['q', 'query']),
          limit: readNumberSearchParam(url, 'limit', 8) || 8,
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/automations/actions' && req.method === 'POST') {
    if (!deps.automationControlPlane || !deps.automationActions) {
      deps.writeJson(res, { ok: false, error: 'Automation actions are unavailable.' }, 503);
      return true;
    }

    const body = await deps.readJsonBody(req);
    const actionId = String(body?.actionId || '').trim();
    if (!actionId) {
      deps.writeJson(res, { ok: false, error: 'actionId required.' }, 400);
      return true;
    }

    const requestedBy = deps.runtime?.webUserId || 'web-user';
    const planId = String(body?.planId || body?.mutationPlanId || '').trim();
    const action = actionId === 'apply' && planId && deps.automationActions.apply
      ? await deps.automationActions.apply({ planId, requestedBy })
      : await deps.automationActions.execute({
        actionId,
        intentText: String(body?.intentText || body?.intent || '').trim() || null,
        taskId: String(body?.taskId || '').trim() || null,
        requestedBy,
        sourceSurface: 'app',
      });
    deps.writeJson(
      res,
      {
        ok: action.ok,
        action,
        automations: action.snapshot,
      },
      action.status === 'waiting_approval' ? 202 : action.ok ? 200 : 409,
    );
    return true;
  }

  if (pathname === '/api/web/operations/watch-mode' && req.method === 'GET') {
    if (!deps.watchModeControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane de Watch Mode unavailable.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        watchMode: deps.watchModeControlPlane.buildSnapshot({
          limit: readNumberSearchParam(url, 'limit', 8) || 8,
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/hub' && req.method === 'GET') {
    if (!deps.hubControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Hub control plane unavailable.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        hub: deps.hubControlPlane.buildSnapshot({
          selectedId: readTrimmedSearchParam(url, 'selectedId'),
          query: readTrimmedSearchParam(url, ['q', 'query']),
          recommendFor: readTrimmedSearchParam(url, ['recommend', 'recommendFor']),
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/hub/actions' && req.method === 'POST') {
    if (!deps.hubControlPlane || !deps.hubActions) {
      deps.writeJson(res, { ok: false, error: 'Actions do Hub + MCP indisponiveis.' }, 503);
      return true;
    }

    try {
      const body = await deps.readJsonBody(req);
      const actionId = String(body?.actionId || '').trim();
      if (!actionId) {
        deps.writeJson(res, { ok: false, error: 'actionId required.' }, 400);
        return true;
      }

      const action = await deps.hubActions.execute({
        actionId,
        requestedBy: deps.runtime?.webUserId || 'web-user',
        workspace: deps.workspaceRoot,
        selectedId: String(body?.selectedId || '').trim() || null,
        query: String(body?.query || '').trim() || null,
        recommendFor: String(body?.recommendFor || '').trim() || null,
      });
      deps.writeJson(
        res,
        {
          ok: action.ok,
          action,
          hub: action.hub || deps.hubControlPlane?.buildSnapshot(),
        },
        action.ok ? 200 : 409,
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const errorMessage = error instanceof Error ? err.message : 'Failed to agir no Hub + MCP.';
      deps.writeJson(res, { ok: false, error: errorMessage }, 400);
    }
    return true;
  }

  if (pathname === '/api/web/kanban/boards' && req.method === 'GET') {
    const kanban = new KanbanSQLiteDispatcherService();
    try {
      const boards = kanban.getBoardsFull();
      deps.writeJson(res, { ok: true, boards }, 200);
    } finally {
      kanban.close();
    }
    return true;
  }

  if (pathname === '/api/web/kanban/board' && req.method === 'GET') {
    const boardId = readTrimmedSearchParam(url, 'boardId');
    if (!boardId) {
      deps.writeJson(res, { ok: false, error: 'boardId required.' }, 400);
      return true;
    }
    const kanban = new KanbanSQLiteDispatcherService();
    try {
      const data = kanban.getBoardFull(boardId);
      if (!data) {
        deps.writeJson(res, { ok: false, error: 'Board not found.' }, 404);
      } else {
        deps.writeJson(res, { ok: true, board: data.board, cards: data.cards }, 200);
      }
    } finally {
      kanban.close();
    }
    return true;
  }

  if (pathname === '/api/web/kanban/board' && req.method === 'POST') {
    const body = await deps.readJsonBody(req) as any;
    const name = String(body?.name || '').trim();
    if (!name) {
      deps.writeJson(res, { ok: false, error: 'name required.' }, 400);
      return true;
    }
    const kanban = new KanbanSQLiteDispatcherService();
    try {
      const result = kanban.createBoard(name, body?.columns as string[] | undefined);
      deps.writeJson(res, { ok: !result.startsWith('Error:'), message: result }, 200);
    } finally {
      kanban.close();
    }
    return true;
  }

  if (pathname === '/api/web/kanban/card' && req.method === 'POST') {
    const body = await deps.readJsonBody(req) as any;
    const boardId = String(body?.boardId || '').trim();
    const title = String(body?.title || '').trim();
    if (!boardId || !title) {
      deps.writeJson(res, { ok: false, error: 'boardId e title sao requireds.' }, 400);
      return true;
    }
    const kanban = new KanbanSQLiteDispatcherService();
    try {
      const result = kanban.addCard(boardId, title, {
        description: body?.description ? String(body.description) : undefined,
        column: body?.column ? String(body.column) : undefined,
        priority: body?.priority ? String(body.priority) as any : undefined,
        assignee: body?.assignee ? String(body.assignee) : undefined,
        labels: Array.isArray(body?.labels) ? (body.labels as string[]) : undefined,
        blocked_by: body?.blocked_by ? String(body.blocked_by) : undefined,
        metadata: body?.metadata ? (body.metadata as Record<string, unknown>) : undefined,
      });
      deps.writeJson(res, { ok: !result.startsWith('Error:'), message: result }, 200);
    } finally {
      kanban.close();
    }
    return true;
  }

  if (pathname === '/api/web/kanban/card/move' && req.method === 'POST') {
    const body = await deps.readJsonBody(req) as any;
    const boardId = String(body?.boardId || '').trim();
    const cardId = String(body?.cardId || '').trim();
    const targetColumn = String(body?.targetColumn || '').trim();
    if (!boardId || !cardId || !targetColumn) {
      deps.writeJson(res, { ok: false, error: 'boardId, cardId e targetColumn sao requireds.' }, 400);
      return true;
    }
    const kanban = new KanbanSQLiteDispatcherService();
    try {
      const result = kanban.moveCard(boardId, cardId, targetColumn, body?.reason ? String(body.reason) : undefined);
      deps.writeJson(res, { ok: !result.startsWith('Error:'), message: result }, 200);
    } finally {
      kanban.close();
    }
    return true;
  }

  if (pathname === '/api/web/kanban/card/comment' && req.method === 'POST') {
    const body = await deps.readJsonBody(req) as any;
    const cardId = String(body?.cardId || '').trim();
    const author = String(body?.author || '').trim();
    const content = String(body?.content || '').trim();
    if (!cardId || !author || !content) {
      deps.writeJson(res, { ok: false, error: 'cardId, author e content sao requireds.' }, 400);
      return true;
    }
    const kanban = new KanbanSQLiteDispatcherService();
    try {
      const result = kanban.addComment(cardId, author, content);
      deps.writeJson(res, { ok: true, message: result }, 200);
    } finally {
      kanban.close();
    }
    return true;
  }

  if (pathname === '/api/web/kanban/card/comments' && req.method === 'GET') {
    const cardId = readTrimmedSearchParam(url, 'cardId');
    if (!cardId) {
      deps.writeJson(res, { ok: false, error: 'cardId required.' }, 400);
      return true;
    }
    const kanban = new KanbanSQLiteDispatcherService();
    try {
      const comments = kanban.getComments(cardId);
      deps.writeJson(res, { ok: true, comments }, 200);
    } finally {
      kanban.close();
    }
    return true;
  }

  if (pathname === '/api/web/kanban/card/subagent' && req.method === 'POST') {
    const body = await deps.readJsonBody(req) as any;
    const cardId = String(body?.cardId || '').trim();
    const subagentId = body?.subagentId ? String(body.subagentId).trim() : null;
    if (!cardId) {
      deps.writeJson(res, { ok: false, error: 'cardId required.' }, 400);
      return true;
    }
    const kanban = new KanbanSQLiteDispatcherService();
    try {
      const result = kanban.assignSubagent(cardId, subagentId);
      deps.writeJson(res, { ok: true, message: result }, 200);
    } finally {
      kanban.close();
    }
    return true;
  }

  return false;
}
