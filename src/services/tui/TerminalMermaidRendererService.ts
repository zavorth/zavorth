export interface MermaidNode {
  readonly id: string;
  readonly label: string;
  readonly shape: 'box' | 'diamond' | 'round' | 'cylinder';
}

export interface MermaidEdge {
  readonly fromId: string;
  readonly toId: string;
  readonly label?: string;
  readonly arrowType: 'solid' | 'dotted' | 'thick';
}

export interface ParsedMermaidGraph {
  readonly direction: 'TD' | 'TB' | 'LR' | 'RL';
  readonly nodes: Map<string, MermaidNode>;
  readonly edges: readonly MermaidEdge[];
}

export class TerminalMermaidRendererService {
  private static readonly COLOR_CYAN = '\x1b[36m';
  private static readonly COLOR_GREEN = '\x1b[32m';
  private static readonly COLOR_YELLOW = '\x1b[33m';
  private static readonly COLOR_DIM = '\x1b[2m';
  private static readonly COLOR_BOLD = '\x1b[1m';
  private static readonly RESET = '\x1b[0m';

  public render(mermaidCode: string, useColor = true): string {
    const parsed = this.parse(mermaidCode);
    if (parsed.nodes.size === 0) {
      return useColor
        ? `${TerminalMermaidRendererService.COLOR_DIM}[Empty or unparseable diagram]${TerminalMermaidRendererService.RESET}`
        : '[Empty or unparseable diagram]';
    }

    if (parsed.direction === 'LR') {
      return this.renderHorizontal(parsed, useColor);
    }

    return this.renderVertical(parsed, useColor);
  }

