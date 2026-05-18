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
      'non-mock-process-lifecycle-tests',
    ],
    productReason: 'Session ownership ja e oficial no agent loop; PTY V2 ainda precisa de supervisor/provisioning.',
    experimentalReason: 'PTY/session v2 continua atras de feature flag ate ter supervisor e status oficiais.',
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
    productReason: 'Sem adapter oficial no loop ainda.',
    experimentalReason: 'Gravacao de sessao exige retencao/redacao antes de virar produto.',
  },
  {
    itemId: 'replay-dvr',
    label: 'Replay / DVR Dashboard',
    experimentalComponent: 'SessionReplayService + dashboard replay views',
    productAdapterId: null,
    featureFlag: 'ZAVORTH_ENABLE_SESSION_DVR',
    gates: [
      'session-recorder-product',
      'artifact-retention-policy',
      'dashboard-replay-controls',
      'privacy-review',
    ],
    productReason: 'Sem recorder oficial, DVR nao pode ser vendido como pronto.',
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
      'non-mock-hierarchy-tests',
    ],
    productReason: 'Swarm v2 ja tem adapter oficial, batch queue, replay, role library, receipts e superficie canonica.',
    experimentalReason: 'O produto oficial e a escalacao governada; o orchestrator V2 ainda precisa de cancel/resume/receipts persistentes.',
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
    productReason: 'Mnemos/cold memory plane ja e oficial; compressor infinito ainda precisa backend persistente.',
    experimentalReason: 'Sem backend persistente e evals de recall, compressor fica experimental.',
  },
  {
    itemId: 'local-voice',
    label: 'Voice Local',
    experimentalComponent: 'voice/LocalVoiceDictation + EchoVoiceService',
    productAdapterId: null,
    featureFlag: 'ZAVORTH_ENABLE_LOCAL_VOICE',
    gates: [
      'local-device-provisioning',
      'privacy-permission-flow',
      'voice-status-surface',
      'audio-e2e-without-mock',
    ],
    productReason: 'Ainda nao ha provisioning oficial de dispositivo local.',
    experimentalReason: 'Voice local fica atras de provisioning e consentimento explicitos.',
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
      'non-mock-browser-e2e',
    ],
    productReason: 'Watch Mode/Computer Use ja e o produto governado; browser tool automatico fica experimental.',
    experimentalReason: 'AutomaticBrowserTool precisa doctor/provisioning antes de ser anunciado como pronto.',
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
      summary: `${officialItemIds.length} item(ns) com adapter oficial; ${experimentalItemIds.length} item(ns) permanecem experimentais.`,
      officialItemIds,
      experimentalItemIds,
      prohibitedPublicClaims: entries
        .filter((entry) => !entry.publicClaimAllowed)
        .map((entry) => ({
          itemId: entry.itemId,
          claim: `${entry.label} esta pronto/stable`,
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
    const decision: RuntimePromotionDecision = hasOfficialAdapter
      ? 'promote-product-adapter'
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
        detail: input.hasOfficialAdapter
          ? `Produto oficial via ${catalog.productAdapterId}; componente V2 segue separado.`
          : 'Mantido experimental ate cumprir gates de promocao.',
      },
      {
        id: `${catalog.itemId}:claim-control`,
        kind: 'claim-control',
        detail: input.publicStatus === 'official' && catalog.allowPublicClaimWhenOfficial
          ? 'Pode ser anunciado como superficie oficial, mantendo limites de sandbox, approvals e receipts.'
          : input.publicStatus === 'official'
          ? 'Somente o adapter canonico pode ser anunciado; o componente V2/experimental nao pode ser descrito como stable.'
          : 'Nao anunciar como pronto/stable em UI, CLI ou docs publicas.',
      },
    ];
    if (input.hasOfficialAdapter) {
      receipts.push({
        id: `${catalog.itemId}:adapter`,
        kind: 'adapter',
        detail: `Adapter canonico status=${input.adapterStatus || 'unknown'}.`,
      });
    } else {
      receipts.push({
        id: `${catalog.itemId}:gate`,
        kind: 'gate',
        detail: `Gates pendentes: ${catalog.gates.join(', ')}.`,
      });
    }
    return receipts;
  }
}
