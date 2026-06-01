import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

const requiredFiles = [
  'src/contracts/ZavorthProductHardeningContract.ts',
  'src/services/ZavorthProductHardeningService.ts',
  'scripts/zavorth-product-hardening.ts',
  'scripts/zavorth-product-hardening-check.mjs',
  'tests/services/ZavorthProductHardeningService.test.ts',
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
}

const packageJson = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
for (const marker of [
  'zavorth:product-hardening',
  'zavorth:product-hardening:json',
  'zavorth:product-hardening:check',
  'qa:zavorth-product-hardening',
]) {
  if (!packageJson.includes(marker)) failures.push(`package script ${marker} missing`);
}

const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const args = process.platform === 'win32'
  ? ['/d', '/s', '/c', 'npx tsx scripts/zavorth-product-hardening.ts --json']
  : ['tsx', 'scripts/zavorth-product-hardening.ts', '--json'];
const result = spawnSync(command, args, {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 1024 * 1024 * 30,
});

if (result.status !== 0) {
  failures.push(`product hardening script failed: ${result.stderr || result.stdout}`);
} else {
  try {
    const snapshot = JSON.parse(result.stdout);
    if (snapshot.contractVersion !== 'zavorth-product-hardening/1') failures.push('unexpected contract version');
    if (snapshot.status !== 'ready') failures.push(`snapshot status is ${snapshot.status}`);
    if (!Array.isArray(snapshot.areas) || snapshot.areas.length !== 6) failures.push('expected 6 hardening areas');
    if (snapshot.surfacePolicy?.legacyRoutesRetired !== true) failures.push('legacy routes are not retired');
    if (snapshot.installPolicy?.homeIsExplicit !== true) failures.push('home install policy missing');
    if (snapshot.safety?.secretValuesSerialized !== false) failures.push('secret serialization invariant missing');
    if (!snapshot.commands?.qa?.includes('qa:zavorth-product-hardening')) failures.push('QA command missing from snapshot');
    if (JSON.stringify(snapshot).match(/sk-[A-Za-z0-9_-]{12,}|hf_[A-Za-z0-9]{12,}|AIza[0-9A-Za-z_-]{16,}|xox[baprs]-[A-Za-z0-9-]{12,}/)) {
      failures.push('snapshot leaked a secret-looking token');
    }
  } catch (error) {
    failures.push(`failed to parse product hardening JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length > 0) {
  console.error('[zavorth-product-hardening-check] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[zavorth-product-hardening-check] ok');
