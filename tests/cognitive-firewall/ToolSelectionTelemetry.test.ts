import { CognitiveFirewall } from '../../src/cognitive-firewall';
import { ContextEngine } from '../../src/context-engine/ContextEngine';
import type { ToolDefinition } from '../../src/providers/ILlmProvider';

function buildTool(name: string, description: string): ToolDefinition {
  return {
    name,
    description,
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input value' },
      },
      required: ['input'],
    },
  };
}

const ALL_TOOLS: ToolDefinition[] = [
  buildTool('web_search', 'Search the web for information. Supports pagination.'),
  buildTool('read_file', 'Read a file from the workspace.'),
  buildTool('create_file', 'Create a new file in the workspace.'),
  buildTool('list_directory', 'List directory contents.'),
];

describe('CognitiveFirewall tool-selection telemetry', () => {
  it('accumulates token savings across evaluations in compact mode', () => {
    const firewall = new CognitiveFirewall({ compactMode: true });
    expect(firewall.getToolSelectionTelemetry().evaluations).toBe(0);

    const first = firewall.evaluate('search the web for news', ALL_TOOLS);
    const second = firewall.evaluate('read the file README.md', ALL_TOOLS);
    const expectedSaved = (first.tokenSavings?.savedTokens || 0) + (second.tokenSavings?.savedTokens || 0);
    const expectedFull = (first.tokenSavings?.fullTokens || 0) + (second.tokenSavings?.fullTokens || 0);

    const telemetry = firewall.getToolSelectionTelemetry();
    expect(telemetry.evaluations).toBe(2);
    expect(telemetry.compactModeEvaluations).toBe(2);
    expect(telemetry.tokensSaved).toBe(expectedSaved);
    expect(telemetry.tokensFull).toBe(expectedFull);
    expect(telemetry.tokensSaved).toBeGreaterThan(0);
  });

  it('counts quarantined tool exposures and stays immutable from outside', () => {
    const firewall = new CognitiveFirewall({ compactMode: true });
    firewall.evaluate('search the web for news', ALL_TOOLS);
    const telemetry = firewall.getToolSelectionTelemetry();
    expect(telemetry.quarantinedToolExposures).toBeGreaterThanOrEqual(0);

    telemetry.evaluations = 99;
    expect(firewall.getToolSelectionTelemetry().evaluations).not.toBe(99);
  });

  it('is surfaced through the ContextEngine improvement stats observability point', () => {
    const engine = new ContextEngine({ compactMode: true, clusterMode: true });
    const stats = engine.getImprovementStats();
    expect(stats.toolSelection).toBeDefined();
    expect(stats.toolSelection.evaluations).toBe(0);

    engine.prepare('read the file README.md', 'user-1', 'chat-1', 'test', ALL_TOOLS, 'system');
    expect(engine.getImprovementStats().toolSelection.evaluations).toBe(1);
  });
});
