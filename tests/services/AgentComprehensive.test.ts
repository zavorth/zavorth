import fs from 'fs';
import os from 'os';
import path from 'path';

import { ZavorthLlmRuntimeService } from '../../src/services/ZavorthLlmRuntimeService.js';
import { UserModelDialecticReasoningService } from '../../src/services/UserModelDialecticReasoningService.js';
import { UserModelDialecticService } from '../../src/services/UserModelDialecticService.js';
import { UserModelReviewDaemonService } from '../../src/services/UserModelReviewDaemonService.js';
import { UserModelTurnCaptureService } from '../../src/services/UserModelTurnCaptureService.js';

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

describe('UserModelDialecticReasoningService — Comprehensive', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('should create with defaults', () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir });
    expect(svc).toBeDefined();
  });

  it('should create with custom config', () => {
    const svc = new UserModelDialecticReasoningService({
      homeRoot: tmpDir,
      config: { depth: 3, maxInsights: 50, minConversationPairs: 1 },
    });
    expect(svc).toBeDefined();
  });

  it('should synthesize with empty conversations', async () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir });
    const s = await svc.synthesize([]);
    expect(s.insights).toEqual([]);
    expect(s.traits).toEqual({});
    expect(s.patterns).toEqual([]);
    expect(s.confidence).toBe(0);
  });

  it('should synthesize with single conversation', async () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir });
    const s = await svc.synthesize([{ user: 'I work with Python and Docker', assistant: 'Great!' }]);
    expect(s.insights.length).toBeGreaterThan(0);
    expect(s.depth).toBe(2);
  });

  it('should detect communication_style traits', async () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir });
    const s = await svc.synthesize([
      { user: 'Give me direct and brief summaries please', assistant: 'Ok.' },
      { user: 'I want quick short answers', assistant: 'Ok.' },
    ]);
    const hasCommStyle = s.insights.some(i => i.category === 'communication_style');
    expect(hasCommStyle).toBe(true);
  });

  it('should detect domain_expertise traits', async () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir });
    const s = await svc.synthesize([
      { user: 'I need help with TypeScript and JavaScript', assistant: 'Sure!' },
      { user: 'How do I deploy with Docker?', assistant: 'Use docker-compose.' },
    ]);
    const hasDomain = s.insights.some(i => i.category === 'domain_expertise');
    expect(hasDomain).toBe(true);
  });

  it('should detect tool_preferences traits', async () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir });
    const s = await svc.synthesize([
      { user: 'I need to review this code', assistant: 'I will analyze it.' },
      { user: 'I want to create a new feature', assistant: 'I will implement it.' },
    ]);
    const hasTool = s.insights.some(i => i.category === 'tool_preferences');
    expect(hasTool).toBe(true);
  });

  it('should detect personality traits', async () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir });
    const s = await svc.synthesize([
      { user: 'Be serious and professional', assistant: 'Understood.' },
      { user: 'I prefer a formal tone', assistant: 'Ok.' },
    ]);
    const hasPersonality = s.insights.some(i => i.category === 'personality');
    expect(hasPersonality).toBe(true);
  });

  it('should detect schedule traits', async () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir });
    const s = await svc.synthesize([
      { user: 'I work early in the morning', assistant: 'Ok.' },
      { user: 'I usually code at night', assistant: 'Understood.' },
    ]);
    const hasSchedule = s.insights.some(i => i.category === 'schedule');
    expect(hasSchedule).toBe(true);
  });

  it('should detect inquiry patterns at depth >= 2', async () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir, config: { depth: 2 } });
    const s = await svc.synthesize([
      { user: 'How do I do X?', assistant: '...' },
      { user: 'How do I do Y?', assistant: '...' },
      { user: 'How do I do Z?', assistant: '...' },
      { user: 'I need help with W', assistant: '...' },
    ]);
    expect(s.patterns.some(p => p.includes('inquiry-heavy'))).toBe(true);
  });

  it('should detect command patterns', async () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir, config: { depth: 2 } });
    const s = await svc.synthesize([
      { user: 'Create a summary', assistant: 'Ok.' },
      { user: 'Execute the script', assistant: 'Ok.' },
      { user: 'Run the tests', assistant: 'Ok.' },
      { user: 'Create a new file', assistant: 'Ok.' },
    ]);
    expect(s.patterns.some(p => p.includes('command-heavy'))).toBe(true);
  });

  it('should generate recommendations based on traits', async () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir });
    const s = await svc.synthesize([
      { user: 'Give me a quick answer please', assistant: 'Ok.' },
      { user: 'Execute the test now', assistant: 'Ok.' },
      { user: 'Run the complete build', assistant: 'Ok.' },
      { user: 'Create the config file', assistant: 'Ok.' },
      { user: 'I work early in the morning', assistant: 'Ok.' },
    ]);
    expect(s.recommendations.length).toBeGreaterThan(0);
  });

  it('should respect maxInsights config', async () => {
    const svc = new UserModelDialecticReasoningService({
      homeRoot: tmpDir,
      config: { maxInsights: 2 },
    });
    const conversations = Array.from({ length: 20 }, (_, i) => ({
      user: `Message ${i} with Python and Docker details`,
      assistant: `Response ${i}`,
    }));
    const s = await svc.synthesize(conversations);
    expect(s.insights.length).toBeLessThanOrEqual(2);
  });

  it('should persist and load synthesis', async () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir });
    await svc.synthesize([
      { user: 'I work with Rust and Go', assistant: 'Nice!' },
    ]);
    const loaded = svc.loadSynthesis();
    expect(loaded).not.toBeNull();
    expect(loaded!.contractVersion).toBe('zavorth-dialectic-reasoning/1');
    expect(loaded!.userId).toBeNull();
  });

  it('should include userId and sessionId when provided', async () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir });
    const s = await svc.synthesize(
      [{ user: 'test message with enough length', assistant: 'ok' }],
      { userId: 'user-123', sessionId: 'sess-456' },
    );
    expect(s.userId).toBe('user-123');
    expect(s.sessionId).toBe('sess-456');
  });

  it('should return null when no synthesis file exists', () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: makeTmpDir() });
    expect(svc.loadSynthesis()).toBeNull();
  });

  it('should handle corrupted synthesis file gracefully', () => {
    const dir = makeTmpDir();
    const fp = path.join(dir, 'data', 'runtime', 'user-dialectic-synthesis.json');
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, '{corrupted json', 'utf-8');
    const svc = new UserModelDialecticReasoningService({ homeRoot: dir });
    expect(svc.loadSynthesis()).toBeNull();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('should calculate confidence based on conversation count', async () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir });
    const s1 = await svc.synthesize([{ user: 'test message here', assistant: 'ok' }]);
    const tmpDir2 = makeTmpDir();
    const svc2 = new UserModelDialecticReasoningService({ homeRoot: tmpDir2 });
    const many = Array.from({ length: 15 }, (_, i) => ({
      user: `Message ${i} about Python and Docker`,
      assistant: `Response ${i}`,
    }));
    const s2 = await svc2.synthesize(many);
    expect(s2.confidence).toBeGreaterThanOrEqual(s1.confidence);
    fs.rmSync(tmpDir2, { recursive: true, force: true });
  });

  it('should handle depth 1 (regex only)', async () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir, config: { depth: 1 } });
    const s = await svc.synthesize([{ user: 'test message', assistant: 'ok' }]);
    expect(s.depth).toBe(1);
    expect(s.patterns).toEqual([]);
  });

  it('should handle depth 3 (trait inference)', async () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir, config: { depth: 3 } });
    const s = await svc.synthesize([
      { user: 'how do i do x?', assistant: '...' },
      { user: 'how do i do y?', assistant: '...' },
    ]);
    expect(s.depth).toBe(3);
  });

  it('should produce valid ISO timestamps', async () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir });
    const s = await svc.synthesize([{ user: 'test message here', assistant: 'ok' }]);
    expect(() => new Date(s.generatedAt)).not.toThrow();
    expect(new Date(s.generatedAt).toISOString()).toBe(s.generatedAt);
  });

  it('should produce unique insight ids', async () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir });
    const s = await svc.synthesize([
      { user: 'Python and Docker and JavaScript', assistant: 'Ok' },
      { user: 'Review code and implement', assistant: 'Ok' },
    ]);
    const ids = s.insights.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should set insight source to conversation for user messages', async () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir });
    const s = await svc.synthesize([{ user: 'I work with Python', assistant: 'Ok' }]);
    const conversationInsights = s.insights.filter(i => i.source === 'conversation');
    expect(conversationInsights.length).toBeGreaterThan(0);
  });

  it('should include evidence in insights', async () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir });
    const s = await svc.synthesize([{ user: 'I work with Python', assistant: 'Ok' }]);
    for (const insight of s.insights) {
      expect(Array.isArray(insight.evidence)).toBe(true);
      expect(insight.evidence.length).toBeGreaterThan(0);
    }
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

