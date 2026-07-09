import {
  TieredAutonomyClassifier,
  TieredApplier,
  type AutonomyTier,
} from '../../src/services/TieredAutonomyService';
import type { ZavorthNativeLearningLoopCandidate } from '../../src/contracts/native/ZavorthNativeLearningLoopContract';

function buildCandidate(overrides: Partial<ZavorthNativeLearningLoopCandidate> = {}): ZavorthNativeLearningLoopCandidate {
  return {
    id: 'test-candidate',
    kind: 'auto-skill-candidate',
    title: 'Test skill',
    summary: 'A test skill candidate',
    recommendation: 'Create this skill',
    confidence: 0.8,
    risk: 'low',
    state: 'suggested',
    approvalRequired: true,
    reversible: true,
    source: {
      surface: 'test',
      workspace: null,
      sessionId: null,
      evidenceRefs: [],
    },
    actions: [],
    safety: {
      rawSecretsSerialized: false,
      canModifySecurityPolicy: false,
      securityPolicyFirewall: true,
      untrustedEvidence: true,
    },
    ...overrides,
  };
}

describe('TieredAutonomyClassifier', () => {
  describe('classify', () => {
    it('assigns auto tier for low-risk style changes', () => {
      const classifier = new TieredAutonomyClassifier();
      const candidate = buildCandidate({
        risk: 'low',
        title: 'Use shorter greetings',
        summary: 'Make hello messages more concise',
      });

      const decision = classifier.classify(candidate);

      expect(decision.tier).toBe('auto');
      expect(decision.reversible).toBe(true);
    });

    it('assigns notify tier for medium-risk workflow patterns', () => {
      const classifier = new TieredAutonomyClassifier();
      const candidate = buildCandidate({
        risk: 'medium',
        title: 'Use web_search before read_file',
        summary: 'Workflow optimization for research tasks',
      });

      const decision = classifier.classify(candidate);

      expect(decision.tier).toBe('notify');
      expect(decision.undoWindowMs).toBe(30_000);
    });

    it('assigns approve tier for high-risk changes', () => {
      const classifier = new TieredAutonomyClassifier();
      const candidate = buildCandidate({
        risk: 'high',
        title: 'New memory access pattern',
        summary: 'Access cross-session memories',
      });

      const decision = classifier.classify(candidate);

      expect(decision.tier).toBe('approve');
    });

    it('forces approval for security-sensitive content', () => {
      const classifier = new TieredAutonomyClassifier();
      const candidate = buildCandidate({
        risk: 'low', // Even low risk
        title: 'Modify security policy',
        summary: 'Update firewall rules for new channel',
      });

      const decision = classifier.classify(candidate);

      expect(decision.tier).toBe('approve');
      expect(decision.reason).toContain('security-sensitive');
    });

    it('forces approval for user-model-update kind', () => {
      const classifier = new TieredAutonomyClassifier();
      const candidate = buildCandidate({
        risk: 'low',
        kind: 'user-model-update',
        title: 'Update user preferences',
      });

      const decision = classifier.classify(candidate);

      expect(decision.tier).toBe('approve');
    });

    it('forces approval for approved-nudge kind', () => {
      const classifier = new TieredAutonomyClassifier();
      const candidate = buildCandidate({
        risk: 'low',
        kind: 'approved-nudge',
        title: 'Suggest workflow improvement',
      });

      const decision = classifier.classify(candidate);

      expect(decision.tier).toBe('approve');
    });

    it('respects custom risk thresholds', () => {
      const classifier = new TieredAutonomyClassifier({
        autoRiskThreshold: 'medium',
        notifyRiskThreshold: 'high',
      });

      const lowCandidate = buildCandidate({ risk: 'low' });
      const medCandidate = buildCandidate({ risk: 'medium' });
      const highCandidate = buildCandidate({ risk: 'high' });

      expect(classifier.classify(lowCandidate).tier).toBe('auto');
      expect(classifier.classify(medCandidate).tier).toBe('auto');
      expect(classifier.classify(highCandidate).tier).toBe('notify');
    });

    it('respects custom force-approval kinds', () => {
      const classifier = new TieredAutonomyClassifier({
        forceApprovalKinds: ['procedural-memory'],
      });

      const candidate = buildCandidate({
        risk: 'low',
        kind: 'procedural-memory',
      });

      const decision = classifier.classify(candidate);

      expect(decision.tier).toBe('approve');
    });
  });

  describe('classifyAll', () => {
    it('classifies multiple candidates', () => {
      const classifier = new TieredAutonomyClassifier();
      const candidates = [
        buildCandidate({ id: 'a', risk: 'low' }),
        buildCandidate({ id: 'b', risk: 'high' }),
        buildCandidate({ id: 'c', risk: 'medium' }),
      ];

      const results = classifier.classifyAll(candidates);

      expect(results.size).toBe(3);
      expect(results.get('a')?.tier).toBe('auto');
      expect(results.get('b')?.tier).toBe('approve');
      expect(results.get('c')?.tier).toBe('notify');
    });
  });

  describe('fromProfile', () => {
    it('creates classifier from personal profile', () => {
      const classifier = TieredAutonomyClassifier.fromProfile('personal');

      const candidate = buildCandidate({ risk: 'medium' });
      const decision = classifier.classify(candidate);

      // Personal has autoRiskThreshold: medium, so medium risk should be auto
      expect(decision.tier).toBe('auto');
    });

    it('creates classifier from business profile', () => {
      const classifier = TieredAutonomyClassifier.fromProfile('business');

      const candidate = buildCandidate({ risk: 'low' });
      const decision = classifier.classify(candidate);

      // Business requires approval for everything
      expect(decision.tier).toBe('approve');
    });
  });
});

