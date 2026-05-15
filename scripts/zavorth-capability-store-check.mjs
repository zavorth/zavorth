import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runner = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const prefix = process.platform === 'win32' ? ['/d', '/s', '/c', 'npx'] : [];

for (const file of [
  'src/contracts/ZavorthCapabilityStoreContract.ts',
  'src/services/ZavorthCapabilityStoreService.ts',
  'scripts/zavorth-capability-store.ts',
  'tests/services/ZavorthCapabilityStoreService.test.ts',
]) {
  if (!existsSync(path.join(root, file))) {
    throw new Error(`missing ${file}`);
  }
}

const output = execFileSync(
  runner,
  [...prefix, 'tsx', 'scripts/zavorth-capability-store.ts', '--category=communication', '--json'],
  { cwd: root, encoding: 'utf8' },
);
const snapshot = JSON.parse(output);

if (snapshot.surface !== 'capability-store') {
  throw new Error(`unexpected surface ${snapshot.surface}`);
}
if (snapshot.selectedCategory !== 'communication') {
  throw new Error(`expected communication category, got ${snapshot.selectedCategory}`);
}
if (snapshot.source.executionAuthority !== false) {
  throw new Error('capability store must not be an execution authority');
}
if (snapshot.safety.storeDoesNotInstallByItself !== true || snapshot.safety.rawSecretsSerialized !== false) {
  throw new Error('capability store safety invariant missing');
}
if (!snapshot.categories.some((category) => category.id === 'communication')) {
  throw new Error('communication category missing');
}

execFileSync(
  runner,
  [...prefix, 'jest', '--runTestsByPath', 'tests/services/ZavorthCapabilityStoreService.test.ts', '--runInBand'],
  { cwd: root, stdio: 'inherit' },
);

console.log('[zavorth-capability-store-check] ok');
