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
import { ZavorthVisualReceiptUxService } from '../../../../services/ZavorthVisualReceiptUxService.js';
import { ZavorthControlContractAdapterService } from '../../../../services/ZavorthControlContractAdapterService.js';
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

export type WebAppRuntimeStateRouteHelpers = {
  buildSessionContext: (sessionId: string) => WebSessionContext;
  isFullDetailRequested: (url: URL) => boolean;
  previewGatewayMemoryRecall: (input: any) => Promise<any>;
  listGatewayMemorySources: (input: any) => Promise<any>;
  buildRecallQueryFromSnapshot: (snapshot: RuntimeRecord | null | undefined) => string;
  buildLightweightStateResponse: (state: RuntimeRecord) => RuntimeRecord;
  buildProductMode: () => RuntimeRecord | null;
  buildUiSurfaceHints: (productMode: RuntimeRecord | null, input: UiSurfaceHintsInput) => RuntimeRecord | null;
  buildCanonicalStatePayload: (sessionId: string, options: RuntimeRecord) => Promise<RuntimeRecord>;
  isCanonicalSessionPlaneRoute: (pathname: string) => boolean;
};

import type { WebAppRuntimeStateRouteService } from './WebAppRuntimeStateRouteService.js';

export class WebAppRuntimeProjectionSupport {
  public constructor(private readonly owner: WebAppRuntimeStateRouteService) {}

  public buildAgentRunQuery(url: URL): RuntimeRecord {
    const activeRunId = String(url.searchParams.get('runId') || '').trim() || null;
    const activeTraceId = String(url.searchParams.get('traceId') || '').trim() || null;
    const runStatus = this.owner.readAgentRunStatuses(url);
    const limitValue = Number(url.searchParams.get('limit'));

    return {
      activeRunId,
      activeTraceId,
      runStatus,
      runLimit: Number.isFinite(limitValue) && limitValue > 0 ? Math.floor(limitValue) : undefined,
    };
  }

  public buildAgentRunSnapshotOptions(activeSessionId: string | null, query: RuntimeRecord): RuntimeRecord {
    const hasDirectRunQuery = Boolean(query.activeRunId || query.activeTraceId || query.runStatus);

    return {
      ...query,
      activeSessionId: hasDirectRunQuery ? null : activeSessionId,
    };
  }

