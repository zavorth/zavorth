import {
  EXPERIENCE_PROFILE_SELECTION_CONTRACT_VERSION,
  type ExperienceAction,
  type ExperienceProfileOption,
  type ExperienceProfileSelection,
  type ExperienceSurface,
} from './ExperienceContracts.js';
import type { ProfileRuntimeBundle } from '../../contracts/ProfileManifestContract.js';

export type ProfileSelectionInput = {
  surface: ExperienceSurface;
  requestedProfileId?: string | null;
  persistedProfileId?: string | null;
  profiles: ProfileRuntimeBundle[];
};

export class ProfileSelectionService {
  public build(input: ProfileSelectionInput): ExperienceProfileSelection {
    const requestedProfileId = normalizeProfileId(input.requestedProfileId);
    const persistedProfileId = normalizeProfileId(input.persistedProfileId);
    const profiles = uniqueProfiles(input.profiles);
    const requested = profiles.find((profile) => profile.id.toLowerCase() === requestedProfileId) || null;
    const persisted = profiles.find((profile) => profile.id.toLowerCase() === persistedProfileId) || null;
    const fallback = profiles.find((profile) => profile.id === 'developer')
      || profiles.find((profile) => profile.surfacePolicy.allowed.includes(input.surface))
      || profiles[0]
      || null;
    const active = requested || persisted || fallback;
    const source = requested ? 'requested'
      : persisted ? 'persisted'
        : fallback ? 'default'
          : 'missing';
    const options = profiles.map((profile) => this.toOption(profile, input.surface, profile.id === active?.id));
    const warnings = [
      requestedProfileId && !requested ? `Profile "${requestedProfileId}" was not found.` : '',
      active && !surfaceAllowed(active, input.surface) ? `Profile "${active.id}" is not intended for ${input.surface}; default surface is ${active.surfacePolicy.default}.`
        : '',
    ].filter(Boolean);

    return {
      contractVersion: EXPERIENCE_PROFILE_SELECTION_CONTRACT_VERSION,
      activeProfileId: active?.id || null,
      requestedProfileId: requestedProfileId || null,
      persistedProfileId: persistedProfileId || null,
      source,
      surface: input.surface,
      options,
      warnings,
      actions: this.buildActions(options, active?.id || null),
    };
  }

  private toOption(profile: ProfileRuntimeBundle, surface: ExperienceSurface, active: boolean): ExperienceProfileOption {
    return {
      id: profile.id,
      label: profile.label,
      description: profile.description || 'Declarative Zavorth profile.',
      active,
      availableOnSurface: surfaceAllowed(profile, surface),
      defaultSurface: profile.surfacePolicy.default,
      allowedSurfaces: profile.surfacePolicy.allowed,
      trustMode: profile.runtimePolicy.trustMode,
      autonomy: profile.cognitivePolicy.autonomy,
      memoryMode: profile.memoryPolicy.mode,
      planningDepth: profile.cognitivePolicy.planningDepth,
      command: `zavorth profile use ${profile.id}`,
    };
  }

  private buildActions(options: ExperienceProfileOption[], activeProfileId: string | null): ExperienceAction[] {
    const actions = options.slice(0, 6).map((option) => ({
      id: `profile.use:${option.id}`,
      label: option.active ? `Using ${option.label}` : `Use ${option.label}`,
      kind: 'context' as const,
      command: option.command,
      route: null,
      risk: 'safe' as const,
      requiresApproval: false,
      reason: option.active ? 'This declarative profile is active for the current surface.'
        : `Switches cognitive style, runtime limits and surface guidance to ${option.label}.`,
    }));
    if (activeProfileId) {
      actions.push({
        id: 'profile.reset',
        label: 'Reset profile preference',
        kind: 'context',
        command: 'zavorth profile reset',
        route: null,
        risk: 'safe',
        requiresApproval: false,
        reason: 'Return to the default profile selection for this surface.',
      });
    }
    return actions;
  }
}

function surfaceAllowed(profile: ProfileRuntimeBundle, surface: ExperienceSurface): boolean {
  const allowed = profile.surfacePolicy.allowed || [];
  return allowed.length === 0 || allowed.includes(surface);
}

function normalizeProfileId(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

function uniqueProfiles(profiles: ProfileRuntimeBundle[]): ProfileRuntimeBundle[] {
  const seen = new Set<string>();
  return profiles.filter((profile) => {
    const id = profile.id.toLowerCase();
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
