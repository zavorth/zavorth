import * as http from 'http';
import { timingSafeEqual } from 'node:crypto';
import { GATEWAY_SESSION_ROUTE_PATHS } from '../../../../contracts/GatewayContract.js';
import type {
  HybridMemoryRecallInput,
  HybridMemoryRecallResult,
  HybridMemorySourcesResult,
} from '../../../../contracts/HybridMemoryContract.js';
import { config } from '../../../../config/index.js';
import type { WebAppRuntimeRouteDeps } from './WebAppRuntimeRouteService.js';
import { defaultLlmRuntimeTelemetryService } from '../../../../services/llm/LlmRuntimeTelemetryService.js';
import { ZavorthActiveMissionUxService } from '../../../../services/ZavorthActiveMissionUxService.js';
import { ZavorthApprovalActionCardsUxService } from '../../../../services/ZavorthApprovalActionCardsUxService.js';
import { ZavorthCommandCenterProviderCockpitService } from '../../../../services/ZavorthCommandCenterProviderCockpitService.js';
import { ZavorthProviderActivationService } from '../../../../services/ZavorthProviderActivationService.js';
import { ZavorthProviderModelCatalogService } from '../../../../services/ZavorthProviderModelCatalogService.js';
import { ZavorthProviderPreferencePersistenceService } from '../../../../services/ZavorthProviderPreferencePersistenceService.js';
import { ZavorthProviderSelectionUxService } from '../../../../services/ZavorthProviderSelectionUxService.js';
import { ZavorthSensitiveActionFlowUxService } from '../../../../services/ZavorthSensitiveActionFlowUxService.js';
import { ZavorthRuntimeReadinessService } from '../../../../services/ZavorthRuntimeReadinessService.js';
import { ZavorthRuntimeGuidedFixesService } from '../../../../services/ZavorthRuntimeGuidedFixesService.js';
import { ZavorthRuntimeReadinessUxService } from '../../../../services/ZavorthRuntimeReadinessUxService.js';
import { ZavorthReadyToGoService } from '../../../../services/ZavorthReadyToGoService.js';
import { ZavorthStayOnlineService } from '../../../../services/ZavorthStayOnlineService.js';
import { ZavorthExternalAgentOnboardingService } from '../../../../services/ZavorthExternalAgentOnboardingService.js';
import { ZavorthExternalAgentGatewayService } from '../../../../services/ZavorthExternalAgentGatewayService.js';
import { ZavorthCapabilityMeshService } from '../../../../services/ZavorthCapabilityMeshService.js';
import { ZavorthVisualReceiptUxService } from '../../../../services/ZavorthVisualReceiptUxService.js';
import { CommandCenterContractAdapterService } from '../../../../services/CommandCenterContractAdapterService.js';
import { ZavorthDailyUseGuiCertificationService } from '../../../../services/ZavorthDailyUseGuiCertificationService.js';
import type { ZavorthSensitiveActionFlowDecision } from '../../../../contracts/ZavorthSensitiveActionFlowContract.js';

type RuntimeRecord = Record<string, unknown>;
type WebSessionContext = RuntimeRecord & {
  userId: string;
  sessionId: string;
  chatId?: string | null;
};

type UiSurfaceHintsInput = {
  localControlEntry: string;
  localControlReady: boolean;
  telegramReady: boolean;
  discordReady: boolean;
  classicReady: boolean;
  cliReady: boolean;
};

const AGENT_RUN_STATUS_VALUES = new Set([
  'idle',
  'queued',
  'thinking',
  'running',
  'waiting_approval',
  'completed',
  'failed',
  'cancelled',
]);

export type WebAppRuntimeStateRouteHelpers = {
  buildSessionContext: (sessionId: string) => WebSessionContext;
  isFullDetailRequested: (url: URL) => boolean;
  previewGatewayMemoryRecall: (input: HybridMemoryRecallInput) => Promise<HybridMemoryRecallResult>;
  listGatewayMemorySources: (
    input: Pick<HybridMemoryRecallInput, 'sessionId' | 'chatId' | 'userId' | 'platform' | 'workspaceHint'>,
  ) => Promise<HybridMemorySourcesResult>;
  buildRecallQueryFromSnapshot: (snapshot: RuntimeRecord | null | undefined) => string;
  buildLightweightStateResponse: (state: RuntimeRecord) => RuntimeRecord;
  buildProductMode: () => RuntimeRecord | null;
  buildUiSurfaceHints: (
    productMode: RuntimeRecord | null,
    input: UiSurfaceHintsInput,
  ) => RuntimeRecord | null;
  buildCanonicalStatePayload: (sessionId: string, options: RuntimeRecord) => Promise<RuntimeRecord>;
  isCanonicalSessionPlaneRoute: (pathname: string) => boolean;
};

export class WebAppRuntimeStateRouteService {
  public async handleRequest(
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
      await this.handleStateRequest(res, url, deps, helpers);
      return true;
    }

