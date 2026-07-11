const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  bridgePaths,
  getCodeBridgeSummary,
  startCodeBridgeHeartbeat,
  stopCodeBridgeHeartbeat,
} = require('./code-bridge.cjs');

function withTemporaryHome(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-code-bridge-'));
  const env = { ZAVORTH_HOME: root };
  return Promise.resolve(run({ root, env })).finally(() => {
    stopCodeBridgeHeartbeat();
    fs.rmSync(root, { recursive: true, force: true });
  });
}

test('heartbeat publishes Desktop presence and summary reads Code state', async () => withTemporaryHome(async ({ env }) => {
  const paths = bridgePaths(env);
  fs.mkdirSync(paths.stateDir, { recursive: true });
  fs.writeFileSync(paths.ops, JSON.stringify({
    updatedAt: Date.now(),
    ready: true,
    headline: 'Code bridge operational',
    checks: [{ id: 'runtime', label: 'Runtime', ok: true }],
  }));

  await startCodeBridgeHeartbeat({ name: 'Desktop test', intervalMs: 60_000 }, env);
  const summary = await getCodeBridgeSummary(env);

  assert.equal(summary.label, 'Code ready');
  assert.equal(summary.opsFresh, true);
  assert.equal(summary.companionStatus.online, true);
  assert.equal(summary.companionStatus.name, 'Desktop test');
}));

test('stopping heartbeat writes an offline presence immediately', async () => withTemporaryHome(async ({ env }) => {
  await startCodeBridgeHeartbeat({ name: 'Desktop test', intervalMs: 60_000 }, env);
  stopCodeBridgeHeartbeat();
  const summary = await getCodeBridgeSummary(env);
  assert.equal(summary.companionStatus.online, false);
}));
