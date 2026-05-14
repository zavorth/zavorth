import * as http from 'http';
import type { WebAppSurfaceRouteDeps } from './WebAppSurfaceRouteService.js';
type SurfaceToolingDynamic = any;

export class WebAppSurfaceToolingRouteService {
  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    pathname: string,
    deps: WebAppSurfaceRouteDeps,
  ): Promise<boolean> {
    if (pathname === '/api/web/tools' && req.method === 'GET') {
      const toolSurface = deps.runtimeToolSurface || deps.toolSurface;
      if (!toolSurface) {
        deps.writeJson(res, { ok: false, error: 'Catalogo de tools indisponivel.' }, 503);
        return true;
      }

      const requestedSessionId = String(url.searchParams.get('sessionId') || '').trim();
      const selectedId = String(url.searchParams.get('selectedId') || '').trim() || null;
      const query = String(url.searchParams.get('q') || url.searchParams.get('query') || '').trim() || null;
      deps.writeJson(
        res,
        {
          ok: true,
          tools: toolSurface.buildSnapshot(
            requestedSessionId
              ? {
                  sessionId: requestedSessionId,
                  chatId: deps.realtime?.getChatId(requestedSessionId) || `web:${requestedSessionId}`,
                  userId: deps.runtime?.webUserId || '1',
                  selectedId,
                  query,
                }
              : {
                  selectedId,
                  query,
                },
          ),
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/plugins' && req.method === 'GET') {
      if (!deps.pluginRegistry) {
        deps.writeJson(res, { ok: false, error: 'Registry de plugins indisponivel.' }, 503);
        return true;
      }

      deps.writeJson(
        res,
        {
          ok: true,
          plugins: deps.pluginRegistry.buildSnapshot({
            selectedId: String(url.searchParams.get('selectedId') || '').trim() || null,
            query: String(url.searchParams.get('q') || url.searchParams.get('query') || '').trim() || null,
          }),
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/plugins/actions' && req.method === 'POST') {
      if (!deps.pluginRegistry || !deps.pluginActions) {
        deps.writeJson(res, { ok: false, error: 'Acoes do plugin plane indisponiveis.' }, 503);
        return true;
      }

      try {
        const body = await deps.readJsonBody(req);
        const pluginId = String(body?.pluginId || '').trim();
        const actionId = String(body?.actionId || '').trim();
        const result = await deps.pluginActions.execute({
          pluginId,
          actionId,
          requestedBy: deps.runtime?.webUserId || 'web-user',
        });
        deps.writeJson(res, {
          ok: true,
          result,
          plugins: deps.pluginRegistry.buildSnapshot({ selectedId: pluginId }),
        }, 200);
      } catch (error: SurfaceToolingDynamic) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao executar a acao do plugin plane.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/platform' && req.method === 'GET') {
      if (!deps.platformRegistry) {
        deps.writeJson(res, { ok: false, error: 'Platform plane indisponivel.' }, 503);
        return true;
      }

      deps.writeJson(
        res,
        {
          ok: true,
          platform: deps.platformRegistry.buildSnapshot({
            selectedId: String(url.searchParams.get('selectedId') || '').trim() || null,
            query: String(url.searchParams.get('q') || url.searchParams.get('query') || '').trim() || null,
          }),
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/platform/actions' && req.method === 'POST') {
      if (!deps.platformRegistry || !deps.platformActions) {
        deps.writeJson(res, { ok: false, error: 'Acoes do platform plane indisponiveis.' }, 503);
        return true;
      }

      try {
        const body = await deps.readJsonBody(req);
        const entryId = String(body?.entryId || '').trim();
        const actionId = String(body?.actionId || '').trim();
        const result = await deps.platformActions.execute({
          entryId,
          actionId,
          requestedBy: deps.runtime?.webUserId || 'web-user',
          workspace: deps.workspaceRoot,
        });
        deps.writeJson(res, {
          ok: true,
          result,
          platform: result.snapshot || deps.platformRegistry.buildSnapshot({ selectedId: entryId }),
          plugins: entryId.toLowerCase().startsWith('plugin:') && deps.pluginRegistry
            ? deps.pluginRegistry.buildSnapshot({ selectedId: entryId.replace(/^plugin:/i, '') })
            : null,
        }, 200);
      } catch (error: SurfaceToolingDynamic) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao executar a acao do platform plane.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/platform/sync' && req.method === 'POST') {
      if (!deps.platformRegistry || !deps.platformCatalogSync) {
        deps.writeJson(res, { ok: false, error: 'Sync do platform plane indisponivel.' }, 503);
        return true;
      }

      try {
        const result = await deps.platformCatalogSync.sync();
        deps.writeJson(
          res,
          {
            ok: result.ok,
            result,
            platform: deps.platformRegistry.buildSnapshot(),
          },
          result.ok ? 200 : 400,
        );
      } catch (error: SurfaceToolingDynamic) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao sincronizar o platform plane.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/platform/publish' && req.method === 'POST') {
      if (!deps.platformRegistry || !deps.platformPublisher) {
        deps.writeJson(res, { ok: false, error: 'Publish do platform plane indisponivel.' }, 503);
        return true;
      }

      try {
        const body = await deps.readJsonBody(req);
        const packagePath = String(body?.packagePath || '').trim();
        const authToken = String(body?.authToken || process.env.ZAVORTH_PLATFORM_PUBLISH_TOKEN || '').trim();
        const signLocal = body?.signLocal !== false;
        if (!packagePath) {
          deps.writeJson(res, { ok: false, error: 'packagePath obrigatorio.' }, 400);
          return true;
        }

        const result = await deps.platformPublisher.publishDetailed({
          packagePath,
          authToken,
          signLocal,
        });
        deps.writeJson(
          res,
          {
            ok: result.ok,
            result,
            platform: deps.platformRegistry.buildSnapshot(),
          },
          result.ok ? 200 : 400,
        );
      } catch (error: SurfaceToolingDynamic) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao publicar no platform plane.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/hooks' && req.method === 'GET') {
      if (!deps.hookPlane) {
        deps.writeJson(res, { ok: false, error: 'Plano de hooks indisponivel.' }, 503);
        return true;
      }

      deps.writeJson(res, { ok: true, hooks: deps.hookPlane.buildSnapshot() }, 200);
      return true;
    }

    if (pathname === '/api/web/hooks/run' && req.method === 'POST') {
      if (!deps.hookPlane || !deps.hookPipeline) {
        deps.writeJson(res, { ok: false, error: 'Execucao operacional de hooks indisponivel.' }, 503);
        return true;
      }

      try {
        const body = await deps.readJsonBody(req);
        const event = String(body?.event || '').trim();
        const workspace = String(body?.workspace || '').trim() || deps.workspaceRoot;
        const dryRun = body?.dryRun !== false;
        if (!event) {
          deps.writeJson(res, { ok: false, error: 'event obrigatorio.' }, 400);
          return true;
        }

        const [plan, run, pipeline] = await Promise.all([
          deps.hookPipeline.buildExecutionPlan({ workspace, event }),
          deps.hookPipeline.runEvent({ workspace, event, dryRun }),
          deps.hookPipeline.buildSnapshot(workspace),
        ]);
        deps.writeJson(
          res,
          {
            ok: run.ok,
            event,
            workspace,
            dryRun,
            plan,
            run,
            pipeline,
            hooks: deps.hookPlane.buildSnapshot(),
          },
          run.ok ? 200 : 409,
        );
      } catch (error: SurfaceToolingDynamic) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao executar o hook plane.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/workspace/extensions' && req.method === 'GET') {
      if (!deps.workspaceExtensions) {
        deps.writeJson(res, { ok: false, error: 'Workspace plane indisponivel.' }, 503);
        return true;
      }

      deps.writeJson(
        res,
        {
          ok: true,
          workspaceExtensions: deps.workspaceExtensions.buildSnapshot({
            selectedId: String(url.searchParams.get('selectedId') || '').trim() || null,
            query: String(url.searchParams.get('q') || url.searchParams.get('query') || '').trim() || null,
          }),
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/runtime-modes' && req.method === 'GET') {
      if (!deps.runtimeModes) {
        deps.writeJson(res, { ok: false, error: 'Catalogo de modos de runtime indisponivel.' }, 503);
        return true;
      }

      deps.writeJson(res, { ok: true, runtimeModes: deps.runtimeModes.buildSnapshot() }, 200);
      return true;
    }

    if (pathname === '/api/web/security-mesh' && req.method === 'GET') {
      if (!deps.securityMesh) {
        deps.writeJson(res, { ok: false, error: 'Security Mesh indisponivel.' }, 503);
        return true;
      }

      deps.writeJson(res, { ok: true, securityMesh: deps.securityMesh.buildSnapshot() }, 200);
      return true;
    }

    if (pathname === '/api/web/trust-plane' && req.method === 'GET') {
      if (!deps.trustPlane) {
        deps.writeJson(res, { ok: false, error: 'Trust Plane indisponivel.' }, 503);
        return true;
      }

      deps.writeJson(res, { ok: true, trustPlane: deps.trustPlane.buildSnapshot() }, 200);
      return true;
    }

    if (pathname === '/api/web/trust-plane/actions' && req.method === 'POST') {
      if (!deps.trustPlane || !deps.trustPlaneActions) {
        deps.writeJson(res, { ok: false, error: 'Acoes do Trust Plane indisponiveis.' }, 503);
        return true;
      }

      try {
        const body = await deps.readJsonBody(req);
        const actionId = String(body?.actionId || '').trim();
        if (!actionId) {
          deps.writeJson(res, { ok: false, error: 'actionId obrigatorio.' }, 400);
          return true;
        }

        const requestedBy = deps.runtime?.webUserId || 'web-user';
        const planId = String(body?.planId || body?.mutationPlanId || '').trim();
        const ledgerId = String(body?.ledgerId || body?.rollbackLedgerId || '').trim();
        const action = actionId === 'apply' && planId && deps.trustPlaneActions.apply
          ? await deps.trustPlaneActions.apply({ planId, requestedBy })
          : actionId === 'rollback' && ledgerId && deps.trustPlaneActions.rollback
            ? await deps.trustPlaneActions.rollback({ ledgerId, requestedBy, sourceSurface: 'web' })
            : await deps.trustPlaneActions.execute({
            actionId,
            profile: String(body?.profile || '').trim() || null,
            toolName: String(body?.toolName || '').trim() || null,
            defaultPolicy: String(body?.defaultPolicy || '').trim() || null,
            sourceId: String(body?.sourceId || '').trim() || null,
            mode: String(body?.mode || '').trim() || null,
            approvalScope: String(body?.approvalScope || body?.scope || '').trim() || null,
            skillNames: Array.isArray(body?.skillNames)
              ? body.skillNames.map((entry: SurfaceToolingDynamic) => String(entry || '').trim()).filter(Boolean)
              : null,
            requestedBy,
            sourceSurface: 'web',
          });
        deps.writeJson(res, {
          ok: action?.ok !== false,
          action,
          trustPlane: action?.snapshot || deps.trustPlane.buildSnapshot(),
        }, action?.status === 'waiting_approval' ? 202 : 200);
      } catch (error: SurfaceToolingDynamic) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao agir no Trust Plane.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/teams' && req.method === 'GET') {
      if (!deps.teamCatalog) {
        deps.writeJson(res, { ok: false, error: 'Catalogo de teams indisponivel.' }, 503);
        return true;
      }

      deps.writeJson(res, { ok: true, teams: deps.teamCatalog.buildSnapshot() }, 200);
      return true;
    }

    if (pathname === '/api/web/tenants' && req.method === 'GET') {
      if (!deps.tenantGovernance) {
        deps.writeJson(res, { ok: false, error: 'Governanca de tenants indisponivel.' }, 503);
        return true;
      }

      deps.writeJson(res, { ok: true, tenantGovernance: deps.tenantGovernance.buildSnapshot() }, 200);
      return true;
    }

    if (pathname === '/api/web/tenants/actions' && req.method === 'POST') {
      if (!deps.tenantGovernance || !deps.tenantGovernanceActions) {
        deps.writeJson(res, { ok: false, error: 'Acoes da governanca de tenants indisponiveis.' }, 503);
        return true;
      }

      try {
        const body = await deps.readJsonBody(req);
        const tenantId = String(body?.tenantId || '').trim();
        const actionId = String(body?.actionId || '').trim() as
          | 'inspect-tenant'
          | 'review-teams'
          | 'review-channels'
          | 'review-runtime'
          | 'review-memoryplane'
          | 'review-sessions'
          | 'start-onboarding-review'
          | 'start-tenant-audit';
        if (!tenantId || !actionId) {
          deps.writeJson(res, { ok: false, error: 'tenantId e actionId sao obrigatorios.' }, 400);
          return true;
        }
        if (!['inspect-tenant', 'review-teams', 'review-channels', 'review-runtime', 'review-memoryplane', 'review-sessions', 'start-onboarding-review', 'start-tenant-audit'].includes(actionId)) {
          deps.writeJson(res, { ok: false, error: 'actionId invalido para a governanca de tenants.' }, 400);
          return true;
        }

        const result = await deps.tenantGovernanceActions.execute({
          tenantId,
          actionId,
          workspace: deps.workspaceRoot,
        });
        deps.writeJson(res, { ok: true, ...result }, result?.action?.status === 'started' ? 202 : 200);
      } catch (error: SurfaceToolingDynamic) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao executar a acao guiada do tenant.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/agent-os' && req.method === 'GET') {
      if (!deps.agentOperatingSystem) {
        deps.writeJson(res, { ok: false, error: 'Agent OS limitado indisponivel.' }, 503);
        return true;
      }

      deps.writeJson(res, { ok: true, agentOs: deps.agentOperatingSystem.buildSnapshot({ workspace: deps.workspaceRoot }) }, 200);
      return true;
    }

    if (pathname === '/api/web/agent-os/actions' && req.method === 'POST') {
      if (!deps.agentOperatingSystemActions) {
        deps.writeJson(res, { ok: false, error: 'Acoes do Agent OS indisponiveis.' }, 503);
        return true;
      }

      try {
        const body = await deps.readJsonBody(req);
        const actionId = String(body?.actionId || '').trim() as 'start_loop' | 'resume_loop';
        if (!actionId || !['start_loop', 'resume_loop'].includes(actionId)) {
          deps.writeJson(res, { ok: false, error: 'actionId invalido para o Agent OS.' }, 400);
          return true;
        }

        const result = await deps.agentOperatingSystemActions.execute({
          actionId,
          teamId: String(body?.teamId || '').trim() || null,
          objective: String(body?.objective || '').trim() || null,
          featureId: String(body?.featureId || '').trim() || null,
          workflowRunId: String(body?.workflowRunId || '').trim() || null,
          resumeStageId: String(body?.resumeStageId || '').trim() || null,
          workspace: deps.workspaceRoot,
          runtimeUserId: deps.runtime?.webUserId || 'web-user',
        });

        deps.writeJson(res, { ok: true, ...result }, 202);
      } catch (error: SurfaceToolingDynamic) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao executar a acao do Agent OS.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/operations/actions' && req.method === 'POST') {
      if (!deps.operationsActions) {
        deps.writeJson(res, { ok: false, error: 'Acoes operacionais indisponiveis.' }, 503);
        return true;
      }

      try {
        const body = await deps.readJsonBody(req);
        const actionId = String(body?.actionId || '').trim();
        if (!actionId) {
          deps.writeJson(res, { ok: false, error: 'actionId obrigatorio.' }, 400);
          return true;
        }

        const action = deps.operationsActions.execute(actionId);
        deps.writeJson(res, { ok: true, action, accepted: action.status === 'started' }, action.status === 'started' ? 202 : 500);
      } catch (error: SurfaceToolingDynamic) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao iniciar acao operacional.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/operations/zavorthBridge/mobile/status' && req.method === 'GET') {
      if (!deps.zavorthBridgeMobileAccess) {
        deps.writeJson(res, { ok: false, error: 'Acesso movel do ZavorthBridge indisponivel.' }, 503);
        return true;
      }
      deps.writeJson(res, { ok: true, mobileAccess: await deps.zavorthBridgeMobileAccess.status() }, 200);
      return true;
    }

    if (pathname === '/api/web/operations/zavorthBridge/mobile/guide' && req.method === 'GET') {
      if (!deps.zavorthBridgeMobileAccess) {
        deps.writeJson(res, { ok: false, error: 'Guia movel do ZavorthBridge indisponivel.' }, 503);
        return true;
      }
      deps.writeJson(res, { ok: true, mobileAccess: await deps.zavorthBridgeMobileAccess.guide() }, 200);
      return true;
    }

    if (pathname === '/api/web/operations/zavorthBridge/mobile/start' && req.method === 'POST') {
      if (!deps.zavorthBridgeMobileAccess) {
        deps.writeJson(res, { ok: false, error: 'Acesso movel do ZavorthBridge indisponivel.' }, 503);
        return true;
      }

      try {
        const body = await deps.readJsonBody(req);
        const mobileAccess = await deps.zavorthBridgeMobileAccess.start({
          requestedBy: deps.runtime?.webUserId || 'web-user',
          forceRepair: body?.forceRepair === true,
        });
        deps.writeJson(res, { ok: mobileAccess.ok, mobileAccess }, mobileAccess.ok ? 200 : 409);
      } catch (error: SurfaceToolingDynamic) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao iniciar o acesso movel do ZavorthBridge.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/operations/zavorthBridge/mobile/stop' && req.method === 'POST') {
      if (!deps.zavorthBridgeMobileAccess) {
        deps.writeJson(res, { ok: false, error: 'Acesso movel do ZavorthBridge indisponivel.' }, 503);
        return true;
      }

      try {
        const mobileAccess = await deps.zavorthBridgeMobileAccess.stop({
          requestedBy: deps.runtime?.webUserId || 'web-user',
        });
        deps.writeJson(res, { ok: true, mobileAccess }, 200);
      } catch (error: SurfaceToolingDynamic) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao encerrar o acesso movel do ZavorthBridge.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/operations/AIGateway/status' && req.method === 'GET') {
      if (!deps.AIGatewayGateway) {
        deps.writeJson(res, { ok: false, error: 'Gateway proprio do AIGateway indisponivel.' }, 503);
        return true;
      }
      deps.writeJson(res, { ok: true, AIGateway: deps.AIGatewayGateway.readStatus() }, 200);
      return true;
    }

    if (pathname === '/api/web/operations/AIGateway/doctor' && req.method === 'POST') {
      if (!deps.AIGatewayCompatibilityDoctor) {
        deps.writeJson(res, { ok: false, error: 'Doctor do AIGateway indisponivel.' }, 503);
        return true;
      }

      try {
        const report = await deps.AIGatewayCompatibilityDoctor.run();
        deps.writeJson(res, { ok: report.ok, report }, report.ok ? 200 : 409);
      } catch (error: SurfaceToolingDynamic) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao rodar o doctor do AIGateway.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/operations/AIGateway/actions' && req.method === 'POST') {
      if (!deps.AIGatewayUpstreamSync && !deps.AIGatewayGatewayLauncher) {
        deps.writeJson(res, { ok: false, error: 'Acoes do AIGateway indisponiveis.' }, 503);
        return true;
      }

      try {
        const body = await deps.readJsonBody(req);
        const actionId = String(body?.actionId || '').trim().toLowerCase();
        let report: SurfaceToolingDynamic;
        if (actionId === 'route-start') {
          if (!deps.AIGatewayGatewayLauncher) {
            deps.writeJson(res, { ok: false, error: 'Launcher do gateway AIGateway indisponivel.' }, 503);
            return true;
          }
          report = await deps.AIGatewayGatewayLauncher.ensureStarted();
          deps.writeJson(res, { ok: report.ready || report.running, AIGateway: report, report }, report.ready || report.running ? 200 : 409);
          return true;
        } else if (actionId === 'sync') {
          if (!deps.AIGatewayUpstreamSync) {
            deps.writeJson(res, { ok: false, error: 'Sync do AIGateway indisponivel.' }, 503);
            return true;
          }
          report = await deps.AIGatewayUpstreamSync.sync();
        } else if (actionId === 'promote') {
          if (!deps.AIGatewayUpstreamSync) {
            deps.writeJson(res, { ok: false, error: 'Sync do AIGateway indisponivel.' }, 503);
            return true;
          }
          report = await deps.AIGatewayUpstreamSync.promote({ autoRollback: body?.autoRollback !== false });
        } else if (actionId === 'rollback') {
          if (!deps.AIGatewayUpstreamSync) {
            deps.writeJson(res, { ok: false, error: 'Sync do AIGateway indisponivel.' }, 503);
            return true;
          }
          report = await deps.AIGatewayUpstreamSync.rollback();
        } else {
          deps.writeJson(res, { ok: false, error: 'actionId invalido para o AIGateway.' }, 400);
          return true;
        }

        deps.writeJson(res, { ok: report.ok, report }, report.ok ? 200 : 409);
      } catch (error: SurfaceToolingDynamic) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao operar o AIGateway.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/integrations' && req.method === 'GET') {
      if (!deps.integrationHub) {
        deps.writeJson(res, { ok: false, error: 'Integration Hub indisponivel.' }, 503);
        return true;
      }

      const selectedId = String(url.searchParams.get('selectedId') || '').trim();
      deps.writeJson(res, { ok: true, hub: deps.integrationHub.buildCatalogSnapshot(selectedId || null) }, 200);
      return true;
    }

    if (pathname === '/api/web/integrations/connect' && req.method === 'POST') {
      if (!deps.integrationHub) {
        deps.writeJson(res, { ok: false, error: 'Integration Hub indisponivel.' }, 503);
        return true;
      }

      try {
        const body = await deps.readJsonBody(req);
        const requestedId = String(body?.requestedId || '').trim();
        if (!requestedId) {
          deps.writeJson(res, { ok: false, error: 'requestedId obrigatorio.' }, 400);
          return true;
        }

        const enabledCapabilities = Array.isArray(body?.enabledCapabilities)
          ? body.enabledCapabilities.map((entry: unknown) => String(entry || '').trim()).filter(Boolean)
          : null;
        const answers = body && typeof body.answers === 'object' && body.answers
          ? body.answers as Record<string, string | string[] | boolean>
          : null;
        const draft = deps.integrationHub.buildDraft({
          requestedId,
          requestedBy: 'web-app',
          nickname: typeof body?.nickname === 'string' ? body.nickname : null,
          selectedMode: typeof body?.selectedMode === 'string' ? body.selectedMode : null,
          enabledCapabilities,
          answers,
          persist: body?.persist !== false,
        });
        deps.writeJson(
          res,
          {
            ok: true,
            draft,
            hub: deps.integrationHub.buildCatalogSnapshot(draft.manifest.id),
            storedSecretKeys: deps.integrationHub.getStoredSecretKeys(draft.manifest.id),
          },
          200,
        );
      } catch (error: SurfaceToolingDynamic) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao preparar a integracao.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/integrations/actions' && req.method === 'POST') {
      if (!deps.integrationHub) {
        deps.writeJson(res, { ok: false, error: 'Integration Hub indisponivel.' }, 503);
        return true;
      }

      try {
        const body = await deps.readJsonBody(req);
        const integrationId = String(body?.integrationId || '').trim();
        const actionId = String(body?.actionId || '').trim();
        if (!integrationId || !actionId) {
          deps.writeJson(res, { ok: false, error: 'integrationId e actionId sao obrigatorios.' }, 400);
          return true;
        }

        const action = await deps.integrationHub.executeGuidedAction(integrationId, actionId, {
          requestedBy: deps.runtime?.webUserId || 'web-user',
          workspace: deps.workspaceRoot,
        });
        deps.writeJson(
          res,
          {
            ok: true,
            action,
            hub: deps.integrationHub.buildCatalogSnapshot(integrationId),
            accepted: action.status === 'started',
          },
          action.status === 'started' ? 202 : 200,
        );
      } catch (error: SurfaceToolingDynamic) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao executar a acao guiada.' }, 400);
      }
      return true;
    }

    if (pathname === '/api/web/providers/profile' && req.method === 'POST') {
      if (!deps.providerControlPlane) {
        deps.writeJson(res, { ok: false, error: 'Provider plane indisponivel.' }, 503);
        return true;
      }

      try {
        const body = await deps.readJsonBody(req);
        const profileId = String(body?.profileId || '').trim();
        const selectedId = String(body?.selectedId || '').trim() || null;
        if (!profileId) {
          deps.writeJson(res, { ok: false, error: 'profileId obrigatorio.' }, 400);
          return true;
        }

        const applied = deps.providerControlPlane.applyProfileSelection(profileId);
        deps.writeJson(
          res,
          {
            ok: true,
            appliedProfile: {
              id: applied.profile.id,
              label: applied.profile.label,
              summary: applied.profile.summary,
              preferredOrder: [...applied.profile.preferredOrder],
            },
            selection: {
              replyLabel: applied.selection.replyLabel,
              selectionKind: applied.selection.selectionKind,
              providerName: applied.selection.effectiveProviderName,
              modelName: applied.selection.modelName || null,
              targetId: applied.target.id,
              targetLabel: applied.target.label,
              targetModel: applied.target.currentModel || null,
            },
            capabilities: deps.capabilityCatalog ? deps.capabilityCatalog.buildSnapshot() : null,
            hub: deps.integrationHub ? deps.integrationHub.buildCatalogSnapshot(selectedId) : null,
          },
          200,
        );
      } catch (error: SurfaceToolingDynamic) {
        deps.writeJson(res, { ok: false, error: error?.message || 'Falha ao aplicar o perfil de provider.' }, 400);
      }
      return true;
    }

    return false;
  }
}
