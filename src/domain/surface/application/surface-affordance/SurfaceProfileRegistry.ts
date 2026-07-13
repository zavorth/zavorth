import {
  SURFACE_AFFORDANCE_CONTRACT_VERSION,
  isSurfaceAffordanceEnabled,
  type RegisterSurfaceProfileInput,
  type SurfaceAffordanceId,
  type SurfaceAffordanceLimit,
  type SurfaceAffordanceState,
  type SurfaceChannelId,
  type SurfaceProfile,
  type SurfaceProfilePresetId,
} from '../../../../contracts/surface/SurfaceAffordanceContract.js';
import type { SurfaceRenderTarget } from '../surface-response/SurfaceResponseContract.js';
import {
  getSurfacePresetDefinition,
  isAffordanceStateEnabled,
  resolveAffordances,
} from './SurfaceAffordancePresets.js';

type BuiltinChannelSpec = {
  channel: SurfaceChannelId;
  label: string;
  preset: SurfaceProfilePresetId;
  renderTarget: SurfaceRenderTarget;
  overrides?: RegisterSurfaceProfileInput['overrides'];
};

const BUILTIN_CHANNEL_SPECS: BuiltinChannelSpec[] = [
  {
    channel: 'telegram',
    label: 'Telegram',
    preset: 'chat-interactive',
    renderTarget: 'telegram',
  },
  {
    channel: 'discord',
    label: 'Discord',
    preset: 'chat-interactive',
    renderTarget: 'discord',
    overrides: {
      affordances: {
        inline_buttons: { maxPerRow: 5, maxTotal: 25, callbackBytes: 100 },
        select_menu: true,
      },
      limits: {
        maxActionsPerRow: 5,
        maxButtons: 25,
      },
    },
  },
  {
    channel: 'whatsapp',
    label: 'WhatsApp',
    preset: 'chat-basic',
    renderTarget: 'whatsapp',
  },
  {
    channel: 'signal',
    label: 'Signal',
    preset: 'chat-basic',
    renderTarget: 'signal',
  },
  {
    channel: 'imessage',
    label: 'iMessage',
    preset: 'chat-basic',
    renderTarget: 'imessage',
  },
  {
    channel: 'cli',
    label: 'CLI',
    preset: 'cli',
    renderTarget: 'cli',
  },
  {
    channel: 'web',
    label: 'Web',
    preset: 'rich-app',
    renderTarget: 'web',
  },
  {
    channel: 'desktop',
    label: 'Desktop',
    preset: 'rich-app',
    renderTarget: 'web',
  },
  {
    channel: 'slack',
    label: 'Slack',
    preset: 'chat-basic',
    renderTarget: 'slack',
  },
  {
    channel: 'teams',
    label: 'Teams',
    preset: 'chat-basic',
    renderTarget: 'teams',
  },
  {
    channel: 'email',
    label: 'Email',
    preset: 'chat-basic',
    renderTarget: 'email',
  },
  {
    channel: 'instagram',
    label: 'Instagram',
    preset: 'chat-basic',
    renderTarget: 'instagram',
  },
  {
    channel: 'plain',
    label: 'Plain',
    preset: 'chat-basic',
    renderTarget: 'plain',
  },
];

/** Channel aliases used by F2 / callers (`tg` → telegram, `terminal` → cli). */
const CHANNEL_ALIASES: Record<string, SurfaceChannelId> = {
  telegram: 'telegram',
  tg: 'telegram',
  discord: 'discord',
  whatsapp: 'whatsapp',
  signal: 'signal',
  imessage: 'imessage',
  cli: 'cli',
  terminal: 'cli',
  web: 'web',
  desktop: 'desktop',
  slack: 'slack',
  instagram: 'instagram',
  teams: 'teams',
  email: 'email',
  plain: 'plain',
  text: 'plain',
};

const VALID_CHANNELS = new Set<SurfaceChannelId>(
  BUILTIN_CHANNEL_SPECS.map((spec) => spec.channel),
);

const VALID_RENDER_TARGETS = new Set<SurfaceRenderTarget>([
  'plain',
  'cli',
  'telegram',
  'discord',
  'slack',
  'whatsapp',
  'instagram',
  'teams',
  'email',
  'signal',
  'imessage',
  'web',
]);

const builtinProfiles = new Map<string, SurfaceProfile>();
const customProfiles = new Map<string, SurfaceProfile>();

function defaultRenderTargetForChannel(channel: SurfaceChannelId): SurfaceRenderTarget {
  if (channel === 'desktop') return 'web';
  if (VALID_RENDER_TARGETS.has(channel as SurfaceRenderTarget)) {
    return channel as SurfaceRenderTarget;
  }
  return 'plain';
}

function coerceRenderTarget(
  value: SurfaceRenderTarget | string | undefined,
  channel: SurfaceChannelId,
): SurfaceRenderTarget {
  if (value && VALID_RENDER_TARGETS.has(value as SurfaceRenderTarget)) {
    return value as SurfaceRenderTarget;
  }
  return defaultRenderTargetForChannel(channel);
}

function inferChannelFromId(id: string): SurfaceChannelId {
  const normalized = normalizeChannelId(id);
  if (normalized && VALID_CHANNELS.has(normalized)) {
    return normalized;
  }
  return 'plain';
}

