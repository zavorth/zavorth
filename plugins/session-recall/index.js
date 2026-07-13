const fs = require('node:fs');
const path = require('node:path');

const SOURCE_GLOBS = [
  'receipts',
  'memory-local',
  'memory-file-journal',
  'memory-vector-local',
  'memory-mem0',
  'task-board',
  'cost-tracker',
  'security-guidance',
  'secrets-guardian',
  'calendar',
  'plugin-os',
  'session-scratch',
];

const TEXT_EXTS = new Set(['.json', '.jsonl', '.md', '.txt', '.log', '.yml', '.yaml']);

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();
  const zavorthRoot = path.join(workspace, '.zavorth');

  function listSourceRoots() {
    const roots = [];
    if (!fs.existsSync(zavorthRoot)) {
      return roots;
    }
    for (const name of SOURCE_GLOBS) {
      const full = path.join(zavorthRoot, name);
      if (fs.existsSync(full)) {
        roots.push({ id: name, path: full });
      }
    }
    // Also pick any top-level .zavorth dirs not listed (soft discovery)
    try {
      for (const entry of fs.readdirSync(zavorthRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (SOURCE_GLOBS.includes(entry.name)) continue;
        if (entry.name.startsWith('.')) continue;
        roots.push({ id: entry.name, path: path.join(zavorthRoot, entry.name), extra: true });
      }
    } catch {
      /* ignore */
    }
    return roots;
  }

  function walkFiles(dir, out, depth = 0) {
    if (depth > 4 || out.length > 400) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length > 400) break;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        walkFiles(full, out, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!TEXT_EXTS.has(ext) && !entry.name.endsWith('.jsonl')) continue;
        try {
          const st = fs.statSync(full);
          if (st.size > 1_500_000) continue;
          out.push({ path: full, mtimeMs: st.mtimeMs, size: st.size });
        } catch {
          /* skip */
        }
      }
    }
  }

  function collectFiles() {
    const files = [];
    for (const root of listSourceRoots()) {
      walkFiles(root.path, files, 0);
    }
    return files;
  }

  function snippetAround(text, query, radius = 80) {
    const lower = text.toLowerCase();
    const idx = lower.indexOf(query.toLowerCase());
    if (idx < 0) return text.slice(0, Math.min(160, text.length));
    const start = Math.max(0, idx - radius);
    const end = Math.min(text.length, idx + query.length + radius);
    return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
  }

  ctx.bindCapability('recall.sources', async () => {
    try {
      const sources = listSourceRoots().map((s) => ({
        id: s.id,
        path: path.relative(workspace, s.path),
        extra: Boolean(s.extra),
      }));
      return {
        output: {
          ok: true,
          root: path.relative(workspace, zavorthRoot),
          count: sources.length,
          sources,
          message: sources.length
            ? 'Indexed .zavorth source directories.'
            : 'No .zavorth data yet — run the agent or enable other plugins first.',
        },
      };
    } catch (error) {
      logger.warn('recall.sources failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return softFail(error, { sources: [] });
    }
  });

  ctx.bindCapability('recall.recent', async ({ input }) => {
    try {
      const limit = Math.max(1, Math.min(100, Number((input && input.limit) || 20) || 20));
      const files = collectFiles()
        .sort((a, b) => b.mtimeMs - a.mtimeMs)
        .slice(0, limit)
        .map((f) => ({
          path: path.relative(workspace, f.path),
          mtime: new Date(f.mtimeMs).toISOString(),
          size: f.size,
        }));
      return {
        output: {
          ok: true,
          count: files.length,
          files,
        },
      };
    } catch (error) {
      logger.warn('recall.recent failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return softFail(error, { files: [] });
    }
  });

  ctx.bindCapability('recall.search', async ({ input }) => {
    try {
      const query = String((input && (input.query || input.q || input.text)) || '').trim();
      if (!query) {
        return { output: { ok: false, hits: [], message: 'query is required' } };
      }
      const limit = Math.max(1, Math.min(50, Number((input && input.limit) || 15) || 15));
      const files = collectFiles();
      const hits = [];
      const qLower = query.toLowerCase();
      for (const file of files) {
        if (hits.length >= limit) break;
        let content = '';
        try {
          content = fs.readFileSync(file.path, 'utf8');
        } catch {
          continue;
        }
        if (!content.toLowerCase().includes(qLower)) continue;
        // Prefer line-level hits for jsonl
        const lines = content.split(/\r?\n/u);
        let lineNo = 0;
        let matchedLine = null;
        for (let i = 0; i < lines.length; i += 1) {
          if (lines[i].toLowerCase().includes(qLower)) {
            lineNo = i + 1;
            matchedLine = lines[i];
            break;
          }
        }
        hits.push({
          path: path.relative(workspace, file.path),
          line: lineNo || null,
          snippet: snippetAround(matchedLine || content, query).slice(0, 280),
          mtime: new Date(file.mtimeMs).toISOString(),
          score: matchedLine ? 2 : 1,
        });
      }
      hits.sort((a, b) => b.score - a.score);
      return {
        output: {
          ok: true,
          query,
          count: hits.length,
          hits,
          scannedFiles: files.length,
          message: hits.length
            ? `Found ${hits.length} hit(s) under .zavorth`
            : 'No matches in local recall sources.',
        },
        receipts: ['session-recall.receipt'],
      };
    } catch (error) {
      logger.warn('recall.search failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return softFail(error, { hits: [] });
    }
  });

  logger.info('session-recall registered', { workspace, zavorthRoot });
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
