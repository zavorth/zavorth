import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_KAEL_BEHAVIOR_SETTINGS,
  KAEL_SCALE_LAYOUTS,
  buildKaelSyncPayload,
  kaelLayoutForBehavior,
  kaelStateForDesktopEvent,
  loadKaelBehaviorSettings,
  sanitizeKaelBehaviorSettings,
  saveKaelBehaviorSettings,
} from '../../../apps/zavorth-desktop/src/kael-overlay/kaelPetConfig.js';

import {
  DEFAULT_IDENTITY_STUDIO_PROFILE,
  buildIdentityStudioPrompt,
  identityStudioStorageKey,
  loadIdentityStudioProfile,
  sanitizeIdentityStudioProfile,
  saveIdentityStudioProfile,
} from '../../../apps/zavorth-desktop/src/identity/identityStudio.js';

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe('Desktop P1 Kael and Identity Studio contract', () => {
  it('persists an Identity Studio profile and turns it into session steering context', () => {
    const storage = new MemoryStorage();
    const saved = saveIdentityStudioProfile({
      agentName: 'Kael',
      voice: 'calmo, direto e premium',
      userProfile: 'Usuario criador que prefere respostas objetivas.',
      rules: ['Sempre confirmar riscos antes de editar arquivos.', 'Evitar texto longo sem necessidade.'],
      memoryMode: 'session',
      sessionPreset: 'developer',
    }, storage, 'session-a');

    expect(identityStudioStorageKey('session-a')).toBe('zvd:identity-studio:session-a');
    expect(loadIdentityStudioProfile(storage, 'session-a')).toEqual(saved);
    expect(buildIdentityStudioPrompt(saved)).toContain('Agent identity: Kael');
    expect(buildIdentityStudioPrompt(saved)).toContain('Voice: calmo, direto e premium');
    expect(buildIdentityStudioPrompt(saved)).toContain('User profile: Usuario criador');
    expect(buildIdentityStudioPrompt(saved)).toContain('Session preset: developer');
  });

  it('sanitizes Identity Studio profiles without losing the safe defaults', () => {
    expect(sanitizeIdentityStudioProfile({ agentName: '', rules: ['  ', 'Regra limpa'] })).toMatchObject({
      agentName: DEFAULT_IDENTITY_STUDIO_PROFILE.agentName,
      rules: ['Regra limpa'],
      memoryMode: DEFAULT_IDENTITY_STUDIO_PROFILE.memoryMode,
    });
  });

  it('stores Kael behavior settings, scale layouts and desktop event mapping', () => {
    const storage = new MemoryStorage();
    const saved = saveKaelBehaviorSettings({
      scale: 'small',
      mode: 'discreet',
      reducedMotion: true,
      notifications: false,
      eventBehavior: {
        composing: 'thinking',
        running: 'working',
        completed: 'finished',
        idle: 'idle',
      },
    }, storage);

    expect(loadKaelBehaviorSettings(storage)).toEqual(saved);
    expect(sanitizeKaelBehaviorSettings({ scale: 'huge', mode: 'loud' })).toEqual(DEFAULT_KAEL_BEHAVIOR_SETTINGS);
    expect(KAEL_SCALE_LAYOUTS.small.overlaySize).toBeLessThan(KAEL_SCALE_LAYOUTS.medium.overlaySize);
    expect(kaelLayoutForBehavior({ ...saved, scale: 'small' }).overlaySize).toBe(KAEL_SCALE_LAYOUTS.small.overlaySize);
    expect(kaelStateForDesktopEvent({ busy: true, input: '', transientState: null }, saved)).toBe('working');
    expect(kaelStateForDesktopEvent({ busy: false, input: 'planeje', transientState: null }, saved)).toBe('thinking');
    expect(kaelStateForDesktopEvent({ busy: false, input: '', transientState: 'finished' }, saved)).toBe('finished');
    expect(buildKaelSyncPayload({ behaviorSettings: saved })).toMatchObject({
      behaviorSettings: saved,
      refreshConfig: true,
    });
  });

  it('wires Kael behavior and Identity Studio into the desktop source', () => {
    const settingsOverlay = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/src/components/SettingsOverlay.tsx'),
      'utf8',
    );
    const kaelOverlay = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/src/kael-overlay/KaelOverlayApp.tsx'),
      'utf8',
    );
    const stateHook = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/src/desktop-state/useKaelController.ts'),
      'utf8',
    );

    expect(settingsOverlay).toContain('Mascot size');
    expect(settingsOverlay).toContain('Discreet mode');
    expect(settingsOverlay).toContain('Reduced motion');
    expect(settingsOverlay).toContain('Notifications');
    expect(kaelOverlay).toContain('mode-${behaviorSettings.mode}');
    expect(kaelOverlay).toContain('--kael-overlay-size');
    expect(kaelOverlay).toContain('behaviorSettings.notifications');
    expect(kaelOverlay).toContain('reduced-motion');
    expect(stateHook).toContain('loadKaelBehaviorSettings');
    expect(stateHook).toContain('kaelStateForDesktopEvent');
  });
});
