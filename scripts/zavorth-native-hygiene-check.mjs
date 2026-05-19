import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();

const checks = [
  ['Native boundary guard', 'scripts/zavorth-native-boundary-check.mjs'],
  ['Identity surface guard', 'scripts/zavorth-identity-surface-check.mjs'],
  ['CLI surface guard', 'scripts/zavorth-cli-surface-check.mjs'],
  ['Auth/storage guard', 'scripts/zavorth-auth-storage-check.mjs'],
  ['Transport boundary guard', 'scripts/zavorth-transport-boundary-check.mjs'],
  ['Native residue validation guard', 'scripts/zavorth-native-residue-check.mjs'],
];

for (const [label, script] of checks) {
  console.log(`[native-hygiene] running ${label}`);
  const result = spawnSync(process.execPath, [path.join(root, script)], {
    cwd: root,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('[native-hygiene] ok: all active native hygiene guards passed.');
