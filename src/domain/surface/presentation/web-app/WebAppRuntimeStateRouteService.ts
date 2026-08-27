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
import { ZavorthRuntimeReadinessService } from '../../../../services/ZavorthRuntimeReadinessService.js';
import { ZavorthRuntimeGuidedFixesService } from '../../../../services/ZavorthRuntimeGuidedFixesService.js';
import { ZavorthRuntimeReadinessUxService } from '../../../../services/ZavorthRuntimeReadinessUxService.js';
import { ZavorthReadyToGoService } from '../../../../services/ZavorthReadyToGoService.js';
import { ZavorthStayOnlineService } from '../../../../services/ZavorthStayOnlineService.js';
import { ZavorthExternalAgentOnboardingService } from '../../../../services/ZavorthExternalAgentOnboardingService.js';
import { ZavorthExternalAgentGatewayService } from '../../../../services/ZavorthExternalAgentGatewayService.js';
import { ZavorthCapabilityMeshService } from '../../../../services/ZavorthCapabilityMeshService.js';
import { ZavorthDailyUseGuiCertificationService } from '../../../../services/ZavorthDailyUseGuiCertificationService.js';
import type { ZavorthSensitiveActionFlowDecision } from '../../../../contracts/ZavorthSensitiveActionFlowContract.js';
import { logger } from '../../../../logger';
import { isLoopbackRemoteAddress, resolveLearningLoopApiUserId, isLearningWriteAllowed } from '../../../../services/ZavorthLearningWriteAuth.js';
import { buildLearnedKnowledgeHub } from '../../../../services/learned-knowledge/LearnedKnowledgeHub.js';
import { buildLearnedKnowledgeStory } from '../../../../services/learned-knowledge/LearnedKnowledgeStoryService.js';
import { buildLearnedKnowledgeAdvanced } from '../../../../services/learned-knowledge/LearnedKnowledgeAdvanced.js';
import { LearnedKnowledgePlaneService } from '../../../../services/learned-knowledge/LearnedKnowledgePlaneService.js';
import { AboutYouService } from '../../../../services/learned-knowledge/AboutYouService.js';
import { queryKnowledgeFacts, previewKnowledgeConsolidate } from '../../../../services/learned-knowledge/KnowledgeFactsRecall.js';
import { ExperienceSkillLearningLoopService } from '../../../../services/ExperienceSkillLearningLoopService.js';
import { LlmRoleRoutingService } from '../../../../services/llm/LlmRoleRoutingService.js';
import { normalizeRoleSurface, resolveLlmRoleScopeId } from '../../../../contracts/runtime/LlmRoleRoutingContract.js';
import { LlmRoleSurfaceCommands } from '../../../../services/llm/LlmRoleSurfaceCommands.js';
import { LlmRuntimeService } from '../../../../services/llm/LlmRuntimeService.js';
import type {
  ZavorthExternalAgentAdapterKind,
  ZavorthExternalAgentIsolationKind,
  ZavorthExternalAgentNetworkMode,
} from '../../../../contracts/ZavorthExternalAgentGatewayContract.js';
import { WebAppRuntimeProjectionSupport } from './WebAppRuntimeProjectionSupport.js';
import { WebAppRuntimeInteractionSupport } from './WebAppRuntimeInteractionSupport.js';
import { WebAppRuntimePersistenceSupport } from './WebAppRuntimePersistenceSupport.js';

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
  cliReady: boolean;
};

const EXTERNAL_AGENT_ADAPTERS = new Set<ZavorthExternalAgentAdapterKind>(['cli', 'http', 'acp', 'mcp']);
const EXTERNAL_AGENT_PROMPT_MODES = new Set(['stdin', 'arg', 'json']);
const EXTERNAL_AGENT_ISOLATION_KINDS = new Set<ZavorthExternalAgentIsolationKind | 'local'>([
  'local',
  'local-supervised',
  'wsl',
  'docker',
]);
const EXTERNAL_AGENT_NETWORK_MODES = new Set<ZavorthExternalAgentNetworkMode>(['disabled', 'local-only', 'profile']);

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
  buildUiSurfaceHints: (productMode: RuntimeRecord | null, input: UiSurfaceHintsInput) => RuntimeRecord | null;
  buildCanonicalStatePayload: (sessionId: string, options: RuntimeRecord) => Promise<RuntimeRecord>;
  isCanonicalSessionPlaneRoute: (pathname: string) => boolean;
};

export class WebAppRuntimeStateRouteService {
  private readonly __runtimeStateRoutesBrand = true;
  public readonly projectionSupport = new WebAppRuntimeProjectionSupport(this);
  public readonly interactionSupport = new WebAppRuntimeInteractionSupport(this);
  public readonly persistenceSupport = new WebAppRuntimePersistenceSupport(this);
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

