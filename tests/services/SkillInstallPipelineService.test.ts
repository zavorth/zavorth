import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION,
} from '../../src/contracts/skill/ZavorthSkillWorkerMeshContract.js';
import { SkillInstallPipelineService } from '../../src/services/SkillInstallPipelineService.js';

function writeSkillFixture(root: string, skillName = 'demo-skill'): string {
  const skillDir = path.join(root, skillName);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    '# Demo skill\n\nUse read_file when needed.\n',
    'utf8',
  );
  fs.writeFileSync(
    path.join(skillDir, 'manifest.json'),
    JSON.stringify(
      {
        name: skillName,
        version: '1.0.0',
        description: 'Fixture skill for W1 pipeline tests',
        author: 'zavorth-test',
        category: 'other',
        tags: ['test'],
        tools: [
          {
            name: 'read_file',
            description: 'Read a file',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );
  return skillDir;
}

describe('W1 SkillInstallPipelineService', () => {
  let tempRoot: string;
  let projectRoot: string;
  let service: SkillInstallPipelineService;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-pipe-'));
    projectRoot = path.join(tempRoot, 'project');
    fs.mkdirSync(path.join(projectRoot, 'skills'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, 'data', 'runtime'), { recursive: true });
    service = new SkillInstallPipelineService({
      projectRoot,
      skillsDir: path.join(projectRoot, 'skills'),
      receiptsDir: path.join(projectRoot, 'data', 'runtime', 'skill-install-receipts'),
      now: () => new Date('2026-07-13T18:00:00.000Z'),
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('previews a local skill fixture without network', () => {
    const skillDir = writeSkillFixture(tempRoot);
    const plan = service.preview({ source: skillDir });

    expect(plan.contractVersion).toBe(ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION);
    expect(plan.kind).toBe('skill-install-plan');
    expect(plan.previewOnly).toBe(true);
    expect(plan.applyBlockedWithoutConsent).toBe(true);
    expect(plan.source.detectedType).toMatch(/local/);
    expect(plan.skillId).toBe('demo-skill');
    expect(plan.files).toEqual(expect.arrayContaining(['SKILL.md', 'manifest.json']));
    expect(plan.declaredTools.map((t) => t.name)).toContain('read_file');
    expect(plan.trust.score).toBeGreaterThan(0);
    expect(plan.trust.band).not.toBe('deny');
  });

  it('blocks first-seen remote apply without consent (daily profile)', async () => {
    const remoteService = new SkillInstallPipelineService({
      projectRoot,
      skillsDir: path.join(projectRoot, 'skills'),
      receiptsDir: path.join(projectRoot, 'data', 'runtime', 'skill-install-receipts'),
      trustProfile: 'daily',
      now: () => new Date('2026-07-13T18:00:00.000Z'),
    });
    const receipt = await remoteService.apply({
      source: 'https://github.com/unknown-org/not-yet-trusted',
      consent: false,
    });

    expect(receipt.status).toBe('blocked');
    expect(receipt.materialized).toBe(false);
    expect(receipt.approvalGranted).toBe(false);
    expect(receipt.reason).toMatch(/consent|policy|blocked/i);
    expect(receipt.secretLikePresent).toBe(false);

    const stored = remoteService.getReceipt(receipt.id);
    expect(stored?.id).toBe(receipt.id);
    expect(JSON.stringify(stored)).not.toMatch(/api_key\s*=\s*\w{8,}/i);
  });

  it('may auto-consent clean local packages under daily trust policy (W2)', async () => {
    const skillDir = writeSkillFixture(tempRoot, 'local-auto');
    const prev = process.cwd();
    process.chdir(projectRoot);
    try {
      const localService = new SkillInstallPipelineService({
        projectRoot,
        trustProfile: 'daily',
        receiptsDir: path.join(projectRoot, 'data', 'runtime', 'skill-install-receipts'),
        now: () => new Date('2026-07-13T18:00:00.000Z'),
      });
      const receipt = await localService.apply({ source: skillDir, consent: false });
      // Either auto-applied (strong local evidence) or still blocked if score floor not met — never silent fail.
      expect(['applied', 'partial', 'blocked']).toContain(receipt.status);
      if (receipt.status === 'applied' || receipt.status === 'partial') {
        expect(receipt.materialized).toBe(true);
      }
    } finally {
      process.chdir(prev);
    }
  });

  it('applies with consent and materializes under project skills/', async () => {
    const skillDir = writeSkillFixture(tempRoot, 'pipeline-demo');
    // SkillGitRegistry installs into process.cwd()/skills — chdir to projectRoot for hermetic apply.
    const prev = process.cwd();
    process.chdir(projectRoot);
    try {
      const serviceCwd = new SkillInstallPipelineService({
        projectRoot,
        receiptsDir: path.join(projectRoot, 'data', 'runtime', 'skill-install-receipts'),
        now: () => new Date('2026-07-13T18:00:00.000Z'),
      });
      const receipt = await serviceCwd.apply({
        source: skillDir,
        consent: true,
      });

      expect(['applied', 'partial']).toContain(receipt.status);
      expect(receipt.materialized).toBe(true);
      expect(receipt.approvalGranted).toBe(true);
      expect(receipt.smoke.ran).toBe(true);
      expect(receipt.skillId).toBeTruthy();
      const target = receipt.targetDir || path.join(projectRoot, 'skills', String(receipt.skillId));
      expect(fs.existsSync(path.join(target, 'SKILL.md'))).toBe(true);
      expect(receipt.toolBinds.some((b) => b.declaredName === 'read_file')).toBe(true);
      // W3: read_file must bind direct, not stay unresolved
      const readBind = receipt.toolBinds.find((b) => b.declaredName === 'read_file');
      expect(readBind?.status).toBe('direct');
      expect(readBind?.resolvedName).toBe('read_file');
      expect(JSON.stringify(receipt)).not.toContain('should-never-leak-secret-value');
    } finally {
      process.chdir(prev);
    }
  });

  it('W3 aliases sandbox_execution on install receipt', async () => {
    const skillDir = path.join(tempRoot, 'alias-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Alias skill\n', 'utf8');
    fs.writeFileSync(
      path.join(skillDir, 'manifest.json'),
      JSON.stringify({
        name: 'alias-skill',
        version: '1.0.0',
        description: 'tests alias bind',
        author: 'zavorth-test',
        tools: [{ name: 'sandbox_execution', description: 'run code' }],
      }),
      'utf8',
    );
    const prev = process.cwd();
    process.chdir(projectRoot);
    try {
      const svc = new SkillInstallPipelineService({
        projectRoot,
        receiptsDir: path.join(projectRoot, 'data', 'runtime', 'skill-install-receipts'),
        now: () => new Date('2026-07-13T18:00:00.000Z'),
      });
      const receipt = await svc.apply({ source: skillDir, consent: true });
      const bind = receipt.toolBinds.find((b) => b.declaredName === 'sandbox_execution');
      expect(bind?.status).toBe('aliased');
      expect(bind?.resolvedName).toBe('run_sandbox_code');
    } finally {
      process.chdir(prev);
    }
  });

  it('formatPlanText is readable and brand-agnostic', () => {
    const skillDir = writeSkillFixture(tempRoot);
    const text = service.formatPlanText(service.preview({ source: skillDir }));
    expect(text).toMatch(/preview only/i);
    expect(text).toMatch(/read_file/);
    expect(text).not.toMatch(/openclaw|claude code|cursor/i);
  });
});
