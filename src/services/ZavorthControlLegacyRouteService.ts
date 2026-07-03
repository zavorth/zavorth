import * as http from 'http';
import { config } from '../config/index.js';
import { SnippetService } from './SnippetService.js';

type WriteHtml = (res: http.ServerResponse, body: string, statusCode?: number) => void;
type WriteJson = (res: http.ServerResponse, body: unknown, statusCode?: number) => void;
type ReadJsonBody = (req: http.IncomingMessage) => Promise<Record<string, unknown>>;

interface SkillSelected {
  name: string;
  [key: string]: unknown;
}

interface SkillRecipe {
  skillIds?: string[];
  [key: string]: unknown;
}

interface SkillCatalogSnapshot {
  selected: SkillSelected | null;
  selectedRecipe: unknown;
  recommendations: unknown[];
  recipes: SkillRecipe[];
  summary: unknown;
}

interface SkillLibrarySnapshot {
  catalog?: {
    selected: unknown;
    selectedRecipe: unknown;
  };
  actions?: unknown[];
}

interface SkillBridgeSnapshot {
  selected: unknown;
  invocation: unknown;
  actions?: unknown[];
}

interface SkillInstallPlanSnapshot {
  focus: unknown;
  steps: unknown[];
  actions: unknown[];
}

export type ZavorthControlLegacyRouteDeps = {
  host: string;
  port: number;
  snippetUserId: string;
  getPublicBaseUrl: () => string | null;
  getClassicZavorthControlHtml: () => string;
  getStats: () => Record<string, unknown>;
  getSidecars: () => unknown;
  getRecentLogs: (limit: number) => unknown[];
  getAuditLogs: (url: URL) => Promise<unknown[]>;
  getAuditStats: () => Promise<Record<string, unknown>>;
  getSkillCatalogSnapshot: (input?: {
    selectedId?: string | null;
    recipeId?: string | null;
    query?: string | null;
    recommendFor?: string | null;
  }) => SkillCatalogSnapshot;
  getSkillMcpSnapshot: (input?: {
    selectedId?: string | null;
    recipeId?: string | null;
    query?: string | null;
    recommendFor?: string | null;
  }) => Record<string, unknown>;
  getSkillLibrarySnapshot: (input?: {
    selectedId?: string | null;
    recipeId?: string | null;
    query?: string | null;
    recommendFor?: string | null;
  }) => SkillLibrarySnapshot;
  getSkillBridgeSnapshot: (input?: {
    selectedId?: string | null;
    query?: string | null;
    invoke?: boolean;
    mode?: 'dry-run' | 'live';
    live?: boolean;
    channel?: string | null;
    ownerApprovalId?: string | null;
    intent?: string | null;
    persistReceipt?: boolean;
  }) => SkillBridgeSnapshot | Promise<SkillBridgeSnapshot>;
  getSkillInstallPlanSnapshot: (input?: {
    selectedId?: string | null;
    recipeId?: string | null;
    query?: string | null;
    recommendFor?: string | null;
  }) => SkillInstallPlanSnapshot;
  writeHtml: WriteHtml;
  writeJson: WriteJson;
  readJsonBody: ReadJsonBody;
};

