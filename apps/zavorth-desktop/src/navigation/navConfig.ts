import type { DesktopPanel } from '../slashCommands';

/** Daily primary navigation — always visible in the sidebar. */
export const PRIMARY_PANELS: DesktopPanel[] = [
  'chat',
  'approvals',
  'receipts',
  'files',
];

/** Secondary navigation — behind the sidebar "More" overflow. */
export const SECONDARY_PANELS: DesktopPanel[] = [
  'workboard',
  'memory',
  'skills',
  'marketplace',
  'channels',
  'agents',
  'profiles',
  'automations',
  'analytics',
  'settings',
];

/** All navigable sidebar panels in display order (primary then secondary). */
export const SIDEBAR_PANELS: DesktopPanel[] = [
  ...PRIMARY_PANELS,
  ...SECONDARY_PANELS,
];

export function isPrimaryPanel(panel: DesktopPanel): boolean {
  return PRIMARY_PANELS.includes(panel);
}

export function isSecondaryPanel(panel: DesktopPanel): boolean {
  return SECONDARY_PANELS.includes(panel);
}

/** Command palette / product grouping for panels. */
export type PanelNavGroup =
  | 'Daily'
  | 'Trust'
  | 'Workspace'
  | 'Capabilities'
  | 'Reach'
  | 'Ops';

export const PANEL_NAV_GROUP_ORDER: PanelNavGroup[] = [
  'Daily',
  'Trust',
  'Workspace',
  'Capabilities',
  'Reach',
  'Ops',
];

export const PANEL_NAV_GROUPS: Record<PanelNavGroup, DesktopPanel[]> = {
  Daily: ['chat'],
  Trust: ['approvals', 'receipts'],
  Workspace: ['files', 'workboard', 'memory', 'preview'],
  Capabilities: ['skills', 'marketplace'],
  Reach: ['channels', 'agents'],
  Ops: ['automations', 'analytics', 'profiles', 'settings'],
};

export function panelNavGroup(panel: DesktopPanel): PanelNavGroup | null {
  for (const group of PANEL_NAV_GROUP_ORDER) {
    if (PANEL_NAV_GROUPS[group].includes(panel)) {
      return group;
    }
  }
  return null;
}
