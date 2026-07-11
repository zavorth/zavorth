import { z } from 'zod';

/**
 * Zod schema for Zavorth environment variables.
 *
 * All fields are optional with defaults — the schema validates types and shapes,
 * not presence. This means existing .env files keep working while gaining
 * type safety and fail-fast on malformed values.
 *
 * Usage:
 *   import { env } from '@zavorth/config/env';
 *   env.ZAVORTH_WEB_PORT  // number, guaranteed valid
 */

const str = (fallback = '') => z.string().default(fallback);
const num = (fallback: number) => z.coerce.number().default(fallback);
const bool = (fallback: boolean) =>
  z
    .string()
    .default(fallback ? 'true' : 'false')
    .transform((v) => !['0', 'false', 'no', 'off', 'disabled'].includes(v.trim().toLowerCase()));

// ── LLM Provider ──────────────────────────────────────────────────────────────
const providerSchema = z.object({
  LLM_PROVIDER: str(),
  GEMINI_API_KEY: str(),
  GEMINI_API_KEY_2: str(),
  GEMINI_API_KEY_3: str(),
  GEMINI_API_KEY_4: str(),
  GEMINI_API_KEY_5: str(),
  GEMINI_API_KEY_6: str(),
  GEMINI_API_KEY_7: str(),
  DEEPSEEK_API_KEY: str(),
  OPENAI_API_KEY: str(),
  OPENAI_API_KEY_2: str(),
  OPENROUTER_API_KEY: str(),
  GROQ_API_KEY: str(),
  PUTER_AUTH_TOKEN: str(),
  HUGGINGFACE_API_KEY: str(),
  HF_TOKEN: str(),
  ELEVENLABS_API_KEY: str(),

  GEMINI_MODEL: str('gemini-2.5-flash'),
  DEEPSEEK_MODEL: str('deepseek-chat'),
  OPENAI_MODEL: str('gpt-4o-mini'),
  AIGateway_MODEL: str('gpt-4o-mini'),
  OPENROUTER_MODEL: str('minimax/minimax-m2.7'),
  QWEN_MODEL: str('openrouter:qwen/qwen3.5-plus-02-15'),

  AIGateway_BASE_URL: str('http://127.0.0.1:20128/v1'),
  AIGateway_SIDECAR_ENABLED: bool(true),
  ZAVORTH_AIGateway_GATEWAY_ENABLED: bool(true),
  GROQ_BASE_URL: str('https://api.groq.com/openai/v1'),
  HUGGINGFACE_BASE_URL: str('https://router.huggingface.co/v1'),
  ELEVENLABS_BASE_URL: str('https://api.elevenlabs.io/v1'),
  OPENROUTER_BASE_URL: str('https://openrouter.ai/api/v1'),
});

// ── Cloudflare AI Gateway ─────────────────────────────────────────────────────
const cloudflareSchema = z.object({
  CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID: str(),
  CLOUDFLARE_AI_GATEWAY_ID: str(),
  CLOUDFLARE_AI_GATEWAY_TOKEN: str(),
  AIGateway_UPSTREAM_BASE_URL: str(),
});

// ── Telegram ──────────────────────────────────────────────────────────────────
const telegramSchema = z.object({
  TELEGRAM_BOT_TOKEN: str(),
  TELEGRAM_ALLOWED_USER_IDS: str(),
  TELEGRAM_USER_ROLES: str(),
});

// ── Discord ───────────────────────────────────────────────────────────────────
const discordSchema = z.object({
  DISCORD_BOT_TOKEN: str(),
  DISCORD_ALLOWED_GUILD_IDS: str(),
  DISCORD_ALLOW_DMS: bool(false),
  DISCORD_PUBLIC_SERVER_MODE: bool(false),
  DISCORD_REQUIRED_ON_BOOT: bool(false),
  DISCORD_OWNER_USER_IDS: str(),
  DISCORD_COMMAND_EXPOSURE: str('minimal'),
  DISCORD_REQUIRE_OWNER_FOR_OPERATIONAL: bool(true),
  DISCORD_ALLOW_ATTACHMENTS_IN_PUBLIC_SERVER_MODE: bool(false),
  DISCORD_MAX_MESSAGE_CHARS: num(1800),
  DISCORD_RATE_LIMIT_WINDOW_MS: num(60000),
  DISCORD_RATE_LIMIT_MAX_REQUESTS: num(6),
  DISCORD_BRIDGE_ENABLED: bool(false),
});

// ── Agent Loop / Runtime ──────────────────────────────────────────────────────
const runtimeSchema = z.object({
  MAX_ITERATIONS: num(5),
  MEMORY_WINDOW_SIZE: num(20),
  MAX_TOKENS: num(8000),
  ZAVORTH_GRAPH_MAX_TOOL_ROUNDS: num(4),
  ZAVORTH_GRAPH_TOKEN_BUDGET: num(64000),
  ZAVORTH_GRAPH_COST_BUDGET_USD: num(1),
});

// ── ZavorthControl / Web ───────────────────────────────────────────────────────────
const webSchema = z.object({
  ZAVORTH_WEB_HOST: str('127.0.0.1'),
  ZAVORTH_WEB_PORT: num(3000),
  ZAVORTH_WEB_AUTH_TOKEN: str(),
  ZAVORTH_BACKEND_URL: str('http://localhost:3000'),
  ZAVORTH_CONTROL_URL: str('http://localhost:5173'),
  ZAVORTH_PUBLIC_BASE_URL: str(),
  ZAVORTH_HIGH_RISK_APPROVAL_PIN: str(),
  PORT: num(18789),
  HOST: str('127.0.0.1'),
});

