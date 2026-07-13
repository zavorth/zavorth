import {
  SURFACE_AFFORDANCE_CONTRACT_VERSION,
  SURFACE_AFFORDANCE_IDS,
} from '../../../src/contracts/surface/SurfaceAffordanceContract.js';
import {
  getAffordanceLimits,
  getSurfacePresetDefinition,
  getSurfaceProfile,
  isAffordanceEnabled,
  listSurfacePresetIds,
  listSurfaceProfiles,
  registerSurfaceProfile,
  resetSurfaceProfileRegistryForTests,
  resolveAffordances,
  resolveSurfaceProfileForChannel,
  surfaceProfileToLegacySupport,
} from '../../../src/domain/surface/application/surface-affordance/index.js';

describe('Surface Affordance Catalog (F1)', () => {
  beforeEach(() => {
    resetSurfaceProfileRegistryForTests();
  });

  it('lists and resolves all presets', () => {
    expect(listSurfacePresetIds()).toEqual(
      expect.arrayContaining(['chat-basic', 'chat-interactive', 'rich-app', 'cli']),
    );

    const basic = getSurfacePresetDefinition('chat-basic');
    expect(basic.affordances.text).toBe(true);
    expect(basic.affordances.slash_commands).toBe(true);
    expect(basic.affordances.inline_buttons).toBe(false);
    expect(basic.fallbackOrder).toEqual(['slash_commands', 'text']);
    expect(basic.limits).toEqual({
      maxTextLength: 3500,
      maxActionsPerRow: 1,
      maxButtons: 0,
    });

    const interactive = getSurfacePresetDefinition('chat-interactive');
    expect(interactive.affordances.inline_buttons).toEqual({
      maxPerRow: 2,
      maxTotal: 20,
      callbackBytes: 64,
    });
    expect(interactive.affordances.button_rows).toBe(true);
    expect(interactive.affordances.url_button).toBe(true);
    expect(interactive.affordances.progress_live_edit).toBe(true);
    expect(interactive.fallbackOrder).toEqual(['inline_buttons', 'slash_commands', 'text']);
    expect(interactive.limits.maxButtons).toBe(20);

    const rich = getSurfacePresetDefinition('rich-app');
    expect(rich.affordances.select_menu).toBe(true);
    expect(rich.affordances.modal_form).toBe(true);
    expect(rich.affordances.rich_embed_card).toBe(true);
    expect(rich.fallbackOrder[0]).toBe('select_menu');
    expect(rich.limits.maxButtons).toBe(30);

    const cli = getSurfacePresetDefinition('cli');
    expect(cli.affordances.keyboard_shortcuts).toBe(true);
    expect(cli.affordances.inline_buttons).toBe(false);
    expect(cli.limits.maxTextLength).toBe(8000);
  });

  it('resolveAffordances merges overrides on top of preset', () => {
    const enabled = resolveAffordances('chat-basic', {
      inline_buttons: { maxPerRow: 3, maxTotal: 6 },
      voice_reply: true,
    });
    expect(enabled.inline_buttons).toEqual({ maxPerRow: 3, maxTotal: 6 });
    expect(enabled.voice_reply).toBe(true);
    expect(enabled.text).toBe(true);

    const disabled = resolveAffordances('chat-interactive', {
      inline_buttons: false,
    });
    expect(disabled.inline_buttons).toBe(false);
    expect(disabled.button_rows).toBe(true);
  });

  it('register with only { id, preset } works', () => {
    const profile = registerSurfaceProfile({ id: 'x', preset: 'chat-basic' });

    expect(profile.id).toBe('x');
    expect(profile.preset).toBe('chat-basic');
    expect(profile.contractVersion).toBe(SURFACE_AFFORDANCE_CONTRACT_VERSION);
    expect(profile.affordances.text).toBe(true);
    expect(profile.affordances.inline_buttons).toBe(false);
    expect(getSurfaceProfile('x')).toEqual(profile);
  });

  it('telegram profile has inline_buttons enabled', () => {
    const telegram = resolveSurfaceProfileForChannel('telegram');

    expect(telegram.preset).toBe('chat-interactive');
    expect(isAffordanceEnabled(telegram, 'inline_buttons')).toBe(true);
    expect(getAffordanceLimits(telegram, 'inline_buttons')).toEqual(
      expect.objectContaining({ maxPerRow: 2, callbackBytes: 64 }),
    );
    expect(telegram.limits.maxButtons).toBe(20);
  });

  it('signal profile has inline_buttons disabled', () => {
    const signal = resolveSurfaceProfileForChannel('signal');

    expect(signal.preset).toBe('chat-basic');
    expect(isAffordanceEnabled(signal, 'inline_buttons')).toBe(false);
    expect(getAffordanceLimits(signal, 'inline_buttons')).toBeNull();
  });

  it('override can enable/disable affordances', () => {
    const enabled = registerSurfaceProfile({
      id: 'signal-plus-buttons',
      channel: 'signal',
      preset: 'chat-basic',
      overrides: {
        affordances: {
          inline_buttons: { maxPerRow: 1, maxTotal: 3 },
        },
      },
    });
    expect(isAffordanceEnabled(enabled, 'inline_buttons')).toBe(true);

    const disabled = registerSurfaceProfile({
      id: 'telegram-text-only',
      channel: 'telegram',
      preset: 'chat-interactive',
      overrides: {
        affordances: {
          inline_buttons: false,
          button_rows: false,
        },
      },
    });
    expect(isAffordanceEnabled(disabled, 'inline_buttons')).toBe(false);
    expect(isAffordanceEnabled(disabled, 'button_rows')).toBe(false);
    expect(isAffordanceEnabled(disabled, 'text')).toBe(true);
  });

  it('voice_reply on interactive/rich; off on text-first builtins', () => {
    const profiles = listSurfaceProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(13);

    for (const profile of profiles) {
      if (profile.id !== profile.channel) continue;
      const expectVoice =
        profile.preset === 'chat-interactive' || profile.preset === 'rich-app';
      expect(isAffordanceEnabled(profile, 'voice_reply')).toBe(expectVoice);
    }
  });

  it('isAffordanceEnabled works for true, false, and limit objects', () => {
    const telegram = resolveSurfaceProfileForChannel('telegram');
    expect(isAffordanceEnabled(telegram, 'text')).toBe(true);
    expect(isAffordanceEnabled(telegram, 'inline_buttons')).toBe(true);
    expect(isAffordanceEnabled(telegram, 'voice_reply')).toBe(true);
    expect(isAffordanceEnabled(telegram, 'select_menu')).toBe(false);

    const web = resolveSurfaceProfileForChannel('web');
    expect(isAffordanceEnabled(web, 'select_menu')).toBe(true);
    expect(isAffordanceEnabled(web, 'keyboard_shortcuts')).toBe(true);
  });

  it('discord builtin overrides button layout limits', () => {
    const discord = resolveSurfaceProfileForChannel('discord');
    expect(discord.limits.maxButtons).toBe(25);
    expect(discord.limits.maxActionsPerRow).toBe(5);
    expect(getAffordanceLimits(discord, 'inline_buttons')).toEqual(
      expect.objectContaining({ maxPerRow: 5, maxTotal: 25 }),
    );
  });

  it('bridges to legacy ChannelCapabilitySupport without rewriting awareness service', () => {
    const telegram = surfaceProfileToLegacySupport(resolveSurfaceProfileForChannel('telegram'));
    expect(telegram.buttons).toBe(true);
    expect(telegram.fallbackText).toBe(true);

    const signal = surfaceProfileToLegacySupport(resolveSurfaceProfileForChannel('signal'));
    expect(signal.buttons).toBe(false);
    expect(signal.fallbackText).toBe(true);

    const web = surfaceProfileToLegacySupport(resolveSurfaceProfileForChannel('web'));
    expect(web.buttons).toBe(true);
    expect(web.menus).toBe(true);
  });

  it('resolved affordance maps cover the full catalog ids', () => {
    const resolved = resolveAffordances('chat-basic');
    for (const id of SURFACE_AFFORDANCE_IDS) {
      expect(resolved).toHaveProperty(id);
    }
  });
});
