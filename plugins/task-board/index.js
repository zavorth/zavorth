const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const COLUMNS = ['backlog', 'doing', 'blocked', 'done'];

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();
  const storePath = path.join(workspace, '.zavorth', 'task-board', 'board.json');

  function ensureStore() {
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(storePath)) {
      fs.writeFileSync(
        storePath,
        `${JSON.stringify({ version: 1, tasks: [], updatedAt: new Date().toISOString() }, null, 2)}\n`,
        'utf8',
      );
    }
  }

  function readBoard() {
    try {
      ensureStore();
      const raw = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      const tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
      return { version: 1, tasks, updatedAt: raw.updatedAt || null };
    } catch {
      return { version: 1, tasks: [], updatedAt: null };
    }
  }

  function writeBoard(board) {
    ensureStore();
    board.updatedAt = new Date().toISOString();
    fs.writeFileSync(storePath, `${JSON.stringify(board, null, 2)}\n`, 'utf8');
  }

  function normalizeColumn(value) {
    const col = String(value || 'backlog').toLowerCase().trim();
    return COLUMNS.includes(col) ? col : 'backlog';
  }

  function counts(tasks) {
    const out = { backlog: 0, doing: 0, blocked: 0, done: 0 };
    for (const task of tasks) {
      const col = normalizeColumn(task.column);
      out[col] = (out[col] || 0) + 1;
    }
    return out;
  }

  ctx.bindCapability('task.status', async () => {
    try {
      const board = readBoard();
      return {
        output: {
          ok: true,
          storePath,
          total: board.tasks.length,
          counts: counts(board.tasks),
          columns: COLUMNS,
          updatedAt: board.updatedAt,
        },
        artifacts: [storePath],
      };
    } catch (error) {
      logger.warn('task.status failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return softFail(error);
    }
  });

  ctx.bindCapability('task.list', async ({ input }) => {
    try {
      const board = readBoard();
      const limit = Math.max(1, Math.min(200, Number((input && input.limit) || 50) || 50));
      const column = input && input.column ? normalizeColumn(input.column) : null;
      let tasks = board.tasks.slice();
      if (column) {
        tasks = tasks.filter((t) => normalizeColumn(t.column) === column);
      }
      // Active work first
      const order = { doing: 0, blocked: 1, backlog: 2, done: 3 };
      tasks.sort((a, b) => (order[normalizeColumn(a.column)] ?? 9) - (order[normalizeColumn(b.column)] ?? 9));
      tasks = tasks.slice(0, limit);
      return {
        output: {
          ok: true,
          tasks,
          count: tasks.length,
          filter: column,
          storePath,
        },
        artifacts: [storePath],
      };
    } catch (error) {
      logger.warn('task.list failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return softFail(error, { tasks: [] });
    }
  });

  ctx.bindCapability('task.add', async ({ input }) => {
    try {
      const title = String((input && (input.title || input.text || input.summary)) || '').trim();
      if (!title) {
        return { output: { ok: false, message: 'title is required' } };
      }
      const board = readBoard();
      const task = {
        id: randomUUID(),
        title: title.slice(0, 500),
        column: normalizeColumn(input && input.column),
        priority: String((input && input.priority) || 'medium').toLowerCase(),
        tags: Array.isArray(input && input.tags) ? input.tags.map(String).slice(0, 20) : [],
        notes: String((input && (input.notes || input.body)) || '').slice(0, 4000),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      board.tasks.unshift(task);
      writeBoard(board);
      return {
        output: { ok: true, task, counts: counts(board.tasks), storePath },
        artifacts: [storePath],
        receipts: ['task-board.receipt'],
      };
    } catch (error) {
      logger.warn('task.add failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return softFail(error);
    }
  });

  ctx.bindCapability('task.move', async ({ input }) => {
    try {
      const id = String((input && (input.id || input.taskId)) || '').trim();
      const column = normalizeColumn(input && input.column);
      if (!id) {
        return { output: { ok: false, message: 'id is required' } };
      }
      const board = readBoard();
      const task = board.tasks.find((t) => t.id === id);
      if (!task) {
        return { output: { ok: false, message: `task not found: ${id}` } };
      }
      task.column = column;
      task.updatedAt = new Date().toISOString();
      writeBoard(board);
      return {
        output: { ok: true, task, counts: counts(board.tasks) },
        artifacts: [storePath],
        receipts: ['task-board.receipt'],
      };
    } catch (error) {
      logger.warn('task.move failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return softFail(error);
    }
  });

  ctx.bindCapability('task.complete', async ({ input }) => {
    try {
      const id = String((input && (input.id || input.taskId)) || '').trim();
      if (!id) {
        return { output: { ok: false, message: 'id is required' } };
      }
      const board = readBoard();
      const task = board.tasks.find((t) => t.id === id);
      if (!task) {
        return { output: { ok: false, message: `task not found: ${id}` } };
      }
      task.column = 'done';
      task.updatedAt = new Date().toISOString();
      task.completedAt = task.updatedAt;
      writeBoard(board);
      return {
        output: { ok: true, task, counts: counts(board.tasks) },
        artifacts: [storePath],
        receipts: ['task-board.receipt'],
      };
    } catch (error) {
      logger.warn('task.complete failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return softFail(error);
    }
  });

  logger.info('task-board registered', { workspace, storePath });
}

function softFail(error, extra = {}) {
  return {
    output: {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      ...extra,
    },
  };
}

module.exports = { register };
