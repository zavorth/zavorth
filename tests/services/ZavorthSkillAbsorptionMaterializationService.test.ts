import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthSkillAbsorptionMaterializationService } from '../../src/services/ZavorthSkillAbsorptionMaterializationService.js';

describe('ZavorthSkillAbsorptionMaterializationService Runtime gateway/8', () => {
  it('previews batches without writing imported skill files', async () => {
    const fixture = createFixture();
    try {
      const snapshot = await new ZavorthSkillAbsorptionMaterializationService({
        now: () => new Date('2026-05-10T14:20:00.000Z'),
        projectRoot: fixture.root,
      }).buildSnapshot({
        sources: [{ sourcePath: fixture.source }],
        targetRootPath: fixture.target,
        apply: false,
        bridgeDryRun: false,
      });

      expect(snapshot.status).toBe('preview-only');
      expect(snapshot.summary.workspaceMutationPerformed).toBe(false);
      expect(snapshot.summary.skillsSelected).toBe(1);
      expect(fs.existsSync(path.join(fixture.target, 'safe-review-skill'))).toBe(false);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('materializes allowlisted skills with provenance and rollback evidence', async () => {
    const fixture = createFixture();
    try {
      const snapshot = await new ZavorthSkillAbsorptionMaterializationService({
        now: () => new Date('2026-05-10T14:20:00.000Z'),
        projectRoot: fixture.root,
      }).buildSnapshot({
        sources: [{ sourcePath: fixture.source }],
        targetRootPath: fixture.target,
        apply: true,
        approvalId: 'approval-test',
        allowedSourceIds: ['*'],
        allowAllSkills: true,
        bridgeDryRun: false,
      });

      expect(snapshot.status).toBe('materialized');
      expect(snapshot.summary.skillsMaterialized).toBe(1);
      expect(snapshot.summary.upstreamRuntimeCodeExecuted).toBe(false);
      expect(snapshot.policy.supportFilesAreNotExecutableTools).toBe(true);
      expect(snapshot.rollback.available).toBe(true);
      expect(fs.existsSync(path.join(fixture.target, 'safe-review-skill', 'ORIGIN.json'))).toBe(true);
      expect(fs.existsSync(path.join(fixture.target, 'safe-review-skill', 'ATTRIBUTION.md'))).toBe(true);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-materialization-test-'));
  const source = path.join(root, 'source');
  const target = path.join(root, 'skill-library', 'imported');
  const skill = path.join(source, 'safe-review-skill');
  fs.mkdirSync(path.join(skill, 'references'), { recursive: true });
  fs.writeFileSync(path.join(skill, 'SKILL.md'), [
    '---',
    'name: safe-review-skill',
    'description: Safe local review skill.',
    'license: MIT',
    '---',
    '',
    '# Safe Review Skill',
    '',
    'Review local notes and summarize evidence.',
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(skill, 'references', 'notes.md'), '# Notes\n\nFixture evidence.\n', 'utf8');
  return { root, source, target };
}

