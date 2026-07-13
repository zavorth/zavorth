/**
 * Wave 7 — Demo showcase (soft-fail).
 * Exercises as many Wave 0 specialized register_* APIs as possible in one package.
 * No real network. moduleKind=diagnostics → skips registerPlatform / bindChannel.
 */

const WAVE = 'W7';
const SECRET_ENV = 'DEMO_SHOWCASE_SECRET';

/** Always bound via bindCapability (required for load). */
const CAPABILITY_IDS = [
  'demo.showcase.status',
  'demo.showcase.ping',
  'demo.showcase.skill',
  'demo.showcase.cli',
  'demo.showcase.auxiliary',
  'demo.showcase.web_search',
  'demo.showcase.browser',
  'demo.showcase.image_gen',
  'demo.showcase.video_gen',
  'demo.showcase.tts',
  'demo.showcase.transcription',
  'demo.showcase.secret',
  'demo.showcase.auth',
  'demo.showcase.context',
  'demo.showcase.slack_action',
  'demo.showcase.middleware_note',
];

/** Specialized registrar names attempted (registerPlatform intentionally skipped). */
const SPECIALIZED_ATTEMPTS = [
  'registerSkill',
  'registerCliCommand',
  'registerAuxiliaryTask',
  'registerWebSearchProvider',
  'registerBrowserProvider',
  'registerImageGenProvider',
  'registerVideoGenProvider',
  'registerTtsProvider',
  'registerTranscriptionProvider',
  'registerSecretSource',
  'registerDashboardAuthProvider',
  'registerContextEngine',
  'registerSlackActionHandler',
  'registerMiddleware',
];

