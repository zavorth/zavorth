/**
 * Dependency-free force-ish / circular layout for memory graph SVG rendering.
 */

export type MemoryGraphNode = {
  id: string;
  type?: string;
  label: string;
  content?: string;
  importance?: number;
};

export type MemoryGraphEdge = {
  id?: string;
  source_id: string;
  target_id: string;
  relation?: string;
  weight?: number;
};

export type MemoryGraphSnapshot = {
  nodes: MemoryGraphNode[];
  edges: MemoryGraphEdge[];
  stats?: {
    nodeCount?: number;
    edgeCount?: number;
    byType?: Record<string, number>;
  };
};

export type LaidOutNode = MemoryGraphNode & {
  x: number;
  y: number;
  r: number;
};

export type LaidOutEdge = MemoryGraphEdge & {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type MemoryGraphLayout = {
  width: number;
  height: number;
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
};

const TYPE_RADIUS: Record<string, number> = {
  person: 18,
  concept: 16,
  skill: 15,
  event: 14,
  preference: 14,
  fact: 12,
};

export function emptyMemoryGraph(): MemoryGraphSnapshot {
  return { nodes: [], edges: [], stats: { nodeCount: 0, edgeCount: 0, byType: {} } };
}

export function normalizeMemoryGraph(raw: unknown): MemoryGraphSnapshot {
  if (!raw || typeof raw !== 'object') return emptyMemoryGraph();
  const rec = raw as Record<string, unknown>;
  const data = (rec.data && typeof rec.data === 'object' ? rec.data : rec) as Record<string, unknown>;

  const nodesRaw = Array.isArray(data.nodes) ? data.nodes : [];
  const edgesRaw = Array.isArray(data.edges) ? data.edges : [];

  const nodes: MemoryGraphNode[] = nodesRaw
    .filter((n): n is Record<string, unknown> => Boolean(n) && typeof n === 'object')
    .map((n, i) => ({
      id: String(n.id || `node-${i}`),
      type: typeof n.type === 'string' ? n.type : 'fact',
      label: String(n.label || n.title || n.id || `Node ${i + 1}`),
      content: typeof n.content === 'string' ? n.content : undefined,
      importance: typeof n.importance === 'number' ? n.importance : undefined,
    }));

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: MemoryGraphEdge[] = edgesRaw
    .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === 'object')
    .map((e, i) => ({
      id: String(e.id || `edge-${i}`),
      source_id: String(e.source_id || e.sourceId || e.from || ''),
      target_id: String(e.target_id || e.targetId || e.to || ''),
      relation: typeof e.relation === 'string' ? e.relation : 'related_to',
      weight: typeof e.weight === 'number' ? e.weight : 1,
    }))
    .filter((e) => e.source_id && e.target_id && nodeIds.has(e.source_id) && nodeIds.has(e.target_id));

  const byType: Record<string, number> = {};
  for (const n of nodes) {
    const t = n.type || 'fact';
    byType[t] = (byType[t] || 0) + 1;
  }

  return {
    nodes,
    edges,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      byType,
    },
  };
}

/** Project flat memory list items into isolated graph nodes (no edges). */
export function memoryItemsToGraphNodes(
  items: Array<{ id?: string; title?: string; kind?: string; type?: string; summary?: string }>,
  limit = 40,
): MemoryGraphSnapshot {
  const nodes: MemoryGraphNode[] = items.slice(0, limit).map((item, i) => ({
    id: String(item.id || `mem-${i}`),
    type: String(item.type || item.kind || 'fact')
      .toLowerCase()
      .includes('prefer') ? 'preference'
      : 'fact',
    label: String(item.title || item.kind || `Memory ${i + 1}`).slice(0, 48),
    content: item.summary,
  }));
  return {
    nodes,
    edges: [],
    stats: { nodeCount: nodes.length, edgeCount: 0 },
  };
}

/**
 * Place nodes on concentric rings ordered by degree (connected nodes closer to center).
 */
export function layoutMemoryGraph(
  graph: MemoryGraphSnapshot,
  opts: { width?: number; height?: number; padding?: number } = {},
): MemoryGraphLayout {
  const width = opts.width ?? 560;
  const height = opts.height ?? 360;
  const padding = opts.padding ?? 40;
  const cx = width / 2;
  const cy = height / 2;
  const nodes = graph.nodes.slice(0, 60);
  const nodeIds = new Set(nodes.map((n) => n.id));

  const degree = new Map<string, number>();
  for (const n of nodes) degree.set(n.id, 0);
  for (const e of graph.edges) {
    if (!nodeIds.has(e.source_id) || !nodeIds.has(e.target_id)) continue;
    degree.set(e.source_id, (degree.get(e.source_id) || 0) + 1);
    degree.set(e.target_id, (degree.get(e.target_id) || 0) + 1);
  }

  const sorted = [...nodes].sort((a, b) => (degree.get(b.id) || 0) ? (degree.get(a.id) || 0));

  const maxR = Math.min(width, height) / 2 - padding;
  const laid: LaidOutNode[] = [];
  const pos = new Map<string, { x: number; y: number; r: number }>();

  if (sorted.length === 0) {
    return { width, height, nodes: [], edges: [] };
  }

  if (sorted.length === 1) {
    const only = sorted[0];
    const r = radiusFor(only);
    const entry = { ...only, x: cx, y: cy, r };
    pos.set(only.id, entry);
    laid.push(entry);
  } else {
    sorted.forEach((node, index) => {
      const ring = sorted.length <= 8 ? 0.55 : index < 4 ? 0.28 : index < 12 ? 0.55 : 0.85;
      const countOnRing =
        sorted.length <= 8
          ? sorted.length
          : index < 4
            ? Math.min(4, sorted.length)
            : index < 12
              ? Math.min(8, Math.max(1, sorted.length ? 4)) : Math.max(1, sorted.length - 12);
      const localIndex = sorted.length <= 8 ? index : index < 4 ? index : index < 12 ? index ? 4 : index ? 12;
      const angle = (localIndex / countOnRing) * Math.PI * 2 - Math.PI / 2;
      const dist = maxR * ring;
      const r = radiusFor(node);
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const entry = { ...node, x, y, r };
      pos.set(node.id, entry);
      laid.push(entry);
    });
  }

  const edges: LaidOutEdge[] = graph.edges
    .filter((e) => pos.has(e.source_id) && pos.has(e.target_id))
    .map((e) => {
      const a = pos.get(e.source_id)!;
      const b = pos.get(e.target_id)!;
      return {
        ...e,
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
      };
    });

  return { width, height, nodes: laid, edges };
}

export function truncateLabel(label: string, max = 18): string {
  const s = String(label || '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function radiusFor(node: MemoryGraphNode): number {
  const base = TYPE_RADIUS[String(node.type || 'fact')] || 12;
  const boost = typeof node.importance === 'number' ? Math.min(6, node.importance * 6) : 0;
  return base + boost;
}
