/**
 * Trust fabric: file secret source (soft-fail).
 * Local plain JSON store under workspace/.zavorth/secrets/.
 * Capability outputs NEVER include secret values — names/presence only.
 */

const fs = require('node:fs');
const path = require('node:path');

const STORE_BASENAME = 'store.json';
const LEGACY_BASENAME = 'secrets.json';

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();
  const secretsDir = path.join(workspace, '.zavorth', 'secrets');
  const storePath = path.join(secretsDir, STORE_BASENAME);
  const legacyPath = path.join(secretsDir, LEGACY_BASENAME);

  function relativeStorePath() {
    return path.relative(workspace, storePath).split(path.sep).join('/');
  }

  function assertConfined(targetPath) {
    const resolved = path.resolve(targetPath);
    const root = path.resolve(secretsDir);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new Error('path escapes .zavorth/secrets confinement');
    }
    return resolved;
  }

  function resolveReadablePath() {
    assertConfined(storePath);
    if (fs.existsSync(storePath) && fs.statSync(storePath).isFile()) {
      return storePath;
    }
    assertConfined(legacyPath);
    if (fs.existsSync(legacyPath) && fs.statSync(legacyPath).isFile()) {
      return legacyPath;
    }
    return storePath;
  }

  function emptyStore() {
    return { entries: {} };
  }

  function readStore() {
    try {
      const target = resolveReadablePath();
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        return emptyStore();
      }
      const raw = fs.readFileSync(target, 'utf8');
      if (!raw || !raw.trim()) {
        return emptyStore();
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return emptyStore();
      }
      // Support both { entries: { name: value } } and flat { name: value }.
      if (parsed.entries && typeof parsed.entries === 'object' && !Array.isArray(parsed.entries)) {
        return { entries: { ...parsed.entries } };
      }
      const entries = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (key === 'entries') continue;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          entries[key] = value;
        }
      }
      return { entries };
    } catch (error) {
      logger.warn('secret-source-file readStore soft-failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return emptyStore();
    }
  }

  function writeStore(store) {
    assertConfined(storePath);
    if (!fs.existsSync(secretsDir)) {
      fs.mkdirSync(secretsDir, { recursive: true });
    }
    // Plain local file (not encrypted) — soft plugin contract.
    const payload = {
      entries: store.entries && typeof store.entries === 'object' ? store.entries : {},
    };
    fs.writeFileSync(storePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  function entryNames(store) {
    const entries = (store && store.entries) || {};
    return Object.keys(entries).sort();
  }

  function normalizeName(input) {
    return String((input && (input.name || input.key || input.id)) || '').trim();
  }

  async function requestWrite(reason) {
    if (typeof ctx.requestPermission !== 'function') {
      return true;
    }
    return ctx.requestPermission('filesystem.write', reason);
  }

  function statusPayload() {
    const target = resolveReadablePath();
    const exists = fs.existsSync(target) && fs.statSync(target).isFile();
    const store = exists ? readStore() : emptyStore();
    const names = entryNames(store);
    return {
      ok: true,
      pack: 'trust',
      source: 'file',
      exists,
      entryCount: names.length,
      path: relativeStorePath(),
      absolutePath: storePath,
      note: 'Secret values are never returned — presence and names only.',
      message: exists
        ? `Secret store has ${names.length} entr${names.length === 1 ? 'y' : 'ies'}.`
        : 'Secret store file does not exist yet (will be created on set).',
    };
  }

  async function hasSecret(input) {
    const name = normalizeName(input);
    if (!name) {
      return { ok: false, present: false, name: '', reason: 'name_required' };
    }
    if (typeof ctx.requestPermission === 'function') {
      const allowed = await ctx.requestPermission('secret.read', `Probe presence of file secret ${name}`);
      if (!allowed) {
        return {
          ok: false,
          present: false,
          name,
          reason: 'permission_denied',
          blocked: true,
        };
      }
    }
    const store = readStore();
    const present = Object.prototype.hasOwnProperty.call(store.entries, name);
    return { ok: true, present, name };
  }

  async function setSecret(input) {
    const name = normalizeName(input);
    if (!name) {
      return { ok: false, name: '', present: false, reason: 'name_required' };
    }
    if (!input || input.value === undefined || input.value === null) {
      return { ok: false, name, present: false, reason: 'value_required' };
    }

    const allowed = await requestWrite(`Write file secret ${name} under .zavorth/secrets`);
    if (!allowed) {
      return {
        ok: false,
        name,
        present: false,
        reason: 'permission_denied',
        blocked: true,
      };
    }

    try {
      const store = readStore();
      store.entries[name] = String(input.value);
      writeStore(store);
      // Never return the value.
      return { ok: true, name, present: true };
    } catch (error) {
      logger.warn('secret.file.set failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        ok: false,
        name,
        present: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async function deleteSecret(input) {
    const name = normalizeName(input);
    if (!name) {
      return { ok: false, name: '', deleted: false, reason: 'name_required' };
    }

    const allowed = await requestWrite(`Delete file secret ${name} under .zavorth/secrets`);
    if (!allowed) {
      return {
        ok: false,
        name,
        deleted: false,
        reason: 'permission_denied',
        blocked: true,
      };
    }

    try {
      const store = readStore();
      const had = Object.prototype.hasOwnProperty.call(store.entries, name);
      if (had) {
        delete store.entries[name];
        writeStore(store);
      }
      return { ok: true, name, deleted: had, present: false };
    } catch (error) {
      logger.warn('secret.file.delete failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        ok: false,
        name,
        deleted: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  function listSecrets() {
    const store = readStore();
    const names = entryNames(store);
    return {
      ok: true,
      names,
      entryCount: names.length,
      path: relativeStorePath(),
      note: 'Secret values are never returned — names only.',
    };
  }

  ctx.bindCapability('secret.file.status', async () => {
    try {
      return { output: statusPayload() };
    } catch (error) {
      logger.warn('secret.file.status failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          exists: false,
          entryCount: 0,
          path: relativeStorePath(),
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  ctx.bindCapability('secret.file.set', async ({ input }) => {
    try {
      return { output: await setSecret(input || {}) };
    } catch (error) {
      logger.warn('secret.file.set capability failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          name: normalizeName(input || {}),
          present: false,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  ctx.bindCapability('secret.file.has', async ({ input }) => {
    try {
      return { output: await hasSecret(input || {}) };
    } catch (error) {
      logger.warn('secret.file.has failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          present: false,
          name: normalizeName(input || {}),
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  ctx.bindCapability('secret.file.delete', async ({ input }) => {
    try {
      return { output: await deleteSecret(input || {}) };
    } catch (error) {
      logger.warn('secret.file.delete capability failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          name: normalizeName(input || {}),
          deleted: false,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  ctx.bindCapability('secret.file.list', async () => {
    try {
      return { output: listSecrets() };
    } catch (error) {
      logger.warn('secret.file.list failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          names: [],
          entryCount: 0,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  if (typeof ctx.registerSecretSource === 'function') {
    try {
      ctx.registerSecretSource({
        kind: 'secret_source',
        id: 'file',
        capabilityId: 'secret.file.has',
        label: 'File Secret Source',
        metadata: { pack: 'trust', source: 'file' },
        handler: async (input) => {
          try {
            return await hasSecret(input || {});
          } catch (error) {
            logger.warn('secret.file.has specialized handler failed', {
              error: error instanceof Error ? error.message : String(error),
            });
            return {
              ok: false,
              present: false,
              name: normalizeName(input || {}),
              message: error instanceof Error ? error.message : String(error),
            };
          }
        },
      });
    } catch (error) {
      logger.warn('registerSecretSource soft-failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('secret-source-file registered', {
    workspace,
    path: relativeStorePath(),
  });
}

module.exports = { register };
