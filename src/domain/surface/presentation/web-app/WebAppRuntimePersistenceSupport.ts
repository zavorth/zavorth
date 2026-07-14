import * as http from 'http';
import fs from 'fs';
import path from 'path';
import { timingSafeEqual } from 'node:crypto';
import { GATEWAY_SESSION_ROUTE_PATHS } from '../../../../contracts/GatewayContract.js';
import type { HybridMemoryRecallInput, HybridMemoryRecallResult, HybridMemorySourcesResult } from '../../../../contracts/HybridMemoryContract.js';
import { config } from '../../../../config/index.js';

import type { WebAppRuntimeRouteDeps } from './WebAppRuntimeRouteService.js';
import { defaultLlmRuntimeTelemetryService } from '../../../../services/llm/LlmRuntimeTelemetryService.js';
import { ZavorthActiveMissionUxService } from '../../../../services/ZavorthActiveMissionUxService.js';
import { ZavorthApprovalActionCardsUxService } from '../../../../services/ZavorthApprovalActionCardsUxService.js';
import { ZavorthControlProviderCockpitService } from '../../../../services/ZavorthControlProviderCockpitService.js';
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
import { ZavorthControlContractAdapterService } from '../../../../services/ZavorthControlContractAdapterService.js';
import { ZavorthDailyUseGuiCertificationService } from '../../../../services/ZavorthDailyUseGuiCertificationService.js';
import type { ZavorthSensitiveActionFlowDecision } from '../../../../contracts/ZavorthSensitiveActionFlowContract.js';
import { logger } from '../../../../logger';
import type { ZavorthExternalAgentAdapterKind, ZavorthExternalAgentIsolationKind, ZavorthExternalAgentNetworkMode } from '../../../../contracts/ZavorthExternalAgentGatewayContract.js';
type RuntimeRecord = Record<string, unknown>;

function asRecord(value: unknown): RuntimeRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RuntimeRecord) : null;
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}
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

const AGENT_RUN_STATUS_VALUES = new Set(['idle', 'queued', 'thinking', 'running', 'waiting_approval', 'completed', 'failed', 'cancelled']);

const EXTERNAL_AGENT_ADAPTERS = new Set<ZavorthExternalAgentAdapterKind>(['cli', 'http', 'acp', 'mcp']);
const EXTERNAL_AGENT_PROMPT_MODES = new Set(['stdin', 'arg', 'json']);
const EXTERNAL_AGENT_ISOLATION_KINDS = new Set<ZavorthExternalAgentIsolationKind | 'local'>(['local', 'local-supervised', 'wsl', 'docker']);
const EXTERNAL_AGENT_NETWORK_MODES = new Set<ZavorthExternalAgentNetworkMode>(['disabled', 'local-only', 'profile']);

export type WebAppRuntimeStateRouteHelpers = {
  buildSessionContext: (sessionId: string) => WebSessionContext;
  isFullDetailRequested: (url: URL) => boolean;
  previewGatewayMemoryRecall: (input: HybridMemoryRecallInput) => Promise<HybridMemoryRecallResult>;
  listGatewayMemorySources: (input: Pick<HybridMemoryRecallInput, 'sessionId' | 'chatId' | 'userId' | 'platform' | 'workspaceHint'>) => Promise<HybridMemorySourcesResult>;
  buildRecallQueryFromSnapshot: (snapshot: RuntimeRecord | null | undefined) => string;
  buildLightweightStateResponse: (state: RuntimeRecord) => RuntimeRecord;
  buildProductMode: () => RuntimeRecord | null;
  buildUiSurfaceHints: (productMode: RuntimeRecord | null, input: UiSurfaceHintsInput) => RuntimeRecord | null;
  buildCanonicalStatePayload: (sessionId: string, options: RuntimeRecord) => Promise<RuntimeRecord>;
  isCanonicalSessionPlaneRoute: (pathname: string) => boolean;
};

import type { WebAppRuntimeStateRouteService } from './WebAppRuntimeStateRouteService.js';

export class WebAppRuntimePersistenceSupport {
  public constructor(private readonly owner: WebAppRuntimeStateRouteService) {}

  public isProviderLiveProbeRequested(url: URL): boolean {
    return this.owner.readBooleanParam(url, 'live') || this.owner.readBooleanParam(url, 'probeLive') || this.owner.readBooleanParam(url, 'allowAllLive');
  }

  public readBooleanParam(url: URL, name: string): boolean {
    const raw = String(url.searchParams.get(name) || '')
      .trim()
      .toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
  }

  public resolveMetadataRecord(primary: unknown, fallback: unknown): RuntimeRecord | null {
    if (this.owner.isRecord(primary)) return primary;
    if (this.owner.isRecord(fallback)) return fallback;
    return null;
  }