  public readAgentRunStatuses(url: URL): string | string[] | undefined {
    const values = [...url.searchParams.getAll('status'), ...url.searchParams.getAll('runStatus')]
      .flatMap((value) => String(value || '').split(','))
      .map((value) =>
        value
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/g, '_'),
      )
      .filter((value) => AGENT_RUN_STATUS_VALUES.has(value));
    const uniqueValues = Array.from(new Set(values));
    if (uniqueValues.length === 0) {
      return undefined;
    }
    return uniqueValues.length === 1 ? uniqueValues[0] : uniqueValues;
  }

  public buildUnavailableAgentGatewaySnapshot(generatedAt: string, input: RuntimeRecord): RuntimeRecord {
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
        notes: ['ZavorthControl loaded, but the Zavorth Agent Gateway has not been attached to this process yet.'],
      },
    };
  }

  public attachLlmRuntimeTelemetry(snapshot: RuntimeRecord): RuntimeRecord {
    const runObservatory = snapshot.runObservatory && typeof snapshot.runObservatory === 'object' ? { ...snapshot.runObservatory } : {};
    return {
      ...snapshot,
      runObservatory: {
        ...runObservatory,
        llmTelemetry: defaultLlmRuntimeTelemetryService.buildSnapshot({ recentLimit: 10 }),
      },
    };
  }

  public async buildProviderCockpitProjection(url: URL): Promise<RuntimeRecord> {
    const service = new ZavorthControlProviderCockpitService();
    return service.buildProjection({
      includeAdvanced: this.owner.readBooleanParam(url, 'advanced'),
      providerId: String(url.searchParams.get('provider') || url.searchParams.get('providerId') || '').trim() || null,
      selectedProviderId: String(url.searchParams.get('selectedProvider') || url.searchParams.get('selectedProviderId') || '').trim() || null,
      live: false,
      allowAllLive: false,
    }) as Promise<RuntimeRecord>;
  }

  public async buildProviderModelCatalogProjection(url: URL): Promise<RuntimeRecord> {
    const service = new ZavorthProviderModelCatalogService();
    return service.buildSnapshot({
      includeAdvanced: this.owner.readBooleanParam(url, 'advanced'),
      providerId: String(url.searchParams.get('provider') || url.searchParams.get('providerId') || '').trim() || null,
      selectedProviderId: String(url.searchParams.get('selectedProvider') || url.searchParams.get('selectedProviderId') || '').trim() || null,
      live: false,
      allowAllLive: false,
    }) as Promise<RuntimeRecord>;
  }

  public async buildProviderActivationProjection(url: URL): Promise<RuntimeRecord> {
    const service = new ZavorthProviderActivationService();
    return service.buildSnapshot({
      includeAdvanced: this.owner.readBooleanParam(url, 'advanced'),
      providerId: String(url.searchParams.get('provider') || url.searchParams.get('providerId') || '').trim() || null,
      liveConfigured: false,
      allowAllLive: false,
    }) as Promise<RuntimeRecord>;
  }

  public async buildZavorthControlContractAdapterProjection(url: URL, deps: WebAppRuntimeRouteDeps): Promise<RuntimeRecord | null> {
    if (!deps.publicApi) {
      return null;
    }
    const service = new ZavorthControlContractAdapterService(deps.publicApi);
    return service.buildSnapshot({
      includeAdvanced: this.owner.readBooleanParam(url, 'advanced'),
      providerId: String(url.searchParams.get('provider') || url.searchParams.get('providerId') || '').trim() || null,
      selectedProviderId: String(url.searchParams.get('selectedProvider') || url.searchParams.get('selectedProviderId') || '').trim() || null,
      approvalStatus: 'pending',
      missionRequest: String(url.searchParams.get('request') || url.searchParams.get('q') || '').trim() || null,
      missionTemplateId: String(url.searchParams.get('templateId') || '').trim() || null,
    }) as Promise<RuntimeRecord>;
  }

  public async buildProviderSelectionProjection(url: URL): Promise<RuntimeRecord> {
    const service = new ZavorthProviderSelectionUxService();
    return service.buildSnapshot({
      includeAdvanced: this.owner.readBooleanParam(url, 'advanced'),
      target: String(url.searchParams.get('provider') || url.searchParams.get('providerId') || '').trim() || null,
      intent: String(url.searchParams.get('providerIntent') || url.searchParams.get('intent') || '').trim() || null,
      requireLiveEvidence: this.owner.readBooleanParam(url, 'requireLive') || this.owner.readBooleanParam(url, 'liveProof'),
      live: false,
    }) as Promise<RuntimeRecord>;
  }

  public async buildProviderPreferenceProjection(): Promise<RuntimeRecord> {
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
        zavorthControlExecutionAuthority: false,
      },
      commands: {
        inspect: 'zavorth providers preference --json',
        rollback: preference?.receiptId ? `zavorth providers rollback ${preference.receiptId} --confirm` : null,
      },
    };
  }

  public buildVisualReceiptsProjection(url: URL): RuntimeRecord {
    const service = new ZavorthVisualReceiptUxService();
    return service.buildSnapshot({
      includeAdvanced: this.owner.readBooleanParam(url, 'advanced'),
    }) as RuntimeRecord;
  }

  public buildSensitiveActionFlowUxProjection(url: URL): RuntimeRecord {
    const service = new ZavorthSensitiveActionFlowUxService();
    return service.buildSnapshot({
      request: String(url.searchParams.get('request') || url.searchParams.get('q') || 'Review this workspace in read-only mode.').trim(),
      decision: this.owner.readSensitiveActionDecision(url.searchParams.get('decision')),
      approvalId: String(url.searchParams.get('approvalId') || url.searchParams.get('approval-id') || '').trim() || null,
      sandboxReady: this.owner.readBooleanParam(url, 'sandboxReady') || this.owner.readBooleanParam(url, 'sandbox-ready'),
      source: 'web',
    }) as RuntimeRecord;
  }

  public buildActiveMissionUxProjection(input: { runtimeSnapshot: RuntimeRecord; sensitiveActionFlowUx: RuntimeRecord; visualReceipts: RuntimeRecord; providerSelectionUx: RuntimeRecord; providerPreference: RuntimeRecord }): RuntimeRecord {
    const service = new ZavorthActiveMissionUxService();
    return service.buildSnapshot(input) as RuntimeRecord;
  }

  public buildApprovalActionCardsUxProjection(input: { runtimeSnapshot: RuntimeRecord; sensitiveActionFlowUx: RuntimeRecord; visualReceipts: RuntimeRecord; activeMissionUx: RuntimeRecord }): RuntimeRecord {
    const service = new ZavorthApprovalActionCardsUxService();
    const approvals = Array.isArray(input.runtimeSnapshot?.approvals) ? (input.runtimeSnapshot.approvals as RuntimeRecord[]) : [];
    return service.buildSnapshot({
      approvals,
      sensitiveActionFlowUx: input.sensitiveActionFlowUx,
      visualReceipts: input.visualReceipts,
      activeMissionUx: input.activeMissionUx,
    }) as RuntimeRecord;
  }

  public attachProviderCockpit(snapshot: RuntimeRecord, providerCockpit: RuntimeRecord): RuntimeRecord {
    const activeRun = this.owner.isRecord(snapshot.activeRun) ? snapshot.activeRun : null;
    const activeRunMetadata = this.owner.isRecord(activeRun?.metadata) ? activeRun.metadata : null;
    const hasRunProviderCockpit = this.owner.isRecord(activeRunMetadata?.providerCockpit);
    return {
      ...snapshot,
      providerCockpit,
      activeRun:
        activeRun && !hasRunProviderCockpit
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

  public attachProviderSelection(snapshot: RuntimeRecord, providerSelectionUx: RuntimeRecord): RuntimeRecord {
    return {
      ...snapshot,
      providerSelectionUx,
    };
  }

  public attachProviderPreference(snapshot: RuntimeRecord, providerPreference: RuntimeRecord): RuntimeRecord {
    return {
      ...snapshot,
      providerPreference,
    };
  }

  public attachVisualReceipts(snapshot: RuntimeRecord, visualReceipts: RuntimeRecord): RuntimeRecord {
    return {
      ...snapshot,
      visualReceipts,
    };
  }

  public attachSensitiveActionFlowUx(snapshot: RuntimeRecord, sensitiveActionFlowUx: RuntimeRecord): RuntimeRecord {
    return {
      ...snapshot,
      sensitiveActionFlowUx,
    };
  }

  public attachActiveMissionUx(snapshot: RuntimeRecord, activeMissionUx: RuntimeRecord): RuntimeRecord {
    return {
      ...snapshot,
      activeMissionUx,
    };
  }

  public attachApprovalActionCardsUx(snapshot: RuntimeRecord, approvalActionCardsUx: RuntimeRecord): RuntimeRecord {
    return {
      ...snapshot,
      approvalActionCardsUx,
    };
  }

  public attachZavorthControlContractAdapter(snapshot: RuntimeRecord, contractAdapter: RuntimeRecord | null): RuntimeRecord {
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
        ...(this.owner.isRecord(snapshot.runtime) ? snapshot.runtime : {}),
        contractAdapter: {
          contractVersion: contractAdapter.contractVersion,
          source: contractAdapter.source,
          consistency: contractAdapter.consistency,
          safety: contractAdapter.safety,
        },
      },
    };
  }
}
