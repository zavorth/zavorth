import { ZavorthProactivePermissionService } from '../../src/services/ZavorthProactivePermissionService.js';
import { EchoPendingExecutionStoreService } from '../../src/domain/execution/infrastructure/EchoPendingExecutionStoreService.js';
import { HybridMemoryService } from '../../src/services/HybridMemoryService.js';
import { ProactiveInferencePlaneService } from '../../src/services/ProactiveInferencePlaneService.js';

describe('ProactiveInferencePlaneService', () => {
  it('skips the cycle when there is no recent canonical history', async () => {
    const service = new ProactiveInferencePlaneService(null, new ZavorthProactivePermissionService(), {
      history: {
        getHistory: () => [],
      },
      memory: {
        previewRecall: jest.fn(),
      } as any,
      llm: {
        chat: jest.fn(),
      } as any,
    });

    const result = await service.runInferenceCycle();

    expect(result).toEqual({
      ok: true,
      skipped: 'no_recent_execution',
    });
  });

  it('creates a pending proactive intent backed by the canonical execution boundary', async () => {
    const permissionService = new ZavorthProactivePermissionService();
    const pendingExecutionStore = new EchoPendingExecutionStoreService();
    const executionBoundary = {
      buildToolIntent: jest.fn(() => ({
        objective: 'Echo tool light_turn_on',
        surface: 'proactive',
        requestedBy: 'the-mind',
        sessionId: 'sess-1',
        approved: false,
        metadata: {
          origin: 'proactive_inference',
        },
        correlation: {
          traceId: 'trace-1',
          runId: 'run-1',
          sessionId: 'sess-1',
          approvalId: null,
          artifactId: null,
        },
      })),
      decide: jest.fn(async () => ({
        ok: false,
        decision: 'approval_required',
        summary: 'approval required',
        correlation: {
          traceId: 'trace-1',
          runId: 'run-1',
          sessionId: 'sess-1',
          approvalId: null,
          artifactId: null,
        },
        runContext: {
          traceId: 'trace-1',
          runId: 'run-1',
          sessionId: 'sess-1',
          surface: 'proactive',
          requestedBy: 'the-mind',
          profile: 'IOT',
        },
        approval: {
          approvalId: null,
          required: true,
          summary: 'Approval gate linked to canonical run.',
        },
        lifecycle: [],
        error: null,
        metadata: {},
      })),
    } as any;

    const service = new ProactiveInferencePlaneService(null, permissionService, {
      history: {
        getHistory: () => [{
          prompt: 'ligue a luz da sala',
          status: 'success',
          toolCalls: [{
            toolName: 'light_turn_on',
            args: {},
            securityDecision: 'approved',
            result: 'ok',
            durationMs: 20,
          }],
          runContext: {
            traceId: 'trace-previous',
            runId: 'run-previous',
            sessionId: 'sess-1',
            surface: 'echo',
            requestedBy: 'dashboard',
            profile: 'IOT',
          },
          metadata: {},
        }],
      },
      memory: {
        previewRecall: jest.fn(async () => ({
          ok: true,
          mode: 'hybrid',
          summary: {
            returned: 2,
          },
          context: '- [ledger/memory] The user usually turns on the living room light near the end of the afternoon.',
          warnings: [],
        })),
      } as any,
      llm: {
        chat: jest.fn(async () => ({
          content: JSON.stringify({
            suggestAction: true,
            actionName: 'light_turn_on',
            actionArgs: { entity_id: 'light.sala', action: 'turn_on' },
            category: 'IOT',
            reason: 'The user usually turns on the living-room light at this time.',
          }),
        })),
      } as any,
      executionBoundary,
      pendingExecutionStore,
      now: () => new Date('2026-04-18T12:00:00.000Z'),
    });

    const result = await service.runInferenceCycle();
    const permission = permissionService.listPending()[0];
    const pendingExecution = pendingExecutionStore.get(permission.id);

    expect(result.ok).toBe(true);
    expect(result.permissionId).toBe(permission.id);
    expect(permission.metadata).toEqual(expect.objectContaining({
      kind: 'intent',
      source: 'proactive_inference',
      toolName: 'light_turn_on',
    }));
    expect(pendingExecution).toEqual(expect.objectContaining({
      permissionId: permission.id,
      kind: 'intent',
      toolName: 'light_turn_on',
      args: { entity_id: 'light.sala', action: 'turn_on' },
    }));
    expect(executionBoundary.buildToolIntent).toHaveBeenCalledWith(expect.objectContaining({
      toolName: 'light_turn_on',
      category: 'IOT',
      approved: false,
    }));
  });

  it('uses semantic hybrid recall inside the proactive loop when embeddings are available', async () => {
    const permissionService = new ZavorthProactivePermissionService();
    const pendingExecutionStore = new EchoPendingExecutionStoreService();
    const vectorStore = {
      count: jest.fn(() => 1),
      searchSemantic: jest.fn(() => [
        {
          id: 'chunk-semantic',
          sessionId: 'sess-2',
          createdAt: '2026-04-18T11:30:00.000Z',
          originalTokenCount: 320,
          compressedSummary: 'Rotina semanticamente similar de ligar a luz da sala ao iniciar o turno.',
          keywords: ['luz', 'sala', 'turno'],
          relevanceScore: 0.93,
          embedding: [0.9, 0.1],
        },
      ]),
      search: jest.fn(() => []),
    };
    const memory = new HybridMemoryService({
      layeredMemory: {
        search: jest.fn(async () => ({
          generatedAt: '2026-04-18T12:00:00.000Z',
          query: 'luz sala turno',
          total: 1,
          data: [{
            id: 'memory:there isbit',
            label: 'Habit ledger',
            summary: 'The user usually prepares the room at the start of the shift.',
            memoryLayer: 'semantic',
            source: 'layered-memory',
            confidence: 0.89,
            lastValidatedAt: '2026-04-18T11:00:00.000Z',
            metadata: {},
          }],
        })),
        readProcedures: jest.fn(),
      },
      embeddingService: {
        generate: jest.fn(async () => [0.9, 0.1]),
      },
      vectorStore,
      now: () => new Date('2026-04-18T12:00:00.000Z'),
    });
    const executionBoundary = {
      buildToolIntent: jest.fn(() => ({
        objective: 'Echo tool light_turn_on',
        surface: 'proactive',
        requestedBy: 'the-mind',
        sessionId: 'sess-2',
        approved: false,
        metadata: {
          origin: 'proactive_inference',
        },
        correlation: {
          traceId: 'trace-2',
          runId: 'run-2',
          sessionId: 'sess-2',
          approvalId: null,
          artifactId: null,
        },
      })),
      decide: jest.fn(async () => ({
        ok: false,
        decision: 'approval_required',
        summary: 'approval required',
        correlation: {
          traceId: 'trace-2',
          runId: 'run-2',
          sessionId: 'sess-2',
          approvalId: null,
          artifactId: null,
        },
        runContext: {
          traceId: 'trace-2',
          runId: 'run-2',
          sessionId: 'sess-2',
          surface: 'proactive',
          requestedBy: 'the-mind',
          profile: 'IOT',
        },
        approval: {
          approvalId: null,
          required: true,
          summary: 'Approval gate linked to canonical run.',
        },
        lifecycle: [],
        error: null,
        metadata: {},
      })),
    } as any;

    const service = new ProactiveInferencePlaneService(null, permissionService, {
      history: {
        getHistory: () => [{
          prompt: 'ligue a luz da sala',
          status: 'success',
          toolCalls: [{
            toolName: 'light_turn_on',
            args: {},
            securityDecision: 'approved',
            result: 'ok',
            durationMs: 20,
          }],
          runContext: {
            traceId: 'trace-prev',
            runId: 'run-prev',
            sessionId: 'sess-2',
            surface: 'echo',
            requestedBy: 'dashboard',
            profile: 'IOT',
          },
          metadata: {},
        }],
      },
      memory,
      llm: {
        chat: jest.fn(async () => ({
          content: JSON.stringify({
            suggestAction: true,
            actionName: 'light_turn_on',
            actionArgs: { entity_id: 'light.sala', action: 'turn_on' },
            category: 'IOT',
            reason: 'Semantic memory indicates the pattern of turning on the living-room light at shift start.',
          }),
        })),
      } as any,
      executionBoundary,
      pendingExecutionStore,
      now: () => new Date('2026-04-18T12:00:00.000Z'),
    });

    const result = await service.runInferenceCycle();
    const permission = permissionService.listPending()[0];

    expect(result.ok).toBe(true);
    expect(permission.metadata?.memory).toEqual(expect.objectContaining({
      mode: 'hybrid',
      returned: 2,
      warnings: [],
    }));
    expect(vectorStore.searchSemantic).toHaveBeenCalledWith([0.9, 0.1], 12, ['ligue', 'luz', 'sala', 'light_turn_on', 'success']);
  });
});