  public resolveExperienceProfileMetadata(primary: unknown, fallback: unknown): RuntimeRecord | string | null {
    if (this.owner.isRecord(primary)) return primary;
    if (typeof primary === 'string') {
      return primary.trim() || null;
    }
    if (this.owner.isRecord(fallback)) return fallback;
    if (typeof fallback === 'string') {
      return fallback.trim() || null;
    }
    return null;
  }

  public isRecord(value: unknown): value is RuntimeRecord {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  public buildSessionToolsGatewaySnapshot(canonicalState: RuntimeRecord): RuntimeRecord {
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
      sessionsSummary?.total ?? gatewaySessionsSummary?.total ?? sessions?.total ?? (sessionEntries.length > 0 ? sessionEntries.length : Array.isArray(canonicalState.sessions) ? canonicalState.sessions.length : 0),
    );
    const snapshot = asRecord(canonicalState.snapshot);

    return {
      generatedAt: text(snapshot?.generatedAt) || new Date().toISOString(),
      summary: {
        sessionTargets,
      },
      narrative: {
        headline: sessionTargets > 0 ? 'Gateway resumido para session tools.' : 'Gateway resumido sem sessoes vinculadas.',
        operatorSummary: `${sessionTargets} alvo(s) de sessao disponivel(is) para continuidade rapida.`,
      },
    };
  }

  public buildCurrentModelProfile(snapshot: RuntimeRecord): RuntimeRecord {
    const activeRunProfile = asRecord(asRecord(snapshot.activeRun)?.modelProfile);
    const latestRun = Array.isArray(snapshot?.runs) ? asRecord(snapshot.runs.find((run) => Boolean(asRecord(asRecord(run)?.modelProfile)))) : null;
    const latestRunProfile = asRecord(latestRun?.modelProfile);
    const profile = this.owner.isKnownModelProfile(activeRunProfile) ? activeRunProfile : this.owner.isKnownModelProfile(latestRunProfile) ? latestRunProfile : null;
    const configuredProvider = this.owner.normalizeProviderName(config.llmProvider || '');
    const configuredModel = this.owner.resolveConfiguredModel(configuredProvider);

    return {
      providerLabel: String(profile?.providerLabel || profile?.provider || this.owner.formatProviderLabel(configuredProvider)).trim(),
      modelLabel: String(profile?.modelLabel || profile?.model || configuredModel || 'modelo atual not provided').trim(),
      routingPolicy: String(profile?.routingPolicy || (configuredProvider === 'aigateway' ? 'gateway' : 'direct')).trim(),
      fallbackModelLabel: String(profile?.fallbackModelLabel || '').trim() || undefined,
      supportsTools: profile?.supportsTools ?? true,
      supportsVision: profile?.supportsVision,
      supportsStreaming: profile?.supportsStreaming ?? true,
    };
  }

  public isKnownModelProfile(profile: RuntimeRecord | null | undefined): boolean {
    const modelLabel = String(profile?.modelLabel || profile?.model || '')
      .trim()
      .toLowerCase();
    return Boolean(modelLabel && !['modelo atual', 'modelo not provided', 'modelo atual not provided'].includes(modelLabel));
  }

