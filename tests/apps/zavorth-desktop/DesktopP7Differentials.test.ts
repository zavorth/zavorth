import fs from 'node:fs';
import path from 'node:path';
import type { MemoryItem } from '../../../apps/zavorth-desktop/src/apiClient';
import {
  importPremiumTheme,
  resolvePremiumFontForProfile,
  resolvePremiumThemeForSession,
  selectPremiumFontForProfile,
  selectPremiumThemeForSession,
} from '../../../apps/zavorth-desktop/src/theme/premiumThemes';
import {
  mergeDictationTranscript,
  resolveDictationLanguage,
  speechRecognitionAvailability,
} from '../../../apps/zavorth-desktop/src/voice/voiceDictation';
import { buildWorkboardMissionContext } from '../../../apps/zavorth-desktop/src/workboard/workboardMissionContext';

import {
  DEFAULT_MASCOT_BEHAVIOR_SETTINGS,
  buildMascotEventCue,
  mascotStateForDesktopEvent,
} from '../../../apps/zavorth-desktop/src/mascot-overlay/mascotPetConfig';



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

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(relativePath), 'utf8');
}

describe('Desktop P7 Zavorth differentials', () => {
  it('maps real desktop signals into Mascot states and event cues', () => {
    expect(DEFAULT_MASCOT_BEHAVIOR_SETTINGS.eventBehavior).toMatchObject({
      approval: 'thinking',
      error: 'sleeping',
      runtimeOffline: 'sleeping',
      focused: 'idle',
    });

    expect(mascotStateForDesktopEvent({
      busy: false,
      input: '',
      transientState: null,
      approvalsCount: 2,
      hasError: false,
      runtimeRunning: true,
      windowFocused: true,
    })).toBe('thinking');

    expect(mascotStateForDesktopEvent({
      busy: false,
      input: '',
      transientState: null,
      approvalsCount: 0,
      hasError: true,
      runtimeRunning: true,
      windowFocused: true,
    })).toBe('sleeping');

    expect(mascotStateForDesktopEvent({
      busy: false,
      input: '',
      transientState: null,
      approvalsCount: 0,
      hasError: false,
      runtimeRunning: false,
      windowFocused: false,
    })).toBe('sleeping');

    expect(buildMascotEventCue({
      approvalsCount: 1,
      hasError: false,
      runtimeRunning: true,
      windowFocused: true,
      mode: 'expressive',
    })?.message).toContain('Approval');

    expect(buildMascotEventCue({
      approvalsCount: 0,
      hasError: false,
      runtimeRunning: true,
      windowFocused: true,
      mode: 'discreet',
    })).toBeNull();
  });

  it('adds optional microphone dictation before any live voice surface', () => {
    const commandBar = read('apps/zavorth-desktop/src/composer/DesktopCommandBar.tsx');

    expect(resolveDictationLanguage('pt-BR')).toBe('pt-BR');
    expect(resolveDictationLanguage('en-US')).toBe('en-US');
    expect(mergeDictationTranscript('Review this', 'with tests')).toBe('Review this with tests');
    expect(speechRecognitionAvailability({ SpeechRecognition: function MockRecognition() {} })).toMatchObject({
      available: true,
    });
    expect(commandBar).toContain('SpeechRecognition');
    expect(commandBar).toContain('is-dictating');
    expect(commandBar).toContain('onVoiceTranscript');
    expect(commandBar).not.toContain('live voice conversation');
  });

  it('imports VS Code themes and persists theme plus font by profile or session', () => {
    const storage = new MemoryStorage();
    const imported = importPremiumTheme(JSON.stringify({
      name: 'Night Owl Custom',
      type: 'dark',
      colors: {
        'editor.background': '#011627',
        'sideBar.background': '#0b2942',
        'editorWidget.background': '#102a43',
        'button.background': '#7fdbca',
        'textLink.foreground': '#82aaff',
      },
    }), storage);

    expect(imported.id).toBe('custom-night-owl-custom');
    expect(imported.cssVars['--zvd-seed-bg']).toBe('#011627');
    expect(imported.cssVars['--zvd-seed-accent']).toBe('#7fdbca');

    selectPremiumThemeForSession('session-a', imported.id, storage);
    expect(resolvePremiumThemeForSession('session-a', 'developer', undefined, storage).id).toBe(imported.id);

    selectPremiumFontForProfile('developer', 'Inter', storage);
    expect(resolvePremiumFontForProfile('developer', undefined, storage)).toBe('Inter');
  });

  it('projects identity and memory into Workboard mission context', () => {
    const context = buildWorkboardMissionContext({
      board: {
        id: 'delivery',
        name: 'Delivery',
        columns: [
          { id: 'todo', name: 'Todo', order: 0 },
          { id: 'done', name: 'Done', order: 1 },
        ],
        cards: [
          { id: 'a', title: 'Ship onboarding', priority: 'high', columnId: 'todo', createdAt: '2026-07-01T00:00:00.000Z' },
          { id: 'b', title: 'Write docs', priority: 'low', columnId: 'done', createdAt: '2026-07-01T00:00:00.000Z' },
        ],
      },
      identity: {
        agentName: 'Zavorth',
        voice: 'direct',
        userProfile: 'Builder',
        rules: ['Prefer tested changes'],
        memoryMode: 'balanced',
        sessionPreset: 'developer',
      },
      memoryItems: [
        { id: 'm1', title: 'Prefers short summaries', kind: 'preference', content: 'Keep final answers concise.' } as MemoryItem,
      ],
    });

    expect(context.identityLabel).toContain('Zavorth');
    expect(context.memoryCount).toBe(1);
    expect(context.nextAction).toContain('Ship onboarding');

    const workboard = read('apps/zavorth-desktop/src/views/panels/WorkboardPanel.tsx');
    expect(workboard).toContain('zvd-workboard-mission-context');
    expect(workboard).toContain('buildWorkboardMissionContext');
  });

  it('keeps P7 visible text behind i18n and avoids mojibake in edited desktop sources', () => {
    const i18n = read('apps/zavorth-desktop/src/i18n.ts');
    const commandBar = read('apps/zavorth-desktop/src/composer/DesktopCommandBar.tsx');
    const themeStudio = read('apps/zavorth-desktop/src/components/ThemeStudioPanel.tsx');
    const workboard = read('apps/zavorth-desktop/src/views/panels/WorkboardPanel.tsx');

    expect(i18n).toContain('voiceDictation');
    expect(i18n).toContain('missionContext');
    expect(commandBar).toContain("t('voiceDictation')");
    expect(themeStudio).toContain("t('importVsCodeTheme')");
    expect(workboard).toContain("t('missionContext')");
    for (const source of [i18n, commandBar, themeStudio, workboard]) {
      expect(source).not.toMatch(/Ã|Â|â€™|â€œ|â€/);
    }
  });
});
