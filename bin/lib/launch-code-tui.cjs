'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/**
 * Shared Code TUI launcher.
 *
 * Resolution order:
 *  1) ZAVORTH_CODE_BIN override
 *  2) Prebuilt Code binary zavorth-<os>-<arch> (no Bun required)
 *  3) monorepo packages/code/cli + Bun (dev / monorepo fallback only)
 *  4) PATH zavorth-code (skip self / bin/zavorth*.js to avoid recursion)
 *
 * When a prebuilt binary exists, end-user launch never requires Bun.
 */

const DEFAULT_GATEWAY_BASE_URL = 'http://localhost:20128';

/**
 * Mirror scripts/lib/zavorth-runtime-bridge.mjs resolveGatewayBaseUrl
 * (CJS cannot require the ESM bridge directly).
 * @param {NodeJS.ProcessEnv} env
 * @returns {string}
 */
function resolveGatewayBaseUrl(env) {
  const pick = (value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.replace(/\/+$/, '');
  };
  return (
    pick(env.ZAVORTH_GATEWAY_BASE_URL) ||
    pick(env.ZavorthGateway_BASE_URL) ||
    pick(env.BASE_URL) ||
    pick(env.NEXT_PUBLIC_BASE_URL) ||
    DEFAULT_GATEWAY_BASE_URL
  );
}

/**
 * Best-effort write of runtime-bridge.json via the monorepo runtime bridge CLI.
 * Never throws; launch must not fail if bridge write is unavailable.
 * @param {string} projectRoot
 * @param {NodeJS.ProcessEnv} env
 * @param {string} bridgePath
 */
function tryWriteRuntimeBridge(projectRoot, env, bridgePath) {
  try {
    spawnSync(
      process.execPath,
      [bridgePath, '--write', '--root', projectRoot],
      {
        cwd: projectRoot,
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        timeout: 5_000,
      },
    );
  } catch {
    // ignore
  }
}

/**
 * Build child env for Code TUI when hosted from the public `zavorth` entry.
 * Aligns with scripts/lib/zavorth-runtime-bridge.mjs `buildTuiChildEnv`.
 *
 * @param {string} [projectRoot]
 * @param {NodeJS.ProcessEnv} [baseEnv]
 * @returns {NodeJS.ProcessEnv}
 */
function buildHostedTuiEnv(projectRoot, baseEnv) {
  const root = path.resolve(projectRoot || path.resolve(__dirname, '..', '..'));
  const env = { ...(baseEnv || process.env) };

  // Runtime bridge module (ESM). When present, write contract + inject child env.
  const bridgePath = path.join(
    root,
    'scripts',
    'lib',
    'zavorth-runtime-bridge.mjs',
  );
  const hasBridge = fs.existsSync(bridgePath);

  if (hasBridge) {
    tryWriteRuntimeBridge(root, env, bridgePath);
  }

  // Product host contract env (mirrors buildTuiChildEnv).
  env.ZAVORTH_RUNTIME_SOURCE = 'workspace';
  env.ZAVORTH_WORKSPACE_ROOT = root;
  env.ZAVORTH_CODE_FROM_WORKSPACE = '1';
  env.ZAVORTH_GATEWAY_BASE_URL = resolveGatewayBaseUrl(env);
  env.ZAVORTH_POLICY_AUTHORITY = 'gateway';

  // Optional pointer to the written state file (not the mjs module path).
  if (!env.ZAVORTH_RUNTIME_BRIDGE_FILE) {
    try {
      const home = env.ZAVORTH_HOME || env.MIMOCODE_HOME;
      const stateDir = home
        ? path.join(home, 'state')
        : path.join(
            env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state'),
            'zavorth',
          );
      env.ZAVORTH_RUNTIME_BRIDGE_FILE = path.join(stateDir, 'runtime-bridge.json');
    } catch {
      // ignore
    }
  }

  return env;
}

function exitWithResult(result) {
  if (result.error) {
    console.error(
      [
        'Zavorth Code CLI could not start.',
        `Cause: ${result.error.message}`,
      ].join('\n'),
    );
    process.exit(1);
  }
  process.exit(typeof result.status === 'number' ? result.status : 1);
}

function needsWindowsShell(command) {
  if (process.platform !== 'win32') return false;
  if (typeof command !== 'string') return false;
  const lower = command.toLowerCase();
  // .cmd/.bat and bare names (resolved via PATH) need a shell on Windows.
  if (lower.endsWith('.cmd') || lower.endsWith('.bat')) return true;
  if (!path.isAbsolute(command) && !lower.includes('\\') && !lower.includes('/')) {
    return true;
  }
  return false;
}