  public normalizeProviderName(provider: string): string {
    return String(provider || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
  }

  public formatProviderLabel(provider: string): string {
    switch (this.owner.normalizeProviderName(provider)) {
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
        return provider || 'Provider not provided';
    }
  }

  public resolveConfiguredModel(provider: string): string {
    switch (this.owner.normalizeProviderName(provider)) {
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

  public async handleStateRequest(res: http.ServerResponse, url: URL, deps: WebAppRuntimeRouteDeps, helpers: WebAppRuntimeStateRouteHelpers): Promise<void> {
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
    const gateway =
      gatewayRuntimeSnapshot?.gateway ||
      (runtimeGatewayAny
        ? fullDetail
          ? runtimeGatewayAny.buildSnapshot(sessionContext)
          : typeof runtimeGatewayAny.buildShellSnapshot === 'function'
            ? runtimeGatewayAny.buildShellSnapshot(sessionContext)
            : runtimeGatewayAny.buildSnapshot(sessionContext)
        : null);
    const snapshot = await deps.realtime.getResolvedSnapshot(sessionId);
    const session =
      deps.runtimeGatewaySessionTools?.readHistoryFast({
        userId: sessionContext.userId,
        sessionId: sessionContext.sessionId,
        chatId: sessionContext.chatId,
      }) || null;
    const memoryPlane = gateway?.memoryPlane || (await deps.buildMemoryPlaneSnapshot(sessionId));
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
        modeEscalation: deps.modeEscalation?.buildSnapshot(String(url.searchParams.get('sessionId') || '').trim() || 'state-bootstrap') || null,
        uiSurfaceHints: helpers.buildUiSurfaceHints(productMode, {
          localControlEntry: '/zavorthControl',
          localControlReady: true,
          telegramReady: true,
          discordReady: false,
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

  public buildCanonicalStateResponse(canonicalState: RuntimeRecord, extra: RuntimeRecord = {}): RuntimeRecord {
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

  public readSensitiveActionDecision(value: string | null): ZavorthSensitiveActionFlowDecision {
    const normalized = String(value || '').trim();
    if (normalized === 'approve' || normalized === 'deny') return normalized;
    return 'none';
  }

  public readZavorthControlMemoryFacts(url: URL): RuntimeRecord {
    const state = this.owner.readZavorthControlMemoryStore();
    const sessionId = String(url.searchParams.get('sessionId') || '').trim();
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 24) || 24));
    const facts = state.facts
      .filter((fact) => !sessionId || !fact.sessionId || fact.sessionId === sessionId)
      .slice(-limit)
      .reverse();
    return {
      ok: true,
      contractVersion: '2026-05-30.zavorthControl.memory-facts.v1',
      query: { sessionId, limit },
      facts,
      stats: {
        total: facts.length,
        persisted: state.facts.length,
      },
    };
  }

  public applyZavorthControlMemoryAction(url: URL, body: RuntimeRecord): RuntimeRecord {
    const action = String(body.action || '')
      .trim()
      .toLowerCase();
    const id = String(body.id || body.memoryId || body.key || '').trim();
    if (!['forget', 'promote', 'correct'].includes(action)) {
      return {
        ok: false,
        error: 'unsupported memory action',
        allowedActions: ['forget', 'promote', 'correct'],
      };
    }
    if (!id) {
      return {
        ok: false,
        error: 'memory id is required',
      };
    }
    const state = this.owner.readZavorthControlMemoryStore();
    const before = state.facts.length;
    let matched = false;
    if (action === 'forget') {
      state.facts = state.facts.filter((fact) => fact.id !== id && fact.key !== id);
      matched = before !== state.facts.length;
    } else {
      const now = new Date().toISOString();
      state.facts = state.facts.map((fact) => {
        if (fact.id !== id && fact.key !== id) return fact;
        matched = true;
        const metadata = asRecord(fact.metadata) || {};
        if (action === 'promote') {
          return {
            ...fact,
            updatedAt: now,
            metadata: {
              ...metadata,
              promotedAt: now,
              trust: {
                ...(asRecord(metadata.trust) || {}),
                level: 'operator-approved',
                durableTruth: true,
              },
              provenance: metadata.provenance || 'operator-approved',
            },
          };
        }
        const content = text(body.content || body.summary);
        return {
          ...fact,
          content: content || fact.content,
          updatedAt: now,
          metadata: {
            ...metadata,
            correctedAt: now,
            correctionReason: text(body.reason) || 'zavorthControl correction',
            trust: {
              ...(asRecord(metadata.trust) || {}),
              level: 'operator-approved',
              durableTruth: true,
            },
            provenance: metadata.provenance || 'operator-approved',
          },
        };
      });
    }
    this.owner.writeZavorthControlMemoryStore(state);
    const sessionId = String(body.sessionId || url.searchParams.get('sessionId') || '').trim();
    const nextUrl = new URL(url.toString());
    if (sessionId) nextUrl.searchParams.set('sessionId', sessionId);
    return {
      ok: matched,
      action,
      applied: { id },
      memory: this.owner.readZavorthControlMemoryFacts(nextUrl),
    };
  }

  public readZavorthControlMemoryStore(): { facts: RuntimeRecord[] } {
    const filePath = this.owner.zavorthControlMemoryStorePath();
    try {
      if (!fs.existsSync(filePath)) return { facts: [] };
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as RuntimeRecord;
      const facts = Array.isArray(parsed.facts) ? parsed.facts : [];
      return {
        facts: facts
          .map((fact) => asRecord(fact))
          .filter(Boolean)
          .map((fact) => ({
            id: text(fact?.id) || text(fact?.key) || `memory-${Date.now()}`,
            key: text(fact?.key) || text(fact?.id),
            type: text(fact?.type) || 'factual',
            content: text(fact?.content) || text(fact?.summary) || text(fact?.key),
            sessionId: text(fact?.sessionId),
            metadata: asRecord(fact?.metadata) || {},
            createdAt: text(fact?.createdAt) || new Date().toISOString(),
            updatedAt: text(fact?.updatedAt) || text(fact?.createdAt) || new Date().toISOString(),
            expiresAt: text(fact?.expiresAt) || null,
          }))
          .filter((fact) => fact.content),
      };
    } catch (error: unknown) {
      logger.warn('[Web App Runtime State] creation failed', error);
      return { facts: [] };
    }
  }

  public writeZavorthControlMemoryStore(state: { facts: RuntimeRecord[] }): void {
    const filePath = this.owner.zavorthControlMemoryStorePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
      filePath,
      JSON.stringify(
        {
          facts: state.facts,
          updatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      'utf8',
    );
  }

  public zavorthControlMemoryStorePath(): string {
    return path.resolve(config.projectRoot || process.cwd(), 'data', 'runtime', 'zavorth-control-memory-facts.json');
  }
}
