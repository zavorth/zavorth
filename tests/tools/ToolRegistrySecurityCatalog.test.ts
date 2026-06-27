
import { DateTimeTool } from '../../src/tools/DateTimeTool';
import { ToolRegistry } from '../../src/tools/ToolRegistry';
import { createMcpAgentToolSecurityDefinition } from '../../src/security/AgentToolSecurityCatalog';

describe('ToolRegistry security catalog', () => {
  it('attaches explicit security metadata to native tools', () => {
    const registry = new ToolRegistry();
    registry.register(new DateTimeTool());

    const definition = registry.getToolSecurityDefinition('get_datetime');

    expect(definition).toEqual(expect.objectContaining({
      toolName: 'get_datetime',
      defaultRisk: 'safe',
      requiresConfirmation: false,
      surface: 'native-tool',
    }));
    expect(definition?.capabilities).toEqual(['local-observation']);
  });

  it('fails closed for registered tools without catalog metadata', () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'brand_new_tool',
      description: 'New tool without security metadata',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: jest.fn(),
      getDefinition() {
        return {
          name: this.name,
          description: this.description,
          parameters: this.parameters,
        };
      },
    } as any);

    const definition = registry.getToolSecurityDefinition('brand_new_tool');

    expect(definition).toEqual(expect.objectContaining({
      defaultRisk: 'forbidden',
      requiresConfirmation: false,
      source: 'fallback',
      surface: 'unknown',
    }));
    expect(definition?.capabilities).toEqual(['unknown']);
    expect(registry.getSecurityCatalogAudit().fallbackDefinitions.map((entry) => entry.toolName)).toEqual([
      'brand_new_tool',
    ]);
    expect(() => registry.assertNoFallbackSecurityDefinitions()).toThrow(/Fallback-denied tool\(s\): brand_new_tool/);
  });

  it('accepts explicit security metadata for dynamic MCP tools', () => {
    const registry = new ToolRegistry();
    registry.register(
      {
        name: 'browser_click',
        description: 'Remote MCP browser click',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
        execute: jest.fn(),
        getDefinition() {
          return {
            name: this.name,
            description: this.description,
            parameters: this.parameters,
          };
        },
      } as any,
      createMcpAgentToolSecurityDefinition('browser_click'),
    );

    const definition = registry.getToolSecurityDefinition('browser_click');

    expect(definition).toEqual(expect.objectContaining({
      defaultRisk: 'review',
      requiresConfirmation: true,
      surface: 'mcp-tool',
    }));
    expect(definition?.capabilities).toEqual(expect.arrayContaining(['mcp', 'network', 'external-send']));
  });
});
