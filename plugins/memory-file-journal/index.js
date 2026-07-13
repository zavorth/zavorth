const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const MAX_SCAN_LINES = 5000;
const DEFAULT_SEARCH_LIMIT = 20;
const DEFAULT_TAIL_LIMIT = 20;
const MAX_RESULT_LIMIT = 100;

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();
  const storeDir = path.join(workspace, '.zavorth', 'memory-file-journal');
  const journalPath = path.join(storeDir, 'journal.jsonl');

  function ensureJournal() {
    if (!fs.existsSync(storeDir)) {
      fs.mkdirSync(storeDir, { recursive: true });
    }
    if (!fs.existsSync(journalPath)) {
      fs.writeFileSync(journalPath, '', 'utf8');
    }
  }

  function readAllLines() {
    ensureJournal();
    try {
      const raw = fs.readFileSync(journalPath, 'utf8');
      if (!raw || !raw.trim()) {
        return [];
      }
      return raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
    } catch {
      return [];
    }
  }

  function readLastLines(maxLines) {
    const lines = readAllLines();
    const cap = Math.max(1, Math.min(MAX_SCAN_LINES, Number(maxLines) || MAX_SCAN_LINES));
    if (lines.length <= cap) {
      return lines;
    }
    return lines.slice(lines.length - cap);
  }

  function parseLine(line) {
    try {
      const entry = JSON.parse(line);
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      return entry;
    } catch {
      return null;
    }
  }

  function countLinesCapped() {
    const lines = readAllLines();
    const total = lines.length;
    return {
      lineCount: total,
      scanned: Math.min(total, MAX_SCAN_LINES),
      capped: total > MAX_SCAN_LINES,
    };
  }

  async function status() {
    try {
      ensureJournal();
      const counts = countLinesCapped();
      return {
        ok: true,
        path: journalPath,
        journalPath,
        lineCount: counts.lineCount,
        scanned: counts.scanned,
        capped: counts.capped,
        maxScanLines: MAX_SCAN_LINES,
      };
    } catch (error) {
      return {
        ok: false,
        path: journalPath,
        journalPath,
        lineCount: 0,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async function appendEntry(input) {
    const hasPayload =
      input &&
      (input.text !== undefined ||
        input.content !== undefined ||
        input.value !== undefined);
    if (!hasPayload) {
      return { ok: false, reason: 'text, content, or value is required' };
    }

    const tags = Array.isArray(input && input.tags)
      ? input.tags.map(String)
      : [];
    const key =
      input && input.key !== undefined && input.key !== null
        ? String(input.key).trim()
        : '';
    const entry = {
      id: randomUUID(),
      at: new Date().toISOString(),
      text: String(input.text ?? input.content ?? input.value ?? ''),
      tags,
    };
    if (key) {
      entry.key = key;
    }

    ensureJournal();
    fs.appendFileSync(journalPath, `${JSON.stringify(entry)}\n`, 'utf8');
    return {
      ok: true,
      id: entry.id,
      at: entry.at,
      entry,
      journalPath,
    };
  }

  async function searchEntries(input) {
    const query = String(
      (input && (input.query || input.q || input.text)) || '',
    )
      .trim()
      .toLowerCase();
    const limit = Math.max(
      1,
      Math.min(MAX_RESULT_LIMIT, Number((input && input.limit) || DEFAULT_SEARCH_LIMIT) || DEFAULT_SEARCH_LIMIT),
    );
    const lines = readLastLines(MAX_SCAN_LINES);
    const entries = [];
    for (const line of lines) {
      const entry = parseLine(line);
      if (!entry) {
        continue;
      }
      if (!query) {
        entries.push(entry);
        continue;
      }
      const blob = [
        entry.id,
        entry.key,
        entry.text,
        entry.content,
        entry.value,
        entry.at,
        ...(Array.isArray(entry.tags) ? entry.tags : []),
      ]
        .filter((part) => part !== undefined && part !== null)
        .join(' ')
        .toLowerCase();
      if (blob.includes(query)) {
        entries.push(entry);
      }
    }
    // Prefer more recent matches first (last lines are newer)
    const ordered = entries.slice().reverse();
    return {
      ok: true,
      query,
      count: ordered.length,
      scanned: lines.length,
      items: ordered.slice(0, limit),
    };
  }

  async function tailEntries(input) {
    const limit = Math.max(
      1,
      Math.min(MAX_RESULT_LIMIT, Number((input && input.limit) || DEFAULT_TAIL_LIMIT) || DEFAULT_TAIL_LIMIT),
    );
    const lines = readLastLines(Math.min(MAX_SCAN_LINES, limit));
    const entries = [];
    for (const line of lines) {
      const entry = parseLine(line);
      if (entry) {
        entries.push(entry);
      }
    }
    // Most recent last in file; return newest-first for tail
    const newestFirst = entries.slice().reverse().slice(0, limit);
    return {
      ok: true,
      count: newestFirst.length,
      items: newestFirst,
      journalPath,
    };
  }

  async function getById(input) {
    const id = String((input && (input.id || input.key)) || '').trim();
    if (!id) {
      return { ok: false, reason: 'id or key is required', value: null, found: false };
    }
    const lines = readLastLines(MAX_SCAN_LINES);
    // Scan newest first for key/id
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const entry = parseLine(lines[i]);
      if (!entry) {
        continue;
      }
      if (entry.id === id || entry.key === id) {
        return {
          ok: true,
          id: entry.id,
          key: entry.key || null,
          value: entry,
          found: true,
        };
      }
    }
    return {
      ok: true,
      id,
      value: null,
      found: false,
    };
  }

  ctx.bindMemoryBackend({
    id: 'memory-file-journal',
    capabilityId: 'memory.journal.search',
    label: 'File journal memory',
    write: async (input) => appendEntry(input || {}),
    read: async (input) => getById(input || {}),
    search: async (input) => searchEntries(input || {}),
  });

  ctx.bindCapability('memory.journal.status', async () => {
    try {
      return { output: await status() };
    } catch (error) {
      logger.warn('memory.journal.status failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          path: journalPath,
          lineCount: 0,
          reason: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  ctx.bindCapability('memory.journal.append', async ({ input }) => {
    try {
      return { output: await appendEntry(input || {}) };
    } catch (error) {
      logger.warn('memory.journal.append failed', {
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

  ctx.bindCapability('memory.journal.search', async ({ input }) => {
    try {
      return { output: await searchEntries(input || {}) };
    } catch (error) {
      logger.warn('memory.journal.search failed', {
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

  ctx.bindCapability('memory.journal.tail', async ({ input }) => {
    try {
      return { output: await tailEntries(input || {}) };
    } catch (error) {
      logger.warn('memory.journal.tail failed', {
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
}

module.exports = { register };
