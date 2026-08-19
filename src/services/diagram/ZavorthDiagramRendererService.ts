export interface DiagramNode {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly metadata?: Record<string, string>;
}

export interface DiagramEdge {
  readonly source: string;
  readonly target: string;
  readonly label?: string;
}

export interface DiagramGraph {
  readonly nodes: readonly DiagramNode[];
  readonly edges: readonly DiagramEdge[];
}

export interface RenderedBox {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly layer: number;
}

export interface DiagramRenderResult {
  readonly textOutput: string;
  readonly boxes: readonly RenderedBox[];
  readonly totalWidth: number;
  readonly totalHeight: number;
}

export class ZavorthDiagramRendererService {
  public renderAscii(graph: DiagramGraph): DiagramRenderResult {
    if (!graph.nodes || graph.nodes.length === 0) {
      return {
        textOutput: '(Empty diagram)',
        boxes: [],
        totalWidth: 0,
        totalHeight: 0,
      };
    }

    const layers = this.assignLayers(graph);
    const orderedLayers = this.minimizeCrossings(layers, graph.edges);

    const layerSpacingY = 4;
    const nodeSpacingX = 4;
    const boxHeight = 3;

    const boxes: RenderedBox[] = [];
    const layerBoxMap = new Map<number, RenderedBox[]>();

    let currentY = 1;
    let maxCanvasWidth = 20;

    for (let layerIdx = 0; layerIdx < orderedLayers.length; layerIdx++) {
      const layerNodeIds = orderedLayers[layerIdx];
      const layerBoxes: RenderedBox[] = [];
      let currentX = 2;

      for (const nodeId of layerNodeIds) {
        const node = graph.nodes.find((n) => n.id === nodeId);
        const label = node ? node.label : nodeId;
        const boxWidth = Math.max(12, label.length + 4);

        const box: RenderedBox = {
          id: nodeId,
          label,
          x: currentX,
          y: currentY,
          width: boxWidth,
          height: boxHeight,
          layer: layerIdx,
        };

        layerBoxes.push(box);
        boxes.push(box);
        currentX += boxWidth + nodeSpacingX;
      }

      if (currentX > maxCanvasWidth) {
        maxCanvasWidth = currentX;
      }

      layerBoxMap.set(layerIdx, layerBoxes);
      currentY += boxHeight + layerSpacingY;
    }

    const totalCanvasHeight = currentY + 2;
    const totalCanvasWidth = maxCanvasWidth + 4;

    const grid: string[][] = Array.from({ length: totalCanvasHeight }, () =>
      Array.from({ length: totalCanvasWidth }, () => ' ')
    );

    for (const box of boxes) {
      this.drawBoxOnGrid(grid, box);
    }

    for (const edge of graph.edges) {
      const sourceBox = boxes.find((b) => b.id === edge.source);
      const targetBox = boxes.find((b) => b.id === edge.target);
      if (sourceBox && targetBox) {
        this.drawOrthogonalEdge(grid, sourceBox, targetBox, edge.label);
      }
    }

    const textOutput = grid
      .map((row) => row.join('').replace(/\s+$/, ''))
      .filter((row, idx, arr) => row.length > 0 || idx < arr.length - 1)
      .join('\n');

    return {
      textOutput,
      boxes,
      totalWidth: totalCanvasWidth,
      totalHeight: totalCanvasHeight,
    };
  }

