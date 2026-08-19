import { useMemo, useState } from 'react';
import { IconDownload, IconRefresh, IconTrash } from '@tabler/icons-react';
import type { PluginItem } from './PluginMarketplacePanel';
import type { PluginOsPlanePanelData } from '../../desktop-state/pluginOsBridge';
import { PageFrame, SearchBox, TextTabs } from './panelPrimitives';
import PluginOsPlanePanel from './PluginOsPlanePanel';

type Filter = 'all' | 'installed' | 'available';
type SurfaceTab = 'marketplace' | 'plugin-os';

export function PluginMarketplacePanel(props: {
  plugins: PluginItem[];
  source?: 'api' | 'tools' | 'empty';
  onInstall?: (pluginId: string) => void;
  onUninstall?: (pluginId: string) => void;
  onUpdate?: (pluginId: string) => void;
  onRefresh?: () => void | Promise<void>;
  /** Optional Plugin OS control-plane snapshot mapped for the second tab. */
  pluginOsData?: PluginOsPlanePanelData;
  pluginOsLabels?: Partial<Record<string, string>>;
  pluginOsError?: string | null;
  onEnablePluginOs?: (pluginId: string) => void;
  onDisablePluginOs?: (pluginId: string) => void;
  onInspectPluginOs?: (pluginId: string) => void;
  onRecommendPluginOs?: (intent: string) => void | Promise<void>;
  onCatalogApplyPluginOs?: () => void | Promise<void>;
  onOnboardingPluginOs?: (profile?: string) => void | Promise<void>;
  onUndoOnboardingPluginOs?: () => void | Promise<void>;
  onSuggestActionPluginOs?: (actionId: string, pluginId?: string) => void | Promise<void>;
  pluginOsSuggest?: {
    title?: string;
    body?: string;
    message?: string;
    primary?: { pluginId?: string; needsCredentials?: boolean; risks?: string[] } | null;
    ui?: { actions?: Array<{ id: string; label: string; pluginId?: string }> };
  } | null;
  pluginOsReceipts?: Array<{ id?: string; headline?: string; detail?: string; createdAt?: string }>;
  pluginOsInjectMode?: string;
  labels?: Partial<Record<string, string>>;
}) {
  const labels = {
    marketplace: 'Marketplace',
    pluginOs: 'Plugin OS',
    eyebrow: 'CAPABILITIES',
    title: 'Extensions',
    description: 'Skills and plugins available to the runtime.',
    installed: 'Installed',
    available: 'Available',
    updates: 'Updates',
    all: 'All',
    search: 'Search extension',
    empty: 'No extensions found',
    emptyBody: 'The runtime has not projected skills or plugins yet.',
    emptySearch: 'Try another search term.',
    selectDetail: 'Select an extension to view details.',
    statusInstalled: 'Installed',
    statusUpdate: 'Update',
    statusAvailable: 'Available',
    statusUpdateAvailable: 'Update available',
    state: 'Status',
    version: 'Version',
    category: 'Category',
    install: 'Install',
    update: 'Update',
    remove: 'Remove',
    refresh: 'Refresh',
    ...(props.labels || {}),
  };

  const [surface, setSurface] = useState<SurfaceTab>('marketplace');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const counts = useMemo(() => ({
    installed: props.plugins.filter(plugin => plugin.status === 'installed').length,
    available: props.plugins.filter(plugin => plugin.status === 'available').length,
    updates: props.plugins.filter(plugin => plugin.status === 'update_available').length,
  }), [props.plugins]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return props.plugins.filter(plugin => {
      if (filter === 'installed' && plugin.status !== 'installed' && plugin.status !== 'update_available') return false;
      if (filter === 'available' && plugin.status !== 'available') return false;
      return !q || `${plugin.name} ${plugin.description} ${plugin.author} ${plugin.category} ${(plugin.tags || []).join(' ')}`.toLowerCase().includes(q);
    });
  }, [filter, props.plugins, query]);
  const selected = visible.find(plugin => plugin.id === selectedId) || visible[0] || null;

  const emptyPluginOs: PluginOsPlanePanelData = props.pluginOsData || {
    plugins: [],
    discovery: null,
    generatedAt: null,
    root: null,
    commands: [],
    marketplace: [],
    metrics: null,
    deepLinks: [],
  };

  return (
    <div className="zvd-plugin-surface">
      <div className="zvd-capability-toolbar" style={{ marginBottom: 12 }}>
        <TextTabs<SurfaceTab>
          value={surface}
          onChange={setSurface}
          items={[
            { value: 'marketplace', label: labels.marketplace, count: props.plugins.length },
            { value: 'plugin-os', label: labels.pluginOs, count: emptyPluginOs.plugins.length },
          ]}
        />
      </div>

      {surface === 'plugin-os' ? (
        <>
          {props.pluginOsError ? (
            <div className="zvd-capability-empty" style={{ marginBottom: 12 }} role="status">
              <span>{props.pluginOsError}</span>
            </div>
          ) : null}
          <PluginOsPlanePanel
            data={emptyPluginOs}
            labels={props.pluginOsLabels}
            onEnable={props.onEnablePluginOs}
            onDisable={props.onDisablePluginOs}
            onInspect={props.onInspectPluginOs}
            onRefresh={props.onRefresh}
            onRecommend={props.onRecommendPluginOs}
            onCatalogApply={props.onCatalogApplyPluginOs}
            onOnboarding={props.onOnboardingPluginOs}
            onUndoOnboarding={props.onUndoOnboardingPluginOs}
            suggest={props.pluginOsSuggest}
            onSuggestAction={props.onSuggestActionPluginOs}
            receipts={props.pluginOsReceipts}
            injectMode={props.pluginOsInjectMode}
          />
        </>
      ) : (
        <PageFrame
          eyebrow={labels.eyebrow}
          title={labels.title}
          description={labels.description}
          meta={`${props.plugins.length} extensions`}
          actions={props.onRefresh ? (
            <button className="zvd-btn zvd-btn-secondary zvd-btn-sm" onClick={() => void props.onRefresh?.()} type="button">
              <IconRefresh size={14} /> {labels.refresh}
            </button>
          ) : undefined}
        >
          <div className="zvd-capability-summary" aria-label="Extension summary">
            <div><strong>{counts.installed}</strong><span>{labels.installed}</span></div>
            <div><strong>{counts.available}</strong><span>{labels.available}</span></div>
            <div><strong>{counts.updates}</strong><span>{labels.updates}</span></div>
          </div>
          <div className="zvd-capability-toolbar">
            <TextTabs<Filter> value={filter} onChange={setFilter} items={[
              { value: 'all', label: labels.all, count: props.plugins.length },
              { value: 'installed', label: labels.installed, count: counts.installed + counts.updates },
              { value: 'available', label: labels.available, count: counts.available },
            ]} />
            <SearchBox value={query} onChange={setQuery} placeholder={labels.search} />
          </div>
          <div className="zvd-capability-layout">
            <div className="zvd-capability-list" role="listbox" aria-label="Extensions">
              {visible.length - visible.map(plugin => (
                <button type="button" role="option" aria-selected={selected?.id === plugin.id} className={`zvd-capability-row ${selected?.id === plugin.id ? 'is-active' : ''}`} key={plugin.id} onClick={() => setSelectedId(plugin.id)}>
                  <span className="zvd-capability-row-icon" aria-hidden="true">{plugin.icon || plugin.name.slice(0, 1).toUpperCase()}</span>
                  <span className="zvd-capability-row-copy"><strong>{plugin.name}</strong><small>{plugin.category} · {plugin.author}</small></span>
                  <span className="zvd-capability-row-status">{plugin.status === 'installed' ? labels.statusInstalled : plugin.status === 'update_available' ? labels.statusUpdate : labels.statusAvailable}</span>
                </button>
              )) : (
                <div className="zvd-capability-empty">
                  <strong>{labels.empty}</strong>
                  <span>{query ? labels.emptySearch : labels.emptyBody}</span>
                </div>
              )}
            </div>
            <aside className="zvd-capability-detail" aria-live="polite">
              {selected ? <>
                <div className="zvd-capability-detail-heading"><span className="zvd-capability-detail-icon" aria-hidden="true">{selected.icon || selected.name.slice(0, 1).toUpperCase()}</span><div><h2>{selected.name}</h2><p>{selected.author}</p></div></div>
                <p className="zvd-capability-description">{selected.description}</p>
                <dl className="zvd-capability-meta">
                  <div><dt>{labels.state}</dt><dd>{selected.status === 'installed' ? labels.statusInstalled : selected.status === 'update_available' ? labels.statusUpdateAvailable : labels.statusAvailable}</dd></div>
                  <div><dt>{labels.version}</dt><dd>{selected.version || '—'}</dd></div>
                  <div><dt>{labels.category}</dt><dd>{selected.category}</dd></div>
                </dl>
                {selected.tags?.length ? <div className="zvd-capability-tags">{selected.tags.slice(0, 6).map(tag => <span key={tag}>{tag}</span>)}</div> : null}
                <div className="zvd-capability-actions">
                  {selected.status === 'available' && props.onInstall ? <button className="zvd-btn zvd-btn-primary" onClick={() => props.onInstall?.(selected.id)} type="button"><IconDownload size={14} /> {labels.install}</button> : null}
                  {selected.status === 'update_available' && props.onUpdate ? <button className="zvd-btn zvd-btn-primary" onClick={() => props.onUpdate?.(selected.id)} type="button"><IconRefresh size={14} /> {labels.update}</button> : null}
                  {selected.status === 'installed' && props.onUninstall ? <button className="zvd-btn zvd-btn-secondary" onClick={() => props.onUninstall?.(selected.id)} type="button"><IconTrash size={14} /> {labels.remove}</button> : null}
                </div>
              </> : <div className="zvd-capability-empty"><span>{labels.selectDetail}</span></div>}
            </aside>
          </div>
        </PageFrame>
      )}
    </div>
  );
}
