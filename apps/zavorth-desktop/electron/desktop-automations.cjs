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
    project: String(task.project || 'Local'),
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
    fs.writeFileSync(filePath, `${JSON.stringify(safeState, null, 2)}\n`, 'utf8');
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
    const task = normalizeTask({
      ...input,
      id: idFactory(),
      enabled: true,
      status: 'idle',
      createdAt,
      updatedAt: createdAt,
      nextRun: createdAt + Math.max(1, Number(input.intervalMinutes || 60)) * 60000,
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
        nextRun: isEnabled ? updatedAt + task.intervalMinutes * 60000 : undefined,
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

  return {
    listTasks,
    createTask,
    deleteTask,
    toggleTask,
    getDueTasks,
    markRunning,
    markCompleted,
  };
}

module.exports = {
  createDesktopAutomationStore,
};
