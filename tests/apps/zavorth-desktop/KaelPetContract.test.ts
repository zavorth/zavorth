import fs from 'node:fs';
import path from 'node:path';

import {
  KAEL_DESKTOP_PET_LAYOUT,
  DEFAULT_KAEL_ANIMATIONS,
  KAEL_SPRITE_SHEET,
  buildKaelSyncPayload,
  normalizeKaelSkin,
  sanitizeKaelAnimationConfig,
} from '../../../apps/zavorth-desktop/src/kael-overlay/kaelPetConfig.js';

describe('Kael desktop pet contract', () => {
  it('matches the real spritesheet grid used by the desktop pet', () => {
    expect(KAEL_SPRITE_SHEET).toMatchObject({
      columns: 8,
      rows: 9,
      frameWidth: 192,
      frameHeight: 208,
      width: 1536,
      height: 1872,
    });

    expect(DEFAULT_KAEL_ANIMATIONS.idle).toMatchObject({ row: 0, frames: 6 });
    expect(DEFAULT_KAEL_ANIMATIONS.working).toMatchObject({ row: 2, frames: 8 });
    expect(DEFAULT_KAEL_ANIMATIONS.thinking).toMatchObject({ row: 8, frames: 6 });
    expect(DEFAULT_KAEL_ANIMATIONS.finished).toMatchObject({ row: 6, frames: 6 });
  });

  it('keeps the desktop pet compact enough for always-on-top use', () => {
    expect(KAEL_DESKTOP_PET_LAYOUT).toMatchObject({
      overlaySize: 200,
      spriteStageSize: 104,
      spriteScale: 0.48,
      composerWidth: 170,
    });
    expect(KAEL_DESKTOP_PET_LAYOUT.overlaySize).toBeLessThan(240);
    expect(KAEL_DESKTOP_PET_LAYOUT.spriteScale).toBeLessThan(0.56);
  });

  it('clamps animation editor values to visible spritesheet cells', () => {
    expect(sanitizeKaelAnimationConfig({ row: 99, frames: 99, fps: 99 })).toEqual({
      row: 8,
      frames: 8,
      fps: 30,
    });

    expect(sanitizeKaelAnimationConfig({ row: -4, frames: 0, fps: 0 })).toEqual({
      row: 0,
      frames: 1,
      fps: 1,
    });
  });

  it('normalizes persisted skins and builds overlay sync payloads', () => {
    expect(normalizeKaelSkin('golden')).toBe('golden');
    expect(normalizeKaelSkin('unknown')).toBe('default');

    expect(buildKaelSyncPayload({
      skin: 'cyberpunk',
      animationState: 'idle',
      animationConfig: { row: 0, frames: 6, fps: 6 },
    })).toEqual({
      skin: 'cyberpunk',
      animationState: 'idle',
      animationConfig: { row: 0, frames: 6, fps: 6 },
      refreshConfig: true,
    });
  });

  it('exposes Kael state IPC and routes the pets settings tab', () => {
    const preload = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/electron/preload.cjs'),
      'utf8',
    );
    const app = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/src/App.tsx'),
      'utf8',
    );

    expect(preload).toContain("state: (payload) => ipcRenderer.send('zavorth:kael-overlay:state', payload)");
    expect(app).toContain("'profiles', 'pets', 'memory'");
    expect(app).toContain('subagents,');
    expect(app).toContain('handleAddSubagent,');
    expect(app).toContain('handleDeleteSubagent,');
    expect(app).toContain('handleTriggerSubagentTask,');
  });

  it('uses a file-safe spritesheet URL and bottom-anchored desktop framing', () => {
    const sprite = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/src/kael-overlay/KaelSprite.tsx'),
      'utf8',
    );

    expect(sprite).toContain("background-image: url('./kael-spritesheet.webp')");
    expect(sprite).toContain('position: absolute;');
    expect(sprite).toContain('bottom: 0;');
    expect(sprite).toContain('transform: translateX(-50%) scale(var(--kael-sprite-scale, ${KAEL_DESKTOP_PET_LAYOUT.spriteScale}));');
  });

  it('routes Kael size and lifecycle states through the real desktop flow', () => {
    const overlay = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/src/kael-overlay/KaelOverlayApp.tsx'),
      'utf8',
    );
    const stateHook = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/src/desktop-state/useKaelController.ts'),
      'utf8',
    );

    expect(overlay).toContain('--kael-overlay-size');
    expect(overlay).toContain('mode-${behaviorSettings.mode}');
    expect(stateHook).toContain('kaelLayoutForBehavior');
    expect(stateHook).toContain('loadKaelBehaviorSettings');
    expect(stateHook).toContain("setKaelTransientState('finished')");
    expect(stateHook).toContain('kaelStateForDesktopEvent');
  });

  it('keeps local message appends compatible with updater functions', () => {
    const sessionStore = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/src/store/session.ts'),
      'utf8',
    );

    expect(sessionStore).toContain('ChatMessage[] | ((current: ChatMessage[]) => ChatMessage[])');
    expect(sessionStore).toContain("typeof m === 'function' ? m($messages.get()) : m");
  });
});
