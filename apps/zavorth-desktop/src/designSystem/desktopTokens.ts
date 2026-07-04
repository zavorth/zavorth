export const desktopDesignTokens = {
  color: {
    background: 'var(--zvd-bg)',
    surface: 'var(--zvd-surface)',
    surfacePanel: 'var(--zvd-surface-panel)',
    sidebar: 'var(--zvd-sidebar)',
    border: 'var(--zvd-border)',
    text: 'var(--zvd-text)',
    muted: 'var(--zvd-muted)',
    accent: 'var(--zvd-accent)',
  },
  radius: {
    control: 'var(--zvd-radius-control)',
    panel: 'var(--zvd-radius-panel)',
    overlay: 'var(--zvd-radius-overlay)',
  },
  motion: {
    fast: 'var(--zvd-motion-fast)',
    normal: 'var(--zvd-motion-normal)',
    slow: 'var(--zvd-motion-slow)',
  },
  elevation: {
    panel: 'var(--zvd-shadow)',
    overlay: 'var(--zvd-shadow-overlay)',
  },
} as const;

