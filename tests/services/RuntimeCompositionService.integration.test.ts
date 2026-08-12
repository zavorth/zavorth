import { ToolExecutor } from '../../src/execution/ToolExecutor';
import { RuntimeCompositionService } from '../../src/services/RuntimeCompositionService';

describe('RuntimeCompositionService integration', () => {
  it('wires graph, tool execution and telemetry through a shared trace id', async () => {
    const telemetryRuntime = {
      record: jest.fn().mockResolvedValue(undefined),
    } as any;
    const toolRegistry = {
      getToolDefinitions: jest.fn().mockReturnValue([
        {
          name: 'read_file',
          description: 'Le um arquivo local.',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
              },
            },
            required: ['path'],
          },
        },
      ]),
      getTool: jest.fn().mockReturnValue({
        execute: jest.fn().mockResolvedValue('conteudo integrado'),
      }),
    } as any;
    const toolExecutor = new ToolExecutor(toolRegistry, { log: jest.fn() } as any, telemetryRuntime);
    const composition = new RuntimeCompositionService({
      toolRegistry,
      toolExecutor,
      telemetryRuntime,
      llmRuntime: {
        getPreferredProviderName: jest.fn().mockReturnValue('AIGateway'),
        chat: jest
          .fn()
          .mockResolvedValueOnce({
            content: null,
            toolCalls: [
              {
                id: 'tool-1',
                name: 'read_file',
                arguments: { path: 'README.md' },
              },
            ],
            finishReason: 'tool_calls',
          })
          .mockResolvedValueOnce({
            content: 'Tudo analisado.',
            toolCalls: [],
            finishReason: 'stop',
          })
          .mockResolvedValueOnce({
            content: 'APROVADO',
            toolCalls: [],
            finishReason: 'stop',
          }),
      } as any,
    });

    const graphRuntime = composition.getGraphRuntime();
    const result = await graphRuntime.runAutonomousTask('analisar o README');
    const graphStartedEvent = telemetryRuntime.record.mock.calls.find(
      ([event]: any[]) => event.eventType === 'graph.started',
    )?.[0];
    const toolStartedEvent = telemetryRuntime.record.mock.calls.find(
      ([event]: any[]) => event.eventType === 'tool.started',
    )?.[0];

    expect(result.ok).toBe(true);
    expect(result.traceId).toBeTruthy();
    expect(graphStartedEvent.traceId).toBe(result.traceId);
    expect(toolStartedEvent.traceId).toBe(result.traceId);
    expect(composition.getGraphRuntime()).toBe(graphRuntime);
    expect(composition.getTelemetryRuntime()).toBe(telemetryRuntime);
    expect(composition.getToolRuntime().isAvailable()).toBe(true);
    expect(composition.getSandboxRuntime()).toBe(composition.getSandboxRuntime());
  });
});