export function normalizeChannelId(channel: string): SurfaceChannelId | null {
  const key = String(channel || '')
    .trim()
    .toLowerCase();
  if (!key) return null;
  if (CHANNEL_ALIASES[key]) return CHANNEL_ALIASES[key];
  if (VALID_CHANNELS.has(key as SurfaceChannelId)) return key as SurfaceChannelId;
  return null;
}

function buildProfileFromInput(input: RegisterSurfaceProfileInput): SurfaceProfile {
  const preset: SurfaceProfilePresetId = input.preset ?? 'chat-basic';
  const presetDef = getSurfacePresetDefinition(preset);
  const channel = input.channel ?? inferChannelFromId(input.id);
  const overrides = input.overrides;

  const affordances = resolveAffordances(preset, overrides?.affordances);
  const fallbackOrder = overrides?.fallbackOrder
    ? [...overrides.fallbackOrder]
    : [...presetDef.fallbackOrder];
  const limits = {
    ...presetDef.limits,
    ...(overrides?.limits ?? {}),
  };
  const renderTarget = coerceRenderTarget(overrides?.renderTarget, channel);
  const label = input.label ?? channel.charAt(0).toUpperCase() + channel.slice(1);

  return {
    id: input.id,
    channel,
    label,
    displayName: label,
    contractVersion: SURFACE_AFFORDANCE_CONTRACT_VERSION,
    preset,
    affordances,
    fallbackOrder,
    renderTarget,
    limits,
  };
}

function seedBuiltins(): void {
  builtinProfiles.clear();
  for (const spec of BUILTIN_CHANNEL_SPECS) {
    const profile = buildProfileFromInput({
      id: spec.channel,
      channel: spec.channel,
      label: spec.label,
      preset: spec.preset,
      overrides: {
        ...(spec.overrides ?? {}),
        renderTarget: spec.overrides?.renderTarget ?? spec.renderTarget,
      },
    });
    profile.renderTarget = coerceRenderTarget(
      spec.overrides?.renderTarget ?? spec.renderTarget,
      spec.channel,
    );
    builtinProfiles.set(profile.id, profile);
  }

  // F2 test / rich desktop helper: select_menu preferred over buttons for large choice sets.
  const richSelect = buildProfileFromInput({
    id: 'rich-select',
    channel: 'web',
    label: 'Rich select',
    preset: 'rich-app',
    overrides: {
      affordances: {
        inline_buttons: { maxPerRow: 2, maxTotal: 4, callbackBytes: 64 },
        select_menu: true,
      },
      fallbackOrder: ['select_menu', 'inline_buttons', 'slash_commands', 'text'],
      renderTarget: 'web',
    },
  });
  builtinProfiles.set(richSelect.id, richSelect);
}

seedBuiltins();

export function registerSurfaceProfile(input: RegisterSurfaceProfileInput): SurfaceProfile {
  if (!input?.id || typeof input.id !== 'string') {
    throw new Error('registerSurfaceProfile requires a non-empty id');
  }
  const profile = buildProfileFromInput(input);
  customProfiles.set(profile.id, profile);
  return profile;
}

export function getSurfaceProfile(id: string): SurfaceProfile | null {
  return customProfiles.get(id) ?? builtinProfiles.get(id) ?? null;
}

export function listSurfaceProfiles(): SurfaceProfile[] {
  const byId = new Map<string, SurfaceProfile>();
  for (const profile of builtinProfiles.values()) {
    byId.set(profile.id, profile);
  }
  for (const profile of customProfiles.values()) {
    byId.set(profile.id, profile);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function resolveSurfaceProfileForChannel(
  channel: SurfaceChannelId | string,
): SurfaceProfile {
  const normalized = normalizeChannelId(String(channel));
  const channelId = normalized ?? 'plain';

  // Custom registration by exact profile id or channel id first.
  const customById = customProfiles.get(String(channel)) ?? customProfiles.get(channelId);
  if (customById) {
    return customById;
  }
  for (const profile of customProfiles.values()) {
    if (profile.channel === channelId) {
      return profile;
    }
  }

  const builtin = builtinProfiles.get(channelId);
  if (builtin) {
    return builtin;
  }

  return buildProfileFromInput({
    id: channelId,
    channel: channelId,
    label: String(channel || channelId),
    preset: 'chat-basic',
  });
}

/**
 * Clears custom registrations while restoring built-in channel profiles.
 * Intended for unit tests only.
 */
export function resetSurfaceProfileRegistryForTests(): void {
  customProfiles.clear();
  seedBuiltins();
}

export function isAffordanceEnabled(profile: SurfaceProfile, id: SurfaceAffordanceId): boolean {
  return isAffordanceStateEnabled(profile.affordances[id]);
}

export function getAffordanceLimits(
  profile: SurfaceProfile,
  id: SurfaceAffordanceId,
): SurfaceAffordanceLimit | null {
  const state: SurfaceAffordanceState | undefined = profile.affordances[id];
  if (state === undefined || state === false || state === true) {
    return null;
  }
  return { ...state };
}

/** Snapshot clone of a builtin (safe for test constants). */
export function snapshotBuiltinProfile(id: string): SurfaceProfile {
  const profile = getSurfaceProfile(id);
  if (!profile) {
    throw new Error(`Unknown surface profile: ${id}`);
  }
  return {
    ...profile,
    affordances: { ...profile.affordances },
    fallbackOrder: [...profile.fallbackOrder],
    limits: { ...profile.limits },
    metadata: profile.metadata ? { ...profile.metadata } : undefined,
  };
}

export { isSurfaceAffordanceEnabled };