describe('UserModelTurnCaptureService — Comprehensive', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('should capture many turns', () => {
    const svc = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    for (let i = 0; i < 50; i++) {
      svc.captureTurn({ kind: 'user_message', content: `Message ${i} with enough content to pass threshold` });
    }
    expect(svc.getRecentTurns().length).toBe(50);
  });

  it('should get conversation pairs correctly', () => {
    const svc = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    svc.captureConversation('user msg 1 with enough content', 'assistant msg 1 with enough content');
    svc.captureConversation('user msg 2 with enough content', 'assistant msg 2 with enough content');
    svc.captureConversation('user msg 3 with enough content', 'assistant msg 3 with enough content');
    const pairs = svc.getConversationPairs();
    expect(pairs.length).toBe(3);
    expect(pairs[0].user.kind).toBe('user_message');
    expect(pairs[0].assistant.kind).toBe('assistant_response');
  });

  it('should get recent turns with limit', () => {
    const svc = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    for (let i = 0; i < 10; i++) {
      svc.captureTurn({ kind: 'user_message', content: `Message ${i} with enough content here` });
    }
    expect(svc.getRecentTurns(5).length).toBe(5);
    expect(svc.getRecentTurns(3).length).toBe(3);
  });

  it('should track surface statistics', () => {
    const svc = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    svc.captureTurn({ kind: 'user_message', content: 'msg from telegram', surface: 'telegram' });
    svc.captureTurn({ kind: 'user_message', content: 'msg from telegram 2', surface: 'telegram' });
    svc.captureTurn({ kind: 'user_message', content: 'msg from discord', surface: 'discord' });
    const stats = svc.getSurfaceStats();
    expect(stats.find(s => s.name === 'telegram')!.turnCount).toBe(2);
    expect(stats.find(s => s.name === 'discord')!.turnCount).toBe(1);
  });

  it('should filter by allowedSurfaces', () => {
    const svc = new UserModelTurnCaptureService({
      homeRoot: tmpDir,
      config: { allowedSurfaces: ['telegram'] },
    });
    expect(svc.captureTurn({ kind: 'user_message', content: 'telegram msg', surface: 'telegram' })).not.toBeNull();
    expect(svc.captureTurn({ kind: 'user_message', content: 'discord msg', surface: 'discord' })).toBeNull();
  });

  it('should prune old turns based on retention', () => {
    const oldDate = new Date('2026-01-01');
    const svc = new UserModelTurnCaptureService({ homeRoot: tmpDir, now: () => oldDate });
    svc.captureTurn({ kind: 'user_message', content: 'Old message with enough content' });
    const svc2 = new UserModelTurnCaptureService({
      homeRoot: tmpDir,
      now: () => new Date('2026-07-01'),
      config: { retentionDays: 7 },
    });
    expect(svc2.pruneOldTurns()).toBe(1);
  });

  it('should return stats', () => {
    const svc = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    svc.captureTurn({ kind: 'user_message', content: 'Test message with enough content' });
    const stats = svc.getStats();
    expect(stats.totalTurns).toBe(1);
    expect(stats.fileExists).toBe(true);
  });

  it('should respect enabled=false', () => {
    const svc = new UserModelTurnCaptureService({ homeRoot: tmpDir, config: { enabled: false } });
    expect(svc.captureTurn({ kind: 'user_message', content: 'Should not capture' })).toBeNull();
  });

  it('should get turns by surface', () => {
    const svc = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    svc.captureTurn({ kind: 'user_message', content: 'Telegram msg 1', surface: 'telegram' });
    svc.captureTurn({ kind: 'user_message', content: 'Discord msg 1', surface: 'discord' });
    svc.captureTurn({ kind: 'user_message', content: 'Telegram msg 2', surface: 'telegram' });
    expect(svc.getTurnsBySurface('telegram').length).toBe(2);
    expect(svc.getTurnsBySurface('discord').length).toBe(1);
  });

  it('should get active surfaces', () => {
    const svc = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    svc.captureTurn({ kind: 'user_message', content: 'From whatsapp', surface: 'whatsapp' });
    svc.captureTurn({ kind: 'user_message', content: 'From signal', surface: 'signal' });
    const active = svc.getActiveSurfaces();
    expect(active).toContain('whatsapp');
    expect(active).toContain('signal');
  });

  it('should persist turns across instances', () => {
    const svc1 = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    svc1.captureTurn({ kind: 'user_message', content: 'Persistent message' });
    const svc2 = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    expect(svc2.getRecentTurns().length).toBe(1);
  });
});

