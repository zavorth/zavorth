import { atom } from 'nanostores';

export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentPreset = 'orange' | 'purple' | 'navy';

export const $themeMode = atom<ThemeMode>('system');
export const $accentPreset = atom<AccentPreset>('orange');

export function setThemeMode(m: ThemeMode) { $themeMode.set(m); }
export function setAccentPreset(a: AccentPreset) { $accentPreset.set(a); }
