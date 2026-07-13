const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const VECTOR_DIM = 128;
const DEFAULT_SEARCH_LIMIT = 10;
const MAX_RESULT_LIMIT = 100;

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();
  const storeDir = path.join(workspace, '.zavorth', 'memory-vector-local');
  const storePath = path.join(storeDir, 'store.json');

  function ensureStore() {
    if (!fs.existsSync(storeDir)) {
      fs.mkdirSync(storeDir, { recursive: true });
    }
    if (!fs.existsSync(storePath)) {
      fs.writeFileSync(
        storePath,
        JSON.stringify({ version: 1, dim: VECTOR_DIM, entries: {} }, null, 2),
        'utf8',
      );
    }
  }

  function readStore() {
    ensureStore();
    try {
      const raw = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      if (!raw || typeof raw !== 'object') {
        return { version: 1, dim: VECTOR_DIM, entries: {} };
      }
      if (!raw.entries || typeof raw.entries !== 'object' || Array.isArray(raw.entries)) {
        raw.entries = {};
      }
      if (!raw.dim) {
        raw.dim = VECTOR_DIM;
      }
      return raw;
    } catch {
      return { version: 1, dim: VECTOR_DIM, entries: {} };
    }
  }

  function writeStore(store) {
    ensureStore();
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
  }

  /** Simple string hash → non-negative integer. */
  function hashToken(token) {
    let h = 2166136261;
    for (let i = 0; i < token.length; i += 1) {
      h ^= token.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function tokenize(text) {
    return String(text || '')
      .toLowerCase()
      .split(/[^a-z0-9_]+/g)
      .filter(Boolean);
  }

  /** Bag-of-words hash embedding, L2-normalized. */
  function embed(text) {
    const vec = new Array(VECTOR_DIM).fill(0);
    const tokens = tokenize(text);
    if (tokens.length === 0) {
      return vec;
    }
    for (const token of tokens) {
      const bucket = hashToken(token) % VECTOR_DIM;
      // Signed hash (feature hashing) for slightly better separation
      const sign = (hashToken(`s:${token}`) & 1) === 0 ? 1 : -1;
      vec[bucket] += sign;
    }
    return l2Normalize(vec);
  }

  function l2Normalize(vec) {
    let sumSq = 0;
    for (let i = 0; i < vec.length; i += 1) {
      sumSq += vec[i] * vec[i];
    }
    const norm = Math.sqrt(sumSq);
    if (!norm || !Number.isFinite(norm)) {
      return vec.map(() => 0);
    }
    return vec.map((v) => v / norm);
  }

  function cosineSimilarity(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) {
      return 0;
    }
    const n = Math.min(a.length, b.length);
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < n; i += 1) {
      const av = Number(a[i]) || 0;
      const bv = Number(b[i]) || 0;
      dot += av * bv;
      na += av * av;
      nb += bv * bv;
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    if (!denom || !Number.isFinite(denom)) {
      return 0;
    }
    const score = dot / denom;
    return Number.isFinite(score) ? score : 0;
  }

  function publicEntry(entry, score) {
    if (!entry) {
      return null;
    }
    const out = {
      id: entry.id,
      text: entry.text,
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      updatedAt: entry.updatedAt || null,
    };
    if (entry.key) {
      out.key = entry.key;
    }
    if (score !== undefined) {
      out.score = score;
    }
    return out;
  }

  function uniqueEntries(store) {
    const byId = new Map();
    for (const entry of Object.values(store.entries || {})) {
      if (entry && entry.id && !byId.has(entry.id)) {
        byId.set(entry.id, entry);
      }
    }
    return byId;
  }

  async function status() {
    try {
      const store = readStore();
      const entries = uniqueEntries(store);
      return {
        ok: true,
        path: storePath,
        storePath,
        entryCount: entries.size,
        dim: store.dim || VECTOR_DIM,
        embedding: 'bag-of-words-hash',
        network: false,
      };
    } catch (error) {
      return {
        ok: false,
        path: storePath,
        storePath,
        entryCount: 0,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async function upsertEntry(input) {
    const text = String(
      (input && (input.text ?? input.value ?? input.content)) ?? '',
    );
    const hasText =
      input &&
      (input.text !== undefined ||
        input.value !== undefined ||
        input.content !== undefined);
    if (!hasText) {
      return { ok: false, reason: 'text or value is required' };
    }

    const tags = Array.isArray(input && input.tags)
      ? input.tags.map(String)
      : [];
    const keyFromInput =
      input && input.key !== undefined && input.key !== null
        ? String(input.key).trim()
        : '';
    const idFromInput =
      input && input.id !== undefined && input.id !== null
        ? String(input.id).trim()
        : '';
    const id = idFromInput || keyFromInput || randomUUID();
    const vector = embed(text);
    const store = readStore();
    const previous = findEntry(store, id) || (keyFromInput ? findEntry(store, keyFromInput) : null);
    const entry = {
      id: previous && previous.id ? previous.id : id,
      text,
      tags,
      vector,
      updatedAt: new Date().toISOString(),
    };
    if (keyFromInput) {
      entry.key = keyFromInput;
    } else if (previous && previous.key) {
      entry.key = previous.key;
    }

    // Drop stale key alias if key changed
    if (previous && previous.key && previous.key !== entry.id && previous.key !== entry.key) {
      if (store.entries[previous.key] && store.entries[previous.key].id === previous.id) {
        delete store.entries[previous.key];
      }
    }
    store.entries[entry.id] = entry;
    if (entry.key && entry.key !== entry.id) {
      store.entries[entry.key] = entry;
    }
    writeStore(store);
    return {
      ok: true,
      id: entry.id,
      key: entry.key || null,
      text: entry.text,
      tags: entry.tags,
      updatedAt: entry.updatedAt,
      dim: VECTOR_DIM,
      storePath,
    };
  }

  function findEntry(store, idOrKey) {
    if (!idOrKey) {
      return null;
    }
    const direct = store.entries[idOrKey];
    if (direct) {
      return direct;
    }
    for (const candidate of Object.values(store.entries || {})) {
      if (candidate && (candidate.id === idOrKey || candidate.key === idOrKey)) {
        return candidate;
      }
    }
    return null;
  }

  async function searchEntries(input) {
    const query = String(
      (input && (input.query || input.q || input.text)) || '',
    ).trim();
    const limit = Math.max(
      1,
      Math.min(
        MAX_RESULT_LIMIT,
        Number((input && input.limit) || DEFAULT_SEARCH_LIMIT) || DEFAULT_SEARCH_LIMIT,
      ),
    );
    const store = readStore();
    // Dedupe by entry.id (store may hold key aliases)
    const byId = uniqueEntries(store);
    const queryVec = embed(query);
    const scored = [];
    for (const entry of byId.values()) {
      const score = query
        ? cosineSimilarity(queryVec, entry.vector || [])
        : 0;
      scored.push({ entry, score });
    }
    scored.sort((a, b) => b.score - a.score);
    const items = scored.slice(0, limit).map(({ entry, score }) => publicEntry(entry, score));
    return {
      ok: true,
      query,
      count: items.length,
      total: byId.size,
      items,
    };
  }

  async function getEntry(input) {
    const id = String((input && (input.id || input.key)) || '').trim();
    if (!id) {
      return { ok: false, reason: 'id or key is required', value: null, found: false };
    }
    const store = readStore();
    const entry = findEntry(store, id);
    if (!entry) {
      return { ok: true, id, value: null, found: false };
    }
    return {
      ok: true,
      id: entry.id,
      key: entry.key || null,
      value: publicEntry(entry),
      found: true,
    };
  }

  ctx.bindMemoryBackend({
    id: 'memory-vector-local',
    capabilityId: 'memory.vector.search',
    label: 'Local vector memory',
    write: async (input) => upsertEntry(input || {}),
    read: async (input) => getEntry(input || {}),
    search: async (input) => searchEntries(input || {}),
  });

  ctx.bindCapability('memory.vector.status', async () => {
    try {
      return { output: await status() };
    } catch (error) {
      logger.warn('memory.vector.status failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          path: storePath,
          entryCount: 0,
          reason: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  ctx.bindCapability('memory.vector.upsert', async ({ input }) => {
    try {
      return { output: await upsertEntry(input || {}) };
    } catch (error) {
      logger.warn('memory.vector.upsert failed', {
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

  ctx.bindCapability('memory.vector.search', async ({ input }) => {
    try {
      return { output: await searchEntries(input || {}) };
    } catch (error) {
      logger.warn('memory.vector.search failed', {
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

  ctx.bindCapability('memory.vector.get', async ({ input }) => {
    try {
      return { output: await getEntry(input || {}) };
    } catch (error) {
      logger.warn('memory.vector.get failed', {
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
