const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function register(ctx) {
  const logger = ctx.getLogger();

  function resolveVault() {
    const envVault = String(
      process.env.OBSIDIAN_VAULT
      || process.env.OBSIDIAN_VAULT_PATH
      || process.env.ZAVORTH_OBSIDIAN_VAULT
      || '',
    ).trim();
    if (envVault && fs.existsSync(envVault)) {
      return path.resolve(envVault);
    }
    const home = os.homedir();
    const candidates = [
      path.join(home, 'Documents', 'Obsidian'),
      path.join(home, 'Documents', 'Obsidian Vault'),
      path.join(home, 'Obsidian'),
      path.join(home, 'vault'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    }
    return null;
  }

  function setupTips() {
    return [
      'Set OBSIDIAN_VAULT to your vault root (absolute path)',
      'Example: OBSIDIAN_VAULT=C:/Users/you/Documents/MyVault',
      'Enable plugin: zavorth plugins enable obsidian --yes',
    ];
  }

  function safeJoin(vault, relativePath) {
    const cleaned = String(relativePath || '')
      .replace(/\\/gu, '/')
      .replace(/^\/+/u, '')
      .trim();
    if (!cleaned || cleaned.includes('..')) {
      return null;
    }
    const full = path.resolve(vault, cleaned);
    const vaultRoot = path.resolve(vault);
    if (full !== vaultRoot && !full.startsWith(vaultRoot + path.sep)) {
      return null;
    }
    return full;
  }

  function listMarkdown(dir, limit, acc = []) {
    if (acc.length >= limit) return acc;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return acc;
    }
    for (const entry of entries) {
      if (acc.length >= limit) break;
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        listMarkdown(full, limit, acc);
      } else if (entry.isFile() && /\.md$/iu.test(entry.name)) {
        acc.push(full);
      }
    }
    return acc;
  }

  ctx.bindCapability('obsidian.status', async () => {
    const vault = resolveVault();
    return {
      output: {
        ok: Boolean(vault),
        vaultPath: vault,
        message: vault
          ? `Obsidian vault ready at ${vault}`
          : 'Obsidian vault not configured.',
        setup: setupTips(),
      },
    };
  });

  ctx.bindCapability('obsidian.list', async ({ input }) => {
    try {
      const vault = resolveVault();
      if (!vault) {
        return { output: { ok: false, notes: [], reason: 'no_vault', setup: setupTips() } };
      }
      const folder = String((input && (input.folder || input.path || input.dir)) || '').trim();
      const limit = Math.max(1, Math.min(200, Number((input && input.limit) || 50) || 50));
      const base = folder ? safeJoin(vault, folder) : vault;
      if (!base || !fs.existsSync(base)) {
        return { output: { ok: false, notes: [], reason: 'folder_not_found', folder } };
      }
      const files = listMarkdown(base, limit);
      const notes = files.map((file) => ({
        path: path.relative(vault, file).replace(/\\/gu, '/'),
        size: fs.statSync(file).size,
      }));
      return { output: { ok: true, vaultPath: vault, count: notes.length, notes } };
    } catch (error) {
      logger.warn('obsidian.list failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          notes: [],
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  ctx.bindCapability('obsidian.search', async ({ input }) => {
    try {
      const vault = resolveVault();
      if (!vault) {
        return { output: { ok: false, matches: [], reason: 'no_vault', setup: setupTips() } };
      }
      const query = String((input && (input.query || input.q || input.text)) || '').trim().toLowerCase();
      if (!query) {
        return { output: { ok: false, matches: [], reason: 'query is required' } };
      }
      const limit = Math.max(1, Math.min(50, Number((input && input.limit) || 20) || 20));
      const files = listMarkdown(vault, 500);
      const matches = [];
      for (const file of files) {
        if (matches.length >= limit) break;
        const rel = path.relative(vault, file).replace(/\\/gu, '/');
        let content = '';
        try {
          content = fs.readFileSync(file, 'utf8');
        } catch {
          continue;
        }
        const hay = `${rel}\n${content}`.toLowerCase();
        if (!hay.includes(query)) continue;
        const idx = content.toLowerCase().indexOf(query);
        const snippet = idx >= 0
          ? content.slice(Math.max(0, idx - 40), Math.min(content.length, idx + query.length + 80))
          : content.slice(0, 120);
        matches.push({ path: rel, snippet: snippet.replace(/\s+/gu, ' ').trim() });
      }
      return { output: { ok: true, query, count: matches.length, matches } };
    } catch (error) {
      logger.warn('obsidian.search failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          matches: [],
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  ctx.bindCapability('obsidian.read', async ({ input }) => {
    try {
      const vault = resolveVault();
      if (!vault) {
        return { output: { ok: false, reason: 'no_vault', setup: setupTips() } };
      }
      const notePath = String((input && (input.path || input.note || input.file)) || '').trim();
      if (!notePath) {
        return { output: { ok: false, reason: 'path is required' } };
      }
      const full = safeJoin(vault, notePath.endsWith('.md') ? notePath : `${notePath}.md`);
      if (!full || !fs.existsSync(full)) {
        return { output: { ok: false, reason: 'not_found', path: notePath } };
      }
      const content = fs.readFileSync(full, 'utf8');
      return {
        output: {
          ok: true,
          path: path.relative(vault, full).replace(/\\/gu, '/'),
          content,
          bytes: Buffer.byteLength(content, 'utf8'),
        },
      };
    } catch (error) {
      logger.warn('obsidian.read failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  ctx.bindCapability('obsidian.write', async ({ input }) => {
    try {
      const vault = resolveVault();
      if (!vault) {
        return { output: { ok: false, reason: 'no_vault', setup: setupTips() } };
      }
      const notePath = String((input && (input.path || input.note || input.file)) || '').trim();
      const content = String((input && (input.content || input.body || input.text)) || '');
      if (!notePath) {
        return { output: { ok: false, reason: 'path is required' } };
      }
      let approved = input && input.approved === true;
      if (!approved && typeof ctx.requestPermission === 'function') {
        approved = await ctx.requestPermission(
          'filesystem.write',
          `Write Obsidian note: ${notePath}`,
        );
      }
      if (!approved) {
        return {
          output: {
            ok: false,
            reason: 'needs_approval',
            preview: { path: notePath, bytes: Buffer.byteLength(content, 'utf8') },
            message: 'obsidian.write requires approved===true.',
          },
        };
      }
      const rel = notePath.endsWith('.md') ? notePath : `${notePath}.md`;
      const full = safeJoin(vault, rel);
      if (!full) {
        return { output: { ok: false, reason: 'invalid_path', path: notePath } };
      }
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf8');
      return {
        output: {
          ok: true,
          path: path.relative(vault, full).replace(/\\/gu, '/'),
          bytes: Buffer.byteLength(content, 'utf8'),
        },
      };
    } catch (error) {
      logger.warn('obsidian.write failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });
}

module.exports = { register };
