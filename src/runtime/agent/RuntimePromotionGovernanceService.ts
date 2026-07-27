import type {
  StrongCapabilityId,
  StrongCapabilityLoopSnapshot,
} from './CapabilityLoopGovernanceService.js';
import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';

export type RuntimePromotionItemId =
  | 'session-v2-pty'
  | 'session-recorder'
  | 'replay-dvr'
  | 'swarm-orchestrator'
  | 'memory-compressor'
  | 'local-voice'
  | 'automatic-browser-tool';

export type RuntimePromotionDecision = 'promote-product-adapter' | 'keep-experimental';

export type RuntimePromotionPublicStatus = 'official' | 'experimental';

export type RuntimePromotionReadiness = 'ready' | 'status-only' | 'blocked-by-missing-gate';

export type RuntimePromotionReceipt = {
  id: string;
  kind: 'decision' | 'gate' | 'claim-control' | 'adapter';
  detail: string;
};

export type RuntimePromotionEntry = {
  itemId: RuntimePromotionItemId;
  label: string;
  decision: RuntimePromotionDecision;
  publicStatus: RuntimePromotionPublicStatus;
  readiness: RuntimePromotionReadiness;
  productAdapterId: StrongCapabilityId | null;
  experimentalComponent: string;
  featureFlag: string | null;
  agentLoopIntegrated: boolean;
  policyPresent: boolean;
  controlStatusPresent: boolean;
  testsPresent: boolean;
  receiptsPresent: boolean;
  mockDependent: boolean;
  publicClaimAllowed: boolean;
  reason: string;
  gates: string[];
  receipts: RuntimePromotionReceipt[];
};

export type RuntimePromotionGovernanceSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  source: 'RuntimePromotionGovernanceService';
  summary: string;
  officialItemIds: RuntimePromotionItemId[];
  experimentalItemIds: RuntimePromotionItemId[];
  prohibitedPublicClaims: Array<{
    itemId: RuntimePromotionItemId;
    claim: string;
    reason: string;
  }>;
  entries: RuntimePromotionEntry[];
};

export type RuntimePromotionGovernanceInput = {
  generatedAt?: string | null;
  activeRun?: UniversalAgentRun | null;
  capabilityLoopGovernance?: StrongCapabilityLoopSnapshot | null;
  overrides?: Partial<Record<RuntimePromotionItemId, Partial<RuntimePromotionEntry>>> | null;
};

type RuntimePromotionCatalogEntry = {
  itemId: RuntimePromotionItemId;
  label: string;
  experimentalComponent: string;
  productAdapterId: StrongCapabilityId | null;
  featureFlag: string | null;
  gates: string[];
  productReason: string;
  experimentalReason: string;
  allowPublicClaimWhenOfficial?: boolean;
};

