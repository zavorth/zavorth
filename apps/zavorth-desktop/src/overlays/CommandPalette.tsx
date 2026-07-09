import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SessionEntry } from '../global';
import { t, panelLabel } from '../i18n';
import { slashCommands, type DesktopPanel } from '../slashCommands';
import {
  PANEL_NAV_GROUP_ORDER,
  PANEL_NAV_GROUPS,
  type PanelNavGroup,
} from '../navigation/navConfig';

const ALL_PANELS: DesktopPanel[] = [
  'chat',
  'approvals',
  'memory',
  'skills',
  'channels',
  'settings',
  'files',
  'preview',
  'automations',
  'agents',
  'profiles',
  'analytics',
  'marketplace',
  'workboard',
  'receipts',
];

const PANEL_GROUP_I18N: Record<PanelNavGroup, string> = {
  Daily: 'palette.group.daily',
  Trust: 'palette.group.trust',
  Workspace: 'palette.group.workspace',
  Capabilities: 'palette.group.capabilities',
  Reach: 'palette.group.reach',
  Ops: 'palette.group.ops',
};

type PaletteItem =
  | { kind: 'session'; id: string; title: string; subtitle: string; sessionId: string }
  | { kind: 'panel'; id: string; title: string; subtitle: string; panel: DesktopPanel }
  | { kind: 'command'; id: string; title: string; subtitle: string; usage: string }
  | { kind: 'action'; id: string; title: string; subtitle: string; action: 'new-chat' | 'settings' | 'command-center' };

function matchesQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.toLowerCase().includes(q);
}