    if (pathname === '/api/web/command-center' && req.method === 'GET') {
      const activeSessionId = String(url.searchParams.get('sessionId') || '').trim() || null;
      const agentRunQuery = this.buildAgentRunQuery(url);
      const generatedAt = new Date().toISOString();
      const contractAdapter = await this.buildCommandCenterContractAdapterProjection(url, deps);
      const snapshot = deps.agentGateway?.buildSnapshot(
        this.buildAgentRunSnapshotOptions(activeSessionId, agentRunQuery),
      ) || this.buildUnavailableAgentGatewaySnapshot(
        generatedAt,
        this.buildAgentRunSnapshotOptions(activeSessionId, agentRunQuery),
      );
      const providerCockpit = await this.buildProviderCockpitProjection(url);
      const providerSelectionUx = await this.buildProviderSelectionProjection(url);
      const providerPreference = await this.buildProviderPreferenceProjection();
      const visualReceipts = this.buildVisualReceiptsProjection(url);
      const sensitiveActionFlowUx = this.buildSensitiveActionFlowUxProjection(url);
      const baseSnapshot = this.attachSensitiveActionFlowUx(
        this.attachVisualReceipts(
          this.attachLlmRuntimeTelemetry(snapshot),
          visualReceipts,
        ),
        sensitiveActionFlowUx,
      );
      const activeMissionUx = this.buildActiveMissionUxProjection({
        runtimeSnapshot: baseSnapshot,
        sensitiveActionFlowUx,
        visualReceipts,
        providerSelectionUx,
        providerPreference,
      });
      const approvalActionCardsUx = this.buildApprovalActionCardsUxProjection({
        runtimeSnapshot: baseSnapshot,
        sensitiveActionFlowUx,
        visualReceipts,
        activeMissionUx,
      });
      const enrichedSnapshot = this.attachProviderCockpit(
        this.attachProviderPreference(
          this.attachProviderSelection(
            this.attachApprovalActionCardsUx(
              this.attachActiveMissionUx(baseSnapshot, activeMissionUx),
              approvalActionCardsUx,
            ),
            providerSelectionUx,
          ),
          providerPreference,
        ),
        providerCockpit,
      );
      const commandCenterSnapshot = this.attachCommandCenterContractAdapter(enrichedSnapshot, contractAdapter);
      deps.writeJson(
        res,
        {
          ok: true,
          live: Boolean(deps.agentGateway),
          generatedAt: commandCenterSnapshot.generatedAt,
          snapshot: commandCenterSnapshot,
          contractAdapter,
          contractsV1: contractAdapter,
          modelProfile: this.buildCurrentModelProfile(commandCenterSnapshot),
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/command-center/contracts-v1' && req.method === 'GET') {
      const contractAdapter = await this.buildCommandCenterContractAdapterProjection(url, deps);
      if (!contractAdapter) {
        deps.writeJson(res, {
          ok: false,
          error: 'canonical_public_api_unavailable',
          detail: 'Command Center contract adapter requires the runtime API v1 service.',
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

    if (pathname === '/api/web/command-center/events-v1' && req.method === 'GET') {
      if (!deps.publicApi) {
        deps.writeJson(res, {
          ok: false,
          error: 'canonical_public_api_unavailable',
          detail: 'Command Center event wiring requires the runtime API v1 service.',
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
          commandCenterCanExecute: false,
          policyBrokerRequiredForMutableActions: true,
          rawSecretsSerialized: false,
        },
      }, 200);
      return true;
    }

    if (pathname === '/api/web/command-center/gui-certification-v1' && req.method === 'GET') {
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
          commandCenterCanExecute: false,
          desktopCanBypassRuntime: false,
          policyBrokerRequiredForMutableActions: true,
          rawSecretsSerialized: false,
        },
      }, 200);
      return true;
    }

    if (pathname === '/api/web/command-center/actions' && req.method === 'POST') {
      await this.handleCommandCenterActionRequest(req, res, deps);
      return true;
    }

    if (pathname === '/api/web/command-center/chat-v1' && req.method === 'POST') {
      await this.handleCommandCenterChatRequest(req, res, deps);
      return true;
    }

    if (pathname === '/api/approval-action-cards' && req.method === 'GET') {
      const sensitiveActionFlowUx = this.buildSensitiveActionFlowUxProjection(url);
      const visualReceipts = this.buildVisualReceiptsProjection(url);
      const activeMissionUx = this.buildActiveMissionUxProjection({
        runtimeSnapshot: {},
        sensitiveActionFlowUx,
        visualReceipts,
        providerSelectionUx: {},
        providerPreference: {},
      });
      const approvalActionCardsUx = this.buildApprovalActionCardsUxProjection({
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
          safety: approvalActionCardsUx.commandCenterProjection,
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/active-mission' && req.method === 'GET') {
      const sensitiveActionFlowUx = this.buildSensitiveActionFlowUxProjection(url);
      const visualReceipts = this.buildVisualReceiptsProjection(url);
      const providerSelectionUx = await this.buildProviderSelectionProjection(url);
      const providerPreference = await this.buildProviderPreferenceProjection();
      const activeMissionUx = this.buildActiveMissionUxProjection({
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
      const sensitiveActionFlowUx = this.buildSensitiveActionFlowUxProjection(url);
      deps.writeJson(
        res,
        {
          ok: true,
          live: false,
          generatedAt: sensitiveActionFlowUx.generatedAt,
          sensitiveActionFlowUx,
          safety: asRecord(asRecord(sensitiveActionFlowUx.card)?.safety) || {
            commandCenterCanExecute: false,
            rawSecretsSerialized: false,
          },
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/runtime/readiness' && req.method === 'GET') {
      const userId = String(url.searchParams.get('userId') || 'dashboard-operator');
      const sessionId = String(url.searchParams.get('sessionId') || 'dashboard-runtime-readiness');
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
      const userId = String(url.searchParams.get('userId') || 'dashboard-operator');
      const sessionId = String(url.searchParams.get('sessionId') || 'dashboard-runtime-guided-fixes');
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
        userId: String(url.searchParams.get('userId') || 'dashboard-operator'),
        sessionId: String(url.searchParams.get('sessionId') || 'dashboard-ready-to-go'),
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
        userId: String(url.searchParams.get('userId') || 'dashboard-operator'),
        sessionId: String(url.searchParams.get('sessionId') || 'dashboard-stay-online'),
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
        requestedBy: url.searchParams.get('requestedBy') || 'dashboard-operator',
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
        requestedBy: String(body?.requestedBy || 'dashboard-operator').trim(),
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
          adapter: body?.adapter,
          root: String(body?.root || body?.cwd || '').trim() || null,
          command: String(body?.command || body?.cmd || '').trim() || null,
          args: Array.isArray(body?.args) ? body.args.map((entry: unknown) => String(entry)) : [],
          endpoint: String(body?.endpoint || body?.url || '').trim() || null,
          promptMode: body?.promptMode,
          enableLive: body?.enableLive === true && apiApprovalAccepted,
          allowRemoteNetwork: body?.allowRemoteNetwork === true && apiApprovalAccepted,
          isolation: body?.isolation || body?.sandbox || null,
          dockerImage: String(body?.dockerImage || body?.sandboxImage || '').trim() || null,
          wslDistro: String(body?.wslDistro || '').trim() || null,
          workspaceMount: String(body?.workspaceMount || body?.mount || '').trim() || null,
          sandboxWorkdir: String(body?.sandboxWorkdir || body?.containerWorkdir || '').trim() || null,
          network: body?.network || null,
          readOnlyRoot: body?.readOnlyRoot === true,
          requireStrongIsolation: body?.requireStrongIsolation === true,
          approvalGranted: apiApprovalAccepted,
          requestedBy: String(body?.requestedBy || 'dashboard-operator').trim(),
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
          requestedBy: String(body?.requestedBy || 'dashboard-operator').trim(),
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
        requestedBy: url.searchParams.get('requestedBy') || 'dashboard-operator',
        channel: 'dashboard',
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
        requestedBy: String(body?.requestedBy || 'dashboard-operator').trim(),
        channel: String(body?.channel || 'dashboard').trim(),
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
      if (this.isProviderLiveProbeRequested(url)) {
        deps.writeJson(
          res,
          {
            ok: false,
            error: 'provider_live_probe_requires_explicit_operator_cli_or_approved_api',
            detail: 'O Command Center expõe readiness/projection only. Probe live de provider não roda por render normal do dashboard.',
          },
          403,
        );
        return true;
      }
      const providerCockpit = await this.buildProviderCockpitProjection(url);
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
      if (this.isProviderLiveProbeRequested(url)) {
        deps.writeJson(
          res,
          {
            ok: false,
            error: 'provider_model_catalog_live_probe_requires_explicit_operator_cli_or_approved_api',
            detail: 'O dashboard renderiza o catalogo de providers/modelos sem chamada live oculta. Prova live precisa ser acionada explicitamente pelo operador.',
          },
          403,
        );
        return true;
      }
      const providerModelCatalog = await this.buildProviderModelCatalogProjection(url);
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
      if (this.isProviderLiveProbeRequested(url)) {
        deps.writeJson(
          res,
          {
            ok: false,
            error: 'provider_activation_live_probe_requires_explicit_operator_cli_or_approved_api',
            detail: 'O dashboard renderiza ativacao de providers sem chamada live oculta. Prova live deve ser acionada explicitamente pelo operador.',
          },
          403,
        );
        return true;
      }
      const providerActivation = await this.buildProviderActivationProjection(url);
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
        agentRunQuery: this.buildAgentRunQuery(url),
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
        this.buildCanonicalStateResponse(canonicalState, {
          gateway: this.buildSessionToolsGatewaySnapshot(canonicalState),
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
        agentRunQuery: this.buildAgentRunQuery(url),
        includeMemoryRecall: false,
        includeGateway: false,
        includeCapabilityPlane: false,
        includeArtifactPlane: false,
        includeSelfmodPlane: false,
        includeResourcePlane: false,
        includeCompanionPlane: false,
        includeModeEscalation: false,
      });
      deps.writeJson(res, this.buildCanonicalStateResponse(canonicalState), 200);
      return true;
    }

    return false;
  }

  private buildAgentRunQuery(url: URL): RuntimeRecord {
    const activeRunId = String(url.searchParams.get('runId') || '').trim() || null;
    const activeTraceId = String(url.searchParams.get('traceId') || '').trim() || null;
    const runStatus = this.readAgentRunStatuses(url);
    const limitValue = Number(url.searchParams.get('limit'));

    return {
      activeRunId,
      activeTraceId,
      runStatus,
      runLimit: Number.isFinite(limitValue) && limitValue > 0 ? Math.floor(limitValue) : undefined,
    };
  }

  private buildAgentRunSnapshotOptions(
    activeSessionId: string | null,
    query: RuntimeRecord,
  ): RuntimeRecord {
    const hasDirectRunQuery = Boolean(
      query.activeRunId
        || query.activeTraceId
        || query.runStatus,
    );

    return {
      ...query,
      activeSessionId: hasDirectRunQuery ? null : activeSessionId,
    };
  }

  private readAgentRunStatuses(url: URL): string | string[] | undefined {
    const values = [
      ...url.searchParams.getAll('status'),
      ...url.searchParams.getAll('runStatus'),
    ]
      .flatMap((value) => String(value || '').split(','))
      .map((value) => value.trim().toLowerCase().replace(/[\s-]+/g, '_'))
      .filter((value) => AGENT_RUN_STATUS_VALUES.has(value));
    const uniqueValues = Array.from(new Set(values));
    if (uniqueValues.length === 0) {
      return undefined;
    }
    return uniqueValues.length === 1 ? uniqueValues[0] : uniqueValues;
  }

  private buildUnavailableAgentGatewaySnapshot(
    generatedAt: string,
    input: RuntimeRecord,
  ): RuntimeRecord {
    const query = {
      runId: input.activeRunId || null,
      traceId: input.activeTraceId || null,
      sessionId: input.activeSessionId || null,
      status: input.runStatus || null,
      limit: input.runLimit || 50,
    };

    return {
      generatedAt,
      source: {
        kind: 'universal-agent-runtime',
        label: 'Zavorth Agent Gateway',
      },
      activeRun: null,
      runs: [],
      runObservatory: {
        generatedAt,
        query,
        totalRuns: 0,
        matchedRuns: 0,
        indexes: {
          runIds: [],
          traceIds: [],
          sessionIds: [],
          statuses: [],
        },
        runs: [],
      },
      workflowJobs: [],
      workflowQueue: {
        kind: 'memory',
        label: 'Agent gateway unavailable',
        version: 'agent-workflow-queue-store/v1',
        capabilities: {
          durable: false,
          localOnly: true,
          multiHostSafe: false,
          atomicClaim: false,
          lease: false,
          heartbeat: false,
          backoff: false,
          retry: false,
        },
        notes: [
          'O Command Center carregou, mas o Zavorth Agent Gateway ainda nao foi acoplado a este processo.',
        ],
      },
    };
  }

  private attachLlmRuntimeTelemetry(snapshot: RuntimeRecord): RuntimeRecord {
    const runObservatory = snapshot.runObservatory && typeof snapshot.runObservatory === 'object'
      ? { ...snapshot.runObservatory }
      : {};
    return {
      ...snapshot,
      runObservatory: {
        ...runObservatory,
        llmTelemetry: defaultLlmRuntimeTelemetryService.buildSnapshot({ recentLimit: 10 }),
      },
    };
  }

  private async buildProviderCockpitProjection(url: URL): Promise<RuntimeRecord> {
    const service = new ZavorthCommandCenterProviderCockpitService();
    return service.buildProjection({
      includeAdvanced: this.readBooleanParam(url, 'advanced'),
      providerId: String(url.searchParams.get('provider') || url.searchParams.get('providerId') || '').trim() || null,
      selectedProviderId: String(url.searchParams.get('selectedProvider') || url.searchParams.get('selectedProviderId') || '').trim() || null,
      live: false,
      allowAllLive: false,
    }) as Promise<RuntimeRecord>;
  }

  private async buildProviderModelCatalogProjection(url: URL): Promise<RuntimeRecord> {
    const service = new ZavorthProviderModelCatalogService();
    return service.buildSnapshot({
      includeAdvanced: this.readBooleanParam(url, 'advanced'),
      providerId: String(url.searchParams.get('provider') || url.searchParams.get('providerId') || '').trim() || null,
      selectedProviderId: String(url.searchParams.get('selectedProvider') || url.searchParams.get('selectedProviderId') || '').trim() || null,
      live: false,
      allowAllLive: false,
    }) as Promise<RuntimeRecord>;
  }

  private async buildProviderActivationProjection(url: URL): Promise<RuntimeRecord> {
    const service = new ZavorthProviderActivationService();
    return service.buildSnapshot({
      includeAdvanced: this.readBooleanParam(url, 'advanced'),
      providerId: String(url.searchParams.get('provider') || url.searchParams.get('providerId') || '').trim() || null,
      liveConfigured: false,
      allowAllLive: false,
    }) as Promise<RuntimeRecord>;
  }

  private async buildCommandCenterContractAdapterProjection(
    url: URL,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<RuntimeRecord | null> {
    if (!deps.publicApi) {
      return null;
    }
    const service = new CommandCenterContractAdapterService(deps.publicApi);
    return service.buildSnapshot({
      includeAdvanced: this.readBooleanParam(url, 'advanced'),
      providerId: String(url.searchParams.get('provider') || url.searchParams.get('providerId') || '').trim() || null,
      selectedProviderId: String(url.searchParams.get('selectedProvider') || url.searchParams.get('selectedProviderId') || '').trim() || null,
      approvalStatus: 'pending',
      missionRequest: String(url.searchParams.get('request') || url.searchParams.get('q') || '').trim() || null,
      missionTemplateId: String(url.searchParams.get('templateId') || '').trim() || null,
    }) as Promise<RuntimeRecord>;
  }

  private async buildProviderSelectionProjection(url: URL): Promise<RuntimeRecord> {
    const service = new ZavorthProviderSelectionUxService();
    return service.buildSnapshot({
      includeAdvanced: this.readBooleanParam(url, 'advanced'),
      target: String(url.searchParams.get('provider') || url.searchParams.get('providerId') || '').trim() || null,
      intent: String(url.searchParams.get('providerIntent') || url.searchParams.get('intent') || '').trim() || null,
      requireLiveEvidence: this.readBooleanParam(url, 'requireLive') || this.readBooleanParam(url, 'liveProof'),
      live: false,
    }) as Promise<RuntimeRecord>;
  }

  private async buildProviderPreferenceProjection(): Promise<RuntimeRecord> {
    const service = new ZavorthProviderPreferencePersistenceService();
    const preference = await service.readPreference();
    return {
      surface: 'provider-preference-projection',
      generatedAt: new Date().toISOString(),
      preference,
      safety: {
        projectionOnly: true,
        rawSecretsSerialized: false,
        mutatesConfig: false,
        dashboardExecutionAuthority: false,
      },
      commands: {
        inspect: 'zavorth providers preference --json',
        rollback: preference?.receiptId ? `zavorth providers rollback ${preference.receiptId} --confirm` : null,
      },
    };
  }

  private buildVisualReceiptsProjection(url: URL): RuntimeRecord {
    const service = new ZavorthVisualReceiptUxService();
    return service.buildSnapshot({
      includeAdvanced: this.readBooleanParam(url, 'advanced'),
    }) as RuntimeRecord;
  }

  private buildSensitiveActionFlowUxProjection(url: URL): RuntimeRecord {
    const service = new ZavorthSensitiveActionFlowUxService();
    return service.buildSnapshot({
      request: String(
        url.searchParams.get('request')
        || url.searchParams.get('q')
        || 'Review this workspace in read-only mode.',
      ).trim(),
      decision: this.readSensitiveActionDecision(url.searchParams.get('decision')),
      approvalId: String(url.searchParams.get('approvalId') || url.searchParams.get('approval-id') || '').trim() || null,
      sandboxReady: this.readBooleanParam(url, 'sandboxReady') || this.readBooleanParam(url, 'sandbox-ready'),
      source: 'web',
    }) as RuntimeRecord;
  }

  private buildActiveMissionUxProjection(input: {
    runtimeSnapshot: RuntimeRecord;
    sensitiveActionFlowUx: RuntimeRecord;
    visualReceipts: RuntimeRecord;
    providerSelectionUx: RuntimeRecord;
    providerPreference: RuntimeRecord;
  }): RuntimeRecord {
    const service = new ZavorthActiveMissionUxService();
    return service.buildSnapshot(input) as RuntimeRecord;
  }

  private buildApprovalActionCardsUxProjection(input: {
    runtimeSnapshot: RuntimeRecord;
    sensitiveActionFlowUx: RuntimeRecord;
    visualReceipts: RuntimeRecord;
    activeMissionUx: RuntimeRecord;
  }): RuntimeRecord {
    const service = new ZavorthApprovalActionCardsUxService();
    const approvals = Array.isArray(input.runtimeSnapshot?.approvals)
      ? input.runtimeSnapshot.approvals as RuntimeRecord[]
      : [];
    return service.buildSnapshot({
      approvals,
      sensitiveActionFlowUx: input.sensitiveActionFlowUx,
      visualReceipts: input.visualReceipts,
      activeMissionUx: input.activeMissionUx,
    }) as RuntimeRecord;
  }

  private attachProviderCockpit(
    snapshot: RuntimeRecord,
    providerCockpit: RuntimeRecord,
  ): RuntimeRecord {
    const activeRun = this.isRecord(snapshot.activeRun) ? snapshot.activeRun : null;
    const activeRunMetadata = this.isRecord(activeRun?.metadata) ? activeRun.metadata : null;
    const hasRunProviderCockpit = this.isRecord(activeRunMetadata?.providerCockpit);
    return {
      ...snapshot,
      providerCockpit,
      activeRun: activeRun && !hasRunProviderCockpit
        ? {
          ...activeRun,
          metadata: {
            ...(activeRunMetadata || {}),
            providerCockpit,
          },
        }
        : snapshot.activeRun,
    };
  }

  private attachProviderSelection(
    snapshot: RuntimeRecord,
    providerSelectionUx: RuntimeRecord,
  ): RuntimeRecord {
    return {
      ...snapshot,
      providerSelectionUx,
    };
  }

  private attachProviderPreference(
    snapshot: RuntimeRecord,
    providerPreference: RuntimeRecord,
  ): RuntimeRecord {
    return {
      ...snapshot,
      providerPreference,
    };
  }

  private attachVisualReceipts(
    snapshot: RuntimeRecord,
    visualReceipts: RuntimeRecord,
  ): RuntimeRecord {
    return {
      ...snapshot,
      visualReceipts,
    };
  }

  private attachSensitiveActionFlowUx(
    snapshot: RuntimeRecord,
    sensitiveActionFlowUx: RuntimeRecord,
  ): RuntimeRecord {
    return {
      ...snapshot,
      sensitiveActionFlowUx,
    };
  }

  private attachActiveMissionUx(
    snapshot: RuntimeRecord,
    activeMissionUx: RuntimeRecord,
  ): RuntimeRecord {
    return {
      ...snapshot,
      activeMissionUx,
    };
  }

  private attachApprovalActionCardsUx(
    snapshot: RuntimeRecord,
    approvalActionCardsUx: RuntimeRecord,
  ): RuntimeRecord {
    return {
      ...snapshot,
      approvalActionCardsUx,
    };
  }

  private attachCommandCenterContractAdapter(
    snapshot: RuntimeRecord,
    contractAdapter: RuntimeRecord | null,
  ): RuntimeRecord {
    if (!contractAdapter) {
      return snapshot;
    }
    return {
      ...snapshot,
      contractAdapter,
      contractsV1: contractAdapter,
      providersV1: contractAdapter.providers,
      channelsV1: contractAdapter.channels,
      approvalsV1: contractAdapter.approvals,
      receiptsV1: contractAdapter.receipts,
      missionsV1: contractAdapter.missions,
      runtime: {
        ...(this.isRecord(snapshot.runtime) ? snapshot.runtime : {}),
        contractAdapter: {
          contractVersion: contractAdapter.contractVersion,
          source: contractAdapter.source,
          parity: contractAdapter.parity,
          safety: contractAdapter.safety,
        },
      },
    };
  }

  private async handleCommandCenterActionRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<void> {
    if (!deps.publicApi) {
      deps.writeJson(res, {
        ok: false,
        error: 'canonical_public_api_unavailable',
        detail: 'Command Center action wiring requires the runtime API v1 service.',
      }, 503);
      return;
    }

    const body = await deps.readJsonBody(req);
    const action = String(body?.action || body?.kind || '').trim().toLowerCase();
    const requestedBy = String(body?.requestedBy || 'control-ui').trim() || 'control-ui';
    let result: RuntimeRecord;

    switch (action) {
      case 'approval.approve':
      case 'approval.approve_once':
      case 'approve':
        result = await deps.publicApi.approveApproval({
          approvalId: String(body?.approvalId || body?.id || '').trim(),
          decidedBy: requestedBy,
          note: String(body?.note || body?.reason || '').trim() || null,
        }) as RuntimeRecord;
        break;
      case 'approval.deny':
      case 'approval.reject':
      case 'deny':
      case 'reject':
        result = await deps.publicApi.denyApproval({
          approvalId: String(body?.approvalId || body?.id || '').trim(),
          decidedBy: requestedBy,
          reason: String(body?.reason || body?.note || '').trim() || null,
        }) as RuntimeRecord;
        break;
      case 'mission.cancel':
      case 'cancel':
        result = await deps.publicApi.cancelMission({
          missionId: String(body?.missionId || body?.id || '').trim(),
          requestedBy,
          reason: String(body?.reason || body?.note || '').trim() || null,
        }) as RuntimeRecord;
        break;
      case 'provider.test':
        result = await deps.publicApi.testProvider({
          providerId: String(body?.providerId || body?.id || '').trim(),
          live: body?.live === true,
          approved: body?.approved === true || body?.confirmed === true,
        }) as RuntimeRecord;
        break;
      case 'channel.action':
        result = await deps.publicApi.executeChannelAction({
          channelId: String(body?.channelId || body?.id || '').trim(),
          actionId: String(body?.actionId || '').trim(),
          requestedBy,
          approved: body?.approved === true || body?.confirmed === true,
        }) as RuntimeRecord;
        break;
      default:
        deps.writeJson(res, {
          ok: false,
          error: 'unsupported_command_center_action',
          detail: 'Use approval.approve, approval.deny, mission.cancel, provider.test or channel.action.',
          safety: {
            controllerMutatedDirectly: false,
            commandCenterCanExecute: false,
            policyBrokerRequiredForMutableActions: true,
          },
        }, 400);
        return;
    }

    deps.writeJson(res, {
      ok: result.ok !== false,
      generatedAt: new Date().toISOString(),
      action,
      result,
      safety: {
        controllerMutatedDirectly: false,
        delegatedToRuntimeApiV1: true,
        commandCenterCanExecute: false,
        policyBrokerRequiredForMutableActions: true,
        rawSecretsSerialized: false,
      },
    }, 200);
  }

  private async handleCommandCenterChatRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<void> {
    if (!deps.publicApi) {
      deps.writeJson(res, {
        ok: false,
        error: 'canonical_public_api_unavailable',
        detail: 'Command Center chat wiring requires the runtime API v1 service.',
      }, 503);
      return;
    }

    const body = await deps.readJsonBody(req);
    const result = await deps.publicApi.submitChat({
      message: String(body?.message || body?.text || '').trim(),
      sessionId: String(body?.sessionId || '').trim() || null,
      live: body?.live === true || body?.execute === true,
    });

    deps.writeJson(res, {
      ok: result.accepted,
      generatedAt: new Date().toISOString(),
      chat: result,
      data: result,
      mission: result.mission,
      safety: {
        delegatedToRuntimeApiV1: true,
        commandCenterCanExecute: false,
        dryRunByDefault: true,
        liveRequiresExplicitFlag: true,
        policyBrokerRequiredForTools: true,
        rawSecretsSerialized: false,
      },
    }, 200);
  }

  private isProviderLiveProbeRequested(url: URL): boolean {
    return this.readBooleanParam(url, 'live')
      || this.readBooleanParam(url, 'probeLive')
      || this.readBooleanParam(url, 'allowAllLive');
  }

  private readBooleanParam(url: URL, name: string): boolean {
    const raw = String(url.searchParams.get(name) || '').trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
  }

  private isRecord(value: unknown): value is RuntimeRecord {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  private buildSessionToolsGatewaySnapshot(canonicalState: RuntimeRecord): RuntimeRecord {
    const directGateway = asRecord(canonicalState.gateway);
    if (directGateway) {
      return directGateway;
    }
    const sessionsSummary = asRecord(canonicalState.sessionsSummary);
    const gatewaySessionTools = asRecord(canonicalState.gatewaySessionTools);
    const gatewaySessionsSummary = asRecord(gatewaySessionTools?.sessionsSummary);
    const sessions = asRecord(canonicalState.sessions);
    const sessionEntries = Array.isArray(sessions?.entries) ? sessions.entries : [];

    const sessionTargets = Number(
      sessionsSummary?.total
      ?? gatewaySessionsSummary?.total
      ?? sessions?.total
      ?? (sessionEntries.length > 0
        ? sessionEntries.length
        : Array.isArray(canonicalState.sessions)
          ? canonicalState.sessions.length
          : 0),
    );
    const snapshot = asRecord(canonicalState.snapshot);

    return {
      generatedAt: text(snapshot?.generatedAt) || new Date().toISOString(),
      summary: {
        sessionTargets,
      },
      narrative: {
        headline: sessionTargets > 0
          ? 'Gateway resumido para session tools.'
          : 'Gateway resumido sem sessoes vinculadas.',
        operatorSummary: `${sessionTargets} alvo(s) de sessao disponivel(is) para continuidade rapida.`,
      },
    };
  }

  private buildCurrentModelProfile(snapshot: RuntimeRecord): RuntimeRecord {
    const activeRunProfile = asRecord(asRecord(snapshot.activeRun)?.modelProfile);
    const latestRun = Array.isArray(snapshot?.runs)
      ? asRecord(snapshot.runs.find((run) => Boolean(asRecord(asRecord(run)?.modelProfile))))
      : null;
    const latestRunProfile = asRecord(latestRun?.modelProfile);
    const profile = this.isKnownModelProfile(activeRunProfile)
      ? activeRunProfile
      : this.isKnownModelProfile(latestRunProfile)
        ? latestRunProfile
        : null;
    const configuredProvider = this.normalizeProviderName(config.llmProvider || 'gemini');
    const configuredModel = this.resolveConfiguredModel(configuredProvider);

    return {
      providerLabel: String(
        profile?.providerLabel
        || profile?.provider
        || this.formatProviderLabel(configuredProvider),
      ).trim(),
      modelLabel: String(
        profile?.modelLabel
        || profile?.model
        || configuredModel
        || 'modelo atual nao informado',
      ).trim(),
      routingPolicy: String(
        profile?.routingPolicy
        || (configuredProvider === 'aigateway' ? 'gateway' : 'direct'),
      ).trim(),
      fallbackModelLabel: String(profile?.fallbackModelLabel || '').trim() || undefined,
      supportsTools: profile?.supportsTools ?? true,
      supportsVision: profile?.supportsVision,
      supportsStreaming: profile?.supportsStreaming ?? true,
    };
  }

  private isKnownModelProfile(profile: RuntimeRecord | null | undefined): boolean {
    const modelLabel = String(profile?.modelLabel || profile?.model || '').trim().toLowerCase();
    return Boolean(
      modelLabel
      && ![
        'modelo atual',
        'modelo nao informado',
        'modelo atual nao informado',
      ].includes(modelLabel),
    );
  }

  private normalizeProviderName(provider: string): string {
    return String(provider || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  }

  private formatProviderLabel(provider: string): string {
    switch (this.normalizeProviderName(provider)) {
      case 'aigateway':
        return 'Zavorth Gateway';
      case 'gemini':
        return 'Gemini';
      case 'deepseek':
        return 'DeepSeek';
      case 'openai':
        return 'OpenAI';
      case 'minimax':
        return 'MiniMax';
      case 'openrouter':
        return 'OpenRouter';
      case 'qwen':
      case 'puter':
        return 'Qwen';
      case 'opencode':
        return 'OpenCode';
      case 'ollama':
        return 'Ollama';
      default:
        return provider || 'Provider nao informado';
    }
  }

  private resolveConfiguredModel(provider: string): string {
    switch (this.normalizeProviderName(provider)) {
      case 'aigateway':
        return config.AIGatewayModel;
      case 'gemini':
        return config.geminiModel;
      case 'deepseek':
        return config.deepseekModel;
      case 'openai':
        return config.openaiModel;
      case 'minimax':
        return config.minimaxModel;
      case 'openrouter':
        return config.openRouterModel;
      case 'qwen':
      case 'puter':
        return config.qwenModel;
      case 'opencode':
        return config.openCodeModel;
      default:
        return '';
    }
  }

  private async handleStateRequest(
    res: http.ServerResponse,
    url: URL,
    deps: WebAppRuntimeRouteDeps,
    helpers: WebAppRuntimeStateRouteHelpers,
  ): Promise<void> {
    const sessionId = deps.resolveSessionId(url);
    const sessionContext = helpers.buildSessionContext(sessionId);
    const fullDetail = helpers.isFullDetailRequested(url);
    const gatewayRuntimeSnapshot = deps.gatewayRuntime
      ? await deps.gatewayRuntime.buildCanonicalSnapshot({
          ...sessionContext,
          hydrated: fullDetail,
        })
      : null;
    const runtimeGatewayAny = deps.runtimeGateway as unknown as
      | ({
          buildSnapshot: (input: RuntimeRecord) => RuntimeRecord;
          buildShellSnapshot?: (input: RuntimeRecord) => {
            generatedAt: string;
            summary: RuntimeRecord;
            narrative: RuntimeRecord;
            memoryPlane?: {
              generatedAt: string;
              summary: RuntimeRecord;
              narrative: RuntimeRecord;
            } | null;
            controlPlane?: {
              generatedAt: string;
              summary: RuntimeRecord;
              narrative: RuntimeRecord;
            } | null;
          };
        } & RuntimeRecord)
      | null;
    const gateway = gatewayRuntimeSnapshot?.gateway || (runtimeGatewayAny
      ? fullDetail
        ? runtimeGatewayAny.buildSnapshot(sessionContext)
        : typeof runtimeGatewayAny.buildShellSnapshot === 'function'
          ? runtimeGatewayAny.buildShellSnapshot(sessionContext)
          : runtimeGatewayAny.buildSnapshot(sessionContext)
      : null);
    const snapshot = await deps.realtime.getResolvedSnapshot(sessionId);
    const session = deps.runtimeGatewaySessionTools?.readHistoryFast({
      userId: sessionContext.userId,
      sessionId: sessionContext.sessionId,
      chatId: sessionContext.chatId,
    }) || null;
    const memoryPlane = gateway?.memoryPlane || await deps.buildMemoryPlaneSnapshot(sessionId);
    const productMode = helpers.buildProductMode();
    const memoryRecall = await helpers.previewGatewayMemoryRecall({
      sessionId,
      query: helpers.buildRecallQueryFromSnapshot(snapshot),
      limit: 5,
    });
    const layeredMemory = await deps.buildLayeredMemoryStatus(sessionId);
    const layeredMemoryMetrics = await deps.readLayeredMemoryMetrics(sessionId);
    const learningPlane = await deps.buildLearningPlaneStatus(sessionId);
    const learningMetrics = await deps.buildLearningPlaneMetrics(sessionId);
    const opsQuality = await deps.buildOpsQuality(sessionId);
    const controlPlane = gateway?.controlPlane || null;
    const sessionPlane = await deps.buildSessionPlaneStatusSummary(sessionId);
    deps.writeJson(
      res,
      helpers.buildLightweightStateResponse({
        snapshot,
        productMode,
        modeEscalation: deps.modeEscalation?.buildSnapshot(
          String(url.searchParams.get('sessionId') || '').trim() || 'state-bootstrap',
        ) || null,
        uiSurfaceHints: helpers.buildUiSurfaceHints(productMode, {
          localControlEntry: '/control',
          localControlReady: true,
          telegramReady: true,
          discordReady: false,
          classicReady: true,
          cliReady: true,
        }),
        gateway,
        session,
        memoryPlane,
        memoryRecall,
        layeredMemory,
        layeredMemoryMetrics,
        learningPlane,
        learningMetrics,
        opsQuality,
        controlPlane,
        sessionPlane,
        gatewayRuntime: gatewayRuntimeSnapshot,
      }),
      200,
    );
  }

  private buildCanonicalStateResponse(
    canonicalState: RuntimeRecord,
    extra: RuntimeRecord = {},
  ): RuntimeRecord {
    return {
      ok: true,
      snapshot: canonicalState.snapshot,
      productMode: canonicalState.productMode,
      gateway: canonicalState.gateway,
      session: canonicalState.session,
      sessions: canonicalState.sessions,
      sessionsSummary: canonicalState.sessionsSummary,
      gatewaySessionTools: canonicalState.gatewaySessionTools,
      memoryPlane: canonicalState.memoryPlane,
      memoryRecall: canonicalState.memoryRecall,
      controlPlane: canonicalState.controlPlane,
      sessionPlane: canonicalState.sessionPlane,
      approvalPlane: canonicalState.approvalPlane,
      capabilityPlane: canonicalState.capabilityPlane,
      artifactPlane: canonicalState.artifactPlane,
      selfmodPlane: canonicalState.selfmodPlane,
      resourcePlane: canonicalState.resourcePlane,
      companionPlane: canonicalState.companionPlane,
      uiSurfaceHints: canonicalState.uiSurfaceHints,
      runtimeWarnings: canonicalState.runtimeWarnings,
      actionRecommendations: canonicalState.actionRecommendations,
      ...extra,
    };
  }

  private readSensitiveActionDecision(value: string | null): ZavorthSensitiveActionFlowDecision {
    const normalized = String(value || '').trim();
    if (normalized === 'approve' || normalized === 'deny') return normalized;
    return 'none';
  }
}

function asRecord(value: unknown): RuntimeRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RuntimeRecord : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isExternalAgentApiApprovalRequested(body: RuntimeRecord | null | undefined): boolean {
  return body?.approved === true || body?.approvalGranted === true;
}

function isExternalAgentApiApprovalAccepted(req: http.IncomingMessage, body: RuntimeRecord | null | undefined): boolean {
  if (!isExternalAgentApiApprovalRequested(body)) return false;
  const expected = text(process.env.ZAVORTH_EXTERNAL_AGENT_API_APPROVAL_TOKEN || process.env.ZAVORTH_DASHBOARD_OPERATOR_TOKEN);
  if (expected.length < 16) return false;
  const provided = readHeaderValue(req, 'x-zavorth-operator-approval');
  return safeTokenEquals(provided, expected);
}

function readHeaderValue(req: http.IncomingMessage, name: string): string {
  const raw = req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) return text(raw[0]);
  return text(raw);
}

function safeTokenEquals(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  try {
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}
