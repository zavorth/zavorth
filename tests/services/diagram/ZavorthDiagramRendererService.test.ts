import { ZavorthDiagramRendererService } from '../../../src/services/diagram/ZavorthDiagramRendererService';

describe('ZavorthDiagramRendererService', () => {
  let service: ZavorthDiagramRendererService;

  beforeEach(() => {
    service = new ZavorthDiagramRendererService();
  });

  it('should render a multi-node hierarchical graph with Sugiyama layers and Unicode boxes', () => {
    const graph = {
      nodes: [
        { id: 'CLI', label: 'CLI Interface' },
        { id: 'Agent', label: 'Central Agent' },
        { id: 'LLM', label: 'LLM Adapter' },
        { id: 'DB', label: 'SQLite Store' },
      ],
      edges: [
        { source: 'CLI', target: 'Agent', label: 'invoke' },
        { source: 'Agent', target: 'LLM', label: 'infer' },
        { source: 'Agent', target: 'DB', label: 'persist' },
      ],
    };

    const result = service.renderAscii(graph);

    expect(result.boxes.length).toBe(4);
    expect(result.textOutput).toContain('CLI Interface');
    expect(result.textOutput).toContain('Central Agent');
    expect(result.textOutput).toContain('LLM Adapter');
    expect(result.textOutput).toContain('SQLite Store');
    expect(result.textOutput).toContain('┌');
    expect(result.textOutput).toContain('▼');
  });

  it('should parse Mermaid syntax into a structured graph without brittle regex', () => {
    const mermaid = `
graph TD
  Auth[Auth Service] -->|verify| Gateway[API Gateway]
  Gateway --> Engine[Reasoning Engine]
`;

    const graph = service.parseMermaidSyntax(mermaid);

    expect(graph.nodes.length).toBe(3);
    expect(graph.edges.length).toBe(2);
    expect(graph.nodes.find((n) => n.id === 'Auth')?.label).toBe('Auth Service');
    expect(graph.edges[0].label).toBe('verify');
    expect(graph.edges[0].source).toBe('Auth');
    expect(graph.edges[0].target).toBe('Gateway');
  });

  it('should gracefully handle empty or single-node graphs', () => {
    const emptyResult = service.renderAscii({ nodes: [], edges: [] });
    expect(emptyResult.textOutput).toBe('(Empty diagram)');

    const singleNodeResult = service.renderAscii({
      nodes: [{ id: 'Root', label: 'Root Node' }],
      edges: [],
    });
    expect(singleNodeResult.boxes.length).toBe(1);
    expect(singleNodeResult.textOutput).toContain('Root Node');
  });
});
