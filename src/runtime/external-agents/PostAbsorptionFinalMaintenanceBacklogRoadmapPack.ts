import {
  createZavorthPostAbsorptionRuntimeHealthSummaryFixture,
} from './ZavorthPostAbsorptionRuntimeHealthSummary.js';
import type {
  ZavorthPostAbsorptionRuntimeHealthNormalization,
} from './ZavorthPostAbsorptionRuntimeHealthSummary.js';

export const ZAVORTH_POST_ABSORPTION_FINAL_MAINTENANCE_BACKLOG_ROADMAP_PACK_NOW = '2026-05-01T23:00:00.000Z' as const;
export const ZAVORTH_POST_ABSORPTION_FINAL_MAINTENANCE_BACKLOG_ROADMAP_PACK_RUNTIME_ID = 'zavorth-post-absorption-final-maintenance-backlog-roadmap-pack' as const;

export type ZavorthPostAbsorptionMaintenanceDecision =
  | 'blocked'
  | 'final-maintenance-backlog-roadmap-ready';

export type ZavorthPostAbsorptionMaintenancePriority =
  | 'P0 release blocker'
  | 'P1 high-value hardening'
  | 'P2 quality/performance'
  | 'P3 optional/future';

export type ZavorthPostAbsorptionMaintenanceItemId =
  | 'docs-release-notes-upkeep'
  | 'fixture-cache-improvements'
  | 'heavy-shard-optimization'
  | 'limited-production-message-expansion'
  | 'long-run-regression-automation'
  | 'optional-raw-history-sqlite-importer'
  | 'per-domain-fallback-adapter-retirement'
  | 'release-monitoring-polish';

export type ZavorthPostAbsorptionMaintenanceStatus =
  | 'blocked'
  | 'design-ready'
  | 'in-progress'
  | 'ongoing'
  | 'ready'
  | 'ready-for-next-pack';

export type ZavorthPostAbsorptionMaintenanceRisk =
  | 'high'
  | 'low'
  | 'medium';

export type ZavorthPostAbsorptionMaintenanceBacklogItem = {
  nativeContract: 'ZavorthPostAbsorptionMaintenanceBacklogItem/v1';
  itemId: ZavorthPostAbsorptionMaintenanceItemId;
  title: string;
  priority: ZavorthPostAbsorptionMaintenancePriority;
  status: ZavorthPostAbsorptionMaintenanceStatus;
  prerequisites: string[];
  risk: ZavorthPostAbsorptionMaintenanceRisk;
  suggestedNextGate: string;
  expectedBenefit: string;
  blocked: boolean;
  priorityJustification: string;
  evidenceDocs: string[];
  runtimeBehaviorChanged: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  toolCommandActuallyExecuted: false;
  rawMigrationPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthPostAbsorptionReleaseBlockerSummary = {
  nativeContract: 'ZavorthPostAbsorptionReleaseBlockerSummary/v1';
  releaseBlockersExplicit: true;
  activeP0Blockers: string[];
  p0ReleaseBlockerPriorityRepresented: true;
  goNoGoReference: 'docs/249-post-absorption-release-candidate-report.md';
  releaseCandidateGo: boolean;
  noCriticalReleaseBlockersRecorded: boolean;
  rawSecretSerialized: false;
};

export type ZavorthPostAbsorptionRoadmapPhase = {
  nativeContract: 'ZavorthPostAbsorptionRoadmapPhase/v1';
  phase:
    | 'next-1-2-packs'
    | 'next-stabilization-pass'
    | 'optional-future-capabilities';
  items: ZavorthPostAbsorptionMaintenanceItemId[];
  intent: string;
  runtimeBehaviorChanged: false;
  rawSecretSerialized: false;
};

export type ZavorthPostAbsorptionFinalGuardrails = {
  nativeContract: 'ZavorthPostAbsorptionFinalGuardrails/v1';
  defaultRuntimeZavorthOwned: true;
  publicExternalExecutorIdentityLeak: false;
  adapterDefaultPathForAbsorbedDomains: false;
  rawImportDisabledByDefault: true;
  productionSendLimitedApprovalGated: true;
  providerToolCommandGuarded: true;
  fullUnshardedSuiteRequiredForInteractiveGates: false;
  rawSecretSerialized: false;
};

export type ZavorthPostAbsorptionMaintenanceExecutionGate = {
  finalMaintenanceBacklogRoadmapCreated: true;
  postAbsorptionBacklogPrioritized: true;
  releaseBlockersExplicit: true;
  optionalFutureWorkExplicit: true;
  defaultRuntimeZavorthOwned: true;
  publicExternalExecutorIdentityLeak: false;
  rawSecretSerialized: false;
  runtimeBehaviorChanged: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  toolCommandActuallyExecuted: false;
  rawMigrationPerformed: false;
  adapterRemovalGlobalAllowed: false;
};

export type ZavorthPostAbsorptionMaintenanceRoadmapSource = {
  runtimeHealthSummary: Pick<
    ZavorthPostAbsorptionRuntimeHealthNormalization,
    'executionGate' | 'status'
  >;
  releaseCandidateGo: true;
  finalReleaseHandoffComplete: true;
  parallelHardeningRecorded: true;
  heavyShardOptimizationRecorded: true;
  fallbackAdapterRetirementRecorded: true;
  optionalRawImporterDesignRecorded: true;
  limitedProductionMessageExpansionRecorded: true;
  monitoringObservabilityPolishRecorded: true;
  runtimeBehaviorChangeAttempted: false;
  messageSendAttempted: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  rawMigrationAttempted: false;
  adapterRemovalAttempted: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
};

export type ZavorthPostAbsorptionMaintenanceRoadmapNormalization = {
  nativeContract: 'ZavorthPostAbsorptionFinalMaintenanceBacklogRoadmapPack/v1';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_POST_ABSORPTION_FINAL_MAINTENANCE_BACKLOG_ROADMAP_PACK_RUNTIME_ID;
  decision: ZavorthPostAbsorptionMaintenanceDecision;
  status: ZavorthPostAbsorptionMaintenanceDecision;
  backlogItems: ZavorthPostAbsorptionMaintenanceBacklogItem[];
  releaseBlockerSummary: ZavorthPostAbsorptionReleaseBlockerSummary;
  roadmap: ZavorthPostAbsorptionRoadmapPhase[];
  finalGuardrails: ZavorthPostAbsorptionFinalGuardrails;
  executionGate: ZavorthPostAbsorptionMaintenanceExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawContentSerialized: false;
    publicSourceIdentityExposed: false;
    serializedOutputContainsSensitiveFixture: false;
  };
  terminalGate: 'do-not-advance-beyond-257-without-operator-decision';
};

