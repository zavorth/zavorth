import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_POST_ABSORPTION_FINAL_MAINTENANCE_BACKLOG_ROADMAP_PACK_RUNTIME_ID,
  createZavorthPostAbsorptionFinalMaintenanceBacklogRoadmapPackFixture,
  createZavorthPostAbsorptionMaintenanceRoadmapSource,
  normalizeZavorthPostAbsorptionMaintenanceRoadmapPack,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthPostAbsorptionMaintenanceItemId,
  ZavorthPostAbsorptionMaintenancePriority,
  ZavorthPostAbsorptionMaintenanceRoadmapSource,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/257-post-absorption-final-maintenance-backlog-and-roadmap-pack.md';
const FINAL_REPORT = 'docs/244-final-zavorth-only-absorption-hardening-and-report.md';
const RC_REPORT = 'docs/249-post-absorption-release-candidate-report.md';
const HANDOFF = 'docs/250-post-absorption-final-release-notes-and-handoff.md';
const PARALLEL = 'docs/251-post-absorption-parallel-hardening-pack.md';
const HEAVY_SHARDS = 'docs/252-post-absorption-heavy-shard-optimization-pack.md';
const FALLBACK_RETIREMENT = 'docs/253-post-absorption-fallback-adapter-retirement-domain-pack.md';
const RAW_IMPORT_DESIGN = 'docs/254-post-absorption-optional-raw-history-sqlite-importer-design-pack.md';
const LIMITED_SEND = 'docs/255-post-absorption-limited-production-message-send-expansion-pack.md';
const MONITORING = 'docs/256-post-absorption-release-monitoring-observability-polish-pack.md';
const BOUNDARY = 'src/runtime/external-agents/PostAbsorptionFinalMaintenanceBacklogRoadmapPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';

