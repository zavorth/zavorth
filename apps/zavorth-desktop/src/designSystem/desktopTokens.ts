/**
 * Zavorth Desktop design tokens.
 * Values resolve through CSS variables defined in styles/design-system.css.
 * Brand reference: docs/brand-guide.md (green #00e88f, dark #060809).
 * See apps/zavorth-desktop/DESIGN.md for principles.
 */
export const desktopDesignTokens = {
  color: {
    background: 'var(--zvd-bg)',
    surface: 'var(--zvd-surface)',
    surfacePanel: 'var(--zvd-surface-panel)',
    sidebar: 'var(--zvd-sidebar)',
    border: 'var(--zvd-border)',
    borderSoft: 'var(--zvd-border-soft)',
    text: 'var(--zvd-text)',
    muted: 'var(--zvd-muted)',
    faint: 'var(--zvd-faint)',
    accent: 'var(--zvd-accent)',
    accentSoft: 'var(--zvd-accent-soft)',
    success: 'var(--zvd-success)',
    warning: 'var(--zvd-warning)',
    danger: 'var(--zvd-danger)',
    focus: 'var(--zvd-focus-ring)',
  },
  radius: {
    control: 'var(--zvd-radius-control)',
    panel: 'var(--zvd-radius-panel)',
    overlay: 'var(--zvd-radius-overlay)',
    pill: 'var(--zvd-radius-pill)',
  },
  space: {
    1: 'var(--zvd-space-1)',
    2: 'var(--zvd-space-2)',
    3: 'var(--zvd-space-3)',
    4: 'var(--zvd-space-4)',
    5: 'var(--zvd-space-5)',
    6: 'var(--zvd-space-6)',
  },
  text: {
    xs: 'var(--zvd-text-xs)',
    sm: 'var(--zvd-text-sm)',
    md: 'var(--zvd-text-md)',
    lg: 'var(--zvd-text-lg)',
    xl: 'var(--zvd-text-xl)',
  },
  leading: {
    tight: 'var(--zvd-leading-tight)',
    normal: 'var(--zvd-leading-normal)',
    relaxed: 'var(--zvd-leading-relaxed)',
  },
  density: {
    controlHeight: 'var(--zvd-control-h)',
    sidebarWidth: 'var(--zvd-sidebar-w)',
    topbarHeight: 'var(--zvd-topbar-h)',
    fontSize: 'var(--zvd-font-size)',
  },
  motion: {
    fast: 'var(--zvd-motion-fast)',
    normal: 'var(--zvd-motion-normal)',
    slow: 'var(--zvd-motion-slow)',
  },
  elevation: {
    panel: 'var(--zvd-shadow)',
    overlay: 'var(--zvd-shadow-overlay)',
    elevation: 'var(--zvd-shadow-elevation)',
    0: 'var(--zvd-elev-0)',
    1: 'var(--zvd-elev-1)',
    2: 'var(--zvd-elev-2)',
    3: 'var(--zvd-elev-3)',
    hairline: 'var(--zvd-stroke-hairline)',
  },
  brand: {
    green: '#00e88f',
    dark: '#060809',
    greenSoft: 'rgba(0, 232, 143, 0.12)',
  },
} as const;

export type DesktopDensity = 'comfortable' | 'compact';

export const DENSITY_STORAGE_KEY = 'zvd:density';

export function loadDesktopDensity(): DesktopDensity {
  try {
    const value = localStorage.getItem(DENSITY_STORAGE_KEY);
    return value === 'compact' ? 'compact' : 'comfortable';
  } catch {
    return 'comfortable';
  }
}

export function saveDesktopDensity(density: DesktopDensity): void {
  try {
    localStorage.setItem(DENSITY_STORAGE_KEY, density);
  } catch {
    // ignore
  }
}