export type ZavorthPostAbsorptionMaintenanceRoadmapOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_POST_ABSORPTION_FINAL_MAINTENANCE_BACKLOG_ROADMAP_PACK_RUNTIME_ID;
  source: ZavorthPostAbsorptionMaintenanceRoadmapSource;
};

function backlogItem(
  row: Omit<
    ZavorthPostAbsorptionMaintenanceBacklogItem,
    | 'messageActuallySent'
    | 'nativeContract'
    | 'providerActuallyExecuted'
    | 'rawMigrationPerformed'
    | 'rawSecretSerialized'
    | 'runtimeBehaviorChanged'
    | 'toolCommandActuallyExecuted'
  >,
): ZavorthPostAbsorptionMaintenanceBacklogItem {
  return {
    nativeContract: 'ZavorthPostAbsorptionMaintenanceBacklogItem/v1',
    ...row,
    runtimeBehaviorChanged: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    toolCommandActuallyExecuted: false,
    rawMigrationPerformed: false,
    rawSecretSerialized: false,
  };
}

function backlogItems(): ZavorthPostAbsorptionMaintenanceBacklogItem[] {
  return [
    backlogItem({
      itemId: 'per-domain-fallback-adapter-retirement',
      title: 'Continue per-domain fallback adapter retirement',
      priority: 'P1 high-value hardening',
      status: 'ready-for-next-pack',
      prerequisites: ['253 completed', 'domain allowlist remains explicit'],
      risk: 'medium',
      suggestedNextGate: '258-post-absorption-next-domain-fallback-retirement',
      expectedBenefit: 'Reduces residual fallback surface while preserving explicit refresh/fallback where required.',
      blocked: false,
      priorityJustification: 'High security and architecture value with bounded domain-by-domain blast radius.',
      evidenceDocs: ['docs/253-post-absorption-fallback-adapter-retirement-domain-pack.md'],
    }),
    backlogItem({
      itemId: 'release-monitoring-polish',
      title: 'Keep release monitoring and receipts polished',
      priority: 'P1 high-value hardening',
      status: 'ongoing',
      prerequisites: ['256 runtime health summary exists'],
      risk: 'low',
      suggestedNextGate: '258-or-release-ops-health-receipt-hardening',
      expectedBenefit: 'Improves operator visibility for registry health, blocked sends, redaction, and shard regressions.',
      blocked: false,
      priorityJustification: 'Directly supports release safety without changing runtime behavior.',
      evidenceDocs: ['docs/256-post-absorption-release-monitoring-observability-polish-pack.md'],
    }),
    backlogItem({
      itemId: 'heavy-shard-optimization',
      title: 'Continue heavy external-agents shard optimization',
      priority: 'P2 quality/performance',
      status: 'in-progress',
      prerequisites: ['245 timeout investigation', '246 shard strategy', '252 first optimization pack'],
      risk: 'low',
      suggestedNextGate: '258-post-absorption-shard-fixture-cache-follow-up',
      expectedBenefit: 'Keeps interactive verification fast and release sharded regression reliable.',
      blocked: false,
      priorityJustification: 'Important quality/performance work, but not an active release blocker after 246 shard pass.',
      evidenceDocs: [
        'docs/245-post-absorption-external-agents-suite-timeout-investigation.md',
        'docs/246-post-absorption-long-regression-release-verification.md',
        'docs/252-post-absorption-heavy-shard-optimization-pack.md',
      ],
    }),
    backlogItem({
      itemId: 'fixture-cache-improvements',
      title: 'Improve fixture/cache reuse in heavy tests',
      priority: 'P2 quality/performance',
      status: 'ready',
      prerequisites: ['252 heavy shard measurements'],
      risk: 'low',
      suggestedNextGate: '258-post-absorption-fixture-cache-optimization',
      expectedBenefit: 'Reduces repeated setup/IO while preserving coverage.',
      blocked: false,
      priorityJustification: 'Speeds repeated checks without altering production runtime.',
      evidenceDocs: ['docs/252-post-absorption-heavy-shard-optimization-pack.md'],
    }),
    backlogItem({
      itemId: 'long-run-regression-automation',
      title: 'Automate long-run sharded regression',
      priority: 'P2 quality/performance',
      status: 'ready',
      prerequisites: ['246 16/16 shard strategy', 'package shard scripts'],
      risk: 'medium',
      suggestedNextGate: '258-post-absorption-ci-shard-matrix-plan',
      expectedBenefit: 'Moves long regression from manual release evidence into repeatable automation.',
      blocked: false,
      priorityJustification: 'Valuable release engineering work; not required for interactive gates.',
      evidenceDocs: ['docs/246-post-absorption-long-regression-release-verification.md', 'docs/250-post-absorption-final-release-notes-and-handoff.md'],
    }),
    backlogItem({
      itemId: 'docs-release-notes-upkeep',
      title: 'Maintain docs and release notes',
      priority: 'P2 quality/performance',
      status: 'ongoing',
      prerequisites: ['248 docs cleanup', '250 final handoff'],
      risk: 'low',
      suggestedNextGate: 'release-notes-maintenance-as-needed',
      expectedBenefit: 'Keeps public Zavorth-native posture and operations commands accurate.',
      blocked: false,
      priorityJustification: 'Small ongoing work that protects operator clarity and public surface hardening.',
      evidenceDocs: ['docs/248-post-absorption-release-docs-install-cleanup.md', 'docs/250-post-absorption-final-release-notes-and-handoff.md'],
    }),
    backlogItem({
      itemId: 'limited-production-message-expansion',
      title: 'Optional limited production message send expansion',
      priority: 'P3 optional/future',
      status: 'design-ready',
      prerequisites: ['255 policy boundary', 'explicit feature flag', 'approved allowlisted production target'],
      risk: 'high',
      suggestedNextGate: 'future-limited-production-message-send-live-opt-in',
      expectedBenefit: 'Allows carefully approved production send targets while preserving unrestricted production block.',
      blocked: false,
      priorityJustification: 'Potential product value, but operationally risky and explicitly optional.',
      evidenceDocs: ['docs/255-post-absorption-limited-production-message-send-expansion-pack.md'],
    }),
    backlogItem({
      itemId: 'optional-raw-history-sqlite-importer',
      title: 'Optional raw history/SQLite importer',
      priority: 'P3 optional/future',
      status: 'design-ready',
      prerequisites: ['254 design boundary', 'explicit operator consent', 'preview', 'redaction', 'backup/rollback'],
      risk: 'high',
      suggestedNextGate: 'future-optional-raw-import-implementation-only-with-explicit-consent',
      expectedBenefit: 'Could import valuable local history in a future consented scenario; currently unnecessary by operator decision.',
      blocked: false,
      priorityJustification: 'High-risk optional work; raw import stays disabled by default.',
      evidenceDocs: ['docs/247-post-absorption-raw-history-sqlite-import-decision.md', 'docs/254-post-absorption-optional-raw-history-sqlite-importer-design-pack.md'],
    }),
  ];
}