function register(ctx) {
  const logger =
    typeof ctx.getLogger === 'function'
      ? ctx.getLogger()
      : { debug() {}, info() {}, warn() {}, error() {} };

  /** @type {string[]} */
  const surface = [];
  let middlewareRegistered = false;

  // ── Soft capability handlers (raw payloads; bindCapability wraps as { output }) ──

  function statusPayload() {
    return {
      ok: true,
      wave: WAVE,
      surface: surface.slice(),
      capabilityCount: CAPABILITY_IDS.length,
      specializedAttempted: SPECIALIZED_ATTEMPTS.length,
      specializedPresent: surface.length,
      message:
        surface.length > 0
          ? `Demo showcase registered; ${surface.length}/${SPECIALIZED_ATTEMPTS.length} specialized registrars present.`
          : `Demo showcase registered; no specialized registrars on ctx (bindCapability-only mode).`,
      note: 'Soft demo only — no real network or external services.',
      skipped: ['registerPlatform', 'bindChannel'],
      skippedReason: 'moduleKind is diagnostics; channel/platform registrars skipped to avoid moduleKind failure.',
    };
  }

  function pingPayload(input) {
    const message =
      input && input.message != null
        ? String(input.message)
        : input && input.text != null
          ? String(input.text)
          : 'pong';
    return { ok: true, echo: message, wave: WAVE };
  }

  function skillPayload(input) {
    return {
      ok: true,
      wave: WAVE,
      kind: 'skill',
      stub: true,
      input: input || {},
      message: 'Soft skill demo handler — no real skill execution.',
    };
  }

  function cliPayload(input) {
    return {
      ok: true,
      wave: WAVE,
      kind: 'cli_command',
      stub: true,
      args: (input && (input.args || input.argv)) || input || {},
      message: 'Soft CLI command demo — no process spawn.',
    };
  }

  function auxiliaryPayload(input) {
    return {
      ok: true,
      wave: WAVE,
      kind: 'auxiliary_task',
      stub: true,
      task: (input && (input.task || input.name)) || 'demo',
      status: 'idle',
      message: 'Soft auxiliary task — no background work started.',
    };
  }

  function webSearchPayload(input) {
    const query = String((input && (input.query || input.q || input.text)) || '').trim();
    if (!query) {
      return {
        ok: false,
        wave: WAVE,
        stub: true,
        reason: 'query_required',
        results: [],
        message: 'query is required for demo.showcase.web_search',
      };
    }
    return {
      ok: true,
      wave: WAVE,
      stub: true,
      query,
      results: [
        {
          title: `Demo result for "${query}"`,
          url: `https://example.invalid/demo?q=${encodeURIComponent(query)}`,
          snippet: `Soft stub hit for ${query}. No network was used.`,
        },
        {
          title: 'Zavorth Plugin OS surface parity',
          url: 'https://example.invalid/plugin-os/wave7',
          snippet: 'Wave 7 demo-showcase fake result for tables and demos.',
        },
      ],
      message: 'Soft stub search results (no network).',
    };
  }

  function browserPayload(input) {
    const url = String((input && (input.url || input.href || input.target)) || 'about:blank').trim();
    return {
      ok: true,
      wave: WAVE,
      stub: true,
      navigated: false,
      url,
      message: `Soft browser navigate stub for ${url} — no real browser session.`,
    };
  }

  function imageGenPayload(input) {
    const prompt = String((input && (input.prompt || input.text)) || '').trim();
    return {
      ok: true,
      wave: WAVE,
      stub: true,
      prompt: prompt || null,
      message: prompt
        ? `Soft image gen stub for prompt (length ${prompt.length}) — no image generated.`
        : 'Soft image gen stub — provide prompt for a more specific message.',
    };
  }

  function videoGenPayload(input) {
    const prompt = String((input && (input.prompt || input.text)) || '').trim();
    return {
      ok: true,
      wave: WAVE,
      stub: true,
      prompt: prompt || null,
      message: prompt
        ? `Soft video gen stub for prompt (length ${prompt.length}) — no video generated.`
        : 'Soft video gen stub — provide prompt for a more specific message.',
    };
  }

  function ttsPayload(input) {
    const text = String((input && (input.text || input.prompt || input.input)) || '').trim();
    return {
      ok: true,
      wave: WAVE,
      stub: true,
      textLength: text.length,
      message: text
        ? `Soft TTS stub for ${text.length} chars — no audio synthesized.`
        : 'Soft TTS stub — provide text to synthesize (demo only).',
    };
  }

  function transcriptionPayload(input) {
    const audio = String((input && (input.audio || input.path || input.url)) || '').trim();
    return {
      ok: true,
      wave: WAVE,
      stub: true,
      audioPresent: Boolean(audio),
      text: audio ? '[demo transcript stub]' : '',
      message: audio
        ? 'Soft transcription stub — no audio decoded.'
        : 'Soft transcription stub — provide audio path/url for a more specific message.',
    };
  }

  async function secretPayload() {
    if (typeof ctx.requestPermission === 'function') {
      try {
        const allowed = await ctx.requestPermission(
          'secret.read',
          'Probe presence of DEMO_SHOWCASE_SECRET',
        );
        if (!allowed) {
          return {
            ok: false,
            wave: WAVE,
            present: false,
            name: SECRET_ENV,
            reason: 'permission_denied',
            blocked: true,
            note: 'Secret values are never returned — presence only.',
          };
        }
      } catch {
        /* soft-fail permission probe */
      }
    }
    const present = Boolean(String(process.env[SECRET_ENV] || '').trim());
    return {
      ok: true,
      wave: WAVE,
      present,
      name: SECRET_ENV,
      message: present
        ? 'DEMO_SHOWCASE_SECRET is present (value never returned).'
        : 'DEMO_SHOWCASE_SECRET is not set.',
      note: 'Secret values are never returned — presence only.',
    };
  }

  function authPayload(input) {
    const token = String(
      (input && (input.token || input.bearer || input.authorization || input.value)) || '',
    ).trim();
    const stripped = token.replace(/^Bearer\s+/iu, '').trim();
    const authenticated = stripped === 'demo';
    return {
      ok: true,
      wave: WAVE,
      stub: true,
      authenticated,
      message: authenticated
        ? 'Authenticated (soft stub: token===demo).'
        : 'Not authenticated (soft stub expects token===demo).',
      note: 'Token is never echoed.',
    };
  }

  function contextPayload(input) {
    const query = String((input && (input.query || input.q || input.text)) || '').trim();
    return {
      ok: true,
      wave: WAVE,
      stub: true,
      kind: 'context_engine',
      query: query || null,
      items: query
        ? [{ id: 'demo-1', score: 0.42, snippet: `Soft context match for "${query}"` }]
        : [],
      message: 'Soft context engine stub — no real recall backend.',
    };
  }

  function slackActionPayload(input) {
    const action = String((input && (input.action || input.type || input.name)) || 'demo_action').trim();
    return {
      ok: true,
      wave: WAVE,
      stub: true,
      action,
      handled: true,
      message: `Soft Slack action stub handled "${action}" — no Slack API call.`,
    };
  }

  function middlewareNotePayload() {
    return {
      ok: true,
      wave: WAVE,
      middlewareRegistered,
      event: 'agent.after_turn',
      surfaceIncludes: surface.includes('registerMiddleware'),
      message: middlewareRegistered
        ? 'registerMiddleware("agent.after_turn") was called at register time (soft log only).'
        : 'registerMiddleware was not available on ctx; middleware not registered.',
    };
  }

  // ── Always bindCapability (required for load) ──

  ctx.bindCapability('demo.showcase.status', async () => ({
    output: statusPayload(),
  }));

  ctx.bindCapability('demo.showcase.ping', async ({ input }) => ({
    output: pingPayload(input || {}),
  }));

  ctx.bindCapability('demo.showcase.skill', async ({ input }) => ({
    output: skillPayload(input || {}),
  }));

  ctx.bindCapability('demo.showcase.cli', async ({ input }) => ({
    output: cliPayload(input || {}),
  }));

  ctx.bindCapability('demo.showcase.auxiliary', async ({ input }) => ({
    output: auxiliaryPayload(input || {}),
  }));

  ctx.bindCapability('demo.showcase.web_search', async ({ input }) => ({
    output: webSearchPayload(input || {}),
  }));

  ctx.bindCapability('demo.showcase.browser', async ({ input }) => ({
    output: browserPayload(input || {}),
  }));

  ctx.bindCapability('demo.showcase.image_gen', async ({ input }) => ({
    output: imageGenPayload(input || {}),
  }));

  ctx.bindCapability('demo.showcase.video_gen', async ({ input }) => ({
    output: videoGenPayload(input || {}),
  }));

  ctx.bindCapability('demo.showcase.tts', async ({ input }) => ({
    output: ttsPayload(input || {}),
  }));

  ctx.bindCapability('demo.showcase.transcription', async ({ input }) => ({
    output: transcriptionPayload(input || {}),
  }));

  ctx.bindCapability('demo.showcase.secret', async () => ({
    output: await secretPayload(),
  }));

  ctx.bindCapability('demo.showcase.auth', async ({ input }) => ({
    output: authPayload(input || {}),
  }));

  ctx.bindCapability('demo.showcase.context', async ({ input }) => ({
    output: contextPayload(input || {}),
  }));

  ctx.bindCapability('demo.showcase.slack_action', async ({ input }) => ({
    output: slackActionPayload(input || {}),
  }));

  ctx.bindCapability('demo.showcase.middleware_note', async () => ({
    output: middlewareNotePayload(),
  }));

  // ── Optional specialized registrars (soft) ──
  // Specialized handlers return raw payloads; host re-binds capability as { output }.

  softRegister(ctx, surface, logger, 'registerSkill', () => {
    ctx.registerSkill({
      kind: 'skill',
      id: 'demo-showcase-skill',
      capabilityId: 'demo.showcase.skill',
      label: 'Demo Showcase Skill',
      metadata: { wave: WAVE, pack: 'lifestyle', stub: true },
      handler: async (input) => skillPayload(input || {}),
    });
  });

  softRegister(ctx, surface, logger, 'registerCliCommand', () => {
    ctx.registerCliCommand({
      kind: 'cli_command',
      id: 'demo-showcase-cli',
      capabilityId: 'demo.showcase.cli',
      label: 'Demo Showcase CLI',
      metadata: { wave: WAVE, pack: 'lifestyle', stub: true },
      handler: async (input) => cliPayload(input || {}),
    });
  });

  softRegister(ctx, surface, logger, 'registerAuxiliaryTask', () => {
    ctx.registerAuxiliaryTask({
      kind: 'auxiliary_task',
      id: 'demo-showcase-auxiliary',
      capabilityId: 'demo.showcase.auxiliary',
      label: 'Demo Showcase Auxiliary',
      metadata: { wave: WAVE, pack: 'lifestyle', stub: true },
      handler: async (input) => auxiliaryPayload(input || {}),
    });
  });

  softRegister(ctx, surface, logger, 'registerWebSearchProvider', () => {
    ctx.registerWebSearchProvider({
      kind: 'web_search',
      id: 'demo-showcase',
      capabilityId: 'demo.showcase.web_search',
      label: 'Demo Showcase Web Search',
      metadata: { wave: WAVE, pack: 'lifestyle', stub: true },
      handler: async (input) => webSearchPayload(input || {}),
    });
  });

  softRegister(ctx, surface, logger, 'registerBrowserProvider', () => {
    ctx.registerBrowserProvider({
      kind: 'browser',
      id: 'demo-showcase',
      capabilityId: 'demo.showcase.browser',
      label: 'Demo Showcase Browser',
      metadata: { wave: WAVE, pack: 'lifestyle', stub: true },
      handler: async (input) => browserPayload(input || {}),
    });
  });

  softRegister(ctx, surface, logger, 'registerImageGenProvider', () => {
    ctx.registerImageGenProvider({
      kind: 'image_gen',
      id: 'demo-showcase',
      capabilityId: 'demo.showcase.image_gen',
      label: 'Demo Showcase Image Gen',
      metadata: { wave: WAVE, pack: 'lifestyle', stub: true },
      handler: async (input) => imageGenPayload(input || {}),
    });
  });

  softRegister(ctx, surface, logger, 'registerVideoGenProvider', () => {
    ctx.registerVideoGenProvider({
      kind: 'video_gen',
      id: 'demo-showcase',
      capabilityId: 'demo.showcase.video_gen',
      label: 'Demo Showcase Video Gen',
      metadata: { wave: WAVE, pack: 'lifestyle', stub: true },
      handler: async (input) => videoGenPayload(input || {}),
    });
  });

  softRegister(ctx, surface, logger, 'registerTtsProvider', () => {
    ctx.registerTtsProvider({
      kind: 'tts',
      id: 'demo-showcase',
      capabilityId: 'demo.showcase.tts',
      label: 'Demo Showcase TTS',
      metadata: { wave: WAVE, pack: 'lifestyle', stub: true },
      handler: async (input) => ttsPayload(input || {}),
    });
  });

  softRegister(ctx, surface, logger, 'registerTranscriptionProvider', () => {
    ctx.registerTranscriptionProvider({
      kind: 'transcription',
      id: 'demo-showcase',
      capabilityId: 'demo.showcase.transcription',
      label: 'Demo Showcase Transcription',
      metadata: { wave: WAVE, pack: 'lifestyle', stub: true },
      handler: async (input) => transcriptionPayload(input || {}),
    });
  });

  softRegister(ctx, surface, logger, 'registerSecretSource', () => {
    ctx.registerSecretSource({
      kind: 'secret_source',
      id: 'demo-showcase',
      capabilityId: 'demo.showcase.secret',
      label: 'Demo Showcase Secret Source',
      metadata: { wave: WAVE, pack: 'lifestyle', stub: true, env: SECRET_ENV },
      handler: async () => secretPayload(),
    });
  });

  softRegister(ctx, surface, logger, 'registerDashboardAuthProvider', () => {
    ctx.registerDashboardAuthProvider({
      kind: 'dashboard_auth',
      id: 'demo-showcase',
      capabilityId: 'demo.showcase.auth',
      label: 'Demo Showcase Auth',
      metadata: { wave: WAVE, pack: 'lifestyle', stub: true, scheme: 'demo' },
      handler: async (input) => authPayload(input || {}),
    });
  });

  softRegister(ctx, surface, logger, 'registerContextEngine', () => {
    ctx.registerContextEngine({
      kind: 'context_engine',
      id: 'demo-showcase',
      capabilityId: 'demo.showcase.context',
      label: 'Demo Showcase Context Engine',
      metadata: { wave: WAVE, pack: 'lifestyle', stub: true },
      handler: async (input) => contextPayload(input || {}),
    });
  });

  softRegister(ctx, surface, logger, 'registerSlackActionHandler', () => {
    ctx.registerSlackActionHandler({
      kind: 'slack_action',
      id: 'demo-showcase',
      capabilityId: 'demo.showcase.slack_action',
      label: 'Demo Showcase Slack Action',
      metadata: { wave: WAVE, pack: 'lifestyle', stub: true },
      handler: async (input) => slackActionPayload(input || {}),
    });
  });

  softRegister(ctx, surface, logger, 'registerMiddleware', () => {
    ctx.registerMiddleware('agent.after_turn', async ({ context }) => {
      try {
        logger.debug('demo-showcase agent.after_turn', {
          turn: context && context.turnId != null ? context.turnId : null,
          wave: WAVE,
        });
      } catch {
        /* soft log only */
      }
    });
    middlewareRegistered = true;
  });

  // Explicitly do NOT call registerPlatform / bindChannel (diagnostics moduleKind).

  logger.info('demo-showcase registered', {
    wave: WAVE,
    surface: surface.slice(),
    capabilityCount: CAPABILITY_IDS.length,
    specializedAttempted: SPECIALIZED_ATTEMPTS.length,
  });
}

/**
 * Soft-call a specialized registrar if present on ctx; track name on surface.
 * @param {object} ctx
 * @param {string[]} surface
 * @param {{ warn: Function }} logger
 * @param {string} name
 * @param {() => void} fn
 */
function softRegister(ctx, surface, logger, name, fn) {
  if (typeof ctx[name] !== 'function') {
    return;
  }
  try {
    fn();
    surface.push(name);
  } catch (error) {
    logger.warn(`demo-showcase: ${name} soft-failed`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

module.exports = { register };
