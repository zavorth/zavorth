import fs from 'fs';
import path from 'path';
import { config } from '../src/config/index.js';
import { Database } from '../src/storage/Database.js';
import { SkillCurationService } from '../src/skills/SkillCurationService.js';

const skillId = `smart-skills-canary-${process.pid}`;
const skillDir = path.join(config.projectRoot, 'skill-library', skillId);
const service = new SkillCurationService({
  listEntries: () => [
    {
      name: skillId,
      description: 'Temporary Smart-Skills curation canary.',
      dirPath: skillDir,
      skillFilePath: path.join(skillDir, 'SKILL.md'),
      supportFilePaths: [],
      sourceId: 'workspace-library',
      sourceLabel: 'Workspace skill library',
      sourceTrust: 'trusted',
      license: 'MIT',
      imported: false,
      bundleTags: [],
      supportFileCount: 0,
      searchText: skillId,
      provenance: null,
      risk: null,
      licensePolicy: null,
      audit: null,
      metadata: {},
    },
  ],
  buildSnapshot: () => ({}) as never,
} as never);

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  try {
    await cleanup();
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Smart Skills Canary\nTemporary skill for curation smoke.\n', 'utf8');
    fs.writeFileSync(path.join(skillDir, 'README.md'), 'Canary support file.\n', 'utf8');

    await service.togglePin(skillId, true);
    await service.togglePin(skillId, false);
    await service.archiveSkill(skillId);
    const archived = await service.listArchivedSkills();
    const archivedEntry = archived.find((entry) => entry.skillId === skillId);
    if (!archivedEntry) {
      throw new Error('canary archive was not visible in listArchivedSkills');
    }
    if (fs.existsSync(skillDir)) {
      throw new Error('canary skill directory still exists after archive');
    }

    await service.restoreSkill(skillId);
    if (!fs.existsSync(path.join(skillDir, 'SKILL.md'))) {
      throw new Error('canary skill was not restored to original directory');
    }

    const db = await Database.getInstance();
    const telemetry = db.get<{ status: string; use_count: number; pinned: number }>(
      `SELECT status, use_count, pinned FROM zavorth_skills_telemetry WHERE skill_id = ...`,
      [skillId],
    );
    if (!telemetry || telemetry.status !== 'active') {
      throw new Error('canary telemetry did not return to active status');
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      skillId,
      skillDir,
      archivePath: archivedEntry.archivePath,
      telemetry,
    }, null, 2)}\n`);
  } finally {
    await cleanup();
  }
}

async function cleanup(): Promise<void> {
  fs.rmSync(skillDir, { recursive: true, force: true });
  fs.rmSync(path.join(config.dataDir, 'skills', 'archive', `${skillId}.zip`), { force: true });
  fs.rmSync(path.join(config.dataDir, 'skills', 'archive', `${skillId}.manifest.json`), { force: true });
  try {
    const dbPath = path.dirname(config.dbPath);
    if (fs.existsSync(dbPath)) {
      const db = await Database.getInstance();
      db.run(`DELETE FROM zavorth_skills_telemetry WHERE skill_id = ...`, [skillId]);
    }
  } catch {
    // Best-effort cleanup only.
  }
}
