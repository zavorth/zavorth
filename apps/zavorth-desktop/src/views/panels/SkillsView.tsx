import { useMemo, useState } from 'react';
import type { ToolItem } from '../../apiClient';
import { readinessFromTool } from '../../desktop-state/readiness';
import { PageFrame, SearchBox, TextTabs } from '../panelChrome';
import { SkillRegistryOpsPanel } from './SkillRegistryOpsPanel';

type Mode = 'all' | 'live' | 'review' | 'registry';

export function SkillsView(props: { tools: ToolItem[] }) {
  const [mode, setMode] = useState<Mode>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return props.tools.filter((tool, index) => {
      const badge = readinessFromTool({ status: tool.status, risk: tool.risk });
      if (mode === 'live' && badge.state !== 'live') return false;
      if (mode === 'review' && badge.tone !== 'warning' && badge.tone !== 'danger') return false;
      if (mode === 'registry') return false;
      const id = tool.id || tool.name || `tool-${index}`;
      return (
        !q ||
        `${id} ${tool.title || ''} ${tool.description || ''} ${tool.source || ''}`
          .toLowerCase()
          .includes(q)
      );
    });
  }, [mode, props.tools, query]);

  const selected =
    visible.find((tool, index) => (tool.id || tool.name || `tool-${index}`) === selectedId) ||
    visible[0] ||
    null;
  const liveCount = props.tools.filter(
    (tool) => readinessFromTool({ status: tool.status, risk: tool.risk }).state === 'live',
  ).length;
  const reviewCount = props.tools.length - liveCount;

  const modeTabs = (
    <TextTabs<Mode>
      value={mode}
      onChange={setMode}
      items={[
        { value: 'all', label: 'Todas', count: props.tools.length },
        { value: 'live', label: 'Live', count: liveCount },
        { value: 'review', label: 'Revisar', count: reviewCount },
        { value: 'registry', label: 'Registry ops' },
      ]}
    />
  );

  if (mode === 'registry') {
    return (
      <div className="zvd-skills-with-registry">
        <div style={{ padding: '0 0 0.75rem' }}>{modeTabs}</div>
        <SkillRegistryOpsPanel />
      </div>
    );
  }

  return (
    <PageFrame
      eyebrow="RUNTIME"
      title="Skills"
      description="Ferramentas e capacidades projetadas pelo runtime, com origem e confiança visíveis. Aba Registry ops: sign/verify/export/plan."
      meta={`${props.tools.length} capacidades`}
    >
      <div className="zvd-capability-summary" aria-label="Resumo das skills">
        <div>
          <strong>{props.tools.length}</strong>
          <span>Total</span>
        </div>
        <div>
          <strong>{liveCount}</strong>
          <span>Live</span>
        </div>
        <div>
          <strong>{reviewCount}</strong>
          <span>Revisar</span>
        </div>
      </div>
      <div className="zvd-capability-toolbar">
        {modeTabs}
        <SearchBox value={query} onChange={setQuery} placeholder="Buscar skill" />
      </div>
      <div className="zvd-capability-layout">
        <div className="zvd-capability-list" role="listbox" aria-label="Skills">
          {visible.length ? (
            visible.map((tool, index) => {
              const id = tool.id || tool.name || `tool-${index}`;
              const badge = readinessFromTool({ status: tool.status, risk: tool.risk });
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={(selected?.id || selected?.name) === (tool.id || tool.name)}
                  className={`zvd-capability-row ${(selected?.id || selected?.name) === (tool.id || tool.name) ? 'is-active' : ''}`}
                  key={id}
                  onClick={() => setSelectedId(id)}
                >
                  <span className="zvd-capability-row-icon" aria-hidden="true">
                    {(tool.title || tool.name || 'S').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="zvd-capability-row-copy">
                    <strong>{tool.title || tool.name || tool.id || 'Skill'}</strong>
                    <small>{tool.source || 'runtime'}</small>
                  </span>
                  <span className="zvd-capability-row-status">{badge.label}</span>
                </button>
              );
            })
          ) : (
            <div className="zvd-capability-empty">
              <strong>Nenhuma skill encontrada</strong>
              <span>O runtime ainda não projetou capacidades para este filtro.</span>
            </div>
          )}
        </div>
        <aside className="zvd-capability-detail">
          {selected ? (
            <>
              <div className="zvd-capability-detail-heading">
                <span className="zvd-capability-detail-icon" aria-hidden="true">
                  {(selected.title || selected.name || 'S').slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <h2>{selected.title || selected.name || selected.id}</h2>
                  <p>{selected.source || 'runtime'}</p>
                </div>
              </div>
              <p className="zvd-capability-description">
                {selected.description || 'Capacidade exposta pelo runtime Zavorth.'}
              </p>
              <dl className="zvd-capability-meta">
                <div>
                  <dt>Estado</dt>
                  <dd>{readinessFromTool({ status: selected.status, risk: selected.risk }).label}</dd>
                </div>
                <div>
                  <dt>Risco</dt>
                  <dd>{selected.risk || 'padrão'}</dd>
                </div>
                <div>
                  <dt>Origem</dt>
                  <dd>{selected.source || 'runtime'}</dd>
                </div>
              </dl>
              <p style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
                <button type="button" className="zvd-btn" onClick={() => setMode('registry')}>
                  Open Registry ops →
                </button>
              </p>
            </>
          ) : (
            <div className="zvd-capability-empty">
              <span>Selecione uma skill para ver os detalhes.</span>
            </div>
          )}
        </aside>
      </div>
    </PageFrame>
  );
}
