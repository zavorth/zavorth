#!/usr/bin/env node
/**
 * Record credentialed live cells for launch residual (LR-CELLS).
 * Without --live: writes skipped cells honestly.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const live = process.argv.includes('--live')
  || process.env.ZAVORTH_LIVE_SMARTNESS === '1'
  || process.env.ZAVORTH_LIVE_SMARTNESS === 'true';
const asJson = process.argv.includes('--json');
const tsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');

function runTsx(script, args = []) {
  return spawnSync(process.execPath, [tsx, path.join(root, script), ...args], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
    windowsHide: true,
    timeout: 300000,
  });
}

const cells = [];
const generatedAt = new Date().toISOString();

/** Detect rate-limit / quota exhaustion signals in free-form notes + evidence. */
function looksLike429(text) {
  const s = String(text || '');
  return (
    /\b429\b/.test(s)
    || /too many requests/i.test(s)
    || /RESOURCE_EXHAUSTED/i.test(s)
    || /rate[- ]?limit/i.test(s)
    || /quota exceeded/i.test(s)
    || /exceeded your current quota/i.test(s)
  );
}

function evidenceBlob(evidence) {
  if (!evidence || typeof evidence !== 'object') return '';
  try {
    return JSON.stringify(evidence);
  } catch {
    return String(evidence.outputPreview || evidence.message || '');
  }
}

/**
 * If multi-step (or any cell) failed due to 429/quota, rewrite notes honestly:
 * recommend alternate provider/key — never greenwash as "tool call missing" alone.
 */
function enrichRateLimitNotes(cell) {
  if (!cell || cell.status === 'pass' || cell.status === 'skipped') return cell;
  const blob = `${cell.notes || ''}\n${evidenceBlob(cell.evidence)}`;
  if (!looksLike429(blob)) return cell;
  const advice =
    'Rate limited / quota exhausted (429). '
    + 'Retry with an alternate provider or API key '
    + '(e.g. OPENAI_API_KEY / ANTHROPIC_API_KEY / different Gemini project). '
    + 'Do not treat this as multi-step pass.';
  const base = String(cell.notes || '').trim();
  // Avoid duplicating if harness already appended similar advice.
  if (/alternate provider|quota exhausted|rate limited/i.test(base)) {
    return { ...cell, rateLimited: true };
  }
  return {
    ...cell,
    rateLimited: true,
    notes: base ? `${base} — ${advice}` : advice,
  };
}

if (!live) {
  cells.push({
    id: 'live.llm.probe',
    status: 'skipped',
    live: false,
    notes: 'Pass --live with provider keys to record credentialed cells.',
  });
  cells.push({
    id: 'live.multi-step.tool-plan',
    status: 'skipped',
    live: false,
    notes: 'Pass --live with provider keys to record credentialed cells.',
  });
  cells.push({
    id: 'killer.audiences',
    status: 'skipped',
    live: false,
    notes: 'Pass --live to execute killer missions for all audiences.',
  });
} else {
  // --check ensures non-zero exit when live fails; never invent pass from bare exit 0.
  const smartness = runTsx('scripts/agent-smartness-live-run.ts', ['--live', '--json', '--check', '--allow-blocked']);
  let smartnessReport = null;
  try {
    smartnessReport = JSON.parse(smartness.stdout || '{}');
  } catch {
    smartnessReport = null;
  }
  const liveRows = Array.isArray(smartnessReport?.live) ? smartnessReport.live : [];
  for (const row of liveRows) {
    cells.push(enrichRateLimitNotes({
      id: row.id,
      status: row.status,
      live: true,
      notes: row.notes,
      evidence: row.evidence || {},
      claimsLiveIntelligence: Boolean(smartnessReport?.claimsLiveIntelligence),
    }));
  }
  if (!liveRows.length) {
    cells.push({
      id: 'live.smartness',
      status: 'fail',
      live: true,
      notes: 'Missing structured live[] report from agent-smartness-live-run — fail closed.',
    });
  }

  const killer = runTsx('scripts/killer-missions-run.ts', ['--execute', '--live', '--json']);
  let killerReport = null;
  try {
    killerReport = JSON.parse(killer.stdout || '{}');
  } catch {
    killerReport = null;
  }
  const receipts = Array.isArray(killerReport?.receipts) ? killerReport.receipts : [];
  if (receipts.length) {
    for (const receipt of receipts) {
      cells.push(enrichRateLimitNotes({
        id: `killer.${receipt.missionId}`,
        status: receipt.status,
        live: true,
        notes: receipt.notes,
        audience: receipt.audience,
        providerId: receipt.providerId,
        signalsMatched: receipt.signalsMatched,
      }));
    }
  } else {
    cells.push(enrichRateLimitNotes({
      id: 'killer.audiences',
      status: killer.status === 0 ? 'pass' : 'fail',
      live: true,
      notes: (killer.stderr || killer.stdout || 'killer execute failed').slice(0, 400),
    }));
  }
}

