import fs from 'fs';
import os from 'os';
import path from 'path';
import { UniversalSkillScaleHardeningService } from '../../src/services/UniversalSkillScaleHardeningService.js';

function writeSkill(root: string, input: {
  dirName: string;
  name: string;
  description: string;
  body?: string;
}): void {
  const dir = path.join(root, input.dirName);
  fs.mkdirSync(path.join(dir, 'references'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), [
    '---',
    `name: ${input.name}`,
    `description: ${input.description}`,
    'license: MIT',
    '---',
    '',
    `# ${input.name}`,
    '',
    input.body || input.description,
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(dir, 'references', 'notes.md'), '# Notes\n', 'utf8');
}

function writeSkills(root: string, count: number): void {
  for (let index = 1; index <= count; index += 1) {
    writeSkill(root, {
      dirName: `skill-${String(index).padStart(2, '0')}`,
      name: `skill-${String(index).padStart(2, '0')}`,
      description: `Useful governed skill number ${index}.`,
      body: 'Read local notes and summarize evidence.',
    });
  }
}

describe('UniversalSkillScaleHardeningService Certification matrix', () => {
  let root: string;
  let source: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-scale-hardening-'));
    source = path.join(root, 'skill-source');
    fs.mkdirSync(source, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('builds batch and dashboard review contracts without visual mutation', async () => {
    writeSkills(source, 7);

    const snapshot = await new UniversalSkillScaleHardeningService({
      now: () => new Date('2026-05-10T21:00:00.000Z'),
      projectRoot: root,
    }).buildSnapshot({
      projectRoot: root,
      sources: [{ sourcePath: source, presetId: 'generic-skill-folder' }],
      discover: false,
      batchSize: 3,
      largeLibraryThreshold: 5,
    });

    expect(snapshot.status).toBe('passed');
    expect(snapshot.capacity).toEqual(expect.objectContaining({
      scaleBand: 'large',
      candidateCount: 7,
      batchCount: 3,
    }));
    expect(snapshot.batches).toHaveLength(3);
    expect(snapshot.batches.every((batch) => batch.approvalRequired)).toBe(true);
    expect(snapshot.dashboardReview).toEqual(expect.objectContaining({
      contractOnly: true,
      approvedVisualChangesApplied: false,
      layoutMutationPerformed: false,
    }));
    expect(snapshot.dashboardReview.items.every((item) => item.ownerApprovalRequired)).toBe(true);
    expect(snapshot.policy.noVisualChangeWithoutOwnerApproval).toBe(true);
  });

  it('propagates lower-phase blocked gates into scale hardening', async () => {
    writeSkills(source, 7);

    const snapshot = await new UniversalSkillScaleHardeningService({
      projectRoot: root,
    }).buildSnapshot({
      projectRoot: root,
      sources: [{ sourcePath: source }],
      discover: false,
      maxCandidates: 3,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'dashboard-controls-onboarding', status: 'blocked' }),
      expect.objectContaining({ id: 'candidate-scale-limit', status: 'blocked' }),
    ]));
    expect(snapshot.rollout.recommendedMode).toBe('hold');
  });

  it('recommends canary mode after limited apply', async () => {
    writeSkills(source, 2);

    const snapshot = await new UniversalSkillScaleHardeningService({
      projectRoot: root,
    }).buildSnapshot({
      projectRoot: root,
      sources: [{ sourcePath: source }],
      discover: false,
      apply: true,
      allowSource: true,
      allowAllCandidates: true,
    });

    expect(snapshot.status).toBe('passed');
    expect(snapshot.onboarding.qa.expansion.summary.materialized).toBe(2);
    expect(snapshot.rollout.recommendedMode).toBe('canary-apply');
    expect(snapshot.policy.canaryBeforeBulkApply).toBe(true);
  });

  it('persists scale report when enabled', async () => {
    writeSkills(source, 1);
    const scaleReportPath = path.join(root, '.zavorth', 'reports', 'scale.json');

    const snapshot = await new UniversalSkillScaleHardeningService({
      projectRoot: root,
    }).buildSnapshot({
      projectRoot: root,
      sources: [{ sourcePath: source }],
      discover: false,
      scaleReportPath,
    });

    expect(snapshot.report.persisted).toBe(true);
    expect(snapshot.report.path).toBe(scaleReportPath);
    expect(fs.existsSync(scaleReportPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(scaleReportPath, 'utf8'))).toEqual(expect.objectContaining({
      contractVersion: '2026-05-10.checkpoint-9',
      report: expect.objectContaining({ rawSecretsSerialized: false }),
    }));
  });
});
