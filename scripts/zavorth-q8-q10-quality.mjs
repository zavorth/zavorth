#!/usr/bin/env node
/**
 * Q8–Q10 quality gates for Trust Loop verification.
 *
 * Q8 Cross-surface honesty language (Desktop / Control / CLI / demo / site tokens)
 * Q9 Performance budgets (golden-path duration, CLI help cold, strip/list scale)
 * Q10 Accessibility contracts (keyboard/reduced-motion markers on demos + desktop a11y summary)
 *
 * Exit non-zero on failure.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const websiteRoot = path.resolve(root, '..', 'zavorth-website');

const steps = [];
const startedAt = Date.now();

function record(name, ok, detail, durationMs = 0) {
  steps.push({ name, ok, detail, durationMs });
  console.log(`${ok ? '[pass]' : '[fail]'} ${name}${detail ? ` — ${detail}` : ''}${durationMs ? ` (${durationMs}ms)` : ''}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

// ── Q8: cross-surface honesty language ─────────────────────────────────────
{
  const t0 = Date.now();
  const fails = [];
  const pairs = [
    // Desktop readiness never equates bare "ready" string to Live without liveReady
    {
      file: 'apps/zavorth-desktop/src/desktop-state/readiness.ts',
      must: [/liveReady/, /catalog|available|needs_setup/i],
      mustNot: [],
    },
    {
      file: 'src/services/control/ControlTrustLoopModel.ts',
      must: [/liveReady === true/, /Catalog only|catalog/],
      mustNot: [],
    },
    {
      file: 'src/cli/ZavorthCliVisualTheme.ts',
      must: [/NO_COLOR/, /FORCE_COLOR/, /00e88f|#00e88f|232.*143/],
      mustNot: [/255;122;24/], // orange brand retired in primary tokens
    },
    {
      file: 'assets/zavorth-demo/index.html',
      must: [/not a live|fixture|offline|demo/i, /receipt|approv/i],
      mustNot: [],
    },
  ];

  for (const p of pairs) {
    if (!exists(p.file)) {
      fails.push(`missing ${p.file}`);
      continue;
    }
    const text = read(p.file);
    for (const re of p.must) {
      if (!re.test(text)) fails.push(`${p.file} missing ${re}`);
    }
    for (const re of p.mustNot) {
      if (re.test(text)) fails.push(`${p.file} forbidden ${re}`);
    }
  }

  // Shared honesty vocabulary across desktop i18n + trust-loop yaml
  const desktopI18n = exists('apps/zavorth-desktop/src/i18n.ts') ? read('apps/zavorth-desktop/src/i18n.ts') : '';
  const trustLoopEn = exists('src/i18n/locales/en-US/trust-loop.yaml')
    ? read('src/i18n/locales/en-US/trust-loop.yaml')
    : '';
  if (trustLoopEn && !/Live|live/.test(trustLoopEn)) fails.push('trust-loop.yaml missing Live vocabulary');
  if (desktopI18n && !/Live|live|ready/i.test(desktopI18n)) fails.push('desktop i18n missing readiness vocabulary');

  // Website demo honesty
  const trustDemo = path.join(websiteRoot, 'components', 'TrustLoopDemo.tsx');
  if (fs.existsSync(trustDemo)) {
    const t = fs.readFileSync(trustDemo, 'utf8');
    if (!/not live|fixture|offline/i.test(t)) fails.push('TrustLoopDemo missing honesty disclaimer');
    if (!/aria-keyshortcuts|onKeyDown|keyboard/i.test(t)) fails.push('TrustLoopDemo missing keyboard a11y hooks');
  } else {
    fails.push('website TrustLoopDemo.tsx not found');
  }

  record('q8-cross-surface-honesty', fails.length === 0, fails.length ? fails.slice(0, 6).join('; ') : 'honesty vocabulary aligned', Date.now() - t0);
}

// ── Q9: performance budgets ────────────────────────────────────────────────
{
  const t0 = Date.now();
  const fails = [];
  const budgetGoldenMs = 120_000;
  const budgetCliHelpMs = 45_000;

  // Golden path duration
  const gp = spawnSync(process.execPath, [path.join(root, 'scripts', 'zavorth-golden-path.mjs')], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', CI: '1' },
    timeout: budgetGoldenMs + 30_000,
    windowsHide: true,
    maxBuffer: 40 * 1024 * 1024,
  });
  const gpMs = Date.now() - t0;
  if (gp.status !== 0) fails.push('golden-path failed');
  if (gpMs > budgetGoldenMs) fails.push(`golden-path ${gpMs}ms > budget ${budgetGoldenMs}ms`);

  // CLI help cold-ish (tsx path)
  const t1 = Date.now();
  const tsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const cliEntry = path.join(root, 'src', 'zavorth-cli.ts');
  let cliMs = 0;
  if (fs.existsSync(tsx) && fs.existsSync(cliEntry)) {
    const r = spawnSync(process.execPath, [tsx, cliEntry, 'proof', '--help'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
      timeout: budgetCliHelpMs + 15_000,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    });
    cliMs = Date.now() - t1;
    if (r.status !== 0 && r.status !== null) {
      // help may exit 0 only; accept if usage printed
      const out = `${r.stdout || ''}${r.stderr || ''}`;
      if (!/proof|ledger|Usage/i.test(out)) fails.push('cli proof --help failed');
    }
    if (cliMs > budgetCliHelpMs) fails.push(`cli help ${cliMs}ms > budget ${budgetCliHelpMs}ms`);
  } else {
    fails.push('tsx/cli entry missing for CLI help budget');
  }

  // Large JSONL strip selection budget (pure node microbench)
  const t2 = Date.now();
  const bench = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
      import { selectLatestProof } from './src/services/control/ControlTrustLoopModel.ts';
      const n = 5000;
      const events = Array.from({ length: n }, (_, i) => ({
        id: 'p' + i,
        runId: null,
        kind: 'chat',
        surface: 'cli',
        title: 'T' + i,
        summary: 'S',
        status: 'ok',
        riskLevel: 'none',
        approvalId: null,
        artifacts: [],
        createdAt: new Date(Date.now() - i * 1000).toISOString(),
        source: 'bench',
      }));
      const t0 = Date.now();
      const top = selectLatestProof(events, 12);
      const ms = Date.now() - t0;
      if (top.length !== 12) process.exit(2);
      if (ms > 500) { console.error('slow', ms); process.exit(3); }
      console.log('ok', ms);
      `,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: 30_000,
      windowsHide: true,
    },
  );
  // Prefer tsx for TS import
  const bench2 = spawnSync(
    process.execPath,
    [
      tsx,
      '-e',
      `
      import { selectLatestProof } from './src/services/control/ControlTrustLoopModel.ts';
      const n = 5000;
      const events = Array.from({ length: n }, (_, i) => ({
        id: 'p' + i, runId: null, kind: 'chat', surface: 'cli', title: 'T' + i, summary: 'S',
        status: 'ok', riskLevel: 'none', approvalId: null, artifacts: [],
        createdAt: new Date(Date.now() - i * 1000).toISOString(), source: 'bench',
      }));
      const t0 = Date.now();
      const top = selectLatestProof(events, 12);
      const ms = Date.now() - t0;
      if (top.length !== 12) process.exit(2);
      if (ms > 800) { console.error('slow', ms); process.exit(3); }
      console.log(JSON.stringify({ ok: true, ms, n }));
      `,
    ],
    { cwd: root, encoding: 'utf8', timeout: 60_000, windowsHide: true },
  );
  if (bench2.status !== 0) {
    fails.push(`large-ledger select budget failed: ${(bench2.stderr || bench2.stdout || '').slice(0, 200)}`);
  }

  record(
    'q9-performance-budgets',
    fails.length === 0,
    fails.length
      ? fails.join('; ')
      : `golden~${gpMs}ms cliHelp~${cliMs}ms ledger-select ok`,
    Date.now() - t0,
  );
}

// ── Q10: accessibility contracts ───────────────────────────────────────────
{
  const t0 = Date.now();
  const fails = [];

  // Desktop a11y summary artifact if present
  const a11ySummary = path.join(root, 'apps/zavorth-desktop/tests/a11y/artifacts/a11y-summary.json');
  if (fs.existsSync(a11ySummary)) {
    try {
      const j = JSON.parse(fs.readFileSync(a11ySummary, 'utf8'));
      if (j.status === 'fail' || (j.failCount && j.failCount > 0)) {
        fails.push(`desktop a11y summary failCount=${j.failCount}`);
      }
    } catch (e) {
      fails.push(`a11y summary parse: ${e.message}`);
    }
  }

  // Static demo a11y markers
  if (exists('assets/zavorth-demo/index.html')) {
    const html = read('assets/zavorth-demo/index.html');
    if (!/prefers-reduced-motion|reduced-motion/i.test(html)) fails.push('static demo missing reduced-motion');
    if (!/keydown|keyup|keyboard|role=|aria-/i.test(html)) fails.push('static demo missing keyboard/aria hooks');
  } else {
    fails.push('static demo missing');
  }

  // Website TrustLoopDemo
  const trustDemo = path.join(websiteRoot, 'components', 'TrustLoopDemo.tsx');
  if (fs.existsSync(trustDemo)) {
    const t = fs.readFileSync(trustDemo, 'utf8');
    if (!/prefers-reduced-motion|matchMedia/i.test(t)) fails.push('TrustLoopDemo missing reduced-motion');
    if (!/onKeyDown|keydown|aria-keyshortcuts/i.test(t)) fails.push('TrustLoopDemo missing keyboard handlers');
    if (!/button|role=/i.test(t)) fails.push('TrustLoopDemo missing button roles');
  }

  // Desktop NextActionBanner has role=status aria-live
  if (exists('apps/zavorth-desktop/src/components/NextActionBanner.tsx')) {
    const b = read('apps/zavorth-desktop/src/components/NextActionBanner.tsx');
    if (!/aria-live|role=\"status\"/.test(b)) fails.push('NextActionBanner missing live region');
  }

  record('q10-accessibility-contracts', fails.length === 0, fails.length ? fails.join('; ') : 'demo+desktop a11y contracts ok', Date.now() - t0);
}

const failed = steps.filter((s) => !s.ok);
const summary = {
  status: failed.length ? 'FAIL' : 'PASS',
  durationMs: Date.now() - startedAt,
  steps,
};

console.log('\n=== Q8–Q10 quality summary ===');
console.log(`status: ${summary.status}`);
console.log(`durationMs: ${summary.durationMs}`);
for (const s of steps) console.log(`- ${s.ok ? 'pass' : 'fail'}: ${s.name} (${s.durationMs}ms)`);

try {
  fs.mkdirSync(path.join(root, '.zavorth'), { recursive: true });
  fs.writeFileSync(path.join(root, '.zavorth', 'q8-q10-quality-last.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log('[info] wrote .zavorth/q8-q10-quality-last.json');
} catch {
  // ignore
}

if (failed.length) {
  console.error(`\n[fail] Q8–Q10 — ${failed.length} step(s) failed`);
  process.exit(1);
}
console.log('\n[pass] Q8–Q10 quality complete');
process.exit(0);
