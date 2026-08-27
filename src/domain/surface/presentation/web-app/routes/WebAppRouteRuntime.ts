import * as http from 'http';
import { config } from '../../../../../config/index.js';

import type { WebAppRuntimeRouteDeps } from '../WebAppRuntimeRouteService.js';
import { ZavorthRuntimeReadinessService } from '../../../../../services/ZavorthRuntimeReadinessService.js';
import { ZavorthRuntimeGuidedFixesService } from '../../../../../services/ZavorthRuntimeGuidedFixesService.js';
import { ZavorthRuntimeReadinessUxService } from '../../../../../services/ZavorthRuntimeReadinessUxService.js';
import { ZavorthReadyToGoService } from '../../../../../services/ZavorthReadyToGoService.js';
import { ZavorthStayOnlineService } from '../../../../../services/ZavorthStayOnlineService.js';
import { ZavorthExternalAgentOnboardingService } from '../../../../../services/ZavorthExternalAgentOnboardingService.js';
import { ZavorthExternalAgentGatewayService } from '../../../../../services/ZavorthExternalAgentGatewayService.js';
import { ZavorthCapabilityMeshService } from '../../../../../services/ZavorthCapabilityMeshService.js';
import type { WebAppRuntimeStateRouteService, WebAppRuntimeStateRouteHelpers } from '../WebAppRuntimeStateRouteService.js';
import {
  asRecord,
  isExternalAgentApiApprovalRequested,
  isExternalAgentApiApprovalAccepted,
  normalizeExternalAgentAdapter,
  normalizeExternalAgentPromptMode,
  normalizeExternalAgentIsolation,
  normalizeExternalAgentNetwork,
} from '../WebAppRuntimeStateRouteService.js';

