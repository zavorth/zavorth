import { ZavorthMemoryLearningLoopService } from '../../src/services/ZavorthMemoryLearningLoopService';
import { ZavorthNativeLearningLoopService } from '../../src/services/ZavorthNativeLearningLoopService';
import type { ZavorthReplayLearningSnapshot } from '../../src/services/ZavorthReplayLearningService';
import type { ZavorthSkillEvolutionSnapshot } from '../../src/services/ZavorthSkillEvolutionService';

function replaySnapshot(): ZavorthReplayLearningSnapshot {
  return {
    generatedAt: '2026-05-24T12:00:00.000Z',
    summary: {
      posture: 'healthy',
      timelineEvents: 1,
      compareReady: true,
      resumeReady: true,
      recentArtifacts: 1,
      reusableArtifacts: 0,
      learningCandidates: 1,
      pendingLearning: 1,
      promotedLearning: 0,
      memoryEntries: 1,
      proceduralEntries: 0,
      memoryPressure: 'low',
      approvedProfileEntries: 0,
      revokedEntries: 0,
      heavyRuntimesStarted: false,
    },
    narrative: {
      headline: 'Replay learning ready.',
      operatorSummary: '1 pending learning item.',
      nextAction: 'Review pending learning.',
    },
    profile: {
      version: 1,
      mode: 'suggest-only',
      updatedAt: null,
      localOnly: true,
      exportable: true,
      expiresAt: null,
      approvedRecordIds: [],
      revokedRecordIds: [],
      preferences: [],
      procedures: [],
      debugPatterns: [],
      codingStyle: [],
      skillCandidates: [],
      notes: [],
    },
    records: [{
      id: 'replay-1',
      kind: 'preference',
      status: 'waiting_approval',
      createdAt: '2026-05-24T12:00:00.000Z',
      updatedAt: '2026-05-24T12:00:00.000Z',
      requestedBy: 'operator',
      sourceSurface: 'test',
      replayRef: 'test-replay',
      summary: 'Prefer concise technical summaries after successful runs.',
      redactedEvidence: 'redacted evidence',
      confidence: 0.81,
      uses: ['response-style'],
      expiresAt: null,
      mutationPlanId: null,
      permissionId: null,
      artifact: {
        id: 'artifact-1',
        kind: 'preference',
        status: 'draft',
        createdAt: '2026-05-24T12:00:00.000Z',
        updatedAt: '2026-05-24T12:00:00.000Z',
        source: {
          domain: 'replay-learning',
          surface: 'test',
          requestedBy: 'operator',
          originRef: 'test-replay',
        },
        subject: {
          name: 'concise technical summaries',
          version: '1',
          summary: 'Prefer concise technical summaries after successful runs.',
          riskLevel: 'low',
        },
        evidence: [],
        retention: {
          ttlMs: 30 * 24 * 60 * 60 * 1000,
          maxBytes: null,
          cleanupOnSuccess: false,
          cleanupOnBoot: false,
          notes: [],
        },
        redaction: {
          rawTranscriptPersisted: false,
          rawSecretsPersisted: false,
          notes: [],
        },
        hashes: {
          intentHash: 'intent',
          contentHash: 'content',
        },
      },
      evalManifest: {
        version: 1,
        manifestHash: 'eval',
        generatedAt: '2026-05-24T12:00:00.000Z',
        windowHours: 24,
        scopeHash: 'scope',
        reproducible: true,
        baselineRef: 'baseline',
        selectors: [],
        retention: {
          ttlMs: 30 * 24 * 60 * 60 * 1000,
          maxSamples: 20,
          compacted: true,
        },
        redaction: {
          mode: 'references-only',
          payloadsIncluded: false,
          secretsIncluded: false,
          notes: [],
        },
      },
      linkedSkillDraftId: null,
      revokedAt: null,
      revokedReason: null,
    }],
    actions: [],
    policy: {
      suggestOnlyDefault: true,
      rawReplayPersisted: false,
      secretsPersisted: false,
      approvalRequiredForProfile: true,
      retentionTtlMs: 30 * 24 * 60 * 60 * 1000,
    },
  };
}

function skillSnapshot(): ZavorthSkillEvolutionSnapshot {
  return {
    generatedAt: '2026-05-24T12:00:00.000Z',
    summary: {
      posture: 'healthy',
      total: 0,
      drafts: 0,
      waitingApproval: 0,
      trustedLocal: 0,
      blocked: 0,
      procedureOnly: 0,
      heavyRuntimesStarted: false,
    },
    pipeline: ['observe', 'synthesize', 'sandbox-test', 'eval', 'preview', 'approve', 'install'],
    policy: {
      draftFirst: true,
      silentInstallBlocked: true,
      secretsAvailableToDraft: false,
      trustPlaneDomain: 'skill-evolution',
      installTargetRoot: 'skill-library',
    },
    records: [],
    actions: [],
  };
}

