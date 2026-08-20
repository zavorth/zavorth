import { useEffect, useMemo, useState } from 'react';
import { Search, X } from '../icons';
import { t } from '../i18n';
import {
  buildCapabilityMapFromRuntime,
  filterCapabilityMapNodes,
  layoutCapabilityMap,
  type CapabilityDomain,
  type CapabilityMapNode,
} from './capabilityMapLayout';

export type CapabilityMapOverlayProps = {
  open: boolean;
  onClose(): void;
  tools?: Array<{ id?: string; name?: string; label?: string }>;
  channels?: Array<{ id?: string; name?: string; label?: string; status?: string }>;
  agents?: Array<{ id?: string; name?: string; role?: string; status?: string }>;
  approvalsPending?: number;
  receiptsCount?: number;
  onOpenDomain?(domain: CapabilityDomain): void;
};

const STATUS_COLOR: Record<string, string> = {
  live: 'var(--zvd-accent, #00e88f)',
  available: 'color-mix(in srgb, var(--zvd-accent, #00e88f) 55%, #fff)',
  needs_setup: '#e6b84d',
  blocked: '#e86a5c',
  idle: 'var(--zvd-muted, #8a9791)',
};

export function CapabilityMapOverlay(props: CapabilityMapOverlayProps) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) {
      setQuery('');
      setSelectedId(null);
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        props.onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [props.open, props.onClose]);

  const graph = useMemo(() => {
    const raw = buildCapabilityMapFromRuntime({
      tools: props.tools,
      channels: props.channels,
      agents: props.agents,
      approvalsPending: props.approvalsPending,
      receiptsCount: props.receiptsCount,
    });
    const filtered = filterCapabilityMapNodes(raw, query);
    return layoutCapabilityMap(filtered, { width: 760, height: 480 });
  }, [props.tools, props.channels, props.agents, props.approvalsPending, props.receiptsCount, query]);

  const selected: CapabilityMapNode | null =
    graph.nodes.find(n => n.id === selectedId) || graph.nodes[0] || null;

  if (!props.open) return null;

  return (
    <div className="zvd-capability-map-overlay" role="dialog" aria-modal="true" aria-label={t('capabilityMap.title')}>
      <button type="button" className="zvd-capability-map-backdrop" aria-label={t('capabilityMap.close')} onClick={props.onClose} />
      <div className="zvd-capability-map-panel">
        <header className="zvd-capability-map-header">
          <div>
            <p className="zvd-capability-map-eyebrow">{t('capabilityMap.eyebrow')}</p>
            <h2>{t('capabilityMap.title')}</h2>
            <p className="zvd-capability-map-sub">{t('capabilityMap.subtitle')}</p>
          </div>
          <button type="button" className="zvd-icon-btn" onClick={props.onClose} aria-label={t('capabilityMap.close')}>
            <X size={16} stroke={1.8} />
          </button>
        </header>

        <div className="zvd-capability-map-search">
          <Search size={15} stroke={1.8} aria-hidden="true" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('capabilityMap.search')}
            aria-label={t('capabilityMap.search')}
          />
        </div>

        <div className="zvd-capability-map-body">
          <svg
            className="zvd-capability-map-svg"
            viewBox={`0 0 ${graph.width} ${graph.height}`}
            role="img"
            aria-label={t('capabilityMap.mapLabel')}
          >
            <defs>
              <radialGradient id="zvd-capability-map-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--zvd-accent, #00e88f)" stopOpacity="0.18" />
                <stop offset="70%" stopColor="var(--zvd-accent, #00e88f)" stopOpacity="0.03" />
                <stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx={graph.cx} cy={graph.cy} r={Math.min(graph.width, graph.height) * 0.42} fill="url(#zvd-capability-map-glow)" />
            {graph.edges.map(edge => {
              const from = graph.nodes.find(n => n.id === edge.from);
              const to = graph.nodes.find(n => n.id === edge.to);
              if (!from || !to) return null;
              return (
                <line
                  key={edge.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  className="zvd-capability-map-edge"
                />
              );
            })}
            {graph.nodes.map(node => {
              const active = selected?.id === node.id;
              const fill = STATUS_COLOR[node.status || 'idle'] || STATUS_COLOR.idle;
              return (
                <g
                  key={node.id}
                  className={`zvd-capability-map-node ${active ? 'is-active' : ''}`}
                  onClick={() => setSelectedId(node.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle cx={node.x} cy={node.y} r={node.r + (active ? 3 : 0)} fill={fill} opacity={active ? 1 : 0.88} />
                  <circle cx={node.x} cy={node.y} r={node.r + 6} fill="none" stroke={fill} strokeOpacity={active ? 0.35 : 0.12} />
                  <text x={node.x} y={node.y + node.r + 14} textAnchor="middle" className="zvd-capability-map-label">
                    {node.label.length > 16 ? `${node.label.slice(0, 14)}…` : node.label}
                  </text>
                </g>
              );
            })}
          </svg>

          <aside className="zvd-capability-map-detail">
            {selected ? (
              <>
                <p className="zvd-capability-map-detail-domain">{selected.domain}</p>
                <h3>{selected.label}</h3>
                <p className="zvd-capability-map-detail-status">
                  {t(`capabilityMap.status.${selected.status || 'idle'}`)}
                </p>
                <button
                  type="button"
                  className="zvd-btn zvd-btn-default zvd-btn-sm"
                  onClick={() => props.onOpenDomain?.(selected.domain)}
                >
                  {t('capabilityMap.openDomain')}
                </button>
              </>
            ) : (
              <p className="zvd-capability-map-empty">{t('capabilityMap.empty')}</p>
            )}
            <ul className="zvd-capability-map-legend">
              {(['live', 'available', 'needs_setup', 'blocked'] as const).map(status => (
                <li key={status}>
                  <span className="zvd-capability-map-swatch" style={{ background: STATUS_COLOR[status] }} />
                  {t(`capabilityMap.status.${status}`)}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