function spawnInherited(command, args, options) {
  const shell =
    options && Object.prototype.hasOwnProperty.call(options, 'shell')
      ? options.shell
      : needsWindowsShell(command);
  return spawnSync(command, args, {
    cwd: options && options.cwd ? options.cwd : process.cwd(),
    env: options && options.env ? options.env : process.env,
    stdio: 'inherit',
    windowsHide: false,
    shell: Boolean(shell),
  });
}

function listWhere(name) {
  const whereResult = spawnSync('where', [name], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true,
  });
  if (
    whereResult.error ||
    whereResult.status !== 0 ||
    typeof whereResult.stdout !== 'string'
  ) {
    return [];
  }
  return whereResult.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Prefer executable forms Node can spawn on Windows (*.cmd / *.exe). */
function preferWindowsSpawnPath(candidates) {
  const list = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
  const ranked = [];
  for (const candidate of list) {
    const lower = candidate.toLowerCase();
    if (lower.endsWith('.cmd') || lower.endsWith('.exe') || lower.endsWith('.bat')) {
      ranked.push(candidate);
      continue;
    }
    // npm shims often appear as extensionless files next to a .cmd
    const withCmd = candidate + '.cmd';
    if (fs.existsSync(withCmd)) {
      ranked.push(withCmd);
      continue;
    }
    ranked.push(candidate);
  }
  // stable unique
  return [...new Set(ranked)];
}

/**
 * Resolve a spawnable bun executable (prefer real bun.exe on Windows).
 * @returns {string|null}
 */
function findBun() {
  /** @type {string[]} */
  const candidates = [];
  if (process.platform === 'win32') {
    if (process.env.APPDATA) {
      candidates.push(
        path.join(process.env.APPDATA, 'npm', 'node_modules', 'bun', 'bin', 'bun.exe'),
      );
    }
    for (const p of preferWindowsSpawnPath(listWhere('bun'))) {
      candidates.push(p);
      // npm shim dir → node_modules/bun/bin/bun.exe
      if (/\.cmd$/i.test(p) || /\.ps1$/i.test(p)) {
        const nested = path.join(path.dirname(p), 'node_modules', 'bun', 'bin', 'bun.exe');
        candidates.unshift(nested);
      }
    }
    candidates.push('bun.exe');
  } else {
    candidates.push('bun');
  }

  const seen = new Set();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    // Skip cmd/bat/ps1 under shell:false (EINVAL)
    if (process.platform === 'win32' && /\.(cmd|bat|ps1)$/i.test(candidate)) continue;
    if (path.isAbsolute(candidate) && !fs.existsSync(candidate)) continue;
    const probe = spawnSync(candidate, ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
      shell: false,
    });
    if (!probe.error && probe.status === 0) return candidate;
  }
  return null;
}

