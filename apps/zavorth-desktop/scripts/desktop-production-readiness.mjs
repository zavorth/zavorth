/**
 * Desktop production readiness — structural checks without certs or publish.
 *
 * Verifies shipping path wiring (electron-updater, package scripts,
 * signing helpers, entitlements). Unsigned builds are OK for local smoke;
 * shipping needs CSC_LINK / Apple notarization env (see PRODUCTION.md).
 *
 * CLI:
 *   node scripts/desktop-production-readiness.mjs
 *   node scripts/desktop-production-readiness.mjs --json
 *   node scripts/desktop-production-readiness.mjs --strict
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_APP_ROOT = resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const REQUIRED_SCRIPTS = ['package:release', 'package:publish', 'signing:status'];
const CORE_ELECTRON_FILES = [
  'electron/desktop-electron-updater.cjs',
  'electron/desktop-update-signing.cjs',
  'electron/desktop-updates.cjs',
  'electron/main.cjs',
];
const MAIN_UPDATER_MARKER = 'createDesktopElectronUpdater';

/**
 * @typedef {'pass' | 'fail' | 'warn'} CheckStatus
 * @typedef {{
 *   id: string,
 *   status: CheckStatus,
 *   message: string,
 *   strictFail?: boolean,
 * }} ReadinessCheck
 */

/**
 * @param {string} appRoot
 * @param {string} rel
 */
function readText(appRoot, rel) {
  const full = resolve(appRoot, rel);
  if (!existsSync(full)) return null;
  return readFileSync(full, 'utf8');
}

/**
 * @param {string} appRoot
 * @param {string} rel
 */
