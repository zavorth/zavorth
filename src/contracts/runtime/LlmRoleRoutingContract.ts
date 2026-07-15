export type LlmRoleName = 'default' | 'strong' | 'background';

export type LlmRoleBinding = {
  provider: string;
  model: string;
};

export type LlmTaskStrongBindings = {
  code?: LlmRoleBinding | null;
  research?: LlmRoleBinding | null;
};

export type LlmRoleTelemetry = {
  turnsDefault: number;
  turnsStrong: number;
  turnsBackground: number;
  setupPromptsShown: number;
  setupCompleted: number;
  setupDeferred: number;
  nearestConfirmations: number;
  strongFallbackUses: number;
};

export type LlmRoleRoutingConfig = {
  version: 1;
  default: LlmRoleBinding | null;
  strong: LlmRoleBinding | null;
  background: LlmRoleBinding | null;
  taskStrong: LlmTaskStrongBindings;
  strongOnDefaultFailure: boolean;
  rolesConfigured: boolean;
  promptDismissedAt: string | null;
  lastPromptedAt: string | null;
  lastPromptSurface: string | null;
  awaitingSetup: boolean;
  forceStrongUntil: string | null;
  pendingConfirmation: LlmRolePendingConfirmation | null;
  modelSwitchEvents: LlmModelSwitchEvent[];
  lastUsableProviders: string[];
  telemetry: LlmRoleTelemetry;
  updatedAt: string;
  source: 'chat' | 'slash' | 'ui' | 'system' | 'import' | null;
};

export type LlmRolePendingConfirmation = {
  kind: 'nearest_match' | 'family_proposal';
  proposed: {
    default?: LlmRoleBinding | null;
    strong?: LlmRoleBinding | null;
    background?: LlmRoleBinding | null;
  };
  userUtterance: string;
  createdAt: string;
};

export type LlmModelSwitchEvent = {
  at: string;
  provider: string;
  model: string;
  family: string;
  surface?: string | null;
};

export type LlmRoleResolveRequest = {
  role?: LlmRoleName | null;
  forceStrong?: boolean | null;
  effortHigh?: boolean | null;
  taskKind?: string | null;
  defaultFailed?: boolean | null;
};

export type LlmRoleResolveResult = {
  role: LlmRoleName;
  providerName: string;
  modelName: string | undefined;
  reason: string;
  binding: LlmRoleBinding | null;
};

export type LlmRoleSetupParseResult = {
  intent: 'set' | 'defer' | 'one_for_both' | 'unclear' | 'confirm_yes' | 'confirm_no';
  defaultProvider?: string | null;
  defaultModel?: string | null;
  strongProvider?: string | null;
  strongModel?: string | null;
  backgroundProvider?: string | null;
  backgroundModel?: string | null;
  strongOnDefaultFailure?: boolean | null;
  note?: string | null;
};

export type LlmRoleHealthIssue = {
  code: string;
  severity: 'info' | 'warn' | 'error';
  message: string;
};

export function createEmptyLlmRoleTelemetry(): LlmRoleTelemetry {
  return {
    turnsDefault: 0,
    turnsStrong: 0,
    turnsBackground: 0,
    setupPromptsShown: 0,
    setupCompleted: 0,
    setupDeferred: 0,
    nearestConfirmations: 0,
    strongFallbackUses: 0,
  };
}

export function createEmptyLlmRoleRoutingConfig(now = new Date().toISOString()): LlmRoleRoutingConfig {
  return {
    version: 1,
    default: null,
    strong: null,
    background: null,
    taskStrong: {},
    strongOnDefaultFailure: false,
    rolesConfigured: false,
    promptDismissedAt: null,
    lastPromptedAt: null,
    lastPromptSurface: null,
    awaitingSetup: false,
    forceStrongUntil: null,
    pendingConfirmation: null,
    modelSwitchEvents: [],
    lastUsableProviders: [],
    telemetry: createEmptyLlmRoleTelemetry(),
    updatedAt: now,
    source: null,
  };
}

/**
 * Normalize any chat surface id (current or future). Not a whitelist —
 * unknown surfaces still work and keep a stable key for telemetry/prompt labels.
 */
export function normalizeRoleSurface(surface?: string | null): string {
  const raw = String(surface || '')
    .trim()
    .toLowerCase();
  if (!raw) return 'unknown';
  return (
    raw
      .replace(/[\s/\\]+/g, '-')
      .replace(/[^a-z0-9._:@-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^[-_.]+|[-_.]+$/g, '')
      .slice(0, 64) || 'unknown'
  );
}

/** Human label for prompts shown on the active surface. */
export function formatRoleSurfaceLabel(surface?: string | null): string {
  const key = normalizeRoleSurface(surface);
  if (key === 'unknown') return 'this chat';
  return key.replace(/[-_]+/g, ' ');
}

/**
 * User-centric scope so the same person keeps roles across Telegram, Discord,
 * WhatsApp, Desktop, Control, CLI, ACP, and any future surface.
 * Surface is only used when no user id is available (anonymous surface scope).
 */
export function resolveLlmRoleScopeId(input: { userId?: string | null; surface?: string | null }): string {
  const user = String(input.userId || '').trim();
  if (user) {
    return `user:${user.replace(/[^a-zA-Z0-9._:@-]+/g, '_').slice(0, 100)}`;
  }
  const surface = normalizeRoleSurface(input.surface || 'global');
  return `surface:${surface}`;
}
