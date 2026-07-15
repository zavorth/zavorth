#!/usr/bin/env node
/**
 * Maturity production readiness gate (post-plan).
 *
 * Checks in-repo artifacts for maturity phases 1–8 without secrets,
 * live network publish, or full monorepo CI.
 *
 * Exit codes:
 * default / --json → always 0 (informational)
 * --strict → non-zero if any required check fails
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CONTRACT_VERSION = 'maturity-production-readiness/1';

const REQUIRED_REACT_ISLANDS = [
 'apps/zavorth-control-vite-shell/src/react/DashboardReactIslands.tsx',
 'apps/zavorth-control-vite-shell/src/react/mountDashboardReactIslands.ts',
];

const REQUIRED_DESKTOP_UPDATER = [
 'apps/zavorth-desktop/electron/desktop-electron-updater.cjs',
 'apps/zavorth-desktop/electron/desktop-update-signing.cjs',
 'apps/zavorth-desktop/electron/desktop-updates.cjs',
];

const REQUIRED_MEMORY_V2 = ['src/services/memory/IMemoryBackend.ts', 'src/services/memory/MemoryBackendCompat.ts'];

const GATE_SCRIPT_KEYS = [
 'maturity:production-readiness',
 'maturity:production-readiness:strict',
 'maturity:production-readiness:json',
];

/**
 * @typedef {'pass'|'warn'|'fail'} CheckStatus
 * @typedef {{ id: string, status: CheckStatus, summary: string, required?: boolean, details?: Record<string, unknown> }} CheckResult
 * @typedef {{
 * contractVersion: string,
 * generatedAt: string,
 * status: 'ready'|'needs_attention',
 * checks: CheckResult[],
 * message: string,
 * counts?: { pass: number, warn: number, fail: number },
 * strict?: boolean,
 * }} MaturityProductionReadinessReport
 */

/**
 * @param {{ root?: string, env?: NodeJS.ProcessEnv, strict?: boolean }} [options]
 * @returns {MaturityProductionReadinessReport}
 */
export function runMaturityProductionReadiness(options = {}) {
 const root = options.root || process.cwd();
 const env = options.env || process.env;
 const strict = Boolean(options.strict);
 /** @type {CheckResult[]} */
 const checks = [];

 // --- Required: phase doc status ---
 checks.push(checkProductGovernanceDoc(root));

 // --- Required: React island sources ---
 checks.push(
 checkFilesExist(root, {
 id: 'react-island-sources',
 required: true,
 files: REQUIRED_REACT_ISLANDS,
 passSummary: 'React island sources present (DashboardReactIslands + mount)',
 failSummary: 'Missing React island source file(s)',
 }),
 );

 // --- Required: desktop electron-updater modules ---
 checks.push(
 checkFilesExist(root, {
 id: 'desktop-electron-updater-modules',
 required: true,
 files: REQUIRED_DESKTOP_UPDATER,
 passSummary: 'Desktop electron-updater modules present',
 failSummary: 'Missing desktop update module(s)',
 }),
 );

 // --- Required: memory v2 ---
 checks.push(
 checkFilesExist(root, {
 id: 'memory-backend-v2',
 required: true,
 files: REQUIRED_MEMORY_V2,
 passSummary: 'Memory backend v2 files present (IMemoryBackend + compat)',
 failSummary: 'Missing memory backend v2 file(s)',
 }),
 );

 // --- Required: NaturalScheduleParser ---
 checks.push(
 checkFilesExist(root, {
 id: 'natural-schedule-parser',
 required: true,
 files: ['src/services/scheduling/NaturalScheduleParser.ts'],
 passSummary: 'NaturalScheduleParser exists',
 failSummary: 'NaturalScheduleParser.ts missing',
 }),
 );

 // --- Required: SessionPersistenceStore sqlite ---
 checks.push(checkSessionPersistenceSqlite(root));

 // --- Required: root package.json gate scripts ---
 checks.push(checkRootGateScripts(root));

 // --- Advisory: built Vite shell artifact ---
 checks.push(checkViteShellArtifact(root));

 // --- Advisory: desktop signing status (no secrets printed) ---
 checks.push(checkDesktopSigningStatus(root, env));

 // --- Advisory: electron-updater dependency ---
 checks.push(checkElectronUpdaterDependency(root));

 // --- Advisory: GH_TOKEN presence (boolean only) ---
 checks.push(checkGhTokenPresent(env));

 const counts = {
 pass: checks.filter((c) => c.status === 'pass').length,
 warn: checks.filter((c) => c.status === 'warn').length,
 fail: checks.filter((c) => c.status === 'fail').length,
 };

 const requiredFailed = checks.some((c) => c.required && c.status === 'fail');
 // Overall status is needs_attention on any required fail or advisory warn.
 // --strict exit code uses required failures only.
 let message;
 if (requiredFailed) {
 message = `Maturity production readiness: ${counts.fail} required check(s) failed, ${counts.warn} advisory warning(s).`;
 } else if (counts.warn > 0) {
 message = `Maturity production readiness: required checks passed; ${counts.warn} operator-owned advisory item(s).`;
 } else {
 message = 'Maturity production readiness: all checks passed (including advisory).';
 }

 return {
 contractVersion: CONTRACT_VERSION,
 generatedAt: new Date().toISOString(),
 status: requiredFailed || counts.warn > 0 ? 'needs_attention' : 'ready',
 checks,
 counts,
 strict,
 message,
 };
}