export function CommandPalette(props: {
  activePanel: DesktopPanel;
  open: boolean;
  currentSessionId?: string;
  onClose(): void;
  onInsert(value: string): void;
  onPanel(panel: DesktopPanel): void;
  onRun(value: string): void | Promise<void>;
  onSwitchSession?(sessionId: string): void;
  onNewSession?(): void;
  onOpenSettings?(): void;
  onOpenCommandCenter?(): void;
}) {
  const [query, setQuery] = useState('');
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loadingSessions, setLoadingSessions] = useState(false);

  useEffect(() => {
    if (!props.open) {
      setQuery('');
      setSelectedIndex(0);
      return;
    }

    let cancelled = false;
    setLoadingSessions(true);
    void (async () => {
      try {
        const data = await window.zavorthDesktop?.listSessions?.();
        if (!cancelled && Array.isArray(data)) {
          setSessions(data.filter(session => !String(session.id || '').startsWith('cron_')));
        }
      } catch {
        if (!cancelled) setSessions([]);
      } finally {
        if (!cancelled) setLoadingSessions(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [props.open]);

  const items = useMemo(() => {
    const next: PaletteItem[] = [];

    if (props.onNewSession && matchesQuery(`${t('nav.newChat')} new chat conversation`, query)) {
      next.push({
        kind: 'action',
        id: 'action:new-chat',
        title: t('nav.newChat'),
        subtitle: t('palette.newChat'),
        action: 'new-chat',
      });
    }
    if (props.onOpenSettings && matchesQuery(`${t('settings')} settings`, query)) {
      next.push({
        kind: 'action',
        id: 'action:settings',
        title: t('settings'),
        subtitle: t('palette.openSettings'),
        action: 'settings',
      });
    }
    if (
      props.onOpenCommandCenter
      && matchesQuery(`${t('nav.commandCenter')} command center central comandos`, query)
    ) {
      next.push({
        kind: 'action',
        id: 'action:command-center',
        title: t('nav.commandCenter'),
        subtitle: t('palette.openCommandCenter'),
        action: 'command-center',
      });
    }

    for (const session of sessions) {
      const label = session.label || session.id;
      const hay = `${label} ${session.id} ${session.surface || ''} ${session.lastMessage || ''}`;
      if (!matchesQuery(hay, query)) continue;
      next.push({
        kind: 'session',
        id: `session:${session.id}`,
        title: label,
        subtitle: session.lastMessage
          ? session.lastMessage.slice(0, 80)
          : `${t('palette.switchSession')}${session.surface ? ` · ${session.surface}` : ''}`,
        sessionId: session.id,
      });
    }

    // Panels in product group order (Daily → Trust → Workspace → …)
    for (const group of PANEL_NAV_GROUP_ORDER) {
      for (const panel of PANEL_NAV_GROUPS[group]) {
        if (!ALL_PANELS.includes(panel)) continue;
        const title = panelLabel(panel);
        if (!matchesQuery(`${panel} ${title} ${group}`, query)) continue;
        next.push({
          kind: 'panel',
          id: `panel:${panel}`,
          title,
          subtitle: panel === props.activePanel
            ? `${t('palette.openPanel')} · current`
            : t('palette.openPanel'),
          panel,
        });
      }
    }

    // Any remaining panels not in a nav group
    for (const panel of ALL_PANELS) {
      if (next.some(item => item.kind === 'panel' && item.panel === panel)) continue;
      const title = panelLabel(panel);
      if (!matchesQuery(`${panel} ${title}`, query)) continue;
      next.push({
        kind: 'panel',
        id: `panel:${panel}`,
        title,
        subtitle: panel === props.activePanel
          ? `${t('palette.openPanel')} · current`
          : t('palette.openPanel'),
        panel,
      });
    }

    for (const command of slashCommands) {
      const hay = `${command.name} ${command.description} ${command.usage}`;
      if (!matchesQuery(hay, query)) continue;
      next.push({
        kind: 'command',
        id: `cmd:${command.name}`,
        title: command.name,
        subtitle: command.description,
        usage: command.usage,
      });
    }

    return next;
  }, [props.activePanel, props.onNewSession, props.onOpenSettings, props.onOpenCommandCenter, query, sessions]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, props.open]);

  useEffect(() => {
    if (selectedIndex >= items.length) {
      setSelectedIndex(Math.max(0, items.length - 1));
    }
  }, [items.length, selectedIndex]);

  const runItem = useCallback((item: PaletteItem) => {
    props.onClose();
    if (item.kind === 'session') {
      props.onSwitchSession?.(item.sessionId);
      props.onPanel('chat');
      return;
    }
    if (item.kind === 'panel') {
      props.onPanel(item.panel);
      return;
    }
    if (item.kind === 'action') {
      if (item.action === 'new-chat') {
        props.onNewSession?.();
        return;
      }
      if (item.action === 'command-center') {
        props.onOpenCommandCenter?.();
        return;
      }
      props.onOpenSettings?.();
      return;
    }
    if (item.usage.includes('|') || item.usage.endsWith(' ')) {
      props.onInsert(item.usage);
      return;
    }
    void props.onRun(item.usage.split(' ')[0]);
  }, [props]);

  useEffect(() => {
    if (!props.open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        props.onClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex(index => Math.min(items.length - 1, index + 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex(index => Math.max(0, index - 1));
        return;
      }
      if (event.key === 'Enter' && items[selectedIndex]) {
        event.preventDefault();
        runItem(items[selectedIndex]);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [items, props, runItem, selectedIndex]);

  if (!props.open) {
    return null;
  }

  const sessionItems = items.filter(item => item.kind === 'session');
  const commandItems = items.filter(item => item.kind === 'command');
  const actionItems = items.filter(item => item.kind === 'action');
  const panelItems = items.filter(item => item.kind === 'panel');

  function panelsInGroup(group: PanelNavGroup): PaletteItem[] {
    const panels = PANEL_NAV_GROUPS[group];
    return panelItems.filter(item => item.kind === 'panel' && panels.includes(item.panel));
  }

  const ungroupedPanels = panelItems.filter(item => {
    if (item.kind !== 'panel') return false;
    return !PANEL_NAV_GROUP_ORDER.some(group => PANEL_NAV_GROUPS[group].includes(item.panel));
  });

  function renderGroup(label: string, groupItems: PaletteItem[]) {
    if (groupItems.length === 0) return null;
    return (
      <div className="zvd-command-group">
        <span>{label}</span>
        {groupItems.map(item => {
          const globalIndex = items.findIndex(candidate => candidate.id === item.id);
          return (
            <button
              className={[
                props.activePanel && item.kind === 'panel' && item.panel === props.activePanel ? 'is-active' : '',
                globalIndex === selectedIndex ? 'is-selected' : '',
                item.kind === 'session' && item.sessionId === props.currentSessionId ? 'is-current' : '',
              ].filter(Boolean).join(' ')}
              key={item.id}
              onClick={() => runItem(item)}
              onMouseEnter={() => setSelectedIndex(globalIndex)}
              type="button"
            >
              <strong>{item.title}</strong>
              <small>{item.subtitle}</small>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="zvd-command-palette-backdrop" onMouseDown={props.onClose}>
      <section
        className="zvd-command-palette"
        aria-label="Command palette"
        onMouseDown={event => event.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={t('palette.placeholder')}
          aria-label={t('palette.placeholder')}
        />
        {items.length === 0 ? (
          <div className="zvd-command-empty">
            {loadingSessions ? '…' : t('palette.empty')}
          </div>
        ) : (
          <>
            {renderGroup(t('palette.actions'), actionItems)}
            {renderGroup(t('palette.sessions'), sessionItems)}
            {PANEL_NAV_GROUP_ORDER.map(group =>
              renderGroup(t(PANEL_GROUP_I18N[group]), panelsInGroup(group)),
            )}
            {renderGroup(t('palette.panels'), ungroupedPanels)}
            {renderGroup(t('palette.commands'), commandItems)}
          </>
        )}
      </section>
    </div>
  );
}
