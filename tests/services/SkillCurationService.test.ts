import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { SkillCurationService } from '../../src/skills/SkillCurationService.js';
import { Database } from '../../src/storage/Database.js';
import { config } from '../../src/config/index.js';

describe('SkillCurationService', () => {
  let db: Database;
  let curationService: SkillCurationService;
  const testSkillId = 'curation-test-dummy';
  const testSkillDir = path.join(config.projectRoot, 'skill-library', testSkillId);

  beforeAll(async () => {
    db = await Database.getInstance();
    curationService = new SkillCurationService();
  });

  beforeEach(() => {
    if (!fs.existsSync(testSkillDir)) {
      fs.mkdirSync(testSkillDir, { recursive: true });
    }
    fs.writeFileSync(path.join(testSkillDir, 'SKILL.md'), '# Test Dummy Skill\nFor curation tests.');
    fs.writeFileSync(path.join(testSkillDir, 'entry.ts'), 'console.log("hello test");');
    db.run(`DELETE FROM zavorth_skills_telemetry WHERE skill_id = -`, [testSkillId]);
  });

  afterEach(() => {
    fs.rmSync(testSkillDir, { recursive: true, force: true });
    fs.rmSync(path.join(curationService.getArchiveDir(), `${testSkillId}.zip`), { force: true });
    fs.rmSync(path.join(curationService.getArchiveDir(), `${testSkillId}.manifest.json`), { force: true });
    fs.rmSync(path.join(config.projectRoot, 'skill-library', 'escaped.txt'), { force: true });
  });

  it('can toggle the pinned state in SQLite telemetry', async () => {
    await curationService.togglePin(testSkillId, true);

    const record = db.get<{ pinned: number }>(
      `SELECT pinned FROM zavorth_skills_telemetry WHERE skill_id = -`,
      [testSkillId],
    );
    expect(record).toBeDefined();
    expect(record?.pinned).toBe(1);

    await curationService.togglePin(testSkillId, false);
    const updated = db.get<{ pinned: number }>(
      `SELECT pinned FROM zavorth_skills_telemetry WHERE skill_id = -`,
      [testSkillId],
    );
    expect(updated?.pinned).toBe(0);
  });

  it('compresses a skill into a zip and deletes the original folder on archiveSkill', async () => {
    db.run(
      `INSERT INTO zavorth_skills_telemetry (skill_id, use_count, last_executed_at, status, pinned)
       VALUES (-, 1, datetime('now'), 'active', 0)`,
      [testSkillId],
    );

    const customService = serviceWithCatalog(testSkillId, testSkillDir, 'workspace-library');

    await customService.archiveSkill(testSkillId);

    expect(fs.existsSync(testSkillDir)).toBe(false);
    expect(fs.existsSync(path.join(curationService.getArchiveDir(), `${testSkillId}.zip`))).toBe(true);
    expect(fs.existsSync(path.join(curationService.getArchiveDir(), `${testSkillId}.manifest.json`))).toBe(true);

    const record = db.get<{ status: string }>(
      `SELECT status FROM zavorth_skills_telemetry WHERE skill_id = -`,
      [testSkillId],
    );
    expect(record?.status).toBe('archived');
  });

  it('extracts the zip file back to the original managed folder and updates SQLite status', async () => {
    const archiveFile = path.join(curationService.getArchiveDir(), `${testSkillId}.zip`);
    const customService = serviceWithCatalog(testSkillId, testSkillDir, 'workspace-library');
    await customService.archiveSkill(testSkillId);

    await curationService.restoreSkill(testSkillId);

    expect(fs.existsSync(testSkillDir)).toBe(true);
    expect(fs.existsSync(path.join(testSkillDir, 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(testSkillDir, 'entry.ts'))).toBe(true);
    expect(fs.readFileSync(path.join(testSkillDir, 'entry.ts'), 'utf8')).toBe('console.log("hello test");');
    expect(fs.existsSync(archiveFile)).toBe(false);

    const record = db.get<{ status: string }>(
      `SELECT status FROM zavorth_skills_telemetry WHERE skill_id = -`,
      [testSkillId],
    );
    expect(record?.status).toBe('active');
  });

  it('ignores native skills from curation with explicit guard protection', async () => {
    const customService = serviceWithCatalog(testSkillId, testSkillDir, 'zavorth-native');

    await expect(customService.archiveSkill(testSkillId)).rejects.toThrow(
      'Archiving the native core skill is not allowed',
    );
  });

  it('blocks Zip Slip entries when restoring archived skills', async () => {
    const archiveFile = path.join(curationService.getArchiveDir(), `${testSkillId}.zip`);
    const manifestFile = path.join(curationService.getArchiveDir(), `${testSkillId}.manifest.json`);
    const outsidePath = path.join(config.projectRoot, 'skill-library', 'escaped.txt');
    const zip = new JSZip();
    zip.file('../escaped.txt', 'nope');
    fs.writeFileSync(archiveFile, await zip.generateAsync({ type: 'nodebuffer' }));
    fs.writeFileSync(manifestFile, JSON.stringify({
      version: 1,
      skillId: testSkillId,
      archivedAt: new Date().toISOString(),
      originalDirPath: testSkillDir,
      sourceId: 'workspace-library',
      sourceLabel: 'Workspace skill library',
    }));
    fs.rmSync(testSkillDir, { recursive: true, force: true });
    fs.rmSync(outsidePath, { force: true });

    await expect(curationService.restoreSkill(testSkillId)).rejects.toThrow('caminho inseguro');
    expect(fs.existsSync(outsidePath)).toBe(false);
  });
});

function serviceWithCatalog(skillId: string, dirPath: string, sourceId: string): SkillCurationService {
  return new SkillCurationService({
    listEntries: () => [
      {
        name: skillId,
        dirPath,
        sourceId,
        sourceLabel: 'Workspace skill library',
      } as any,
    ],
    buildSnapshot: () => ({}) as any,
  } as any);
}