describe('TieredApplier', () => {
  it('applies auto-tier candidates immediately', async () => {
    const applied: string[] = [];
    const applier = new TieredApplier(
      async (candidate) => { applied.push(candidate.id); },
    );

    const result = await applier.apply({
      candidate: buildCandidate({ id: 'auto-1', risk: 'low' }),
      decision: {
        tier: 'auto',
        reason: 'Low risk',
        risk: 'low',
        reversible: true,
        undoWindowMs: 0,
      },
    });

    expect(result.applied).toBe(true);
    expect(result.notifyUser).toBe(false);
    expect(result.undoAvailable).toBe(false);
    expect(applied).toContain('auto-1');
  });

  it('applies notify-tier candidates and schedules undo', async () => {
    const applied: string[] = [];
    const notified: string[] = [];
    const applier = new TieredApplier(
      async (candidate) => { applied.push(candidate.id); },
      (candidate) => { notified.push(candidate.id); },
    );

    const result = await applier.apply({
      candidate: buildCandidate({ id: 'notify-1', risk: 'medium' }),
      decision: {
        tier: 'notify',
        reason: 'Medium risk',
        risk: 'medium',
        reversible: true,
        undoWindowMs: 5000,
      },
    });

    expect(result.applied).toBe(true);
    expect(result.notifyUser).toBe(true);
    expect(result.undoAvailable).toBe(true);
    expect(applied).toContain('notify-1');
    expect(notified).toContain('notify-1');
    expect(applier.getPendingUndoCount()).toBe(1);
  });

  it('does not apply approve-tier candidates', async () => {
    const applied: string[] = [];
    const applier = new TieredApplier(
      async (candidate) => { applied.push(candidate.id); },
    );

    const result = await applier.apply({
      candidate: buildCandidate({ id: 'approve-1', risk: 'high' }),
      decision: {
        tier: 'approve',
        reason: 'High risk',
        risk: 'high',
        reversible: true,
        undoWindowMs: 0,
      },
    });

    expect(result.applied).toBe(false);
    expect(applied).toHaveLength(0);
  });

  it('allows undo within window', async () => {
    const undone: string[] = [];
    const applier = new TieredApplier(
      async () => {},
      undefined,
      async (candidate) => { undone.push(candidate.id); },
    );

    await applier.apply({
      candidate: buildCandidate({ id: 'undo-1', risk: 'medium' }),
      decision: {
        tier: 'notify',
        reason: 'Medium risk',
        risk: 'medium',
        reversible: true,
        undoWindowMs: 5000,
      },
    });

    const undoResult = await applier.undo('undo-1');

    expect(undoResult).toBe(true);
    expect(undone).toContain('undo-1');
    expect(applier.getPendingUndoCount()).toBe(0);
  });

  it('rejects undo after window expires', async () => {
    const applier = new TieredApplier(
      async () => {},
      undefined,
      async () => {},
    );

    await applier.apply({
      candidate: buildCandidate({ id: 'expire-1', risk: 'medium' }),
      decision: {
        tier: 'notify',
        reason: 'Medium risk',
        risk: 'medium',
        reversible: true,
        undoWindowMs: 50, // 50ms window
      },
    });

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 100));

    const undoResult = await applier.undo('expire-1');

    expect(undoResult).toBe(false);
  });

  it('tracks receipts for audit trail', async () => {
    const applier = new TieredApplier(async () => {});

    await applier.apply({
      candidate: buildCandidate({ id: 'receipt-1', risk: 'low' }),
      decision: {
        tier: 'auto',
        reason: 'Low risk',
        risk: 'low',
        reversible: true,
        undoWindowMs: 0,
      },
    });

    const receipts = applier.getReceipts();

    expect(receipts).toHaveLength(1);
    expect(receipts[0].candidateId).toBe('receipt-1');
    expect(receipts[0].tier).toBe('auto');
    expect(receipts[0].status).toBe('applied');
  });
});
