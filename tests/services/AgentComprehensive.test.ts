import fs from 'fs';
import os from 'os';
import path from 'path';

import { ZavorthLlmRuntimeService } from '../../src/services/ZavorthLlmRuntimeService.js';
import { UserModelFactStore } from '../../src/services/user-model/UserModelFactStore.js';
import { UserModelTrajectoryReflectionService } from '../../src/services/user-model/UserModelTrajectoryReflectionService.js';
import { UserModelDialecticService } from '../../src/services/UserModelDialecticService.js';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-comprehensive-'));
}

describe('ZavorthLlmRuntimeService — Comprehensive', () => {
  it('should create with no args', () => {
    const svc = new ZavorthLlmRuntimeService();
    expect(svc).toBeDefined();
    expect(typeof svc.getPreferredProviderName).toBe('function');
  });

  it('should create with explicit provider', () => {
    const svc = new ZavorthLlmRuntimeService('gemini');
    expect(svc.getPreferredProviderName()).toBe('gemini');
  });

  it('should report availability for known providers', () => {
    const svc = new ZavorthLlmRuntimeService();
    expect(typeof svc.isProviderAvailable('gemini')).toBe('boolean');
    expect(typeof svc.isProviderAvailable('openai')).toBe('boolean');
  });

  it('should reject unregistered providers', () => {
    const svc = new ZavorthLlmRuntimeService();
    expect(() => svc.isProviderAvailable('nonexistent-provider-xyz')).toThrow(/Provider not registered/);
    expect(() => svc.isProviderAvailable('nonexistent-provider-xyz-12345')).toThrow(/Provider not registered/);
  });

  it('should have synthesize as async function', () => {
    const svc = new ZavorthLlmRuntimeService();
    expect(typeof svc.synthesize).toBe('function');
  });

  it('should have multiPassReasoning as async function', () => {
    const svc = new ZavorthLlmRuntimeService();
    expect(typeof svc.multiPassReasoning).toBe('function');
  });
});

describe('UserModelDialecticService — Comprehensive', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('should have 15 default questions', () => {
    const svc = new UserModelDialecticService({ homeRoot: tmpDir });
    expect(svc.getProfile().questions.length).toBe(15);
  });

  it('should cover all 6 trait categories', () => {
    const svc = new UserModelDialecticService({ homeRoot: tmpDir });
    const cats = new Set(svc.getProfile().questions.map(q => q.category));
    expect(cats.size).toBe(6);
    expect(cats.has('communication_style')).toBe(true);
    expect(cats.has('work_preferences')).toBe(true);
    expect(cats.has('domain_expertise')).toBe(true);
    expect(cats.has('tool_preferences')).toBe(true);
    expect(cats.has('schedule')).toBe(true);
    expect(cats.has('personality')).toBe(true);
  });

  it('should return questions sorted by priority', () => {
    const svc = new UserModelDialecticService({ homeRoot: tmpDir });
    const q1 = svc.getNextQuestion();
    expect(q1).not.toBeNull();
    expect(q1!.priority).toBeLessThanOrEqual(2);
  });

  it('should record multiple answers and update confidence', () => {
    const svc = new UserModelDialecticService({ homeRoot: tmpDir });
    const q1 = svc.getNextQuestion()!;
    svc.recordAnswer(q1.id, 'answer1');
    const q2 = svc.getNextQuestion()!;
    svc.recordAnswer(q2.id, 'answer2');
    const progress = svc.getProgress();
    expect(progress.answered).toBe(2);
    expect(progress.confidence).toBeGreaterThan(0);
  });

  it('should answer all questions and return null', () => {
    const svc = new UserModelDialecticService({ homeRoot: tmpDir });
    const questions = svc.getProfile().questions;
    for (const q of questions) {
      svc.recordAnswer(q.id, `answer for ${q.id}`);
    }
    expect(svc.getNextQuestion()).toBeNull();
    expect(svc.getProgress().answered).toBe(questions.length);
  });

  it('should getAnsweredQuestions', () => {
    const svc = new UserModelDialecticService({ homeRoot: tmpDir });
    const q = svc.getNextQuestion()!;
    svc.recordAnswer(q.id, 'my answer');
    expect(svc.getAnsweredQuestions().length).toBe(1);
    expect(svc.getAnsweredQuestions()[0].answer).toBe('my answer');
  });

  it('should getUnansweredQuestions', () => {
    const svc = new UserModelDialecticService({ homeRoot: tmpDir });
    const total = svc.getProfile().questions.length;
    const q = svc.getNextQuestion()!;
    svc.recordAnswer(q.id, 'answer');
    expect(svc.getUnansweredQuestions().length).toBe(total - 1);
  });

  it('should mark questions as asked', () => {
    const svc = new UserModelDialecticService({ homeRoot: tmpDir });
    const q = svc.getNextQuestion()!;
    svc.markAsked(q.id);
    const profile = svc.getProfile();
    const updated = profile.questions.find(qu => qu.id === q.id)!;
    expect(updated.askedCount).toBe(1);
    expect(updated.lastAskedAt).not.toBeNull();
  });

  it('should reset profile completely', () => {
    const svc = new UserModelDialecticService({ homeRoot: tmpDir });
    svc.recordAnswer(svc.getNextQuestion()!.id, 'test');
    svc.resetProfile();
    expect(svc.getProgress().answered).toBe(0);
    expect(svc.getProgress().confidence).toBe(0);
  });

  it('should persist across instances', () => {
    const svc1 = new UserModelDialecticService({ homeRoot: tmpDir });
    svc1.recordAnswer(svc1.getNextQuestion()!.id, 'persistent');
    const svc2 = new UserModelDialecticService({ homeRoot: tmpDir });
    expect(svc2.getProgress().answered).toBe(1);
  });

  it('should return null for all trait categories initially', () => {
    const svc = new UserModelDialecticService({ homeRoot: tmpDir });
    expect(svc.getTrait('communication_style')).toBeNull();
    expect(svc.getTrait('work_preferences')).toBeNull();
    expect(svc.getTrait('domain_expertise')).toBeNull();
    expect(svc.getTrait('tool_preferences')).toBeNull();
    expect(svc.getTrait('schedule')).toBeNull();
    expect(svc.getTrait('personality')).toBeNull();
  });

  it('should ignore markAsked for invalid id', () => {
    const svc = new UserModelDialecticService({ homeRoot: tmpDir });
    svc.markAsked('nonexistent-id');
    expect(svc.getProgress().asked).toBe(0);
  });

  it('should ignore recordAnswer for invalid id', () => {
    const svc = new UserModelDialecticService({ homeRoot: tmpDir });
    svc.recordAnswer('nonexistent-id', 'answer');
    expect(svc.getProgress().answered).toBe(0);
  });

  it('should return a copy of profile (not reference)', () => {
    const svc = new UserModelDialecticService({ homeRoot: tmpDir });
    const p1 = svc.getProfile();
    const p2 = svc.getProfile();
    expect(p1).toEqual(p2);
    expect(p1).not.toBe(p2);
  });
});