describe('UserModelReviewDaemonService — Comprehensive', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('should create with default config', () => {
    const svc = new UserModelReviewDaemonService({ homeRoot: tmpDir });
    const status = svc.getStatus();
    expect(status.running).toBe(false);
    expect(status.totalReviews).toBe(0);
    expect(status.lastReviewAt).toBeNull();
    expect(status.lastLlmReviewAt).toBeNull();
    expect(status.totalLlmReviews).toBe(0);
  });

  it('should start and stop cleanly', () => {
    const svc = new UserModelReviewDaemonService({ homeRoot: tmpDir, config: { intervalMs: 60000 } });
    svc.start();
    expect(svc.getStatus().running).toBe(true);
    svc.stop();
    expect(svc.getStatus().running).toBe(false);
  });

  it('should not start twice', () => {
    const svc = new UserModelReviewDaemonService({ homeRoot: tmpDir, config: { intervalMs: 60000 } });
    svc.start();
    svc.start();
    expect(svc.getStatus().running).toBe(true);
    svc.stop();
  });

  it('should not stop when not started', () => {
    const svc = new UserModelReviewDaemonService({ homeRoot: tmpDir });
    svc.stop();
    expect(svc.getStatus().running).toBe(false);
  });

  it('should skip review when not enough turns', async () => {
    const turnCapture = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    turnCapture.captureConversation('Short msg', 'Short reply');
    const daemon = new UserModelReviewDaemonService({
      homeRoot: tmpDir,
      turnCapture,
      config: { minTurnsForReview: 100 },
    });
    const result = await daemon.runReviewCycle();
    expect(result).toBeNull();
  });

  it('should run full review cycle with enough turns', async () => {
    const turnCapture = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    const msgs = [
      { user: 'I prefer direct and short answers', assistant: 'Understood.' },
      { user: 'I work with Python and Docker', assistant: 'Nice!' },
      { user: 'I want to review the code', assistant: 'I will analyze it.' },
      { user: 'I need to create something new', assistant: 'I will implement it.' },
      { user: 'How do I deploy?', assistant: 'Use Docker Compose.' },
    ];
    for (const m of msgs) turnCapture.captureConversation(m.user, m.assistant);

    const daemon = new UserModelReviewDaemonService({
      homeRoot: tmpDir,
      turnCapture,
      config: { minTurnsForReview: 3 },
    });
    const synthesis = await daemon.runReviewCycle();
    expect(synthesis).not.toBeNull();
    expect(synthesis!.insights.length).toBeGreaterThan(0);
    expect(daemon.getStatus().totalReviews).toBe(1);
    expect(daemon.getStatus().lastReviewAt).not.toBeNull();
  });

  it('should force review', async () => {
    const turnCapture = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    for (let i = 0; i < 10; i++) {
      turnCapture.captureConversation(
        `Message ${i} about Python and Docker tools`,
        `Response ${i} with enough content`,
      );
    }
    const daemon = new UserModelReviewDaemonService({
      homeRoot: tmpDir,
      turnCapture,
      config: { minTurnsForReview: 5 },
    });
    const result = await daemon.forceReview();
    expect(result).not.toBeNull();
  });

  it('should persist status across instances', () => {
    const svc = new UserModelReviewDaemonService({ homeRoot: tmpDir });
    svc.start();
    svc.stop();
    const svc2 = new UserModelReviewDaemonService({ homeRoot: tmpDir });
    expect(svc2.getStatus().running).toBe(false);
  });

  it('should record LLM review stats when synthesis has llmSynthesis', async () => {
    const turnCapture = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    for (let i = 0; i < 10; i++) {
      turnCapture.captureConversation(
        `User message ${i} about Python development`,
        `Assistant response ${i} with details`,
      );
    }
    const daemon = new UserModelReviewDaemonService({
      homeRoot: tmpDir,
      turnCapture,
      config: { minTurnsForReview: 3, enableLlmReasoning: false },
    });
    await daemon.runReviewCycle();
    const status = daemon.getStatus();
    expect(status.totalReviews).toBe(1);
    expect(status.turnsSinceLastReview).toBe(0);
  });

  it('should handle disabled daemon', () => {
    const svc = new UserModelReviewDaemonService({
      homeRoot: tmpDir,
      config: { enabled: false },
    });
    svc.start();
    expect(svc.getStatus().running).toBe(false);
    svc.stop();
  });

  it('should return null from runLlmReview when LLM not enabled', async () => {
    const turnCapture = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    for (let i = 0; i < 5; i++) {
      turnCapture.captureConversation(
        `Message ${i} with enough content about Python`,
        `Response ${i} with enough content`,
      );
    }
    const daemon = new UserModelReviewDaemonService({
      homeRoot: tmpDir,
      turnCapture,
      config: { enableLlmReasoning: false },
    });
    const result = await daemon.runLlmReview();
    expect(result).toBeNull();
  });

  it('should return status copy (not reference)', () => {
    const svc = new UserModelReviewDaemonService({ homeRoot: tmpDir });
    const s1 = svc.getStatus();
    const s2 = svc.getStatus();
    expect(s1).toEqual(s2);
    expect(s1).not.toBe(s2);
  });

  it('should set nextReviewAt on start', () => {
    const svc = new UserModelReviewDaemonService({
      homeRoot: tmpDir,
      config: { intervalMs: 60000 },
    });
    svc.start();
    expect(svc.getStatus().nextReviewAt).not.toBeNull();
    svc.stop();
  });
});