// Keep historical passes for audit, but current status always reflects latest attempt.
// Exit code uses latestAttempt so a real fail is never masked by a prior pass.
const primaryPath = path.join(root, '.zavorth', 'launch-live-cells.json');
let priorCells = [];
try {
  if (fs.existsSync(primaryPath)) {
    const prior = JSON.parse(fs.readFileSync(primaryPath, 'utf8'));
    priorCells = Array.isArray(prior.cells) ? prior.cells : [];
  }
} catch {
  priorCells = [];
}
const historyById = new Map();
for (const cell of priorCells) {
  if (cell && cell.id) historyById.set(cell.id, cell);
}
const mergedCells = cells.map((cell) => {
  const previous = historyById.get(cell.id);
  if (previous?.status === 'pass' && cell.status !== 'pass') {
    return {
      ...cell,
      priorPass: {
        generatedAt: previous.generatedAt || null,
        notes: previous.notes,
        evidence: previous.evidence || null,
      },
      notes: `${cell.notes} (prior pass retained in history only; latest status=${cell.status})`,
    };
  }
  return cell;
});
// Also keep prior cells not re-run this session (audit trail), marked stale.
for (const [id, previous] of historyById.entries()) {
  if (!mergedCells.some((c) => c.id === id)) {
    mergedCells.push({
      ...previous,
      stale: true,
      notes: `${previous.notes || ''} (stale: not re-run this session)`.trim(),
    });
  }
}

const report = {
  generatedAt,
  version: 'launch-live-cells/v2',
  liveRequested: live,
  claimsLiveIntelligence: cells.some(
    (cell) => cell.id === 'live.multi-step.tool-plan' && cell.status === 'pass',
  ),
  cells: mergedCells,
  latestAttempt: cells,
  summary: {
    pass: cells.filter((c) => c.status === 'pass').length,
    fail: cells.filter((c) => c.status === 'fail').length,
    blocked: cells.filter((c) => c.status === 'blocked').length,
    skipped: cells.filter((c) => c.status === 'skipped').length,
  },
};

const outDir = path.join(root, '.zavorth');
const outData = path.join(root, 'data', 'product');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(outData, { recursive: true });
const primary = primaryPath;
const secondary = path.join(outData, 'launch-live-cells.json');
fs.writeFileSync(primary, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
fs.writeFileSync(secondary, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (asJson) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write('Zavorth launch live cells\n');
  process.stdout.write(`liveRequested: ${live ? 'yes' : 'no'}\n`);
  process.stdout.write(
    `pass=${report.summary.pass} fail=${report.summary.fail} blocked=${report.summary.blocked} skipped=${report.summary.skipped}\n`,
  );
  for (const cell of cells) {
    process.stdout.write(`- [${cell.status}] ${cell.id}: ${cell.notes}\n`);
  }
  process.stdout.write(`\nwrote ${path.relative(root, primary)}\n`);
}

const latestFail = live && (
  cells.some((c) => c.status === 'fail' || c.status === 'blocked')
  || !cells.some((c) => c.id === 'live.multi-step.tool-plan' && c.status === 'pass')
);
process.exit(latestFail ? 1 : 0);