describe('UserModelFactStore — Comprehensive', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('should initialize cleanly and save facts', async () => {
    const store = new UserModelFactStore({ dataDir: path.join(tmpDir, 'user-model') });
    await store.initialize();
    const fact = await store.saveFact({
      id: 'fact-c1',
      userId: 'test-user',
      content: 'Uses dark mode in editor',
      kind: 'preference',
      category: 'ui_theme',
      status: 'active',
      version: 1,
      confidence: 0.9,
      evidence: [{ citation: 'User said dark mode please', timestamp: new Date().toISOString() }],
      source: 'explicit',
      language: 'en',
      surface: null,
      lastObservedAt: new Date().toISOString(),
      occurrences: 1,
    });
    expect(fact.id).toBe('fact-c1');
    const retrieved = await store.getFactById('fact-c1');
    expect(retrieved?.content).toBe('Uses dark mode in editor');
  });

  it('should deduplicate processed turns', async () => {
    const store = new UserModelFactStore({ dataDir: path.join(tmpDir, 'user-model') });
    await store.initialize();
    expect(store.isTurnProcessed('turn-100')).toBe(false);
    await store.markTurnProcessed('turn-100');
    expect(store.isTurnProcessed('turn-100')).toBe(true);
  });
});

describe('UserModelTrajectoryReflectionService — Comprehensive', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('should process turn and extract facts via llmInference mock', async () => {
    const store = new UserModelFactStore({ dataDir: path.join(tmpDir, 'user-model') });
    await store.initialize();
    const mockLlm = {
      synthesize: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          facts: [
            {
              content: 'Prefers concise explanations',
              kind: 'preference',
              category: 'style',
              citation: 'keep it short',
              confidenceScore: 0.85,
            },
          ],
          contradictions: [],
        }),
      }),
    };

    const service = new UserModelTrajectoryReflectionService({
      factStore: store,
      llmInference: mockLlm,
    });

    const result = await service.processTurn({
      turnId: 'turn-comprehensive-1',
      userId: 'test-user',
      userMessage: 'Please keep it short from now on',
      assistantText: 'Understood, will be brief.',
    });

    expect(result.extractedCount).toBe(1);
    expect(store.isTurnProcessed('turn-comprehensive-1')).toBe(true);
    const facts = await store.listFactsByUserId('test-user');
    expect(facts).toHaveLength(1);
    expect(facts[0].content).toBe('Prefers concise explanations');
  });

  it('should skip duplicate turns gracefully', async () => {
    const store = new UserModelFactStore({ dataDir: path.join(tmpDir, 'user-model') });
    await store.initialize();
    await store.markTurnProcessed('turn-already-done');

    const mockLlm = { synthesize: jest.fn() };
    const service = new UserModelTrajectoryReflectionService({
      factStore: store,
      llmInference: mockLlm,
    });

    const result = await service.processTurn({
      turnId: 'turn-already-done',
      userId: 'test-user',
      userMessage: 'Hello world again',
      assistantText: 'Hi!',
    });

    expect(result.extractedCount).toBe(0);
    expect(mockLlm.synthesize).not.toHaveBeenCalled();
  });
});
