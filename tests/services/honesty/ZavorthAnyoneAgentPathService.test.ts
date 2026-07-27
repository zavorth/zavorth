import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthAnyoneAgentPathService } from '../../../src/services/ZavorthAnyoneAgentPathService.js';
import { ZavorthAutonomousLearningWriteService } from '../../../src/services/ZavorthAutonomousLearningWriteService.js';

describe('ZavorthAnyoneAgentPathService', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-anyone-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('builds A-D phases for a fresh workspace', () => {
    const service = new ZavorthAnyoneAgentPathService({ projectRoot: tempDir, env: {} });
    const snapshot = service.buildSnapshot();
    expect(snapshot.contractVersion).toBe('zavorth-anyone-agent-path/1');
    expect(snapshot.areas.map((area) => area.id)).toEqual(['learning', 'first-run', 'superpowers', 'reach']);
    expect(snapshot.onboarding.completed).toBe(false);
    expect(snapshot.superpowers.length).toBeGreaterThan(3);
    expect(snapshot.reach.some((channel) => channel.id === 'telegram')).toBe(true);
  });

  it('onboards personal learning path in human terms', () => {
    const service = new ZavorthAnyoneAgentPathService({
      projectRoot: tempDir,
      env: {},
    });
    const snapshot = service.onboard({
      language: 'pt',
      surface: 'telegram',
      allowLearning: true,
      applyPersonalPreset: false,
    });
    expect(snapshot.onboarding.completed).toBe(true);
    expect(snapshot.onboarding.surface).toBe('telegram');
    expect(snapshot.learning.policy.mode).toBe('autonomous');
    expect(snapshot.areas.find((area) => area.id === 'first-run')?.status).toBe('ready');
    expect(snapshot.areas.find((area) => area.id === 'learning')?.status).toBe('ready');
  });

  it('lists and undoes learned preferences', () => {
    const writer = new ZavorthAutonomousLearningWriteService({
      projectRoot: tempDir,
      policy: {
        contractVersion: 'zavorth-learning-runtime-policy/1',
        mode: 'autonomous',
        source: 'explicit',
        securityProfileId: 'personal',
        autoWriteGreenPreferences: true,
        autoMaterializeYellowSkillDrafts: false,
        autoInstallSkills: false,
        canModifySecurityPolicy: false,
        userConsentRequired: false,
        summary: 'autonomous',
      },
    });
    writer.applyFromSpine({
      learning: {
        version: 'experience-learning-daemon/v1',
        generatedAt: new Date().toISOString(),
        status: 'ready',
        preTurnRecall: { ranBeforeTurn: false, query: null, results: [] },
        postTurnReview: {
          ranAfterSuccessfulTurn: true,
          turnId: 't1',
          sourceSurface: 'test',
          redactedObservation: 'prefer bullets',
        },
        candidates: [{
          candidateId: 'cand-1',
          kind: 'preference',
          lane: 'green',
          risk: 'low',
          status: 'auto-applied',
          approvalRequired: false,
          evidenceRefs: ['turn:t1'],
          confidence: 0.9,
          expiry: new Date(Date.now() + 86400000).toISOString(),
          receiptId: 'r1',
          summary: 'I prefer answers in bullet points.',
        }],
        safety: {
          redactionBeforeClassification: true,
          rawSecretsSerialized: false,
          psychologicalInferencesNeverGreen: true,
          policyChangesNeverGreen: true,
          receiptsRequired: true,
        },
      },
    });

    const service = new ZavorthAnyoneAgentPathService({ projectRoot: tempDir, env: {} });
    const before = service.buildSnapshot();
    expect(before.learning.learned.length).toBe(1);
    const id = before.learning.learned[0].id;
    const undone = service.undoLearned(id);
    expect(undone.ok).toBe(true);
    expect(undone.snapshot.learning.learned.length).toBe(0);
  });

  it('lists learned preferences only for the scoped userId', () => {
    const policy = {
      contractVersion: 'zavorth-learning-runtime-policy/1' as const,
      mode: 'autonomous' as const,
      source: 'explicit' as const,
      securityProfileId: 'personal',
      autoWriteGreenPreferences: true,
      autoMaterializeYellowSkillDrafts: false,
      autoInstallSkills: false,
      canModifySecurityPolicy: false as const,
      userConsentRequired: false,
      summary: 'autonomous',
    };
    new ZavorthAutonomousLearningWriteService({
      projectRoot: tempDir,
      userId: 'alice',
      policy,
    }).applyFromSpine({
      learning: {
        version: 'experience-learning-daemon/v1',
        generatedAt: new Date().toISOString(),
        status: 'ready',
        preTurnRecall: { ranBeforeTurn: false, query: null, results: [] },
        postTurnReview: {
          ranAfterSuccessfulTurn: true,
          turnId: 't-alice',
          sourceSurface: 'cli',
          redactedObservation: 'alice bullets',
        },
        candidates: [{
          candidateId: 'cand-alice',
          kind: 'preference',
          lane: 'green',
          risk: 'low',
          status: 'auto-applied',
          approvalRequired: false,
          evidenceRefs: ['turn:t-alice'],
          confidence: 0.9,
          expiry: new Date(Date.now() + 86400000).toISOString(),
          receiptId: 'r-alice',
          summary: 'Alice prefere bullets',
        }],
        safety: {
          redactionBeforeClassification: true,
          rawSecretsSerialized: false,
          psychologicalInferencesNeverGreen: true,
          policyChangesNeverGreen: true,
          receiptsRequired: true,
        },
      },
    });

    const alice = new ZavorthAnyoneAgentPathService({ projectRoot: tempDir, env: {}, userId: 'alice' });
    const bob = new ZavorthAnyoneAgentPathService({ projectRoot: tempDir, env: {}, userId: 'bob' });
    expect(alice.buildSnapshot().learning.learned.some((item) => item.summary.includes('Alice'))).toBe(true);
    expect(bob.buildSnapshot().learning.learned.length).toBe(0);
  });
});
