import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  ExperienceSkillLearningLoopService,
  computeReuseScore,
  computeSuccessRate,
  isExperienceSkillLearningLoopEnabled,
} from '../../src/services/ExperienceSkillLearningLoopService';
import { SkillLoader } from '../../src/skills/SkillLoader.js';
import { SkillSourceRegistryService } from '../../src/services/SkillSourceRegistryService.js';
import { SkillTrustPolicyService } from '../../src/services/SkillTrustPolicyService.js';

describe('ExperienceSkillLearningLoopService', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-exp-skill-'));
  const prevNudgeCooldown = process.env.ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS;

  beforeAll(() => {
    // Multi-turn tests assert successive nudges; disable cooldown by default.
    process.env.ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS = '0';
  });

  afterAll(() => {
    if (prevNudgeCooldown === undefined) delete process.env.ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS;
    else process.env.ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS = prevNudgeCooldown;
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('does not trigger below tool threshold', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const result = await loop.processTurn({
      userId: 'u1',
      userMessage: 'search something long enough for goal',
      assistantText: 'done',
      toolsCalled: ['web_search', 'read_file'],
      minToolCalls: 5,
    });
    expect(result.triggered).toBe(false);
    expect(result.reason).toMatch(/below_threshold/);
  });

  it('rejects failed tools and trivial goals', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const fail = await loop.processTurn({
      userId: 'u1',
      userMessage: 'Research release checklist thoroughly please',
      assistantText: 'partial',
      toolsCalled: ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'],
      toolFailures: ['web_search'],
      minToolCalls: 5,
    });
    expect(fail.triggered).toBe(false);
    expect(fail.reason).toBe('tool_failures_present');

    const trivial = await loop.processTurn({
      userId: 'u1',
      userMessage: 'ok',
      assistantText: 'ok',
      toolsCalled: ['a', 'b', 'c', 'd', 'e'],
      minToolCalls: 5,
    });
    expect(trivial.triggered).toBe(false);
    expect(trivial.reason).toBe('quality_gate_trivial_goal');
  });

  it('creates a skill draft then improves on reuse with new tools', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    const first = await loop.processTurn({
      userId: 'u2',
      surface: 'cli',
      userMessage: 'Research release checklist and list repo files carefully',
      assistantText: 'Found checklist and listed files.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(first.triggered).toBe(true);
    expect(first.skillDraftId).toBeTruthy();
    expect(first.userNudge || '').toMatch(/Learning loop|Loop de aprendizado|saved a reusable/i);
    expect(first.improved).toBe(false);
    expect(fs.existsSync(path.join(String(first.skillPath), 'SKILL.md'))).toBe(true);

    const sameTools = await loop.processTurn({
      userId: 'u2',
      surface: 'cli',
      userMessage: 'Research release checklist and list repo files carefully',
      assistantText: 'Same tools again.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(sameTools.triggered).toBe(true);
    expect(sameTools.reason).toMatch(/reinforced/);
    expect(sameTools.userNudge || '').toMatch(/times|vezes|reused|reutilizei/i);

    const improved = await loop.processTurn({
      userId: 'u2',
      surface: 'cli',
      userMessage: 'Research release checklist and list repo files carefully',
      assistantText: 'Also ran a second search.',
      toolsCalled: [...tools, 'capability_discovery'],
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(improved.triggered).toBe(true);
    expect(improved.improved).toBe(true);
    expect(improved.reason).toBe('existing_skill_improved');
    expect(improved.userNudge || '').toMatch(/improved|melhorei/i);

    const body = loop.showDraft('u2', String(first.skillDraftId));
    expect(body.ok).toBe(true);
    expect(body.text).toMatch(/Revision/i);
    expect(body.text).toMatch(/capability_discovery/);

    const list = loop.listDrafts('u2');
    expect(list[0].revisions).toBeGreaterThanOrEqual(1);
    expect(list[0].useCount).toBeGreaterThanOrEqual(3);
    expect(list[0].tools).toContain('capability_discovery');

    const status = loop.buildStatusSnapshot('u2');
    expect(status.drafts).toBeGreaterThanOrEqual(1);
    expect(status.workflowsLearned).toBeGreaterThanOrEqual(1);
    expect(status.badge).toMatch(/workflow|fluxo|learned|aprend/i);
    expect(status.topTools.length).toBeGreaterThan(0);
    expect(status.lastTriggerAt).toBeTruthy();
    expect(status.oneLiner.length).toBeGreaterThan(10);

    const inject = loop.formatInjectBlock('u2', 3);
    expect(inject).toMatch(/Learned workflow drafts/i);

    const promoted = loop.promote('u2', String(first.skillDraftId));
    expect(promoted.ok).toBe(true);
    expect(promoted.promotedPath && fs.existsSync(promoted.promotedPath)).toBe(true);
    expect(promoted.loaderReady).toBe(true);
    expect(promoted.skillName).toMatch(/^exp-/);
    expect(promoted.runtimeSkillPath && fs.existsSync(promoted.runtimeSkillPath)).toBe(true);
    expect(loop.buildStatusSnapshot('u2').promoted).toBeGreaterThanOrEqual(1);
  });

  it('respects ZAVORTH_SKILL_LEARN_LOOP disable flag', async () => {
    const prev = process.env.ZAVORTH_SKILL_LEARN_LOOP;
    process.env.ZAVORTH_SKILL_LEARN_LOOP = '0';
    try {
      expect(isExperienceSkillLearningLoopEnabled()).toBe(false);
      const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
      const result = await loop.processTurn({
        userId: 'u-off',
        userMessage: 'Research release checklist and list repo files carefully',
        assistantText: 'done',
        toolsCalled: ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'],
        minToolCalls: 5,
      });
      expect(result.triggered).toBe(false);
      expect(result.reason).toBe('learning_loop_disabled');
      expect(loop.formatInjectBlock('u-off')).toBe('');
    } finally {
      if (prev === undefined) delete process.env.ZAVORTH_SKILL_LEARN_LOOP;
      else process.env.ZAVORTH_SKILL_LEARN_LOOP = prev;
    }
  });

  it('optionally compacts Procedure via injected LLM', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    const compactLlm = {
      chat: async () => ({
        content: [
          '1. Clarify the research goal.',
          '2. Search with web_search.',
          '3. Read matching files with read_file.',
          '4. List directories with list_dir.',
          '5. Confirm timestamps with get_datetime.',
          '6. Summarize with tool evidence only.',
        ].join('\n'),
      }),
    };
    const created = await loop.processTurn({
      userId: 'u3',
      surface: 'cli',
      userMessage: 'Research release checklist and list repo files carefully for compact test',
      assistantText: 'Found checklist.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: true,
      compactLlm: compactLlm as any,
    });
    expect(created.triggered).toBe(true);
    expect(created.llmCompacted).toBe(true);
    const shown = loop.showDraft('u3', String(created.skillDraftId));
    expect(shown.text).toMatch(/Clarify the research goal/i);
    expect(shown.text).toMatch(/compacted by learning loop/i);
  });

  it('searchDrafts finds by tool name and by title token', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    const created = await loop.processTurn({
      userId: 'u-search',
      surface: 'cli',
      userMessage: 'Research release checklist and list repo files carefully for search api',
      assistantText: 'Found checklist.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(created.triggered).toBe(true);

    // Title token match (FTS-like unique tokens + title boost)
    const byTitle = loop.searchDrafts('u-search', 'release checklist');
    expect(byTitle.length).toBeGreaterThanOrEqual(1);
    expect(byTitle.some((d) => d.id === created.skillDraftId)).toBe(true);
    const titleHit = byTitle.find((d) => d.id === created.skillDraftId);
    expect(titleHit?.snippet).toBeTruthy();
    expect(String(titleHit?.snippet || '').length).toBeLessThanOrEqual(220);
    expect(Number(titleHit?.searchScore || 0)).toBeGreaterThan(0);

    // Tool name match
    const byTool = loop.searchDrafts('u-search', 'web_search');
    expect(byTool.some((d) => d.tools.includes('web_search'))).toBe(true);
    expect(byTool[0]?.snippet).toBeTruthy();

    const miss = loop.searchDrafts('u-search', 'zzzz-no-match-workflow');
    expect(miss.length).toBe(0);

    const all = loop.searchDrafts('u-search', '');
    expect(all.length).toBeGreaterThanOrEqual(1);
    expect(all[0]?.snippet).toBeDefined();
  });

  it('buildUserLearningProfile returns topTools after create', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    const created = await loop.processTurn({
      userId: 'u-profile',
      surface: 'cli',
      userMessage: 'Research user learning profile carefully multi tool workflow path',
      assistantText: 'Done for profile stats.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(created.triggered).toBe(true);

    const profile = loop.buildUserLearningProfile('u-profile');
    expect(profile.userId).toBe('u-profile');
    expect(profile.drafts).toBeGreaterThanOrEqual(1);
    expect(profile.topTools.length).toBeGreaterThan(0);
    expect(profile.topTools.some((t) => t.tool === 'web_search')).toBe(true);
    expect(profile.topSurfaces.some((s) => s.surface === 'cli')).toBe(true);
    expect(profile.preferredSkillTitles.length).toBeGreaterThan(0);
    expect(profile.weekMetrics.weekKey).toMatch(/^\d{4}-W\d{2}$/);
    expect(profile.weekMetrics.draftsCreated).toBeGreaterThanOrEqual(1);
    expect(profile.summary).toMatch(/web_search|Top tools|draft/i);
    expect(profile.summary.length).toBeGreaterThan(20);
  });

  it('rate-limits user nudges while still improving drafts on disk', async () => {
    const prev = process.env.ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS;
    process.env.ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS = '60000';
    try {
      const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
      const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
      const first = await loop.processTurn({
        userId: 'u-nudge',
        surface: 'cli',
        userMessage: 'Build a release notes summary from repo files carefully',
        assistantText: 'Drafted release notes summary.',
        toolsCalled: tools,
        minToolCalls: 5,
        llmCompact: false,
      });
      expect(first.triggered).toBe(true);
      expect(first.userNudge).toBeTruthy();
      expect(first.skillDraftId).toBeTruthy();

      const second = await loop.processTurn({
        userId: 'u-nudge',
        surface: 'cli',
        userMessage: 'Build a release notes summary from repo files carefully',
        assistantText: 'Also used capability discovery.',
        toolsCalled: [...tools, 'capability_discovery'],
        minToolCalls: 5,
        llmCompact: false,
      });
      expect(second.triggered).toBe(true);
      expect(second.improved).toBe(true);
      expect(second.userNudge).toBeNull();
      expect(second.reason).toMatch(/nudge_suppressed/);
      expect(second.skillDraftId).toBe(first.skillDraftId);

      const drafts = loop.listDrafts('u-nudge');
      expect(drafts.length).toBe(1);
      expect(drafts[0].tools).toContain('capability_discovery');
      expect(drafts[0].useCount).toBeGreaterThanOrEqual(2);
      expect(drafts[0].revisions).toBeGreaterThanOrEqual(1);
    } finally {
      if (prev === undefined) delete process.env.ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS;
      else process.env.ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS = prev;
    }
  });

  it('does not merge different goals that only share tools', async () => {
    process.env.ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS = '0';
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];

    const goalA = await loop.processTurn({
      userId: 'u-dedupe',
      surface: 'cli',
      userMessage: 'Research release checklist and list repo files carefully',
      assistantText: 'Release checklist done.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(goalA.triggered).toBe(true);
    expect(goalA.skillDraftId).toBeTruthy();

    const goalB = await loop.processTurn({
      userId: 'u-dedupe',
      surface: 'cli',
      userMessage: 'Audit dependency licenses across monorepo packages carefully',
      assistantText: 'License audit done.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(goalB.triggered).toBe(true);
    expect(goalB.skillDraftId).toBeTruthy();
    expect(goalB.skillDraftId).not.toBe(goalA.skillDraftId);
    expect(goalB.improved).toBe(false);
    expect(goalB.reason).toMatch(/skill_draft_created/);

    const drafts = loop.listDrafts('u-dedupe');
    expect(drafts.length).toBeGreaterThanOrEqual(2);
    const ids = new Set(drafts.map((d) => d.id));
    expect(ids.has(String(goalA.skillDraftId))).toBe(true);
    expect(ids.has(String(goalB.skillDraftId))).toBe(true);
  });

  it('showDraft with partial wrong id does not return wrong draft', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    const created = await loop.processTurn({
      userId: 'u-id-match',
      surface: 'cli',
      userMessage: 'Research exact id matching carefully with multi tool workflow',
      assistantText: 'Done for id match test.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(created.triggered).toBe(true);
    const exactId = String(created.skillDraftId);
    expect(exactId.length).toBeGreaterThan(8);

    // Partial / substring must not match via path.includes
    const partial = exactId.slice(0, Math.max(4, Math.floor(exactId.length / 2)));
    expect(partial).not.toBe(exactId);
    const wrongPartial = loop.showDraft('u-id-match', partial);
    expect(wrongPartial.ok).toBe(false);
    expect(wrongPartial.text).toMatch(/not found/i);

    // Path traversal / empty / separators rejected
    expect(loop.showDraft('u-id-match', '').ok).toBe(false);
    expect(loop.showDraft('u-id-match', '..').ok).toBe(false);
    expect(loop.showDraft('u-id-match', `../${exactId}`).ok).toBe(false);
    expect(loop.showDraft('u-id-match', `foo/${exactId}`).ok).toBe(false);
  });

  it('showDraft with exact id works', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    const created = await loop.processTurn({
      userId: 'u-id-show',
      surface: 'cli',
      userMessage: 'Research show exact draft id carefully multi tool path',
      assistantText: 'Done for show exact.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(created.triggered).toBe(true);
    const exactId = String(created.skillDraftId);
    const shown = loop.showDraft('u-id-show', exactId);
    expect(shown.ok).toBe(true);
    expect(shown.text).toMatch(/Experience skill draft/i);
    expect(shown.text).toMatch(/Goal/i);

    // Basename of draft directory also matches exactly
    const drafts = loop.listDrafts('u-id-show');
    const byMeta = drafts.find((d) => d.id === exactId);
    expect(byMeta).toBeTruthy();
    const byBasename = loop.showDraft('u-id-show', path.basename(String(byMeta?.path)));
    expect(byBasename.ok).toBe(true);
  });

  it('promote with exact id works', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    const created = await loop.processTurn({
      userId: 'u-id-promote',
      surface: 'cli',
      userMessage: 'Research promote exact draft id carefully multi tool path',
      assistantText: 'Done for promote exact.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(created.triggered).toBe(true);
    const exactId = String(created.skillDraftId);

    // Partial id must not promote
    const partial = exactId.slice(0, Math.max(4, Math.floor(exactId.length / 2)));
    expect(loop.promote('u-id-promote', partial).ok).toBe(false);

    const promoted = loop.promote('u-id-promote', exactId);
    expect(promoted.ok).toBe(true);
    expect(promoted.promotedPath && fs.existsSync(promoted.promotedPath)).toBe(true);
    expect(loop.buildStatusSnapshot('u-id-promote').promoted).toBeGreaterThanOrEqual(1);
  });

  it('resolves 1-based list ordinals for show/promote (same order as listDrafts)', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    const created = await loop.processTurn({
      userId: 'u-ordinal',
      surface: 'cli',
      userMessage: 'Research ordinal draft refs carefully multi tool path',
      assistantText: 'Done for ordinal refs.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(created.triggered).toBe(true);
    const exactId = String(created.skillDraftId);
    const listed = loop.listDrafts('u-ordinal', 40);
    expect(listed.length).toBeGreaterThanOrEqual(1);
    expect(listed[0]?.id).toBe(exactId);

    const byOrdinal = loop.resolveDraftRef('u-ordinal', '1');
    expect(byOrdinal?.id).toBe(exactId);
    expect(loop.resolveDraftRef('u-ordinal', '#1')?.id).toBe(exactId);
    expect(loop.showDraft('u-ordinal', '1').ok).toBe(true);

    // Full id still works
    expect(loop.resolveDraftRef('u-ordinal', exactId)?.id).toBe(exactId);

    // Out-of-range ordinal misses
    expect(loop.resolveDraftRef('u-ordinal', '99')).toBeNull();
    expect(loop.promote('u-ordinal', '99', { dryRun: true }).ok).toBe(false);

    // Dry-run via ordinal still does not write
    const preview = loop.promote('u-ordinal', '1', { dryRun: true });
    expect(preview.ok).toBe(true);
    expect(preview.dryRun).toBe(true);
  });

  it('preview/dry-run promote does not write files; real promote still works after', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    const created = await loop.processTurn({
      userId: 'u-dry-run',
      surface: 'cli',
      userMessage: 'Research dry-run promote carefully multi tool workflow path',
      assistantText: 'Done for dry-run promote.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(created.triggered).toBe(true);
    const exactId = String(created.skillDraftId);

    const promotedRoot = path.join(root, 'data', 'runtime', 'learning', 'users', 'u-dry-run', 'promoted-skills');
    const agentsSkillsRoot = path.join(root, '.agents', 'skills');
    const promotedBefore = fs.existsSync(promotedRoot) ? fs.readdirSync(promotedRoot) : [];
    const agentsBefore = fs.existsSync(agentsSkillsRoot) ? fs.readdirSync(agentsSkillsRoot) : [];

    const preview = loop.previewPromote('u-dry-run', exactId);
    expect(preview.ok).toBe(true);
    expect(preview.dryRun).toBe(true);
    expect(preview.skillName).toMatch(/^exp-/);
    expect(preview.auditDest).toBeTruthy();
    expect(preview.runtimeSkillPath).toBeTruthy();
    expect(preview.text).toMatch(/Dry-run|No files written/i);
    expect(preview.text).toContain(String(preview.auditDest));
    expect(preview.text).toContain(String(preview.skillName));
    expect(preview.skillMdPreview || '').toMatch(/name:\s*exp-/);
    expect(preview.skillMdPreview || preview.text).toMatch(/Experience skill draft|SKILL\.md|description:/i);

    const viaFlag = loop.promote('u-dry-run', exactId, { dryRun: true });
    expect(viaFlag.ok).toBe(true);
    expect(viaFlag.dryRun).toBe(true);
    expect(viaFlag.skillName).toBe(preview.skillName);
    expect(viaFlag.auditDest).toBe(preview.auditDest);

    // No files written under promoted-skills or .agents/skills
    const promotedAfter = fs.existsSync(promotedRoot) ? fs.readdirSync(promotedRoot) : [];
    const agentsAfter = fs.existsSync(agentsSkillsRoot) ? fs.readdirSync(agentsSkillsRoot) : [];
    expect(promotedAfter).toEqual(promotedBefore);
    expect(agentsAfter).toEqual(agentsBefore);
    if (preview.auditDest) {
      expect(fs.existsSync(preview.auditDest)).toBe(false);
    }
    if (preview.runtimeSkillPath) {
      expect(fs.existsSync(preview.runtimeSkillPath)).toBe(false);
    }

    // Real promote after dry-run still works
    const promoted = loop.promote('u-dry-run', exactId);
    expect(promoted.ok).toBe(true);
    expect(promoted.dryRun).toBe(false);
    expect(promoted.loaderReady).toBe(true);
    expect(promoted.promotedPath && fs.existsSync(promoted.promotedPath)).toBe(true);
    expect(promoted.runtimeSkillPath && fs.existsSync(promoted.runtimeSkillPath)).toBe(true);
    expect(promoted.skillName).toBe(preview.skillName);
  });

  it('status snapshot exposes plane and nudge cooldown', () => {
    process.env.ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS = '0';
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const status = loop.buildStatusSnapshot('u-status-plane');
    expect(status.plane).toBe('experience-skill-drafts');
    expect(status.planeNote).toMatch(/Light loop|preference\/spine/i);
    expect(status.nudgeCooldownMs).toBe(0);

    const prev = process.env.ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS;
    process.env.ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS = '60000';
    try {
      const withCooldown = loop.buildStatusSnapshot('u-status-plane');
      expect(withCooldown.nudgeCooldownMs).toBe(60000);
    } finally {
      if (prev === undefined) delete process.env.ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS;
      else process.env.ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS = prev;
    }
  });

  it('promote installs SkillLoader skill under .agents/skills with frontmatter', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    const created = await loop.processTurn({
      userId: 'u-promote-loader',
      surface: 'cli',
      userMessage: 'Research skill loader promote install carefully multi tool workflow',
      assistantText: 'Done for skill loader promote.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(created.triggered).toBe(true);
    const exactId = String(created.skillDraftId);

    const promoted = loop.promote('u-promote-loader', exactId);
    expect(promoted.ok).toBe(true);
    expect(promoted.loaderReady).toBe(true);
    expect(promoted.skillName).toBeTruthy();
    expect(String(promoted.skillName)).toMatch(/^exp-/);
    expect(String(promoted.skillName)).toContain(exactId.slice(-8));

    const runtimeDir = path.join(root, '.agents', 'skills', String(promoted.skillName));
    expect(fs.existsSync(runtimeDir)).toBe(true);
    expect(promoted.runtimeSkillPath).toBe(runtimeDir);

    const skillMd = fs.readFileSync(path.join(runtimeDir, 'SKILL.md'), 'utf8');
    expect(skillMd.startsWith('---')).toBe(true);
    expect(skillMd).toMatch(/^---\s*\r-\n[\s\S]*-\r-\n---/);
    expect(skillMd).toMatch(
      new RegExp(`name:\\s*${String(promoted.skillName).replace(/[.*+-^${}()|[\]\\]/g, '\\$&')}`),
    );
    expect(skillMd).toMatch(/description:\s*.+/);
    // Body preserved after frontmatter
    expect(skillMd).toMatch(/Experience skill draft/i);

    expect(fs.existsSync(path.join(runtimeDir, 'ORIGIN.json'))).toBe(true);
    const origin = JSON.parse(fs.readFileSync(path.join(runtimeDir, 'ORIGIN.json'), 'utf8')) as {
      fromDraftId-: string;
      skillName-: string;
    };
    expect(origin.fromDraftId).toBe(exactId);
    expect(origin.skillName).toBe(promoted.skillName);

    // Audit path still present
    expect(promoted.promotedPath && fs.existsSync(promoted.promotedPath)).toBe(true);
  });

  it('forget removes draft by exact id only', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    const created = await loop.processTurn({
      userId: 'u-forget',
      surface: 'cli',
      userMessage: 'Research forget draft carefully multi tool workflow path',
      assistantText: 'Done for forget test.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(created.triggered).toBe(true);
    const exactId = String(created.skillDraftId);
    const draftPath = String(created.skillPath);
    expect(fs.existsSync(draftPath)).toBe(true);

    // Partial id must not forget
    const partial = exactId.slice(0, Math.max(4, Math.floor(exactId.length / 2)));
    expect(partial).not.toBe(exactId);
    expect(loop.forget('u-forget', partial).ok).toBe(false);
    expect(fs.existsSync(draftPath)).toBe(true);

    // Path traversal / empty / separators rejected
    expect(loop.forget('u-forget', '').ok).toBe(false);
    expect(loop.forget('u-forget', '..').ok).toBe(false);
    expect(loop.forget('u-forget', `../${exactId}`).ok).toBe(false);
    expect(loop.forget('u-forget', `foo/${exactId}`).ok).toBe(false);
    expect(fs.existsSync(draftPath)).toBe(true);

    const forgotten = loop.forget('u-forget', exactId);
    expect(forgotten.ok).toBe(true);
    expect(forgotten.removedPath).toBe(path.resolve(draftPath));
    expect(fs.existsSync(draftPath)).toBe(false);
    expect(loop.listDrafts('u-forget').find((d) => d.id === exactId)).toBeUndefined();
    expect(forgotten.text).toMatch(/Draft only|promoted-skills|\.agents\/skills/i);
  });

  it('forget does not remove promoted-skills or .agents/skills', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    const created = await loop.processTurn({
      userId: 'u-forget-promoted',
      surface: 'cli',
      userMessage: 'Research forget after promote carefully multi tool workflow',
      assistantText: 'Done for forget after promote.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(created.triggered).toBe(true);
    const exactId = String(created.skillDraftId);
    const draftPath = String(created.skillPath);

    const promoted = loop.promote('u-forget-promoted', exactId);
    expect(promoted.ok).toBe(true);
    expect(promoted.promotedPath && fs.existsSync(promoted.promotedPath)).toBe(true);
    expect(promoted.runtimeSkillPath && fs.existsSync(promoted.runtimeSkillPath)).toBe(true);

    const forgotten = loop.forget('u-forget-promoted', exactId);
    expect(forgotten.ok).toBe(true);
    expect(fs.existsSync(draftPath)).toBe(false);
    expect(fs.existsSync(String(promoted.promotedPath))).toBe(true);
    expect(fs.existsSync(String(promoted.runtimeSkillPath))).toBe(true);
  });

  it('tracks lastUsedAt, successCount and ranks higher useCount by reuse score', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    const goalA = 'Research release checklist carefully for score ranking test A';
    const goalB = 'Audit dependency licenses carefully for score ranking test B';

    const low = await loop.processTurn({
      userId: 'u-score',
      surface: 'cli',
      userMessage: goalB,
      assistantText: 'License pass once.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(low.triggered).toBe(true);

    const high = await loop.processTurn({
      userId: 'u-score',
      surface: 'cli',
      userMessage: goalA,
      assistantText: 'Release pass 1.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(high.triggered).toBe(true);

    await loop.processTurn({
      userId: 'u-score',
      surface: 'cli',
      userMessage: goalA,
      assistantText: 'Release pass 2.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    await loop.processTurn({
      userId: 'u-score',
      surface: 'cli',
      userMessage: goalA,
      assistantText: 'Release pass 3.',
      toolsCalled: [...tools, 'capability_discovery'],
      minToolCalls: 5,
      llmCompact: false,
    });

    const drafts = loop.listDrafts('u-score', 20);
    expect(drafts.length).toBeGreaterThanOrEqual(2);
    for (const d of drafts) {
      expect(d.lastUsedAt).toBeTruthy();
      expect(Number(d.successCount || 0)).toBeGreaterThanOrEqual(1);
    }
    const highDraft = drafts.find((d) => d.id === high.skillDraftId);
    const lowDraft = drafts.find((d) => d.id === low.skillDraftId);
    expect(highDraft).toBeTruthy();
    expect(lowDraft).toBeTruthy();
    expect(Number(highDraft!.useCount)).toBeGreaterThan(Number(lowDraft!.useCount));
    expect(computeReuseScore(highDraft!)).toBeGreaterThan(computeReuseScore(lowDraft!));
    // Default list order is score DESC
    expect(drafts[0].id).toBe(high.skillDraftId);
  });

  it('promote writes manifest.json with name version description', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    const created = await loop.processTurn({
      userId: 'u-manifest',
      surface: 'cli',
      userMessage: 'Research manifest promote carefully multi tool workflow path',
      assistantText: 'Done for manifest promote.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(created.triggered).toBe(true);
    const exactId = String(created.skillDraftId);
    const promoted = loop.promote('u-manifest', exactId);
    expect(promoted.ok).toBe(true);
    expect(promoted.loaderReady).toBe(true);
    const manifestPath = path.join(String(promoted.runtimeSkillPath), 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      name-: string;
      version-: string;
      description-: string;
      author-: string;
      fromDraftId-: string;
    };
    expect(manifest.name).toBe(promoted.skillName);
    expect(manifest.version).toBe('1.0.0');
    expect(String(manifest.description || '').length).toBeGreaterThan(0);
    expect(manifest.author).toBe('experience-skill-learning-loop');
    expect(manifest.fromDraftId).toBe(exactId);

    const catalogPath = path.join(root, 'data', 'runtime', 'learning', 'users', 'u-manifest', 'promoted-catalog.json');
    expect(fs.existsSync(catalogPath)).toBe(true);
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8')) as Array<{ skillName: string }>;
    expect(catalog.some((e) => e.skillName === promoted.skillName)).toBe(true);
  });

  it('SkillLoader.loadAll discovers promoted experience skills under projectRoot .agents/skills', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    const created = await loop.processTurn({
      userId: 'u-loader-e2e',
      surface: 'cli',
      userMessage: 'Research skillloader loadall discover carefully multi tool workflow path',
      assistantText: 'Done for skillloader loadall e2e.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(created.triggered).toBe(true);
    const exactId = String(created.skillDraftId);

    const promoted = loop.promote('u-loader-e2e', exactId);
    expect(promoted.ok).toBe(true);
    expect(promoted.loaderReady).toBe(true);
    expect(promoted.skillName).toMatch(/^exp-/);
    expect(String(promoted.skillName)).toContain(exactId.slice(-8));

    const runtimeDir = path.join(root, '.agents', 'skills', String(promoted.skillName));
    expect(fs.existsSync(runtimeDir)).toBe(true);
    expect(promoted.runtimeSkillPath).toBe(runtimeDir);

    const skillMdPath = path.join(runtimeDir, 'SKILL.md');
    const manifestPath = path.join(runtimeDir, 'manifest.json');
    expect(fs.existsSync(skillMdPath)).toBe(true);
    expect(fs.existsSync(manifestPath)).toBe(true);

    const skillMd = fs.readFileSync(skillMdPath, 'utf8');
    // YAML frontmatter required by SkillLoader.parseSkillFile
    expect(skillMd.startsWith('---')).toBe(true);
    expect(skillMd).toMatch(/^---\s*\r-\n[\s\S]*-\r-\n---/);
    expect(skillMd).toMatch(
      new RegExp(`name:\\s*${String(promoted.skillName).replace(/[.*+-^${}()|[\]\\]/g, '\\$&')}`),
    );
    expect(skillMd).toMatch(/description:\s*.+/);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      name-: string;
      version-: string;
      description-: string;
    };
    expect(manifest.name).toBe(promoted.skillName);
    expect(String(manifest.description || '').length).toBeGreaterThan(0);

    // Scope SkillLoader to temp projectRoot only — no real repo config pollution.
    // Missing config files fall back to defaults: workspace-agents -> .agents/skills (mode: all).
    const loader = new SkillLoader({
      sourceRegistryService: new SkillSourceRegistryService({ projectRoot: root }),
      skillTrustPolicyService: new SkillTrustPolicyService({ projectRoot: root }),
      quiet: true,
    });

    const skills = loader.loadAll({ quiet: true });
    const found = skills.find((s) => s.name === promoted.skillName);
    expect(found).toBeTruthy();
    expect(found!.name).toBe(promoted.skillName);
    expect(String(found!.description || '').length).toBeGreaterThan(0);
    expect(found!.sourceId).toBe('workspace-agents');
    expect(found!.dirPath).toBe(runtimeDir);
    expect(found!.skillFilePath).toBe(skillMdPath);
  });

  it('formatInjectBlock includes full Procedure for similar goals', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    const goal = 'Research inject procedure carefully multi tool workflow for similar goal';
    const created = await loop.processTurn({
      userId: 'u-inject-sim',
      surface: 'cli',
      userMessage: goal,
      assistantText: 'Done for inject similar.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(created.triggered).toBe(true);

    const inject = loop.formatInjectBlock('u-inject-sim', 5, {
      userMessage: goal,
      fullProcedureTopK: 2,
    });
    expect(inject).toMatch(/Learned workflow drafts/i);
    expect(inject).toMatch(/reuse score/i);
    expect(inject).toMatch(/Procedure \(runtime recall\)/i);
    expect(inject).toMatch(/Prefer tools/i);
    expect(inject).toMatch(/Clarify the user goal/i);
  });

  it('formatInjectBlock omits full procedure for unrelated user messages', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    const goal = 'Research release notes carefully multi tool workflow unrelated inject';
    const created = await loop.processTurn({
      userId: 'u-inject-unrel',
      surface: 'cli',
      userMessage: goal,
      assistantText: 'Done for inject unrelated.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(created.triggered).toBe(true);

    const inject = loop.formatInjectBlock('u-inject-unrel', 5, {
      userMessage: 'Plan a weekend picnic menu with friends outdoors tomorrow',
      fullProcedureTopK: 2,
    });
    expect(inject).toMatch(/Learned workflow drafts/i);
    expect(inject).toMatch(/score=/);
    // Unrelated goal must not inject the draft procedure body
    expect(inject).not.toMatch(/Procedure \(runtime recall\)/i);
    expect(inject).not.toMatch(/Prefer tools: web_search/i);
  });

  it('runSkill returns governed procedure for exact id only', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    const created = await loop.processTurn({
      userId: 'u-run',
      surface: 'cli',
      userMessage: 'Research run skill carefully multi tool workflow path',
      assistantText: 'Done for run skill.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(created.triggered).toBe(true);
    const exactId = String(created.skillDraftId);

    const partial = exactId.slice(0, Math.max(4, Math.floor(exactId.length / 2)));
    expect(loop.runSkill('u-run', partial).ok).toBe(false);
    expect(loop.runSkill('u-run', '').ok).toBe(false);
    expect(loop.runSkill('u-run', `../${exactId}`).ok).toBe(false);

    const run = loop.runSkill('u-run', exactId);
    expect(run.ok).toBe(true);
    expect(run.text).toMatch(/Governed procedure only/i);
    expect(run.text).toMatch(/does not execute tools/i);
    expect(run.text).toMatch(/Procedure/i);
    expect(run.text).toMatch(/Prefer tools|Clarify the user goal/i);

    const drafts = loop.listDrafts('u-run');
    const d = drafts.find((x) => x.id === exactId);
    expect(d?.lastUsedAt).toBeTruthy();
  });

  it('status snapshot exposes weekly metrics after create and promote', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    const created = await loop.processTurn({
      userId: 'u-metrics',
      surface: 'cli',
      userMessage: 'Research weekly metrics carefully multi tool workflow path',
      assistantText: 'Done for metrics.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(created.triggered).toBe(true);

    await loop.processTurn({
      userId: 'u-metrics',
      surface: 'cli',
      userMessage: 'Research weekly metrics carefully multi tool workflow path',
      assistantText: 'Reuse metrics turn.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });

    const promoted = loop.promote('u-metrics', String(created.skillDraftId));
    expect(promoted.ok).toBe(true);

    const status = loop.buildStatusSnapshot('u-metrics');
    expect(status.metrics).toBeTruthy();
    expect(status.metrics.weekKey).toMatch(/^\d{4}-W\d{2}$/);
    expect(status.metrics.draftsCreated).toBeGreaterThanOrEqual(1);
    expect(status.metrics.reuses).toBeGreaterThanOrEqual(1);
    expect(status.metrics.promotes).toBeGreaterThanOrEqual(1);
  });

  it('records failureCount on similar draft when processTurn sees tool failures', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    const goal = 'Research failure tracking carefully multi tool workflow path';

    const created = await loop.processTurn({
      userId: 'u-fail-track',
      surface: 'cli',
      userMessage: goal,
      assistantText: 'Created for failure tracking.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(created.triggered).toBe(true);
    expect(created.skillDraftId).toBeTruthy();

    const afterCreate = loop.listDrafts('u-fail-track').find((d) => d.id === created.skillDraftId);
    expect(afterCreate).toBeTruthy();
    expect(Number(afterCreate!.successCount || 0)).toBeGreaterThanOrEqual(1);
    expect(Number(afterCreate!.failureCount || 0)).toBe(0);
    expect(Number(afterCreate!.successRate)).toBe(1);

    const failed = await loop.processTurn({
      userId: 'u-fail-track',
      surface: 'cli',
      userMessage: goal,
      assistantText: 'Tools blew up.',
      toolsCalled: tools,
      toolFailures: ['web_search'],
      outcome: 'failure',
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(failed.triggered).toBe(false);
    expect(failed.reason).toBe('turn_not_successful');

    const afterFail = loop.listDrafts('u-fail-track').find((d) => d.id === created.skillDraftId);
    expect(afterFail).toBeTruthy();
    expect(Number(afterFail!.failureCount || 0)).toBeGreaterThanOrEqual(1);
    expect(Number(afterFail!.successCount || 0)).toBe(Number(afterCreate!.successCount || 0));
    expect(Number(afterFail!.useCount)).toBe(Number(afterCreate!.useCount));
    expect(Number(afterFail!.successRate)).toBeLessThan(1);
    expect(computeSuccessRate(afterFail!)).toBeLessThan(1);
  });

  it('scores high-success sibling above failing skill when useCounts are equal', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    const goalGood = 'Research high success sibling carefully multi tool ranking path';
    const goalBad = 'Audit low success sibling carefully multi tool ranking path';

    const good = await loop.processTurn({
      userId: 'u-fail-score',
      surface: 'cli',
      userMessage: goalGood,
      assistantText: 'Good skill once.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    const bad = await loop.processTurn({
      userId: 'u-fail-score',
      surface: 'cli',
      userMessage: goalBad,
      assistantText: 'Bad skill once.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(good.triggered).toBe(true);
    expect(bad.triggered).toBe(true);

    // Demote the "bad" draft with repeated goal-matched failures (no useCount bump).
    for (let i = 0; i < 3; i += 1) {
      const res = await loop.processTurn({
        userId: 'u-fail-score',
        surface: 'cli',
        userMessage: goalBad,
        assistantText: `fail pass ${i}`,
        toolsCalled: tools,
        toolFailures: ['read_file'],
        outcome: 'failure',
        minToolCalls: 5,
        llmCompact: false,
      });
      expect(res.triggered).toBe(false);
    }

    const drafts = loop.listDrafts('u-fail-score', 20);
    const goodDraft = drafts.find((d) => d.id === good.skillDraftId);
    const badDraft = drafts.find((d) => d.id === bad.skillDraftId);
    expect(goodDraft).toBeTruthy();
    expect(badDraft).toBeTruthy();
    expect(Number(goodDraft!.useCount)).toBe(Number(badDraft!.useCount));
    expect(Number(badDraft!.failureCount || 0)).toBeGreaterThanOrEqual(3);
    expect(Number(goodDraft!.successRate)).toBeGreaterThan(Number(badDraft!.successRate));
    expect(computeReuseScore(goodDraft!)).toBeGreaterThan(computeReuseScore(badDraft!));
  });

  it('redacts secrets in formatInjectBlock full procedure and runSkill output', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    const goal = 'Research secret redaction carefully multi tool workflow inject run';
    const created = await loop.processTurn({
      userId: 'u-redact-io',
      surface: 'cli',
      userMessage: goal,
      assistantText: 'Created for redaction surfaces.',
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(created.triggered).toBe(true);
    const exactId = String(created.skillDraftId);
    const skillPath = path.join(String(created.skillPath), 'SKILL.md');
    expect(fs.existsSync(skillPath)).toBe(true);

    // Plant secrets after store-time redact (simulates legacy / compact slip-through).
    // Built via parts so secret-guard does not flag fixture source as live credentials.
    const fakeLiveKey = ['sk', 'live', 'abcdefghijklmnopqrstuvwxyz012345'].join('-');
    const fakeProjKey = ['sk', 'proj', 'abcdefghijklmnopqrstuvwxyz'].join('-');
    let skillMd = fs.readFileSync(skillPath, 'utf8');
    const leakBlock = [
      '## Procedure (observed)',
      '',
      '1. Clarify the user goal (see Goal above).',
      `2. Auth with Bearer ${fakeLiveKey}`,
      '3. api_key=supersecret_api_value_12345 and password: hunter2pass',
      `4. OPENAI_API_KEY=${fakeProjKey}`,
      '5. Prefer tools: web_search, read_file.',
      '',
    ].join('\n');
    skillMd = skillMd.replace(/## Procedure \(observed\)[\s\S]*-(-=\n## |$)/, leakBlock);
    fs.writeFileSync(skillPath, skillMd, 'utf8');

    const inject = loop.formatInjectBlock('u-redact-io', 5, {
      userMessage: goal,
      fullProcedureTopK: 2,
    });
    expect(inject).toMatch(/Procedure \(runtime recall\)/i);
    expect(inject).toMatch(/\[REDACTED\]/i);
    expect(inject).not.toContain(fakeLiveKey);
    expect(inject).not.toMatch(/supersecret_api_value_12345/);
    expect(inject).not.toMatch(/hunter2pass/);
    expect(inject).not.toContain(fakeProjKey);
    expect(inject).not.toMatch(/Bearer sk-live/i);

    const run = loop.runSkill('u-redact-io', exactId);
    expect(run.ok).toBe(true);
    expect(run.text).toMatch(/\[REDACTED\]/i);
    expect(run.text).not.toContain(fakeLiveKey);
    expect(run.text).not.toMatch(/supersecret_api_value_12345/);
    expect(run.text).not.toMatch(/hunter2pass/);
    expect(run.text).not.toMatch(/OPENAI_API_KEY=sk-proj/);
  });

  it('redacts secrets at processTurn store time and rejects path-traversal draft ids', async () => {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
    // JWT-shaped fixture assembled at runtime (secret-guard scans source literals only).
    const fakeJwt = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', 'dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'].join('.');
    const fakeGh = ['ghp', 'abcdefghijklmnopqrstuvwx'].join('_');
    const created = await loop.processTurn({
      userId: 'u-redact-store',
      surface: 'cli',
      userMessage:
        `Research store redaction carefully multi tool path with token=abc123secrettoken99 and Bearer ${fakeJwt}`,
      assistantText: `Done with api_key: leaked_key_value_999 and ${fakeGh}`,
      toolsCalled: tools,
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(created.triggered).toBe(true);
    const skillPath = path.join(String(created.skillPath), 'SKILL.md');
    const body = fs.readFileSync(skillPath, 'utf8');
    expect(body).toMatch(/\[REDACTED\]/i);
    expect(body).not.toMatch(/abc123secrettoken99/);
    expect(body).not.toMatch(/leaked_key_value_999/);
    expect(body).not.toContain(fakeGh);
    expect(body).not.toContain(fakeJwt.split('.')[0]!);

    // Path traversal / unsafe ids rejected on promote/forget/run/show
    expect(loop.promote('u-redact-store', '../etc/passwd').ok).toBe(false);
    expect(loop.forget('u-redact-store', '..\\windows').ok).toBe(false);
    expect(loop.runSkill('u-redact-store', 'foo/bar').ok).toBe(false);
    expect(loop.showDraft('u-redact-store', '').ok).toBe(false);
  });
});
