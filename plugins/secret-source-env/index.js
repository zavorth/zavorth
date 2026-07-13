/**
 * Wave 6 — Trust fabric: env secret source (soft-fail).
 * Presence-only probes for allowlisted process.env names.
 * NEVER returns secret values.
 */

const DEFAULT_ALLOWLIST = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'XAI_API_KEY',
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'TELEGRAM_BOT_TOKEN',
  'DISCORD_BOT_TOKEN',
  'EXA_API_KEY',
  'MEM0_API_KEY',
  'FIRECRAWL_API_KEY',
];

function register(ctx) {
  const logger = ctx.getLogger();

  function buildAllowlist() {
    const names = new Set(DEFAULT_ALLOWLIST);
    const extra = String(process.env.ZAVORTH_SECRET_ENV_ALLOWLIST || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const name of extra) {
      names.add(name);
    }
    return Array.from(names).sort();
  }

  function isPresent(name) {
    return Boolean(String(process.env[name] || '').trim());
  }

  function listPresence() {
    const allowlist = buildAllowlist();
    return allowlist.map((name) => ({
      name,
      present: isPresent(name),
    }));
  }

  function statusPayload() {
    const entries = listPresence();
    const presentCount = entries.filter((e) => e.present).length;
    return {
      ok: true,
      wave: 'W6',
      pack: 'trust',
      source: 'env',
      allowlistCount: entries.length,
      presentCount,
      entries,
      note: 'Secret values are never returned — presence only.',
      message:
        presentCount > 0
          ? `${presentCount}/${entries.length} allowlisted env secrets present.`
          : 'No allowlisted env secrets present.',
      setup: [
        'Set env vars from the default allowlist as needed',
        'Optional: ZAVORTH_SECRET_ENV_ALLOWLIST=FOO,BAR for extra names',
      ],
    };
  }

  async function getPresence(input) {
    const name = String((input && (input.name || input.key || input.id)) || '').trim();
    if (!name) {
      return { ok: false, present: false, name: '', reason: 'name_required' };
    }

    const allowlist = buildAllowlist();
    if (!allowlist.includes(name)) {
      return {
        ok: false,
        present: false,
        name,
        reason: 'not_allowlisted',
      };
    }

    if (typeof ctx.requestPermission === 'function') {
      const allowed = await ctx.requestPermission(
        'secret.read',
        `Probe presence of env secret ${name}`,
      );
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

    // Presence only — never read/return the raw value into output.
    return {
      ok: true,
      present: isPresent(name),
      name,
    };
  }

  ctx.bindCapability('secret.env.status', async () => {
    try {
      return { output: statusPayload() };
    } catch (error) {
      logger.warn('secret.env.status failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          entries: [],
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  ctx.bindCapability('secret.env.get', async ({ input }) => {
    try {
      return { output: await getPresence(input || {}) };
    } catch (error) {
      logger.warn('secret.env.get failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          present: false,
          name: String((input && input.name) || ''),
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  ctx.bindCapability('secret.env.list', async () => {
    try {
      const entries = listPresence();
      return {
        output: {
          ok: true,
          names: entries.map((e) => e.name),
          entries,
          note: 'Secret values are never returned — presence only.',
        },
      };
    } catch (error) {
      logger.warn('secret.env.list failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          names: [],
          entries: [],
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  if (typeof ctx.registerSecretSource === 'function') {
    try {
      ctx.registerSecretSource({
        kind: 'secret_source',
        id: 'env',
        capabilityId: 'secret.env.get',
        label: 'Env Secret Source',
        metadata: { wave: 'W6', pack: 'trust', source: 'env' },
        handler: async (input) => {
          try {
            return await getPresence(input || {});
          } catch (error) {
            logger.warn('secret.env.get specialized handler failed', {
              error: error instanceof Error ? error.message : String(error),
            });
            return {
              ok: false,
              present: false,
              name: String((input && input.name) || ''),
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

  logger.info('secret-source-env registered');
}

module.exports = { register };
