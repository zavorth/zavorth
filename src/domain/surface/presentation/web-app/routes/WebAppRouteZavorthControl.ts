import * as http from 'http';
import fs from 'fs';
import path from 'path';
import { timingSafeEqual } from 'node:crypto';
import { GATEWAY_SESSION_ROUTE_PATHS } from '../../../../../contracts/GatewayContract.js';
import type {
  HybridMemoryRecallInput,
  HybridMemoryRecallResult,
  HybridMemorySourcesResult,
} from '../../../../../contracts/HybridMemoryContract.js';
import { config } from '../../../../../config/index.js';

import type { WebAppRuntimeRouteDeps } from '../WebAppRuntimeRouteService.js';
import { defaultLlmRuntimeTelemetryService } from '../../../../../services/llm/LlmRuntimeTelemetryService.js';
import { ZavorthActiveMissionUxService } from '../../../../../services/ZavorthActiveMissionUxService.js';
import { ZavorthApprovalActionCardsUxService } from '../../../../../services/ZavorthApprovalActionCardsUxService.js';
import { ZavorthControlProviderCockpitService } from '../../../../../services/ZavorthControlProviderCockpitService.js';
import { ZavorthProviderActivationService } from '../../../../../services/ZavorthProviderActivationService.js';
import { ZavorthProviderModelCatalogService } from '../../../../../services/ZavorthProviderModelCatalogService.js';
import { ZavorthProviderPreferencePersistenceService } from '../../../../../services/ZavorthProviderPreferencePersistenceService.js';
import { ZavorthProviderSelectionUxService } from '../../../../../services/ZavorthProviderSelectionUxService.js';
import { ZavorthSensitiveActionFlowUxService } from '../../../../../services/ZavorthSensitiveActionFlowUxService.js';
import { ZavorthRuntimeReadinessService } from '../../../../../services/ZavorthRuntimeReadinessService.js';
import { ZavorthRuntimeGuidedFixesService } from '../../../../../services/ZavorthRuntimeGuidedFixesService.js';
import { ZavorthRuntimeReadinessUxService } from '../../../../../services/ZavorthRuntimeReadinessUxService.js';
import { ZavorthReadyToGoService } from '../../../../../services/ZavorthReadyToGoService.js';
import { ZavorthStayOnlineService } from '../../../../../services/ZavorthStayOnlineService.js';
import { ZavorthExternalAgentOnboardingService } from '../../../../../services/ZavorthExternalAgentOnboardingService.js';
import { ZavorthExternalAgentGatewayService } from '../../../../../services/ZavorthExternalAgentGatewayService.js';
import { ZavorthCapabilityMeshService } from '../../../../../services/ZavorthCapabilityMeshService.js';
import { ZavorthVisualReceiptUxService } from '../../../../../services/ZavorthVisualReceiptUxService.js';
import { ZavorthControlContractAdapterService } from '../../../../../services/ZavorthControlContractAdapterService.js';
import { ZavorthDailyUseGuiCertificationService } from '../../../../../services/ZavorthDailyUseGuiCertificationService.js';
import type { ZavorthSensitiveActionFlowDecision } from '../../../../../contracts/ZavorthSensitiveActionFlowContract.js';

import type { WebAppRuntimeStateRouteService, WebAppRuntimeStateRouteHelpers, RuntimeRecord } from '../WebAppRuntimeStateRouteService.js';
import { asRecord, text, isExternalAgentApiApprovalRequested, isExternalAgentApiApprovalAccepted, readHeaderValue, safeTokenEquals } from '../WebAppRuntimeStateRouteService.js';