/**
 * @param {string} root
 * @returns {CheckResult}
 */
function checkProductGovernanceDoc(root) {
 const rel = 'docs/product/agent-governance.md';
 const abs = path.join(root, rel);
 if (!fs.existsSync(abs)) {
 return {
 id: 'product-governance-doc',
 required: true,
 status: 'fail',
 summary: `Missing ${rel}`,
 };
 }

 const text = fs.readFileSync(abs, 'utf8');
 const statusLineOk =
 /Status:\s*\*\*Phase\s*8\s*DONE\*\*/i.test(text) ||
 (/Phase\s*8\s*DONE/i.test(text) && /phases?\s*1\s*[–-]\s*8/i.test(text)) ||
 /maturity plan complete\s*\(phases?\s*1\s*[–-]\s*8\)/i.test(text);

 const tablePhasesDone = [1, 2, 3, 4, 5, 6, 7, 8].every((n) => {
 const re = new RegExp(`\\|\\s*\\*\\*${n}\\*\\*[^|]*\\|[^|]*\\|[^|]*\\|\\s*\\*\\*DONE\\*\\*`, 'i');
 return re.test(text);
 });

 const requiredSections = ['Mission contracts', 'Autonomy budgets', 'Memory provenance', 'Health'];
 const missingSections = requiredSections.filter((section) => !text.toLowerCase().includes(section.toLowerCase()));
 const ok = missingSections.length === 0;
 return {
 id: 'product-governance-doc',
 required: true,
 status: ok ? 'pass' : 'fail',
 summary: ok
 ? 'Milestone doc reports complete'
 : 'Phase doc does not clearly mark phases 1–8 as DONE',
 details: { path: rel, statusLineOk, tablePhasesDone },
 };
}

/**
 * @param {string} root
 * @param {{ id: string, required: boolean, files: string[], passSummary: string, failSummary: string }} spec
 * @returns {CheckResult}
 */
function checkFilesExist(root, spec) {
 const missing = spec.files.filter((rel) => !fs.existsSync(path.join(root, rel)));
 return {
 id: spec.id,
 required: spec.required,
 status: missing.length === 0 ? 'pass' : 'fail',
 summary: missing.length === 0 ? spec.passSummary : `${spec.failSummary}: ${missing.join(', ')}`,
 details: { files: spec.files, missing },
 };
}

/**
 * @param {string} root
 * @returns {CheckResult}
 */
function checkSessionPersistenceSqlite(root) {
 const rel = 'src/runtime/sessions/SessionPersistenceStore.ts';
 const abs = path.join(root, rel);
 if (!fs.existsSync(abs)) {
 return {
 id: 'session-persistence-sqlite',
 required: true,
 status: 'fail',
 summary: `Missing ${rel}`,
 };
 }
 const text = fs.readFileSync(abs, 'utf8');
 const mentions = /better-sqlite3/i.test(text) || /\bsqlite\b/i.test(text);
 return {
 id: 'session-persistence-sqlite',
 required: true,
 status: mentions ? 'pass' : 'fail',
 summary: mentions
 ? 'SessionPersistenceStore references better-sqlite3 / sqlite'
 : 'SessionPersistenceStore does not mention better-sqlite3 or sqlite',
 details: { path: rel },
 };
}

/**
 * @param {string} root
 * @returns {CheckResult}
 */