const PROMOTION_CATALOG: RuntimePromotionCatalogEntry[] = [
  {
    itemId: 'session-v2-pty',
    label: 'PTY / Session V2',
    experimentalComponent: 'runtime/sessions/v2/PtyWebSocketServer + ProjectPtySessionFactory',
    productAdapterId: 'session.ownership',
    featureFlag: 'ZAVORTH_ENABLE_SESSION_V2_PTY',
    gates: [
      'official-pty-supervisor',
      'workspace-boundary-policy',
      'operator-status-surface',
      'non-local-process-lifecycle-tests',
    ],
    productReason: 'Session ownership is already official no agent loop; PTY V2 still needs supervisor/provisioning.',
    experimentalReason: 'PTY/session v2 remains behind a feature flag until official supervisor and status are available.',
  },
  {
    itemId: 'session-recorder',
    label: 'SessionRecorder',
    experimentalComponent: 'runtime/sessions/v2/SessionRecorder',
    productAdapterId: null,
    featureFlag: 'ZAVORTH_ENABLE_SESSION_RECORDER',
    gates: [
      'retention-policy',
      'redaction-policy',
      'replay-index',
      'operator-export-status',
    ],
    productReason: 'without adapter oficial no loop ainda.',
    experimentalReason: 'Session recording requires retention and redaction before product release.',
  },
  {
    itemId: 'replay-dvr',
    label: 'Replay / DVR ZavorthControl',
    experimentalComponent: 'SessionReplayService + zavorthControl replay views',
    productAdapterId: null,
    featureFlag: 'ZAVORTH_ENABLE_SESSION_DVR',
    gates: [
      'session-recorder-product',
      'artifact-retention-policy',
      'zavorthControl-replay-controls',
      'privacy-review',
    ],
    productReason: 'Without official recorder, DVR cannot be sold as ready.',
    experimentalReason: 'Replay/DVR depende do SessionRecorder governado.',
  },
  {
    itemId: 'swarm-orchestrator',
    label: 'SwarmOrchestrator',
    experimentalComponent: 'runtime/sessions/v2/SwarmOrchestrator',
    productAdapterId: 'swarm.escalation',
    featureFlag: 'ZAVORTH_ENABLE_SWARM_V2',
    gates: [
      'canonical-agent-run-adapter',
      'subagent-receipt-store',
      'operator-cancel-resume',
      'non-local-hierarchy-tests',
    ],
    productReason: 'Swarm v2 already tem adapter oficial, batch queue, replay, role library, receipts e surface canonica.',
    experimentalReason: 'O produto oficial e a escalaction governada; o orchestrator V2 still needs cancel/resume/receipts persistentes.',
    allowPublicClaimWhenOfficial: true,
  },
  {
    itemId: 'memory-compressor',
    label: 'InfiniteMemoryCompressor',
    experimentalComponent: 'runtime/sessions/v2/InfiniteMemoryCompressor',
    productAdapterId: 'mnemos.memory',
    featureFlag: 'ZAVORTH_ENABLE_INFINITE_MEMORY_COMPRESSOR',
    gates: [
      'persistent-memory-backend',
      'receipt-linking',
      'retention-budget-policy',
      'recall-quality-evals',
    ],
    productReason: 'Mnemos/cold memory plane is already official; infinite compressor still needs persistent backend.',
    experimentalReason: 'without backend persistente e evals de recall, compressor fica experimental.',
  },
  {
    itemId: 'local-voice',
    label: 'Voice local',
    experimentalComponent: 'voice/LocalVoiceDictation + EchoVoiceService',
    productAdapterId: null,
    featureFlag: 'ZAVORTH_ENABLE_LOCAL_VOICE',
    gates: [
      'local-device-provisioning',
      'privacy-permission-flow',
      'voice-status-surface',
      'audio-e2e-without-local',
    ],
    productReason: 'There is no official local device provisioning yet.',
    experimentalReason: 'Voice local fica atras de provisioning e explicit consent.',
  },
  {
    itemId: 'automatic-browser-tool',
    label: 'AutomaticBrowserTool',
    experimentalComponent: 'mcp/tools/AutomaticBrowserTool',
    productAdapterId: 'watchmode.computer-use',
    featureFlag: 'ZAVORTH_ENABLE_AUTOMATIC_BROWSER_TOOL',
    gates: [
      'browser-doctor',
      'visual-allowlist-policy',
      'operator-status-surface',
      'non-local-browser-e2e',
    ],
    productReason: 'Watch Mode/Computer Use already e o produto governado; automatic browser tool remains experimental.',
    experimentalReason: 'AutomaticBrowserTool needs doctor/provisioning before being announced as ready.',
  },
];

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function entryForCapability(
  snapshot: StrongCapabilityLoopSnapshot | null | undefined,
  capabilityId: StrongCapabilityId | null,
) {
  if (!snapshot || !capabilityId) {
    return null;
  }
  return snapshot.capabilities.find((entry) => entry.capabilityId === capabilityId) || null;
}

export class RuntimePromotionGovernanceService {
  private readonly now: () => Date;

  constructor(runtime: {
    now?: () => Date;
  } = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: RuntimePromotionGovernanceInput = {}): RuntimePromotionGovernanceSnapshot {
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const entries = PROMOTION_CATALOG.map((catalog) => this.buildEntry(catalog, input));
    const officialItemIds = entries
      .filter((entry) => entry.publicStatus === 'official')
      .map((entry) => entry.itemId);
    const experimentalItemIds = entries
      .filter((entry) => entry.publicStatus === 'experimental')
      .map((entry) => entry.itemId);

    return {
      schemaVersion: 1,
      generatedAt,
      source: 'RuntimePromotionGovernanceService',
      summary: `${officialItemIds.length} item(s) com adapter oficial; ${experimentalItemIds.length} item(s) permanecem experimentais.`,
      officialItemIds,
      experimentalItemIds,
      prohibitedPublicClaims: entries
        .filter((entry) => !entry.publicClaimAllowed)
        .map((entry) => ({
          itemId: entry.itemId,
          claim: `${entry.label} is ready/stable`,
          reason: entry.reason,
        })),
      entries,
    };
  }

