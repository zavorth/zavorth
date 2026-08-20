import { TerminalMermaidRendererService } from '../../../src/services/tui/TerminalMermaidRendererService.js';

describe('TerminalMermaidRendererService', () => {
  let renderer: TerminalMermaidRendererService;

  beforeEach(() => {
    renderer = new TerminalMermaidRendererService();
  });

  it('parses vertical flowchart TD with nodes and directional edges', () => {
    const code = `
flowchart TD
  A[Client Request] --> B[AI Gateway]
  B --> C[Agent Runtime]
`;
    const parsed = renderer.parse(code);

    expect(parsed.direction).toBe('TD');
    expect(parsed.nodes.size).toBe(3);
    expect(parsed.nodes.get('A')?.label).toBe('Client Request');
    expect(parsed.edges).toHaveLength(2);
  });

  it('renders vertical diagram with Unicode box drawing borders', () => {
    const code = `
flowchart TD
  A[Start] --> B[Process]
`;
    const rendered = renderer.render(code, false);

    expect(rendered).toContain('┌');
    expect(rendered).toContain('Start');
    expect(rendered).toContain('│');
    expect(rendered).toContain('▼');
    expect(rendered).toContain('Process');
  });

  it('renders horizontal diagram LR with arrows between cards', () => {
    const code = `
graph LR
  A[Alpha] --> B[Beta]
`;
    const rendered = renderer.render(code, false);

    expect(rendered).toContain('Alpha');
    expect(rendered).toContain('Beta');
    expect(rendered).toContain('────►');
  });

  it('handles edge labels with decision markers', () => {
    const code = `
flowchart TD
  A[Check Status] -->|Yes| B[Proceed]
`;
    const parsed = renderer.parse(code);
    expect(parsed.edges[0].label).toBe('Yes');

    const rendered = renderer.render(code, false);
    expect(rendered).toContain('[Yes]');
  });
});