function checkRootGateScripts(root) {
 const rel = 'package.json';
 const abs = path.join(root, rel);
 if (!fs.existsSync(abs)) {
 return {
 id: 'root-gate-scripts',
 required: true,
 status: 'fail',
 summary: 'Root package.json missing',
 };
 }
 let pkg;
 try {
 pkg = JSON.parse(fs.readFileSync(abs, 'utf8'));
 } catch {
 return {
 id: 'root-gate-scripts',
 required: true,
 status: 'fail',
 summary: 'Root package.json is not valid JSON',
 };
 }
 const scripts = pkg.scripts || {};
 const missing = GATE_SCRIPT_KEYS.filter((key) => !scripts[key]);
 return {
 id: 'root-gate-scripts',
 required: true,
 status: missing.length === 0 ? 'pass' : 'fail',
 summary:
 missing.length === 0
 ? 'Root package.json exposes maturity:production-readiness scripts'
 : `Missing root scripts: ${missing.join(', ')}`,
 details: { expected: GATE_SCRIPT_KEYS, missing },
 };
}

/**
 * @param {string} root
 * @returns {CheckResult}
 */
function checkViteShellArtifact(root) {
 const dirRel = 'src/zavorth-control/public/zavorth-control-vite-shell';
 const dirAbs = path.join(root, dirRel);
 if (!fs.existsSync(dirAbs)) {
 return {
 id: 'vite-shell-artifact-react-island',
 required: false,
 status: 'warn',
 summary: 'Built Vite shell artifact missing — run `npm run zavorth-control-vite:build`',
 details: { path: dirRel },
 };
 }

 const found = findNeedleInTree(dirAbs, 'data-react-dashboard-island', 40);
 return {
 id: 'vite-shell-artifact-react-island',
 required: false,
 status: found ? 'pass' : 'warn',
 summary: found
 ? 'Built Vite shell artifact contains data-react-dashboard-island'
 : 'Built Vite shell artifact lacks data-react-dashboard-island — run `npm run zavorth-control-vite:build`',
 details: { path: dirRel, found },
 };
}

/**
 * Walk a small tree for a string needle in text files.
 * @param {string} dir
 * @param {string} needle
 * @param {number} maxFiles
 */
function findNeedleInTree(dir, needle, maxFiles) {
 /** @type {string[]} */
 const stack = [dir];
 let scanned = 0;
 while (stack.length > 0 && scanned < maxFiles) {
 const current = stack.pop();
 if (!current) break;
 let entries;
 try {
 entries = fs.readdirSync(current, { withFileTypes: true });
 } catch {
 continue;
 }
 for (const entry of entries) {
 const full = path.join(current, entry.name);
 if (entry.isDirectory()) {
 if (entry.name === 'node_modules' || entry.name === '.git') continue;
 stack.push(full);
 continue;
 }
 if (!entry.isFile()) continue;
 if (!/\.(js|mjs|cjs|html|css|map|json|svg|txt)$/i.test(entry.name)) continue;
 scanned += 1;
 try {
 const content = fs.readFileSync(full, 'utf8');
 if (content.includes(needle)) return true;
 } catch {
 // binary / unreadable
 }
 if (scanned >= maxFiles) break;
 }
 }
 return false;
}

/**
 * @param {string} root
 * @param {NodeJS.ProcessEnv} env
 * @returns {CheckResult}
 */
function checkDesktopSigningStatus(root, env) {
 const rel = 'apps/zavorth-desktop/electron/desktop-update-signing.cjs';
 const abs = path.join(root, rel);
 if (!fs.existsSync(abs)) {
 return {
 id: 'desktop-signing-status',
 required: false,
 status: 'warn',
 summary: 'desktop-update-signing.cjs missing; cannot report signing readiness',
 };
 }

 try {
 const require = createRequire(pathToFileURL(path.join(root, 'package.json')).href);
 const signing = require(abs);
 if (typeof signing.resolveSigningStatus !== 'function') {
 return {
 id: 'desktop-signing-status',
 required: false,
 status: 'warn',
 summary: 'desktop-update-signing.cjs does not export resolveSigningStatus',
 };
 }
 const status = signing.resolveSigningStatus(env);
 // Never print secrets — only booleans / readiness flags from the helper.
 const shippingReady = Boolean(status?.shippingReady);
 const windowsReady = Boolean(status?.windows?.readyToSign);
 const macReady = Boolean(status?.mac?.readyToSign);
 const notarizeReady = Boolean(status?.mac?.notarizeReady);

 if (shippingReady) {
 return {
 id: 'desktop-signing-status',
 required: false,
 status: 'pass',
 summary: 'Desktop signing material configured for at least one shipping platform',
 details: {
 shippingReady,
 windowsReadyToSign: windowsReady,
 macReadyToSign: macReady,
 macNotarizeReady: notarizeReady,
 },
 };
 }

 return {
 id: 'desktop-signing-status',
 required: false,
 status: 'warn',
 summary: 'Signing not configured — installers will be unsigned (operator-owned certs)',
 details: {
 shippingReady: false,
 windowsReadyToSign: windowsReady,
 macReadyToSign: macReady,
 macNotarizeReady: notarizeReady,
 },
 };
 } catch (error) {
 return {
 id: 'desktop-signing-status',
 required: false,
 status: 'warn',
 summary: `Could not evaluate signing status: ${error instanceof Error ? error.message : String(error)}`,
 };
 }
}