  private assignLayers(graph: DiagramGraph): string[][] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const node of graph.nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }

    for (const edge of graph.edges) {
      if (inDegree.has(edge.target)) {
        inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
      }
      if (adjacency.has(edge.source)) {
        adjacency.get(edge.source)!.push(edge.target);
      }
    }

    const layers: string[][] = [];
    const assigned = new Set<string>();

    let currentLayer = graph.nodes
      .filter((n) => (inDegree.get(n.id) ?? 0) === 0)
      .map((n) => n.id);

    if (currentLayer.length === 0 && graph.nodes.length > 0) {
      currentLayer = [graph.nodes[0].id];
    }

    while (currentLayer.length > 0) {
      layers.push(currentLayer);
      for (const id of currentLayer) {
        assigned.add(id);
      }

      const nextCandidates = new Set<string>();
      for (const id of currentLayer) {
        const neighbors = adjacency.get(id) ?? [];
        for (const neighbor of neighbors) {
          if (!assigned.has(neighbor)) {
            nextCandidates.add(neighbor);
          }
        }
      }

      if (nextCandidates.size === 0) {
        const unassigned = graph.nodes.filter((n) => !assigned.has(n.id)).map((n) => n.id);
        if (unassigned.length > 0) {
          currentLayer = [unassigned[0]];
        } else {
          break;
        }
      } else {
        currentLayer = Array.from(nextCandidates);
      }
    }

    return layers;
  }

  private minimizeCrossings(layers: string[][], edges: readonly DiagramEdge[]): string[][] {
    const edgeMap = new Map<string, string[]>();
    for (const edge of edges) {
      if (!edgeMap.has(edge.source)) edgeMap.set(edge.source, []);
      edgeMap.get(edge.source)!.push(edge.target);
    }

    const orderedLayers: string[][] = [];

    for (let l = 0; l < layers.length; l++) {
      if (l === 0) {
        orderedLayers.push([...layers[0]]);
      } else {
        const prevLayer = orderedLayers[l - 1];
        const currentLayer = [...layers[l]];

        const barycenter = new Map<string, number>();

        for (const node of currentLayer) {
          const incoming = prevLayer.filter((p) => edgeMap.get(p)?.includes(node));
          if (incoming.length === 0) {
            barycenter.set(node, 0);
          } else {
            const sumPos = incoming.reduce((acc, p) => acc + prevLayer.indexOf(p), 0);
            barycenter.set(node, sumPos / incoming.length);
          }
        }

        currentLayer.sort((a, b) => (barycenter.get(a) ?? 0) - (barycenter.get(b) ?? 0));
        orderedLayers.push(currentLayer);
      }
    }

    return orderedLayers;
  }

  private drawBoxOnGrid(grid: string[][], box: RenderedBox): void {
    const { x, y, width, height, label } = box;

    grid[y][x] = '┌';
    for (let i = 1; i < width - 1; i++) grid[y][x + i] = '─';
    grid[y][x + width - 1] = '┐';

    grid[y + 1][x] = '│';
    const padding = Math.max(0, width - 2 - label.length);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    const paddedLabel = ' '.repeat(leftPad) + label + ' '.repeat(rightPad);
    for (let i = 0; i < paddedLabel.length; i++) {
      grid[y + 1][x + 1 + i] = paddedLabel[i];
    }
    grid[y + 1][x + width - 1] = '│';

    grid[y + height - 1][x] = '└';
    for (let i = 1; i < width - 1; i++) grid[y + height - 1][x + i] = '─';
    grid[y + height - 1][x + width - 1] = '┘';
  }

  private drawOrthogonalEdge(
    grid: string[][],
    source: RenderedBox,
    target: RenderedBox,
    label?: string
  ): void {
    const startX = source.x + Math.floor(source.width / 2);
    const startY = source.y + source.height;
    const endX = target.x + Math.floor(target.width / 2);
    const endY = target.y - 1;

    if (startY <= endY) {
      const midY = Math.floor((startY + endY) / 2);

      for (let y = startY; y <= midY; y++) {
        if (grid[y]) grid[y][startX] = '│';
      }

      const minX = Math.min(startX, endX);
      const maxX = Math.max(startX, endX);
      for (let x = minX; x <= maxX; x++) {
        if (grid[midY]) grid[midY][x] = '─';
      }

      if (startX !== endX) {
        if (grid[midY]) {
          grid[midY][startX] = startX < endX ? '└' : '┘';
          grid[midY][endX] = startX < endX ? '┐' : '┌';
        }
      }

      for (let y = midY; y < endY; y++) {
        if (grid[y]) grid[y][endX] = '│';
      }

      if (grid[endY]) {
        grid[endY][endX] = '▼';
      }

      if (label && grid[midY]) {
        const labelX = Math.min(startX, endX) + 2;
        for (let i = 0; i < label.length; i++) {
          if (grid[midY - 1] && grid[midY - 1][labelX + i]) {
            grid[midY - 1][labelX + i] = label[i];
          }
        }
      }
    }
  }

  public parseMermaidSyntax(mermaidSource: string): DiagramGraph {
    const nodesMap = new Map<string, DiagramNode>();
    const edges: DiagramEdge[] = [];

    const lines = mermaidSource.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('graph ') || line.startsWith('flowchart ') || line.startsWith('%%')) {
        continue;
      }

      if (line.includes('-->')) {
        const arrowIdx = line.indexOf('-->');
        const leftPart = line.substring(0, arrowIdx).trim();
        let rightPart = line.substring(arrowIdx + 3).trim();

        let edgeLabel: string | undefined;
        if (rightPart.startsWith('|')) {
          const closingPipe = rightPart.indexOf('|', 1);
          if (closingPipe > 0) {
            edgeLabel = rightPart.substring(1, closingPipe).trim();
            rightPart = rightPart.substring(closingPipe + 1).trim();
          }
        }

        const sourceNode = this.extractNodeToken(leftPart);
        const targetNode = this.extractNodeToken(rightPart);

        if (sourceNode.id) {
          nodesMap.set(sourceNode.id, sourceNode);
        }
        if (targetNode.id) {
          nodesMap.set(targetNode.id, targetNode);
        }

        if (sourceNode.id && targetNode.id) {
          edges.push({
            source: sourceNode.id,
            target: targetNode.id,
            label: edgeLabel,
          });
        }
      } else if (line.includes('[') && line.includes(']')) {
        const singleNode = this.extractNodeToken(line);
        if (singleNode.id) {
          nodesMap.set(singleNode.id, singleNode);
        }
      }
    }

    return {
      nodes: Array.from(nodesMap.values()),
      edges,
    };
  }

  private extractNodeToken(token: string): DiagramNode {
    const trimmed = token.trim();
    const openBracket = trimmed.indexOf('[');
    const closeBracket = trimmed.indexOf(']');

    if (openBracket > 0 && closeBracket > openBracket) {
      const id = trimmed.substring(0, openBracket).trim();
      const label = trimmed.substring(openBracket + 1, closeBracket).trim();
      return { id, label: label || id };
    }

    return { id: trimmed, label: trimmed };
  }
}
