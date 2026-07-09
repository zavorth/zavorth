import fs from 'fs';
import os from 'os';
import path from 'path';
import { MigrationUXService } from '../../src/services/plugins/MigrationUXService';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'migration-ux-'));

describe('MigrationUXService', () => {
  let svc: MigrationUXService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new MigrationUXService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates instance', () => { expect(svc).toBeDefined(); });

  it('detects config-centric agent workspace (yaml + agent dir)', () => {
    const agentDir = path.join(dir, 'legacy-python-agent');
    fs.mkdirSync(agentDir);
    fs.writeFileSync(path.join(agentDir, 'config.yaml'), 'test');
    fs.mkdirSync(path.join(agentDir, 'agent'));
    const detection = svc.detectAgent(agentDir);
    expect(detection).toBeTruthy();
    expect(detection!.type).toBe('config-centric-home');
  });

  it('detects opaque/empty TypeScript-style workspace without strong structural signals', () => {
    const agentDir = path.join(dir, 'legacy-typescript-agent');
    fs.mkdirSync(agentDir);
    fs.writeFileSync(path.join(agentDir, 'agent.json'), '{}');
    fs.mkdirSync(path.join(agentDir, 'src'));
    const detection = svc.detectAgent(agentDir);
    expect(detection).toBeTruthy();
    expect(detection!.type).toBe('opaque-or-empty');
  });

  it('detects identity-markdown workspace (IDENTITY.md + SOUL.md)', () => {
    const agentDir = path.join(dir, 'zavorth');
    fs.mkdirSync(agentDir);
    fs.writeFileSync(path.join(agentDir, 'IDENTITY.md'), 'test');
    fs.writeFileSync(path.join(agentDir, 'SOUL.md'), 'test');
    const detection = svc.detectAgent(agentDir);
    expect(detection).toBeTruthy();
    expect(detection!.type).toBe('identity-markdown-home');
  });

  it('detects product-specific Claude layout as opaque (brand-agnostic profiles only)', () => {
    const agentDir = path.join(dir, 'claude');
    fs.mkdirSync(agentDir);
    fs.writeFileSync(path.join(agentDir, 'CLAUDE.md'), 'test');
    fs.mkdirSync(path.join(agentDir, '.claude'));
    const detection = svc.detectAgent(agentDir);
    expect(detection).toBeTruthy();
    expect(detection!.type).toBe('opaque-or-empty');
  });

  it('detects product-specific Cursor layout as opaque (brand-agnostic profiles only)', () => {
    const agentDir = path.join(dir, 'cursor');
    fs.mkdirSync(agentDir);
    fs.writeFileSync(path.join(agentDir, '.cursorrules'), 'test');
    fs.mkdirSync(path.join(agentDir, '.cursor'));
    const detection = svc.detectAgent(agentDir);
    expect(detection).toBeTruthy();
    expect(detection!.type).toBe('opaque-or-empty');
  });

  it('detects skill-centric workspace by structural patterns (SOUL.md + skills/ + memories/)', () => {
    const agentDir = path.join(dir, 'my-community-agent');
    fs.mkdirSync(agentDir);
    fs.writeFileSync(path.join(agentDir, 'SOUL.md'), 'identity content');
    fs.writeFileSync(path.join(agentDir, 'achievements.yml'), 'xp: 0');
    fs.mkdirSync(path.join(agentDir, 'skills'));
    fs.mkdirSync(path.join(agentDir, 'memories'));
    const detection = svc.detectAgent(agentDir);
    expect(detection).toBeTruthy();
    expect(detection!.type).toBe('skill-centric-home');
  });

  it('returns null for non-existent path', () => {
    expect(svc.detectAgent('/nonexistent')).toBeNull();
  });

  it('counts skills', () => {
    const agentDir = path.join(dir, 'test');
    fs.mkdirSync(agentDir);
    fs.mkdirSync(path.join(agentDir, 'skills'));
    fs.mkdirSync(path.join(agentDir, 'skills', 'skill1'));
    fs.mkdirSync(path.join(agentDir, 'skills', 'skill2'));
    const detection = svc.detectAgent(agentDir);
    expect(detection!.skills).toBe(2);
  });

  it('plans migration', () => {
    const agentDir = path.join(dir, 'test');
    fs.mkdirSync(agentDir);
    fs.writeFileSync(path.join(agentDir, 'config.json'), '{"key": "value"}');
    const detection = svc.detectAgent(agentDir);
    const plan = svc.planMigration(detection!);
    expect(plan.items.length).toBeGreaterThan(0);
  });

  it('detects secrets in files', () => {
    const agentDir = path.join(dir, 'test');
    fs.mkdirSync(agentDir);
    fs.writeFileSync(path.join(agentDir, 'config.json'), '{"api_key": "sk-123"}');
    const detection = svc.detectAgent(agentDir);
    const plan = svc.planMigration(detection!);
    expect(plan.warnings.length).toBeGreaterThan(0);
  });

  it('executes dry run', () => {
    const agentDir = path.join(dir, 'test');
    fs.mkdirSync(agentDir);
    fs.writeFileSync(path.join(agentDir, 'config.json'), '{"key": "value"}');
    const detection = svc.detectAgent(agentDir);
    const plan = svc.planMigration(detection!);
    const result = svc.executeMigration(plan, { dryRun: true });
    expect(result.success).toBe(0);
  });

  it('generates report', () => {
    const agentDir = path.join(dir, 'test');
    fs.mkdirSync(agentDir);
    fs.writeFileSync(path.join(agentDir, 'config.json'), '{"key": "value"}');
    const detection = svc.detectAgent(agentDir);
    const plan = svc.planMigration(detection!);
    const result = svc.executeMigration(plan, { dryRun: true });
    const report = svc.generateReport(plan, result);
    expect(report).toMatch(/Migration Report|Universal Workspace Import Report/);
  });
});
