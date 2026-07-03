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

export async function handleMemoryLearningOpsRoutes(
  service: WebAppRuntimeStateRouteService,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  pathname: string,
  deps: WebAppRuntimeRouteDeps,
  helpers: WebAppRuntimeStateRouteHelpers,
): Promise<boolean> {
      if (pathname === '/api/web/learning' && req.method === 'GET') {
        const sessionId = deps.resolveSessionId(url);
        const snapshot = await deps.buildLearningPlaneSnapshot(sessionId);
        deps.writeJson(
          res,
          {
            ok: true,
            snapshot: snapshot || {
              generatedAt: new Date().toISOString(),
              summary: {
                total: 0,
                pending: 0,
                approved: 0,
                rejected: 0,
                promoted: 0,
                published: 0,
                quarantined: 0,
                highConfidence: 0,
              },
              candidates: [],
              narrative: {
                headline: 'Learning plane indisponivel.',
                operatorSummary: 'O runtime atual nao carregou o learning plane.',
              },
            },
          },
          200,
        );
        return true;
      }
  
      if (pathname === '/api/web/learning/actions' && req.method === 'POST') {
        const body = await deps.readJsonBody(req);
        const candidateId = String(body?.candidateId || '').trim();
        const actionId = String(body?.actionId || '').trim().toLowerCase();
        if (!candidateId) {
          deps.writeJson(res, { ok: false, error: 'candidateId obrigatorio.' }, 400);
          return true;
        }
        if (!['approve', 'reject', 'promote'].includes(actionId)) {
          deps.writeJson(res, { ok: false, error: 'actionId invalido para learning plane.' }, 400);
          return true;
        }
        const execution = await deps.executeLearningAction({
          candidateId,
          actionId: actionId as 'approve' | 'reject' | 'promote',
        });
        deps.writeJson(res, { ok: true, execution }, 200);
        return true;
      }
  
      if (pathname === '/api/web/learning/metrics' && req.method === 'GET') {
        const sessionId = deps.resolveSessionId(url);
        const metrics = await deps.buildLearningPlaneMetrics(sessionId);
        deps.writeJson(
          res,
          {
            ok: true,
            metrics: metrics || {
              generatedAt: new Date().toISOString(),
              summary: {
                totalCandidates: 0,
                acceptedRate: 0,
                rejectedRate: 0,
                promotedRate: 0,
                averageScore: 0,
              },
              counts: {
                pending: 0,
                approved: 0,
                rejected: 0,
                promoted: 0,
                published: 0,
                quarantined: 0,
                highConfidence: 0,
              },
            },
          },
          200,
        );
        return true;
      }
  
      if (pathname === '/api/web/memory/procedures' && req.method === 'GET') {
        const sessionId = deps.resolveSessionId(url);
        const procedures = await deps.readLayeredMemoryProcedures(sessionId);
        deps.writeJson(
          res,
          {
            ok: true,
            procedures: procedures || {
              generatedAt: new Date().toISOString(),
              total: 0,
              data: [],
            },
          },
          200,
        );
        return true;
      }
  
      if (pathname === '/api/web/memory/metrics' && req.method === 'GET') {
        const sessionId = deps.resolveSessionId(url);
        const metrics = await deps.readLayeredMemoryMetrics(sessionId);
        deps.writeJson(
          res,
          {
            ok: true,
            metrics: metrics || {
              generatedAt: new Date().toISOString(),
              summary: {
                totalEntries: 0,
                episodic: 0,
                semantic: 0,
                procedural: 0,
                averageBudgetUsage: 0,
                pressure: 'ok',
              },
              budgets: {
                perLayer: 0,
                episodicUsage: 0,
                semanticUsage: 0,
                proceduralUsage: 0,
              },
              procedures: {
                total: 0,
                trustedLocal: 0,
                learnedDraft: 0,
                implicit: 0,
              },
            },
          },
          200,
        );
        return true;
      }
  
      if (pathname === '/api/web/ops/quality' && req.method === 'GET') {
        const sessionId = deps.resolveSessionId(url);
        const quality = await deps.buildOpsQuality(sessionId);
        deps.writeJson(
          res,
          {
            ok: true,
            quality: quality || {
              generatedAt: new Date().toISOString(),
              score: 0,
              healthy: false,
              summary: {
                recoveryState: 'degraded',
                learningPending: 0,
                quarantinedItems: 0,
                memoryPressure: 'ok',
              },
              operations: {
                uptime: 0,
                components: {
                  database: 'error',
                  eventBus: 'error',
                },
              },
              learning: {
                totalCandidates: 0,
                acceptedRate: 0,
                rejectedRate: 0,
                promotedRate: 0,
                averageScore: 0,
                pending: 0,
                quarantined: 0,
              },
              memory: {
                totalEntries: 0,
                episodic: 0,
                semantic: 0,
                procedural: 0,
                averageBudgetUsage: 0,
                pressure: 'ok',
              },
              platform: {
                total: 0,
                trusted: 0,
                reviewPending: 0,
                quarantined: 0,
                learnedLocal: 0,
              },
            },
          },
          200,
        );
        return true;
      }
  
      if (pathname === '/api/web/memory/search' && req.method === 'GET') {
        const sessionId = deps.resolveSessionId(url);
        const query = String(url.searchParams.get('q') || '').trim();
        const limitValue = Number(url.searchParams.get('limit'));
        const search = await deps.searchLayeredMemory({
          sessionId,
          query,
          limit: Number.isFinite(limitValue) ? limitValue : undefined,
        });
        deps.writeJson(
          res,
          {
            ok: true,
            search: search || {
              generatedAt: new Date().toISOString(),
              query,
              total: 0,
              data: [],
            },
          },
          200,
        );
        return true;
      }
  
      if (pathname === '/api/web/memory/recall' && req.method === 'GET') {
        const sessionId = deps.resolveSessionId(url);
        const query = String(url.searchParams.get('q') || url.searchParams.get('query') || '').trim();
        const limitValue = Number(url.searchParams.get('limit'));
        const recall = await helpers.previewGatewayMemoryRecall({
          sessionId,
          query,
          limit: Number.isFinite(limitValue) ? limitValue : undefined,
        });
        deps.writeJson(res, recall, 200);
        return true;
      }
  
      if (pathname === '/api/web/memory/sources' && req.method === 'GET') {
        const sessionId = deps.resolveSessionId(url);
        const sources = await helpers.listGatewayMemorySources({ sessionId });
        deps.writeJson(res, sources, 200);
        return true;
      }
  
      if (pathname === '/api/web/session/continuity' && req.method === 'GET') {
        const sessionId = deps.resolveSessionId(url);
        const snapshot = await deps.realtime.getResolvedSnapshot(sessionId);
        deps.writeJson(res, { ok: true, continuity: snapshot.continuity }, 200);
        return true;
      }
  
      if (pathname === '/api/web/session/replay' && req.method === 'GET') {
        const sessionId = deps.resolveSessionId(url);
        const snapshot = await deps.realtime.getResolvedSnapshot(sessionId);
        deps.writeJson(res, { ok: true, replay: snapshot.replay }, 200);
        return true;
      }
  
      if (pathname === '/api/web/session/handoff' && req.method === 'GET') {
        const sessionId = deps.resolveSessionId(url);
        const snapshot = await deps.realtime.getResolvedSnapshot(sessionId);
        deps.writeJson(res, { ok: true, handoff: snapshot.handoff }, 200);
        return true;
      }
  
      if (helpers.isCanonicalSessionPlaneRoute(pathname) && req.method === 'GET') {
        const sessionTools = deps.runtimeSessionTools || deps.sessionTools;
        if (!sessionTools) {
          deps.writeJson(res, { ok: false, error: 'Session tools indisponiveis.' }, 503);
          return true;
        }
        const sessionId = deps.resolveSessionId(url);
        const canonicalState = await helpers.buildCanonicalStatePayload(sessionId, {
          includeSessionsList: true,
          historyMode: 'fast',
          sessionPlaneMode: 'full',
          snapshotMode: 'cached',
          agentRunQuery: service.buildAgentRunQuery(url),
          includeMemoryRecall: false,
          includeGateway: false,
          includeCapabilityPlane: false,
          includeArtifactPlane: false,
          includeSelfmodPlane: false,
          includeResourcePlane: false,
          includeCompanionPlane: false,
          includeModeEscalation: false,
        });
        deps.writeJson(
          res,
          service.buildCanonicalStateResponse(canonicalState, {
            gateway: service.buildSessionToolsGatewaySnapshot(canonicalState),
            sessionTools: sessionTools.buildSnapshot({
              sessionId,
              chatId: deps.realtime.getChatId(sessionId),
              userId: deps.runtime.webUserId,
            }),
          }),
          200,
        );
        return true;
      }
  
      if (pathname === GATEWAY_SESSION_ROUTE_PATHS.history && req.method === 'GET') {
        const sessionId = deps.resolveSessionId(url);
        const canonicalState = await helpers.buildCanonicalStatePayload(sessionId, {
          includeSessionsList: true,
          historyMode: 'full',
          sessionPlaneMode: 'full',
          snapshotMode: 'cached',
          agentRunQuery: service.buildAgentRunQuery(url),
          includeMemoryRecall: false,
          includeGateway: false,
          includeCapabilityPlane: false,
          includeArtifactPlane: false,
          includeSelfmodPlane: false,
          includeResourcePlane: false,
          includeCompanionPlane: false,
          includeModeEscalation: false,
        });
        deps.writeJson(res, service.buildCanonicalStateResponse(canonicalState), 200);
        return true;
      }
  return false;
}
