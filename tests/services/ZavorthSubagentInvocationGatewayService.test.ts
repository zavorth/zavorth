import { ZavorthSubagentInvocationGatewayService } from '../../src/services/ZavorthSubagentInvocationGatewayService.js';
import type { ZavorthSubagentRuntimeSnapshot } from '../../src/contracts/ZavorthSubagentRuntimeContract.js';

describe('ZavorthSubagentInvocationGatewayService', () => {
  it('routes cron, skill and plugin directed subagent work into the same runtime contract', async () => {
    const execute = jest.fn(async (input: any) => ({
      generatedAt: '2026-05-10T15:00:00.000Z',
      status: 'completed',
      action: input.action,
      mode: input.mode,
      summary: {
        liveRuns: input.mockLive ? 1 : 0,
        workerResults: input.mockLive ? 1 : 0,
      },
      runs: [{
        sourceSurface: input.sourceSurface,
        executionMode: input.executionMode,
      }],
    } as unknown as ZavorthSubagentRuntimeSnapshot));
    const gateway = new ZavorthSubagentInvocationGatewayService({
      subagentRuntime: {
        execute,
        formatSnapshotText: jest.fn((snapshot: any) => `status=${snapshot.status}`),
      },
    });

    await gateway.invokeFromCron({ text: 'use subagentes para revisar schedule', mockLive: true });
    await gateway.invokeFromSkill({ text: 'skill pede subagente auditor', mockLive: true });
    await gateway.invokeFromPlugin({ text: 'plugin direciona subagent reviewer', mockLive: true });

    expect(execute).toHaveBeenCalledTimes(3);
    expect(execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      action: 'subagents.spawn',
      sourceSurface: 'cron',
      explicitSubagents: true,
      executionMode: 'mock-live',
    }));
    expect(execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      sourceSurface: 'skill',
    }));
    expect(execute).toHaveBeenNthCalledWith(3, expect.objectContaining({
      sourceSurface: 'plugin',
    }));
  });
});