function readJson(appRoot, rel) {
  const body = readText(appRoot, rel);
  if (body == null) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

/**
 * Pure: inspect package.json for production shipping deps/scripts.
 * @param {Record<string, unknown> | null} pkg
 * @returns {ReadinessCheck[]}
 */
export function evaluatePackageJsonChecks(pkg) {
  /** @type {ReadinessCheck[]} */
  const checks = [];

  if (!pkg || typeof pkg !== 'object') {
    checks.push({
      id: 'package-json',
      status: 'fail',
      message: 'package.json missing or invalid JSON',
      strictFail: true,
    });
    return checks;
  }

  const deps = {
    ...(pkg.dependencies && typeof pkg.dependencies === 'object' ? pkg.dependencies : {}),
    ...(pkg.devDependencies && typeof pkg.devDependencies === 'object' ? pkg.devDependencies : {}),
  };
  const hasUpdater = Object.prototype.hasOwnProperty.call(deps, 'electron-updater');
  checks.push({
    id: 'dep-electron-updater',
    status: hasUpdater ? 'pass' : 'fail',
    message: hasUpdater ? `electron-updater declared (${String(deps['electron-updater'])})`
      : 'electron-updater missing from dependencies/devDependencies',
    strictFail: true,
  });

  const scripts = pkg.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {};
  for (const name of REQUIRED_SCRIPTS) {
    const present = typeof scripts[name] === 'string' && scripts[name].trim().length > 0;
    checks.push({
      id: `script-${name}`,
      status: present ? 'pass' : 'fail',
      message: present ? `script "${name}" present` : `script "${name}" missing`,
      strictFail: true,
    });
  }

  return checks;
}

/**
 * Pure: structural electron + entitlements file checks.
 * @param {{ exists: (rel: string) => boolean, read: (rel: string) => string | null }} fs
 * @returns {ReadinessCheck[]}
 */
export function evaluateElectronFileChecks(fs) {
  /** @type {ReadinessCheck[]} */
  const checks = [];

  for (const rel of CORE_ELECTRON_FILES) {
    const ok = fs.exists(rel);
    checks.push({
      id: `file-${rel.replace(/[\\/]/g, '-')}`,
      status: ok ? 'pass' : 'fail',
      message: ok ? `file ${rel}` : `missing core file ${rel}`,
      strictFail: true,
    });
  }

  const mainBody = fs.read('electron/main.cjs') || '';
  const mainHasBridge = mainBody.includes(MAIN_UPDATER_MARKER);
  checks.push({
    id: 'main-createDesktopElectronUpdater',
    status: mainHasBridge ? 'pass' : 'fail',
    message: mainHasBridge ? 'electron/main.cjs references createDesktopElectronUpdater'
      : 'electron/main.cjs does not reference createDesktopElectronUpdater',
    strictFail: true,
  });

  const entitlementsRel = 'build/entitlements.mac.plist';
  const entitlementsOk = fs.exists(entitlementsRel);
  checks.push({
    id: 'file-entitlements-mac',
    status: entitlementsOk ? 'pass' : 'fail',
    message: entitlementsOk ? `file ${entitlementsRel}`
      : `missing ${entitlementsRel}`,
    strictFail: true,
  });

  return checks;
}

/**
 * Pure: map signing status into readiness checks.
 * Shipping unsigned is warn (not fail) even in --strict.
 * @param {ReturnType<typeof import('../electron/desktop-update-signing.cjs').resolveSigningStatus>} signing
 * @returns {ReadinessCheck[]}
 */
export function evaluateSigningChecks(signing) {
  /** @type {ReadinessCheck[]} */
  const checks = [];

  if (!signing || typeof signing !== 'object') {
    checks.push({
      id: 'signing-status',
      status: 'warn',
      message: 'Could not resolve signing status helper',
      strictFail: false,
    });
    return checks;
  }

  checks.push({
    id: 'signing-status',
    status: signing.shippingReady ? 'pass' : 'warn',
    message: signing.message
      || (signing.shippingReady ? 'Signing material configured for at least one platform.'
        : 'Signing not configured — unsigned OK for local; shipping needs CSC_LINK etc.'),
    strictFail: false,
  });

  checks.push({
    id: 'signing-windows',
    status: signing.windows?.readyToSign ? 'pass' : 'warn',
    message: signing.windows?.notes || 'Windows signing status unknown',
    strictFail: false,
  });

  checks.push({
    id: 'signing-mac',
    status: signing.mac?.notarizeReady ? 'pass'
      : (signing.mac?.readyToSign ? 'warn' : 'warn'),
    message: signing.mac?.notes || 'macOS signing status unknown',
    strictFail: false,
  });

  return checks;
}

/**
 * @param {{
 *   appRoot?: string,
 *   env?: NodeJS.ProcessEnv,
 *   strict?: boolean,
 *   resolveSigningStatus?: (env: NodeJS.ProcessEnv) => unknown,
 * }} [options]
 */
export function runDesktopProductionReadiness(options = {}) {
  const appRoot = options.appRoot || DEFAULT_APP_ROOT;
  const env = options.env || process.env;
  const strict = Boolean(options.strict);

  /** @type {ReadinessCheck[]} */
  const checks = [];

  const pkg = readJson(appRoot, 'package.json');
  checks.push(...evaluatePackageJsonChecks(pkg));

  checks.push(...evaluateElectronFileChecks({
    exists: (rel) => existsSync(resolve(appRoot, rel)),
    read: (rel) => readText(appRoot, rel),
  }));

  let signing = null;
  try {
    const resolveSigningStatus = options.resolveSigningStatus
      || require(resolve(appRoot, 'electron/desktop-update-signing.cjs')).resolveSigningStatus;
    signing = resolveSigningStatus(env);
    checks.push(...evaluateSigningChecks(signing));
  } catch (error) {
    checks.push({
      id: 'signing-status',
      status: 'warn',
      message: `Signing helper failed: ${error?.message || String(error)}`,
      strictFail: false,
    });
  }

  const pass = checks.filter((c) => c.status === 'pass').length;
  const warn = checks.filter((c) => c.status === 'warn').length;
  const fail = checks.filter((c) => c.status === 'fail').length;
  const strictFails = checks.filter((c) => c.status === 'fail' && c.strictFail).length;

  // Default mode: any fail is non-zero. Strict mode: only strictFail checks fail the process
  // (signing remains warn). Unsigned is never a hard fail.
  const ok = strict ? strictFails === 0 : fail === 0;

  const shippingReady = Boolean(signing?.shippingReady);
  const honesty = shippingReady ? 'Signing configured for shipping installers on at least one platform.'
    : 'Unsigned is OK for local package:release smoke; shipping needs CSC_LINK / WIN_CSC_LINK '
      + '(and password), plus Apple notarization env on macOS. Do not commit secrets.';

  return {
    contractVersion: 'desktop-production-readiness/1',
    ok,
    strict,
    appRoot,
    summary: { pass, warn, fail, strictFails },
    checks,
    signing,
    honesty,
    message: ok ? `Desktop production readiness OK (${pass} pass, ${warn} warn, ${fail} fail). ${honesty}`
      : `Desktop production readiness FAILED (${pass} pass, ${warn} warn, ${fail} fail). ${honesty}`,
    nextSteps: [
      'npm run signing:status',
      'npm run production:readiness',
      'npm run package:release  # local installer, publish never',
      'npm run package:publish  # needs GH_TOKEN + signing for shipping',
    ],
  };
}

/**
 * @param {string[]} argv
 */
export function parseCliArgs(argv = process.argv.slice(2)) {
  return {
    json: argv.includes('--json'),
    strict: argv.includes('--strict') || argv.includes('--check'),
  };
}

/**
 * @param {ReturnType<typeof runDesktopProductionReadiness>} report
 * @param {{ json?: boolean }} [opts]
 */
export function printReadinessReport(report, opts = {}) {
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  const icon = { pass: 'OK   ', fail: 'FAIL ', warn: 'WARN ' };
  console.log('Zavorth Desktop — production readiness (no certs required)\n');
  for (const check of report.checks) {
    console.log(`${icon[check.status] || '...... '} ${check.id}: ${check.message}`);
  }
  console.log('');
  console.log(report.message);
  if (!report.signing?.shippingReady) {
    console.log('');
    console.log('Honesty: unsigned installers are fine for local verification.');
    console.log('Shipping needs CSC_LINK / CSC_KEY_PASSWORD (or WIN_CSC_LINK) and, on macOS,');
    console.log('APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID for notarization.');
    console.log('Publish uses GH_TOKEN/GITHUB_TOKEN. See PRODUCTION.md or npm run signing:status.');
  }
  console.log('');
  console.log('Next:');
  for (const step of report.nextSteps) {
    console.log(`  ${step}`);
  }
}

function isCliMain() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return pathToFileURL(resolve(entry)).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isCliMain()) {
  const args = parseCliArgs();
  const report = runDesktopProductionReadiness({ strict: args.strict });
  printReadinessReport(report, { json: args.json });
  process.exitCode = report.ok ? 0 : 1;
}
