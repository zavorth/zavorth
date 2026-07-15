import { describe, expect, it } from 'vitest';
import { parseSlashCommand } from '../src/slashCommands';
import { buildCommandCenterItems } from '../src/command-center/commandCenter';
import { SECONDARY_PANELS, PANEL_NAV_GROUPS } from '../src/navigation/navConfig';
import { panelLabels } from '../src/primitives/desktopPrimitives';
import { t } from '../src/i18n';

describe('Priority 3 desktop surfaces wiring', () => {
  it('registers vibe panel in nav + labels', () => {
    expect(SECONDARY_PANELS).toContain('vibe');
    expect(PANEL_NAV_GROUPS.Workspace).toContain('vibe');
    expect(panelLabels.vibe).toBeTruthy();
  });

  it('parses vibe / coding / scaffold slash routes', () => {
    expect(parseSlashCommand('/vibe')).toEqual({ kind: 'panel', panel: 'vibe' });
    expect(parseSlashCommand('/coding')).toEqual({ kind: 'panel', panel: 'vibe' });
    expect(parseSlashCommand('/scaffold')).toEqual({ kind: 'panel', panel: 'vibe' });
  });

  it('exposes command center keywords for vibe + cost savings analytics', () => {
    const items = buildCommandCenterItems({
      settingsGroups: [],
      audience: 'developer',
    });
    const vibe = items.find((item) => item.id === 'panel:vibe' || item.id === 'vibe:scaffold');
    expect(vibe).toBeTruthy();
    const joined = items.flatMap((item) => item.keywords).join(' ');
    expect(joined).toMatch(/vibe/);
    expect(joined).toMatch(/scaffold/);
    expect(joined).toMatch(/savings|cost/);
  });

  it('has EN/PT i18n keys for new surfaces', () => {
    expect(t('costSavings.tab', 'en')).toMatch(/Cost savings|savings/i);
    expect(t('costSavings.tab', 'pt')).toMatch(/Economia/i);
    expect(t('memoryGraph.tab', 'en')).toBe('Graph');
    expect(t('memoryGraph.tab', 'pt')).toBe('Grafo');
    expect(t('vibe.title', 'en')).toMatch(/Vibe/i);
    expect(t('vibe.title', 'pt')).toMatch(/vibe/i);
  });
});
