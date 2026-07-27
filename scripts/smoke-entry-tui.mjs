#!/usr/bin/env node
/**
 * Entry smoke: single `zavorth` → Code TUI; agent hatch (__agent / env only).
 *
 *   node scripts/smoke-entry-tui.mjs
 *   npm run code:entry:smoke
 *
 * Prefer pure routing + ZAVORTH_CODE_BIN local (no Bun cold start).
 * Optional real monorepo --version is soft (120s timeout).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIMEOUT_MS = 120_000;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`PASS: ${msg}`);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function writeTuiStub() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-entry-smoke-'));
  const localPath = path.join(dir, 'local-tui.js');
  fs.writeFileSync(
    localPath,
    [
      '#!/usr/bin/env node',
      "process.stdout.write(['TUI_OK', ...process.argv.slice(2)].join(' ') + '\\n');",
      'process.exit(0);',
      '',
    ].join('\n'),
    'utf8',
  );

  let command = localPath;
  if (process.platform === 'win32') {
    const cmdPath = path.join(dir, 'local-tui.cmd');
    fs.writeFileSync(
      cmdPath,
      `@echo off\r\n"${process.execPath}" "${localPath}" %*\r\n`,
      'utf8',
    );
    command = cmdPath;
  } else {
    const shPath = path.join(dir, 'local-tui.sh');
    fs.writeFileSync(
      shPath,
      `#!/usr/bin/env bash\nexec "${process.execPath}" "${localPath}" "$@"\n`,
      'utf8',
    );
    fs.chmodSync(shPath, 0o755);
    command = shPath;
  }

  return { dir, localPath, command };
}

function spawnCaptured(scriptRel, args, envExtra) {
  const scriptPath = path.join(root, scriptRel);
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: root,
    env: {
      ...process.env,
      ZAVORTH_TAGLINE: 'off',
      ...envExtra,
    },
    encoding: 'utf8',
    timeout: 30_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function spawnNodeSoft(scriptRel, args, label, envExtra) {
  const scriptPath = path.join(root, scriptRel);
  const env = { ...process.env, ZAVORTH_TAGLINE: 'off', ...(envExtra || {}) };
  delete env.ZAVORTH_CODE_BIN;
  delete env.ZAVORTH_LEGACY_CLI;

  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: root,
    env,
    timeout: TIMEOUT_MS,
    windowsHide: false,
    stdio: 'inherit',
  });

  if (result.error) {
    if (result.error.code === 'ETIMEDOUT' || result.killed) {
      console.log(`WARN: ${label} timed out after ${TIMEOUT_MS / 1000}s`);
      return { ok: false };
    }
    console.log(`WARN: ${label} spawn error: ${result.error.message}`);
    return { ok: false };
  }
  if (result.status !== 0) {
    console.log(`WARN: ${label} exited ${result.status}`);
    return { ok: false };
  }
  return { ok: true };
}

function unitResolveEntry() {
  const {
    resolveEntryMode,
    isTruthyEnv,
  } = require(path.join(root, 'bin', 'lib', 'resolve-zavorth-entry.cjs'));

  assert(typeof resolveEntryMode === 'function', 'resolveEntryMode export missing');
  assert(isTruthyEnv('1') && isTruthyEnv('true') && isTruthyEnv('yes'), 'isTruthyEnv true cases');
  assert(!isTruthyEnv('0') && !isTruthyEnv('') && !isTruthyEnv(undefined), 'isTruthyEnv false cases');

  const cases = [
    { argv: [], env: {}, mode: 'tui', args: [] },
    { argv: ['--version'], env: {}, mode: 'tui', args: ['--version'] },
    { argv: ['code', '--version'], env: {}, mode: 'tui', args: ['--version'] },
    { argv: ['CODE', 'run'], env: {}, mode: 'tui', args: ['run'] },
    // Public "legacy" token is NOT a hatch — stays on TUI path.
    { argv: ['legacy', '--version'], env: {}, mode: 'tui', args: ['legacy', '--version'] },
    { argv: ['__agent', 'doctor'], env: {}, mode: 'agent', args: ['doctor'] },
    {
      argv: ['--version'],
      env: { ZAVORTH_LEGACY_CLI: '1' },
      mode: 'agent',
      args: ['--version'],
    },
    {
      argv: ['--version'],
      env: { ZAVORTH_AGENT_RUNTIME: '1' },
      mode: 'agent',
      args: ['--version'],
    },
    {
      argv: ['code', 'x'],
      env: { ZAVORTH_LEGACY_CLI: 'true' },
      mode: 'agent',
      args: ['code', 'x'],
    },
    {
      argv: ['legacy', 'x'],
      env: { ZAVORTH_LEGACY_CLI: 'yes' },
      mode: 'agent',
      args: ['legacy', 'x'],
    },
  ];

  for (const c of cases) {
    const got = resolveEntryMode(c.argv, c.env);
    assert(
      got.mode === c.mode,
      `resolveEntryMode(${JSON.stringify(c.argv)}, env) mode=${got.mode} expected ${c.mode}`,
    );
    assert(
      Array.isArray(got.args) &&
        got.args.length === c.args.length &&
        got.args.every((a, i) => a === c.args[i]),
      `resolveEntryMode args mismatch: got ${JSON.stringify(got.args)} expected ${JSON.stringify(c.args)}`,
    );
  }

  pass('resolveEntryMode unit cases');
}

function main() {
  const binZavorth = path.join(root, 'bin', 'zavorth.js');
  const launchTui = path.join(root, 'bin', 'lib', 'launch-code-tui.cjs');
  const launchLegacy = path.join(root, 'bin', 'lib', 'launch-legacy-cli.cjs');
  const resolveEntry = path.join(root, 'bin', 'lib', 'resolve-zavorth-entry.cjs');
  const codeEntry = path.join(
    root,
    'packages',
    'code',
    'cli',
    'src',
    'index.ts',
  );
  const legacyDist = path.join(root, 'dist', 'zavorth-cli.js');

  assert(fs.existsSync(binZavorth), `missing ${binZavorth}`);
  assert(!fs.existsSync(path.join(root, 'bin', 'zavorth-code.js')), 'zavorth-code.js must not be a public bin');
  assert(fs.existsSync(launchTui), `missing ${launchTui}`);
  assert(fs.existsSync(launchLegacy), `missing ${launchLegacy}`);
  assert(fs.existsSync(resolveEntry), `missing ${resolveEntry}`);
  const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert(rootPkg.bin && rootPkg.bin.zavorth, 'package.json bin.zavorth required');
  assert(!rootPkg.bin['zavorth-code'], 'package.json must not expose bin.zavorth-code');
  pass('Entry bin + lib entry files exist (single public bin)');

  unitResolveEntry();

  // Env injection defaults (runtime bridge optional but may exist)
  const { buildHostedTuiEnv } = require(launchTui);
  const tuiEnv = buildHostedTuiEnv(root, {});
  assert(
    tuiEnv.ZAVORTH_RUNTIME_SOURCE === 'workspace' || tuiEnv.ZAVORTH_RUNTIME_SOURCE === 'monorepo',
    'ZAVORTH_RUNTIME_SOURCE',
  );
  assert(tuiEnv.ZAVORTH_WORKSPACE_ROOT === root, 'ZAVORTH_WORKSPACE_ROOT');
  assert(tuiEnv.ZAVORTH_CODE_FROM_WORKSPACE === '1', 'ZAVORTH_CODE_FROM_WORKSPACE');
  assert(
    typeof tuiEnv.ZAVORTH_GATEWAY_BASE_URL === 'string' &&
      tuiEnv.ZAVORTH_GATEWAY_BASE_URL.length > 0,
    'ZAVORTH_GATEWAY_BASE_URL',
  );
  assert(tuiEnv.ZAVORTH_POLICY_AUTHORITY === 'gateway', 'ZAVORTH_POLICY_AUTHORITY');
  const bridgeMjs = path.join(
    root,
    'scripts',
    'lib',
    'zavorth-runtime-bridge.mjs',
  );
  assert(
    typeof tuiEnv.ZAVORTH_RUNTIME_BRIDGE_FILE === 'string' &&
      tuiEnv.ZAVORTH_RUNTIME_BRIDGE_FILE.endsWith('runtime-bridge.json'),
    `ZAVORTH_RUNTIME_BRIDGE_FILE should point at runtime-bridge.json, got: ${tuiEnv.ZAVORTH_RUNTIME_BRIDGE_FILE}`,
  );
  if (fs.existsSync(bridgeMjs)) {
    pass('buildHostedTuiEnv integrates monorepo runtime bridge');
  } else {
    pass('buildHostedTuiEnv injects monorepo runtime placeholders');
  }

  const { dir: localDir, command: localCmd } = writeTuiStub();
  try {
    // 1) Default path → product home (offline; Code TUI is explicit via `zavorth code`)
    const defaultRun = spawnCaptured('bin/zavorth.js', [], {
      ZAVORTH_CODE_BIN: localCmd,
    });
    assert(
      defaultRun.status === 0,
      `default zavorth failed: status=${defaultRun.status} stderr=${(defaultRun.stderr || '').trim()}`,
    );
    const defaultOut = String(defaultRun.stdout || '');
    assert(
      /Zavorth|product home|Usage:|capabilities/i.test(defaultOut),
      `default path did not show product home: ${defaultOut}`,
    );
    assert(
      !defaultOut.includes('TUI_OK'),
      `default path must not auto-launch Code TUI (got TUI local): ${defaultOut}`,
    );
    pass('node bin/zavorth.js defaults to product home (Code TUI is explicit)');

    // 2) `code` alias → TUI with remaining args
    const codeAlias = spawnCaptured('bin/zavorth.js', ['code', '--version'], {
      ZAVORTH_CODE_BIN: localCmd,
    });
    assert(
      codeAlias.status === 0,
      `code alias failed: status=${codeAlias.status} stderr=${(codeAlias.stderr || '').trim()}`,
    );
    assert(
      String(codeAlias.stdout || '').includes('TUI_OK'),
      `code alias did not hit TUI: ${codeAlias.stdout}`,
    );
    assert(
      String(codeAlias.stdout || '').includes('--version'),
      `code alias did not forward --version: ${codeAlias.stdout}`,
    );
    assert(
      !String(codeAlias.stdout || '').includes(' code '),
      `code token should be stripped before TUI: ${codeAlias.stdout}`,
    );
    pass('node bin/zavorth.js code --version → TUI compat strip');

    // Env agent-runtime hatch takes ALL user args (including a first token `code`)
    // Routing only — we assert it does NOT hit TUI when hatch is forced and dist missing path errors.
  } finally {
    try {
      fs.rmSync(localDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  // 3) Agent-runtime hatch routing (__agent / env only — no public "legacy" token)
  // With ZAVORTH_CODE_BIN unset and hatch forced, must not print TUI_OK.
  // If dist exists, soft-pass a real --version/help with short timeout optional.
  // If no dist, assert error mentions dist (not TUI not-found).
  if (fs.existsSync(legacyDist)) {
    const agentEnvRun = spawnCaptured(
      'bin/zavorth.js',
      ['--version'],
      {
        ZAVORTH_LEGACY_CLI: '1',
        // Even if a TUI local were set, agent hatch must win — prove by setting a failing TUI bin.
        ZAVORTH_CODE_BIN: path.join(root, 'bin', 'definitely-missing-tui-bin-xyz'),
      },
    );
    const combined =
      String(agentEnvRun.stdout || '') + String(agentEnvRun.stderr || '');
    assert(
      !combined.includes('Zavorth Coding CLI not found'),
      `agent env hatch hit TUI not-found: ${combined.slice(0, 400)}`,
    );
    pass(
      `ZAVORTH_LEGACY_CLI=1 routes to agent dist (status=${agentEnvRun.status})`,
    );

    const agentArgRun = spawnCaptured(
      'bin/zavorth.js',
      ['__agent', '--version'],
      {
        ZAVORTH_CODE_BIN: path.join(root, 'bin', 'definitely-missing-tui-bin-xyz'),
      },
    );
    const combined2 =
      String(agentArgRun.stdout || '') + String(agentArgRun.stderr || '');
    assert(
      !combined2.includes('Zavorth Coding CLI not found'),
      `__agent hatch hit TUI not-found: ${combined2.slice(0, 400)}`,
    );
    pass(
      `zavorth __agent routes to agent dist (status=${agentArgRun.status})`,
    );
  } else {
    // No dist: agent hatch must print dist error (same style as old bin), not TUI missing.
    const noDist = spawnCaptured('bin/zavorth.js', ['__agent', '--version'], {
      ZAVORTH_CODE_BIN: path.join(root, 'bin', 'definitely-missing-tui-bin-xyz'),
    });
    assert(noDist.status === 1, `expected exit 1 without dist, got ${noDist.status}`);
    const err = String(noDist.stderr || '') + String(noDist.stdout || '');
    assert(
      /dist\/zavorth-cli\.js/i.test(err) || /Zavorth CLI build not found/i.test(err),
      `agent hatch without dist should mention dist/zavorth-cli.js: ${err.slice(0, 500)}`,
    );
    assert(
      !/Zavorth Coding CLI not found/i.test(err),
      `agent hatch without dist must not report TUI missing: ${err.slice(0, 400)}`,
    );
    pass('agent hatch without dist → clear dist error (not TUI)');
  }

  // Env hatch without dist still routes agent when dist missing — covered above when absent.
  // When dist present, also unit-check env wins over `code` via resolveEntryMode (already done).

  if (fs.existsSync(codeEntry)) {
    console.log('… optional real monorepo TUI --version (soft, 120s)');
    const real = spawnNodeSoft(
      'bin/zavorth.js',
      ['--version'],
      'node bin/zavorth.js --version',
    );
    if (real.ok) {
      pass('node bin/zavorth.js --version (real TUI, soft)');
    } else {
      console.log(
        'WARN: real monorepo TUI --version soft-failed (Bun/OpenTUI flaky on some hosts).',
      );
      console.log(
        '      Entry routing is verified via resolveEntryMode + ZAVORTH_CODE_BIN stubs.',
      );
    }
  } else {
    console.log(
      'SKIP: real TUI probe — packages/code/cli/src/index.ts missing (run code:sync)',
    );
  }

  console.log('entry smoke ok');
}

try {
  main();
} catch (e) {
  console.error('entry smoke FAIL:', e && e.message ? e.message : e);
  process.exit(1);
}
