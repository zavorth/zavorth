import fs from 'fs';
import os from 'os';
import path from 'path';

import { UserModelTurnCaptureService } from '../../src/services/UserModelTurnCaptureService.js';
import { UserModelDialecticReasoningService } from '../../src/services/UserModelDialecticReasoningService.js';
import { UserModelReviewDaemonService } from '../../src/services/UserModelReviewDaemonService.js';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-user-model-test-'));
}

describe('UserModelTurnCaptureService', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('should capture a user turn', () => {
    const svc = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    const turn = svc.captureTurn({ kind: 'user_message', content: 'Hello world' });
    expect(turn).not.toBeNull();
    expect(turn!.kind).toBe('user_message');
    expect(turn!.content).toBe('Hello world');
  });

  it('should skip short content', () => {
    const svc = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    const turn = svc.captureTurn({ kind: 'user_message', content: 'hi' });
    expect(turn).toBeNull();
  });

  it('should capture conversation pair', () => {
    const svc = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    const [user, assistant] = svc.captureConversation('Hello', 'Hi there!');
    expect(user).not.toBeNull();
    expect(assistant).not.toBeNull();
    expect(user!.kind).toBe('user_message');
    expect(assistant!.kind).toBe('assistant_response');
  });

  it('should persist turns to file', () => {
    const svc = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    svc.captureTurn({ kind: 'user_message', content: 'Test message' });
    const recent = svc.getRecentTurns();
    expect(recent.length).toBe(1);
    expect(recent[0].content).toBe('Test message');
  });

  it('should get conversation pairs', () => {
    const svc = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    svc.captureConversation('Question one about topic', 'Answer one about topic');
    svc.captureConversation('Question two about other', 'Answer two about other');
    const pairs = svc.getConversationPairs();
    expect(pairs.length).toBe(2);
    expect(pairs[0].user.content).toBe('Question one about topic');
    expect(pairs[1].assistant.content).toBe('Answer two about other');
  });

  it('should prune old turns', () => {
    const svc = new UserModelTurnCaptureService({ homeRoot: tmpDir, now: () => new Date('2026-06-01') });
    svc.captureTurn({ kind: 'user_message', content: 'Old message' });
    const svc2 = new UserModelTurnCaptureService({ homeRoot: tmpDir, now: () => new Date('2026-07-01'), config: { retentionDays: 7 } });
    const pruned = svc2.pruneOldTurns();
    expect(pruned).toBe(1);
  });

  it('should report stats', () => {
    const svc = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    svc.captureTurn({ kind: 'user_message', content: 'Test message here' });
    const stats = svc.getStats();
    expect(stats.totalTurns).toBe(1);
    expect(stats.fileExists).toBe(true);
  });

  it('should respect enabled=false', () => {
    const svc = new UserModelTurnCaptureService({ homeRoot: tmpDir, config: { enabled: false } });
    const turn = svc.captureTurn({ kind: 'user_message', content: 'Should not capture' });
    expect(turn).toBeNull();
  });

  it('should accept any surface string', () => {
    const svc = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    const turn = svc.captureTurn({ kind: 'user_message', content: 'Message from matrix', surface: 'matrix' });
    expect(turn).not.toBeNull();
    expect(turn!.surface).toBe('matrix');
  });

  it('should normalize surface names', () => {
    const svc = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    const turn = svc.captureTurn({ kind: 'user_message', content: 'Message from Telegram', surface: 'Telegram' });
    expect(turn!.surface).toBe('telegram');
  });

  it('should track surface stats', () => {
    const svc = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    svc.captureTurn({ kind: 'user_message', content: 'Message from telegram', surface: 'telegram' });
    svc.captureTurn({ kind: 'user_message', content: 'Another telegram message', surface: 'telegram' });
    svc.captureTurn({ kind: 'user_message', content: 'Message from discord', surface: 'discord' });

    const stats = svc.getSurfaceStats();
    expect(stats.length).toBe(2);
    expect(stats[0].name).toBe('telegram');
    expect(stats[0].turnCount).toBe(2);
    expect(stats[1].name).toBe('discord');
    expect(stats[1].turnCount).toBe(1);
  });

  it('should return active surfaces', () => {
    const svc = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    svc.captureTurn({ kind: 'user_message', content: 'From whatsapp', surface: 'whatsapp' });
    svc.captureTurn({ kind: 'user_message', content: 'From signal', surface: 'signal' });

    const active = svc.getActiveSurfaces();
    expect(active).toContain('whatsapp');
    expect(active).toContain('signal');
  });

  it('should filter by allowedSurfaces when set', () => {
    const svc = new UserModelTurnCaptureService({
      homeRoot: tmpDir,
      config: { allowedSurfaces: ['telegram', 'discord'] },
    });
    const allowed = svc.captureTurn({ kind: 'user_message', content: 'Allowed message', surface: 'telegram' });
    const blocked = svc.captureTurn({ kind: 'user_message', content: 'Blocked message', surface: 'matrix' });
    expect(allowed).not.toBeNull();
    expect(blocked).toBeNull();
  });

  it('should accept all 40+ known surfaces', () => {
    const svc = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    const surfaces = ['telegram', 'discord', 'whatsapp', 'slack', 'email', 'signal',
      'imessage', 'teams', 'instagram', 'matrix', 'irc', 'line', 'feishu',
      'google-chat', 'qq', 'zalo', 'wecom', 'weixin', 'yuanbao', 'sms',
      'home-assistant', 'voice-call', 'google-meet', 'twitch', 'nextcloud-talk',
      'mattermost', 'synology-chat', 'nostr', 'simple', 'dashboard', 'desktop',
      'api', 'websocket', 'mcp', 'satellite', 'companion', 'bridge', 'cron'];

    for (const surface of surfaces) {
      const turn = svc.captureTurn({ kind: 'user_message', content: `Message from ${surface}`, surface });
      expect(turn).not.toBeNull();
    }

    const stats = svc.getSurfaceStats();
    expect(stats.length).toBe(surfaces.length);
  });

  it('should get turns by surface', () => {
    const svc = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    svc.captureTurn({ kind: 'user_message', content: 'Telegram message one', surface: 'telegram' });
    svc.captureTurn({ kind: 'user_message', content: 'Discord message one', surface: 'discord' });
    svc.captureTurn({ kind: 'user_message', content: 'Telegram message two', surface: 'telegram' });

    const telegramTurns = svc.getTurnsBySurface('telegram');
    expect(telegramTurns.length).toBe(2);
    const discordTurns = svc.getTurnsBySurface('discord');
    expect(discordTurns.length).toBe(1);
  });
});

