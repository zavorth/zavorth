const fs = require('node:fs');
const path = require('node:path');

const LEDGER_DIR_NAME = path.join('.zavorth', 'session-scratch-janitor');
const LEDGER_FILE = 'ledger.jsonl';
const MAX_LEDGER_LINES = 2000;

const NAME_HINTS = [
  /^scratch[-_.]/i,
  /^tmp[-_.]/i,
  /^temp[-_.]/i,
  /^zavorth-ephemeral[-_.]/i,
  /\.tmp$/i,
  /\.scratch$/i,
  /\.bak$/i,
];

function createJanitor(workspacePath) {
  const workspaceRoot = path.resolve(workspacePath || process.cwd());
  const ledgerDir = path.join(workspaceRoot, LEDGER_DIR_NAME);
  const ledgerPath = path.join(ledgerDir, LEDGER_FILE);
  const allowedRoots = [
    path.join(workspaceRoot, '.zavorth', 'scratch'),
    path.join(workspaceRoot, 'data', 'temp'),
    path.join(workspaceRoot, 'tmp'),
    path.join(workspaceRoot, 'temp'),
  ].map((entry) => path.resolve(entry));

  function ensureLedgerDir() {
    fs.mkdirSync(ledgerDir, { recursive: true });
  }

  function isInside(parent, candidate) {
    const relative = path.relative(parent, candidate);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  }

  function isAllowlisted(targetPath) {
    const resolved = path.resolve(targetPath);
    if (isInside(ledgerDir, resolved)) {
      return false;
    }
    return allowedRoots.some((root) => isInside(root, resolved));
  }

  function looksEphemeral(targetPath) {
    const base = path.basename(targetPath);
    if (NAME_HINTS.some((pattern) => pattern.test(base))) {
      return true;
    }
    const parent = path.basename(path.dirname(targetPath)).toLowerCase();
    return parent === 'scratch' || parent === 'temp' || parent === 'tmp';
  }

  function appendLedger(entry) {
    ensureLedgerDir();
    const line = JSON.stringify({
      ...entry,
      at: entry.at || new Date().toISOString(),
    });
    fs.appendFileSync(ledgerPath, `${line}\n`, 'utf8');
    trimLedgerIfNeeded();
  }

  function trimLedgerIfNeeded() {
    if (!fs.existsSync(ledgerPath)) {
      return;
    }
    const lines = fs.readFileSync(ledgerPath, 'utf8').split(/\r?\n/).filter(Boolean);
    if (lines.length <= MAX_LEDGER_LINES) {
      return;
    }
    const kept = lines.slice(lines.length - MAX_LEDGER_LINES);
    fs.writeFileSync(ledgerPath, `${kept.join('\n')}\n`, 'utf8');
  }

  function readLedger() {
    if (!fs.existsSync(ledgerPath)) {
      return [];
    }
    try {
      return fs.readFileSync(ledgerPath, 'utf8')
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  function extractCandidatePaths(context) {
    const bag = [];
    const visit = (value, depth = 0) => {
      if (depth > 4 || value == null) {
        return;
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return;
        if (
          trimmed.includes('/')
          || trimmed.includes('\\')
          || /\.(tmp|scratch|bak|log|txt|json)$/i.test(trimmed)
        ) {
          bag.push(trimmed);
        }
        return;
      }
      if (Array.isArray(value)) {
        for (const item of value.slice(0, 40)) visit(item, depth + 1);
        return;
      }
      if (typeof value === 'object') {
        for (const [key, item] of Object.entries(value)) {
          if (/path|file|output|target|dest|destination|artifact/i.test(key)) {
            visit(item, depth + 1);
          }
        }
      }
    };
    visit(context);
    return Array.from(new Set(bag));
  }

  function observeToolContext(context = {}) {
    const candidates = extractCandidatePaths(context);
    const tracked = [];
    for (const candidate of candidates) {
      const resolved = path.isAbsolute(candidate)
        ? path.resolve(candidate)
        : path.resolve(workspaceRoot, candidate);
      if (!isAllowlisted(resolved)) {
        continue;
      }
      if (!looksEphemeral(resolved)) {
        continue;
      }
      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        continue;
      }
      const entry = {
        kind: 'track',
        path: resolved,
        toolName: context.toolName || context.tool || context.name || null,
        bytes: fs.statSync(resolved).size,
      };
      appendLedger(entry);
      tracked.push(entry.path);
    }
    return { tracked, candidates: candidates.length };
  }

  function listActiveTracks() {
    const byPath = new Map();
    for (const entry of readLedger()) {
      if (!entry || typeof entry.path !== 'string') continue;
      if (entry.kind === 'forget' || entry.kind === 'deleted') {
        byPath.delete(entry.path);
        continue;
      }
      if (entry.kind === 'track') {
        byPath.set(entry.path, entry);
      }
    }
    return Array.from(byPath.values()).filter((entry) => {
      try {
        return fs.existsSync(entry.path) && isAllowlisted(entry.path);
      } catch {
        return false;
      }
    });
  }

  function buildStatus() {
    const active = listActiveTracks();
    const totalBytes = active.reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
    return {
      workspaceRoot,
      ledgerPath,
      allowedRoots,
      activeCount: active.length,
      totalBytes,
      active: active.map((entry) => ({
        path: entry.path,
        bytes: entry.bytes || 0,
        toolName: entry.toolName || null,
        at: entry.at || null,
      })),
    };
  }

  function sweep(options = {}) {
    const apply = options.apply === true;
    const active = listActiveTracks();
    const planned = [];
    const deleted = [];
    const failed = [];

    for (const entry of active) {
      const target = entry.path;
      if (!isAllowlisted(target) || !looksEphemeral(target)) {
        failed.push({ path: target, reason: 'path rejected by safety rules' });
        continue;
      }
      planned.push(target);
      if (!apply) {
        continue;
      }
      try {
        if (fs.existsSync(target)) {
          fs.unlinkSync(target);
        }
        appendLedger({ kind: 'deleted', path: target, apply: true });
        deleted.push(target);
      } catch (error) {
        failed.push({
          path: target,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const receipt = {
      at: new Date().toISOString(),
      mode: apply ? 'apply' : 'dry-run',
      plannedCount: planned.length,
      deletedCount: deleted.length,
      failedCount: failed.length,
      planned,
      deleted,
      failed,
    };
    appendLedger({ kind: 'sweep', ...receipt });
    return receipt;
  }

  function forget(targetPath) {
    const resolved = path.resolve(targetPath);
    appendLedger({ kind: 'forget', path: resolved });
    return { forgot: resolved };
  }

  return {
    workspaceRoot,
    ledgerPath,
    allowedRoots,
    observeToolContext,
    buildStatus,
    sweep,
    forget,
    isAllowlisted,
    looksEphemeral,
  };
}

module.exports = {
  createJanitor,
};
