#!/usr/bin/env node
/**
 * Smoke: package exposes a single public CLI bin (`zavorth`).
 *
 *   node scripts/smoke-single-bin.mjs
 *   npm run code:single-bin:smoke
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`PASS: ${msg}`);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const bins = pkg.bin && typeof pkg.bin === 'object' ? Object.keys(pkg.bin) : [];
if (bins.length !== 1 || bins[0] !== 'zavorth') {
  fail(`expected only bin.zavorth, got: ${JSON.stringify(pkg.bin)}`);
}
if (pkg.bin.zavorth !== './bin/zavorth.js') {
  fail(`bin.zavorth must be ./bin/zavorth.js, got ${pkg.bin.zavorth}`);
}
pass('package.json bin = { zavorth only }');

if (fs.existsSync(path.join(root, 'bin', 'zavorth-code.js'))) {
  fail('bin/zavorth-code.js must not exist as public product');
}
pass('no bin/zavorth-code.js');

const cliPkgPath = path.join(root, 'packages', 'code', 'cli', 'package.json');
if (fs.existsSync(cliPkgPath)) {
  const cliPkg = JSON.parse(fs.readFileSync(cliPkgPath, 'utf8'));
  if (cliPkg.bin && Object.keys(cliPkg.bin).length > 0) {
    fail(`@zavorth/cli must not expose public bins, got ${JSON.stringify(cliPkg.bin)}`);
  }
  pass('@zavorth/cli has no separate public bin');
}

console.log('single-bin smoke ok');
