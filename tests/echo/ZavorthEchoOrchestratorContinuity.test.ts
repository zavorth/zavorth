import { ZavorthEchoOrchestrator } from '../../src/echo/orchestrator/ZavorthEchoOrchestrator';
import type { IZavorthTool } from '../../src/echo/types/IZavorthTool';
import { z } from 'zod';
import {
  isOperatorContinuityEnvelope,
} from '../../src/runtime/operator/OperatorContinuityEnvelope';

jest.mock('../../src/echo/tools/iot/HomeAssistantBridge', () => ({
  HomeAssistantBridge: class MockHomeAssistantBridge {
    name = 'iot_home_assistant';
    description = 'Mock Home Assistant';
    category = 'IOT';
    dangerLevel = 'moderate';
    requiresPermission = true;
    schema = { safeParse: jest.fn(), parse: (value: unknown) => value };
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
    schema = { safeParse: jest.fn(), parse: (value: unknown) => value };
    execute = jest.fn();
  },
}));

describe('ZavorthEchoOrchestrator operator continuity', () => {
  it('seals successful tool.execute through OperatorContinuityKernel', async () => {
    const execute = jest.fn(async () => ({
      success: true,
      message: 'info ok',
      data: { cpu: 1 },
    }));
    const tool: IZavorthTool = {
      name: 'test_echo_tool',
      description: 'test',
      category: 'INTERNAL',
      dangerLevel: 'safe',
      requiresPermission: false,
      schema: z.object({ value: z.string().optional() }),
      execute,
    };

    const orchestrator = new ZavorthEchoOrchestrator({
      startBackgroundBridges: false,
      capturePipelineHistory: false,
    });
    orchestrator.registerTool(tool);

    const result = await orchestrator.executePipeline(
      'show system info',
      'test_echo_tool',
      { value: 'ok' },
      { traceId: 'trace-echo-1' },
    );

    expect(result.response).toBe('OK: info ok');
    expect(execute).toHaveBeenCalledTimes(1);
    const envelope = orchestrator.getLastContinuityEnvelope();
    expect(isOperatorContinuityEnvelope(envelope)).toBe(true);
    expect(envelope?.request?.surface).toBe('echo');
    expect(envelope?.request?.operation).toBe('echo.tool.execute');
    expect(envelope?.request?.target).toBe('test_echo_tool');
    expect(envelope?.decision?.allowed).toBe(true);
    expect(envelope?.result?.status).toBe('applied');
    expect(envelope?.receipt?.terminal).toBe(true);
    expect(result.data?.operatorContinuity?.continuityId).toBe(envelope?.ids.continuityId);
  });

  it('seals SecurityEngine blocks without calling tool.execute', async () => {
    const execute = jest.fn(async () => ({
      success: true,
      message: 'should not run',
    }));
    const tool: IZavorthTool = {
      name: 'test_blocked_tool',
      description: 'test',
      category: 'INTERNAL',
      dangerLevel: 'safe',
      requiresPermission: false,
      schema: z.object({ value: z.string() }),
      execute,
    };

    const orchestrator = new ZavorthEchoOrchestrator({
      startBackgroundBridges: false,
      capturePipelineHistory: false,
    });
    orchestrator.registerTool(tool);

    const result = await orchestrator.executePipeline(
      'run blocked tool',
      'test_blocked_tool',
      {},
      { traceId: 'trace-echo-block' },
    );

    expect(result.response).toContain('SECURITY BLOCK');
    expect(execute).not.toHaveBeenCalled();
    const envelope = orchestrator.getLastContinuityEnvelope();
    expect(isOperatorContinuityEnvelope(envelope)).toBe(true);
    expect(envelope?.decision?.allowed).toBe(false);
    expect(envelope?.result?.status).toBe('blocked');
    expect(envelope?.receipt?.terminal).toBe(true);
  });
});
