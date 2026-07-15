import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  AboutYouService,
  buildLearnedKnowledgeStory,
  captureConversationTurn,
  resetConversationContinuumCache,
} from '../../../src/services/learned-knowledge/index.js';

describe('LearnedKnowledgeStoryService', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-story-'));
    fs.mkdirSync(path.join(tmp, 'data', 'runtime'), { recursive: true });
    resetConversationContinuumCache();
  });

  afterEach(() => {
    resetConversationContinuumCache();
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('returns ok snapshot with empty events when stores are empty', () => {
    const snap = buildLearnedKnowledgeStory({
      userId: 'story-user',
      projectRoot: tmp,
      windowDays: 7,
      limit: 10,
    });
    expect(snap.ok).toBe(true);
    expect(snap.userId).toBe('story-user');
    expect(snap.windowDays).toBe(7);
    expect(Array.isArray(snap.events)).toBe(true);
    expect(snap.summary).toMatch(/No learned-knowledge activity|Learned this week/i);
    expect(snap.generatedAt).toBeTruthy();
  });

  it('includes about-you draft events after propose', () => {
    const about = new AboutYouService({ projectRoot: tmp });
    const proposed = about.propose('story-user', {
      key: 'timezone',
      value: 'UTC',
      confidence: 0.7,
    });
    expect(proposed.ok).toBe(true);

    const snap = buildLearnedKnowledgeStory({
      userId: 'story-user',
      projectRoot: tmp,
      windowDays: 7,
      limit: 24,
    });
    expect(snap.events.some((e) => e.pillar === 'about-you' && /timezone/i.test(e.title + e.snippet))).toBe(true);
    expect(snap.events.every((e) => e.at && e.title && e.snippet)).toBe(true);
  });

  it('includes conversation events after continuum capture', () => {
    captureConversationTurn({
      userMessage: 'Discussed staging provider mesh checklist this week',
      assistantMessage: 'Use the mesh checklist and verify keys carefully.',
      sessionId: 'story-sess',
      userId: 'story-user',
      surface: 'cli',
      projectRoot: tmp,
      source: 'test',
    });

    const snap = buildLearnedKnowledgeStory({
      userId: 'story-user',
      projectRoot: tmp,
      windowDays: 7,
      limit: 24,
    });
    expect(snap.events.some((e) => e.pillar === 'conversation')).toBe(true);
  });

  it('includes wiki-ready knowledge event when index is present and recent', () => {
    const wiki = path.join(tmp, '.zavorth', 'wiki');
    fs.mkdirSync(wiki, { recursive: true });
    fs.writeFileSync(path.join(wiki, 'index.json'), JSON.stringify({ pages: [], edges: [] }), 'utf8');

    const snap = buildLearnedKnowledgeStory({
      userId: 'story-user',
      projectRoot: tmp,
      windowDays: 7,
      limit: 24,
    });
    expect(snap.events.some((e) => e.pillar === 'knowledge' && /wiki/i.test(e.title))).toBe(true);
  });

  it('caps events by limit and sorts newest first', () => {
    const about = new AboutYouService({ projectRoot: tmp });
    for (let i = 0; i < 5; i += 1) {
      about.propose('story-user', { key: `k${i}`, value: `v${i}` });
    }
    const snap = buildLearnedKnowledgeStory({
      userId: 'story-user',
      projectRoot: tmp,
      windowDays: 7,
      limit: 2,
    });
    expect(snap.events.length).toBeLessThanOrEqual(2);
    if (snap.events.length >= 2) {
      expect(String(snap.events[0].at) >= String(snap.events[1].at)).toBe(true);
    }
  });
});