function releaseBlockerSummary(source: ZavorthPostAbsorptionMaintenanceRoadmapSource): ZavorthPostAbsorptionReleaseBlockerSummary {
  return {
    nativeContract: 'ZavorthPostAbsorptionReleaseBlockerSummary/v1',
    releaseBlockersExplicit: true,
    activeP0Blockers: [],
    p0ReleaseBlockerPriorityRepresented: true,
    goNoGoReference: 'docs/249-post-absorption-release-candidate-report.md',
    releaseCandidateGo: source.releaseCandidateGo,
    noCriticalReleaseBlockersRecorded: true,
    rawSecretSerialized: false,
  };
}

function roadmap(): ZavorthPostAbsorptionRoadmapPhase[] {
  return [
    {
      nativeContract: 'ZavorthPostAbsorptionRoadmapPhase/v1',
      phase: 'next-1-2-packs',
      items: ['per-domain-fallback-adapter-retirement', 'heavy-shard-optimization'],
      intent: 'Continue the two highest leverage safe follow-ups: reduce residual adapter fallback by domain and continue test fixture/shard optimization.',
      runtimeBehaviorChanged: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthPostAbsorptionRoadmapPhase/v1',
      phase: 'next-stabilization-pass',
      items: ['fixture-cache-improvements', 'long-run-regression-automation', 'release-monitoring-polish', 'docs-release-notes-upkeep'],
      intent: 'Make release verification and operator monitoring repeatable without making the unsharded suite mandatory for interactive gates.',
      runtimeBehaviorChanged: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthPostAbsorptionRoadmapPhase/v1',
      phase: 'optional-future-capabilities',
      items: ['limited-production-message-expansion', 'optional-raw-history-sqlite-importer'],
      intent: 'Only pursue high-risk optional capabilities with explicit operator approval, feature flags, preview/dry-run, receipts, and rollback guardrails.',
      runtimeBehaviorChanged: false,
      rawSecretSerialized: false,
    },
  ];
}

