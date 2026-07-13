import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SkillRegistryOpsHttpApiService } from '../../src/services/SkillRegistryOpsHttpApiService.js';
import { signSkillPackage } from '../../src/skills/marketplace/SkillMarketplaceSecurity.js';

const SIGNING_KEY = 'zavorth-test-signing-key-32chars!!';

function writeSkill(skillsDir: string, name: string): string {
  const skillDir = path.join(skillsDir, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: http api fixture\nversion: 1.0.0\n---\n# ${name}\n`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(skillDir, 'manifest.json'),
    JSON.stringify(
      {
        name,
        version: '1.0.0',
        description: 'http api fixture',
        author: 'zavorth-test',
        category: 'other',
        tags: ['test'],
      },
      null,
      2,
    ),
    'utf8',
  );
  return skillDir;
}

describe('SkillRegistryOpsHttpApiService', () => {
  let tempRoot: string;
  let api: SkillRegistryOpsHttpApiService;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-http-'));
    fs.mkdirSync(path.join(tempRoot, 'skills'), { recursive: true });
    api = new SkillRegistryOpsHttpApiService({ projectRoot: tempRoot });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('builds snapshot with unsigned and signed skills', () => {
    const a = writeSkill(path.join(tempRoot, 'skills'), 'alpha');
    writeSkill(path.join(tempRoot, 'skills'), 'beta');
    expect(signSkillPackage(a, SIGNING_KEY).ok).toBe(true);

    const snap = api.buildSnapshot(tempRoot);
    expect(snap.contractVersion).toBe('zavorth.skill-registry-http/v1');
    expect(snap.stats.total).toBe(2);
    expect(snap.stats.signed).toBe(1);
    expect(snap.skills.map((s) => s.id)).toEqual(['alpha', 'beta']);
    expect(snap.skills[0].signed).toBe(true);
    expect(snap.skills[1].signed).toBe(false);
    expect(snap.trustedGitDomains).toEqual(expect.arrayContaining(['github.com']));
  });

  it('verify and publish_plan actions', () => {
    const skillDir = writeSkill(path.join(tempRoot, 'skills'), 'plan-me');
    expect(signSkillPackage(skillDir, SIGNING_KEY).ok).toBe(true);

    const verified = api.runAction({ action: 'verify', skillId: 'plan-me' }, tempRoot);
    expect(verified.ok).toBe(true);
    expect(verified.result.verify?.ok).toBe(true);

    const plan = api.runAction(
      {
        action: 'publish_plan',
        skillId: 'plan-me',
        repoUrl: 'https://github.com/zavorth/skills-demo',
      },
      tempRoot,
    );
    expect(plan.result.plan?.dryRun).toBe(true);
    expect(plan.result.plan?.wouldPush).toBe(true);
    expect(plan.result.planPath).toBeTruthy();
    expect(fs.existsSync(String(plan.result.planPath))).toBe(true);
  });

  it('sign requires operator confirm', () => {
    writeSkill(path.join(tempRoot, 'skills'), 'need-sign');
    const denied = api.runAction(
      { action: 'sign', skillId: 'need-sign', signingKey: SIGNING_KEY },
      tempRoot,
      {},
    );
    expect(denied.ok).toBe(false);
    expect(denied.result.error).toMatch(/operatorConfirm/i);

    const allowed = api.runAction(
      {
        action: 'sign',
        skillId: 'need-sign',
        signingKey: SIGNING_KEY,
        operatorConfirm: true,
      },
      tempRoot,
      {},
    );
    expect(allowed.ok).toBe(true);
    expect(allowed.snapshot.stats.signed).toBe(1);
  });

  it('export writes index artifact', () => {
    writeSkill(path.join(tempRoot, 'skills'), 'exp');
    const out = path.join(tempRoot, 'out', 'index.json');
    const result = api.runAction({ action: 'export', outPath: out }, tempRoot);
    expect(result.ok).toBe(true);
    expect(result.result.count).toBe(1);
    expect(fs.existsSync(out)).toBe(true);
  });
});