const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const BACKLOG_ITEMS: ZavorthPostAbsorptionMaintenanceItemId[] = [
  'per-domain-fallback-adapter-retirement',
  'release-monitoring-polish',
  'heavy-shard-optimization',
  'fixture-cache-improvements',
  'long-run-regression-automation',
  'docs-release-notes-upkeep',
  'limited-production-message-expansion',
  'optional-raw-history-sqlite-importer',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assertNoRawSecretOrContent(serialized: string): void {
  expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  expect(serialized).not.toMatch(/(?<![A-Za-z])sk-[A-Za-z0-9_-]{20,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{20,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{20,}/);
  expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  expect(serialized).not.toContain('<redacted-local-secret>');
  expect(serialized).not.toContain('raw user message body that must never migrate');
}

describe('Post-absorption final maintenance backlog and roadmap pack', () => {
  let source: ZavorthPostAbsorptionMaintenanceRoadmapSource;
  let pack: ReturnType<typeof createZavorthPostAbsorptionFinalMaintenanceBacklogRoadmapPackFixture>;

  beforeAll(() => {
    source = createZavorthPostAbsorptionMaintenanceRoadmapSource();
    pack = createZavorthPostAbsorptionFinalMaintenanceBacklogRoadmapPackFixture();
  });

  it('documents 257 as the final maintenance backlog and roadmap pack', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `final-maintenance-backlog-roadmap-ready`');
    expect(content).toContain('PostAbsorptionFinalMaintenanceBacklogRoadmapPack.ts');
    expect(content).toContain('ZavorthPostAbsorptionFinalMaintenanceBacklogRoadmapPack/v1');
    expect(content).toContain('ZavorthPostAbsorptionMaintenanceBacklogItem/v1');
    expect(content).toContain('ZavorthPostAbsorptionReleaseBlockerSummary/v1');
    expect(content).toContain('ZavorthPostAbsorptionRoadmapPhase/v1');
    expect(content).toContain('finalMaintenanceBacklogRoadmapCreated=true');
    expect(content).toContain('postAbsorptionBacklogPrioritized=true');
    expect(content).toContain('releaseBlockersExplicit=true');
    expect(content).toContain('optionalFutureWorkExplicit=true');
    expect(content).toContain('runtimeBehaviorChanged=false');
    expect(content).toContain('Do not advance beyond `257`');
    assertNoRawSecretOrContent(content);
  });

  it('uses the post-absorption evidence chain from 244 through 256', () => {
    const doc = read(DOC);

    [
      FINAL_REPORT,
      RC_REPORT,
      HANDOFF,
      PARALLEL,
      HEAVY_SHARDS,
      FALLBACK_RETIREMENT,
      RAW_IMPORT_DESIGN,
      LIMITED_SEND,
      MONITORING,
    ].forEach((evidence) => expect(doc).toContain(evidence));
    expect(read(RC_REPORT)).toContain('release candidate: go');
    expect(read(HANDOFF)).toContain('Residual Work');
    expect(read(MONITORING)).toContain('postAbsorptionRuntimeHealthSummaryCreated=true');
  });

  it('exports the final maintenance roadmap boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthPostAbsorptionFinalMaintenanceBacklogRoadmapPack/v1');
    expect(boundary).toContain('ZavorthPostAbsorptionMaintenanceBacklogItem/v1');
    expect(boundary).toContain('ZavorthPostAbsorptionReleaseBlockerSummary/v1');
    expect(boundary).toContain('ZavorthPostAbsorptionFinalGuardrails/v1');
    expect(index).toContain("from './PostAbsorptionFinalMaintenanceBacklogRoadmapPack.js'");
    expect(index).toContain('ZAVORTH_POST_ABSORPTION_FINAL_MAINTENANCE_BACKLOG_ROADMAP_PACK_RUNTIME_ID');
  });

  it('prioritizes all final backlog items with risk, prerequisites, benefit, and next gate', () => {
    expect(pack.normalization.decision).toBe('final-maintenance-backlog-roadmap-ready');
    expect(pack.normalization.backlogItems.map((item) => item.itemId)).toEqual(BACKLOG_ITEMS);

    pack.normalization.backlogItems.forEach((item) => {
      expect(item.nativeContract).toBe('ZavorthPostAbsorptionMaintenanceBacklogItem/v1');
      expect(item.priority).toMatch(/^P[123]/);
      expect(item.prerequisites.length).toBeGreaterThan(0);
      expect(item.expectedBenefit.length).toBeGreaterThan(0);
      expect(item.priorityJustification.length).toBeGreaterThan(0);
      expect(item.suggestedNextGate.length).toBeGreaterThan(0);
      expect(item.evidenceDocs.length).toBeGreaterThan(0);
      expect(item.runtimeBehaviorChanged).toBe(false);
      expect(item.messageActuallySent).toBe(false);
      expect(item.providerActuallyExecuted).toBe(false);
      expect(item.toolCommandActuallyExecuted).toBe(false);
      expect(item.rawMigrationPerformed).toBe(false);
      expect(item.rawSecretSerialized).toBe(false);
    });
  });

  it('makes release blockers explicit and records no active P0 blocker', () => {
    expect(pack.activeReleaseBlockers()).toEqual([]);
    expect(pack.normalization.releaseBlockerSummary).toEqual({
      nativeContract: 'ZavorthPostAbsorptionReleaseBlockerSummary/v1',
      releaseBlockersExplicit: true,
      activeP0Blockers: [],
      p0ReleaseBlockerPriorityRepresented: true,
      goNoGoReference: 'docs/249-post-absorption-release-candidate-report.md',
      releaseCandidateGo: true,
      noCriticalReleaseBlockersRecorded: true,
      rawSecretSerialized: false,
    });
  });

  it('classifies P1, P2, and P3 work with concrete ownership/readiness', () => {
    const p1 = pack.itemsByPriority('P1 high-value hardening').map((item) => item.itemId);
    const p2 = pack.itemsByPriority('P2 quality/performance').map((item) => item.itemId);
    const p3 = pack.itemsByPriority('P3 optional/future').map((item) => item.itemId);

    expect(p1).toEqual(['per-domain-fallback-adapter-retirement', 'release-monitoring-polish']);
    expect(p2).toEqual([
      'heavy-shard-optimization',
      'fixture-cache-improvements',
      'long-run-regression-automation',
      'docs-release-notes-upkeep',
    ]);
    expect(p3).toEqual(['limited-production-message-expansion', 'optional-raw-history-sqlite-importer']);
    expect(pack.item('optional-raw-history-sqlite-importer')).toEqual(expect.objectContaining({
      priority: 'P3 optional/future',
      status: 'design-ready',
      risk: 'high',
      blocked: false,
    }));
    expect(pack.item('limited-production-message-expansion')).toEqual(expect.objectContaining({
      priority: 'P3 optional/future',
      risk: 'high',
      suggestedNextGate: 'future-limited-production-message-send-live-opt-in',
    }));
  });

  it('records a short roadmap for the next packs, stabilization pass, and optional future capabilities', () => {
    expect(pack.normalization.roadmap).toEqual([
      expect.objectContaining({
        phase: 'next-1-2-packs',
        items: ['per-domain-fallback-adapter-retirement', 'heavy-shard-optimization'],
        runtimeBehaviorChanged: false,
      }),
      expect.objectContaining({
        phase: 'next-stabilization-pass',
        items: ['fixture-cache-improvements', 'long-run-regression-automation', 'release-monitoring-polish', 'docs-release-notes-upkeep'],
        runtimeBehaviorChanged: false,
      }),
      expect.objectContaining({
        phase: 'optional-future-capabilities',
        items: ['limited-production-message-expansion', 'optional-raw-history-sqlite-importer'],
        runtimeBehaviorChanged: false,
      }),
    ]);
  });

  it('keeps final guardrails and exact execution guarantees closed', () => {
    expect(pack.normalization.finalGuardrails).toEqual({
      nativeContract: 'ZavorthPostAbsorptionFinalGuardrails/v1',
      defaultRuntimeZavorthOwned: true,
      publicExternalExecutorIdentityLeak: false,
      adapterDefaultPathForAbsorbedDomains: false,
      rawImportDisabledByDefault: true,
      productionSendLimitedApprovalGated: true,
      providerToolCommandGuarded: true,
      fullUnshardedSuiteRequiredForInteractiveGates: false,
      rawSecretSerialized: false,
    });
    expect(pack.normalization.executionGate).toEqual({
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
    });
  });

  it('blocks attempts to change runtime, execute, migrate, remove adapter, expose public identity, or serialize secrets', () => {
    const blockedCases: Array<keyof ZavorthPostAbsorptionMaintenanceRoadmapSource> = [
      'runtimeBehaviorChangeAttempted',
      'messageSendAttempted',
      'providerExecutionAttempted',
      'toolCommandExecutionAttempted',
      'rawMigrationAttempted',
      'adapterRemovalAttempted',
      'publicExternalExecutorIdentityExposed',
      'rawSecretSerialized',
    ];

    blockedCases.forEach((key) => {
      const normalization = normalizeZavorthPostAbsorptionMaintenanceRoadmapPack({
        generatedAt: '2026-05-01T23:01:00.000Z',
        runtimeId: ZAVORTH_POST_ABSORPTION_FINAL_MAINTENANCE_BACKLOG_ROADMAP_PACK_RUNTIME_ID,
        source: { ...source, [key]: true } as unknown as ZavorthPostAbsorptionMaintenanceRoadmapSource,
      });

      expect(normalization.decision).toBe('blocked');
      expect(normalization.executionGate.runtimeBehaviorChanged).toBe(false);
      expect(normalization.executionGate.messageActuallySent).toBe(false);
      expect(normalization.executionGate.providerActuallyExecuted).toBe(false);
      expect(normalization.executionGate.toolCommandActuallyExecuted).toBe(false);
      expect(normalization.executionGate.rawMigrationPerformed).toBe(false);
      expect(normalization.executionGate.adapterRemovalGlobalAllowed).toBe(false);
      expect(normalization.executionGate.rawSecretSerialized).toBe(false);
    });
  });

  it('keeps serialized output redacted and marks 257 as the terminal gate without operator decision', () => {
    const serialized = JSON.stringify(pack.normalization);

    expect(pack.normalization.redaction).toEqual({
      rawSecretSerialized: false,
      rawContentSerialized: false,
      publicSourceIdentityExposed: false,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(pack.normalization.terminalGate).toBe('do-not-advance-beyond-257-without-operator-decision');
    assertNoRawSecretOrContent(serialized);
  });
});
