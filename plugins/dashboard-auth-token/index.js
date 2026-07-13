/**
 * Wave 6 — Dashboard bearer-token provider (soft simulation surface).
 * Does NOT replace a real auth server. Never returns token values.
 */
const crypto = require('node:crypto');

function register(ctx) {
  const logger = ctx.getLogger();

  function resolveExpectedToken() {
    const primary = String(process.env.DASHBOARD_AUTH_TOKEN || '').trim();
    if (primary) return primary;
    return String(process.env.ZAVORTH_DASHBOARD_TOKEN || '').trim();
  }

  function tokenConfigured() {
    return Boolean(resolveExpectedToken());
  }

  function statusPayload() {
    const configured = tokenConfigured();
    const primaryPresent = Boolean(String(process.env.DASHBOARD_AUTH_TOKEN || '').trim());
    const altPresent = Boolean(String(process.env.ZAVORTH_DASHBOARD_TOKEN || '').trim());
    return {
      ok: true,
      wave: 'W6',
      pack: 'trust',
      provider: 'dashboard-auth-token',
      tokenConfigured: configured,
      envSources: {
        DASHBOARD_AUTH_TOKEN: primaryPresent,
        ZAVORTH_DASHBOARD_TOKEN: altPresent,
      },
      message: configured
        ? 'Dashboard token env present (value never returned). Soft simulation only.'
        : 'Set DASHBOARD_AUTH_TOKEN or ZAVORTH_DASHBOARD_TOKEN for soft bearer-token simulation.',
      setup: configured
        ? null
        : [
          'export DASHBOARD_AUTH_TOKEN=... (preferred)',
          'or export ZAVORTH_DASHBOARD_TOKEN=...',
          'This plugin is a control-plane soft surface — not a production auth server.',
        ],
      note: 'Never returns token values.',
    };
  }

  function extractToken(input) {
    const raw = String(
      (input && (input.token || input.bearer || input.authorization || input.Authorization || input.value))
        || '',
    ).trim();
    if (!raw) return '';
    // Strip "Bearer " prefix (case-insensitive).
    const match = raw.match(/^Bearer\s+(.+)$/iu);
    return match ? String(match[1] || '').trim() : raw;
  }

  function verifyPayload(input) {
    if (!tokenConfigured()) {
      return {
        ok: true,
        authenticated: false,
        status: 'not_configured',
        message: 'DASHBOARD_AUTH_TOKEN / ZAVORTH_DASHBOARD_TOKEN not set. Soft-fail.',
        setup: [
          'export DASHBOARD_AUTH_TOKEN=...',
          'or export ZAVORTH_DASHBOARD_TOKEN=...',
        ],
      };
    }

    const provided = extractToken(input || {});
    const expected = resolveExpectedToken();
    const authenticated = safeEqual(expected, provided);

    return {
      ok: true,
      authenticated,
      message: authenticated
        ? 'Token matches env (soft simulation).'
        : 'Token does not match env (soft simulation).',
      note: 'Token is never echoed.',
    };
  }

  function headerHintPayload() {
    return {
      ok: true,
      header: 'Authorization',
      format: 'Bearer <token>',
      example: 'Authorization: Bearer <token>',
      wave: 'W6',
      note: 'Hint only — never includes the actual token.',
    };
  }

  ctx.bindCapability('dashboard.auth.token.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('dashboard.auth.token.headerHint', async () => ({
    output: headerHintPayload(),
  }));

  const verifyHandler = async (input) => {
    try {
      return verifyPayload(input || {});
    } catch (error) {
      logger.warn('dashboard.auth.token.verify failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        ok: false,
        authenticated: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  };

  ctx.bindCapability('dashboard.auth.token.verify', async ({ input }) => ({
    output: await verifyHandler(input || {}),
  }));

  if (typeof ctx.registerDashboardAuthProvider === 'function') {
    ctx.registerDashboardAuthProvider({
      kind: 'dashboard_auth',
      id: 'token',
      capabilityId: 'dashboard.auth.token.verify',
      label: 'Dashboard Bearer Token Auth',
      metadata: { wave: 'W6', pack: 'trust', scheme: 'Bearer' },
      handler: verifyHandler,
    });
  }

  logger.info('dashboard-auth-token registered');
}

/**
 * Constant-time-ish string compare. Never throws; unequal lengths fail closed.
 */
function safeEqual(expected, provided) {
  const a = Buffer.from(String(expected ?? ''), 'utf8');
  const b = Buffer.from(String(provided ?? ''), 'utf8');
  if (a.length !== b.length) {
    const pad = Buffer.alloc(Math.max(a.length, 1));
    try {
      crypto.timingSafeEqual(pad, pad);
    } catch {
      /* ignore */
    }
    return false;
  }
  if (a.length === 0) {
    return b.length === 0;
  }
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

module.exports = { register };
