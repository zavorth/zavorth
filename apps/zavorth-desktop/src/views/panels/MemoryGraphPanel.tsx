import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconRefresh } from '@tabler/icons-react';
import { loadMemoryGraph, type MemoryItem } from '../../apiClient';
import { t } from '../../i18n';
import {
  emptyMemoryGraph,
  layoutMemoryGraph,
  memoryItemsToGraphNodes,
  normalizeMemoryGraph,
  truncateLabel,
  type MemoryGraphSnapshot,
} from './memoryGraphLayout';

export type MemoryGraphPanelProps = {
  /** Optional controlled graph (tests / parent inject). */
  graph?: MemoryGraphSnapshot | null;
  /** When API returns empty, project memory items as isolated nodes. */
  memoryItems?: MemoryItem[];
};

const TYPE_COLORS: Record<string, string> = {
  person: '#60a5fa',
  concept: '#a78bfa',
  skill: '#4ade80',
  event: '#facc15',
  preference: '#f472b6',
  fact: 'var(--zvd-accent, #f16a21)',
};

export function MemoryGraphPanel(props: MemoryGraphPanelProps) {
  const [graph, setGraph] = useState<MemoryGraphSnapshot>(props.graph || emptyMemoryGraph());
  const [loading, setLoading] = useState(!props.graph);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (props.graph) {
      setGraph(props.graph);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const raw = await loadMemoryGraph();
      let next = normalizeMemoryGraph(raw);
      if (next.nodes.length === 0 && props.memoryItems && props.memoryItems.length > 0) {
        next = memoryItemsToGraphNodes(props.memoryItems);
      }
      setGraph(next);
      if (!raw && (!props.memoryItems || props.memoryItems.length === 0)) {
        setError(t('memoryGraph.unavailable'));
      }
    } catch {
      if (props.memoryItems && props.memoryItems.length > 0) {
        setGraph(memoryItemsToGraphNodes(props.memoryItems));
      } else {
        setGraph(emptyMemoryGraph());
        setError(t('memoryGraph.unavailable'));
      }
    } finally {
      setLoading(false);
    }
  }, [props.graph, props.memoryItems]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const layout = useMemo(() => layoutMemoryGraph(graph), [graph]);
  const selected = layout.nodes.find((n) => n.id === selectedId) || null;
  const hasEdges = layout.edges.length > 0;
  const hasNodes = layout.nodes.length > 0;

  return (
    <div className="zvd-memory-graph">
      <style>{MEMORY_GRAPH_STYLES}</style>

      <div className="zvd-mg-toolbar">
        <div className="zvd-mg-meta">
          <span>
            {layout.nodes.length} {t('memoryGraph.nodes')}
          </span>
          <span>·</span>
          <span>
            {layout.edges.length} {t('memoryGraph.edges')}
          </span>
        </div>
        <button type="button" className="zvd-mg-refresh" onClick={() => void refresh()} disabled={loading}>
          <IconRefresh size={14} />
          <span>{loading ? t('memoryGraph.loading') : t('memoryGraph.refresh')}</span>
        </button>
      </div>

      {error && (
        <div className="zvd-mg-error" role="status">
          {error}
        </div>
      )}

      {!hasNodes - (
        <div className="zvd-mg-empty" role="status">
          <strong>{t('memoryGraph.emptyTitle')}</strong>
          <p>{t('memoryGraph.emptyBody')}</p>
        </div>
      ) : (
        <>
          {!hasEdges && (
            <div className="zvd-mg-hint" role="status">
              {t('memoryGraph.noEdgesYet')}
            </div>
          )}
          <svg
            className="zvd-mg-svg"
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            role="img"
            aria-label={t('memoryGraph.title')}
          >
            {layout.edges.map((edge, i) => (
              <g key={edge.id || `e-${i}`}>
                <line
                  x1={edge.x1}
                  y1={edge.y1}
                  x2={edge.x2}
                  y2={edge.y2}
                  className="zvd-mg-edge"
                  strokeWidth={Math.min(3, 1 + (edge.weight || 1) * 0.4)}
                />
                {edge.relation - (
                  <text x={(edge.x1 + edge.x2) / 2} y={(edge.y1 + edge.y2) / 2 ? 4} className="zvd-mg-edge-label">
                    {truncateLabel(edge.relation, 14)}
                  </text>
                ) : null}
              </g>
            ))}
            {layout.nodes.map((node) => {
              const color = TYPE_COLORS[String(node.type || 'fact')] || TYPE_COLORS.fact;
              const active = node.id === selectedId;
              return (
                <g
                  key={node.id}
                  className={active ? 'zvd-mg-node is-active' : 'zvd-mg-node'}
                  onClick={() => setSelectedId(node.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.r + (active ? 3 : 0)}
                    fill={color}
                    opacity={active ? 1 : 0.88}
                    stroke={active ? '#fff' : 'rgba(255,255,255,0.15)'}
                    strokeWidth={active ? 2 : 1}
                  />
                  <text x={node.x} y={node.y + node.r + 12} className="zvd-mg-node-label" textAnchor="middle">
                    {truncateLabel(node.label)}
                  </text>
                </g>
              );
            })}
          </svg>

          {selected && (
            <div className="zvd-mg-detail">
              <div className="zvd-mg-detail-type">{selected.type || 'fact'}</div>
              <strong>{selected.label}</strong>
              {selected.content ? <p>{selected.content}</p> : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const MEMORY_GRAPH_STYLES = `
  .zvd-memory-graph { display: flex; flex-direction: column; gap: 12px; }
  .zvd-mg-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .zvd-mg-meta { display: flex; gap: 8px; font-size: 12px; color: #71717a; }
  .zvd-mg-refresh {
    display: inline-flex; align-items: center; gap: 6px;
    background: #25262d; border: 1px solid rgba(255,255,255,0.08);
    color: #fff; border-radius: 6px; padding: 6px 12px; font-size: 12.5px; cursor: pointer;
  }
  .zvd-mg-refresh:disabled { opacity: 0.6; cursor: default; }
  .zvd-mg-error, .zvd-mg-hint {
    font-size: 12px; color: #facc15;
    background: rgba(234,179,8,0.08); border: 1px solid rgba(234,179,8,0.2);
    border-radius: 8px; padding: 8px 12px;
  }
  .zvd-mg-hint { color: #a1a1aa; background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.06); }
  .zvd-mg-empty {
    text-align: center; padding: 36px 16px; color: #71717a;
    border: 1px dashed rgba(255,255,255,0.08); border-radius: 12px;
  }
  .zvd-mg-empty strong { display: block; color: #e4e4e7; margin-bottom: 6px; font-size: 14px; }
  .zvd-mg-empty p { margin: 0; font-size: 12.5px; line-height: 1.45; }
  .zvd-mg-svg {
    width: 100%; height: auto; min-height: 280px;
    background: #0e0f13; border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
  }
  .zvd-mg-edge { stroke: rgba(255,255,255,0.18); }
  .zvd-mg-edge-label {
    fill: #71717a; font-size: 9px; pointer-events: none;
  }
  .zvd-mg-node-label {
    fill: #d4d4d8; font-size: 10px; pointer-events: none;
  }
  .zvd-mg-detail {
    background: #121318; border: 1px solid rgba(255,255,255,0.06);
    border-radius: 10px; padding: 12px 14px;
  }
  .zvd-mg-detail-type {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
    color: #71717a; margin-bottom: 4px;
  }
  .zvd-mg-detail strong { color: #fff; font-size: 14px; }
  .zvd-mg-detail p { margin: 6px 0 0; font-size: 12.5px; color: #a1a1aa; line-height: 1.45; }
`;

export default MemoryGraphPanel;
