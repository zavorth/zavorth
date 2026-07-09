/**
 * Integration tests — Tiered Autonomy inside NativeLearningLoop.
 * Validates that candidates are classified and promoted/skipped based on tier.
 */
import { ZavorthNativeLearningLoopService } from '../../src/services/ZavorthNativeLearningLoopService';
import { TieredAutonomyClassifier } from '../../src/services/TieredAutonomyService';
import type { ZavorthNativeLearningLoopCandidate } from '../../src/contracts/native/ZavorthNativeLearningLoopContract';

// ── Stub services that return minimal valid snapshots ──────────

function stubMemoryLoop() {
  return {
    search: async () => ({ query: '', total: 0, topKOnly: true, untrustedOnRecall: true, entries: [] }),
    assessSkillCandidate: async () => null,
    buildStatus: async () => ({
      policy: { ftsTopKRecall: true, skillHighRiskBlocked: false },
      layers: {},
    }),
  };
}

function stubReplayLearning() {
  return {
    buildSnapshot: () => ({
      policy: { approvalRequiredForProfile: true },
      profile: {
        mode: 'suggest-only' as const,
        approvedRecordIds: [],
        revokedRecordIds: [],
        preferences: [],
        procedures: [],
        codingStyle: [],
        debugPatterns: [],
        skillCandidates: [],
      },
      records: [],
      summary: { pendingLearning: 0 },
    }),
  };
}

function stubSkillEvolution() {
  return {
    buildSnapshot: () => ({
      records: [],
      summary: { waitingApproval: 0, total: 0, drafts: 0, tested: 0, active: 0 },
    }),
  };
}

function stubProceduralMemory() {
  return {
    preview: () => ({
      status: 'empty',
      rule: null,
      receipt: { id: 'proc-receipt-1' },
    }),
    list: () => [],
  };
}

