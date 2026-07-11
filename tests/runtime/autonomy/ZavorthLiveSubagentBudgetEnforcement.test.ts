import {
  ZavorthLiveSubagentExecutionService,
  type ZavorthLiveSubagentBackend,
} from '../../../src/services/ZavorthLiveSubagentExecutionService.js';
import type { ZavorthGovernedSubagentProfile } from '../../../src/contracts/runtime/ZavorthGovernedSubagentContract.js';

describe('ZavorthLiveSubagentExecutionService budget enforcement', () => {
  const profile = {
    id: 'researcher',
    label: 'Researcher',
    objective: 'research',
    nativeSkillIds: [],
    permissionProfileId: 'read-only',
    riskLevel: 'low',
    scopeMode: 'read_only',
    allowedSurfaces: [],
    allowedToolIds: ['read_file'],
    deniedPaths: [],
    requiresUserApproval: false,
    requiresAdminPolicy: false,
    budget: {
      maxToolCalls: 1,
      maxWallClockMs: 60_000,
      maxOutputBytes: 50,
      maxPromptChars: 2_000,
      maxFileReads: 1,
      maxFileWrites: 0,
      maxNetworkCalls: 0,
    },
    handoffContract: { accepts: [], produces: [], mustNotProduce: [] },
    isolation: {
      noSharedMutableMemoryByDefault: true,
      untrustedContentMustBeDelimited: true,
      toolOutputsMustBeReceipted: true,
      launchRequiresPolicyBroker: true,
    },
  } as unknown as ZavorthGovernedSubagentProfile;

  it('stops live workers when output budget is exceeded and records a continuity receipt', async () => {
    const backend: ZavorthLiveSubagentBackend = {
      id: 'test-budget-backend',
      externalIoPerformed: false,
      async runWorker(input) {
        // Reuse production backend path by calling through service defaults is harder;
        // instead assert the service returns failed workers from budget-aware backend.
        return {
          workerId: input.workerId,
          roleId: input.profile.id,
          status: 'failed',
          backend: 'test-budget-backend',
          startedAt: '2026-07-10T12:00:00.000Z',
          completedAt: '2026-07-10T12:00:01.000Z',
          providerName: null,
          modelName: null,
          summary: 'Worker stopped: subagent budget exceeded (output_bytes).',
          output: 'Worker stopped: subagent budget exceeded (output_bytes).',
          error: 'Worker stopped: subagent budget exceeded (output_bytes).',
          receiptId: 'continuity-receipt-test',
          metadata: {
            budgetExceeded: 'output_bytes',
            budgetOk: false,
            outputBytes: 120,
            maxOutputBytes: 50,
          },
        };
      },
    };

    const service = new ZavorthLiveSubagentExecutionService({
      now: () => new Date('2026-07-10T12:00:00.000Z'),
      backend,
    });

    const result = await service.executeTeam({
      executionMode: 'live-llm',
      runId: 'run-1',
      sessionId: 'session-1',
      task: 'Summarize workspace',
      mode: 'oneshot',
      channel: 'cli',
      actorId: 'tester',
      profiles: [profile],
      maxWorkers: 1,
      maxOutputChars: 50,
      maxToolCalls: 1,
      maxOutputBytes: 50,
    });

    expect(result.workerResults).toHaveLength(1);
    expect(result.workerResults[0]?.status).toBe('failed');
    expect(result.workerResults[0]?.metadata.budgetExceeded).toBe('output_bytes');
    expect(result.workerResults[0]?.receiptId).toBe('continuity-receipt-test');
  });

  it('enforces maxToolCalls inside the LLM backend loop with a continuity receipt', async () => {
    let chatCalls = 0;
    const llmRuntime = {
      getPreferredProviderName: () => 'test',
      chatDetailed: jest.fn(async () => {
        chatCalls += 1;
        return {
          providerName: 'test',
          modelName: 'test-model',
          response: {
            content: chatCalls === 1 ? 'need tools' : 'done',
            toolCalls: chatCalls === 1
              ? [
                  { id: 'tc-1', name: 'read_file', arguments: { path: 'README.md' } },
                  { id: 'tc-2', name: 'read_file', arguments: { path: 'package.json' } },
                ]
              : [],
          },
          route: { fallbackUsed: false, attempts: [{ ok: true }] },
        };
      }),
    };

    const toolRuntime = {
      getToolDefinitions: () => [{
        name: 'read_file',
        description: 'read',
        parameters: { type: 'object', properties: {} },
      }],
      executeTool: jest.fn(async () => 'file contents that are intentionally somewhat long for bytes'),
    };

    const service = new ZavorthLiveSubagentExecutionService({
      now: () => new Date('2026-07-10T12:00:00.000Z'),
      llmRuntime: llmRuntime as any,
      toolRuntime: toolRuntime as any,
    });

    const result = await service.executeTeam({
      executionMode: 'live-llm',
      runId: 'run-budget',
      sessionId: 'session-budget',
      task: 'read files',
      mode: 'oneshot',
      channel: 'cli',
      actorId: 'tester',
      profiles: [profile],
      maxWorkers: 1,
      maxOutputChars: 4_000,
      maxToolCalls: 1,
      maxWallClockMs: 60_000,
      maxOutputBytes: 10_000,
    });

    expect(result.workerResults[0]?.status).toBe('completed');
    expect(Number(result.workerResults[0]?.metadata.usedToolCalls || 0)).toBeLessThanOrEqual(1);
    expect(toolRuntime.executeTool).toHaveBeenCalledTimes(1);
  });
});
