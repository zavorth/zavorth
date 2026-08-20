import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_MASCOT_BEHAVIOR_SETTINGS,
  MASCOT_SCALE_LAYOUTS,
  buildMascotSyncPayload,
  mascotLayoutForBehavior,
  mascotStateForDesktopEvent,
  loadMascotBehaviorSettings,
  sanitizeMascotBehaviorSettings,
  saveMascotBehaviorSettings,
} from '../../../apps/zavorth-desktop/src/mascot-overlay/mascotPetConfig';

import {
  DEFAULT_IDENTITY_STUDIO_PROFILE,
  buildIdentityStudioPrompt,
  identityStudioStorageKey,
  loadIdentityStudioProfile,
  sanitizeIdentityStudioProfile,
  saveIdentityStudioProfile,
} from '../../../apps/zavorth-desktop/src/identity/identityStudio';

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

describe('Desktop P1 Mascot and Identity Studio contract', () => {
  it('persists an Identity Studio profile and turns it into session steering context', () => {
    const storage = new MemoryStorage();
    const saved = saveIdentityStudioProfile({
      agentName: 'Zavorth',
      voice: 'calm, direct and premium',
      userProfile: 'Creator user who prefers concise responses.',
      rules: ['Always confirm risks before editing files.', 'Avoid unnecessary long text.'],
      memoryMode: 'session',
      sessionPreset: 'developer',
    }, storage, 'session-a');

    expect(identityStudioStorageKey('session-a')).toBe('zvd:identity-studio:session-a');
    expect(loadIdentityStudioProfile(storage, 'session-a')).toEqual(saved);
    expect(buildIdentityStudioPrompt(saved)).toContain('Agent identity: Zavorth');
    expect(buildIdentityStudioPrompt(saved)).toContain('Voice: calm, direct and premium');
    expect(buildIdentityStudioPrompt(saved)).toContain('User profile: Creator user');
    expect(buildIdentityStudioPrompt(saved)).toContain('Session preset: developer');
  });

  it('sanitizes Identity Studio profiles without losing the safe defaults', () => {
    expect(sanitizeIdentityStudioProfile({ agentName: '', rules: ['  ', 'Clean rule'] })).toMatchObject({
      agentName: DEFAULT_IDENTITY_STUDIO_PROFILE.agentName,
      rules: ['Clean rule'],
      memoryMode: DEFAULT_IDENTITY_STUDIO_PROFILE.memoryMode,
    });
  });

  it('stores mascot behavior settings, scale layouts and desktop event mapping', () => {
    const storage = new MemoryStorage();
    const saved = saveMascotBehaviorSettings({
      scale: 'small',
      mode: 'discreet',
      reducedMotion: true,
      notifications: false,
      eventBehavior: {
        composing: 'thinking',
        running: 'working',
        completed: 'finished',
        approval: 'thinking',
        error: 'sleeping',
        runtimeOffline: 'sleeping',
        focused: 'idle',
        idle: 'idle',
      },
    }, storage);

    expect(loadMascotBehaviorSettings(storage)).toEqual(saved);
    expect(sanitizeMascotBehaviorSettings({ scale: 'huge' as any, mode: 'loud' as any })).toEqual(DEFAULT_MASCOT_BEHAVIOR_SETTINGS);
    expect(MASCOT_SCALE_LAYOUTS.small.overlaySize).toBeLessThan(MASCOT_SCALE_LAYOUTS.medium.overlaySize);
    expect(mascotLayoutForBehavior({ ...saved, scale: 'small' }).overlaySize).toBe(MASCOT_SCALE_LAYOUTS.small.overlaySize);
    expect(mascotStateForDesktopEvent({ busy: true, input: '', transientState: null }, saved)).toBe('working');
    expect(mascotStateForDesktopEvent({ busy: false, input: 'plan', transientState: null }, saved)).toBe('thinking');
    expect(mascotStateForDesktopEvent({ busy: false, input: '', transientState: 'finished' }, saved)).toBe('finished');
    expect(buildMascotSyncPayload({ behaviorSettings: saved })).toMatchObject({
      behaviorSettings: saved,
      refreshConfig: true,
    });
  });

  it('wires mascot behavior and Identity Studio into the desktop source', () => {
    const settingsOverlay = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/src/components/SettingsOverlay.tsx'),
      'utf8',
    );
    const mascotOverlay = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/src/mascot-overlay/MascotOverlayApp.tsx'),
      'utf8',
    );
    const stateHook = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/src/desktop-state/useMascotController.ts'),
      'utf8',
    );

    expect(settingsOverlay).toContain('Mascot size');
    expect(settingsOverlay).toContain('Discreet mode');
    expect(settingsOverlay).toContain('Reduced motion');
    expect(settingsOverlay).toContain('Notifications');
    expect(mascotOverlay).toContain('MascotOverlayApp');
    expect(mascotOverlay).toContain('mascotOverlay');
    expect(stateHook).toContain('loadMascotBehaviorSettings');
    expect(stateHook).toContain('mascotStateForDesktopEvent');
  });
});
