import { useMemo, useState } from 'react';
import { IconDownload, IconRefresh, IconTrash } from '@tabler/icons-react';
import type { PluginItem } from './PluginMarketplacePanel';
import { PageFrame, SearchBox, TextTabs } from './panelPrimitives';

type Filter = 'all' | 'installed' | 'available';

export function PluginMarketplacePanel(props: {
  plugins: PluginItem[];
  onInstall?: (pluginId: string) => void;
  onUninstall?: (pluginId: string) => void;
  onUpdate?: (pluginId: string) => void;
  onRefresh?: () => void | Promise<void>;
}) {
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

  return (
    <PageFrame
      eyebrow="CAPACIDADES"
      title="Extensões"
      description="Skills e plugins disponíveis para o runtime, organizados sem métricas decorativas."
      meta={`${props.plugins.length} extensões`}
      actions={props.onRefresh ? <button className="zvd-btn zvd-btn-secondary zvd-btn-sm" onClick={() => void props.onRefresh?.()} type="button"><IconRefresh size={14} /> Atualizar</button> : undefined}
    >
      <div className="zvd-capability-summary" aria-label="Resumo das extensões">
        <div><strong>{counts.installed}</strong><span>Instaladas</span></div>
        <div><strong>{counts.available}</strong><span>Disponíveis</span></div>
        <div><strong>{counts.updates}</strong><span>Atualizações</span></div>
      </div>
      <div className="zvd-capability-toolbar">
        <TextTabs<Filter> value={filter} onChange={setFilter} items={[
          { value: 'all', label: 'Todas', count: props.plugins.length },
          { value: 'installed', label: 'Instaladas', count: counts.installed + counts.updates },
          { value: 'available', label: 'Disponíveis', count: counts.available },
        ]} />
        <SearchBox value={query} onChange={setQuery} placeholder="Buscar extensão" />
      </div>
      <div className="zvd-capability-layout">
        <div className="zvd-capability-list" role="listbox" aria-label="Extensões">
          {visible.length ? visible.map(plugin => (
            <button type="button" role="option" aria-selected={selected?.id === plugin.id} className={`zvd-capability-row ${selected?.id === plugin.id ? 'is-active' : ''}`} key={plugin.id} onClick={() => setSelectedId(plugin.id)}>
              <span className="zvd-capability-row-icon" aria-hidden="true">{plugin.icon || plugin.name.slice(0, 1).toUpperCase()}</span>
              <span className="zvd-capability-row-copy"><strong>{plugin.name}</strong><small>{plugin.category} · {plugin.author}</small></span>
              <span className="zvd-capability-row-status">{plugin.status === 'installed' ? 'Instalada' : plugin.status === 'update_available' ? 'Atualizar' : 'Disponível'}</span>
            </button>
          )) : <div className="zvd-capability-empty"><strong>Nenhuma extensão encontrada</strong><span>{query ? 'Tente outro termo de busca.' : 'O runtime ainda não projetou skills ou plugins.'}</span></div>}
        </div>
        <aside className="zvd-capability-detail" aria-live="polite">
          {selected ? <>
            <div className="zvd-capability-detail-heading"><span className="zvd-capability-detail-icon" aria-hidden="true">{selected.icon || selected.name.slice(0, 1).toUpperCase()}</span><div><h2>{selected.name}</h2><p>{selected.author}</p></div></div>
            <p className="zvd-capability-description">{selected.description}</p>
            <dl className="zvd-capability-meta">
              <div><dt>Estado</dt><dd>{selected.status === 'installed' ? 'Instalada' : selected.status === 'update_available' ? 'Atualização disponível' : 'Disponível'}</dd></div>
              <div><dt>Versão</dt><dd>{selected.version || '—'}</dd></div>
              <div><dt>Categoria</dt><dd>{selected.category}</dd></div>
            </dl>
            {selected.tags?.length ? <div className="zvd-capability-tags">{selected.tags.slice(0, 6).map(tag => <span key={tag}>{tag}</span>)}</div> : null}
            <div className="zvd-capability-actions">
              {selected.status === 'available' && props.onInstall ? <button className="zvd-btn zvd-btn-primary" onClick={() => props.onInstall?.(selected.id)} type="button"><IconDownload size={14} /> Instalar</button> : null}
              {selected.status === 'update_available' && props.onUpdate ? <button className="zvd-btn zvd-btn-primary" onClick={() => props.onUpdate?.(selected.id)} type="button"><IconRefresh size={14} /> Atualizar</button> : null}
              {selected.status === 'installed' && props.onUninstall ? <button className="zvd-btn zvd-btn-secondary" onClick={() => props.onUninstall?.(selected.id)} type="button"><IconTrash size={14} /> Remover</button> : null}
            </div>
          </> : <div className="zvd-capability-empty"><span>Selecione uma extensão para ver os detalhes.</span></div>}
        </aside>
      </div>
    </PageFrame>
  );
}