/**
 * @param {string} root
 * @returns {CheckResult}
 */
function checkElectronUpdaterDependency(root) {
 const rel = 'apps/zavorth-desktop/package.json';
 const abs = path.join(root, rel);
 if (!fs.existsSync(abs)) {
 return {
 id: 'electron-updater-dependency',
 required: false,
 status: 'warn',
 summary: 'apps/zavorth-desktop/package.json missing',
 };
 }
 let pkg;
 try {
 pkg = JSON.parse(fs.readFileSync(abs, 'utf8'));
 } catch {
 return {
 id: 'electron-updater-dependency',
 required: false,
 status: 'warn',
 summary: 'apps/zavorth-desktop/package.json is not valid JSON',
 };
 }
 const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
 const present = Object.prototype.hasOwnProperty.call(deps, 'electron-updater');
 return {
 id: 'electron-updater-dependency',
 required: false,
 status: present ? 'pass' : 'warn',
 summary: present
 ? `electron-updater listed in desktop package.json (${deps['electron-updater']})`
 : 'electron-updater not listed in apps/zavorth-desktop/package.json dependencies',
 details: { present },
 };
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {CheckResult}
 */
function checkGhTokenPresent(env) {
 const present = Boolean(String(env.GH_TOKEN || '').trim() || String(env.GITHUB_TOKEN || '').trim());
 // Never print token value — boolean only.
 return {
 id: 'gh-token-present',
 required: false,
 status: present ? 'pass' : 'warn',
 summary: present
 ? 'GH_TOKEN or GITHUB_TOKEN is present in environment (value not shown)'
 : 'GH_TOKEN / GITHUB_TOKEN not set — required for desktop publish to GitHub Releases (operator-owned)',
 details: { present },
 };
}

/**
 * @param {MaturityProductionReadinessReport} report
 * @param {{ json?: boolean }} flags
 */
export function formatMaturityProductionReadiness(report, flags = {}) {
 if (flags.json) {
 return `${JSON.stringify(report, null, 2)}\n`;
 }

 const lines = [];
 lines.push(`[maturity-production-readiness] ${report.status.toUpperCase()}`);
 lines.push(`contract: ${report.contractVersion}`);
 lines.push(`generatedAt: ${report.generatedAt}`);
 if (report.counts) {
 lines.push(`counts: pass=${report.counts.pass} warn=${report.counts.warn} fail=${report.counts.fail}`);
 }
 lines.push('');
 for (const check of report.checks) {
 const tag = check.status.toUpperCase().padEnd(4);
 const req = check.required ? 'required' : 'advisory';
 lines.push(` [${tag}] (${req}) ${check.id}: ${check.summary}`);
 }
 lines.push('');
 lines.push(report.message);
 return `${lines.join('\n')}\n`;
}

/**
 * @param {string[]} [argv]
 * @param {{ root?: string, env?: NodeJS.ProcessEnv }} [options]
 */
export function main(argv = process.argv.slice(2), options = {}) {
 const json = argv.includes('--json');
 const strict = argv.includes('--strict');
 const report = runMaturityProductionReadiness({
 root: options.root || process.cwd(),
 env: options.env || process.env,
 strict,
 });

 process.stdout.write(formatMaturityProductionReadiness(report, { json }));

 const requiredFailed = report.checks.some((c) => c.required && c.status === 'fail');
 if (strict && requiredFailed) {
 process.exitCode = 1;
 return 1;
 }
 process.exitCode = 0;
 return 0;
}

const isDirectRun = (() => {
 try {
 const thisFile = path.resolve(fileURLToPath(import.meta.url));
 const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
 return Boolean(invoked) && thisFile === invoked;
 } catch {
 return false;
 }
})();

if (isDirectRun) {
 main();
}