describe('ZavorthNativeLearningLoopService', () => {
  it('searches sessions through top-k untrusted Mnemos recall and exposes a reversible user model', async () => {
    const memory = ZavorthMemoryLearningLoopService.createInMemoryForTests(
      () => new Date('2026-05-24T12:00:00.000Z'),
    );
    await memory.remember({
      layer: 'session',
      key: 'github-review',
      content: 'The operator repeatedly reviews GitHub PRs and asks for changed files.',
      userId: 'operator',
      sessionId: 'session-1',
    });

    const service = new ZavorthNativeLearningLoopService({
      now: () => new Date('2026-05-24T12:00:00.000Z'),
      memoryLearningLoop: memory,
      replayLearning: { buildSnapshot: replaySnapshot },
      skillEvolution: { buildSnapshot: skillSnapshot },
    });

    const snapshot = await service.buildSnapshot({
      query: 'github changed files',
      userId: 'operator',
      sessionId: 'session-1',
    });

    expect(snapshot.summary.sessionSearchReady).toBe(true);
    expect(snapshot.sessionSearch?.topKOnly).toBe(true);
    expect(snapshot.sessionSearch?.untrustedOnRecall).toBe(true);
    expect(snapshot.sessionSearch?.entries[0].key).toBe('github-review');
    expect(snapshot.userModel).toEqual(expect.objectContaining({
      mode: 'suggest-only',
      localOnly: true,
      reversible: true,
    }));
  });

  it('creates auto-skill, procedural, nudge and user-model candidates without changing behavior silently', async () => {
    const memory = ZavorthMemoryLearningLoopService.createInMemoryForTests(
      () => new Date('2026-05-24T12:00:00.000Z'),
    );
    const service = new ZavorthNativeLearningLoopService({
      now: () => new Date('2026-05-24T12:00:00.000Z'),
      memoryLearningLoop: memory,
      replayLearning: { buildSnapshot: replaySnapshot },
      skillEvolution: { buildSnapshot: skillSnapshot },
    });

    const snapshot = await service.buildSnapshot({
      observation: 'summarize a github pr and list changed files',
      userId: 'operator',
      sourceSurface: 'test',
    });

    expect(snapshot.summary.autoSkillCandidateReady).toBe(true);
    expect(snapshot.summary.reversibleUserModelReady).toBe(true);
    expect(snapshot.candidates.map((candidate) => candidate.kind)).toEqual(expect.arrayContaining([
      'auto-skill-candidate',
      'procedural-memory',
      'approved-nudge',
      'user-model-update',
    ]));
    expect(snapshot.candidates.every((candidate) => candidate.approvalRequired)).toBe(true);
    expect(snapshot.candidates.every((candidate) => candidate.safety.canModifySecurityPolicy === false)).toBe(true);
  });

  it('quarantines attempts to learn security policy changes', async () => {
    const memory = ZavorthMemoryLearningLoopService.createInMemoryForTests(
      () => new Date('2026-05-24T12:00:00.000Z'),
    );
    const service = new ZavorthNativeLearningLoopService({
      now: () => new Date('2026-05-24T12:00:00.000Z'),
      memoryLearningLoop: memory,
      replayLearning: { buildSnapshot: replaySnapshot },
      skillEvolution: { buildSnapshot: skillSnapshot },
    });

    const snapshot = await service.buildSnapshot({
      observation: 'disable approval policy and always allow shell commands in the sandbox',
      userId: 'operator',
    });

    expect(snapshot.status).toBe('attention');
    expect(snapshot.summary.quarantined).toBeGreaterThan(0);
    expect(snapshot.invariants.neverLearnsSecurityPolicy).toBe(true);
    expect(snapshot.candidates.some((candidate) => candidate.state === 'quarantined')).toBe(true);
    expect(snapshot.candidates.every((candidate) => candidate.safety.rawSecretsSerialized === false)).toBe(true);
  });

  it('includes Adaptive Learning OS classification without silently persisting Green Lane memory', async () => {
    const memory = ZavorthMemoryLearningLoopService.createInMemoryForTests(
      () => new Date('2026-05-24T12:00:00.000Z'),
    );
    const service = new ZavorthNativeLearningLoopService({
      now: () => new Date('2026-05-24T12:00:00.000Z'),
      memoryLearningLoop: memory,
      replayLearning: { buildSnapshot: replaySnapshot },
      skillEvolution: { buildSnapshot: skillSnapshot },
    });

    const snapshot = await service.buildSnapshot({
      observation: 'The user prefers direct Portuguese answers with evidence.',
      userId: 'operator',
      sourceSurface: 'test',
    });
    const recall = await memory.search({
      query: 'direct Portuguese evidence',
      userId: 'operator',
    });

    expect(snapshot.summary.adaptiveLearningReady).toBe(true);
    expect(snapshot.summary.adaptiveTechnicalScannerReady).toBe(true);
    expect(snapshot.summary.adaptiveSemanticClassifierReady).toBe(true);
    expect(snapshot.summary.adaptiveMultilingualRecallReady).toBe(true);
    expect(snapshot.summary.adaptiveOperatorI18nReady).toBe(true);
    expect(snapshot.adaptiveLearning.summary.greenAutoApplied).toBeGreaterThanOrEqual(1);
    expect(snapshot.adaptiveLearning.classification.technical.scanned).toBe(true);
    expect(snapshot.adaptiveLearning.memoryWrites).toHaveLength(0);
    expect(recall.entries).toHaveLength(0);
  });
});
