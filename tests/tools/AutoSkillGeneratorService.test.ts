import fs from 'fs';
import os from 'os';
import path from 'path';
import { AutoSkillGeneratorService } from '../../src/services/plugins/AutoSkillGeneratorService';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'auto-skill-'));

describe('AutoSkillGeneratorService', () => {
  let svc: AutoSkillGeneratorService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new AutoSkillGeneratorService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('records a workflow', () => {
    const r = svc.recordWorkflow(['web_search', 'create_file'], ['search', 'write'], true, 5000);
    expect(r).toContain('recorded');
  });

  it('tracks pattern frequency', () => {
    svc.recordWorkflow(['tool_a', 'tool_b'], ['step1'], true, 1000);
    svc.recordWorkflow(['tool_a', 'tool_b'], ['step1'], true, 1000);
    svc.recordWorkflow(['tool_a', 'tool_b'], ['step1'], true, 1000);
    const r = svc.listPatterns();
    expect(r).toContain('3 uses');
  });

  it('qualifies pattern after min frequency', () => {
    for (let i = 0; i < 3; i++) {
      svc.recordWorkflow(['web_search', 'create_file'], ['search', 'write'], true, 5000);
    }
    const r = svc.listPatterns();
    expect(r).toContain('✅');
  });

  it('generates skill from qualifying pattern', () => {
    for (let i = 0; i < 3; i++) {
      svc.recordWorkflow(['web_search', 'create_file'], ['search', 'write'], true, 5000);
    }
    const patterns = svc.listPatterns();
    const patId = patterns.match(/pat_\w+/)?.[0] || '';
    const r = svc.generateSkill(patId);
    expect(r).toContain('Auto-generated');
  });

  it('approves and installs skill', () => {
    for (let i = 0; i < 3; i++) {
      svc.recordWorkflow(['web_search', 'create_file'], ['search', 'write'], true, 5000);
    }
    const patterns = svc.listPatterns();
    const patId = patterns.match(/pat_\w+/)?.[0] || '';
    svc.generateSkill(patId);
    const skills = svc.listGeneratedSkills();
    const skillId = skills.match(/auto_\w+/)?.[0] || '';
    const r = svc.approveSkill(skillId);
    expect(r).toContain('approved');
  });

  it('rejects skill', () => {
    for (let i = 0; i < 3; i++) {
      svc.recordWorkflow(['tool_x'], ['step'], true, 1000);
    }
    const patterns = svc.listPatterns();
    const patId = patterns.match(/pat_\w+/)?.[0] || '';
    svc.generateSkill(patId);
    const skills = svc.listGeneratedSkills();
    const skillId = skills.match(/auto_\w+/)?.[0] || '';
    const r = svc.rejectSkill(skillId);
    expect(r).toContain('rejected');
  });

  it('returns error for non-existent pattern', () => {
    const r = svc.generateSkill('nonexistent');
    expect(r).toContain('not found');
  });

  it('returns error for non-existent skill approve', () => {
    const r = svc.approveSkill('nonexistent');
    expect(r).toContain('not found');
  });

  it('returns error for low frequency pattern', () => {
    svc.recordWorkflow(['tool'], ['step'], true, 1000);
    const patterns = svc.listPatterns();
    const patId = patterns.match(/pat_\w+/)?.[0] || '';
    const r = svc.generateSkill(patId);
    expect(r).toContain('Error');
  });

  it('gets stats', () => {
    svc.recordWorkflow(['a', 'b'], ['step'], true, 1000);
    const r = svc.getStats();
    expect(r).toContain('Patterns: 1');
  });
});
