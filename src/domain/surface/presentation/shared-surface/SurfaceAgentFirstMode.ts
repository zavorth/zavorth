/**
 * Hermes-style free-text routing: free text always goes to the agent.
 * Surfaces are adapters; none is product-primary.
 *
 * Deterministic only:
 *   - slash commands (/approve, /undo, /help, /remote, …)
 *   - inline callback_data (task:approve:<id>, …)
 *   - HIGH_RISK TOTP challenge replies (6-digit after button)
 *
 * Free text → agent gateway (any language via LLM + tools).
 *
 * Free-text NLU packs (getNluPatterns / priority free-text interceptors) were removed.
 * Kill-switch env vars remain only as no-op compatibility flags (always agent-first for free text).
 */

export type SurfaceAgentFirstMetricsSnapshot = {
  naturalSkippedForAgent: number;
  slashDeterministic: number;
};

const metrics: SurfaceAgentFirstMetricsSnapshot = {
  naturalSkippedForAgent: 0,
  slashDeterministic: 0,
};

function truthyEnv(value: unknown): boolean {
  const v = String(value ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'on' || v === 'yes';
}

function falseyEnv(value: unknown): boolean {
  const v = String(value ?? '').trim().toLowerCase();
  return v === '0' || v === 'false' || v === 'off' || v === 'no';
}

function envExplicitlySet(env: NodeJS.ProcessEnv, key: string): boolean {
  const raw = env[key];
  return raw !== undefined && String(raw).trim() !== '';
}

/**
 * Default-on env flag. Unset → defaultOn. Explicit falsey → false. Explicit truthy → true.
 * Kept for tests/compat; free-text NLU packs no longer exist when false.
 */
export function readDefaultOnFlag(
  env: NodeJS.ProcessEnv,
  key: string,
  defaultOn = true,
): boolean {
  if (!envExplicitlySet(env, key)) return defaultOn;
  if (falseyEnv(env[key])) return false;
  if (truthyEnv(env[key])) return true;
  return defaultOn;
}

/**
 * Free text is always agent-owned (Hermes-style).
 * Env kill switches are accepted for metrics/compat but do not re-enable free-text NLU packs.
 */
export function isTelegramAgentFirstFreeTextEnabled(
  _env: NodeJS.ProcessEnv = process.env,
): boolean {
  return true;
}

/**
 * Free text goes to agent on every surface.
 */
export function isSurfaceAgentFirstEnabled(
  _platform?: string | null,
  _env: NodeJS.ProcessEnv = process.env,
): boolean {
  return true;
}

export function shouldPassNaturalTextToAgent(
  input: {
    platform?: string | null;
    rawText: string;
    hasParsedSlashCommand?: boolean;
  },
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const text = String(input.rawText || '').trim();
  if (!text) return false;
  if (input.hasParsedSlashCommand) return false;
  if (text.startsWith('/')) return false;
  // Always agent for free text (Hermes-style). Env kept only so tests can still call this API.
  void env;
  void input.platform;
  return true;
}

export function recordAgentFirstMetric(
  kind: keyof SurfaceAgentFirstMetricsSnapshot,
): void {
  metrics[kind] += 1;
}

export function getSurfaceAgentFirstMetrics(): SurfaceAgentFirstMetricsSnapshot {
  return { ...metrics };
}

export function resetSurfaceAgentFirstMetrics(): void {
  metrics.naturalSkippedForAgent = 0;
  metrics.slashDeterministic = 0;
}

export function formatSurfaceAgentFirstMetricsText(): string {
  return [
    'Surface routing (Hermes-style):',
    '  mode: free text → agent; slash → deterministic handlers',
    '  free-text NLU packs: removed',
    `  metrics: pass_to_agent=${metrics.naturalSkippedForAgent} slash=${metrics.slashDeterministic}`,
  ].join('\n');
}
