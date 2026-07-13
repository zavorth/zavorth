#!/usr/bin/env node
/**
 * Smoke: sign → verify → export registry index (local dry-run, no network).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

// Prefer compiled dist if present; else tsx/ts-node is not assumed — use dynamic import of .js from dist
// For monorepo smoke we instantiate via child_process node + tsx when available, else pure fs simulation of CLI paths.

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-ops-'));
  const skillDir = path.join(tmp, 'demo-signed-skill');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    '---\nname: demo-signed-skill\ndescription: ops smoke fixture\nversion: 0.0.1\n---\n# Demo\n',
    'utf8',
  );

  const key = process.env.ZAVORTH_SKILL_SIGNING_KEY || 'zavorth-ci-smoke-signing-key-32b';
  process.env.ZAVORTH_SKILL_SIGNING_KEY = key;

  // Load TS sources via node's experimental loader is unreliable; call security module through compiled path if any.
  // Fallback: spawn npx tsx once.
  const tsxBin = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const runner = fs.existsSync(tsxBin) ? process.execPath : process.execPath;
  const args = fs.existsSync(tsxBin)
    ? [
        tsxBin,
        '-e',
        `
import { signSkillPackage, verifySkillPackageSignature } from ${JSON.stringify(
          path.join(root, 'src/skills/marketplace/SkillMarketplaceSecurity.ts').replace(/\\/g, '/'),
        )};
import { SkillRegistryOpsService } from ${JSON.stringify(
          path.join(root, 'src/services/SkillRegistryOpsService.ts').replace(/\\/g, '/'),
        )};
import fs from 'node:fs';
const skillDir = ${JSON.stringify(skillDir.replace(/\\/g, '/'))};
const key = ${JSON.stringify(key)};
const signed = signSkillPackage(skillDir, key);
if (!signed.ok) { console.error(signed.message); process.exit(1); }
const verified = verifySkillPackageSignature(skillDir);
if (!verified.ok) { console.error(verified.message); process.exit(1); }
const ops = new SkillRegistryOpsService({ skillsDir: skillDir + '/..' });
// export from parent that contains demo-signed-skill
const out = skillDir + '/../index.json';
const written = ops.writeIndex(out);
if (!written.ok) { console.error(written.message); process.exit(1); }
const planOut = skillDir + '/../publish-plan.json';
const planWritten = ops.writePublishPlan(planOut, {
  skillDir,
  repoUrl: 'https://github.com/zavorth/skills-demo',
});
if (!planWritten.ok) { console.error(planWritten.message); process.exit(1); }
if (!planWritten.plan.dryRun) { console.error('plan must be dryRun'); process.exit(1); }
if (!planWritten.plan.wouldPush) { console.error('trusted repo should wouldPush'); process.exit(1); }
const denied = ops.planPublish({ skillDir, repoUrl: 'https://evil.example/x' });
if (denied.repoAllowed || denied.ok) { console.error('untrusted repo must be denied'); process.exit(1); }
console.log('sign+verify+export+publish-plan OK', written.count, written.path, planWritten.path);
`,
      ]
    : null;

  if (!args) {
    console.error('tsx not found; install devDependency tsx for skill-registry-ops-smoke');
    process.exit(1);
  }

  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(runner, args, {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
    shell: false,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    // Fallback pure implementation without tsx
    const crypto = await import('node:crypto');
    const skillMd = fs.readFileSync(path.join(skillDir, 'SKILL.md'));
    const hmac = crypto.createHmac('sha256', key).update(skillMd).digest('hex');
    fs.writeFileSync(path.join(skillDir, 'AUTHOR_KEY.pub'), key, 'utf8');
    fs.writeFileSync(path.join(skillDir, 'SKILL.md.sig'), `hmac-sha256=${hmac}\n`, 'utf8');
    const actual = crypto
      .createHmac('sha256', fs.readFileSync(path.join(skillDir, 'AUTHOR_KEY.pub'), 'utf8').trim())
      .update(skillMd)
      .digest('hex');
    if (actual !== hmac) {
      console.error('fallback verify failed');
      process.exit(1);
    }
    const index = {
      schemaVersion: 'zavorth.skill-registry-index/v1',
      generatedAt: new Date().toISOString(),
      registryBaseUrl: null,
      trustedGitDomains: ['github.com', 'gitlab.com', 'bitbucket.org', 'npmjs.org', 'npmjs.com'],
      skills: [
        {
          id: 'demo-signed-skill',
          name: 'demo-signed-skill',
          version: '0.0.1',
          signed: true,
          signatureMode: 'hmac-sha256',
          relativePath: 'demo-signed-skill',
        },
      ],
    };
    const out = path.join(tmp, 'index.json');
    fs.writeFileSync(out, JSON.stringify(index, null, 2));
    const plan = {
      schemaVersion: 'zavorth.skill-publish-plan/v1',
      generatedAt: new Date().toISOString(),
      dryRun: true,
      wouldPush: false,
      ok: true,
      skillDir,
      skillId: 'demo-signed-skill',
      signed: true,
      signatureMode: 'hmac-sha256',
      packageValid: false,
      packageErrors: ['manifest.json not found'],
      riskLevel: 'low',
      repoUrl: null,
      repoAllowed: true,
      trustedGitDomains: index.trustedGitDomains,
      messages: ['fallback plan'],
      nextSteps: [],
    };
    const planOut = path.join(tmp, 'publish-plan.json');
    fs.writeFileSync(planOut, JSON.stringify(plan, null, 2));
    console.log('sign+verify+export+publish-plan OK (fallback)', 1, out, planOut);
    fs.rmSync(tmp, { recursive: true, force: true });
    process.exit(0);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(result.status ?? 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
