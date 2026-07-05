import * as http from 'http';
import { isReservedSkillRouteSegment, readDecodedPathSuffix } from './WebAppSurfaceRouteParsing.js';
import { buildCodexRemoteActionInput } from './WebAppSurfaceRouteActions.js';
import type { WebAppSurfaceRouteDeps } from './WebAppSurfaceRouteTypes.js';

export async function handleWebAppSurfaceSkillRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  pathname: string,
  deps: WebAppSurfaceRouteDeps,
): Promise<boolean> {
  if (pathname === '/api/web/skills' && req.method === 'GET') {
    if (!deps.skillCatalogApi) {
      deps.writeJson(res, { ok: false, error: 'Skill catalog indisponivel.' }, 503);
      return true;
    }

    const snapshot = deps.skillCatalogApi.buildSnapshot({
      selectedId: url.searchParams.get('id'),
      recipeId: url.searchParams.get('recipe'),
      query: url.searchParams.get('q'),
      recommendFor: url.searchParams.get('recommend'),
    });
    deps.writeJson(res, {
      ok: true,
      skills: snapshot,
      selected: snapshot.selected,
      selectedRecipe: snapshot.selectedRecipe,
      recommendations: snapshot.recommendations,
    }, 200);
    return true;
  }

  if (pathname === '/api/web/skills/library' && req.method === 'GET') {
    if (!deps.skillLibraryPresentation) {
      deps.writeJson(res, { ok: false, error: 'Skill library indisponivel.' }, 503);
      return true;
    }

    const snapshot = deps.skillLibraryPresentation.buildSnapshot({
      selectedId: url.searchParams.get('id'),
      recipeId: url.searchParams.get('recipe'),
      query: url.searchParams.get('q'),
      recommendFor: url.searchParams.get('recommend'),
    });
    deps.writeJson(res, {
      ok: true,
      library: snapshot,
      selected: snapshot.catalog?.selected || null,
      selectedRecipe: snapshot.catalog?.selectedRecipe || null,
      actions: snapshot.actions || [],
    }, 200);
    return true;
  }

  if (pathname === '/api/web/skills/install-plan' && req.method === 'GET') {
    if (!deps.skillInstallPlanPresentation) {
      deps.writeJson(res, { ok: false, error: 'Skill install plan indisponivel.' }, 503);
      return true;
    }

    const snapshot = deps.skillInstallPlanPresentation.buildSnapshot({
      selectedId: url.searchParams.get('id'),
      recipeId: url.searchParams.get('recipe'),
      query: url.searchParams.get('q'),
      recommendFor: url.searchParams.get('recommend'),
    });
    deps.writeJson(res, {
      ok: true,
      plan: snapshot,
      focus: snapshot.focus,
      steps: snapshot.steps,
      actions: snapshot.actions,
    }, 200);
    return true;
  }

  if (pathname === '/api/web/skills/recipes' && req.method === 'GET') {
    if (!deps.skillCatalogApi) {
      deps.writeJson(res, { ok: false, error: 'Skill recipes indisponiveis.' }, 503);
      return true;
    }

    const snapshot = deps.skillCatalogApi.buildSnapshot({
      recipeId: url.searchParams.get('recipe'),
      query: url.searchParams.get('q'),
      recommendFor: url.searchParams.get('recommend'),
    });
    deps.writeJson(res, {
      ok: true,
      recipes: snapshot.recipes,
      selectedRecipe: snapshot.selectedRecipe,
      recommendations: snapshot.recommendations,
      summary: snapshot.summary,
    }, 200);
    return true;
  }

  if (pathname === '/api/web/skills/mcp' && req.method === 'GET') {
    if (!deps.skillMcpSidecar) {
      deps.writeJson(res, { ok: false, error: 'Skill MCP sidecar indisponivel.' }, 503);
      return true;
    }

    const snapshot = deps.skillMcpSidecar.buildSnapshot({
      selectedId: url.searchParams.get('id'),
      recipeId: url.searchParams.get('recipe'),
      query: url.searchParams.get('q'),
      recommendFor: url.searchParams.get('recommend'),
    });
    deps.writeJson(res, { ok: true, mcp: snapshot }, 200);
    return true;
  }

  if (pathname === '/api/web/skills/bridge' && req.method === 'GET') {
    if (!deps.skillBridgeActivation) {
      deps.writeJson(res, { ok: false, error: 'Skill bridge activation indisponivel.' }, 503);
      return true;
    }

    const selectedId = url.searchParams.get('id') || url.searchParams.get('skill');
    const explicitArgs = url.searchParams.get('args') || url.searchParams.get('command');
    const invoke = url.searchParams.get('invoke') === '1' || url.searchParams.get('invoke') === 'true';
    const live = url.searchParams.get('mode') === 'live' || url.searchParams.get('live') === '1';
    const approvalId = url.searchParams.get('approvalId') || url.searchParams.get('approval-id');
    const args = explicitArgs
      || (selectedId
        ? `${live ? 'live' : invoke ? 'run' : 'bridge'} ${selectedId}${approvalId ? ` --approval-id ${approvalId}` : ''}`
        : 'bridge');
    const snapshot = await deps.skillBridgeActivation.executeCommand({
      args,
      channel: 'web',
      actorId: deps.runtime?.webUserId || 'web',
    });
    deps.writeJson(res, {
      ok: snapshot.status !== 'denied' && snapshot.status !== 'not-found',
      activation: snapshot,
      registry: snapshot.registry,
      actions: snapshot.surfaceActions,
    }, snapshot.status === 'not-found' ? 404 : snapshot.status === 'denied' ? 409 : 200);
    return true;
  }

  if (pathname === '/api/web/mcp/runtime' && req.method === 'GET') {
    if (!deps.mcpCapabilityControlPlane) {
      deps.writeJson(res, { ok: false, error: 'MCP control plane indisponivel.' }, 503);
      return true;
    }

    const snapshot = deps.mcpCapabilityControlPlane.buildSnapshot();
    const runtime = deps.mcpRuntime?.readSnapshot() || null;
    deps.writeJson(res, { ok: true, mcp: snapshot, runtime }, 200);
    return true;
  }

  if (pathname === '/api/web/mcp/browser/doctor' && req.method === 'GET') {
    if (!deps.mcpBrowserDoctor) {
      deps.writeJson(res, { ok: false, error: 'Doctor do browser MCP indisponivel.' }, 503);
      return true;
    }

    const report = await deps.mcpBrowserDoctor.run();
    deps.writeJson(res, { ok: report.ok, doctor: report }, report.ok ? 200 : 409);
    return true;
  }

  if (pathname.startsWith('/api/web/mcp/runtime/servers/') && req.method === 'GET') {
    if (!deps.mcpCapabilityControlPlane) {
      deps.writeJson(res, { ok: false, error: 'MCP control plane indisponivel.' }, 503);
      return true;
    }

    const serverId = readDecodedPathSuffix(pathname, '/api/web/mcp/runtime/servers/');
    if (!serverId) {
      deps.writeJson(res, { ok: false, error: 'Servidor MCP invalido.' }, 404);
      return true;
    }

    const snapshot = deps.mcpCapabilityControlPlane.buildSnapshot();
    const entry = Array.isArray(snapshot?.entries)
      ? snapshot.entries.find((item: { id?: string; [key: string]: unknown }) => String(item?.id || '').trim().toLowerCase() === serverId.toLowerCase())
      : null;
    if (!entry) {
      deps.writeJson(res, { ok: false, error: `Servidor MCP nao encontrado: ${serverId}.` }, 404);
      return true;
    }

    const runtimeSnapshot = deps.mcpRuntime?.readSnapshot() || null;
    const runtimeEntry = Array.isArray(runtimeSnapshot?.entries)
      ? runtimeSnapshot.entries.find((item: { id?: string; [key: string]: unknown }) => String(item?.id || '').trim().toLowerCase() === serverId.toLowerCase()) || null
      : null;
    deps.writeJson(res, { ok: true, server: entry, runtimeEntry }, 200);
    return true;
  }

  if (pathname === '/api/web/mcp/runtime/actions' && req.method === 'POST') {
    if (!deps.mcpRuntime) {
      deps.writeJson(res, { ok: false, error: 'Runtime MCP indisponivel.' }, 503);
      return true;
    }

    const body = await deps.readJsonBody(req);
    const actionId = String(body.actionId || '').trim().toLowerCase();
    const serverId = String(body.serverId || '').trim();
    if (!actionId) {
      deps.writeJson(res, { ok: false, error: 'actionId obrigatorio.' }, 400);
      return true;
    }
    if (!serverId) {
      deps.writeJson(res, { ok: false, error: 'serverId obrigatorio.' }, 400);
      return true;
    }

    if (actionId !== 'reload-server' && actionId !== 'stop-server') {
      deps.writeJson(res, { ok: false, error: 'actionId invalido para MCP runtime.' }, 400);
      return true;
    }

    let result: unknown;
    if (actionId === 'reload-server') {
      result = await deps.mcpRuntime.reloadServer(serverId);
    } else {
      const stopped = await deps.mcpRuntime.stopServer(serverId);
      if (!stopped) {
        deps.writeJson(res, { ok: false, error: `Servidor MCP nao encontrado no runtime: ${serverId}.` }, 404);
        return true;
      }
      result = { ok: true, stopped: true, serverId };
    }

    const snapshot = deps.mcpCapabilityControlPlane?.buildSnapshot() || null;
    const runtime = deps.mcpRuntime.readSnapshot();
    deps.writeJson(
      res,
      {
        ok: true,
        action: {
          actionId,
          serverId,
          result,
        },
        mcp: snapshot,
        runtime,
      },
      200,
    );
    return true;
  }

  if (pathname.startsWith('/api/web/skills/') && req.method === 'GET') {
    if (!deps.skillCatalogApi) {
      deps.writeJson(res, { ok: false, error: 'Skill catalog indisponivel.' }, 503);
      return true;
    }

    const selectedId = readDecodedPathSuffix(pathname, '/api/web/skills/');
    if (!selectedId || isReservedSkillRouteSegment(selectedId)) {
      deps.writeJson(res, { ok: false, error: 'Skill invalida.' }, 404);
      return true;
    }

    const snapshot = deps.skillCatalogApi.buildSnapshot({ selectedId });
    if (!snapshot.selected) {
      deps.writeJson(res, { ok: false, error: `Skill nao encontrada: ${selectedId}.` }, 404);
      return true;
    }

    deps.writeJson(res, {
      ok: true,
      skill: snapshot.selected,
      recommendations: snapshot.recommendations,
      recipes: snapshot.recipes.filter((recipe: { skillIds?: string[]; [key: string]: unknown }) =>
        Array.isArray(recipe.skillIds)
        && recipe.skillIds.some((skillId: string) => String(skillId || '').trim().toLowerCase() === (snapshot.selected as { name?: string })?.name?.toLowerCase())),
    }, 200);
    return true;
  }

  if (pathname === '/api/web/operations/brief' && req.method === 'GET') {
    if (!deps.operatorBrief) {
      deps.writeJson(res, { ok: false, error: 'Operator brief indisponivel.' }, 503);
      return true;
    }

    deps.writeJson(res, { ok: true, brief: deps.operatorBrief.readSnapshot() }, 200);
    return true;
  }

  if (pathname === '/api/web/codex-remote' && req.method === 'GET') {
    if (!deps.codexRemote) {
      deps.writeJson(res, { ok: false, error: 'Codex Remote indisponivel.' }, 503);
      return true;
    }

    const snapshot = await deps.codexRemote.buildSnapshot({
      runtimeUserId: deps.runtime?.webUserId || 'web',
    });
    deps.writeJson(res, { ok: true, codexRemote: snapshot }, 200);
    return true;
  }

  if (pathname === '/api/web/codex-remote/sessions' && req.method === 'GET') {
    if (!deps.codexRemote) {
      deps.writeJson(res, { ok: false, error: 'Codex Remote indisponivel.' }, 503);
      return true;
    }

    const snapshot = await deps.codexRemote.buildSnapshot({
      runtimeUserId: deps.runtime?.webUserId || 'web',
    });
    deps.writeJson(res, { ok: true, sessions: snapshot.sessionBroker.sessions, summary: snapshot.sessionBroker.summary }, 200);
    return true;
  }

  if (pathname.startsWith('/api/web/codex-remote/sessions/') && req.method === 'GET') {
    if (!deps.codexRemote) {
      deps.writeJson(res, { ok: false, error: 'Codex Remote indisponivel.' }, 503);
      return true;
    }

    const sessionId = readDecodedPathSuffix(pathname, '/api/web/codex-remote/sessions/');
    const snapshot = await deps.codexRemote.buildSnapshot({
      runtimeUserId: deps.runtime?.webUserId || 'web',
      selectedSessionId: sessionId || undefined,
    });
    if (!snapshot.sessionBroker.selected) {
      deps.writeJson(res, { ok: false, error: `Sessao Codex Remote nao encontrada: ${sessionId}.` }, 404);
      return true;
    }
    deps.writeJson(res, { ok: true, session: snapshot.sessionBroker.selected, codexRemote: snapshot }, 200);
    return true;
  }

  if (pathname === '/api/web/codex-remote/actions' && req.method === 'POST') {
    if (!deps.codexRemoteActions) {
      deps.writeJson(res, { ok: false, error: 'Acoes do Codex Remote indisponiveis.' }, 503);
      return true;
    }

    const body = await deps.readJsonBody(req);
    const actionId = String(body?.actionId || '').trim();
    const action = await deps.codexRemoteActions.execute(buildCodexRemoteActionInput(deps, body, actionId));
    deps.writeJson(res, Object.assign({ ok: true }, action), 200);
    return true;
  }

  return false;
}