  public parse(mermaidCode: string): ParsedMermaidGraph {
    const lines = mermaidCode.split(/\r?\n/);
    let direction: 'TD' | 'TB' | 'LR' | 'RL' = 'TD';
    const nodes = new Map<string, MermaidNode>();
    const edges: MermaidEdge[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('%%')) continue;

      if (/^(graph|flowchart)\s+(TD|TB|LR|RL)/i.test(line)) {
        const match = line.match(/^(graph|flowchart)\s+(TD|TB|LR|RL)/i);
        if (match) {
          direction = match[2].toUpperCase() as 'TD' | 'TB' | 'LR' | 'RL';
        }
        continue;
      }

      // Parse edge connections e.g. A[Start] --> B[Process] or A -->|Yes| B
      const edgePattern = /([A-Za-z0-9_-]+)(?:\[([^\]]+)\]|([^)]+)|\{([^}]+)\})?\s*(-->|--\s*>\s*\|([^|]+)\|\s*|-->\|([^|]+)\|)\s*([A-Za-z0-9_-]+)(?:\[([^\]]+)\]|([^)]+)|\{([^}]+)\})?/;
      const match = line.match(edgePattern);

      if (match) {
        const fromId = match[1];
        const fromLabel = match[2] || match[3] || match[4] || fromId;
        const edgeLabel = match[6] || match[7] || undefined;
        const toId = match[8];
        const toLabel = match[9] || match[10] || match[11] || toId;

        if (!nodes.has(fromId)) {
          nodes.set(fromId, {
            id: fromId,
            label: fromLabel,
            shape: match[4] ? 'diamond' : match[3] ? 'round' : 'box',
          });
        }
        if (!nodes.has(toId)) {
          nodes.set(toId, {
            id: toId,
            label: toLabel,
            shape: match[11] ? 'diamond' : match[10] ? 'round' : 'box',
          });
        }

        edges.push({
          fromId,
          toId,
          label: edgeLabel?.trim(),
          arrowType: 'solid',
        });
        continue;
      }

      // Parse single node e.g. A[Standalone Node]
      const singleNodePattern = /^([A-Za-z0-9_-]+)(?:\[([^\]]+)\]|([^)]+)|\{([^}]+)\})/;
      const singleMatch = line.match(singleNodePattern);
      if (singleMatch) {
        const id = singleMatch[1];
        const label = singleMatch[2] || singleMatch[3] || singleMatch[4] || id;
        if (!nodes.has(id)) {
          nodes.set(id, {
            id,
            label,
            shape: singleMatch[4] ? 'diamond' : singleMatch[3] ? 'round' : 'box',
          });
        }
      }
    }

    return { direction, nodes, edges };
  }

  private renderVertical(graph: ParsedMermaidGraph, useColor: boolean): string {
    const lines: string[] = [];
    const nodeOrder: string[] = [];
    const visited = new Set<string>();

    for (const [id] of graph.nodes) {
      if (!visited.has(id)) {
        this.collectTopologicalOrder(id, graph.edges, visited, nodeOrder);
      }
    }

    for (let i = 0; i < nodeOrder.length; i++) {
      const nodeId = nodeOrder[i];
      const node = graph.nodes.get(nodeId);
      if (!node) continue;

      const box = this.formatBox(node.label, node.shape, useColor);
      lines.push(...box);

      if (i < nodeOrder.length - 1) {
        const nextId = nodeOrder[i + 1];
        const edge = graph.edges.find((e) => e.fromId === nodeId && e.toId === nextId);
        const edgeLabel = edge?.label;

        const maxBoxLen = Math.max(...box.map((b) => this.stripAnsi(b).length));
        const padding = ' '.repeat(Math.max(0, Math.floor(maxBoxLen / 2) - 1));

        if (edgeLabel) {
          const lbl = useColor
            ? `${TerminalMermaidRendererService.COLOR_YELLOW}[${edgeLabel}]${TerminalMermaidRendererService.RESET}`
            : `[${edgeLabel}]`;
          lines.push(`${padding}│ ${lbl}`);
        } else {
          lines.push(`${padding}│`);
        }
        lines.push(`${padding}▼`);
      }
    }

    return lines.join('\n');
  }

  private renderHorizontal(graph: ParsedMermaidGraph, useColor: boolean): string {
    const nodeCards: string[][] = [];
    const edgeSeparators: string[] = [];

    const nodeOrder: string[] = [];
    const visited = new Set<string>();

    for (const [id] of graph.nodes) {
      if (!visited.has(id)) {
        this.collectTopologicalOrder(id, graph.edges, visited, nodeOrder);
      }
    }

    for (let i = 0; i < nodeOrder.length; i++) {
      const node = graph.nodes.get(nodeOrder[i]);
      if (!node) continue;

      nodeCards.push(this.formatBox(node.label, node.shape, useColor));

      if (i < nodeOrder.length - 1) {
        const nextId = nodeOrder[i + 1];
        const edge = graph.edges.find((e) => e.fromId === nodeOrder[i] && e.toId === nextId);
        edgeSeparators.push(edge?.label ? ` ──[${edge.label}]──► ` : ' ────► ');
      }
    }

    // Join cards side-by-side horizontally line-by-line
    const maxLines = Math.max(...nodeCards.map((c) => c.length), 3);
    const combinedLines: string[] = [];

    for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
      let row = '';
      for (let cardIdx = 0; cardIdx < nodeCards.length; cardIdx++) {
        const card = nodeCards[cardIdx];
        const line = card[lineIdx] || ' '.repeat(this.stripAnsi(card[0] || '').length);
        row += line;

        if (cardIdx < edgeSeparators.length) {
          const sep = edgeSeparators[cardIdx];
          const isMid = lineIdx === Math.floor(maxLines / 2);
          row += isMid ? (useColor ? `${TerminalMermaidRendererService.COLOR_CYAN}${sep}${TerminalMermaidRendererService.RESET}` : sep) : ' '.repeat(sep.length);
        }
      }
      combinedLines.push(row);
    }

    return combinedLines.join('\n');
  }

  private formatBox(label: string, shape: 'box' | 'diamond' | 'round' | 'cylinder', useColor: boolean): string[] {
    const cleanLabel = label.trim();
    const len = cleanLabel.length;
    const pad = 2;
    const width = len + pad * 2;

    const color = shape === 'diamond'
      ? TerminalMermaidRendererService.COLOR_YELLOW
      : shape === 'round'
      ? TerminalMermaidRendererService.COLOR_GREEN
      : TerminalMermaidRendererService.COLOR_CYAN;

    const topLeft = shape === 'round' ? '╭' : shape === 'diamond' ? '◇' : '┌';
    const topRight = shape === 'round' ? '╮' : shape === 'diamond' ? '◇' : '┐';
    const bottomLeft = shape === 'round' ? '╰' : shape === 'diamond' ? '◇' : '└';
    const bottomRight = shape === 'round' ? '╯' : shape === 'diamond' ? '◇' : '┘';

    const top = `${topLeft}${'─'.repeat(width)}${topRight}`;
    const mid = `│  ${cleanLabel}  │`;
    const bottom = `${bottomLeft}${'─'.repeat(width)}${bottomRight}`;

    if (!useColor) {
      return [top, mid, bottom];
    }

    return [
      `${color}${top}${TerminalMermaidRendererService.RESET}`,
      `${color}│${TerminalMermaidRendererService.RESET}  ${TerminalMermaidRendererService.COLOR_BOLD}${cleanLabel}${TerminalMermaidRendererService.RESET}  ${color}│${TerminalMermaidRendererService.RESET}`,
      `${color}${bottom}${TerminalMermaidRendererService.RESET}`,
    ];
  }

  private collectTopologicalOrder(
    currentId: string,
    edges: readonly MermaidEdge[],
    visited: Set<string>,
    order: string[]
  ): void {
    visited.add(currentId);
    order.push(currentId);

    const outgoing = edges.filter((e) => e.fromId === currentId);
    for (const edge of outgoing) {
      if (!visited.has(edge.toId)) {
        this.collectTopologicalOrder(edge.toId, edges, visited, order);
      }
    }
  }

  private stripAnsi(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }
}
