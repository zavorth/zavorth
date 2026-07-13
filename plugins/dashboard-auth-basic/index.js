/**
 * Wave 6 — Dashboard basic-auth provider (soft simulation surface).
 * Does NOT replace a real auth server. Never returns password values.
 */
const crypto = require('node:crypto');

function register(ctx) {
  const logger = ctx.getLogger();

  function envPresence() {
    const userConfigured = Boolean(String(process.env.DASHBOARD_BASIC_USER || '').trim());
    const passwordConfigured = Boolean(String(process.env.DASHBOARD_BASIC_PASSWORD || '').trim());
    return { userConfigured, passwordConfigured };
  }

  function statusPayload() {
    const { userConfigured, passwordConfigured } = envPresence();
    const ready = userConfigured && passwordConfigured;
    return {
      ok: true,
      wave: 'W6',
      pack: 'trust',
      provider: 'dashboard-auth-basic',
      userConfigured,
      passwordConfigured,
      ready,
      message: ready
        ? 'Basic auth env present (values never returned). Soft simulation only.'
        : 'Set DASHBOARD_BASIC_USER and DASHBOARD_BASIC_PASSWORD for soft basic-auth simulation.',
      setup: ready
        ? null
        : [
          'export DASHBOARD_BASIC_USER=...',
          'export DASHBOARD_BASIC_PASSWORD=...',
          'This plugin is a control-plane soft surface — not a production auth server.',
        ],
      note: 'Never returns username/password values.',
    };
  }

  function verifyPayload(input) {
    const { userConfigured, passwordConfigured } = envPresence();
    if (!userConfigured || !passwordConfigured) {
      return {
        ok: true,
        authenticated: false,
        status: 'not_configured',
        message: 'DASHBOARD_BASIC_USER and/or DASHBOARD_BASIC_PASSWORD not set. Soft-fail.',
        setup: [
          'export DASHBOARD_BASIC_USER=...',
          'export DASHBOARD_BASIC_PASSWORD=...',
        ],
      };
    }

    const username = String((input && (input.username || input.user || input.name)) || '');
    const password = String((input && (input.password || input.pass || input.secret)) || '');
    const expectedUser = String(process.env.DASHBOARD_BASIC_USER || '');
    const expectedPass = String(process.env.DASHBOARD_BASIC_PASSWORD || '');

    const userOk = safeEqual(expectedUser, username);
    const passOk = safeEqual(expectedPass, password);
    const authenticated = userOk && passOk;

    return {
      ok: true,
      authenticated,
      message: authenticated
        ? 'Credentials match env (soft simulation).'
        : 'Credentials do not match env (soft simulation).',
      note: 'Password is never echoed.',
    };
  }

  function challengePayload() {
    return {
      ok: true,
      realm: 'zavorth',
      scheme: 'Basic',
      message: 'Basic realm="zavorth"',
      header: 'WWW-Authenticate',
      headerValue: 'Basic realm="zavorth"',
      wave: 'W6',
      note: 'Hint only — real HTTP challenge is owned by the control plane host.',
    };
  }

  ctx.bindCapability('dashboard.auth.basic.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('dashboard.auth.basic.challenge', async () => ({
    output: challengePayload(),
  }));

  const verifyHandler = async (input) => {
    try {
      return verifyPayload(input || {});
    } catch (error) {
      logger.warn('dashboard.auth.basic.verify failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        ok: false,
        authenticated: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  };

  ctx.bindCapability('dashboard.auth.basic.verify', async ({ input }) => ({
    output: await verifyHandler(input || {}),
  }));

  if (typeof ctx.registerDashboardAuthProvider === 'function') {
    ctx.registerDashboardAuthProvider({
      kind: 'dashboard_auth',
      id: 'basic',
      capabilityId: 'dashboard.auth.basic.verify',
      label: 'Dashboard Basic Auth',
      metadata: { wave: 'W6', pack: 'trust', scheme: 'Basic' },
      handler: verifyHandler,
    });
  }

  logger.info('dashboard-auth-basic registered');
}

/**
 * Constant-time-ish string compare. Never throws; unequal lengths fail closed.
 */
function safeEqual(expected, provided) {
  const a = Buffer.from(String(expected ?? ''), 'utf8');
  const b = Buffer.from(String(provided ?? ''), 'utf8');
  if (a.length !== b.length) {
    // Burn a fixed-size compare so length leaks are slightly harder.
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
