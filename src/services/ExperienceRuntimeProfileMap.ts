export const EXPERIENCE_TO_RUNTIME_PROFILE_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  personal: 'personal',
  creator: 'creator',
  developer: 'developer',
  business: 'business',
  power: 'power',
  operator: 'operator',
  team: 'team',
});

export function resolveRuntimeProfileId(profileId: string | null | undefined): string {
  const normalized = String(profileId ?? '').trim().toLowerCase();
  if (!normalized) return 'personal';
  return EXPERIENCE_TO_RUNTIME_PROFILE_ALIASES[normalized] || normalized;
}

export function listExperienceRuntimeProfileIds(): string[] {
  return Object.keys(EXPERIENCE_TO_RUNTIME_PROFILE_ALIASES);
}
