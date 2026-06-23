import fs from 'fs';
import os from 'os';
import path from 'path';
import { NotificationCenterService } from '../../src/services/plugins/NotificationCenterService';
import { VersionControlService } from '../../src/services/plugins/VersionControlService';
import { CircuitBreakerService } from '../../src/services/plugins/CircuitBreakerService';
import { RetryService } from '../../src/services/plugins/RetryService';
import { HealthCheckService } from '../../src/services/plugins/HealthCheckService';
import { BackupService } from '../../src/services/plugins/BackupService';
import { AutoSkillGeneratorService } from '../../src/services/plugins/AutoSkillGeneratorService';
import { MemorySupermemoryService } from '../../src/services/plugins/MemorySupermemoryService';
import { MemoryByteroverService } from '../../src/services/plugins/MemoryByteroverService';
import { MemoryHindsightService } from '../../src/services/plugins/MemoryHindsightService';
import { MemoryHolographicService } from '../../src/services/plugins/MemoryHolographicService';
import { MemoryRetainDBService } from '../../src/services/plugins/MemoryRetainDBService';
import { MemorySemanticCacheService } from '../../src/services/plugins/MemorySemanticCacheService';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'notif-vc-'));

describe('NotificationCenterService', () => {
  let svc: NotificationCenterService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new NotificationCenterService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates instance', () => { expect(svc).toBeDefined(); });
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
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new VersionControlService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates instance', () => { expect(svc).toBeDefined(); });
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
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new AutoSkillGeneratorService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates instance', () => { expect(svc).toBeDefined(); });
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

describe('Memory Services', () => {
  let dir: string;
  beforeEach(() => { dir = tmpDir(); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('MemorySupermemoryService creates instance', () => { expect(new MemorySupermemoryService({ storageDir: dir })).toBeDefined(); });
  it('MemoryByteroverService creates instance', () => { expect(new MemoryByteroverService({ storageDir: dir })).toBeDefined(); });
  it('MemoryHindsightService creates instance', () => { expect(new MemoryHindsightService({ storageDir: dir })).toBeDefined(); });
  it('MemoryHolographicService creates instance', () => { expect(new MemoryHolographicService({ storageDir: dir })).toBeDefined(); });
  it('MemoryRetainDBService creates instance', () => { expect(new MemoryRetainDBService({ storageDir: dir })).toBeDefined(); });
  it('MemorySemanticCacheService creates instance', () => { expect(new MemorySemanticCacheService({ storageDir: dir })).toBeDefined(); });
});