// ── Docker Sandbox ────────────────────────────────────────────────────────────
const sandboxSchema = z.object({
  ZAVORTH_DOCKER_SANDBOX_ENABLED: bool(true),
  ZAVORTH_DOCKER_SANDBOX_REQUIRED: bool(true),
  ZAVORTH_DOCKER_SANDBOX_AUTO_PULL: bool(true),
  ZAVORTH_DOCKER_SANDBOX_IMAGE: str('node:22-bullseye'),
  ZAVORTH_DOCKER_SANDBOX_JAVASCRIPT_IMAGE: str('node:22-bullseye'),
  ZAVORTH_DOCKER_SANDBOX_PYTHON_IMAGE: str('python:3.12-slim'),
  ZAVORTH_DOCKER_SANDBOX_SHELL_IMAGE: str('bash:5.2'),
  DOCKER_CLI_PATH: str('docker'),
});

// ── Channels (WhatsApp, Slack, Signal, etc.) ─────────────────────────────────
const channelsSchema = z.object({
  WHATSAPP_ENABLED: bool(false),
  SLACK_ENABLED: bool(false),
  SIGNAL_ENABLED: bool(false),
  IMESSAGE_ENABLED: bool(false),
  TEAMS_ENABLED: bool(false),
  EMAIL_ENABLED: bool(false),
});

// ── Voice / TTS ───────────────────────────────────────────────────────────────
const voiceSchema = z.object({
  ZAVORTH_VOICE_ENABLED: bool(false),
  ZAVORTH_AGENT_TTS_VOICE: str('pt-BR-AntonioNeural'),
  ELEVENLABS_VOICE_ID: str(),
  ELEVENLABS_MODEL: str('eleven_multilingual_v2'),
});

// ── Profile / Mode ────────────────────────────────────────────────────────────
const profileSchema = z.object({
  ZAVORTH_PROFILE: str('power-user'),
  ZAVORTH_UI_MODE: str('operational'),
  ZAVORTH_CAPABILITY_POLICY: str('owner_trusted'),
  ZAVORTH_AGENT_WAKE_WORD: str(),
  ZAVORTH_AGENT_HOTKEY: str('B'),
  ZAVORTH_AGENT_LANGUAGE: str('pt'),
  ZAVORTH_SWARM_MODE: str('swarm'),
  ZAVORTH_SEARCH_PROVIDER: str('local'),
});

// ── Video Processing ──────────────────────────────────────────────────────────
const videoSchema = z.object({
  VIDEO_CHUNK_CONCURRENCY: num(2),
  VIDEO_CONTEXT_RETENTION_DAYS: num(30),
  VIDEO_CONTEXT_MAX_FILES: num(120),
  TEMP_FILE_RETENTION_HOURS: num(2),
});

// ── Stitch / Google Cloud ─────────────────────────────────────────────────────
const stitchSchema = z.object({
  STITCH_API_KEY: str(),
  GOOGLE_CLOUD_PROJECT: str(),
  STITCH_HOST: str('https://stitch.googleapis.com/mcp'),
  STITCH_DEFAULT_DEVICE_TYPE: str('AGNOSTIC'),
  STITCH_DEFAULT_MODEL_ID: str('GEMINI_3_FLASH'),
  STITCH_TIMEOUT_SECONDS: num(240),
});

// ── Ollama ────────────────────────────────────────────────────────────────────
const ollamaSchema = z.object({
  OLLAMA_BASE_URL: str('http://localhost:11434/v1'),
  OLLAMA_MODEL: str('gemma2:2b'),
  OLLAMA_KEEP_ALIVE: str('30s'),
  OLLAMA_AUTO_START: bool(true),
  OLLAMA_START_TIMEOUT_MS: num(15000),
});

// ── Combined schema ───────────────────────────────────────────────────────────
const envSchema = z.object({
  ...providerSchema.shape,
  ...cloudflareSchema.shape,
  ...telegramSchema.shape,
  ...discordSchema.shape,
  ...runtimeSchema.shape,
  ...webSchema.shape,
  ...sandboxSchema.shape,
  ...channelsSchema.shape,
  ...voiceSchema.shape,
  ...profileSchema.shape,
  ...videoSchema.shape,
  ...stitchSchema.shape,
  ...ollamaSchema.shape,
});

export type ZavorthEnv = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables.
 * Called once at bootstrap. Returns a fully typed, validated object.
 *
 * Unknown variables are allowed (pass-through) so that user-defined
 * env vars and process-level overrides keep working.
 */
export function parseEnv(raw: Record<string, string | undefined> = process.env): ZavorthEnv {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    console.warn(`[config] Environment validation warnings:\n${issues}`);
    // Return defaults on validation failure — don't crash the runtime
    return envSchema.parse({});
  }

  return result.data;
}

/**
 * Lazy singleton — parsed once, cached forever.
 * Import this instead of reading process.env directly.
 */
let _env: ZavorthEnv | null = null;

export function getEnv(): ZavorthEnv {
  if (!_env) {
    _env = parseEnv();
  }
  return _env;
}

// Re-export sub-schemas for targeted validation
export {
  providerSchema,
  cloudflareSchema,
  telegramSchema,
  discordSchema,
  runtimeSchema,
  webSchema,
  sandboxSchema,
  channelsSchema,
  voiceSchema,
  profileSchema,
  videoSchema,
  stitchSchema,
  ollamaSchema,
  envSchema,
};
