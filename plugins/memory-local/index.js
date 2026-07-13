const fs = require('node:fs');
const path = require('node:path');

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();
  const storeDir = path.join(workspace, '.zavorth', 'memory-local');
  const storePath = path.join(storeDir, 'store.json');

  function ensureStore() {
    if (!fs.existsSync(storeDir)) {
      fs.mkdirSync(storeDir, { recursive: true });
    }
    if (!fs.existsSync(storePath)) {
      fs.writeFileSync(storePath, JSON.stringify({ version: 1, entries: {} }, null, 2), 'utf8');
    }
  }

  function readStore() {
    ensureStore();
    try {
      const raw = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      if (!raw || typeof raw !== 'object') {
        return { version: 1, entries: {} };
      }
      if (!raw.entries || typeof raw.entries !== 'object') {
        raw.entries = {};
      }
      return raw;
    } catch {
      return { version: 1, entries: {} };
    }
  }

  function writeStore(store) {
    ensureStore();
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
  }

  async function writeEntry(input) {
    const key = String((input && input.key) || '').trim();
    if (!key) {
      return { ok: false, reason: 'key is required' };
    }
    const store = readStore();
    const tags = Array.isArray(input && input.tags)
      ? input.tags.map(String)
      : [];
    store.entries[key] = {
      key,
      value: input ? input.value : null,
      tags,
      updatedAt: new Date().toISOString(),
    };
    writeStore(store);
    return { ok: true, key, value: store.entries[key].value, tags, storePath };
  }

  async function getEntry(input) {
    const key = String((input && input.key) || '').trim();
    const store = readStore();
    if (!key) {
      return { ok: false, reason: 'key is required', value: null };
    }
    const entry = store.entries[key] || null;
    return {
      ok: true,
      key,
      value: entry ? entry.value : null,
      tags: entry ? entry.tags || [] : [],
      found: Boolean(entry),
    };
  }

  async function searchEntries(input) {
    const query = String((input && (input.query || input.q || input.text)) || '').trim().toLowerCase();
    const limit = Math.max(1, Math.min(100, Number((input && input.limit) || 20) || 20));
    const store = readStore();
    const all = Object.values(store.entries || {});
    const matched = !query
      ? all
      : all.filter((entry) => {
        const blob = [
          entry.key,
          JSON.stringify(entry.value),
          ...(Array.isArray(entry.tags) ? entry.tags : []),
        ].join(' ').toLowerCase();
        return blob.includes(query);
      });
    return {
      ok: true,
      query,
      count: matched.length,
      items: matched.slice(0, limit),
    };
  }

  ctx.bindMemoryBackend({
    id: 'memory-local',
    capabilityId: 'memory.get',
    label: 'Local memory store',
    read: async (input) => getEntry(input),
    write: async (input) => writeEntry(input),
    search: async (input) => searchEntries(input),
  });

  ctx.bindCapability('memory.write', async ({ input }) => {
    try {
      return { output: await writeEntry(input || {}) };
    } catch (error) {
      logger.warn('memory.write failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          reason: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  ctx.bindCapability('memory.search', async ({ input }) => {
    try {
      return { output: await searchEntries(input || {}) };
    } catch (error) {
      logger.warn('memory.search failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          items: [],
          reason: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  ctx.bindCapability('memory.get', async ({ input }) => {
    try {
      return { output: await getEntry(input || {}) };
    } catch (error) {
      logger.warn('memory.get failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          value: null,
          reason: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });
}

module.exports = { register };
