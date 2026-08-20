import fs from 'node:fs';
import path from 'node:path';

import {
  MASCOT_DESKTOP_PET_LAYOUT,
  DEFAULT_MASCOT_ANIMATIONS,
  MASCOT_SPRITE_SHEET,
  buildMascotSyncPayload,
  normalizeMascotSkin,
  sanitizeMascotAnimationConfig,
} from '../../../apps/zavorth-desktop/src/mascot-overlay/mascotPetConfig';

describe('Mascot desktop pet contract', () => {
  it('matches the real spritesheet grid used by the desktop pet', () => {
    expect(MASCOT_SPRITE_SHEET).toMatchObject({
      columns: 8,
      rows: 9,
      frameWidth: 192,
      frameHeight: 208,
      width: 1536,
      height: 1872,
    });

    expect(DEFAULT_MASCOT_ANIMATIONS.idle).toMatchObject({ row: 0, frames: 6 });
    expect(DEFAULT_MASCOT_ANIMATIONS.working).toMatchObject({ row: 2, frames: 8 });
    expect(DEFAULT_MASCOT_ANIMATIONS.thinking).toMatchObject({ row: 8, frames: 6 });
    expect(DEFAULT_MASCOT_ANIMATIONS.finished).toMatchObject({ row: 6, frames: 6 });
  });

  it('keeps the desktop pet compact enough for always-on-top use', () => {
    expect(MASCOT_DESKTOP_PET_LAYOUT).toMatchObject({
      overlaySize: 200,
      spriteStageSize: 104,
      spriteScale: 0.48,
      composerWidth: 170,
    });
    expect(MASCOT_DESKTOP_PET_LAYOUT.overlaySize).toBeLessThan(240);
    expect(MASCOT_DESKTOP_PET_LAYOUT.spriteScale).toBeLessThan(0.56);
  });

  it('clamps animation editor values to visible spritesheet cells', () => {
    expect(sanitizeMascotAnimationConfig({ row: 99, frames: 99, fps: 99 })).toEqual({
      row: 8,
      frames: 8,
      fps: 30,
    });

    expect(sanitizeMascotAnimationConfig({ row: -4, frames: 0, fps: 0 })).toEqual({
      row: 0,
      frames: 1,
      fps: 1,
    });
  });

  it('normalizes persisted skins and builds overlay sync payloads', () => {
    expect(normalizeMascotSkin('golden')).toBe('golden');
    expect(normalizeMascotSkin('unknown')).toBe('default');

    expect(buildMascotSyncPayload({
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

  it('exposes mascot state IPC and routes the pets settings tab', () => {
    const preload = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/electron/preload.cjs'),
      'utf8',
    );
    const app = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/src/App.tsx'),
      'utf8',
    );

    expect(preload).toContain("state: payload => ipcRenderer.send('zavorth:mascot-overlay:state', payload)");
    expect(app).toContain("'profiles', 'pets', 'memory'");
    expect(app).toContain('subagents,');
    expect(app).toContain('handleAddSubagent,');
    expect(app).toContain('handleDeleteSubagent,');
    expect(app).toContain('handleTriggerSubagentTask,');
  });

  it('routes mascot size and lifecycle states through the real desktop flow', () => {
    const overlay = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/src/mascot-overlay/MascotOverlayApp.tsx'),
      'utf8',
    );
    const stateHook = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/src/desktop-state/useMascotController.ts'),
      'utf8',
    );

    expect(overlay).toContain('MascotOverlayApp');
    expect(overlay).toContain('MascotSprite');
    expect(stateHook).toContain('mascotLayoutForBehavior');
    expect(stateHook).toContain('loadMascotBehaviorSettings');
    expect(stateHook).toContain("setMascotTransientState('finished')");
    expect(stateHook).toContain('mascotStateForDesktopEvent');
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
