#!/usr/bin/env node
/**
 * local publish ritual for @zavorth/plugin-sdk.
 * Always runs build + check + dry-run. Real publish only when:
 *   ZAVORTH_NPM_PUBLISH=1 and npm whoami succeeds.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sdkDir = path.resolve(__dirname, '..', 'packages', 'plugin-sdk');
const wantPublish = process.env.ZAVORTH_NPM_PUBLISH === '1';

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: sdkDir,
    encoding: 'utf8',
    shell: true,
    stdio: 'inherit',
    ...opts,
  });
  if (res.status !== 0) {
    process.exit(res.status || 1);
  }
  return res;
}

console.log('== plugin-sdk publish ritual ==');
console.log('dir:', sdkDir);

const pkg = JSON.parse(fs.readFileSync(path.join(sdkDir, 'package.json'), 'utf8'));
console.log(`package: ${pkg.name}@${pkg.version}`);

run('npm', ['run', 'publish:check']);

const whoami = spawnSync('npm', ['whoami'], { encoding: 'utf8', shell: true });
const identity = String(whoami.stdout || '').trim();
if (whoami.status !== 0 || !identity) {
  console.warn('\n[blocked] npm whoami failed (token missing/expired/unauthorized).');
  console.warn('Dry-run already passed via publish:check.');
  console.warn('To publish later:');
  console.warn('  1) npm login  (or set a valid //registry.npmjs.org/:_authToken in ~/.npmrc)');
  console.warn('  2) ensure access to scope @zavorth');
  console.warn('  3) ZAVORTH_NPM_PUBLISH=1 node scripts/publish-plugin-sdk-local.mjs');
  console.warn('  Or: git tag plugin-sdk-v' + pkg.version + ' && git push origin plugin-sdk-v' + pkg.version);
  process.exit(0);
}

console.log('npm identity:', identity);

if (!wantPublish) {
  console.log('\n[ready] Auth OK. Set ZAVORTH_NPM_PUBLISH=1 to perform real publish.');
  process.exit(0);
}

console.log('\nPublishing for real...');
run('npm', ['publish', '--access', 'public']);
console.log('Published', `${pkg.name}@${pkg.version}`);
