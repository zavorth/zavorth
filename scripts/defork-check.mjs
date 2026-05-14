import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();

const checks = [
  ['Wave 0 freeze/boundary guard', 'scripts/defork-wave0-check.mjs'],
  ['Wave 1 identity guard', 'scripts/defork-wave1-identity-check.mjs'],
  ['Wave 2 CLI tool card guard', 'scripts/defork-wave2-cli-tools-check.mjs'],
  ['Wave 3 auth/storage guard', 'scripts/defork-wave3-auth-storage-check.mjs'],
  ['Wave 4 proxy/SSE guard', 'scripts/defork-wave4-transport-check.mjs'],
  ['Wave 4.5 post-de-fork validation guard', 'scripts/defork-post-defork-check.mjs'],
];

for (const [label, script] of checks) {
  console.log(`[defork] running ${label}`);
  const result = spawnSync(process.execPath, [path.join(root, script)], {
    cwd: root,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('[defork] ok: all active de-fork guards passed.');
