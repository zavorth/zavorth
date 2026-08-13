/**
 * Pure helpers for native tool-loop exposure profiles (safe / daily-ops / full).
 * Keeps MAX caps, always-expose sets, and profile name resolution unit-testable.
 */

export type ToolExposureProfileName = 'safe' | 'daily-ops' | 'full';

export const SAFE_MAX_EXPOSED_TOOLS = 12;
/** leaner daily-ops hot path (was 24). */
export const DAILY_OPS_MAX_EXPOSED_TOOLS = 18;
export const FULL_MAX_EXPOSED_TOOLS = 40;

/**
 * bulk marketplace/install tools — not always-exposed on daily-ops hot path.
 * Reach via capability-miss (`plugin_suggest`) or full profile / explicit approve.
 * Env ZAVORTH_TOOL_EXPOSURE_INCLUDE_MARKETPLACE=1 re-includes them in preferred set.
 */
export const HOT_PATH_DEFERRED_BULK_TOOLS = new Set(['zavorth_skill_marketplace', 'zavorth_mcp_marketplace']);

/** Baseline always-safe set used by the default "safe" profile (legacy hard-coded 12). */
export const SAFE_ALWAYS_EXPOSE_TOOLS = new Set([
  'read_file',
  'list_directory',
  'workspace.read',
  'workspace.list',
  'get_datetime',
  'zavorth_action',
  'session_search',
  'zavorth_session_search',
  'sessions.search',
  'zavorth_tool_catalog',
  'zavorth_tool_plan',
]);

/**
 * Daily-ops preferred + always-include names when present in definitions.
 * Synthetic catalog/planner tools stay included via SAFE_ALWAYS_EXPOSE_TOOLS.
 */
/**
 * Daily-ops preferred + always-include names when present in definitions.
 * skill install mesh + worker mesh surfaces are first-class for operators.
 */
export const DAILY_OPS_PREFERRED_TOOLS = new Set([
  'read_file',
  'list_directory',
  'workspace.read',
  'workspace.list',
  'get_datetime',
  'zavorth_action',
  'plugin_recommend',
  'plugin_suggest',
  // Worker mesh (lean) — marketplace deferred to miss/suggest unless INCLUDE_MARKETPLACE
  'agent_manager',
  'zavorth_delegate',
  'search_query',
  'search_status',
  'web_search',
  'doctor_run',
  'doctor_env',
  'security_scan',
  'secrets_scan',
  'secrets_scan_path',
  'github_status',
  'github_pr_list',
  'github_issue_list',
  'pr_ship_status',
  'pr_ship_diff',
  'pr_ship_checklist',
  'pr_ship_draft',
  'ci_status',
  'ci_latest',
  'ci_failed',
  'task_status',
  'task_list',
  'task_add',
  'task_move',
  'task_complete',
  'memory_get',
  'memory_search',
  'memory_write',
  'recall_search',
  'recall_recent',
  'cost_summary',
  'session_search',
  'zavorth_session_search',
  'sessions.search',
]);

