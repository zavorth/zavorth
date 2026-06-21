import { ZavorthEchoOrchestrator } from '../../src/echo/orchestrator/ZavorthEchoOrchestrator';
import type { ZavorthActionGateway } from '../../src/runtime/actions/ZavorthActionGateway';

jest.mock('../../src/echo/tools/iot/HomeAssistantBridge', () => ({
  HomeAssistantBridge: class MockHomeAssistantBridge {
    name = 'iot_home_assistant';
    description = 'Mock Home Assistant';
    category = 'IOT';
    dangerLevel = 'moderate';
    requiresPermission = true;
    schema = { safeParse: jest.fn() };
    startListeningEvents = jest.fn();
    execute = jest.fn();
  },
}));

jest.mock('../../src/echo/tools/iot/MQTTPublisher', () => ({
  MQTTPublisher: class MockMqttPublisher {
    name = 'iot_mqtt_publish';
    description = 'Mock MQTT publisher';
    category = 'IOT';
    dangerLevel = 'moderate';
    requiresPermission = true;
    schema = { safeParse: jest.fn() };
    execute = jest.fn();
  },
}));

describe('ZavorthEchoOrchestrator web Action Harness tools', () => {
  it('registers the complete verified Action Harness surface for the LLM', () => {
    const gateway = {
      apply: jest.fn(),
    } as unknown as ZavorthActionGateway;
    const orchestrator = new ZavorthEchoOrchestrator({
      actionGateway: gateway,
      startBackgroundBridges: false,
    });

    const names = orchestrator.listAllTools().map((tool) => tool.name);

    expect(names).toEqual(expect.arrayContaining([
      'web_search',
      'workspace_read_file',
      'workspace_create_file',
      'shell_run_allowlisted',
      'sandbox_run_code',
      'channels_draft',
      'mcp_preview',
    ]));
  });

  it('routes provider-safe web tool names to the injected Action Harness gateway', async () => {
    const gateway = {
      apply: jest.fn().mockResolvedValue({
        ok: true,
        actionId: 'web.search',
        operation: 'action.apply',
        status: 'applied',
        summary: 'Found web results.',
        lines: [],
        data: { results: [] },
      }),
    } as unknown as ZavorthActionGateway;

    const orchestrator = new ZavorthEchoOrchestrator({
      actionGateway: gateway,
      startBackgroundBridges: false,
    });

    const result = await orchestrator.executePipeline(
      'pesquise IA open source',
      'web_search',
      { query: 'IA open source' },
      { traceId: 'trace-web' },
    );

    expect(result.response).toBe('OK: Found web results.');
    expect(gateway.apply).toHaveBeenCalledWith(
      'web.search',
      { query: 'IA open source' },
      expect.objectContaining({
        trustedOperatorConfirmation: true,
        sourceSurface: 'llm',
        actorId: 'trace-web',
      }),
    );
  });

  it('routes provider-safe workspace tool names to the injected Action Harness gateway', async () => {
    const gateway = {
      apply: jest.fn().mockResolvedValue({
        ok: true,
        actionId: 'workspace.read_file',
        operation: 'action.apply',
        status: 'applied',
        summary: 'Read workspace file.',
        lines: [],
        data: { content: 'hello' },
      }),
    } as unknown as ZavorthActionGateway;

    const orchestrator = new ZavorthEchoOrchestrator({
      actionGateway: gateway,
      startBackgroundBridges: false,
    });

    const result = await orchestrator.executePipeline(
      'leia o arquivo',
      'workspace_read_file',
      { filepath: 'README.md' },
      { traceId: 'trace-workspace' },
    );

    expect(result.response).toBe('OK: Read workspace file.');
    expect(gateway.apply).toHaveBeenCalledWith(
      'workspace.read_file',
      { filepath: 'README.md' },
      expect.objectContaining({
        trustedOperatorConfirmation: true,
        sourceSurface: 'llm',
        actorId: 'trace-workspace',
      }),
    );
  });
});
