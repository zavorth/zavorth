/**
 * Experience surface IDs → profile-manifest IDs under config/profile-manifests/.
 * business and power are first-class manifests (not silent aliases of operator/team).
 */
export const EXPERIENCE_TO_RUNTIME_PROFILE_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  personal: 'personal',
  creator: 'creator',
  developer: 'developer',
  business: 'business',
  power: 'power',
  operator: 'operator',
  team: 'team',
});

/**
 * Resolve an experience/profile id to a runtime profile-manifest id.
 * Empty/null defaults to `personal` intentionally (default audience).
 * Unknown ids pass through as normalized strings so compile can fail loudly
 * (AgentRunFactory logs profileBundleMissing before any personal fallback).
 */
export function resolveRuntimeProfileId(profileId: string | null | undefined): string {
  const normalized = String(profileId ?? '').trim().toLowerCase();
  if (!normalized) return 'personal';
  return EXPERIENCE_TO_RUNTIME_PROFILE_ALIASES[normalized] || normalized;
}

export function listExperienceRuntimeProfileIds(): string[] {
  return Object.keys(EXPERIENCE_TO_RUNTIME_PROFILE_ALIASES);
}

/** First-run Desktop audience choices (subset of experience ids). */
export const DESKTOP_FIRST_RUN_AUDIENCE_IDS = Object.freeze(['personal', 'developer', 'business'] as const);
export type DesktopFirstRunAudienceId = (typeof DESKTOP_FIRST_RUN_AUDIENCE_IDS)[number];

export function isDesktopFirstRunAudienceId(value: unknown): value is DesktopFirstRunAudienceId {
  return DESKTOP_FIRST_RUN_AUDIENCE_IDS.includes(String(value ?? '').trim().toLowerCase() as DesktopFirstRunAudienceId);
}