function includeMarketplaceOnHotPath(): boolean {
  const raw = String(process.env.ZAVORTH_TOOL_EXPOSURE_INCLUDE_MARKETPLACE || '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

/** True when tool is deferred from lean daily-ops always-expose. */
export function isHotPathDeferredBulkTool(toolName: string): boolean {
  const name = normalizeToolName(toolName);
  if (!HOT_PATH_DEFERRED_BULK_TOOLS.has(name)) return false;
  if (includeMarketplaceOnHotPath()) return false;
  return true;
}

/** Product surface tools that daily-ops/full must prefer when registered. */
export const MESH_PRODUCT_SURFACE_TOOLS = [
  'zavorth_skill_marketplace',
  'agent_manager',
  'zavorth_delegate',
  'plugin_suggest',
  'plugin_recommend',
  'zavorth_action',
] as const;

const SAFE_PLUGIN_OBSERVATION_TOKENS = [
  'status',
  'list',
  'search',
  'get',
  'scan',
  'doctor',
  'recommend',
  'suggest',
] as const;

const DESTRUCTIVE_EXACT = new Set([
  'rm',
  'remove',
  'delete',
  'unlink',
  'bash',
  'bash_unsafe',
  'shell.exec',
  'shell_exec',
  'remote_shell',
  'send_mail',
  'send_email',
  'mail.send',
  'forge.apply',
  'forge_apply',
  'plugin.forge.apply',
  'pr_ship_create',
]);

const WRITE_LIKE_EXACT = new Set(['memory_write', 'memory.write']);

function normalizeToolName(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function readProfileCandidate(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/_/g, '-');
}

function profileFromRaw(raw: string): ToolExposureProfileName | null {
  const normalized = raw.trim().toLowerCase().replace(/_/g, '-');
  if (!normalized) return null;
  if (normalized === 'safe' || normalized === 'default' || normalized === 'safe-12') return 'safe';
  if (normalized === 'daily-ops' || normalized === 'dailyops' || normalized === 'daily') return 'daily-ops';
  if (normalized === 'full' || normalized === 'all' || normalized === 'wide') return 'full';
  return null;
}

function metadataProfile(metadata?: Record<string, unknown> | null): string {
  if (!metadata || typeof metadata !== 'object') return '';
  return readProfileCandidate(
    metadata.toolExposureProfile ??       metadata.exposureProfile ??       metadata.tool_exposure_profile ??       metadata.exposure_profile,
  );
}

/**
 * Resolve exposure profile name from request/run metadata and env.
 * Precedence: request metadata > run metadata > env > safe.
 */
export function resolveExposureProfileName(input?: {
  envValue?: string | null;
  requestMetadata?: Record<string, unknown> | null;
  runMetadata?: Record<string, unknown> | null;
  /** Convenience bag used by some call sites (merged after request/run). */
  metadata?: Record<string, unknown> | null;
}): ToolExposureProfileName {
  const candidates = [
    metadataProfile(input?.requestMetadata),
    metadataProfile(input?.runMetadata),
    metadataProfile(input?.metadata),
    readProfileCandidate(input?.envValue),
  ];
  for (const candidate of candidates) {
    const resolved = profileFromRaw(candidate);
    if (resolved) return resolved;
  }
  return 'safe';
}

/** Convenience resolver used by AgentRunNativeToolLoopService. */
export function resolveExposureProfile(input: {
  run?: { metadata?: Record<string, unknown> | null } | null;
  request?: { metadata?: Record<string, unknown> | null } | null;
  envValue?: string | null;
}): ToolExposureProfileName {
  return resolveExposureProfileName({
    requestMetadata: input.request?.metadata ?? null,
    runMetadata: input.run?.metadata ?? null,
    envValue:
      input.envValue ??       (typeof process !== 'undefined' ? process.env.ZAVORTH_TOOL_EXPOSURE_PROFILE : undefined) ??       null,
  });
}

export function resolveMaxExposedTools(profile: ToolExposureProfileName): number {
  if (profile === 'full') return FULL_MAX_EXPOSED_TOOLS;
  if (profile === 'daily-ops') return DAILY_OPS_MAX_EXPOSED_TOOLS;
  return SAFE_MAX_EXPOSED_TOOLS;
}

export function isSafePluginObservationTool(toolName: string): boolean {
  const name = normalizeToolName(toolName);
  if (!name.startsWith('plugin.')) return false;
  const rest = name.slice('plugin.'.length);
  if (!rest) return false;
  // Observation-style verbs in any segment (plugin.foo.status, plugin.search, …).
  const segments = rest.split(/[._:-]+/).filter(Boolean);
  return segments.some((segment) => (SAFE_PLUGIN_OBSERVATION_TOKENS as readonly string[]).includes(segment));
}

export function isDailyOpsPreferredTool(toolName: string): boolean {
  const name = normalizeToolName(toolName);
  if (isHotPathDeferredBulkTool(name)) return false;
  if (includeMarketplaceOnHotPath() && HOT_PATH_DEFERRED_BULK_TOOLS.has(name)) return true;
  if (DAILY_OPS_PREFERRED_TOOLS.has(name)) return true;
  if (SAFE_ALWAYS_EXPOSE_TOOLS.has(name)) return true;
  if (isSafePluginObservationTool(name)) return true;
  // Dotted aliases for underscore preferred names (memory.get ↔ memory_get).
  const underscored = name.replace(/\./g, '_');
  const dotted = name.replace(/_/g, '.');
  if (isHotPathDeferredBulkTool(underscored) || isHotPathDeferredBulkTool(dotted)) return false;
  return DAILY_OPS_PREFERRED_TOOLS.has(underscored) || DAILY_OPS_PREFERRED_TOOLS.has(dotted);
}

/**
 * Whether the tool should be force-included when present in definitions
 * for the given profile (subject to destructive / policy gates in the caller).
 */
export function isProfileAlwaysExpose(profile: ToolExposureProfileName, toolName: string): boolean {
  const name = normalizeToolName(toolName);
  if (!name) return false;
  if (SAFE_ALWAYS_EXPOSE_TOOLS.has(name)) return true;
  if (profile === 'safe') return false;
  // full profile may still prefer deferred bulk tools when registered
  if (profile === 'full' && HOT_PATH_DEFERRED_BULK_TOOLS.has(name)) return true;
  // daily-ops + full share the expanded daily-ops always-include set (minus hot-path deferred)
  if (isDailyOpsPreferredTool(name)) return true;
  return false;
}

/**
 * Destructive tools that must not be auto-exposed unless the approved set contains them.
 */
export function isDestructiveExposureTool(toolName: string): boolean {
  const name = normalizeToolName(toolName);
  if (!name) return false;
  if (DESTRUCTIVE_EXACT.has(name)) return true;
  if (name.includes('forge.apply') || name.endsWith('.forge.apply')) return true;
  if (/(^|[._-])(rm|unlink)($|[._-])/.test(name)) return true;
  if (/(send[_-]?mail|send[_-]?email|mail\.send)/.test(name)) return true;
  if (/(bash_unsafe|shell\.exec|remote_shell|unrestricted[_-]?shell)/.test(name)) return true;
  if (name.includes('pr_ship_create') || name.endsWith('pr.ship.create')) return true;
  return false;
}

export function isWriteLikeExposureTool(toolName: string): boolean {
  const name = normalizeToolName(toolName);
  if (WRITE_LIKE_EXACT.has(name)) return true;
  return name === 'memory_write' || name === 'memory.write';
}

/**
 * Full-profile gate using optional security definition fields.
 * Allows safe + review tools that do not require confirmation; never auto-exposes
 * dangerous/forbidden or confirmation-required tools.
 */
export function isFullProfileSecurityExposable(input: {
  toolName: string;
  defaultRisk?: string | null;
  requiresConfirmation?: boolean | null;
}): boolean {
  const name = normalizeToolName(input.toolName);
  if (!name || isDestructiveExposureTool(name)) return false;
  if (input.requiresConfirmation === true) return false;
  const risk = String(input.defaultRisk || '')
    .trim()
    .toLowerCase();
  if (!risk) {
    // No security definition: do not force-include in full always-path
    // (caller may still expose via approved / safe observation paths).
    return false;
  }
  if (risk === 'forbidden' || risk === 'dangerous' || risk === 'danger') return false;
  return risk === 'safe' || risk === 'review';
}

export function rankingBoostForProfile(profile: ToolExposureProfileName, toolName: string): number {
  if (profile === 'safe') return 0;
  if (isDailyOpsPreferredTool(toolName)) return 25;
  return 0;
}