export class ZavorthControlLegacyRouteService {
  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    pathname: string,
    deps: ZavorthControlLegacyRouteDeps,
  ): Promise<boolean> {
    if (pathname === '/api/stats') {
      deps.writeJson(res, deps.getStats(), 200);
      return true;
    }

    if (pathname === '/api/sidecars') {
      deps.writeJson(res, { sidecars: deps.getSidecars() }, 200);
      return true;
    }

    if (pathname === '/api/logs') {
      deps.writeJson(res, { logs: deps.getRecentLogs(100) }, 200);
      return true;
    }

    if (pathname === '/api/skills' && req.method === 'GET') {
      const snapshot = deps.getSkillCatalogSnapshot({
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

    if (pathname === '/api/skills/library' && req.method === 'GET') {
      const snapshot = deps.getSkillLibrarySnapshot({
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

    if (pathname === '/api/skills/install-plan' && req.method === 'GET') {
      const snapshot = deps.getSkillInstallPlanSnapshot({
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

    if (pathname === '/api/skills/recipes' && req.method === 'GET') {
      const snapshot = deps.getSkillCatalogSnapshot({
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

    if (pathname === '/api/skills/mcp' && req.method === 'GET') {
      deps.writeJson(res, {
        ok: true,
        mcp: deps.getSkillMcpSnapshot({
          selectedId: url.searchParams.get('id'),
          recipeId: url.searchParams.get('recipe'),
          query: url.searchParams.get('q'),
          recommendFor: url.searchParams.get('recommend'),
        }),
      }, 200);
      return true;
    }

    if (pathname === '/api/skills/bridge' && req.method === 'GET') {
      const snapshot = await deps.getSkillBridgeSnapshot({
        selectedId: url.searchParams.get('id') || url.searchParams.get('skill'),
        query: url.searchParams.get('q'),
        invoke: ['1', 'true', 'yes'].includes(String(url.searchParams.get('invoke') || '').toLowerCase()),
        mode: url.searchParams.get('mode') === 'live' ? 'live' : 'dry-run',
        live: url.searchParams.get('live') === '1' || url.searchParams.get('mode') === 'live',
        channel: url.searchParams.get('channel'),
        ownerApprovalId: url.searchParams.get('approvalId') || url.searchParams.get('approval-id'),
        intent: url.searchParams.get('intent'),
        persistReceipt: ['1', 'true', 'yes'].includes(String(url.searchParams.get('persist') || '').toLowerCase()),
      });
      deps.writeJson(res, {
        ok: true,
        bridge: snapshot,
        selected: snapshot.selected,
        invocation: snapshot.invocation,
        actions: snapshot.actions || [],
      }, 200);
      return true;
    }

    if (pathname.startsWith('/api/skills/') && req.method === 'GET') {
      const selectedId = decodeURIComponent(pathname.replace('/api/skills/', '').trim());
      if (!selectedId || ['recipes', 'mcp', 'library', 'install-plan', 'bridge'].includes(selectedId)) {
        deps.writeJson(res, { ok: false, error: 'Skill invalida.' }, 404);
        return true;
      }

      const snapshot = deps.getSkillCatalogSnapshot({ selectedId });
      if (!snapshot.selected) {
        deps.writeJson(res, { ok: false, error: `Skill nao encontrada: ${selectedId}.` }, 404);
        return true;
      }

      deps.writeJson(res, {
        ok: true,
        skill: snapshot.selected,
        recipes: snapshot.recipes.filter((recipe: SkillRecipe) =>
          Array.isArray(recipe.skillIds)
          && recipe.skillIds.some((skillId: string) => String(skillId || '').trim().toLowerCase() === snapshot.selected!.name.toLowerCase())),
        recommendations: snapshot.recommendations,
      }, 200);
      return true;
    }

    if (pathname === '/api/snippets' && req.method === 'GET') {
      const svc = new SnippetService();
      const snippets = await svc.list(deps.snippetUserId || config.allowedUserIds[0] || '1');
      deps.writeJson(res, { snippets }, 200);
      return true;
    }

    if (pathname === '/api/snippets/save' && req.method === 'POST') {
      try {
        const body = await deps.readJsonBody(req);
        const svc = new SnippetService();
        const snippet = await svc.save(
          deps.snippetUserId || config.allowedUserIds[0] || '1',
          body.name as string,
          body.content as string,
        );
        deps.writeJson(res, { ok: true, snippet }, 200);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        deps.writeJson(res, { ok: false, error: message }, 400);
      }
      return true;
    }

    if (pathname === '/api/snippets/delete' && req.method === 'POST') {
      try {
        const body = await deps.readJsonBody(req);
        const svc = new SnippetService();
        const ok = await svc.delete(
          deps.snippetUserId || config.allowedUserIds[0] || '1',
          body.name as string,
        );
        deps.writeJson(res, { ok }, 200);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        deps.writeJson(res, { ok: false, error: message }, 400);
      }
      return true;
    }

    if (pathname === '/api/audit' && req.method === 'GET') {
      deps.writeJson(res, await deps.getAuditLogs(url), 200);
      return true;
    }

    if (pathname === '/api/audit/stats' && req.method === 'GET') {
      deps.writeJson(res, await deps.getAuditStats(), 200);
      return true;
    }

    if (pathname === '/api/bridge/schema' && req.method === 'GET') {
      try {
        const schema = require('../contracts/BridgeProtocolSchema.js');
        deps.writeJson(
          res,
          {
            request: schema.BRIDGE_REQUEST_JSON_SCHEMA,
            response: schema.BRIDGE_RESPONSE_JSON_SCHEMA,
          },
          200,
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        deps.writeJson(res, { error: message }, 500);
      }
      return true;
    }

    if (pathname === '/healthz') {
      deps.writeJson(
        res,
        {
          ok: true,
          service: 'zavorth-control',
          port: deps.port,
          host: deps.host,
          publicBaseUrl: deps.getPublicBaseUrl(),
        },
        200,
      );
      return true;
    }

    return false;
  }
}
