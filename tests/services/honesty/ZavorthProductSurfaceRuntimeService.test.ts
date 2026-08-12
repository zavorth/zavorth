import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthAutonomousLearningWriteService } from '../../../src/services/ZavorthAutonomousLearningWriteService.js';
import { ZavorthLearningRuntimeHubService } from '../../../src/services/ZavorthLearningRuntimeHubService.js';
import { setLearningRuntimeMode } from '../../../src/services/ZavorthLearningRuntimePolicy.js';
import {
  getProductSurfaceRuntime,
  type ProductSurfaceId,
} from '../../../src/services/ZavorthProductSurfaceRuntimeService.js';
import type { ZavorthExperienceLearningDaemonSnapshot } from '../../../src/contracts/native/ZavorthNativeAutonomySpineContract.js';

const AUTONOMOUS_POLICY = {
  contractVersion: 'zavorth-learning-runtime-policy/1' as const,
  mode: 'autonomous' as const,
  source: 'explicit' as const,
  securityProfileId: 'personal',
  autoWriteGreenPreferences: true,
  autoMaterializeYellowSkillDrafts: false,
  autoInstallSkills: false,
  canModifySecurityPolicy: false,
  userConsentRequired: false,
  summary: 'autonomous',
};

function learningSnapshotWithGreenPreference(
  summary: string,
  overrides: Partial<ZavorthExperienceLearningDaemonSnapshot> = {},
): ZavorthExperienceLearningDaemonSnapshot {
  const turnId = `turn-${summary.replace(/\W+/g, '-').slice(0, 24)}`;
  return {
    version: 'experience-learning-daemon/v1',
    generatedAt: new Date().toISOString(),
    status: 'ready',
    preTurnRecall: { ranBeforeTurn: false, query: null, results: [] },
    postTurnReview: {
      ranAfterSuccessfulTurn: true,
      turnId,
      sourceSurface: 'test',
      redactedObservation: `user: ${summary}\nassistant: ok`,
    },
    candidates: [{
      candidateId: `cand-pref-${turnId}`,
      kind: 'preference',
      lane: 'green',
      risk: 'low',
      status: 'auto-applied',
      approvalRequired: false,
      evidenceRefs: [`turn:${turnId}`],
      confidence: 0.9,
      expiry: new Date(Date.now() + 86400000).toISOString(),
      receiptId: `rcpt-${turnId}`,
      summary,
    }],
    safety: {
      redactionBeforeClassification: true,
      rawSecretsSerialized: false,
      psychologicalInferencesNeverGreen: true,
      policyChangesNeverGreen: true,
      receiptsRequired: true,
    },
    ...overrides,
  };
}

