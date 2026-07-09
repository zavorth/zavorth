import type { CSSProperties } from 'react';

/** Official brand accent first (green), then secondary palettes. */
export type ZavorthAccent = 'green' | 'orange' | 'purple' | 'navy';

type ZavorthThemePreset = {
  label: string;
  cssVars: CSSProperties;
};

/**
 * Accent presets set seed variables; styles.css maps them to --zvd-accent / soft surfaces.
 * Brand guide: Zavorth Green #00e88f on dark #060809.
 */
export const zavorthThemePresets: Record<ZavorthAccent, ZavorthThemePreset> = {
  green: {
    label: 'Zavorth Green',
    cssVars: {
      '--zvd-seed-accent': '#00e88f',
      '--zvd-seed-accent-2': '#5ef0b5',
      '--zvd-seed-bg': '#f4faf7',
      '--zvd-seed-surface': '#fbfffd',
      '--zvd-seed-sidebar': '#eef6f2',
      '--zvd-seed-dark-bg': '#060809',
      '--zvd-seed-dark-surface': '#0c1012',
      '--zvd-seed-dark-sidebar': '#0a0d0f',
    } as CSSProperties,
  },
  orange: {
    label: 'Zavorth Orange',
    cssVars: {
      '--zvd-seed-accent': '#d86b2a',
      '--zvd-seed-accent-2': '#f0a17c',
      '--zvd-seed-bg': '#f7f3ee',
      '--zvd-seed-surface': '#fffaf6',
      '--zvd-seed-sidebar': '#f0ece7',
      '--zvd-seed-dark-bg': '#0d0e12',
      '--zvd-seed-dark-surface': '#111217',
      '--zvd-seed-dark-sidebar': '#15161b',
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
      '--zvd-seed-dark-bg': '#0e0d12',
      '--zvd-seed-dark-surface': '#14131a',
      '--zvd-seed-dark-sidebar': '#12111a',
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
      '--zvd-seed-dark-bg': '#0a0e14',
      '--zvd-seed-dark-surface': '#10161f',
      '--zvd-seed-dark-sidebar': '#0d1219',
    } as CSSProperties,
  },
};
