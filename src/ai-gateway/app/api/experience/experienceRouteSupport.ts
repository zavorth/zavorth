/**
 * Hot-path experience route support module.
 *
 * Model-owned free text only; never keyword-routes product features from free text.
 * Experience surface command routing lives in the experience route handler layer.
 */

export type ExperienceRouteContext = {
  route: 'home' | 'chat-v1' | 'actions' | string;
  source: string;
};

export function resolveExperienceRouteContext(input: Partial<ExperienceRouteContext>): ExperienceRouteContext {
  return {
    route: typeof input.route === 'string' ? input.route : 'home',
    source: typeof input.source === 'string' ? input.source : 'unknown',
  };
}

export type ExperienceCommandInput = {
  text: string;
  requestedBy?: string;
  responseProfile?: string;
  metadata?: Record<string, unknown> | null;
};

export type ExperienceCommand = {
  text: string;
  requestedBy: string;
  responseProfile: string | undefined;
  metadata: Record<string, unknown>;
};

const ALLOWED_METADATA_KEYS = new Set([
  'client',
  'model',
  'effort',
  'profileConfig',
  'source',
  'requestedBy',
  'responseProfile',
]);

new Set(['source', 'requestedBy', 'responseProfile']);

export function buildExperienceCommand(input: ExperienceCommandInput): ExperienceCommand {
  const text = String(input.text || '').trim();
  const requestedBy = String(input.requestedBy || 'control-ui');
  const responseProfile = input.responseProfile ? String(input.responseProfile) : undefined;

  const rawMetadata = input.metadata && typeof input.metadata === 'object' ? input.metadata : {};
  const filtered: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rawMetadata)) {
    if (ALLOWED_METADATA_KEYS.has(key)) {
      filtered[key] = value;
    }
  }

  filtered.source = 'api/experience';
  filtered.requestedBy = requestedBy;
  if (responseProfile !== undefined) {
    filtered.responseProfile = responseProfile;
  }

  return {
    text,
    requestedBy,
    responseProfile,
    metadata: filtered,
  };
}

export function resolveExperienceRouteContext(input: Partial<ExperienceRouteContext>): ExperienceRouteContext {
  return {
    route: typeof input.route === 'string' ? input.route : 'home',
    source: typeof input.source === 'string' ? input.source : 'unknown',
  };
}

export type ExperienceRouteContext = {
  route: 'home' | 'chat-v1' | 'actions' | string;
  source: string;
};