function stubAdaptiveLearning() {
  return {
    buildSnapshot: () => ({
      safety: {
        localOnly: true,
        redLaneNeverSilent: true,
        technicalScannerReady: true,
        semanticClassifierGoverned: true,
        multilingualRecallLocalOnly: true,
        operatorI18nReady: true,
      },
      classification: { technical: { scanned: true } },
      summary: { semanticClassifierUsed: false, multilingualRecallReady: true, i18nReady: true },
      invariants: { shadowLearningBeforePromotion: true },
    }),
    ingestObservation: async () => ({
      safety: {
        localOnly: true,
        redLaneNeverSilent: true,
        technicalScannerReady: true,
        semanticClassifierGoverned: true,
        multilingualRecallLocalOnly: true,
        operatorI18nReady: true,
      },
      classification: { technical: { scanned: true } },
      summary: { semanticClassifierUsed: true, multilingualRecallReady: true, i18nReady: true },
      invariants: { shadowLearningBeforePromotion: true },
    }),
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('Tiered Autonomy + NativeLearningLoop integration', () => {
  it('tiered autonomy counts are tracked even when candidates are quarantined', async () => {
    const service = new ZavorthNativeLearningLoopService({
      memoryLearningLoop: stubMemoryLoop(),
      replayLearning: stubReplayLearning(),
      skillEvolution: stubSkillEvolution(),
      proceduralMemory: stubProceduralMemory(),
      adaptiveLearning: stubAdaptiveLearning(),
      tieredAutonomy: new TieredAutonomyClassifier({
        autoRiskThreshold: 'low',
        notifyRiskThreshold: 'medium',
      }),
    });

    const snapshot = await service.buildSnapshot({
      observation: 'Use shorter greetings',
    });

    // Verify tiered autonomy is active and counts add up
    expect(snapshot.summary.tieredAutonomy).toBeDefined();
    const total = snapshot.summary.tieredAutonomy.auto
      + snapshot.summary.tieredAutonomy.notify
      + snapshot.summary.tieredAutonomy.approve;
    expect(total).toBe(snapshot.summary.candidates);

    // At least some candidates should exist
    expect(snapshot.summary.candidates).toBeGreaterThan(0);
  });

  it('security-sensitive candidates always require approval', async () => {
    const service = new ZavorthNativeLearningLoopService({
      memoryLearningLoop: stubMemoryLoop(),
      replayLearning: stubReplayLearning(),
      skillEvolution: stubSkillEvolution(),
      proceduralMemory: stubProceduralMemory(),
      adaptiveLearning: stubAdaptiveLearning(),
      tieredAutonomy: new TieredAutonomyClassifier(),
    });

    const snapshot = await service.buildSnapshot({
      observation: 'Modify security policy for new channel',
    });

    // The auto-skill-candidate should require approval (security-sensitive)
    const autoSkillCandidate = snapshot.candidates.find(
      (c) => c.kind === 'auto-skill-candidate',
    );

    expect(autoSkillCandidate).toBeDefined();
    expect(autoSkillCandidate?.approvalRequired).toBe(true);
    expect(snapshot.summary.tieredAutonomy.approve).toBeGreaterThanOrEqual(1);
  });

  it('user-model-update candidates always require approval', async () => {
    // Create a service that would produce user-model-update candidates
    const replayWithPending = {
      buildSnapshot: () => ({
        policy: { approvalRequiredForProfile: true },
        profile: {
          mode: 'suggest-only' as const,
          approvedRecordIds: [],
          revokedRecordIds: [],
          preferences: [{ id: 'p1', key: 'style', value: 'casual', confidence: 0.8 }],
          procedures: [],
          codingStyle: [],
          debugPatterns: [],
          skillCandidates: [],
        },
        records: [
          {
            id: 'r1',
            kind: 'preference',
            summary: 'User prefers casual tone',
            confidence: 0.8,
            status: 'waiting_approval',
            sourceSurface: 'replay',
            replayRef: 'rr1',
          },
        ],
        summary: { pendingLearning: 1 },
      }),
    };

    const service = new ZavorthNativeLearningLoopService({
      memoryLearningLoop: stubMemoryLoop(),
      replayLearning: replayWithPending,
      skillEvolution: stubSkillEvolution(),
      proceduralMemory: stubProceduralMemory(),
      adaptiveLearning: stubAdaptiveLearning(),
      tieredAutonomy: new TieredAutonomyClassifier(),
    });

    const snapshot = await service.buildSnapshot();

    // user-model-update candidates should always require approval
    const userModelCandidates = snapshot.candidates.filter(
      (c) => c.kind === 'user-model-update',
    );

    for (const candidate of userModelCandidates) {
      expect(candidate.approvalRequired).toBe(true);
    }
  });

  it('tiered autonomy counts are included in snapshot summary', async () => {
    const service = new ZavorthNativeLearningLoopService({
      memoryLearningLoop: stubMemoryLoop(),
      replayLearning: stubReplayLearning(),
      skillEvolution: stubSkillEvolution(),
      proceduralMemory: stubProceduralMemory(),
      adaptiveLearning: stubAdaptiveLearning(),
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.summary.tieredAutonomy).toBeDefined();
    expect(typeof snapshot.summary.tieredAutonomy.auto).toBe('number');
    expect(typeof snapshot.summary.tieredAutonomy.notify).toBe('number');
    expect(typeof snapshot.summary.tieredAutonomy.approve).toBe('number');
    expect(
      snapshot.summary.tieredAutonomy.auto
      + snapshot.summary.tieredAutonomy.notify
      + snapshot.summary.tieredAutonomy.approve,
    ).toBe(snapshot.summary.candidates);
  });

  it('formatSnapshotText includes tiered autonomy info', async () => {
    const service = new ZavorthNativeLearningLoopService({
      memoryLearningLoop: stubMemoryLoop(),
      replayLearning: stubReplayLearning(),
      skillEvolution: stubSkillEvolution(),
      proceduralMemory: stubProceduralMemory(),
      adaptiveLearning: stubAdaptiveLearning(),
    });

    const snapshot = await service.buildSnapshot();
    const text = service.formatSnapshotText(snapshot);

    expect(text).toContain('Tiered autonomy');
    expect(text).toContain('auto=');
    expect(text).toContain('notify=');
    expect(text).toContain('approve=');
  });
});
