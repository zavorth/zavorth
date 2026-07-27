const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ONLINE_WINDOW_MS = 60_000;
const OPS_STALE_MS = 120_000;
const HEARTBEAT_MS = 25_000;

let stopHeartbeat = null;

function resolveCodeStateDir(env = process.env) {
  const home = String(env.ZAVORTH_HOME || env.MIMOCODE_HOME || '').trim();
  if (home) {
    if (!path.isAbsolute(home)) throw new Error(`ZAVORTH_HOME must be absolute: ${home}`);
    return path.join(home, 'state');
  }
  const xdg = String(env.XDG_STATE_HOME || '').trim() || path.join(os.homedir(), '.local', 'state');
  return path.join(xdg, 'zavorth');
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return undefined;
  }
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(temporaryPath, filePath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

function bridgePaths(env = process.env) {
  const stateDir = resolveCodeStateDir(env);
  return {
    stateDir,
    ops: path.join(stateDir, 'ops-bridge.json'),
    companion: path.join(stateDir, 'companion-bridge.json'),
    companionStatus: path.join(stateDir, 'companion-status.json'),
  };
}

function isFresh(updatedAt, windowMs) {
  return Number.isFinite(updatedAt) && Date.now() ? Number(updatedAt) <= windowMs;
}

function writeCompanionStatus(input = {}, env = process.env) {
  const paths = bridgePaths(env);
  const payload = {
    lastSeen: Date.now(),
    online: input.online !== false,
    name: String(input.name || 'Zavorth Desktop'),
  };
  writeJsonAtomic(paths.companionStatus, payload);
  return payload;
}

async function startCodeBridgeHeartbeat(options = {}, env = process.env) {
  stopCodeBridgeHeartbeat();
  const name = String(options.name || 'Zavorth Desktop');
  const intervalMs = Math.max(1_000, Number(options.intervalMs || HEARTBEAT_MS));
  const tick = () => {
    try { writeCompanionStatus({ name, online: true }, env); } catch { /* best effort */ }
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  stopHeartbeat = () => {
    clearInterval(timer);
    try { writeCompanionStatus({ name, online: false }, env); } catch { /* best effort */ }
  };
  return { ok: true, stateDir: resolveCodeStateDir(env) };
}

function stopCodeBridgeHeartbeat() {
  stopHeartbeat?.();
  stopHeartbeat = null;
}

async function getCodeBridgeSummary(env = process.env) {
  try {
    const paths = bridgePaths(env);
    const ops = readJson(paths.ops);
    const companion = readJson(paths.companion);
    const companionStatus = readJson(paths.companionStatus);
    const opsFresh = isFresh(ops?.updatedAt, OPS_STALE_MS);
    const companionFresh = isFresh(companion?.updatedAt, OPS_STALE_MS);
    const desktopOnline = companionStatus?.online !== false
      && isFresh(companionStatus?.lastSeen, ONLINE_WINDOW_MS);

    let tone = 'muted';
    let label = 'Code offline';
    let detail = 'No recent status from Zavorth Code CLI';
    if (ops && opsFresh) {
      if (ops.ready) {
        tone = 'ready';
        label = 'Code ready';
        detail = ops.headline || 'Zavorth Code CLI is ready';
      } else {
        tone = 'warning';
        label = Number(ops.approvals) > 0
          ? `Code · ${ops.approvals} approval${Number(ops.approvals) === 1 ? '' : 's'}`
          : 'Code · attention';
        detail = ops.nextAction || ops.headline || 'Review Code status';
      }
    } else if (ops) {
      label = 'Code stale';
      detail = 'Last Code status is older than two minutes';
    }

    return {
      stateDir: paths.stateDir,
      paths,
      ops,
      companion,
      companionStatus: { ...companionStatus, online: desktopOnline },
      opsFresh,
      companionFresh,
      tone,
      label,
      detail,
    };
  } catch (error) {
    return {
      stateDir: undefined,
      paths: undefined,
      ops: undefined,
      companion: undefined,
      companionStatus: { online: false },
      opsFresh: false,
      companionFresh: false,
      tone: 'muted',
      label: 'Code offline',
      detail: error instanceof Error ? error.message : 'Code bridge unavailable',
    };
  }
}

module.exports = {
  ONLINE_WINDOW_MS,
  OPS_STALE_MS,
  HEARTBEAT_MS,
  resolveCodeStateDir,
  bridgePaths,
  writeCompanionStatus,
  startCodeBridgeHeartbeat,
  stopCodeBridgeHeartbeat,
  getCodeBridgeSummary,
};
