import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runner = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const prefix = process.platform === 'win32' ? ['/d', '/s', '/c', 'npx'] : [];

for (const file of [
  'src/contracts/ZavorthGuidedMissionsContract.ts',
  'src/services/ZavorthGuidedMissionsService.ts',
  'scripts/zavorth-guided-missions.ts',
  'tests/services/ZavorthGuidedMissionsService.test.ts',
]) {
  if (!existsSync(path.join(root, file))) {
    throw new Error(`missing ${file}`);
  }
}

const output = execFileSync(
  runner,
  [
    ...prefix,
    'tsx',
    'scripts/zavorth-guided-missions.ts',
    '--profile',
    'developer',
    '--intent',
    'review this repo and find risky code',
    '--json',
  ],
  { cwd: root, encoding: 'utf8' },
);
const snapshot = JSON.parse(output);

if (snapshot.surface !== 'guided-missions') {
  throw new Error(`unexpected surface ${snapshot.surface}`);
}
if (snapshot.selectedProfile !== 'developer') {
  throw new Error(`expected developer profile, got ${snapshot.selectedProfile}`);
}
if (snapshot.recommended.id !== 'review-this-repository') {
  throw new Error(`expected review-this-repository, got ${snapshot.recommended.id}`);
}
if (snapshot.catalog.length < 10) {
  throw new Error(`expected a rich guided mission catalog, got ${snapshot.catalog.length}`);
}
if (snapshot.startProjection.previewOnlyByDefault !== true) {
  throw new Error('guided missions must start as preview-only');
}
if (snapshot.safety.guidedDoesNotBypassPolicy !== true || snapshot.safety.receiptsRequired !== true) {
  throw new Error('guided mission safety invariant missing');
}

execFileSync(
  runner,
  [...prefix, 'jest', '--runTestsByPath', 'tests/services/ZavorthGuidedMissionsService.test.ts', '--runInBand'],
  { cwd: root, stdio: 'inherit' },
);

console.log('[zavorth-guided-missions-check] ok');
