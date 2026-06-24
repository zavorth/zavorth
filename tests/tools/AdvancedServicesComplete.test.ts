import fs from 'fs';
import os from 'os';
import path from 'path';
import { DataPipelineService } from '../../src/services/plugins/DataPipelineService';
import { ZavorthPluginMarketplaceService } from '../../src/services/plugins/ZavorthPluginMarketplaceService';
import { NotificationCenterService } from '../../src/services/plugins/NotificationCenterService';
import { VersionControlService } from '../../src/services/plugins/VersionControlService';
import { AutoSkillGeneratorService } from '../../src/services/plugins/AutoSkillGeneratorService';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'advanced-'));

describe('Advanced Services Complete', () => {
  let dir: string;
  beforeEach(() => { dir = tmpDir(); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  describe('DataPipelineService', () => {
    let svc: DataPipelineService;
    beforeEach(() => { svc = new DataPipelineService({ storageDir: dir }); });

    it('creates pipeline', () => { expect(svc.createPipeline('test', 'desc')).toContain('created'); });
    it('lists pipelines', () => { svc.createPipeline('test', 'desc'); expect(svc.listPipelines()).toContain('test'); });
    it('gets pipeline info', () => { svc.createPipeline('test', 'desc'); const id = svc.listPipelines().match(/pipeline_\w+/)?.[0] || ''; expect(svc.getPipeline(id)).toContain('test'); });
    it('adds step', () => { svc.createPipeline('test', 'desc'); const id = svc.listPipelines().match(/pipeline_\w+/)?.[0] || ''; expect(svc.addStep(id, 'extract', { source: 'test.json' })).toContain('added'); });
    it('deletes pipeline', () => { svc.createPipeline('test', 'desc'); const id = svc.listPipelines().match(/pipeline_\w+/)?.[0] || ''; expect(svc.deletePipeline(id)).toContain('deleted'); });
    it('returns error for non-existent pipeline', () => { expect(svc.getPipeline('nonexistent')).toContain('Error'); });
    it('gets stats', () => { svc.createPipeline('test', 'desc'); expect(svc.getStats()).toContain('Pipelines: 1'); });
    it('lists when empty', () => { expect(svc.listPipelines()).toContain('No pipelines'); });
    it('runs extract pipeline', async () => {
      const data = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];
      fs.writeFileSync(path.join(dir, 'input.json'), JSON.stringify(data));
      svc.createPipeline('test', 'desc');
      const id = svc.listPipelines().match(/pipeline_\w+/)?.[0] || '';
      svc.addStep(id, 'extract', { source: path.join(dir, 'input.json'), format: 'json' });
      const r = await svc.runPipeline(id);
      expect(r).toContain('completed');
    });
    it('runs filter pipeline', async () => {
      const data = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];
      fs.writeFileSync(path.join(dir, 'input.json'), JSON.stringify(data));
      svc.createPipeline('test', 'desc');
      const id = svc.listPipelines().match(/pipeline_\w+/)?.[0] || '';
      svc.addStep(id, 'extract', { source: path.join(dir, 'input.json'), format: 'json' });
      svc.addStep(id, 'filter', { field: 'age', operator: 'gt', value: 27 });
      const r = await svc.runPipeline(id);
      expect(r).toContain('completed');
    });
    it('runs sort pipeline', async () => {
      const data = [{ name: 'Bob', age: 25 }, { name: 'Alice', age: 30 }];
      fs.writeFileSync(path.join(dir, 'input.json'), JSON.stringify(data));
      svc.createPipeline('test', 'desc');
      const id = svc.listPipelines().match(/pipeline_\w+/)?.[0] || '';
      svc.addStep(id, 'extract', { source: path.join(dir, 'input.json'), format: 'json' });
      svc.addStep(id, 'sort', { field: 'age', order: 'asc' });
      const r = await svc.runPipeline(id);
      expect(r).toContain('completed');
    });
    it('runs aggregate pipeline', async () => {
      const data = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];
      fs.writeFileSync(path.join(dir, 'input.json'), JSON.stringify(data));
      svc.createPipeline('test', 'desc');
      const id = svc.listPipelines().match(/pipeline_\w+/)?.[0] || '';
      svc.addStep(id, 'extract', { source: path.join(dir, 'input.json'), format: 'json' });
      svc.addStep(id, 'aggregate', { field: 'age', operation: 'avg' });
      const r = await svc.runPipeline(id);
      expect(r).toContain('completed');
    });
  });

  describe('ZavorthPluginMarketplaceService', () => {
    let svc: ZavorthPluginMarketplaceService;
    beforeEach(() => { svc = new ZavorthPluginMarketplaceService({ storageDir: dir }); });

    it('searches plugins', () => { expect(svc.search('vision')).toContain('Vision'); });
    it('searches by category', () => { expect(svc.search('', 'ai-safety')).toContain('AI Safety'); });
    it('gets plugin info', () => { expect(svc.getPlugin('zavorth-llm-router')).toContain('LLM Router'); });
    it('returns error for non-existent plugin', () => { expect(svc.getPlugin('nonexistent')).toContain('Error'); });
    it('installs plugin', () => { expect(svc.installPlugin('zavorth-ai-safety')).toContain('already installed'); });
    it('uninstalls plugin', () => { expect(svc.uninstallPlugin('zavorth-ai-safety')).toContain('uninstalled'); });
    it('enables plugin', () => { expect(svc.enablePlugin('zavorth-ai-safety')).toContain('enabled'); });
    it('disables plugin', () => { expect(svc.disablePlugin('zavorth-ai-safety')).toContain('disabled'); });
    it('rates plugin', () => { expect(svc.ratePlugin('zavorth-ai-safety', 'user1', 5, 'Great!')).toContain('submitted'); });
    it('gets reviews', () => { svc.ratePlugin('zavorth-ai-safety', 'user1', 5, 'Great!'); expect(svc.getReviews('zavorth-ai-safety')).toContain('Great!'); });
    it('lists categories', () => { expect(svc.listCategories()).toContain('ai-safety'); });
    it('gets featured', () => { expect(svc.getFeatured()).toContain('Featured'); });
    it('gets trending', () => { expect(svc.getTrending()).toContain('Trending'); });
    it('gets stats', () => { expect(svc.getStats()).toContain('Total plugins'); });
  });

  describe('NotificationCenterService', () => {
    let svc: NotificationCenterService;
    beforeEach(() => { svc = new NotificationCenterService({ storageDir: dir }); });

    it('sends notification', () => { expect(svc.send('Test', 'Message')).toContain('sent'); });
    it('gets unread', () => { svc.send('Test', 'Message'); expect(svc.getUnread()).toContain('Test'); });
    it('gets by type', () => { svc.send('Test', 'Message', { type: 'error' }); expect(svc.getByType('error')).toContain('error'); });
    it('gets by priority', () => { svc.send('Test', 'Message', { priority: 'high' }); expect(svc.getByPriority('high')).toContain('high'); });
    it('lists channels', () => { expect(svc.listChannels()).toContain('Internal'); });
    it('adds channel', () => { expect(svc.addChannel('Test', 'email')).toContain('added'); });
    it('enables channel', () => { expect(svc.enableChannel('email')).toContain('enabled'); });
    it('disables channel', () => { expect(svc.disableChannel('internal')).toContain('disabled'); });
    it('gets stats', () => { svc.send('Test', 'Message'); expect(svc.getStats()).toContain('Total: 1'); });
    it('clears old', () => { svc.send('Test', 'Message'); expect(svc.clearOld(0)).toContain('Cleared'); });
    it('lists when empty', () => { expect(svc.getUnread()).toContain('No unread'); });
  });

  describe('VersionControlService', () => {
    let svc: VersionControlService;
    beforeEach(() => { svc = new VersionControlService({ storageDir: dir }); });

    it('commits file', () => {
      const file = path.join(dir, 'test.txt');
      fs.writeFileSync(file, 'hello');
      expect(svc.commit(file, 'initial')).toContain('Committed');
    });
    it('gets history', () => {
      const file = path.join(dir, 'test.txt');
      fs.writeFileSync(file, 'hello');
      svc.commit(file, 'v1');
      expect(svc.getHistory(file)).toContain('v1');
    });
    it('gets version', () => {
      const file = path.join(dir, 'test.txt');
      fs.writeFileSync(file, 'hello');
      svc.commit(file, 'v1');
      const id = svc.getHistory(file).match(/ver_\w+/)?.[0] || '';
      expect(svc.getVersion(id)).toBe('hello');
    });
    it('reverts file', () => {
      const file = path.join(dir, 'test.txt');
      fs.writeFileSync(file, 'v1');
      svc.commit(file, 'v1');
      fs.writeFileSync(file, 'v2');
      svc.commit(file, 'v2');
      const id = svc.getHistory(file).match(/ver_\w+/)?.[0] || '';
      expect(svc.revert(file, id)).toContain('Reverted');
    });
    it('shows diff', () => {
      const file = path.join(dir, 'test.txt');
      fs.writeFileSync(file, 'v1');
      svc.commit(file, 'v1');
      fs.writeFileSync(file, 'v2');
      svc.commit(file, 'v2');
      const ids = svc.getHistory(file).match(/ver_\w+/g) || [];
      expect(svc.diff(ids[0], ids[1])).toContain('Additions');
    });
    it('tags version', () => {
      const file = path.join(dir, 'test.txt');
      fs.writeFileSync(file, 'hello');
      svc.commit(file, 'v1');
      const id = svc.getHistory(file).match(/ver_\w+/)?.[0] || '';
      expect(svc.tag(id, 'stable')).toContain('Tagged');
    });
    it('lists files', () => {
      const file = path.join(dir, 'test.txt');
      fs.writeFileSync(file, 'hello');
      svc.commit(file, 'v1');
      expect(svc.listFiles()).toContain('test.txt');
    });
    it('gets stats', () => {
      const file = path.join(dir, 'test.txt');
      fs.writeFileSync(file, 'hello');
      svc.commit(file, 'v1');
      expect(svc.getStats()).toContain('Tracked files: 1');
    });
    it('returns error for non-existent file', () => { expect(svc.commit('/nonexistent', 'test')).toContain('Error'); });
    it('returns error for non-existent history', () => { expect(svc.getHistory('/nonexistent')).toContain('No version'); });
  });

  describe('AutoSkillGeneratorService', () => {
    let svc: AutoSkillGeneratorService;
    beforeEach(() => { svc = new AutoSkillGeneratorService({ storageDir: dir }); });

    it('records workflow', () => { expect(svc.recordWorkflow(['web_search', 'create_file'], ['search', 'write'], true, 5000)).toContain('recorded'); });
    it('tracks frequency', () => {
      svc.recordWorkflow(['tool_a', 'tool_b'], ['step1'], true, 1000);
      svc.recordWorkflow(['tool_a', 'tool_b'], ['step1'], true, 1000);
      svc.recordWorkflow(['tool_a', 'tool_b'], ['step1'], true, 1000);
      expect(svc.listPatterns()).toContain('3 uses');
    });
    it('qualifies pattern', () => {
      for (let i = 0; i < 3; i++) svc.recordWorkflow(['web_search', 'create_file'], ['search', 'write'], true, 5000);
      expect(svc.listPatterns()).toContain('✅');
    });
    it('generates skill', () => {
      for (let i = 0; i < 3; i++) svc.recordWorkflow(['web_search', 'create_file'], ['search', 'write'], true, 5000);
      const patterns = svc.listPatterns();
      const patId = patterns.match(/pat_\w+/)?.[0] || '';
      expect(svc.generateSkill(patId)).toContain('Auto-generated');
    });
    it('approves skill', () => {
      for (let i = 0; i < 3; i++) svc.recordWorkflow(['web_search', 'create_file'], ['search', 'write'], true, 5000);
      const patterns = svc.listPatterns();
      const patId = patterns.match(/pat_\w+/)?.[0] || '';
      svc.generateSkill(patId);
      const skills = svc.listGeneratedSkills();
      const skillId = skills.match(/auto_\w+/)?.[0] || '';
      expect(svc.approveSkill(skillId)).toContain('approved');
    });
    it('rejects skill', () => {
      for (let i = 0; i < 3; i++) svc.recordWorkflow(['tool_x'], ['step'], true, 1000);
      const patterns = svc.listPatterns();
      const patId = patterns.match(/pat_\w+/)?.[0] || '';
      svc.generateSkill(patId);
      const skills = svc.listGeneratedSkills();
      const skillId = skills.match(/auto_\w+/)?.[0] || '';
      expect(svc.rejectSkill(skillId)).toContain('rejected');
    });
    it('returns error for non-existent pattern', () => { expect(svc.generateSkill('nonexistent')).toContain('not found'); });
    it('returns error for non-existent skill approve', () => { expect(svc.approveSkill('nonexistent')).toContain('not found'); });
    it('gets stats', () => { svc.recordWorkflow(['a', 'b'], ['step'], true, 1000); expect(svc.getStats()).toContain('Patterns: 1'); });
  });
});
