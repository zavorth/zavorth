import { atom } from 'nanostores';
import type { ZavorthAccent } from '../themePresets';
import type { DesktopDensity } from '../designSystem/desktopTokens';
import { loadDesktopDensity } from '../designSystem/desktopTokens';

export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentPreset = ZavorthAccent;

const ACCENT_STORAGE_KEY = 'zvd:accent';

function loadAccent(): AccentPreset {
  try {
    const value = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (value === 'green' || value === 'orange' || value === 'purple' || value === 'navy') {
      return value;
    }
  } catch {
    // ignore
  }
  return 'green';
}

function loadThemeMode(): ThemeMode {
  try {
    const value = localStorage.getItem('zvd:theme-mode');
    if (value === 'light' || value === 'dark' || value === 'system') {
      return value;
    }
  } catch {
    // ignore
  }
  return 'system';
}

export const $themeMode = atom<ThemeMode>(loadThemeMode());
export const $accentPreset = atom<AccentPreset>(loadAccent());
export const $density = atom<DesktopDensity>(loadDesktopDensity());

export function setThemeMode(m: ThemeMode) {
  $themeMode.set(m);
  try {
    localStorage.setItem('zvd:theme-mode', m);
  } catch {
    // ignore
  }
}

export function setAccentPreset(a: AccentPreset) {
  $accentPreset.set(a);
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, a);
  } catch {
    // ignore
  }
}

export function setDensity(d: DesktopDensity) {
  $density.set(d);
  try {
    localStorage.setItem('zvd:density', d);
  } catch {
    // ignore
  }
}