    if (pathname === '/api/web/zavorthControl' && req.method === 'GET') {
      const activeSessionId = String(url.searchParams.get('sessionId') || '').trim() || null;
      const agentRunQuery = this.buildAgentRunQuery(url);
      const generatedAt = new Date().toISOString();
      const contractAdapter = await this.buildZavorthControlContractAdapterProjection(url, deps);
      const snapshot =
        deps.agentGateway?.buildSnapshot(this.buildAgentRunSnapshotOptions(activeSessionId, agentRunQuery)) ||
        this.buildUnavailableAgentGatewaySnapshot(
          generatedAt,
          this.buildAgentRunSnapshotOptions(activeSessionId, agentRunQuery),
        );
      const providerCockpit = await this.buildProviderCockpitProjection(url);
      const providerSelectionUx = await this.buildProviderSelectionProjection(url);
      const providerPreference = await this.buildProviderPreferenceProjection();
      const visualReceipts = this.buildVisualReceiptsProjection(url);
      const sensitiveActionFlowUx = this.buildSensitiveActionFlowUxProjection(url);
      const baseSnapshot = this.attachSensitiveActionFlowUx(
        this.attachVisualReceipts(this.attachLlmRuntimeTelemetry(snapshot), visualReceipts),
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
      const zavorthControlSnapshot = this.attachZavorthControlContractAdapter(enrichedSnapshot, contractAdapter);
      deps.writeJson(
        res,
        {
          ok: true,
          live: Boolean(deps.agentGateway),
          generatedAt: zavorthControlSnapshot.generatedAt,
          snapshot: zavorthControlSnapshot,
          contractAdapter,
          contractsV1: contractAdapter,
          modelProfile: this.buildCurrentModelProfile(zavorthControlSnapshot),
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/zavorthControl/contracts-v1' && req.method === 'GET') {
      const contractAdapter = await this.buildZavorthControlContractAdapterProjection(url, deps);
      if (!contractAdapter) {
        deps.writeJson(
          res,
          {
            ok: false,
            error: 'canonical_public_api_unavailable',
            detail: 'ZavorthControl contract adapter requires the runtime API v1 service.',
          },
          503,
        );
        return true;
      }
      deps.writeJson(
        res,
        {
          ok: true,
          generatedAt: contractAdapter.generatedAt,
          contractAdapter,
          contractsV1: contractAdapter,
        },
        200,
      );
      return true;
    }

    if (
      (pathname === '/api/web/zavorthControl/events-v1' || pathname === '/api/web/zavorthControl/events-v1') &&
      req.method === 'GET'
    ) {
      if (!deps.publicApi) {
        deps.writeJson(
          res,
          {
            ok: false,
            error: 'canonical_public_api_unavailable',
            detail: 'ZavorthControl event wiring requires the runtime API v1 service.',
          },
          503,
        );
        return true;
      }
      const sessionId = String(url.searchParams.get('sessionId') || '').trim() || 'control';
      deps.writeJson(
        res,
        {
          ok: true,
          generatedAt: new Date().toISOString(),
          eventsV1: await deps.publicApi.readRuntimeEvents({ sessionId }),
          safety: {
            projectionOnly: true,
            zavorthControlCanExecute: false,
            policyBrokerRequiredForMutableActions: true,
            rawSecretsSerialized: false,
          },
        },
        200,
      );
      return true;
    }

    if (
      (pathname === '/api/web/zavorthControl/gui-certification-v1' ||
        pathname === '/api/web/zavorthControl/gui-certification-v1') &&
      req.method === 'GET'
    ) {
      if (!deps.publicApi) {
        deps.writeJson(
          res,
          {
            ok: false,
            error: 'canonical_public_api_unavailable',
            detail: 'Daily-use GUI certification requires the runtime API v1 service.',
          },
          503,
        );
        return true;
      }
      const sessionId = String(url.searchParams.get('sessionId') || '').trim() || 'control';
      const request = String(url.searchParams.get('q') || url.searchParams.get('request') || '').trim();
      deps.writeJson(
        res,
        {
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
            desktopCanBypassRuntime: false,
            policyBrokerRequiredForMutableActions: true,
            rawSecretsSerialized: false,
          },
        },
        200,
      );
      return true;
    }

    if (
      (pathname === '/api/web/zavorthControl/actions' || pathname === '/api/web/zavorthControl/actions') &&
      req.method === 'POST'
    ) {
      await this.handleZavorthControlActionRequest(req, res, deps);
      return true;
    }

    if (
      (pathname === '/api/web/zavorthControl/chat-v1' || pathname === '/api/web/zavorthControl/chat-v1') &&
      req.method === 'POST'
    ) {
      await this.handleZavorthControlChatRequest(req, res, deps);
      return true;
    }

    if (pathname === '/api/web/chat/side' && req.method === 'POST') {
      await this.handleZavorthControlSideChatRequest(req, res, deps);
      return true;
    }

    if (pathname === '/api/web/chat/steer' && req.method === 'POST') {
      await this.handleZavorthControlSteerChatRequest(req, res, deps);
      return true;
    }

    if (
      (pathname === '/api/web/zavorthControl/memory' || pathname === '/api/web/zavorthControl/memory') &&
      req.method === 'GET'
    ) {
      deps.writeJson(res, this.readZavorthControlMemoryFacts(url), 200);
      return true;
    }

    if (
      (pathname === '/api/web/zavorthControl/memory' || pathname === '/api/web/zavorthControl/memory') &&
      req.method === 'POST'
    ) {
      const body = await deps.readJsonBody(req);
      deps.writeJson(res, this.applyZavorthControlMemoryAction(url, body), 200);
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
          safety: approvalActionCardsUx.zavorthControlProjection,
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
        approximatePathHint:
          String(body?.approxPath || body?.approximatePath || body?.approximatePathHint || '').trim() || null,
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
      const action = String(body?.action || body?.kind || '')
        .trim()
        .toLowerCase();
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
      deps.writeJson(
        res,
        { ok: true, live: false, generatedAt: snapshot.generatedAt, capabilityMesh: snapshot, safety: snapshot.safety },
        200,
      );
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
      deps.writeJson(
        res,
        { ok: true, live: false, generatedAt: snapshot.generatedAt, capabilityMesh: snapshot, safety: snapshot.safety },
        200,
      );
      return true;
    }

    if (pathname === '/api/providers/readiness' && req.method === 'GET') {
      if (this.isProviderLiveProbeRequested(url)) {
        deps.writeJson(
          res,
          {
            ok: false,
            error: 'provider_live_probe_requires_explicit_operator_cli_or_approved_api',
            detail:
              'ZavorthControl exposes readiness/projection only. Live provider probes do not run on a normal Control render.',
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

    if (pathname === '/api/knowledge/hub' && req.method === 'GET') {
      try {
        const isLoopback = isLoopbackRemoteAddress(req.socket?.remoteAddress);
        const authIdentity = deps.auth?.resolveAuthenticatedIdentity?.(req) || null;
        const authUserId = authIdentity ? String(authIdentity.userId || '').trim() : '';
        const requestedUserId = String(url.searchParams.get('userId') || '').trim();
        const resolved = resolveLearningLoopApiUserId({
          requestedUserId,
          authUserId,
          allowLocalUiWithoutAuth: isLoopback,
        });
        if (!resolved.ok) {
          const status = resolved.error === 'auth_required' ? 401 : 403;
          deps.writeJson(res, { ok: false, error: resolved.error }, status);
          return true;
        }
        const hub = buildLearnedKnowledgeHub({
          userId: resolved.userId,
          projectRoot: process.cwd(),
        });
        deps.writeJson(res, hub, 200);
        return true;
      } catch (error: unknown) {
        deps.writeJson(
          res,
          {
            ok: false,
            // Avoid leaking stack/paths in error bodies.
            error: 'knowledge_hub_failed',
          },
          500,
        );
        return true;
      }
    }

    if (pathname === '/api/knowledge/story' && req.method === 'GET') {
      try {
        const isLoopback = isLoopbackRemoteAddress(req.socket?.remoteAddress);
        const authIdentity = deps.auth?.resolveAuthenticatedIdentity?.(req) || null;
        const authUserId = authIdentity ? String(authIdentity.userId || '').trim() : '';
        const requestedUserId = String(url.searchParams.get('userId') || '').trim();
        const resolved = resolveLearningLoopApiUserId({
          requestedUserId,
          authUserId,
          allowLocalUiWithoutAuth: isLoopback,
        });
        if (!resolved.ok) {
          const status = resolved.error === 'auth_required' ? 401 : 403;
          deps.writeJson(res, { ok: false, error: resolved.error }, status);
          return true;
        }
        const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days') || 7) || 7));
        const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 24) || 24));
        const story = buildLearnedKnowledgeStory({
          userId: resolved.userId,
          projectRoot: process.cwd(),
          windowDays: days,
          limit,
        });
        deps.writeJson(res, story, 200);
        return true;
      } catch (error: unknown) {
        deps.writeJson(
          res,
          {
            ok: false,
            error: 'knowledge_story_failed',
          },
          500,
        );
        return true;
      }
    }

    if (pathname === '/api/knowledge/advanced' && req.method === 'GET') {
      try {
        const isLoopback = isLoopbackRemoteAddress(req.socket?.remoteAddress);
        const authIdentity = deps.auth?.resolveAuthenticatedIdentity?.(req) || null;
        if (!isLoopback && !authIdentity) {
          deps.writeJson(
            res,
            {
              ok: false,
              error: 'auth_required',
              detail: 'Authenticated session required when Control is network-exposed (non-loopback).',
            },
            401,
          );
          return true;
        }
        const advanced = buildLearnedKnowledgeAdvanced({ projectRoot: process.cwd() });
        deps.writeJson(res, { ok: true, ...advanced }, 200);
        return true;
      } catch (error: unknown) {
        deps.writeJson(
          res,
          {
            ok: false,
            error: 'knowledge_advanced_failed',
          },
          500,
        );
        return true;
      }
    }

    if (pathname === '/api/knowledge/pack' && req.method === 'GET') {
      try {
        const isLoopback = isLoopbackRemoteAddress(req.socket?.remoteAddress);
        const authIdentity = deps.auth?.resolveAuthenticatedIdentity?.(req) || null;
        const authUserId = authIdentity ? String(authIdentity.userId || '').trim() : '';
        const requestedUserId = String(url.searchParams.get('userId') || '').trim();
        const resolved = resolveLearningLoopApiUserId({
          requestedUserId,
          authUserId,
          allowLocalUiWithoutAuth: isLoopback,
        });
        if (!resolved.ok) {
          const status = resolved.error === 'auth_required' ? 401 : 403;
          deps.writeJson(res, { ok: false, error: resolved.error }, status);
          return true;
        }
        const query = String(url.searchParams.get('query') || url.searchParams.get('q') || '').trim();
        const budget = Math.min(8000, Math.max(256, Number(url.searchParams.get('budget') || 1200) || 1200));
        const pack = new LearnedKnowledgePlaneService({ projectRoot: process.cwd() }).buildPack({
          userId: resolved.userId,
          userMessage: query || null,
          surface: 'control',
          projectRoot: process.cwd(),
          tokenBudget: budget,
        });
        deps.writeJson(res, { ok: true, ...pack }, 200);
        return true;
      } catch (error: unknown) {
        deps.writeJson(
          res,
          {
            ok: false,
            error: 'knowledge_pack_failed',
          },
          500,
        );
        return true;
      }
    }

    if (pathname === '/api/knowledge/about' && (req.method === 'GET' || req.method === 'POST')) {
      try {
        const isLoopback = isLoopbackRemoteAddress(req.socket?.remoteAddress);
        const authIdentity = deps.auth?.resolveAuthenticatedIdentity?.(req) || null;
        const authUserId = authIdentity ? String(authIdentity.userId || '').trim() : '';
        const requestedUserId = String(url.searchParams.get('userId') || '').trim();
        const resolved = resolveLearningLoopApiUserId({
          requestedUserId,
          authUserId,
          allowLocalUiWithoutAuth: isLoopback,
        });
        if (!resolved.ok) {
          const status = resolved.error === 'auth_required' ? 401 : 403;
          deps.writeJson(res, { ok: false, error: resolved.error }, status);
          return true;
        }
        const about = new AboutYouService({ projectRoot: process.cwd() });
        if (req.method === 'GET') {
          const snap = about.buildSnapshot(resolved.userId);
          deps.writeJson(res, { ok: true, ...snap }, 200);
          return true;
        }
        // POST action=propose|approve|reject|forget|export|propose-learning
        const action = String(url.searchParams.get('action') || '')
          .trim()
          .toLowerCase();
        const id = String(url.searchParams.get('id') || '').trim();
        const key = String(url.searchParams.get('key') || '').trim();
        const value = String(url.searchParams.get('value') || '').trim();
        if (action === 'propose') {
          const result = about.propose(resolved.userId, { key, value });
          deps.writeJson(res, { ok: result.ok, text: result.text, draft: result.draft }, result.ok ? 200 : 400);
          return true;
        }
        if (action === 'approve') {
          const result = about.approve(resolved.userId, id || key);
          deps.writeJson(res, { ok: result.ok, text: result.text, fact: result.fact }, result.ok ? 200 : 400);
          return true;
        }
        if (action === 'reject') {
          const result = about.reject(resolved.userId, id || key);
          deps.writeJson(res, { ok: result.ok, text: result.text }, result.ok ? 200 : 400);
          return true;
        }
        if (action === 'forget') {
          const result = about.forget(resolved.userId, id || key);
          deps.writeJson(res, { ok: result.ok, text: result.text }, result.ok ? 200 : 400);
          return true;
        }
        if (action === 'export') {
          const result = about.exportProfile(resolved.userId);
          deps.writeJson(res, { ok: result.ok, text: result.text, path: result.path }, result.ok ? 200 : 400);
          return true;
        }
        if (action === 'propose-learning') {
          const result = about.proposeFromLearning(resolved.userId);
          deps.writeJson(res, { ok: result.ok, text: result.text, proposed: result.proposed }, 200);
          return true;
        }
        deps.writeJson(
          res,
          {
            ok: false,
            error: 'unknown_action',
            detail: 'Use action=propose|approve|reject|forget|export|propose-learning',
          },
          400,
        );
        return true;
      } catch (error: unknown) {
        deps.writeJson(
          res,
          {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          },
          500,
        );
        return true;
      }
    }

    if (pathname === '/api/knowledge/facts' && req.method === 'GET') {
      try {
        const isLoopback = isLoopbackRemoteAddress(req.socket?.remoteAddress);
        const authIdentity = deps.auth?.resolveAuthenticatedIdentity?.(req) || null;
        if (!isLoopback && !authIdentity) {
          deps.writeJson(
            res,
            {
              ok: false,
              error: 'auth_required',
              detail: 'Authenticated session required when Control is network-exposed (non-loopback).',
            },
            401,
          );
          return true;
        }
        const query = String(url.searchParams.get('query') || url.searchParams.get('q') || '').trim();
        if (!query) {
          deps.writeJson(res, { ok: false, error: 'query is required' }, 400);
          return true;
        }
        const topK = Math.min(20, Math.max(1, Number(url.searchParams.get('topK') || 6) || 6));
        const budget = Math.min(6000, Math.max(256, Number(url.searchParams.get('budget') || 1800) || 1800));
        const result = queryKnowledgeFacts({
          query,
          topK,
          contextTokenBudget: budget,
          projectRoot: process.cwd(),
        });
        deps.writeJson(
          res,
          {
            ok: true,
            pillar: 'knowledge',
            productLabel: 'Knowledge',
            recall: result,
            hits: result.hits,
          },
          200,
        );
        return true;
      } catch (error: unknown) {
        deps.writeJson(
          res,
          {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          },
          500,
        );
        return true;
      }
    }

    if (pathname === '/api/knowledge/consolidate' && req.method === 'GET') {
      try {
        const isLoopback = isLoopbackRemoteAddress(req.socket?.remoteAddress);
        const authIdentity = deps.auth?.resolveAuthenticatedIdentity?.(req) || null;
        if (!isLoopback && !authIdentity) {
          deps.writeJson(
            res,
            {
              ok: false,
              error: 'auth_required',
              detail: 'Authenticated session required when Control is network-exposed (non-loopback).',
            },
            401,
          );
          return true;
        }
        const preview = previewKnowledgeConsolidate({
          projectRoot: process.cwd(),
          sessionSummary: String(url.searchParams.get('summary') || '').trim() || null,
        });
        deps.writeJson(res, { ok: true, ...preview }, 200);
        return true;
      } catch (error: unknown) {
        deps.writeJson(
          res,
          {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          },
          500,
        );
        return true;
      }
    }

    if (pathname === '/api/learning-loop' && req.method === 'GET') {
      try {
        // Prefer session identity. local UI ids (control/desktop) only on loopback socket peer.
        const requestedUserId = String(url.searchParams.get('userId') || '').trim();
        const isLoopback = isLoopbackRemoteAddress(req.socket?.remoteAddress);
        const authIdentity = deps.auth?.resolveAuthenticatedIdentity?.(req) || null;
        const authUserId = authIdentity ? String(authIdentity.userId || '').trim() : '';
        const resolved = resolveLearningLoopApiUserId({
          requestedUserId,
          authUserId,
          allowLocalUiWithoutAuth: isLoopback,
        });
        if (!resolved.ok) {
          const status = resolved.error === 'auth_required' ? 401 : 403;
          deps.writeJson(
            res,
            {
              ok: false,
              error: resolved.error,
              detail:
                resolved.error === 'auth_required'
                  ? 'Authenticated session required when Control is network-exposed (non-loopback).'
                  : 'Arbitrary userId is not allowed without authenticated session.',
            },
            status,
          );
          return true;
        }
        const userId = resolved.userId;
        const loop = new ExperienceSkillLearningLoopService();
        const status = loop.buildStatusSnapshot(userId);
        const drafts = loop.listDrafts(userId, 50);
        deps.writeJson(
          res,
          {
            ok: true,
            ...status,
            drafts: status.drafts,
            count: status.drafts,
            workflowsLearned: status.workflowsLearned,
            badge: status.badge,
            latestTitle: status.lastSkillTitle || drafts[0]?.title || null,
            latest: status.lastSkillTitle || drafts[0]?.title || null,
            items: drafts.slice(0, 8).map((d) => ({
              id: d.id,
              title: d.title,
              useCount: d.useCount,
              revisions: d.revisions || 0,
              tools: d.tools,
            })),
          },
          200,
        );
        return true;
      } catch (error: unknown) {
        deps.writeJson(
          res,
          {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          },
          500,
        );
        return true;
      }
    }

    // One-click promote for Control/Desktop skill drafts (/learn promote N — not /learning candidates).
    if (pathname === '/api/learning-loop/promote' && req.method === 'POST') {
      try {
        const body = (await deps.readJsonBody(req).catch(() => ({}))) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
        const requestedUserId = String(body?.userId || url.searchParams.get('userId') || '').trim();
        const isLoopback = isLoopbackRemoteAddress(req.socket?.remoteAddress);
        const authIdentity = deps.auth?.resolveAuthenticatedIdentity?.(req) || null;
        const authUserId = authIdentity ? String(authIdentity.userId || '').trim() : '';
        const resolved = resolveLearningLoopApiUserId({
          requestedUserId,
          authUserId,
          allowLocalUiWithoutAuth: isLoopback,
        });
        if (!resolved.ok) {
          const status = resolved.error === 'auth_required' ? 401 : 403;
          deps.writeJson(
            res,
            {
              ok: false,
              error: resolved.error,
              detail:
                resolved.error === 'auth_required'
                  ? 'Authenticated session required when Control is network-exposed (non-loopback).'
                  : 'Arbitrary userId is not allowed without authenticated session.',
            },
            status,
          );
          return true;
        }
        const userId = resolved.userId;
        const dryRun = body?.dryRun === true || body?.dryRun === 'true' || body?.dryRun === 1;
        // Prefer 1-based ordinal from list order (promote 1 = first draft). Optional exact draftId.
        const ordinalRaw = body?.ordinal ?? body?.n ?? null;
        const ordinalNum = ordinalRaw == null || ordinalRaw === '' ? NaN : Number(ordinalRaw);
        const draftIdRaw = String(body?.draftId || body?.id || body?.ref || '').trim();
        let ref = '';
        if (Number.isFinite(ordinalNum) && ordinalNum >= 1) {
          ref = String(Math.floor(ordinalNum));
        } else if (draftIdRaw) {
          ref = draftIdRaw;
        }
        if (!ref) {
          deps.writeJson(
            res,
            {
              ok: false,
              error: 'missing_draft_ref',
              detail: 'Provide ordinal (1-based from /learn list) or draftId.',
            },
            400,
          );
          return true;
        }
        // Real promote is a durable learning write; dry-run is read-only preview.
        if (!dryRun) {
          const writeAllowed = isLearningWriteAllowed({
            surface: isLoopback ? 'control' : 'control-api',
            userId,
            allowLearningWrite: isLoopback || Boolean(authUserId) || null,
          });
          if (!writeAllowed) {
            deps.writeJson(
              res,
              {
                ok: false,
                error: 'learning_write_denied',
                detail: 'Learning write not allowed for this actor/surface.',
              },
              403,
            );
            return true;
          }
        }
        const loop = new ExperienceSkillLearningLoopService();
        const result = loop.promote(userId, ref, { dryRun });
        if (!result.ok) {
          deps.writeJson(
            res,
            {
              ok: false,
              error: 'promote_failed',
              detail: result.text || 'Promote failed.',
              dryRun: Boolean(result.dryRun),
              draftId: result.draftId || null,
              title: result.title || null,
              ordinal: Number.isFinite(ordinalNum) && ordinalNum >= 1 ? Math.floor(ordinalNum) : null,
              fallbackCommand:
                Number.isFinite(ordinalNum) && ordinalNum >= 1
                  ? `/learn promote ${Math.floor(ordinalNum)}${dryRun ? ' --dry-run' : ''}`
                  : '/learn list',
            },
            400,
          );
          return true;
        }
        deps.writeJson(
          res,
          {
            ok: true,
            dryRun: Boolean(result.dryRun),
            text: result.text,
            draftId: result.draftId || null,
            title: result.title || null,
            skillName: result.skillName || null,
            runtimeSkillPath: result.runtimeSkillPath || null,
            auditDest: result.auditDest || null,
            loaderReady: result.loaderReady ?? null,
            ordinal: Number.isFinite(ordinalNum) && ordinalNum >= 1 ? Math.floor(ordinalNum) : null,
            plane: 'experience-skill-drafts',
            note: '/learn promote (skill drafts) — not /learning candidates',
          },
          200,
        );
        return true;
      } catch (error: unknown) {
        deps.writeJson(
          res,
          {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          },
          500,
        );
        return true;
      }
    }

    if (pathname === '/api/llm-roles' && (req.method === 'GET' || req.method === 'POST')) {
      try {
        const roleService = new LlmRoleRoutingService();
        const surfaceCommands = new LlmRoleSurfaceCommands(roleService);
        const runtime = new LlmRuntimeService();
        const isUsable = (name: string) => runtime.isProviderAvailable(name);
        // Same loopback-or-auth gate as /api/learning-loop so Desktop/Control keep working on 127.0.0.1.
        const requestedUserId = String(url.searchParams.get('userId') || '').trim();
        const isLoopback = isLoopbackRemoteAddress(req.socket?.remoteAddress);
        const authIdentity = deps.auth?.resolveAuthenticatedIdentity?.(req) || null;
        const authUserId = authIdentity ? String(authIdentity.userId || '').trim() : '';
        const resolved = resolveLearningLoopApiUserId({
          requestedUserId,
          authUserId,
          allowLocalUiWithoutAuth: isLoopback,
        });
        if (!resolved.ok) {
          const status = resolved.error === 'auth_required' ? 401 : 403;
          deps.writeJson(
            res,
            {
              ok: false,
              error: resolved.error,
              detail:
                resolved.error === 'auth_required'
                  ? 'Authenticated session required when Control is network-exposed (non-loopback).'
                  : 'Arbitrary userId is not allowed without authenticated session.',
            },
            status,
          );
          return true;
        }
        const userId = resolved.userId;
        const surface = normalizeRoleSurface(url.searchParams.get('surface') || 'control');
        const scopeId = resolveLlmRoleScopeId({ userId, surface });
        const cmdCtx = {
          userId,
          surface,
          roleScopeId: scopeId,
          isProviderUsable: isUsable,
        };

        if (req.method === 'GET') {
          await roleService.refreshLiveCatalog(isUsable).catch(() => 0);
          const configRoles = roleService.getConfig(scopeId);
          const health = roleService.healthCheck(scopeId, isUsable);
          const proposal = roleService.buildSetupQuestion(isUsable);
          deps.writeJson(
            res,
            {
              ok: true,
              scopeId,
              surface,
              roles: configRoles,
              health,
              proposal: proposal.proposal,
              usableSummary: proposal.usableSummary,
              statusText: surfaceCommands.formatStatus(cmdCtx),
              forceStrongActive: roleService.isForceStrongActive(scopeId),
            },
            200,
          );
          return true;
        }

        const body = (await deps.readJsonBody(req).catch(() => ({}))) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
        if (body?.action === 'set') {
          const next = roleService.setRoles(scopeId, {
            default: body.default ?? undefined,
            strong: body.strong ?? undefined,
            background: body.background ?? undefined,
            strongOnDefaultFailure: body.strongOnDefaultFailure,
            taskStrong: body.taskStrong,
            source: 'ui',
          });
          deps.writeJson(
            res,
            {
              ok: true,
              surface,
              roles: next,
              statusText: surfaceCommands.formatStatus(cmdCtx),
            },
            200,
          );
          return true;
        }
        if (body?.action === 'forceStrong') {
          const next = roleService.setForceStrong(scopeId, body.enabled !== false);
          deps.writeJson(
            res,
            {
              ok: true,
              surface,
              roles: next,
              statusText: surfaceCommands.formatStatus(cmdCtx),
            },
            200,
          );
          return true;
        }
        if (body?.action === 'dismiss') {
          const next = roleService.dismissPrompt(scopeId);
          deps.writeJson(res, { ok: true, surface, roles: next }, 200);
          return true;
        }
        if (body?.action === 'setup') {
          const prompt = surfaceCommands.promptSetup(cmdCtx, true);
          deps.writeJson(
            res,
            {
              ok: true,
              surface,
              prompt: prompt.text,
              reason: prompt.reason,
              roles: roleService.getConfig(scopeId),
            },
            200,
          );
          return true;
        }
        deps.writeJson(res, { ok: false, error: 'unknown_action' }, 400);
        return true;
      } catch (error: unknown) {
        deps.writeJson(
          res,
          {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          },
          500,
        );
        return true;
      }
    }

    if (pathname === '/api/providers/model-catalog' && req.method === 'GET') {
      if (this.isProviderLiveProbeRequested(url)) {
        deps.writeJson(
          res,
          {
            ok: false,
            error: 'provider_model_catalog_live_probe_requires_explicit_operator_cli_or_approved_api',
            detail:
              'zavorthControl renders the provider/model catalog without hidden live calls. Live proof must be triggered explicitly by the operator.',
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
            detail:
              'zavorthControl renders provider activation without hidden live calls. Live proof must be explicitly triggered by the operator.',
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
              headline: 'Learning plane unavailable.',
              operatorSummary: 'The current runtime did not load the learning plane.',
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
      const actionId = String(body?.actionId || '')
        .trim()
        .toLowerCase();
      if (!candidateId) {
        deps.writeJson(res, { ok: false, error: 'candidateId required.' }, 400);
        return true;
      }
      if (!['approve', 'reject', 'promote'].includes(actionId)) {
        deps.writeJson(res, { ok: false, error: 'actionId invalid para learning plane.' }, 400);
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

  public buildAgentRunQuery(url: URL): RuntimeRecord {
    return this.projectionSupport.buildAgentRunQuery(url);
  }

  public buildAgentRunSnapshotOptions(activeSessionId: string | null, query: RuntimeRecord): RuntimeRecord {
    return this.projectionSupport.buildAgentRunSnapshotOptions(activeSessionId, query);
  }

  public readAgentRunStatuses(url: URL): string | string[] | undefined {
    return this.projectionSupport.readAgentRunStatuses(url);
  }

  public buildUnavailableAgentGatewaySnapshot(generatedAt: string, input: RuntimeRecord): RuntimeRecord {
    return this.projectionSupport.buildUnavailableAgentGatewaySnapshot(generatedAt, input);
  }

  public attachLlmRuntimeTelemetry(snapshot: RuntimeRecord): RuntimeRecord {
    return this.projectionSupport.attachLlmRuntimeTelemetry(snapshot);
  }

  public async buildProviderCockpitProjection(url: URL): Promise<RuntimeRecord> {
    return this.projectionSupport.buildProviderCockpitProjection(url);
  }

  public async buildProviderModelCatalogProjection(url: URL): Promise<RuntimeRecord> {
    return this.projectionSupport.buildProviderModelCatalogProjection(url);
  }

  public async buildProviderActivationProjection(url: URL): Promise<RuntimeRecord> {
    return this.projectionSupport.buildProviderActivationProjection(url);
  }

  public async buildZavorthControlContractAdapterProjection(
    url: URL,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<RuntimeRecord | null> {
    return this.projectionSupport.buildZavorthControlContractAdapterProjection(url, deps);
  }

  public async buildProviderSelectionProjection(url: URL): Promise<RuntimeRecord> {
    return this.projectionSupport.buildProviderSelectionProjection(url);
  }

  public async buildProviderPreferenceProjection(): Promise<RuntimeRecord> {
    return this.projectionSupport.buildProviderPreferenceProjection();
  }

  public buildVisualReceiptsProjection(url: URL): RuntimeRecord {
    return this.projectionSupport.buildVisualReceiptsProjection(url);
  }

  public buildSensitiveActionFlowUxProjection(url: URL): RuntimeRecord {
    return this.projectionSupport.buildSensitiveActionFlowUxProjection(url);
  }

  public buildActiveMissionUxProjection(input: {
    runtimeSnapshot: RuntimeRecord;
    sensitiveActionFlowUx: RuntimeRecord;
    visualReceipts: RuntimeRecord;
    providerSelectionUx: RuntimeRecord;
    providerPreference: RuntimeRecord;
  }): RuntimeRecord {
    return this.projectionSupport.buildActiveMissionUxProjection(input);
  }

  public buildApprovalActionCardsUxProjection(input: {
    runtimeSnapshot: RuntimeRecord;
    sensitiveActionFlowUx: RuntimeRecord;
    visualReceipts: RuntimeRecord;
    activeMissionUx: RuntimeRecord;
  }): RuntimeRecord {
    return this.projectionSupport.buildApprovalActionCardsUxProjection(input);
  }

  public attachProviderCockpit(snapshot: RuntimeRecord, providerCockpit: RuntimeRecord): RuntimeRecord {
    return this.projectionSupport.attachProviderCockpit(snapshot, providerCockpit);
  }

  public attachProviderSelection(snapshot: RuntimeRecord, providerSelectionUx: RuntimeRecord): RuntimeRecord {
    return this.projectionSupport.attachProviderSelection(snapshot, providerSelectionUx);
  }

  public attachProviderPreference(snapshot: RuntimeRecord, providerPreference: RuntimeRecord): RuntimeRecord {
    return this.projectionSupport.attachProviderPreference(snapshot, providerPreference);
  }

  public attachVisualReceipts(snapshot: RuntimeRecord, visualReceipts: RuntimeRecord): RuntimeRecord {
    return this.projectionSupport.attachVisualReceipts(snapshot, visualReceipts);
  }

  public attachSensitiveActionFlowUx(snapshot: RuntimeRecord, sensitiveActionFlowUx: RuntimeRecord): RuntimeRecord {
    return this.projectionSupport.attachSensitiveActionFlowUx(snapshot, sensitiveActionFlowUx);
  }

  public attachActiveMissionUx(snapshot: RuntimeRecord, activeMissionUx: RuntimeRecord): RuntimeRecord {
    return this.projectionSupport.attachActiveMissionUx(snapshot, activeMissionUx);
  }

  public attachApprovalActionCardsUx(snapshot: RuntimeRecord, approvalActionCardsUx: RuntimeRecord): RuntimeRecord {
    return this.projectionSupport.attachApprovalActionCardsUx(snapshot, approvalActionCardsUx);
  }

  public attachZavorthControlContractAdapter(
    snapshot: RuntimeRecord,
    contractAdapter: RuntimeRecord | null,
  ): RuntimeRecord {
    return this.projectionSupport.attachZavorthControlContractAdapter(snapshot, contractAdapter);
  }

  public async handleZavorthControlActionRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<void> {
    return this.interactionSupport.handleZavorthControlActionRequest(req, res, deps);
  }

  public async handleZavorthControlChatRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<void> {
    return this.interactionSupport.handleZavorthControlChatRequest(req, res, deps);
  }

  public async handleZavorthControlSideChatRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<void> {
    return this.interactionSupport.handleZavorthControlSideChatRequest(req, res, deps);
  }

  public async handleZavorthControlSteerChatRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<void> {
    return this.interactionSupport.handleZavorthControlSteerChatRequest(req, res, deps);
  }

  public isProviderLiveProbeRequested(url: URL): boolean {
    return this.persistenceSupport.isProviderLiveProbeRequested(url);
  }

  public readBooleanParam(url: URL, name: string): boolean {
    return this.persistenceSupport.readBooleanParam(url, name);
  }

  public resolveMetadataRecord(primary: unknown, fallback: unknown): RuntimeRecord | null {
    return this.persistenceSupport.resolveMetadataRecord(primary, fallback);
  }

  public resolveExperienceProfileMetadata(primary: unknown, fallback: unknown): RuntimeRecord | string | null {
    return this.persistenceSupport.resolveExperienceProfileMetadata(primary, fallback);
  }

  public isRecord(value: unknown): value is RuntimeRecord {
    return this.persistenceSupport.isRecord(value);
  }

  public buildSessionToolsGatewaySnapshot(canonicalState: RuntimeRecord): RuntimeRecord {
    return this.persistenceSupport.buildSessionToolsGatewaySnapshot(canonicalState);
  }

  public buildCurrentModelProfile(snapshot: RuntimeRecord): RuntimeRecord {
    return this.persistenceSupport.buildCurrentModelProfile(snapshot);
  }

  public isKnownModelProfile(profile: RuntimeRecord | null | undefined): boolean {
    return this.persistenceSupport.isKnownModelProfile(profile);
  }

  public normalizeProviderName(provider: string): string {
    return this.persistenceSupport.normalizeProviderName(provider);
  }

  public formatProviderLabel(provider: string): string {
    return this.persistenceSupport.formatProviderLabel(provider);
  }

  public resolveConfiguredModel(provider: string): string {
    return this.persistenceSupport.resolveConfiguredModel(provider);
  }

  public async handleStateRequest(
    res: http.ServerResponse,
    url: URL,
    deps: WebAppRuntimeRouteDeps,
    helpers: WebAppRuntimeStateRouteHelpers,
  ): Promise<void> {
    return this.persistenceSupport.handleStateRequest(res, url, deps, helpers);
  }

  public buildCanonicalStateResponse(canonicalState: RuntimeRecord, extra: RuntimeRecord = {}): RuntimeRecord {
    return this.persistenceSupport.buildCanonicalStateResponse(canonicalState, extra);
  }

  public readSensitiveActionDecision(value: string | null): ZavorthSensitiveActionFlowDecision {
    return this.persistenceSupport.readSensitiveActionDecision(value);
  }

  public readZavorthControlMemoryFacts(url: URL): RuntimeRecord {
    return this.persistenceSupport.readZavorthControlMemoryFacts(url);
  }

  public applyZavorthControlMemoryAction(url: URL, body: RuntimeRecord): RuntimeRecord {
    return this.persistenceSupport.applyZavorthControlMemoryAction(url, body);
  }

  public readZavorthControlMemoryStore(): { facts: RuntimeRecord[] } {
    return this.persistenceSupport.readZavorthControlMemoryStore();
  }

  public writeZavorthControlMemoryStore(state: { facts: RuntimeRecord[] }): void {
    return this.persistenceSupport.writeZavorthControlMemoryStore(state);
  }

  public zavorthControlMemoryStorePath(): string {
    return this.persistenceSupport.zavorthControlMemoryStorePath();
  }
}

export function asRecord(value: unknown): RuntimeRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RuntimeRecord) : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeExternalAgentAdapter(value: unknown): ZavorthExternalAgentAdapterKind | null {
  const adapter = text(value);
  return EXTERNAL_AGENT_ADAPTERS.has(adapter as ZavorthExternalAgentAdapterKind)
    ? (adapter as ZavorthExternalAgentAdapterKind)
    : null;
}

export function normalizeExternalAgentPromptMode(value: unknown): 'stdin' | 'arg' | 'json' | null {
  const promptMode = text(value);
  return EXTERNAL_AGENT_PROMPT_MODES.has(promptMode) ? (promptMode as 'stdin' | 'arg' | 'json') : null;
}

export function normalizeExternalAgentIsolation(value: unknown): ZavorthExternalAgentIsolationKind | 'local' | null {
  const isolation = text(value);
  return EXTERNAL_AGENT_ISOLATION_KINDS.has(isolation as ZavorthExternalAgentIsolationKind | 'local')
    ? (isolation as ZavorthExternalAgentIsolationKind | 'local')
    : null;
}

export function normalizeExternalAgentNetwork(value: unknown): ZavorthExternalAgentNetworkMode | null {
  const network = text(value);
  return EXTERNAL_AGENT_NETWORK_MODES.has(network as ZavorthExternalAgentNetworkMode)
    ? (network as ZavorthExternalAgentNetworkMode)
    : null;
}

export function isExternalAgentApiApprovalRequested(body: RuntimeRecord | null | undefined): boolean {
  return body?.approved === true || body?.approvalGranted === true;
}

export function isExternalAgentApiApprovalAccepted(
  req: http.IncomingMessage,
  body: RuntimeRecord | null | undefined,
): boolean {
  if (!isExternalAgentApiApprovalRequested(body)) return false;
  const expected = text(
    process.env.ZAVORTH_EXTERNAL_AGENT_API_APPROVAL_TOKEN || process.env.ZAVORTH_ZAVORTH_CONTROL_OPERATOR_TOKEN,
  );
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
  } catch (error: unknown) {
    logger.warn('[Web App Runtime State] operation failed', error);
    return false;
  }
}