function findPathCommand(name) {
  if (process.platform === 'win32') {
    const ranked = preferWindowsSpawnPath(listWhere(name));
    return ranked[0] || null;
  }

  const whichResult = spawnSync('which', [name], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (
    !whichResult.error &&
    whichResult.status === 0 &&
    typeof whichResult.stdout === 'string'
  ) {
    const first = whichResult.stdout.trim().split(/\r?\n/)[0];
    if (first) return first;
  }
  return null;
}

function printNotFoundError(detail) {
  console.error(
    [
      'Zavorth Coding CLI not found.',
      detail || 'No prebuilt Code binary and no packages/code sources.',
      '',
      'Fix (pick one):',
      '  1) Install a full release that includes the Code binary, or',
      '  2) npm run code:build     # creates packages/code/cli/dist/…/bin/zavorth',
      '  3) Dev: install Bun + npm run code:install, then zavorth',
      '',
      'Public entry: zavorth  (Code TUI + product capabilities).',
    ].join('\n'),
  );
}

/**
 * Paths that must not be re-spawned as "PATH zavorth-code" (infinite loop risk).
 * @param {string} projectRoot
 * @returns {Set<string>}
 */
function forbiddenReentryPaths(projectRoot) {
  const root = projectRoot || path.resolve(__dirname, '..', '..');
  const set = new Set();
  const candidates = [
    path.join(root, 'bin', 'zavorth.js'),
    path.join(root, 'bin', 'zavorth-code.js'),
    path.join(__dirname, 'launch-code-tui.cjs'),
  ];
  for (const p of candidates) {
    try {
      set.add(path.resolve(p));
    } catch {
      // ignore
    }
  }
  return set;
}

/**
 * Stem of an executable name without common Windows/npm shim suffixes.
 * @param {string} base
 * @returns {string}
 */
function executableStem(base) {
  return String(base || '')
    .toLowerCase()
    .replace(/\.(cmd|bat|ps1|exe|js)$/i, '');
}

/**
 * @param {string} candidate
 * @param {Set<string>} forbidden
 * @returns {boolean}
 */
function isForbiddenReentry(candidate, forbidden) {
  if (!candidate) return true;
  try {
    const resolved = path.resolve(candidate);
    if (forbidden.has(resolved)) return true;
    // npm global / node_modules/.bin shims are named zavorth-code.cmd (etc.) and
    // re-enter bin/zavorth-code.js → launchCodeTui → PATH again (infinite loop).
    // Block any shim whose stem is our package bin names.
    const base = path.basename(resolved).toLowerCase();
    const stem = executableStem(base);
    if (stem === 'zavorth' || stem === 'zavorth-code') {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Launch the Code TUI and exit the current process with the child status.
 *
 * @param {string[]} userArgs
 * @param {{
 *   projectRoot?: string,
 *   env?: NodeJS.ProcessEnv,
 *   cwd?: string,
 *   exit?: boolean,
 * }} [options]
 * @returns {import('node:child_process').SpawnSyncReturns<Buffer>|void}
 */
/**
 * Resolve packages/code/cli layout from install root or overrides.
 * Order: ZAVORTH_CODE_ROOT → projectRoot/packages/code → dirname(package)/packages/code
 * @param {string} projectRoot
 * @param {NodeJS.ProcessEnv} env
 * @returns {{ entry: string, cliCwd: string, codeRoot: string } | null}
 */
function resolveCodeTree(projectRoot, env) {
  /** @type {string[]} */
  const roots = [];
  if (typeof env.ZAVORTH_CODE_ROOT === 'string' && env.ZAVORTH_CODE_ROOT.trim()) {
    roots.push(path.resolve(env.ZAVORTH_CODE_ROOT.trim()));
  }
  roots.push(path.join(projectRoot, 'packages', 'code'));
  // npm global / local install: package root already is the published tree
  roots.push(path.join(path.resolve(__dirname, '..', '..'), 'packages', 'code'));

  const seen = new Set();
  for (const codeRoot of roots) {
    if (!codeRoot || seen.has(codeRoot)) continue;
    seen.add(codeRoot);
    const entry = path.join(codeRoot, 'cli', 'src', 'index.ts');
    const cliCwd = path.join(codeRoot, 'cli');
    if (fs.existsSync(entry)) {
      return { entry, cliCwd, codeRoot };
    }
  }
  return null;
}

/**
 * Prefer a prebuilt Code binary (no Bun required at runtime).
 * Produced by: bun run --cwd packages/code/cli build --single
 * Layout: packages/code/cli/dist/zavorth-{os}-{arch}/bin/zavorth[.exe]
 *
 * @param {string} projectRoot
 * @param {NodeJS.ProcessEnv} env
 * @returns {string|null} absolute path to binary
 */
function resolveCompiledCodeBinary(projectRoot, env) {
  if (typeof env.ZAVORTH_CODE_BIN === 'string' && env.ZAVORTH_CODE_BIN.trim()) {
    const p = path.resolve(env.ZAVORTH_CODE_BIN.trim());
    if (fs.existsSync(p)) return p;
  }

  const osName =
    process.platform === 'win32'
      ? 'windows'
      : process.platform === 'darwin'
        ? 'darwin'
        : process.platform === 'linux'
          ? 'linux'
          : process.platform;
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const names = [
    `zavorth-${osName}-${arch}`,
    `zavorth-${osName}-${arch}-baseline`,
  ];
  const binNames =
    process.platform === 'win32' ? ['zavorth.exe', 'zavorth'] : ['zavorth'];

  /** @type {string[]} */
  const codeRoots = [];
  if (typeof env.ZAVORTH_CODE_ROOT === 'string' && env.ZAVORTH_CODE_ROOT.trim()) {
    codeRoots.push(path.resolve(env.ZAVORTH_CODE_ROOT.trim()));
  }
  codeRoots.push(path.join(projectRoot, 'packages', 'code'));
  codeRoots.push(path.join(path.resolve(__dirname, '..', '..'), 'packages', 'code'));

  for (const codeRoot of codeRoots) {
    for (const name of names) {
      for (const bin of binNames) {
        const candidate = path.join(codeRoot, 'cli', 'dist', name, 'bin', bin);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }
  return null;
}

function launchCodeTui(userArgs, options) {
  const opts = options || {};
  const projectRoot =
    opts.projectRoot || path.resolve(__dirname, '..', '..');
  const args = Array.isArray(userArgs) ? userArgs : [];
  const env = buildHostedTuiEnv(projectRoot, opts.env || process.env);
  const cwd = opts.cwd || process.cwd();
  const shouldExit = opts.exit !== false;
  const forbidden = forbiddenReentryPaths(projectRoot);
  // Tracks nested launcher hops (npm .cmd → bin → PATH). Only used to stop
  // PATH/self reentry; monorepo Bun path remains allowed when nested.
  const launchDepth = Number(env.ZAVORTH_CODE_LAUNCH_DEPTH || 0);
  const nextDepth = String((Number.isFinite(launchDepth) ? launchDepth : 0) + 1);
  env.ZAVORTH_CODE_LAUNCH_DEPTH = nextDepth;

  const finish = (result) => {
    if (shouldExit) exitWithResult(result);
    return result;
  };

  // 1) Explicit override binary (must not recurse into public zavorth shims)
  if (env.ZAVORTH_CODE_BIN) {
    const override = env.ZAVORTH_CODE_BIN;
    if (isForbiddenReentry(override, forbidden)) {
      printNotFoundError(
        `ZAVORTH_CODE_BIN points at a Zavorth entry shim (${override}), which would recurse.`,
      );
      if (shouldExit) process.exit(1);
      return;
    }
    return finish(spawnInherited(override, args, { cwd, env }));
  }

  // 2) Prebuilt Code binary (no Bun at runtime) — packages/code/cli/dist/…
  let compiled = resolveCompiledCodeBinary(projectRoot, env);
  // Skip ensure/download when sources + Bun are available (dev mode)
  if (compiled && !isForbiddenReentry(compiled, forbidden)) {
    return finish(spawnInherited(compiled, args, { cwd, env }));
  }

  // 3) Source tree + Bun — monorepo/dev fallback only (never required when binary exists)
  // Force sources: ZAVORTH_CODE_PREFER_SOURCES=1
  const preferSources =
    env.ZAVORTH_CODE_PREFER_SOURCES === '1' || env.ZAVORTH_CODE_PREFER_SOURCES === 'true';
  const tree = resolveCodeTree(projectRoot, env);
  // Binary already handled above — only reach Bun path when no compiled binary.
  if (tree && (preferSources || !compiled)) {
    const bun = findBun();
    if (!bun) {
      printNotFoundError(
        [
          `Found sources at ${tree.entry} but no prebuilt binary and Bun is not on PATH.`,
          'End users: install a release with packages/code/cli/dist/zavorth-<os>-<arch>, or',
          '  npm run code:ensure  (downloads release asset; Bun only if local build needed)',
        ].join('\n'),
      );
      if (shouldExit) process.exit(1);
      return;
    }
    if (!preferSources) {
      process.stderr.write(
        '[zavorth] Launching Code TUI via Bun+sources (monorepo/dev fallback). ' +
          'Run npm run code:ensure for a permanent binary — then Bun is not required.\n',
      );
    }
    env.ZAVORTH_CODE_ROOT = tree.codeRoot;
    return finish(
      spawnInherited(
        bun,
        ['run', '--conditions=browser', 'src/index.ts', ...args],
        { cwd: tree.cliCwd, env },
      ),
    );
  }

  // 4) Optional PATH binary (never our public zavorth shims)
  if (Number.isFinite(launchDepth) && launchDepth >= 1) {
    printNotFoundError(
      'Refusing recursive Code TUI launch via PATH (nested entry). ' +
        'Use packages/code + Bun, set ZAVORTH_CODE_ROOT, or ZAVORTH_CODE_BIN.',
    );
    if (shouldExit) process.exit(1);
    return;
  }

  const pathBin = findPathCommand('zavorth-code');
  if (pathBin && !isForbiddenReentry(pathBin, forbidden)) {
    return finish(spawnInherited(pathBin, args, { cwd, env }));
  }

  printNotFoundError(
    'Coding CLI not found. Expected packages/code/cli/src/index.ts under the install root, or ZAVORTH_CODE_ROOT.',
  );
  if (shouldExit) process.exit(1);
}

module.exports = {
  launchCodeTui,
  buildHostedTuiEnv,
  resolveCodeTree,
  resolveCompiledCodeBinary,
  findBun,
  findPathCommand,
  needsWindowsShell,
  preferWindowsSpawnPath,
  isForbiddenReentry,
  forbiddenReentryPaths,
  executableStem,
};
