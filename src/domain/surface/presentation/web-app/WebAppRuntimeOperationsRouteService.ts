import * as http from 'http';
import { config } from '../../../../config/index.js';
import type {
  GatewayCanonicalSessionContext,
} from '../../../../contracts/GatewayContract.js';
import {
  buildZavorthProductModeSnapshot,
  listZavorthProductModeSnapshots,
} from '../../../../services/ProductModeService.js';
import type { WebAppRuntimeRouteDeps } from './WebAppRuntimeRouteService.js';

export class WebAppRuntimeOperationsRouteService {
  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    pathname: string,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<boolean> {
    if (pathname === '/api/web/gateway/runtime' && req.method === 'GET') {
      if (!deps.gatewayRuntime) {
        deps.writeJson(res, { ok: false, error: 'Gateway runtime canÃƒÂ´nico indisponivel.' }, 503);
        return true;
      }
      const requestedSessionId = String(url.searchParams.get('sessionId') || '').trim();
      const sessionId = requestedSessionId;
      const sessionContext = sessionId
        ? this.buildSessionContext(sessionId, deps)
        : {
            sessionId: null,
            chatId: null,
            userId: deps.runtime.webUserId,
            sourceUserId: null,
            platform: 'web',
          };
      try {
        const runtimeSnapshot = await deps.gatewayRuntime.buildCanonicalSnapshot({
          ...sessionContext,
          hydrated: this.isFullDetailRequested(url),
        });
        deps.writeJson(res, { ok: true, runtime: runtimeSnapshot }, 200);
      } catch (error: any) {
        deps.writeJson(
          res,
          {
            ok: true,
            degraded: true,
            warning: error?.message || 'Gateway runtime snapshot indisponivel.',
            runtime: {
              generatedAt: new Date().toISOString(),
              degraded: true,
              session: sessionContext,
              companions: [],
              runs: [],
              summary: {
                status: 'degraded',
                reason: error?.message || 'Gateway runtime snapshot indisponivel.',
              },
            },
          },
          200,
        );
      }
      return true;
    }

    if (pathname === '/api/web/runtime/resources' && req.method === 'GET') {
      if (!deps.desktopResources) {
        deps.writeJson(res, { ok: false, error: 'Desktop Resource Plane indisponivel neste runtime.' }, 503);
        return true;
      }
      const snapshot = await this.readDesktopResources(deps, { preferCachedWithinMs: 15_000 });
      deps.writeJson(res, { ok: true, snapshot }, 200);
      return true;
    }

    if (pathname === '/api/web/runtime/mode' && req.method === 'GET') {
      deps.writeJson(res, await this.getProductMode(deps), 200);
      return true;
    }

    if (pathname === '/api/web/runtime/mode' && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      try {
        const payload = await this.setProductMode({
          mode: String(body.mode || '').trim(),
          requestedBy: String(body.requestedBy || deps.runtime.webUserId || '').trim() || null,
        }, deps);
        deps.writeJson(res, payload, 200);
      } catch (error: any) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao trocar o product mode.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/runtime/mode-escalation' && req.method === 'GET') {
      const sessionId = String(url.searchParams.get('sessionId') || '').trim()
        || deps.resolveSessionId(url)
        || deps.realtime.createSession();
      try {
        const payload = await this.getModeEscalation(sessionId, deps);
        deps.writeJson(res, payload, 200);
      } catch (error: any) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao ler o mode escalation.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/runtime/mode-escalation/resolve' && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      try {
        const payload = await this.resolveModeEscalation({
          requestId: String(body.requestId || '').trim(),
          decision: String(body.decision || '').trim().toLowerCase() as 'approve' | 'reject',
          scope: String(body.scope || '').trim() || null,
          requestedBy: String(body.requestedBy || deps.runtime.webUserId || '').trim() || null,
        }, deps);
        deps.writeJson(res, payload, 200);
      } catch (error: any) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao resolver o mode escalation.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/runtime/companions' && req.method === 'GET') {
      if (!deps.companions) {
        deps.writeJson(res, { ok: false, error: 'Companion Control Plane indisponivel neste runtime.' }, 503);
        return true;
      }
      const snapshot = await deps.companions.buildSnapshot({ preferCachedWithinMs: 15_000 });
      deps.writeJson(res, { ok: true, snapshot }, 200);
      return true;
    }

