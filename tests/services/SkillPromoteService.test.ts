import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ExperienceSkillLearningLoopService } from '../../src/services/ExperienceSkillLearningLoopService.js';
import { SkillPromoteService, inferModuleKindFromTools } from '../../src/services/SkillPromoteService.js';
import { SkillSearchIndexService } from '../../src/services/SkillSearchIndexService.js';

describe('SkillPromoteService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-promote-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  async function createDraft(userId: string, message: string) {
    const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
    const tools = ['read_file', 'list_directory', 'web_search', 'run_sandbox_code', 'get_datetime'];
    const result = await loop.processTurn({
      userId,
      userMessage: message,
      assistantText: 'Done multi tool workflow successfully.',
      toolsCalled: tools,
      toolCallCount: tools.length,
      outcome: 'success',
      minToolCalls: 5,
      llmCompact: false,
    });
    expect(result.triggered).toBe(true);
    expect(result.skillDraftId).toBeTruthy();
    return { loop, draftId: String(result.skillDraftId) };
  }

  it('promotes draft to SkillIR pack under skills/ and appears in local search', async () => {
    const { loop, draftId } = await createDraft(
      'u-w5-skill',
      'Research promote skillir carefully multi tool workflow path for search index',
    );

    const promoted = loop.promote('u-w5-skill', draftId, { kind: 'skill' });
    expect(promoted.ok).toBe(true);
    expect(promoted.autoPromote).toBe(false);
    expect(promoted.loaderReady).toBe(true);
    expect(promoted.skillPath && fs.existsSync(promoted.skillPath)).toBe(true);
    expect(promoted.runtimeSkillPath && fs.existsSync(promoted.runtimeSkillPath)).toBe(true);
    expect(promoted.skillIrDigest).toBeTruthy();
    expect(promoted.receiptPath && fs.existsSync(promoted.receiptPath)).toBe(true);

    const skillMd = fs.readFileSync(path.join(String(promoted.skillPath), 'SKILL.md'), 'utf8');
    expect(skillMd).toMatch(/name:\s*exp-/);
    expect(skillMd).toMatch(/tools:/);
    expect(skillMd).toMatch(/web_search/);

    const irPath = path.join(String(promoted.skillPath), 'skill.ir.json');
    expect(fs.existsSync(irPath)).toBe(true);
    const ir = JSON.parse(fs.readFileSync(irPath, 'utf8')) as {
      skillIrDigest-: string;
      fromDraftId-: string;
      skillIr-: { declaredTools-: Array<{ name-: string }> };
    };
    expect(ir.fromDraftId).toBe(draftId);
    expect(ir.skillIrDigest).toBe(promoted.skillIrDigest);
    expect((ir.skillIr?.declaredTools || []).some((t) => t.name === 'web_search')).toBe(true);

    const receipt = JSON.parse(fs.readFileSync(String(promoted.receiptPath), 'utf8')) as {
      draftId: string;
      skillId: string | null;
      pluginId: string | null;
      autoPromote: boolean;
    };
    expect(receipt.draftId).toBe(draftId);
    expect(receipt.skillId).toBe(promoted.skillId);
    expect(receipt.pluginId).toBeNull();
    expect(receipt.autoPromote).toBe(false);

    const index = new SkillSearchIndexService({
      projectRoot: root,
      skillsDir: path.join(root, 'skills'),
      skillSourcesPath: path.join(root, 'missing-sources.json'),
      receiptsDir: path.join(root, 'receipts'),
    });
    const hits = index.search('web_search', 20);
    expect(hits.some((h) => h.id === promoted.skillId || h.sourcePath === promoted.skillPath)).toBe(true);
  });

  it('promotes draft to plugin scaffold with plugin-os.v1 manifest', async () => {
    const { loop, draftId } = await createDraft(
      'u-w5-plugin',
      'Research promote plugin scaffold carefully multi tool workflow path',
    );

    const promoted = loop.promote('u-w5-plugin', draftId, { kind: 'plugin' });
    expect(promoted.ok).toBe(true);
    expect(promoted.pluginReady).toBe(true);
    expect(promoted.pluginId).toMatch(/^promoted-/);
    expect(promoted.pluginPath && fs.existsSync(promoted.pluginPath)).toBe(true);

    const manifestPath = path.join(String(promoted.pluginPath), 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      schemaVersion-: string;
      id-: string;
    };
    expect(manifest.schemaVersion).toBe('zavorth.plugin-os.v1');
    expect(manifest.id).toBe(promoted.pluginId);

    const promoteMeta = JSON.parse(fs.readFileSync(path.join(String(promoted.pluginPath), 'PROMOTE.json'), 'utf8')) as {
      fromDraftId-: string;
      autoPromote-: boolean;
    };
    expect(promoteMeta.fromDraftId).toBe(draftId);
    expect(promoteMeta.autoPromote).toBe(false);
  });

  it('kind=both links draft → skill → plugin on receipt', async () => {
    const { loop, draftId } = await createDraft(
      'u-w5-both',
      'Research promote both skill and plugin carefully multi tool path',
    );

    const promoted = loop.promote('u-w5-both', draftId, { kind: 'both' });
    expect(promoted.ok).toBe(true);
    expect(promoted.loaderReady).toBe(true);
    expect(promoted.pluginReady).toBe(true);
    expect(promoted.skillId).toBeTruthy();
    expect(promoted.pluginId).toBeTruthy();

    const receipt = JSON.parse(fs.readFileSync(String(promoted.receiptPath), 'utf8')) as {
      draftId: string;
      skillId: string | null;
      pluginId: string | null;
      status: string;
    };
    expect(receipt.draftId).toBe(draftId);
    expect(receipt.skillId).toBe(promoted.skillId);
    expect(receipt.pluginId).toBe(promoted.pluginId);
    expect(receipt.status).toBe('applied');
  });

  it('dry-run never writes skill or plugin packs', async () => {
    const { loop, draftId } = await createDraft(
      'u-w5-dry',
      'Research dry run promote carefully multi tool workflow path again',
    );
    const skillsBefore = fs.existsSync(path.join(root, 'skills')) ? fs.readdirSync(path.join(root, 'skills')) : [];
    const pluginsBefore = fs.existsSync(path.join(root, 'plugins', 'promoted'))
      ? fs.readdirSync(path.join(root, 'plugins', 'promoted'))
      : [];

    const preview = loop.promote('u-w5-dry', draftId, { dryRun: true, kind: 'both' });
    expect(preview.ok).toBe(true);
    expect(preview.dryRun).toBe(true);
    expect(preview.loaderReady).toBe(false);

    const skillsAfter = fs.existsSync(path.join(root, 'skills')) ? fs.readdirSync(path.join(root, 'skills')) : [];
    const pluginsAfter = fs.existsSync(path.join(root, 'plugins', 'promoted'))
      ? fs.readdirSync(path.join(root, 'plugins', 'promoted'))
      : [];
    expect(skillsAfter).toEqual(skillsBefore);
    expect(pluginsAfter).toEqual(pluginsBefore);
  });

  it('inferModuleKindFromTools maps search/memory/channel tools', () => {
    expect(inferModuleKindFromTools(['web_search', 'read_file'])).toBe('search');
    expect(inferModuleKindFromTools(['semantic_memory', 'memory_store'])).toBe('memory');
    expect(inferModuleKindFromTools(['telegram_send', 'channel_post'])).toBe('channel');
    expect(inferModuleKindFromTools(['read_file', 'list_directory'])).toBe('tool');
  });

  it('standalone SkillPromoteService builds tools frontmatter', () => {
    const draftDir = path.join(root, 'draft');
    fs.mkdirSync(draftDir, { recursive: true });
    fs.writeFileSync(
      path.join(draftDir, 'SKILL.md'),
      '---\nname: d\n---\n# Demo\n\n## Procedure (observed)\n1. Do thing\n',
      'utf8',
    );
    const svc = new SkillPromoteService();
    const md = svc.buildSkillPackMarkdown(
      {
        id: 'draft-abc12345',
        title: 'Demo workflow',
        path: draftDir,
        tools: ['read_file', 'web_search'],
        surface: 'test',
        createdAt: new Date().toISOString(),
        useCount: 1,
      },
      'exp-demo-abc12345',
    );
    expect(md).toMatch(/name:\s*exp-demo-abc12345/);
    expect(md).toMatch(/- name: read_file/);
    expect(md).toMatch(/- name: web_search/);
  });
});
