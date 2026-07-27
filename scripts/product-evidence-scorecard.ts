import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import type { ProductEvidenceClaimManifest, ProductEvidenceExecution } from '../src/contracts/ProductEvidenceScorecardContract.js';
import { ProductEvidenceScorecardService } from '../src/services/ProductEvidenceScorecardService.js';

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'config', 'product-evidence-claims.json'), 'utf8')) as { claims: ProductEvidenceClaimManifest[] };
const claimId = process.argv.find((arg) => arg.startsWith('--claim='))?.slice('--claim='.length);
const claims = claimId ? manifest.claims.filter((claim) => claim.id === claimId) : manifest.claims;
if (claimId && claims.length === 0) throw new Error(`Unknown evidence claim: ${claimId}`);
const executionByScript = new Map<string, ProductEvidenceExecution>();
for (const claim of claims) {
  if (executionByScript.has(claim.evidence.script)) continue;
  if (!/^(qa|security):[a-z0-9:-]+$/.test(claim.evidence.script)) throw new Error(`Unsafe evidence script: ${claim.evidence.script}`);
  const npmExecPath = process.env.npm_execpath;
  const command = npmExecPath ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
  const args = npmExecPath ? [npmExecPath, 'run', claim.evidence.script, '--silent'] : ['run', claim.evidence.script, '--silent'];
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 900_000,
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const sharedArtifacts = claims.filter((item) => item.evidence.script === claim.evidence.script).flatMap((item) => item.evidence.artifacts);
  executionByScript.set(claim.evidence.script, { script: claim.evidence.script, exitCode: result.status, completedAt: new Date().toISOString(), outputDigest: crypto.createHash('sha256').update(output).digest('hex'), artifactsPresent: [...new Set(sharedArtifacts)].filter((artifact) => fs.existsSync(path.join(root, artifact))) });
}
const executions = [...executionByScript.values()];
const locale = process.argv.find((arg) => arg.startsWith('--locale='))?.split('=')[1] || process.env.LANG;
const scorecardNow = new Date();
const scorecard = new ProductEvidenceScorecardService(() => scorecardNow).build({ claims, executions, locale });
if (process.argv.includes('--json')) console.log(JSON.stringify(scorecard, null, 2));
else console.log(new ProductEvidenceScorecardService(() => scorecardNow).render(scorecard));
if (process.argv.includes('--strict') && scorecard.status !== 'verified') process.exitCode = 1;
