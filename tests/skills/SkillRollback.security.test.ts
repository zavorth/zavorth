import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SkillRollback } from '../../src/skills/marketplace/SkillRollback';

describe('SkillRollback path confinement', () => {
  it('keeps generated backups inside the rollback root', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-rollback-'));
    const source = path.join(temp, 'source');
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'SKILL.md'), 'safe');
    const rollback = new SkillRollback({ dataDir: path.join(temp, 'data') });

    const backup = rollback.createBackup(source, '../../outside', '../version');
    const rollbackRoot = path.resolve(temp, 'data', 'skill-marketplace', 'rollbacks');
    expect(backup.startsWith(`${rollbackRoot}${path.sep}`)).toBe(true);
    expect(path.relative(rollbackRoot, backup)).not.toMatch(/^\.\.(-:[\\/]|$)/);

    fs.rmSync(temp, { recursive: true, force: true });
  });

  it('rejects a tampered rollback index that points outside its data directory', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-rollback-'));
    const dataDir = path.join(temp, 'data');
    const rollbackDir = path.join(dataDir, 'skill-marketplace', 'rollbacks');
    const outside = path.join(temp, 'outside');
    fs.mkdirSync(rollbackDir, { recursive: true });
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'keep.txt'), 'preserve');
    fs.writeFileSync(path.join(rollbackDir, 'index.json'), JSON.stringify([{
      skillId: 'safe-skill', version: '1.0.0', backedUpAt: new Date().toISOString(), backupPath: outside,
    }]));

    const result = new SkillRollback({ dataDir }).rollbackToVersion('safe-skill', '1.0.0');
    expect(result.success).toBe(false);
    expect(fs.readFileSync(path.join(outside, 'keep.txt'), 'utf8')).toBe('preserve');

    fs.rmSync(temp, { recursive: true, force: true });
  });
});
