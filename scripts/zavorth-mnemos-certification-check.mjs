import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';

const requiredFiles = [
  'scripts/zavorth-mnemos-certification.ts',
  'scripts/zavorth-mnemos-certification-check.mjs',
  'docs/mnemos-memory-os.md',
];

const failures = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) failures.push(`missing ${file}`);
}

const script = fs.existsSync(requiredFiles[0]) ? fs.readFileSync(requiredFiles[0], 'utf8') : '';
const packageJson = fs.existsSync('package.json') ? fs.readFileSync('package.json', 'utf8') : '';
const docs = fs.existsSync(requiredFiles[2]) ? fs.readFileSync(requiredFiles[2], 'utf8') : '';

for (const marker of [
  'zavorth-mnemos-certification-v1',
  'certificationRunsLocalChecksOnly',
  'identityHygieneChecked',
  'secretsScanIncluded',
  'providerCall: false',
  'networkCall: false',
  'durableMutation: false',
]) {
  if (!script.includes(marker)) failures.push(`certification marker missing: ${marker}`);
}

for (const marker of ['mnemos:certify', 'mnemos:certify:json', 'mnemos:certify:check']) {
  if (!packageJson.includes(marker)) failures.push(`package script missing: ${marker}`);
}
for (const marker of ['mnemos:fts', 'mnemos:lifecycle', 'mnemos:lifecycle:check']) {
  if (!packageJson.includes(marker)) failures.push(`package script missing: ${marker}`);
}

for (const marker of ['Certification matrix Certification', 'npm run mnemos:certify', 'local checks only']) {
  if (!docs.includes(marker)) failures.push(`docs marker missing: ${marker}`);
}

if (!failures.length) {
  const output = execFileSync(process.platform === 'win32' ? 'cmd.exe' : 'npx', process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npx tsx scripts/zavorth-mnemos-certification.ts --json']
    : ['tsx', 'scripts/zavorth-mnemos-certification.ts', '--json'], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 32 });
  const snapshot = JSON.parse(output);
  if (snapshot.version !== 'zavorth-mnemos-certification-v1') failures.push('unexpected certification version');
  if (snapshot.status !== 'passed') failures.push(`certification did not pass: ${snapshot.status}`);
  if (snapshot.safety.providerCall !== false || snapshot.safety.networkCall !== false) failures.push('certification safety flags are wrong');
}

if (!failures.length) {
  const runtime = spawnSync(process.platform === 'win32' ? 'cmd.exe' : 'npm', process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm run runtime:check --silent']
    : ['run', 'runtime:check', '--silent'], { stdio: 'inherit' });
  if (runtime.status !== 0) failures.push(`runtime:check failed with exit ${runtime.status}`);
}

if (failures.length) {
  console.error('[zavorth-mnemos-certification-check] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[zavorth-mnemos-certification-check] ok');
