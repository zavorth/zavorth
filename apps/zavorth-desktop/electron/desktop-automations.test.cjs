const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  buildAutomationHistoryLogs,
  createAutomationSweepRunner,
  createDesktopAutomationStore,
} = require('./desktop-automations.cjs');

function withStore(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-automations-'));
  const filePath = path.join(root, 'automations.json');
  let timestamp = 1_700_000_000_000;
  const store = createDesktopAutomationStore({
    filePath,
    now: () => timestamp,
    idFactory: () => 'task-1',
  });
  return Promise.resolve(run({ root, filePath, store, advance: ms => { timestamp += ms; } })).finally(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });
}

test('writes valid state atomically without leaving temporary files', async () => withStore(({ root, filePath, store }) => {
  store.createTask({ name: 'Daily brief', prompt: 'Summarize', intervalMinutes: 60 });
  const state = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(state.tasks[0].name, 'Daily brief');
  assert.deepEqual(fs.readdirSync(root).filter(name => name.endsWith('.tmp')), []);
}));

test('new tasks are due immediately without waiting a full interval', async () => withStore(({ store }) => {
  const task = store.createTask({ name: 'Daily brief', prompt: 'Summarize', intervalMinutes: 60 });
  assert.equal(task.nextRun, task.createdAt);
  assert.equal(store.getDueTasks().length, 1);
}));

test('running tasks are not returned as due and are recovered after restart', async () => withStore(({ store, advance }) => {
  const task = store.createTask({ name: 'Daily brief', prompt: 'Summarize', intervalMinutes: 1 });
  assert.equal(store.getDueTasks().length, 1);
  store.markRunning(task.id, 'automation-session');
  assert.equal(store.getDueTasks().length, 0);
  const recovered = store.recoverRunningTasks();
  assert.equal(recovered[0].status, 'failed');
  assert.match(recovered[0].history.at(-1).message, /interrompida/i);
  advance(60_001);
  assert.equal(store.getDueTasks().some(item => item.id === task.id), true);
}));

test('re-enabled tasks become due immediately', async () => withStore(({ store, advance }) => {
  const task = store.createTask({ name: 'Daily brief', prompt: 'Summarize', intervalMinutes: 60 });
  store.toggleTask(task.id, false);
  assert.equal(store.getDueTasks().length, 0);
  advance(5_000);
  const enabled = store.toggleTask(task.id, true);
  assert.equal(enabled.enabled, true);
  assert.equal(store.getDueTasks().length, 1);
}));

test('automation sweep is single-flight while a prior sweep is running', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let runs = 0;
  const sweep = createAutomationSweepRunner({
    getDueTasks: () => [{ id: 'task-1' }],
    runTask: async () => {
      runs += 1;
      await gate;
    },
  });
  const first = sweep();
  const second = sweep();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(runs, 1);
  release();
  await Promise.all([first, second]);
  assert.equal(runs, 1);
});

test('local history supplies logs when the runtime has no materialized session', () => {
  const logs = buildAutomationHistoryLogs([{
    id: 'task-1',
    lastSessionId: 'automation-task-1',
    history: [{
      at: '2026-07-10T12:00:00.000Z',
      ok: true,
      sessionId: 'automation-task-1',
      message: 'Brief generated',
    }],
  }], 'automation-task-1');
  assert.equal(logs.length, 1);
  assert.equal(logs[0].content, 'Brief generated');
  assert.equal(logs[0].source, 'desktop-automation-history');
});
