/**
 * Layout for the Zavorth capability constellation (skills, channels, agents, power).
 * Pure geometry — no DOM.
 */

export type ConstellationDomain = 'skills' | 'channels' | 'agents' | 'power' | 'trust' | 'product';

export type ConstellationNodeInput = {
  id: string;
  label: string;
  domain: ConstellationDomain;
  status?: 'live' | 'available' | 'needs_setup' | 'blocked' | 'idle';
  weight?: number;
};

export type ConstellationNode = ConstellationNodeInput & {
  x: number;
  y: number;
  r: number;
  angle: number;
  ring: number;
};

export type ConstellationEdge = {
  id: string;
  from: string;
  to: string;
};

export type ConstellationGraph = {
  nodes: ConstellationNode[];
  edges: ConstellationEdge[];
  width: number;
  height: number;
  cx: number;
  cy: number;
};

const DOMAIN_RING: Record<ConstellationDomain, number> = {
  trust: 0,
  product: 0,
  skills: 1,
  channels: 2,
  agents: 2,
  power: 3,
};

const DOMAIN_ORDER: ConstellationDomain[] = [
  'trust',
  'product',
  'skills',
  'channels',
  'agents',
  'power',
];

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function nodeRadius(weight = 1, status?: ConstellationNodeInput['status']): number {
  const base = status === 'live' ? 7 : status === 'blocked' ? 5 : 6;
  return base + Math.min(4, Math.sqrt(Math.max(0, weight)) * 1.2);
}

/**
 * Place nodes on domain rings around a center. Deterministic per id.
 */
export function layoutConstellation(
  inputs: ConstellationNodeInput[],
  size: { width: number; height: number } = { width: 720, height: 480 },
): ConstellationGraph {
  const width = Math.max(320, size.width);
  const height = Math.max(240, size.height);
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(width, height) * 0.42;

  const byDomain = new Map<ConstellationDomain, ConstellationNodeInput[]>();
  for (const d of DOMAIN_ORDER) byDomain.set(d, []);
  for (const node of inputs) {
    const list = byDomain.get(node.domain) || [];
    list.push(node);
    byDomain.set(node.domain, list);
  }

  const nodes: ConstellationNode[] = [];
  for (const domain of DOMAIN_ORDER) {
    const group = byDomain.get(domain) || [];
    if (!group.length) continue;
    const ring = DOMAIN_RING[domain];
    const ringRadius = ring === 0 ? maxR * 0.12 : maxR * (0.28 + ring * 0.22);
    group.forEach((item, index) => {
      const seed = hashString(item.id);
      const jitter = ((seed % 1000) / 1000 - 0.5) * (Math.PI * 2) * 0.04;
      const angle = (index / group.length) * Math.PI * 2 + jitter + (seed % 7) * 0.01;
      const wobble = 1 + ((seed % 50) / 50 - 0.5) * 0.08;
      const r = nodeRadius(item.weight, item.status);
      nodes.push({
        ...item,
        ring,
        angle,
        r,
        x: cx + Math.cos(angle) * ringRadius * wobble,
        y: cy + Math.sin(angle) * ringRadius * wobble,
      });
    });
  }

  const edges: ConstellationEdge[] = [];
  const trust = nodes.filter(n => n.domain === 'trust' || n.domain === 'product');
  for (const hub of trust) {
    for (const leaf of nodes) {
      if (leaf.id === hub.id) continue;
      if (leaf.domain === 'skills' || leaf.domain === 'channels' || leaf.domain === 'agents') {
        edges.push({ id: `${hub.id}->${leaf.id}`, from: hub.id, to: leaf.id });
      }
    }
  }
  // Cap edges for readability
  const limitedEdges = edges.slice(0, Math.min(edges.length, nodes.length * 2));

  return { nodes, edges: limitedEdges, width, height, cx, cy };
}

export function filterConstellationNodes(
  nodes: ConstellationNodeInput[],
  query: string,
): ConstellationNodeInput[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  return nodes.filter(
    n =>
      n.label.toLowerCase().includes(q)
      || n.domain.includes(q)
      || n.id.toLowerCase().includes(q)
      || (n.status || '').includes(q),
  );
}

export function buildConstellationFromRuntime(input: {
  tools?: Array<{ id?: string; name?: string; label?: string }>;
  channels?: Array<{ id?: string; name?: string; label?: string; status?: string }>;
  agents?: Array<{ id?: string; name?: string; role?: string; status?: string }>;
  approvalsPending?: number;
  receiptsCount?: number;
}): ConstellationNodeInput[] {
  const nodes: ConstellationNodeInput[] = [
    {
      id: 'core:trust',
      label: 'Trust',
      domain: 'trust',
      status: (input.approvalsPending || 0) > 0 ? 'needs_setup' : 'live',
      weight: 3 + (input.approvalsPending || 0),
    },
    {
      id: 'core:product',
      label: 'Product',
      domain: 'product',
      status: 'live',
      weight: 2 + Math.min(5, input.receiptsCount || 0),
    },
  ];

  for (const tool of input.tools || []) {
    const id = String(tool.id || tool.name || '').trim();
    if (!id) continue;
    nodes.push({
      id: `skill:${id}`,
      label: String(tool.label || tool.name || id),
      domain: 'skills',
      status: 'available',
      weight: 1,
    });
  }

  for (const ch of input.channels || []) {
    const id = String(ch.id || ch.name || '').trim();
    if (!id) continue;
    const st = String(ch.status || '').toLowerCase();
    nodes.push({
      id: `channel:${id}`,
      label: String(ch.label || ch.name || id),
      domain: 'channels',
      status: st.includes('live') || st.includes('ready') ? 'live'
        : st.includes('block') ? 'blocked'
          : st.includes('setup') || st.includes('need') ? 'needs_setup'
            : 'available',
      weight: 1.5,
    });
  }

  for (const agent of input.agents || []) {
    const id = String(agent.id || '').trim();
    if (!id) continue;
    const st = String(agent.status || '').toLowerCase();
    nodes.push({
      id: `agent:${id}`,
      label: String(agent.name || agent.role || id),
      domain: 'agents',
      status: st.includes('run') ? 'live' : st.includes('error') ? 'blocked' : 'idle',
      weight: 1.2,
    });
  }

  if (!(input.tools || []).length) {
    nodes.push({ id: 'skill:placeholder', label: 'Skills', domain: 'skills', status: 'available', weight: 1 });
  }
  if (!(input.channels || []).length) {
    nodes.push({ id: 'channel:placeholder', label: 'Channels', domain: 'channels', status: 'needs_setup', weight: 1 });
  }
  if (!(input.agents || []).length) {
    nodes.push({ id: 'agent:placeholder', label: 'Agents', domain: 'agents', status: 'idle', weight: 1 });
  }

  nodes.push({ id: 'power:backends', label: 'Power', domain: 'power', status: 'available', weight: 2 });

  return nodes;
}