export async function handleZavorthControlRoutes(
  service: WebAppRuntimeStateRouteService,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  pathname: string,
  deps: WebAppRuntimeRouteDeps,
  helpers: WebAppRuntimeStateRouteHelpers,
): Promise<boolean> {
      if (pathname === '/api/web/session' && req.method === 'GET') {
        const requestedSessionId = String(url.searchParams.get('sessionId') || '').trim();
        const sessionId = requestedSessionId || deps.realtime.createSession();
        deps.realtime.ensureSession(sessionId);
        await deps.realtime.captureBaseline(sessionId);
        deps.writeJson(
          res,
          {
            ok: true,
            sessionId,
            chatId: deps.realtime.getChatId(sessionId),
            continuity: (await deps.realtime.getResolvedSnapshot(sessionId)).continuity,
            auth: deps.auth.getStatus(),
          },
          200,
        );
        return true;
      }

      if (pathname === '/api/web/state' && req.method === 'GET') {
        await service.handleStateRequest(res, url, deps, helpers);
        return true;
      }

      if (pathname === '/api/web/zavorthControl' && req.method === 'GET') {
        const activeSessionId = String(url.searchParams.get('sessionId') || '').trim() || null;
        const agentRunQuery = service.buildAgentRunQuery(url);
        const generatedAt = new Date().toISOString();
        const contractAdapter = await service.buildZavorthControlContractAdapterProjection(url, deps);
        const snapshot = deps.agentGateway?.buildSnapshot(
          service.buildAgentRunSnapshotOptions(activeSessionId, agentRunQuery),
        ) || service.buildUnavailableAgentGatewaySnapshot(
          generatedAt,
          service.buildAgentRunSnapshotOptions(activeSessionId, agentRunQuery),
        );
        const providerCockpit = await service.buildProviderCockpitProjection(url);
        const providerSelectionUx = await service.buildProviderSelectionProjection(url);
        const providerPreference = await service.buildProviderPreferenceProjection();
        const visualReceipts = service.buildVisualReceiptsProjection(url);
        const sensitiveActionFlowUx = service.buildSensitiveActionFlowUxProjection(url);
        const baseSnapshot = service.attachSensitiveActionFlowUx(
          service.attachVisualReceipts(
            service.attachLlmRuntimeTelemetry(snapshot),
            visualReceipts,
          ),
          sensitiveActionFlowUx,
        );
        const activeMissionUx = service.buildActiveMissionUxProjection({
          runtimeSnapshot: baseSnapshot,
          sensitiveActionFlowUx,
          visualReceipts,
          providerSelectionUx,
          providerPreference,
        });
        const approvalActionCardsUx = service.buildApprovalActionCardsUxProjection({
          runtimeSnapshot: baseSnapshot,
          sensitiveActionFlowUx,
          visualReceipts,
          activeMissionUx,
        });
        const enrichedSnapshot = service.attachProviderCockpit(
          service.attachProviderPreference(
            service.attachProviderSelection(
              service.attachApprovalActionCardsUx(
                service.attachActiveMissionUx(baseSnapshot, activeMissionUx),
                approvalActionCardsUx,
              ),
              providerSelectionUx,
            ),
            providerPreference,
          ),
          providerCockpit,
        );
        const zavorthControlSnapshot = service.attachZavorthControlContractAdapter(enrichedSnapshot, contractAdapter);
        deps.writeJson(
          res,
          {
            ok: true,
            live: Boolean(deps.agentGateway),
            generatedAt: zavorthControlSnapshot.generatedAt,
            snapshot: zavorthControlSnapshot,
            contractAdapter,
            contractsV1: contractAdapter,
            modelProfile: service.buildCurrentModelProfile(zavorthControlSnapshot),
          },
          200,
        );
        return true;
      }

      if (pathname === '/api/web/zavorthControl/contracts-v1' && req.method === 'GET') {
        const contractAdapter = await service.buildZavorthControlContractAdapterProjection(url, deps);
        if (!contractAdapter) {
          deps.writeJson(res, {
            ok: false,
            error: 'canonical_public_api_unavailable',
            detail: 'ZavorthControl contract adapter requires the runtime API v1 service.',
          }, 503);
          return true;
        }
        deps.writeJson(res, {
          ok: true,
          generatedAt: contractAdapter.generatedAt,
          contractAdapter,
          contractsV1: contractAdapter,
        }, 200);
        return true;
      }

      if ((pathname === '/api/web/zavorthControl/events-v1' || pathname === '/api/web/zavorthControl/events-v1') && req.method === 'GET') {
        if (!deps.publicApi) {
          deps.writeJson(res, {
            ok: false,
            error: 'canonical_public_api_unavailable',
            detail: 'ZavorthControl event wiring requires the runtime API v1 service.',
          }, 503);
          return true;
        }
        const sessionId = String(url.searchParams.get('sessionId') || '').trim() || 'control';
        deps.writeJson(res, {
          ok: true,
          generatedAt: new Date().toISOString(),
          eventsV1: await deps.publicApi.readRuntimeEvents({ sessionId }),
          safety: {
            projectionOnly: true,
            zavorthControlCanExecute: false,
            zavorthControlCanExecute: false,
            policyBrokerRequiredForMutableActions: true,
            rawSecretsSerialized: false,
          },
        }, 200);
        return true;
      }

      if ((pathname === '/api/web/zavorthControl/gui-certification-v1' || pathname === '/api/web/zavorthControl/gui-certification-v1') && req.method === 'GET') {
        if (!deps.publicApi) {
          deps.writeJson(res, {
            ok: false,
            error: 'canonical_public_api_unavailable',
            detail: 'Daily-use GUI certification requires the runtime API v1 service.',
          }, 503);
          return true;
        }
        const sessionId = String(url.searchParams.get('sessionId') || '').trim() || 'control';
        const request = String(url.searchParams.get('q') || url.searchParams.get('request') || '').trim();
        deps.writeJson(res, {
          ok: true,
          generatedAt: new Date().toISOString(),
          certification: await new ZavorthDailyUseGuiCertificationService().certify({
            publicApi: deps.publicApi,
            sessionId,
            request,
          }),
          safety: {
            projectionOnly: true,
            zavorthControlCanExecute: false,
            zavorthControlCanExecute: false,
            desktopCanBypassRuntime: false,
            policyBrokerRequiredForMutableActions: true,
            rawSecretsSerialized: false,
          },
        }, 200);
        return true;
      }

      if ((pathname === '/api/web/zavorthControl/actions' || pathname === '/api/web/zavorthControl/actions') && req.method === 'POST') {
        await service.handleZavorthControlActionRequest(req, res, deps);
        return true;
      }

      if ((pathname === '/api/web/zavorthControl/chat-v1' || pathname === '/api/web/zavorthControl/chat-v1') && req.method === 'POST') {
        await service.handleZavorthControlChatRequest(req, res, deps);
        return true;
      }

      if (pathname === '/api/web/chat/side' && req.method === 'POST') {
        await service.handleZavorthControlSideChatRequest(req, res, deps);
        return true;
      }

      if (pathname === '/api/web/chat/steer' && req.method === 'POST') {
        await service.handleZavorthControlSteerChatRequest(req, res, deps);
        return true;
      }

      if (
        (pathname === '/api/web/zavorthControl/memory' || pathname === '/api/web/zavorthControl/memory')
        && req.method === 'GET'
      ) {
        deps.writeJson(res, service.readZavorthControlMemoryFacts(url), 200);
        return true;
      }

      if (
        (pathname === '/api/web/zavorthControl/memory' || pathname === '/api/web/zavorthControl/memory')
        && req.method === 'POST'
      ) {
        const body = await deps.readJsonBody(req);
        deps.writeJson(res, service.applyZavorthControlMemoryAction(url, body), 200);
        return true;
      }

  return false;
}