describe('UserModelDialecticReasoningService', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('should synthesize from conversations', async () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir });
    const conversations = [
      { user: 'Give me a direct summary', assistant: 'Ok, short summary.' },
      { user: 'I prefer detailed answers', assistant: 'Understood.' },
      { user: 'I work with Python', assistant: 'Nice!' },
    ];
    const synthesis = await svc.synthesize(conversations);
    expect(synthesis.insights.length).toBeGreaterThan(0);
    expect(synthesis.traits).toBeDefined();
    expect(synthesis.confidence).toBeGreaterThan(0);
  });

  it('should find cross-conversation patterns', async () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir, config: { depth: 2 } });
    const conversations = [
      { user: 'How to do X-', assistant: '...' },
      { user: 'How to do Y-', assistant: '...' },
      { user: 'How to do Z-', assistant: '...' },
      { user: 'I need help', assistant: '...' },
    ];
    const synthesis = await svc.synthesize(conversations);
    expect(synthesis.patterns.length).toBeGreaterThan(0);
  });

  it('should generate recommendations', async () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir });
    const conversations = [
      { user: 'Do this quickly', assistant: 'Ok.' },
      { user: 'I want short answers', assistant: 'Ok.' },
    ];
    const synthesis = await svc.synthesize(conversations);
    expect(synthesis.recommendations.length).toBeGreaterThan(0);
  });

  it('should persist synthesis', async () => {
    const svc = new UserModelDialecticReasoningService({ homeRoot: tmpDir });
    await svc.synthesize([
      { user: 'Prefiro respostas diretas e curtas', assistant: 'Entendido, vou ser direto.' },
      { user: 'Trabalho com Python e Docker', assistant: 'Legal, posso ajudar com isso.' },
    ]);
    const loaded = svc.loadSynthesis();
    expect(loaded).not.toBeNull();
    expect(loaded!.insights.length).toBeGreaterThan(0);
  });

  it('should respect depth level', async () => {
    const svc1 = new UserModelDialecticReasoningService({ homeRoot: tmpDir, config: { depth: 1 } });
    const s1 = await svc1.synthesize([{ user: 'test message here', assistant: 'ok' }]);
    expect(s1.depth).toBe(1);

    const tmpDir2 = makeTmpDir();
    const svc2 = new UserModelDialecticReasoningService({ homeRoot: tmpDir2, config: { depth: 3 } });
    const s2 = await svc2.synthesize([
      { user: 'como fazer x-', assistant: '...' },
      { user: 'como fazer y-', assistant: '...' },
      { user: 'como fazer z-', assistant: '...' },
    ]);
    expect(s2.depth).toBe(3);
    fs.rmSync(tmpDir2, { recursive: true, force: true });
  });
});

describe('UserModelReviewDaemonService', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('should create with default status', () => {
    const svc = new UserModelReviewDaemonService({ homeRoot: tmpDir });
    const status = svc.getStatus();
    expect(status.running).toBe(false);
    expect(status.totalReviews).toBe(0);
  });

  it('should start and stop', () => {
    const svc = new UserModelReviewDaemonService({ homeRoot: tmpDir, config: { intervalMs: 60000 } });
    svc.start();
    expect(svc.getStatus().running).toBe(true);
    svc.stop();
    expect(svc.getStatus().running).toBe(false);
  });

  it('should run review cycle', async () => {
    const turnCapture = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    const messages = [
      { user: 'I prefer direct and short answers', assistant: 'Understood, I will be direct.' },
      { user: 'I work with Python and Docker', assistant: 'I can help with that.' },
      { user: 'I want to review the code', assistant: 'I will analyze the code.' },
      { user: 'I need to create something new', assistant: 'I will implement that.' },
      { user: 'How to deploy-', assistant: 'Use Docker Compose.' },
    ];
    for (const msg of messages) {
      turnCapture.captureConversation(msg.user, msg.assistant);
    }

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

  it('should skip review when not enough turns', async () => {
    const turnCapture = new UserModelTurnCaptureService({ homeRoot: tmpDir });
    turnCapture.captureConversation('Hello there how are you', 'I am fine thanks');

    const daemon = new UserModelReviewDaemonService({
      homeRoot: tmpDir,
      turnCapture,
      config: { minTurnsForReview: 10 },
    });

    const synthesis = await daemon.runReviewCycle();
    expect(synthesis).toBeNull();
  });

  it('should persist status', () => {
    const svc = new UserModelReviewDaemonService({ homeRoot: tmpDir });
    svc.start();
    svc.stop();

    const svc2 = new UserModelReviewDaemonService({ homeRoot: tmpDir });
    expect(svc2.getStatus().running).toBe(false);
  });
});
