import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ExperienceSkillLearningLoopService } from '../../../src/services/ExperienceSkillLearningLoopService';
import { UseLearnedSkillTool } from '../../../src/tools/UseLearnedSkillTool';

describe('UseLearnedSkillTool', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-use-learned-skill-'));
  const prevNudgeCooldown = process.env.ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS;

  beforeAll(() => {
    process.env.ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS = '0';
  });

  afterAll(() => {
    if (prevNudgeCooldown === undefined) delete process.env.ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS;
    else process.env.ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS = prevNudgeCooldown;
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('registers name use_learned_skill and surfaces governed procedure without executing tools', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    const created = await loop.processTurn({
      userId: 'tool-user',
      surface: 'test',
      userMessage: 'Research release checklist and list repo files carefully for tool test',
      assistantText: 'Found checklist and listed files.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(created.triggered).toBe(true);
    expect(created.skillDraftId).toBeTruthy();

    const tool = new UseLearnedSkillTool({ projectRoot: root, userId: 'tool-user' });
    expect(tool.name).toBe('use_learned_skill');

    const runOut = await tool.execute({
      skill_id: String(created.skillDraftId),
      user_id: 'tool-user',
      action: 'run',
    });
    expect(runOut).toMatch(/Governed procedure only — does not execute tools/i);
    expect(runOut).toMatch(/Procedure/i);
    expect(runOut).toMatch(/web_search|read_file|list_dir/i);
    // Guidance only: tool must not claim execution of the learned tools.
    expect(runOut).not.toMatch(/executed tools-|tools executed/i);

    const showOut = await tool.execute({
      skill_id: String(created.skillDraftId),
      user_id: 'tool-user',
      action: 'show',
    });
    expect(showOut).toMatch(/Governed procedure only — does not execute tools/i);
    expect(showOut).toMatch(/Experience skill draft|Procedure \(observed\)|Goal/i);

    const searchOut = await tool.execute({
      query: 'release checklist',
      user_id: 'tool-user',
      action: 'search',
    });
    expect(searchOut).toMatch(/Governed procedure only — does not execute tools/i);
    expect(searchOut).toMatch(/Search results|id:/i);
    expect(searchOut).toContain(String(created.skillDraftId));
  });

  it('defaults to search when no skill_id and reports missing drafts clearly', async () => {
    const tool = new UseLearnedSkillTool({ projectRoot: root });
    const out = await tool.execute({
      query: 'no-such-workflow-xyz',
      user_id: 'empty-user',
    });
    expect(out).toMatch(/Governed procedure only — does not execute tools/i);
    expect(out).toMatch(/No matching|0\)/i);
  });

  it('returns not-found for unknown skill_id', async () => {
    const tool = new UseLearnedSkillTool({ projectRoot: root });
    const out = await tool.execute({
      skill_id: 'skill-does-not-exist-abcdef',
      user_id: 'tool-user',
      action: 'run',
    });
    expect(out).toMatch(/Governed procedure only — does not execute tools/i);
    expect(out).toMatch(/not found/i);
  });
});
