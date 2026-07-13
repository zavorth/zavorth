import {
  SURFACE_AFFORDANCE_IDS,
  type SurfaceAffordanceId,
  type SurfaceAffordanceMap,
  type SurfaceAffordanceState,
  type SurfaceProfilePresetId,
} from '../../../../contracts/surface/SurfaceAffordanceContract.js';

export type SurfacePresetDefinition = {
  preset: SurfaceProfilePresetId;
  affordances: SurfaceAffordanceMap;
  fallbackOrder: SurfaceAffordanceId[];
  limits: {
    maxTextLength: number;
    maxActionsPerRow: number;
    maxButtons: number;
  };
};

const DISABLED_BASE: SurfaceAffordanceMap = Object.fromEntries(
  SURFACE_AFFORDANCE_IDS.map((id) => [id, false as const]),
) as SurfaceAffordanceMap;

const CHAT_BASIC: SurfacePresetDefinition = {
  preset: 'chat-basic',
  affordances: {
    ...DISABLED_BASE,
    text: true,
    slash_commands: true,
    inline_buttons: false,
    voice_reply: false,
  },
  fallbackOrder: ['slash_commands', 'text'],
  limits: {
    maxTextLength: 3500,
    maxActionsPerRow: 1,
    maxButtons: 0,
  },
};

const CHAT_INTERACTIVE: SurfacePresetDefinition = {
  preset: 'chat-interactive',
  affordances: {
    ...CHAT_BASIC.affordances,
    inline_buttons: { maxPerRow: 2, maxTotal: 20, callbackBytes: 64 },
    button_rows: true,
    url_button: true,
    progress_live_edit: true,
    // F5e — emoji reactions as optional low-friction controls
    reactions: true,
    // F5f — use Zavorth AudioTranscriptionService (same STT order/models as Telegram voice)
    voice_reply: true,
  },
  fallbackOrder: ['inline_buttons', 'slash_commands', 'text'],
  limits: {
    maxTextLength: 4096,
    maxActionsPerRow: 2,
    maxButtons: 20,
  },
};

const RICH_APP: SurfacePresetDefinition = {
  preset: 'rich-app',
  affordances: {
    ...CHAT_INTERACTIVE.affordances,
    select_menu: true,
    modal_form: true,
    rich_embed_card: true,
    ephemeral_notice: true,
    copy_to_clipboard: true,
    keyboard_shortcuts: true,
    reactions: true,
    voice_reply: true,
  },
  fallbackOrder: ['select_menu', 'inline_buttons', 'slash_commands', 'text'],
  limits: {
    maxTextLength: 6000,
    maxActionsPerRow: 3,
    maxButtons: 30,
  },
};

const CLI: SurfacePresetDefinition = {
  preset: 'cli',
  affordances: {
    ...DISABLED_BASE,
    text: true,
    slash_commands: true,
    keyboard_shortcuts: true,
    // Tables are expressed as dense text in CLI surfaces.
    voice_reply: false,
    inline_buttons: false,
  },
  fallbackOrder: ['slash_commands', 'text'],
  limits: {
    maxTextLength: 8000,
    maxActionsPerRow: 1,
    maxButtons: 0,
  },
};

const PRESET_DEFINITIONS: Record<SurfaceProfilePresetId, SurfacePresetDefinition> = {
  'chat-basic': CHAT_BASIC,
  'chat-interactive': CHAT_INTERACTIVE,
  'rich-app': RICH_APP,
  cli: CLI,
};

export function listSurfacePresetIds(): SurfaceProfilePresetId[] {
  return Object.keys(PRESET_DEFINITIONS) as SurfaceProfilePresetId[];
}

export function getSurfacePresetDefinition(presetId: SurfaceProfilePresetId): SurfacePresetDefinition {
  const definition = PRESET_DEFINITIONS[presetId];
  if (!definition) {
    throw new Error(`Unknown surface profile preset: ${presetId}`);
  }
  return {
    preset: definition.preset,
    affordances: { ...definition.affordances },
    fallbackOrder: [...definition.fallbackOrder],
    limits: { ...definition.limits },
  };
}

/**
 * Merge override affordance states on top of a preset.
 * - `false` disables
 * - `true` enables with no special limits
 * - object enables with the given limits (replaces prior limit object)
 */
export function resolveAffordances(
  preset: SurfaceProfilePresetId,
  overrides?: SurfaceAffordanceMap,
): SurfaceAffordanceMap {
  const base = getSurfacePresetDefinition(preset).affordances;
  const resolved: SurfaceAffordanceMap = { ...DISABLED_BASE, ...base };

  if (!overrides) {
    return resolved;
  }

  for (const [key, value] of Object.entries(overrides) as Array<
    [SurfaceAffordanceId, SurfaceAffordanceState | undefined]
  >) {
    if (value === undefined) continue;
    resolved[key] = value;
  }

  return resolved;
}

export function isAffordanceStateEnabled(state: SurfaceAffordanceState | undefined): boolean {
  if (state === undefined || state === false) return false;
  return true;
}