  public listCatalog(): RuntimePromotionCatalogEntry[] {
    return PROMOTION_CATALOG.map((entry) => ({
      ...entry,
      gates: [...entry.gates],
    }));
  }

  private buildEntry(
    catalog: RuntimePromotionCatalogEntry,
    input: RuntimePromotionGovernanceInput,
  ): RuntimePromotionEntry {
    const adapter = entryForCapability(input.capabilityLoopGovernance, catalog.productAdapterId);
    const hasOfficialAdapter = Boolean(adapter && adapter.status !== 'blocked' && adapter.status !== 'unavailable');
    const decision: RuntimePromotionDecision = hasOfficialAdapter ? 'promote-product-adapter'
      : 'keep-experimental';
    const publicStatus: RuntimePromotionPublicStatus = hasOfficialAdapter ? 'official' : 'experimental';
    const readiness: RuntimePromotionReadiness = hasOfficialAdapter ? 'ready' : 'status-only';
    const reason = hasOfficialAdapter ? catalog.productReason : catalog.experimentalReason;
    const baseEntry: RuntimePromotionEntry = {
      itemId: catalog.itemId,
      label: catalog.label,
      decision,
      publicStatus,
      readiness,
      productAdapterId: catalog.productAdapterId,
      experimentalComponent: catalog.experimentalComponent,
      featureFlag: catalog.featureFlag,
      agentLoopIntegrated: hasOfficialAdapter,
      policyPresent: Boolean(adapter?.policy),
      controlStatusPresent: Boolean(adapter?.controlSurface),
      testsPresent: hasOfficialAdapter,
      receiptsPresent: Boolean(adapter?.receipts.length),
      mockDependent: false,
      publicClaimAllowed: hasOfficialAdapter && catalog.allowPublicClaimWhenOfficial === true,
      reason,
      gates: hasOfficialAdapter ? [] : [...catalog.gates],
      receipts: this.buildReceipts(catalog, {
        decision,
        publicStatus,
        hasOfficialAdapter,
        adapterStatus: adapter?.status || null,
      }),
    };
    const override = input.overrides?.[catalog.itemId];
    return override ? { ...baseEntry, ...override } : baseEntry;
  }

  private buildReceipts(
    catalog: RuntimePromotionCatalogEntry,
    input: {
      decision: RuntimePromotionDecision;
      publicStatus: RuntimePromotionPublicStatus;
      hasOfficialAdapter: boolean;
      adapterStatus: string | null;
    },
  ): RuntimePromotionReceipt[] {
    const receipts: RuntimePromotionReceipt[] = [
      {
        id: `${catalog.itemId}:decision`,
        kind: 'decision',
        detail: input.hasOfficialAdapter ? `Produto oficial via ${catalog.productAdapterId}; componente V2 segue separado.`
          : 'Mantido experimental ate cumprir gates de promotion.',
      },
      {
        id: `${catalog.itemId}:claim-control`,
        kind: 'claim-control',
        detail: input.publicStatus === 'official' && catalog.allowPublicClaimWhenOfficial ? 'Pode ser anunciado como surface oficial, mantendo limites de sandbox, approvals e receipts.'
          : input.publicStatus === 'official'
          ? 'Only the canonical adapter can be announced; V2/experimental component cannot be described as stable.'
          : 'Do not announce as ready/stable in UI, CLI, or public docs.',
      },
    ];
    if (input.hasOfficialAdapter) {
      receipts.push({
        id: `${catalog.itemId}:adapter`,
        kind: 'adapter',
        detail: `Adapter canonical status=${input.adapterStatus || 'unknown'}.`,
      });
    } else {
      receipts.push({
        id: `${catalog.itemId}:gate`,
        kind: 'gate',
        detail: `Gates pending: ${catalog.gates.join(', ')}.`,
      });
    }
    return receipts;
  }
}
