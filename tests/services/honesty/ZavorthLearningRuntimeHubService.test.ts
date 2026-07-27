import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthLearningRuntimeHubService } from '../../../src/services/ZavorthLearningRuntimeHubService.js';
import { ZavorthAutonomousLearningWriteService } from '../../../src/services/ZavorthAutonomousLearningWriteService.js';
import { setLearningRuntimeMode } from '../../../src/services/ZavorthLearningRuntimePolicy.js';

describe('ZavorthLearningRuntimeHubService', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-learn-hub-'));
    setLearningRuntimeMode('autonomous', { projectRoot: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('closes the loop: write preference, inject prompt, undo', () => {
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
          turnId: 'turn-hub',
          sourceSurface: 'test',
          redactedObservation: 'user: I prefer short replies about topics\nassistant: ok',
        },
        candidates: [{
          candidateId: 'pref-hub-1',
          kind: 'preference',
          lane: 'green',
          risk: 'low',
          status: 'auto-applied',
          approvalRequired: false,
          evidenceRefs: ['turn:turn-hub'],
          confidence: 0.9,
          expiry: new Date(Date.now() + 86400000).toISOString(),
          receiptId: 'rcpt-hub',
          summary: 'I prefer short replies about topics',
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

    const hub = new ZavorthLearningRuntimeHubService({ projectRoot: tempDir });
    const snapshot = hub.buildSnapshot();
    expect(snapshot.items.length).toBe(1);
    expect(snapshot.promptBlock).toContain('I prefer short replies');
    expect(snapshot.promptBlock).toContain('learned_preferences');
    // Free-text NLU packs removed (agent-first).
    expect(hub.matchNaturalCommand('o que you aprendeu-')).toBeNull();
    expect(hub.matchNaturalCommand('desfazer aprendizado curtas')).toBeNull();

    const undone = hub.undo(snapshot.items[0].id);
    expect(undone.ok).toBe(true);
    expect(hub.listLearned().length).toBe(0);
  });

  it('undo matches unique substring and fails closed when ambiguous', () => {
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
    const writer = new ZavorthAutonomousLearningWriteService({
      projectRoot: tempDir,
      userId: 'sub-user',
      policy,
    });
    writer.applyFromSpine({
      learning: {
        version: 'experience-learning-daemon/v1',
        generatedAt: new Date().toISOString(),
        status: 'ready',
        preTurnRecall: { ranBeforeTurn: false, query: null, results: [] },
        postTurnReview: {
          ranAfterSuccessfulTurn: true,
          turnId: 'turn-sub-1',
          sourceSurface: 'test',
          redactedObservation: 'user: I prefer short bullets\nassistant: ok',
        },
        candidates: [{
          candidateId: 'pref-sub-1',
          kind: 'preference',
          lane: 'green',
          risk: 'low',
          status: 'auto-applied',
          approvalRequired: false,
          evidenceRefs: ['turn:turn-sub-1'],
          confidence: 0.9,
          expiry: new Date(Date.now() + 86400000).toISOString(),
          receiptId: 'rcpt-sub-1',
          summary: 'I prefer short bullets',
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
    writer.applyFromSpine({
      learning: {
        version: 'experience-learning-daemon/v1',
        generatedAt: new Date().toISOString(),
        status: 'ready',
        preTurnRecall: { ranBeforeTurn: false, query: null, results: [] },
        postTurnReview: {
          ranAfterSuccessfulTurn: true,
          turnId: 'turn-sub-2',
          sourceSurface: 'test',
          redactedObservation: 'user: I prefer tables longas\nassistant: ok',
        },
        candidates: [{
          candidateId: 'pref-sub-2',
          kind: 'preference',
          lane: 'green',
          risk: 'low',
          status: 'auto-applied',
          approvalRequired: false,
          evidenceRefs: ['turn:turn-sub-2'],
          confidence: 0.9,
          expiry: new Date(Date.now() + 86400000).toISOString(),
          receiptId: 'rcpt-sub-2',
          summary: 'I prefer tables longas',
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

    const hub = new ZavorthLearningRuntimeHubService({ projectRoot: tempDir, userId: 'sub-user' });
    expect(hub.listLearned().length).toBe(2);

    const unique = hub.undo('bullets');
    expect(unique.ok).toBe(true);
    expect(hub.listLearned().length).toBe(1);
    expect(hub.listLearned()[0].summary).toContain('tables');

    // Restore second style for ambiguity: write another pref that shares "I prefer"
    writer.applyFromSpine({
      learning: {
        version: 'experience-learning-daemon/v1',
        generatedAt: new Date().toISOString(),
        status: 'ready',
        preTurnRecall: { ranBeforeTurn: false, query: null, results: [] },
        postTurnReview: {
          ranAfterSuccessfulTurn: true,
          turnId: 'turn-sub-3',
          sourceSurface: 'test',
          redactedObservation: 'user: I prefer numbered lists\nassistant: ok',
        },
        candidates: [{
          candidateId: 'pref-sub-3',
          kind: 'preference',
          lane: 'green',
          risk: 'low',
          status: 'auto-applied',
          approvalRequired: false,
          evidenceRefs: ['turn:turn-sub-3'],
          confidence: 0.9,
          expiry: new Date(Date.now() + 86400000).toISOString(),
          receiptId: 'rcpt-sub-3',
          summary: 'I prefer numbered lists',
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
    const hub2 = new ZavorthLearningRuntimeHubService({ projectRoot: tempDir, userId: 'sub-user' });
    expect(hub2.listLearned().length).toBe(2);
    const ambiguous = hub2.undo('I prefer');
    expect(ambiguous.ok).toBe(false);
    expect(ambiguous.summary).toMatch(/varios|id exato/i);
    expect(hub2.listLearned().length).toBe(2);
  });
});
