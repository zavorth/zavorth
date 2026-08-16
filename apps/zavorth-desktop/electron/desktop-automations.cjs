const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const STORE_VERSION = 1;

function defaultNow() {
  return Date.now();
}

function defaultIdFactory() {
  return `task_${crypto.randomUUID()}`;
}

function normalizeTask(task) {
  return {
    id: String(task.id || defaultIdFactory()),
    name: String(task.name || 'Untitled automation'),
    project: String(task.project || 'local'),
    prompt: String(task.prompt || ''),
    intervalMinutes: Math.max(1, Number(task.intervalMinutes || 60)),
    enabled: task.enabled !== false,
    status: ['idle', 'running', 'success', 'failed'].includes(task.status) ? task.status : 'idle',
    nextRun: Number(task.nextRun || 0) || undefined,
    lastRun: Number(task.lastRun || 0) || undefined,
    lastSessionId: task.lastSessionId ? String(task.lastSessionId) : undefined,
    workspace: task.workspace && typeof task.workspace === 'object' ? task.workspace : undefined,
    model: task.model ? String(task.model) : undefined,
    profile: task.profile ? String(task.profile) : undefined,
    effort: task.effort ? String(task.effort) : undefined,
    createdAt: Number(task.createdAt || 0) || undefined,
    updatedAt: Number(task.updatedAt || 0) || undefined,
    history: Array.isArray(task.history) ? task.history.slice(-30) : [],
  };
}

function createDesktopAutomationStore(options = {}) {
  const filePath = options.filePath;
  if (!filePath) {
    throw new Error('filePath is required.');
  }
  const now = options.now || defaultNow;
  const idFactory = options.idFactory || defaultIdFactory;

  function readState() {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        version: STORE_VERSION,
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks.map(normalizeTask) : [],
      };
    } catch {
      return { version: STORE_VERSION, tasks: [] };
    }
  }

  function writeState(state) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const safeState = {
      version: STORE_VERSION,
      tasks: state.tasks.map(normalizeTask),
    };
    const temporaryPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporaryPath, `${JSON.stringify(safeState, null, 2)}\n`, 'utf8');
      fs.renameSync(temporaryPath, filePath);
    } finally {
      fs.rmSync(temporaryPath, { force: true });
    }
    return safeState;
  }

  function listTasks() {
    return readState().tasks;
  }

  function replaceTask(taskId, updater) {
    const state = readState();
    let updatedTask = null;
    const tasks = state.tasks.map(task => {
      if (task.id !== taskId) return task;
      updatedTask = normalizeTask(updater(task));
      return updatedTask;
    });
    writeState({ ...state, tasks });
    return updatedTask;
  }

  function createTask(input) {
    const createdAt = now();
    const intervalMinutes = Math.max(1, Number(input.intervalMinutes || 60));
    const task = normalizeTask({
      ...input,
      id: idFactory(),
      enabled: true,
      status: 'idle',
      createdAt,
      updatedAt: createdAt,
      nextRun: createdAt + intervalMinutes * 60000,
      history: [],
    });
    const state = readState();
    writeState({ ...state, tasks: [...state.tasks, task] });
    return task;
  }

  function deleteTask(taskId) {
    const state = readState();
    const tasks = state.tasks.filter(task => task.id !== taskId);
    writeState({ ...state, tasks });
    return tasks.length !== state.tasks.length;
  }

  function toggleTask(taskId, enabled) {
    return replaceTask(taskId, task => {
      const updatedAt = now();
      const isEnabled = Boolean(enabled);
      return {
        ...task,
        enabled: isEnabled,
        status: 'idle',
        updatedAt,
        nextRun: isEnabled ? updatedAt : undefined,
      };
    });
  }

  function getDueTasks() {
    const timestamp = now();
    return listTasks().filter(task => (
      task.enabled &&
      task.status !== 'running' &&
      Number(task.nextRun || 0) > 0 &&
      Number(task.nextRun) <= timestamp
    ));
  }

  function markRunning(taskId, sessionId) {
    return replaceTask(taskId, task => ({
      ...task,
      status: 'running',
      lastRun: now(),
      lastSessionId: sessionId,
      updatedAt: now(),
    }));
  }

  function markCompleted(taskId, result) {
    return replaceTask(taskId, task => {
      const completedAt = now();
      const historyEntry = {
        at: new Date(completedAt).toISOString(),
        ok: Boolean(result.ok),
        sessionId: result.sessionId || task.lastSessionId || null,
        message: result.message || null,
      };
      return {
        ...task,
        status: result.ok ? 'success' : 'failed',
        lastSessionId: result.sessionId || task.lastSessionId,
        nextRun: completedAt + task.intervalMinutes * 60000,
        updatedAt: completedAt,
        history: [...task.history, historyEntry].slice(-30),
      };
    });
  }

  function recoverRunningTasks() {
    const state = readState();
    const recoveredAt = now();
    let changed = false;
    const tasks = state.tasks.map(task => {
      if (task.status !== 'running') return task;
      changed = true;
      return normalizeTask({
        ...task,
        status: 'failed',
        nextRun: task.enabled ? recoveredAt + task.intervalMinutes * 60000 : undefined,
        updatedAt: recoveredAt,
        history: [
          ...task.history,
          {
            at: new Date(recoveredAt).toISOString(),
            ok: false,
            sessionId: task.lastSessionId || null,
            message: 'Execution interrupted by application shutdown.',
          },
        ].slice(-30),
      });
    });
    if (changed) writeState({ ...state, tasks });
    return tasks;
  }

  return {
    listTasks,
    createTask,
    deleteTask,
    toggleTask,
    getDueTasks,
    markRunning,
    markCompleted,
    recoverRunningTasks,
  };
}

function createAutomationSweepRunner(options = {}) {
  if (typeof options.getDueTasks !== 'function' || typeof options.runTask !== 'function') {
    throw new Error('getDueTasks and runTask are required.');
  }
  let activeSweep = null;
  return async function runSweep() {
    if (activeSweep) return activeSweep;
    activeSweep = (async () => {
      const due = await options.getDueTasks();
      for (const task of due) await options.runTask(task.id);
    })();
    try {
      await activeSweep;
    } finally {
      activeSweep = null;
    }
  };
}

function buildAutomationHistoryLogs(tasks, sessionId) {
  const safeSessionId = String(sessionId || '');
  const task = (Array.isArray(tasks) ? tasks : []).find(item => (
    item.lastSessionId === safeSessionId
    || item.history?.some(entry => entry.sessionId === safeSessionId)
  ));
  return (task?.history || [])
    .filter(entry => !safeSessionId || entry.sessionId === safeSessionId)
    .map((entry, index) => ({
      id: `automation-history-${task.id}-${index}`,
      role: 'system',
      content: entry.message || (entry.ok ? 'Automation completed.' : 'Automation failed.'),
      createdAt: entry.at,
      sessionId: entry.sessionId || safeSessionId,
      source: 'desktop-automation-history',
      ok: Boolean(entry.ok),
    }));
}

module.exports = {
  buildAutomationHistoryLogs,
  createDesktopAutomationStore,
  createAutomationSweepRunner,
};