function finalGuardrails(): ZavorthPostAbsorptionFinalGuardrails {
  return {
    nativeContract: 'ZavorthPostAbsorptionFinalGuardrails/v1',
    defaultRuntimeZavorthOwned: true,
    publicExternalExecutorIdentityLeak: false,
    adapterDefaultPathForAbsorbedDomains: false,
    rawImportDisabledByDefault: true,
    productionSendLimitedApprovalGated: true,
    providerToolCommandGuarded: true,
    fullUnshardedSuiteRequiredForInteractiveGates: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthPostAbsorptionMaintenanceExecutionGate {
  return {
    finalMaintenanceBacklogRoadmapCreated: true,
    postAbsorptionBacklogPrioritized: true,
    releaseBlockersExplicit: true,
    optionalFutureWorkExplicit: true,
    defaultRuntimeZavorthOwned: true,
    publicExternalExecutorIdentityLeak: false,
    rawSecretSerialized: false,
    runtimeBehaviorChanged: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    toolCommandActuallyExecuted: false,
    rawMigrationPerformed: false,
    adapterRemovalGlobalAllowed: false,
  };
}

function sourceReady(source: ZavorthPostAbsorptionMaintenanceRoadmapSource): boolean {
  return (
    source.runtimeHealthSummary.status !== 'blocked' &&
    source.runtimeHealthSummary.executionGate.defaultRuntimeZavorthOwned &&
    !source.runtimeHealthSummary.executionGate.adapterDefaultPathForAbsorbedDomains &&
    source.releaseCandidateGo &&
    source.finalReleaseHandoffComplete &&
    source.parallelHardeningRecorded &&
    source.heavyShardOptimizationRecorded &&
    source.fallbackAdapterRetirementRecorded &&
    source.optionalRawImporterDesignRecorded &&
    source.limitedProductionMessageExpansionRecorded &&
    source.monitoringObservabilityPolishRecorded &&
    !source.runtimeBehaviorChangeAttempted &&
    !source.messageSendAttempted &&
    !source.providerExecutionAttempted &&
    !source.toolCommandExecutionAttempted &&
    !source.rawMigrationAttempted &&
    !source.adapterRemovalAttempted &&
    !source.publicExternalExecutorIdentityExposed &&
    !source.rawSecretSerialized
  );
}

export class ZavorthPostAbsorptionFinalMaintenanceBacklogRoadmapPack {
  public constructor(public readonly normalization: ZavorthPostAbsorptionMaintenanceRoadmapNormalization) {}

  public itemsByPriority(priority: ZavorthPostAbsorptionMaintenancePriority): ZavorthPostAbsorptionMaintenanceBacklogItem[] {
    return this.normalization.backlogItems.filter((item) => item.priority === priority);
  }

  public item(itemId: ZavorthPostAbsorptionMaintenanceItemId): ZavorthPostAbsorptionMaintenanceBacklogItem | undefined {
    return this.normalization.backlogItems.find((item) => item.itemId === itemId);
  }

  public activeReleaseBlockers(): string[] {
    return this.normalization.releaseBlockerSummary.activeP0Blockers;
  }
}

export function createZavorthPostAbsorptionMaintenanceRoadmapSource(
  overrides: Partial<ZavorthPostAbsorptionMaintenanceRoadmapSource> = {},
): ZavorthPostAbsorptionMaintenanceRoadmapSource {
  return {
    runtimeHealthSummary: createZavorthPostAbsorptionRuntimeHealthSummaryFixture().normalization,
    releaseCandidateGo: true,
    finalReleaseHandoffComplete: true,
    parallelHardeningRecorded: true,
    heavyShardOptimizationRecorded: true,
    fallbackAdapterRetirementRecorded: true,
    optionalRawImporterDesignRecorded: true,
    limitedProductionMessageExpansionRecorded: true,
    monitoringObservabilityPolishRecorded: true,
    runtimeBehaviorChangeAttempted: false,
    messageSendAttempted: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    rawMigrationAttempted: false,
    adapterRemovalAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    rawSecretSerialized: false,
    ...overrides,
  };
}

export function normalizeZavorthPostAbsorptionMaintenanceRoadmapPack(
  options: ZavorthPostAbsorptionMaintenanceRoadmapOptions,
): ZavorthPostAbsorptionMaintenanceRoadmapNormalization {
  const items = backlogItems();
  const blockers = releaseBlockerSummary(options.source);
  const guardrails = finalGuardrails();
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    items.length === 8 &&
    items.every((item) => (
      item.priorityJustification.length > 0 &&
      item.expectedBenefit.length > 0 &&
      item.suggestedNextGate.length > 0 &&
      item.prerequisites.length > 0 &&
      !item.runtimeBehaviorChanged &&
      !item.messageActuallySent &&
      !item.providerActuallyExecuted &&
      !item.toolCommandActuallyExecuted &&
      !item.rawMigrationPerformed &&
      !item.rawSecretSerialized
    )) &&
    blockers.releaseBlockersExplicit &&
    blockers.p0ReleaseBlockerPriorityRepresented &&
    blockers.activeP0Blockers.length === 0 &&
    guardrails.defaultRuntimeZavorthOwned &&
    !guardrails.publicExternalExecutorIdentityLeak &&
    !guardrails.adapterDefaultPathForAbsorbedDomains &&
    guardrails.rawImportDisabledByDefault &&
    guardrails.productionSendLimitedApprovalGated &&
    guardrails.providerToolCommandGuarded &&
    !guardrails.fullUnshardedSuiteRequiredForInteractiveGates &&
    !gate.adapterRemovalGlobalAllowed;

  return {
    nativeContract: 'ZavorthPostAbsorptionFinalMaintenanceBacklogRoadmapPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'final-maintenance-backlog-roadmap-ready' : 'blocked',
    status: ready ? 'final-maintenance-backlog-roadmap-ready' : 'blocked',
    backlogItems: items,
    releaseBlockerSummary: blockers,
    roadmap: roadmap(),
    finalGuardrails: guardrails,
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      rawContentSerialized: false,
      publicSourceIdentityExposed: false,
      serializedOutputContainsSensitiveFixture: false,
    },
    terminalGate: 'do-not-advance-beyond-257-without-operator-decision',
  };
}

export function createZavorthPostAbsorptionFinalMaintenanceBacklogRoadmapPackFixture(
  overrides: Partial<ZavorthPostAbsorptionMaintenanceRoadmapSource> = {},
): ZavorthPostAbsorptionFinalMaintenanceBacklogRoadmapPack {
  return new ZavorthPostAbsorptionFinalMaintenanceBacklogRoadmapPack(
    normalizeZavorthPostAbsorptionMaintenanceRoadmapPack({
      generatedAt: ZAVORTH_POST_ABSORPTION_FINAL_MAINTENANCE_BACKLOG_ROADMAP_PACK_NOW,
      runtimeId: ZAVORTH_POST_ABSORPTION_FINAL_MAINTENANCE_BACKLOG_ROADMAP_PACK_RUNTIME_ID,
      source: createZavorthPostAbsorptionMaintenanceRoadmapSource(overrides),
    }),
  );
}