describe('ZavorthProductSurfaceRuntimeService honesty', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-product-surface-'));
    setLearningRuntimeMode('autonomous', { projectRoot: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('isolates preferences per userId across surfaces', () => {
    const writerA = new ZavorthAutonomousLearningWriteService({
      projectRoot: tempDir,
      userId: 'user-a',
      policy: AUTONOMOUS_POLICY,
    });
    const writerB = new ZavorthAutonomousLearningWriteService({
      projectRoot: tempDir,
      userId: 'user-b',
      policy: AUTONOMOUS_POLICY,
    });

    const writeA = writerA.applyFromSpine({
      learning: learningSnapshotWithGreenPreference('prefiro bullets'),
      sourceSurface: 'telegram',
    });
    const writeB = writerB.applyFromSpine({
      learning: learningSnapshotWithGreenPreference('prefiro tabelas'),
      sourceSurface: 'discord',
    });
    expect(writeA.appliedPreferences).toBe(1);
    expect(writeB.appliedPreferences).toBe(1);

    const runtime = getProductSurfaceRuntime(tempDir);
    const injectA = runtime.formatInjectBlocks({ userId: 'user-a' });
    const injectB = runtime.formatInjectBlocks({ userId: 'user-b' });

    expect(injectA).toContain('prefiro bullets');
    expect(injectA).not.toContain('prefiro tabelas');
    expect(injectB).toContain('prefiro tabelas');
    expect(injectB).not.toContain('prefiro bullets');

    // Same userId yields the same learning inject regardless of how the caller got the runtime
    const injectTelegram = getProductSurfaceRuntime(tempDir).formatInjectBlocks({ userId: 'user-a' });
    const injectDiscord = getProductSurfaceRuntime(tempDir).formatInjectBlocks({ userId: 'user-a' });
    expect(injectTelegram).toBe(injectDiscord);
    expect(injectTelegram).toContain('prefiro bullets');
    expect(injectTelegram).not.toContain('prefiro tabelas');

    const hubA = new ZavorthLearningRuntimeHubService({ projectRoot: tempDir, userId: 'user-a' });
    const hubB = new ZavorthLearningRuntimeHubService({ projectRoot: tempDir, userId: 'user-b' });
    expect(hubA.listLearned().length).toBe(1);
    expect(hubB.listLearned().length).toBe(1);

    const undone = hubA.undo(hubA.listLearned()[0].id);
    expect(undone.ok).toBe(true);
    expect(hubA.listLearned().length).toBe(0);
    expect(hubB.listLearned().length).toBe(1);
    expect(hubB.listLearned()[0].summary).toContain('prefiro tabelas');

    const injectAAfter = runtime.formatInjectBlocks({ userId: 'user-a' });
    const injectBAfter = runtime.formatInjectBlocks({ userId: 'user-b' });
    expect(injectAAfter).not.toContain('prefiro bullets');
    expect(injectBAfter).toContain('prefiro tabelas');
  });

  it('recordSuccessfulTurn accepts any surface equally', async () => {
    const surfaces: ProductSurfaceId[] = [
      'telegram',
      'discord',
      'web',
      'cli',
      'conversational',
      'agent-run',
    ];
    const runtime = getProductSurfaceRuntime(tempDir);

    for (const surface of surfaces) {
      const result = await runtime.recordSuccessfulTurn({
        surface,
        userId: 'surface-user',
        userMessage: `hello from ${surface}`,
        assistantText: `ack from ${surface}`,
        turnId: `turn-${surface}`,
      });
      expect(result).toEqual(expect.objectContaining({
        ok: expect.any(Boolean),
        mode: expect.any(String),
        appliedPreferences: expect.any(Number),
        draftedSkills: expect.any(Number),
      }));
      // Mode is resolved from project policy even when spine does not extract candidates
      // (telegram/whatsapp may skip durable write when allowlists reject the actor)
      expect(['autonomous', 'governed', 'skipped', 'skipped-no-write-permission']).toContain(result.mode);
    }
  });

  it('skips durable write when allowLearningWrite is false', async () => {
    const runtime = getProductSurfaceRuntime(tempDir);
    const result = await runtime.recordSuccessfulTurn({
      surface: 'telegram',
      userId: 'non-op',
      userMessage: 'prefiro respostas curtas',
      assistantText: 'ok',
      allowLearningWrite: false,
    });
    expect(result).toEqual({
      ok: false,
      mode: 'skipped-no-write-permission',
      appliedPreferences: 0,
      draftedSkills: 0,
    });
    const storePath = path.join(tempDir, 'data', 'runtime', 'learning', 'users', 'non-op', 'trusted-preferences.json');
    expect(fs.existsSync(storePath)).toBe(false);
  });

  it('wraps learned inject and keeps superpowers free of raw learned text', () => {
    const writer = new ZavorthAutonomousLearningWriteService({
      projectRoot: tempDir,
      userId: 'wrap-user',
      policy: AUTONOMOUS_POLICY,
    });
    writer.applyFromSpine({
      learning: learningSnapshotWithGreenPreference('prefiro respostas curtas em topicos'),
      sourceSurface: 'telegram',
    });

    const inject = getProductSurfaceRuntime(tempDir).formatInjectBlocks({ userId: 'wrap-user' });
    expect(inject).toContain('<learned_preferences');
    expect(inject).toContain('</learned_preferences>');
    expect(inject).toContain('prefiro respostas curtas');
    // Superpowers inject omits category=aprendido raw re-emit (learned lives only in wrapped block)
    expect(inject).toContain('Learned preferences are supplied only via the separate untrusted learned_preferences block.');
    expect(inject).not.toMatch(/Seu jeito:.*prefiro respostas curtas/);
  });

  it('store paths include users/{userId}/', () => {
    const writer = new ZavorthAutonomousLearningWriteService({
      projectRoot: tempDir,
      userId: 'user-a',
      policy: AUTONOMOUS_POLICY,
    });

    expect(writer.preferenceStorePath).toContain(`${path.sep}users${path.sep}user-a${path.sep}`);
    expect(writer.preferenceStorePath.endsWith(`${path.sep}trusted-preferences.json`)).toBe(true);

    writer.applyFromSpine({
      learning: learningSnapshotWithGreenPreference('prefiro bullets'),
      sourceSurface: 'cli',
    });
    expect(fs.existsSync(writer.preferenceStorePath)).toBe(true);

    const other = new ZavorthAutonomousLearningWriteService({
      projectRoot: tempDir,
      userId: 'user-b',
      policy: AUTONOMOUS_POLICY,
    });
    expect(other.preferenceStorePath).toContain(`${path.sep}users${path.sep}user-b${path.sep}`);
    expect(other.preferenceStorePath).not.toBe(writer.preferenceStorePath);
  });
});
