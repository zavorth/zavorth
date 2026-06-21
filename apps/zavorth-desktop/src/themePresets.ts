import type { CSSProperties } from 'react';

export type ZavorthAccent = 'orange' | 'purple' | 'navy';

type ZavorthThemePreset = {
  label: string;
  cssVars: CSSProperties;
};

export const zavorthThemePresets: Record<ZavorthAccent, ZavorthThemePreset> = {
  orange: {
    label: 'Zavorth Orange',
    cssVars: {
      '--zvd-seed-accent': '#d86b2a',
      '--zvd-seed-accent-2': '#f0a17c',
      '--zvd-seed-bg': '#f7f3ee',
      '--zvd-seed-surface': '#fffaf6',
      '--zvd-seed-sidebar': '#f0ece7',
    } as CSSProperties,
  },
  purple: {
    label: 'Zavorth Purple',
    cssVars: {
      '--zvd-seed-accent': '#9e7bff',
      '--zvd-seed-accent-2': '#c8b8ff',
      '--zvd-seed-bg': '#f4f1fb',
      '--zvd-seed-surface': '#fbf9ff',
      '--zvd-seed-sidebar': '#eeeaf7',
    } as CSSProperties,
  },
  navy: {
    label: 'Zavorth Navy',
    cssVars: {
      '--zvd-seed-accent': '#4f8dff',
      '--zvd-seed-accent-2': '#94b8ff',
      '--zvd-seed-bg': '#eff4fb',
      '--zvd-seed-surface': '#f9fbff',
      '--zvd-seed-sidebar': '#e8eef8',
    } as CSSProperties,
  },
};
