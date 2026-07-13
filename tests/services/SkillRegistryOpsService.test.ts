import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  SkillRegistryOpsService,
  ZAVORTH_SKILL_REGISTRY_INDEX_SCHEMA,
  ZAVORTH_SKILL_PUBLISH_PLAN_SCHEMA,
} from '../../src/services/SkillRegistryOpsService.js';
import {
  signSkillPackage,
  verifySkillPackageSignature,
} from '../../src/skills/marketplace/SkillMarketplaceSecurity.js';

const SIGNING_KEY = 'zavorth-test-signing-key-32chars!!';

function writeSkillFixture(skillsDir: string, skillName: string): string {
  const skillDir = path.join(skillsDir, skillName);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---\nname: ${skillName}\ndescription: registry ops fixture\nversion: 1.0.0\n---\n# ${skillName}\n`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(skillDir, 'manifest.json'),
    JSON.stringify(
      {
        name: skillName,
        version: '1.0.0',
        description: 'registry ops fixture',
        author: 'zavorth-test',
        category: 'other',
        tags: ['test', 'ops'],
      },
      null,
      2,
    ),
    'utf8',
  );
  return skillDir;
}

describe('SkillRegistryOpsService', () => {
  let tempRoot: string;
  let skillsDir: string;
  let ops: SkillRegistryOpsService;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-ops-'));
    skillsDir = path.join(tempRoot, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    ops = new SkillRegistryOpsService({
      projectRoot: tempRoot,
      skillsDir,
      now: () => new Date('2026-07-13T20:00:00.000Z'),
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('signs and verifies a skill package with hmac-sha256', () => {
    const skillDir = writeSkillFixture(skillsDir, 'demo-signed');
    const signed = ops.sign(skillDir, SIGNING_KEY);
    expect(signed.ok).toBe(true);
    expect(fs.existsSync(path.join(skillDir, 'SKILL.md.sig'))).toBe(true);
    expect(fs.existsSync(path.join(skillDir, 'AUTHOR_KEY.pub'))).toBe(true);

    const direct = verifySkillPackageSignature(skillDir);
    expect(direct.ok).toBe(true);
    expect(direct.mode).toBe('hmac-sha256');

    const report = ops.verify(skillDir);
    expect(report.packageValid).toBe(true);
    expect(report.signature.ok).toBe(true);
    expect(report.ok).toBe(true);
  });

  it('rejects short signing keys', () => {
    const skillDir = writeSkillFixture(skillsDir, 'short-key');
    const signed = signSkillPackage(skillDir, 'too-short');
    expect(signed.ok).toBe(false);
  });

  it('exports registry index with signed entry and trusted domains', () => {
    const skillDir = writeSkillFixture(skillsDir, 'alpha-skill');
    writeSkillFixture(skillsDir, 'beta-skill');
    expect(ops.sign(skillDir, SIGNING_KEY).ok).toBe(true);

    const index = ops.exportIndex({
      env: {
        ...process.env,
        ZAVORTH_SKILL_TRUSTED_DOMAINS: 'skills.example.com',
      },
    });

    expect(index.schemaVersion).toBe(ZAVORTH_SKILL_REGISTRY_INDEX_SCHEMA);
    expect(index.generatedAt).toBe('2026-07-13T20:00:00.000Z');
    expect(index.skills).toHaveLength(2);
    expect(index.skills.map((s) => s.id)).toEqual(['alpha-skill', 'beta-skill']);
    expect(index.skills[0].signed).toBe(true);
    expect(index.skills[0].signatureMode).toBe('hmac-sha256');
    expect(index.skills[0].checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(index.skills[1].signed).toBe(false);
    expect(index.trustedGitDomains).toEqual(
      expect.arrayContaining(['github.com', 'skills.example.com']),
    );
  });

  it('writeIndex persists JSON and planPublish dry-run rejects untrusted repo', () => {
    const skillDir = writeSkillFixture(skillsDir, 'publish-me');
    expect(ops.sign(skillDir, SIGNING_KEY).ok).toBe(true);

    const out = path.join(tempRoot, 'artifacts', 'index.json');
    const written = ops.writeIndex(out);
    expect(written.ok).toBe(true);
    if (!written.ok) return;
    expect(written.count).toBe(1);
    const parsed = JSON.parse(fs.readFileSync(written.path, 'utf8'));
    expect(parsed.schemaVersion).toBe(ZAVORTH_SKILL_REGISTRY_INDEX_SCHEMA);
    expect(parsed.skills[0].id).toBe('publish-me');

    const allowed = ops.planPublish({
      skillDir,
      repoUrl: 'https://github.com/zavorth/skills-demo',
    });
    expect(allowed.schemaVersion).toBe(ZAVORTH_SKILL_PUBLISH_PLAN_SCHEMA);
    expect(allowed.dryRun).toBe(true);
    expect(allowed.wouldPush).toBe(true);
    expect(allowed.ok).toBe(true);
    expect(allowed.repoAllowed).toBe(true);
    expect(allowed.signed).toBe(true);
    expect(allowed.skillId).toBe('publish-me');
    expect(allowed.nextSteps.some((s) => /publish/i.test(s))).toBe(true);

    const denied = ops.planPublish({
      skillDir,
      repoUrl: 'https://evil.example/skills.git',
    });
    expect(denied.ok).toBe(false);
    expect(denied.wouldPush).toBe(false);
    expect(denied.repoAllowed).toBe(false);
    expect(denied.messages.join(' ')).toMatch(/not in the trusted/i);
    expect(denied.nextSteps.join(' ')).toMatch(/ZAVORTH_SKILL_TRUSTED_DOMAINS|allowlisted/i);
  });

  it('writePublishPlan writes artifact JSON without network', () => {
    const skillDir = writeSkillFixture(skillsDir, 'plan-only');
    expect(ops.sign(skillDir, SIGNING_KEY).ok).toBe(true);
    const out = path.join(tempRoot, 'artifacts', 'publish-plan.json');
    const written = ops.writePublishPlan(out, {
      skillDir,
      repoUrl: 'https://github.com/zavorth/skills-demo',
    });
    expect(written.ok).toBe(true);
    if (!written.ok) return;
    expect(fs.existsSync(written.path)).toBe(true);
    const plan = JSON.parse(fs.readFileSync(written.path, 'utf8'));
    expect(plan.schemaVersion).toBe(ZAVORTH_SKILL_PUBLISH_PLAN_SCHEMA);
    expect(plan.dryRun).toBe(true);
    expect(plan.wouldPush).toBe(true);
    expect(plan.skillId).toBe('plan-only');
  });

  it('listTrustedDomains merges env extras', () => {
    const domains = ops.listTrustedDomains({
      ZAVORTH_SKILL_TRUSTED_DOMAINS: 'cdn.zavorth.dev, registry.internal',
    } as NodeJS.ProcessEnv);
    expect(domains).toEqual(
      expect.arrayContaining(['github.com', 'cdn.zavorth.dev', 'registry.internal']),
    );
  });

  it('assertRegistryUrl rejects untrusted base URL', () => {
    const bad = ops.assertRegistryUrl('https://not-allowed.example/index.json');
    expect(bad.ok).toBe(false);
    const good = ops.assertRegistryUrl('https://github.com/org/skills');
    expect(good.ok).toBe(true);
  });
});