    const companionInspectMatch = pathname.match(/^\/api\/web\/runtime\/companions\/([^/]+)$/);
    if (companionInspectMatch && req.method === 'GET') {
      if (!deps.companions) {
        deps.writeJson(res, { ok: false, error: 'Companion Control Plane indisponivel neste runtime.' }, 503);
        return true;
      }
      try {
        const companionId = String(companionInspectMatch[1] || '').trim().toLowerCase() as any;
        const companion = await deps.companions.inspectCompanion(companionId, { preferCachedWithinMs: 15_000 });
        deps.writeJson(res, { ok: true, companion }, 200);
      } catch (error: any) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao inspecionar companion.' }, 400);
      }
      return true;
    }

    const companionActionMatch = pathname.match(/^\/api\/web\/runtime\/companions\/([^/]+)\/actions$/);
    if (companionActionMatch && req.method === 'POST') {
      if (!deps.companions) {
        deps.writeJson(res, { ok: false, error: 'Companion Control Plane indisponivel neste runtime.' }, 503);
        return true;
      }
      const body = await deps.readJsonBody(req);
      const actionId = String(body.actionId || '').trim().toLowerCase();
      if (!actionId) {
        deps.writeJson(res, { ok: false, error: 'actionId obrigatorio.' }, 400);
        return true;
      }
      try {
        const companionId = String(companionActionMatch[1] || '').trim().toLowerCase() as any;
        const result = await deps.companions.executeAction({
          companionId,
          actionId: actionId as any,
          requestedBy: String(body.requestedBy || deps.runtime.webUserId || '').trim() || null,
          dryRun: body.dryRun === true,
          force: body.force === true,
        });
        deps.writeJson(res, { ok: result.ok, result }, result.ok ? 200 : result.requiresApproval ? 202 : 409);
      } catch (error: any) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao operar companion.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/runtime/workspace/doctor' && req.method === 'GET') {
      if (!deps.workspaceOptimizer) {
        deps.writeJson(res, { ok: false, error: 'Workspace Optimizer indisponivel neste runtime.' }, 503);
        return true;
      }
      try {
        const workspaceHint = String(url.searchParams.get('workspace') || '').trim() || null;
        const profile = await deps.workspaceOptimizer.buildLoadProfile({ workspaceHint });
        deps.writeJson(res, { ok: true, profile }, 200);
      } catch (error: any) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao montar o workspace doctor.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/runtime/workspace/optimize' && req.method === 'POST') {
      if (!deps.workspaceOptimizer) {
        deps.writeJson(res, { ok: false, error: 'Workspace Optimizer indisponivel neste runtime.' }, 503);
        return true;
      }
      const body = await deps.readJsonBody(req);
      try {
        const requestedBy = String(body.requestedBy || deps.runtime.webUserId || '').trim() || null;
        const sourceSurface = String(body.sourceSurface || 'web-runtime').trim() || 'web-runtime';
        if (body.applyPlanId) {
          const result = await deps.workspaceOptimizer.applyOptimization({
            planId: String(body.applyPlanId || '').trim(),
            requestedBy,
            sourceSurface,
          });
          deps.writeJson(
            res,
            { ok: result.ok, result },
            result.ok ? 200 : result.waitingApproval ? 202 : result.blocked ? 409 : 400,
          );
          return true;
        }

        const presetId = String(body.presetId || body.companionId || '').trim().toLowerCase();
        if (!presetId) {
          deps.writeJson(res, { ok: false, error: 'presetId obrigatorio.' }, 400);
          return true;
        }
        const preview = await deps.workspaceOptimizer.previewOptimization({
          presetId: presetId as any,
          workspaceHint: String(body.workspaceRoot || body.workspaceHint || '').trim() || null,
          requestedBy,
          sourceSurface,
        });
        deps.writeJson(
          res,
          { ok: !preview.blocked, preview },
          preview.blocked ? 409 : preview.waitingApproval ? 202 : 200,
        );
      } catch (error: any) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao otimizar workspace.' }, 400);
      }
      return true;
    }

    return false;
  }

  public async readDesktopResources(
    deps: WebAppRuntimeRouteDeps,
    options: {
      preferCachedWithinMs?: number;
    } = {},
  ): Promise<Record<string, any> | null> {
    if (!deps.desktopResources) {
      return null;
    }
    return deps.desktopResources.inspectLive({
      preferCachedWithinMs: Math.max(0, Number(options.preferCachedWithinMs || 0) || 0),
    });
  }

  public async getProductMode(
    deps: WebAppRuntimeRouteDeps,
  ): Promise<Record<string, any>> {
    const productMode = this.buildProductMode(deps);
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      productMode,
      modes: listZavorthProductModeSnapshots(productMode?.runtimeProfile || config.zavorthProfile),
    };
  }

  public async setProductMode(
    input: {
      mode: string;
      requestedBy?: string | null;
    },
    deps: WebAppRuntimeRouteDeps,
  ): Promise<Record<string, any>> {
    if (!deps.capabilityLifecycle?.setProductMode) {
      throw new Error('Product mode indisponivel neste runtime.');
    }
    const mode = String(input.mode || '').trim();
    if (!mode) {
      throw new Error('mode obrigatorio.');
    }
    const productMode = deps.capabilityLifecycle.setProductMode(
      mode,
      String(input.requestedBy || deps.runtime.webUserId || '').trim() || 'web-runtime',
    );
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      productMode,
      modes: listZavorthProductModeSnapshots(productMode.runtimeProfile),
      restartRecommended: true,
      summary: `${productMode.label} ativo. Runtime base esperado: ${productMode.defaultRuntimeProfile}; perfil atual: ${productMode.runtimeProfile}.`,
    };
  }

  public async getModeEscalation(
    sessionId: string,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<Record<string, any>> {
    if (!deps.modeEscalation) {
      return {
        ok: true,
        generatedAt: new Date().toISOString(),
        modeEscalation: null,
      };
    }
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      modeEscalation: deps.modeEscalation.buildSnapshot(sessionId),
    };
  }

  public async resolveModeEscalation(
    input: {
      requestId: string;
      decision: 'approve' | 'reject';
      scope?: string | null;
      requestedBy?: string | null;
    },
    deps: WebAppRuntimeRouteDeps,
  ): Promise<Record<string, any>> {
    if (!deps.modeEscalation) {
      throw new Error('Mode escalation indisponivel neste runtime.');
    }
    const requestId = String(input.requestId || '').trim();
    if (!requestId) {
      throw new Error('requestId obrigatorio.');
    }
    const decision = String(input.decision || '').trim().toLowerCase();
    if (decision !== 'approve' && decision !== 'reject') {
      throw new Error('decision deve ser approve ou reject.');
    }
    const normalizedScope =
      input.scope === 'session' || input.scope === 'host'
        ? input.scope
        : input.scope === 'once'
          ? 'once'
          : null;
    const resolution = deps.modeEscalation.resolveRequest({
      requestId,
      decision,
      scope: normalizedScope,
      requestedBy: String(input.requestedBy || deps.runtime.webUserId || '').trim() || 'web-runtime',
    });
    return {
      generatedAt: new Date().toISOString(),
      ...resolution,
    };
  }

  private buildProductMode(deps: WebAppRuntimeRouteDeps) {
    if (deps.capabilityLifecycle?.buildProductModeSnapshot) {
      return deps.capabilityLifecycle.buildProductModeSnapshot();
    }
    return buildZavorthProductModeSnapshot(config.zavorthProductMode, config.zavorthProfile);
  }

  private buildSessionContext(
    sessionId: string,
    deps: WebAppRuntimeRouteDeps,
  ): GatewayCanonicalSessionContext {
    return {
      sessionId,
      chatId: deps.realtime.getChatId(sessionId),
      userId: deps.runtime.webUserId,
      sourceUserId: sessionId,
      platform: 'web',
    };
  }

  private isFullDetailRequested(url: URL): boolean {
    const detail = String(url.searchParams.get('detail') || '').trim().toLowerCase();
    return detail === 'full' || detail === 'resolved' || detail === 'hydrated';
  }
}