export async function handleRuntimeRoutes(
  service: WebAppRuntimeStateRouteService,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  pathname: string,
  deps: WebAppRuntimeRouteDeps,
  _helpers: WebAppRuntimeStateRouteHelpers,
): Promise<boolean> {
      if (pathname === '/api/approval-action-cards' && req.method === 'GET') {
        const sensitiveActionFlowUx = service.buildSensitiveActionFlowUxProjection(url);
        const visualReceipts = service.buildVisualReceiptsProjection(url);
        const activeMissionUx = service.buildActiveMissionUxProjection({
          runtimeSnapshot: {},
          sensitiveActionFlowUx,
          visualReceipts,
          providerSelectionUx: {},
          providerPreference: {},
        });
        const approvalActionCardsUx = service.buildApprovalActionCardsUxProjection({
          runtimeSnapshot: {},
          sensitiveActionFlowUx,
          visualReceipts,
          activeMissionUx,
        });
        deps.writeJson(
          res,
          {
            ok: true,
            live: false,
            generatedAt: approvalActionCardsUx.generatedAt,
            approvalActionCardsUx,
            safety: approvalActionCardsUx.zavorthControlProjection,
          },
          200,
        );
        return true;
      }

      if (pathname === '/api/active-mission' && req.method === 'GET') {
        const sensitiveActionFlowUx = service.buildSensitiveActionFlowUxProjection(url);
        const visualReceipts = service.buildVisualReceiptsProjection(url);
        const providerSelectionUx = await service.buildProviderSelectionProjection(url);
        const providerPreference = await service.buildProviderPreferenceProjection();
        const activeMissionUx = service.buildActiveMissionUxProjection({
          runtimeSnapshot: {},
          sensitiveActionFlowUx,
          visualReceipts,
          providerSelectionUx,
          providerPreference,
        });
        deps.writeJson(
          res,
          {
            ok: true,
            live: false,
            generatedAt: activeMissionUx.generatedAt,
            activeMissionUx,
            safety: activeMissionUx.safety,
          },
          200,
        );
        return true;
      }

      if (pathname === '/api/sensitive-action-flow' && req.method === 'GET') {
        const sensitiveActionFlowUx = service.buildSensitiveActionFlowUxProjection(url);
        deps.writeJson(
          res,
          {
            ok: true,
            live: false,
            generatedAt: sensitiveActionFlowUx.generatedAt,
            sensitiveActionFlowUx,
            safety: asRecord(asRecord(sensitiveActionFlowUx.card)?.safety) || {
              zavorthControlCanExecute: false,
              rawSecretsSerialized: false,
            },
          },
          200,
        );
        return true;
      }

      if (pathname === '/api/runtime/readiness' && req.method === 'GET') {
        const userId = String(url.searchParams.get('userId') || 'zavorthControl-operator');
        const sessionId = String(url.searchParams.get('sessionId') || 'zavorthControl-runtime-readiness');
        const readiness = await new ZavorthRuntimeReadinessService().buildSnapshot({
          userId,
          sessionId,
          workspaceHint: config.projectRoot,
        });
        const runtimeReadinessUx = new ZavorthRuntimeReadinessUxService().buildSnapshot(readiness);
        deps.writeJson(
          res,
          {
            ok: true,
            live: false,
            generatedAt: runtimeReadinessUx.generatedAt,
            runtimeReadinessUx,
            readiness: url.searchParams.get('detail') === 'technical' ? readiness : undefined,
            safety: runtimeReadinessUx.safety,
          },
          200,
        );
        return true;
      }

      if (pathname === '/api/runtime/readiness/fixes' && req.method === 'GET') {
        const userId = String(url.searchParams.get('userId') || 'zavorthControl-operator');
        const sessionId = String(url.searchParams.get('sessionId') || 'zavorthControl-runtime-guided-fixes');
        const readiness = await new ZavorthRuntimeReadinessService().buildSnapshot({
          userId,
          sessionId,
          workspaceHint: config.projectRoot,
        });
        const runtimeGuidedFixes = new ZavorthRuntimeGuidedFixesService().buildSnapshot(readiness);
        deps.writeJson(
          res,
          {
            ok: true,
            live: false,
            generatedAt: runtimeGuidedFixes.generatedAt,
            runtimeGuidedFixes,
            safety: runtimeGuidedFixes.safety,
          },
          200,
        );
        return true;
      }

      if (pathname === '/api/runtime/ready-to-go' && req.method === 'GET') {
        const refreshProviders = url.searchParams.get('refreshProviders') === 'true';
        const readyToGo = await new ZavorthReadyToGoService().buildSnapshot({
          refreshProviders,
          includeAdvancedProviders: url.searchParams.get('advanced') === 'true',
          userId: String(url.searchParams.get('userId') || 'zavorthControl-operator'),
          sessionId: String(url.searchParams.get('sessionId') || 'zavorthControl-ready-to-go'),
          workspaceHint: config.projectRoot,
        });
        deps.writeJson(
          res,
          {
            ok: true,
            live: refreshProviders,
            generatedAt: readyToGo.generatedAt,
            readyToGo,
            safety: readyToGo.safety,
          },
          200,
        );
        return true;
      }

      if (pathname === '/api/runtime/stay-online' && req.method === 'GET') {
        const refreshProviders = url.searchParams.get('refreshProviders') === 'true';
        const stayOnline = await new ZavorthStayOnlineService().buildSnapshot({
          refreshProviders,
          writeSnapshot: url.searchParams.get('write') === 'true',
          intervalMs: Number(url.searchParams.get('intervalMs') || 0) || undefined,
          userId: String(url.searchParams.get('userId') || 'zavorthControl-operator'),
          sessionId: String(url.searchParams.get('sessionId') || 'zavorthControl-stay-online'),
          workspaceHint: config.projectRoot,
        });
        deps.writeJson(
          res,
          {
            ok: true,
            live: refreshProviders,
            generatedAt: stayOnline.generatedAt,
            stayOnline,
            safety: stayOnline.safety,
          },
          200,
        );
        return true;
      }

      if (pathname === '/api/runtime/external-agent-onboarding' && req.method === 'GET') {
        const onboarding = new ZavorthExternalAgentOnboardingService().buildSnapshot({
          consent: url.searchParams.get('consent') === 'true',
          pathHint: url.searchParams.get('path'),
          approximatePathHint: url.searchParams.get('approxPath') || url.searchParams.get('approximatePath'),
          commandHint: url.searchParams.get('command') || url.searchParams.get('cli'),
          endpointHint: url.searchParams.get('endpoint') || url.searchParams.get('url'),
          requestedBy: url.searchParams.get('requestedBy') || 'zavorthControl-operator',
          maxDepth: Number(url.searchParams.get('maxDepth') || 0) || null,
          writeSnapshot: url.searchParams.get('write') === 'true',
        });
        deps.writeJson(
          res,
          {
            ok: true,
            live: false,
            generatedAt: onboarding.generatedAt,
            onboarding,
            safety: onboarding.safety,
          },
          200,
        );
        return true;
      }

      if (pathname === '/api/runtime/external-agent-onboarding' && req.method === 'POST') {
        const body = await deps.readJsonBody(req);
        const onboarding = new ZavorthExternalAgentOnboardingService().buildSnapshot({
          consent: body?.consent === true || body?.readOnlyConsent === true,
          pathHint: String(body?.path || body?.pathHint || '').trim() || null,
          approximatePathHint: String(body?.approxPath || body?.approximatePath || body?.approximatePathHint || '').trim() || null,
          commandHint: String(body?.command || body?.cli || body?.commandHint || '').trim() || null,
          endpointHint: String(body?.endpoint || body?.url || body?.endpointHint || '').trim() || null,
          requestedBy: String(body?.requestedBy || 'zavorthControl-operator').trim(),
          maxDepth: Number(body?.maxDepth || 0) || null,
          writeSnapshot: body?.write === true,
        });
        deps.writeJson(
          res,
          {
            ok: true,
            live: false,
            generatedAt: onboarding.generatedAt,
            onboarding,
            safety: onboarding.safety,
          },
          200,
        );
        return true;
      }

      if (pathname === '/api/runtime/external-agents' && req.method === 'GET') {
        const gateway = new ZavorthExternalAgentGatewayService();
        const registry = gateway.buildRegistrySnapshot();
        deps.writeJson(
          res,
          {
            ok: true,
            live: false,
            generatedAt: registry.generatedAt,
            registry,
            safety: registry.safety,
          },
          200,
        );
        return true;
      }

      if (pathname === '/api/runtime/external-agents' && req.method === 'POST') {
        const body = await deps.readJsonBody(req);
        const gateway = new ZavorthExternalAgentGatewayService();
        const action = String(body?.action || body?.kind || '').trim().toLowerCase();
        const approvalRequested = isExternalAgentApiApprovalRequested(body);
        const apiApprovalAccepted = isExternalAgentApiApprovalAccepted(req, body);
        const apiApprovalSafety = {
          apiApprovalAccepted,
          bodyApprovalIgnored: approvalRequested && !apiApprovalAccepted,
          approvalRequiresHeaderToken: true,
        };
        if (action === 'register') {
          const receipt = gateway.registerProfile({
            id: String(body?.id || '').trim() || null,
            label: String(body?.label || '').trim() || null,
            adapter: normalizeExternalAgentAdapter(body?.adapter),
            root: String(body?.root || body?.cwd || '').trim() || null,
            command: String(body?.command || body?.cmd || '').trim() || null,
            args: Array.isArray(body?.args) ? body.args.map((entry: unknown) => String(entry)) : [],
            endpoint: String(body?.endpoint || body?.url || '').trim() || null,
            promptMode: normalizeExternalAgentPromptMode(body?.promptMode),
            enableLive: body?.enableLive === true && apiApprovalAccepted,
            allowRemoteNetwork: body?.allowRemoteNetwork === true && apiApprovalAccepted,
            isolation: normalizeExternalAgentIsolation(body?.isolation || body?.sandbox),
            dockerImage: String(body?.dockerImage || body?.sandboxImage || '').trim() || null,
            wslDistro: String(body?.wslDistro || '').trim() || null,
            workspaceMount: String(body?.workspaceMount || body?.mount || '').trim() || null,
            sandboxWorkdir: String(body?.sandboxWorkdir || body?.containerWorkdir || '').trim() || null,
            network: normalizeExternalAgentNetwork(body?.network),
            readOnlyRoot: body?.readOnlyRoot === true,
            requireStrongIsolation: body?.requireStrongIsolation === true,
            approvalGranted: apiApprovalAccepted,
            requestedBy: String(body?.requestedBy || 'zavorthControl-operator').trim(),
            source: 'api',
          });
          deps.writeJson(
            res,
            {
              ok: true,
              live: receipt.execution.liveExecutionPerformed,
              receipt,
              safety: { ...receipt.safety, ...apiApprovalSafety },
            },
            200,
          );
          return true;
        }
        if (action === 'run' || action === 'invoke') {
          const receipt = await gateway.invoke({
            profileId: String(body?.id || body?.profileId || '').trim(),
            prompt: String(body?.prompt || body?.message || '').trim(),
            approvalGranted: apiApprovalAccepted,
            dryRun: body?.dryRun === true || !apiApprovalAccepted,
            timeoutMs: Number(body?.timeoutMs || 0) || null,
            requestedBy: String(body?.requestedBy || 'zavorthControl-operator').trim(),
          });
          deps.writeJson(
            res,
            {
              ok: true,
              live: receipt.execution.liveExecutionPerformed,
              receipt,
              safety: { ...receipt.safety, ...apiApprovalSafety },
            },
            200,
          );
          return true;
        }
        deps.writeJson(res, { ok: false, error: 'unknown_external_agent_gateway_action' }, 400);
        return true;
      }

      if (pathname === '/api/runtime/capability-mesh' && req.method === 'GET') {
        const mesh = new ZavorthCapabilityMeshService();
        const snapshot = mesh.buildSnapshot({
          requestText: url.searchParams.get('request') || url.searchParams.get('intent') || '',
          requestedBy: url.searchParams.get('requestedBy') || 'zavorthControl-operator',
          channel: 'zavorthControl',
          preferExternal: url.searchParams.get('preferExternal') === 'true',
          allowExternalAgents: url.searchParams.get('allowExternalAgents') !== 'false',
          allowSkillCreation: url.searchParams.get('allowSkillCreation') !== 'false',
          allowExternalAdaptation: url.searchParams.get('allowExternalAdaptation') !== 'false',
          maxCandidates: Number(url.searchParams.get('maxCandidates') || 0) || null,
        });
        deps.writeJson(res, { ok: true, live: false, generatedAt: snapshot.generatedAt, capabilityMesh: snapshot, safety: snapshot.safety }, 200);
        return true;
      }

      if (pathname === '/api/runtime/capability-mesh' && req.method === 'POST') {
        const body = await deps.readJsonBody(req);
        const mesh = new ZavorthCapabilityMeshService();
        const snapshot = mesh.buildSnapshot({
          requestText: String(body?.request || body?.intent || body?.prompt || '').trim(),
          requestedBy: String(body?.requestedBy || 'zavorthControl-operator').trim(),
          channel: String(body?.channel || 'zavorthControl').trim(),
          preferExternal: body?.preferExternal === true,
          allowExternalAgents: body?.allowExternalAgents !== false,
          allowSkillCreation: body?.allowSkillCreation !== false,
          allowExternalAdaptation: body?.allowExternalAdaptation !== false,
          maxCandidates: Number(body?.maxCandidates || 0) || null,
        });
        deps.writeJson(res, { ok: true, live: false, generatedAt: snapshot.generatedAt, capabilityMesh: snapshot, safety: snapshot.safety }, 200);
        return true;
      }

      if (pathname === '/api/providers/readiness' && req.method === 'GET') {
        if (service.isProviderLiveProbeRequested(url)) {
          deps.writeJson(
            res,
            {
              ok: false,
              error: 'provider_live_probe_requires_explicit_operator_cli_or_approved_api',
              detail: 'ZavorthControl exposes readiness/projection only. Live provider probes do not run on a normal Control render.',
            },
            403,
          );
          return true;
        }
        const providerCockpit = await service.buildProviderCockpitProjection(url);
        deps.writeJson(
          res,
          {
            ok: true,
            live: false,
            generatedAt: providerCockpit.generatedAt,
            providerCockpit,
            safety: providerCockpit.safety,
          },
          200,
        );
        return true;
      }

      if (pathname === '/api/providers/model-catalog' && req.method === 'GET') {
        if (service.isProviderLiveProbeRequested(url)) {
          deps.writeJson(
            res,
            {
              ok: false,
              error: 'provider_model_catalog_live_probe_requires_explicit_operator_cli_or_approved_api',
              detail: 'zavorthControl renders the provider/model catalog without hidden live calls. Live proof must be triggered explicitly by the operator.',
            },
            403,
          );
          return true;
        }
        const providerModelCatalog = await service.buildProviderModelCatalogProjection(url);
        deps.writeJson(
          res,
          {
            ok: true,
            live: false,
            generatedAt: providerModelCatalog.generatedAt,
            providerModelCatalog,
            safety: providerModelCatalog.safety,
          },
          200,
        );
        return true;
      }

      if (pathname === '/api/providers/activation' && req.method === 'GET') {
        if (service.isProviderLiveProbeRequested(url)) {
          deps.writeJson(
            res,
            {
              ok: false,
              error: 'provider_activation_live_probe_requires_explicit_operator_cli_or_approved_api',
              detail: 'zavorthControl renders provider activation without hidden live calls. Live proof must be explicitly triggered by the operator.',
            },
            403,
          );
          return true;
        }
        const providerActivation = await service.buildProviderActivationProjection(url);
        deps.writeJson(
          res,
          {
            ok: true,
            live: false,
            generatedAt: providerActivation.generatedAt,
            providerActivation,
            safety: providerActivation.safety,
          },
          200,
        );
        return true;
      }

  return false;
}
