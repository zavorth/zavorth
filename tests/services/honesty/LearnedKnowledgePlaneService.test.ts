import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  LearnedKnowledgePlaneService,
  scoreLearnedKnowledgeIntent,
  equalPillarWeights,
  captureConversationTurn,
  resetConversationContinuumCache,
} from '../../../src/services/learned-knowledge/index.js';
import { ExperienceSkillLearningLoopService } from '../../../src/services/ExperienceSkillLearningLoopService.js';

describe('LearnedKnowledgePlaneService (no keyword routing)', () => {
  let tmp: string;
  let runtimeDir: string;
  const prevLk = process.env.ZAVORTH_LEARNED_KNOWLEDGE;
  const prevUserModel = process.env.ZAVORTH_USER_MODEL;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-pack-'));
    runtimeDir = path.join(tmp, 'data', 'runtime');
    fs.mkdirSync(runtimeDir, { recursive: true });
    resetConversationContinuumCache();
    delete process.env.ZAVORTH_LEARNED_KNOWLEDGE;
    delete process.env.ZAVORTH_USER_MODEL;
  });

  afterEach(() => {
    if (prevLk === undefined) delete process.env.ZAVORTH_LEARNED_KNOWLEDGE;
    else process.env.ZAVORTH_LEARNED_KNOWLEDGE = prevLk;
    if (prevUserModel === undefined) delete process.env.ZAVORTH_USER_MODEL;
    else process.env.ZAVORTH_USER_MODEL = prevUserModel;
    resetConversationContinuumCache();
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('does not keyword-route free text — equal pillar weights for any phrasing', () => {
    const a = scoreLearnedKnowledgeIntent('what did we discuss about providers last time?');
    const b = scoreLearnedKnowledgeIntent('how to run the release checklist step by step');
    const c = scoreLearnedKnowledgeIntent('I prefer short answers and my name is Grey');
    const equal = equalPillarWeights();
    expect(a).toEqual(equal);
    expect(b).toEqual(equal);
    expect(c).toEqual(equal);
    expect(a.workflows).toBe(a.conversation);
    expect(a.knowledge).toBe(a['about-you']);
  });

  it('always queries all pillars regardless of phrasing', () => {
    const pack = new LearnedKnowledgePlaneService({ projectRoot: tmp }).buildPack({
      userId: 'pack-user',
      userMessage: 'completely arbitrary free text with no special words',
      projectRoot: tmp,
      runtimeDir,
      tokenBudget: 800,
    });
    expect(pack.pillarsQueried.sort()).toEqual(['about-you', 'conversation', 'knowledge', 'workflows'].sort());
    expect(pack.safety.noKeywordIntentRouting).toBe(true);
  });

  it('buildPack includes conversation hits via store search (not keywords)', async () => {
    captureConversationTurn({
      userMessage: 'Discussed provider mesh checklist for staging release',
      assistantMessage: 'Use the mesh checklist and verify keys.',
      sessionId: 'pack-sess',
      userId: 'pack-user',
      runtimeDir,
      surface: 'cli',
    });

    const plane = new LearnedKnowledgePlaneService({ projectRoot: tmp });
    const pack = plane.buildPack({
      userId: 'pack-user',
      userMessage: 'provider mesh staging',
      projectRoot: tmp,
      runtimeDir,
      tokenBudget: 800,
    });

    expect(pack.version).toBe('learned-knowledge-pack/1');
    expect(pack.safety.noToolAuthority).toBe(true);
    expect(pack.safety.noKeywordIntentRouting).toBe(true);
    expect(pack.hits.some((h) => h.pillar === 'conversation')).toBe(true);
    expect(pack.hits.every((h) => h.pillar && h.sourceId && typeof h.score === 'number')).toBe(true);
    expect(pack.budget.estimatedTokens).toBeLessThanOrEqual(pack.budget.tokenBudget + 40);
    if (pack.injectBlock) {
      expect(pack.injectBlock).toMatch(/untrusted-learned-knowledge|Learned knowledge pack/i);
      expect(pack.injectBlock).toMatch(/store relevance only|no free-text keyword/i);
    }
  });

  it('buildPack can include workflow drafts via store similarity', async () => {
    process.env.ZAVORTH_SKILL_LEARN_MIN_TOOLS = '3';
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: tmp });
    await loop.processTurn({
      userId: 'wf-user',
      userMessage: 'How do I run the release checklist and list repository files step by step?',
      assistantText: 'Done with multi-tool workflow.',
      toolsCalled: ['read_file', 'list_directory', 'run_command', 'search_code'],
      toolCallCount: 4,
      outcome: 'success',
      surface: 'cli',
    });

    const pack = new LearnedKnowledgePlaneService({ projectRoot: tmp }).buildPack({
      userId: 'wf-user',
      userMessage: 'How do I run the release checklist step by step again?',
      projectRoot: tmp,
      tokenBudget: 1500,
    });

    expect(pack.pillarsQueried).toContain('workflows');
    expect(pack.budget.tokenBudget).toBe(1500);
  });

  it('disables pack when ZAVORTH_LEARNED_KNOWLEDGE=0', () => {
    process.env.ZAVORTH_LEARNED_KNOWLEDGE = '0';
    const pack = new LearnedKnowledgePlaneService({ projectRoot: tmp }).buildPack({
      userId: 'x',
      userMessage: 'what did we decide?',
      projectRoot: tmp,
    });
    expect(pack.hits).toEqual([]);
    expect(pack.injectBlock).toBe('');
  });
});
