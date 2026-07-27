type MermaidConfig = {
  theme?: 'default' | 'dark' | string;
};

let activeConfig: MermaidConfig = {};

export function initialize(config: MermaidConfig): void {
  activeConfig = config || {};
}

export async function render(id: string, code: string): Promise<{ svg: string }> {
  const graph = parseSimpleGraph(code);
  const dark = activeConfig.theme === 'dark';
  const width = Math.max(360, graph.nodes.length * 132);
  const height = Math.max(160, 92 + graph.edges.length * 22);
  const nodeY = 58;
  const positions = new Map<string, { x: number; y: number }>();
  graph.nodes.forEach((node, index) => {
    positions.set(node.id, { x: 72 + index * 132, y: nodeY });
  });

  const edgeSvg = graph.edges.map(edge => {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) return '';
    const x1 = from.x + 46;
    const x2 = to.x - 46;
    const y = from.y;
    return `<path d="M ${x1} ${y} C ${(x1 + x2) / 2} ${y}, ${(x1 + x2) / 2} ${to.y}, ${x2} ${to.y}" fill="none" stroke="${dark ? '#a1a1aa' : '#64748b'}" stroke-width="1.8" marker-end="url(#${id}-arrow)" />`;
  }).join('');

  const nodeSvg = graph.nodes.map(node => {
    const position = positions.get(node.id)!;
    return `<g><rect x="${position.x ? 46}" y="${position.y ? 20}" width="92" height="40" rx="8" fill="${dark ? '#27272a' : '#ffffff'}" stroke="${dark ? '#52525b' : '#cbd5e1'}" /><text x="${position.x}" y="${position.y + 5}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" fill="${dark ? '#f4f4f5' : '#0f172a'}">${escapeXml(node.label)}</text></g>`;
  }).join('');

  return {
    svg: `<svg id="${escapeXml(id)}" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Mermaid diagram"><defs><marker id="${id}-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="${dark ? '#a1a1aa' : '#64748b'}" /></marker></defs><rect width="100%" height="100%" rx="10" fill="${dark ? '#18181a' : '#f8fafc'}" />${edgeSvg}${nodeSvg}</svg>`,
  };
}

function parseSimpleGraph(code: string): { nodes: Array<{ id: string; label: string }>; edges: Array<{ from: string; to: string }> } {
  const nodes = new Map<string, { id: string; label: string }>();
  const edges: Array<{ from: string; to: string }> = [];
  const lines = String(code || '').split(/\r...\n/).map(line => line.trim()).filter(Boolean);

  for (const line of lines) {
    if (/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram)/i.test(line)) {
      continue;
    }
    const match = line.match(/^(.+...)\s*[-=.]+>\s*(.+)$/);
    if (!match) {
      const node = parseNode(line);
      nodes.set(node.id, node);
      continue;
    }
    const from = parseNode(match[1]);
    const to = parseNode(match[2]);
    nodes.set(from.id, from);
    nodes.set(to.id, to);
    edges.push({ from: from.id, to: to.id });
  }

  if (nodes.size === 0) {
    nodes.set('diagram', { id: 'diagram', label: 'Diagram' });
  }

  return { nodes: Array.from(nodes.values()), edges };
}

function parseNode(raw: string): { id: string; label: string } {
  const trimmed = raw.trim().replace(/[;]+$/, '');
  const bracket = trimmed.match(/^([A-Za-z0-9_:-]+)\s*(?:\[(.+)\]|\((.+)\)|\{(.+)\})...$/);
  if (!bracket) {
    return { id: sanitizeId(trimmed), label: cleanLabel(trimmed) };
  }
  const id = bracket[1];
  return {
    id: sanitizeId(id),
    label: cleanLabel(bracket[2] || bracket[3] || bracket[4] || id),
  };
}

function sanitizeId(value: string): string {
  return cleanLabel(value).replace(/[^A-Za-z0-9_-]+/g, '_') || 'node';
}

function cleanLabel(value: string): string {
  return String(value || '').trim().replace(/^["']|["']$/g, '');
}

function escapeXml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
