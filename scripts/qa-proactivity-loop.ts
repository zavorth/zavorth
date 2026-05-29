import assert from 'node:assert/strict';
import { ZavorthProactivePermissionService } from '../src/services/ZavorthProactivePermissionService.js';
import { NexusPendingExecutionStoreService } from '../src/domain/execution/infrastructure/NexusPendingExecutionStoreService.js';
import { HybridMemoryService } from '../src/services/HybridMemoryService.js';
import { ProactiveInferencePlaneService } from '../src/services/ProactiveInferencePlaneService.js';

async function main(): Promise<void> {
  const permissionService = new ZavorthProactivePermissionService();
  const pendingExecutionStore = new NexusPendingExecutionStoreService();
  const executionBoundary = {
    buildToolIntent: (input: Record<string, unknown>) => ({
      objective: input.prompt,
      surface: 'proactive',
      requestedBy: 'the-mind',
      sessionId: input.sessionId,
      approved: false,
      metadata: {
        origin: 'proactive_inference',
        toolName: input.toolName,
      },
      correlation: {
        traceId: 'qa-proactivity-trace',
        runId: 'qa-proactivity-run',
        sessionId: input.sessionId,
        approvalId: null,
        artifactId: null,
      },
    }),
    decide: async (intent: any) => ({
      ok: false,
      decision: 'approval_required',
      summary: 'QA approval required',
      correlation: {
        ...intent.correlation,
        approvalId: null,
      },
      runContext: {
        traceId: 'qa-proactivity-trace',
        runId: 'qa-proactivity-run',
        sessionId: intent.sessionId,
        surface: 'proactive',
        requestedBy: 'the-mind',
        profile: 'IOT',
      },
      approval: {
        approvalId: null,
        required: true,
        summary: 'QA canonical approval gate',
      },
      lifecycle: [],
      error: null,
      metadata: {},
    }),
  } as any;
  const hybridMemory = new HybridMemoryService({
    layeredMemory: {
      search: async () => ({
        generatedAt: '2026-04-18T12:00:00.000Z',
        query: 'ligue luz sala turno',
        total: 1,
        data: [{
          id: 'habit:turno',
          label: 'Habit ledger',
          summary: 'Usuario costuma preparar a sala no inicio do turno.',
          memoryLayer: 'semantic',
          source: 'layered-memory',
          confidence: 0.91,
          lastValidatedAt: '2026-04-18T11:00:00.000Z',
          metadata: {},
        }],
      }),
      readProcedures: async () => [],
    },
    embeddingService: {
      generate: async () => [0.9, 0.1],
    },
    vectorStore: {
      count: () => 1,
      searchSemantic: () => [{
        id: 'chunk-semantic',
        sessionId: 'qa-proactivity-session',
        createdAt: '2026-04-18T11:30:00.000Z',
        originalTokenCount: 300,
        compressedSummary: 'Rotina semanticamente similar de ligar a luz da sala ao iniciar o turno.',
        keywords: ['luz', 'sala', 'turno'],
        relevanceScore: 0.94,
        embedding: [0.9, 0.1],
      }],
      search: () => [],
    },
    now: () => new Date('2026-04-18T12:00:00.000Z'),
  });

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
          durationMs: 12,
        }],
        runContext: {
          traceId: 'previous-trace',
          runId: 'previous-run',
          sessionId: 'qa-proactivity-session',
          surface: 'nexus',
          requestedBy: 'zavorthControl',
          profile: 'IOT',
        },
        metadata: {},
      }],
    },
    memory: hybridMemory,
    llm: {
      chat: async () => ({
        content: JSON.stringify({
          suggestAction: true,
          actionName: 'light_turn_on',
          actionArgs: { entity_id: 'light.sala', action: 'turn_on' },
          category: 'IOT',
          reason: 'Padrao recente indica que o usuario deve querer a luz da sala ligada.',
        }),
      }),
    } as any,
    executionBoundary,
    pendingExecutionStore,
    now: () => new Date('2026-04-18T12:00:00.000Z'),
  });

  const result = await service.runInferenceCycle();
  assert.equal(result.ok, true);
  assert.equal(result.actionName, 'light_turn_on');
  assert(result.permissionId, 'proactive loop should create a pending approval');

  const pendingPermission = permissionService.listPending()[0];
  const pendingExecution = pendingExecutionStore.get(result.permissionId);
  assert.equal(pendingPermission.id, result.permissionId);
  assert.equal(pendingPermission.metadata?.kind, 'intent');
  assert.equal(pendingPermission.metadata?.source, 'proactive_inference');
  assert.equal(pendingPermission.metadata?.toolName, 'light_turn_on');
  assert.equal(pendingPermission.metadata?.memory?.mode, 'hybrid');
  assert.equal(pendingPermission.metadata?.memory?.returned, 2);
  assert.equal(pendingExecution?.kind, 'intent');
  assert.equal(pendingExecution?.toolName, 'light_turn_on');
  assert.equal(pendingExecution?.correlation?.approvalId, result.permissionId);
  assert.equal(pendingExecution?.metadata?.surface, 'proactive');

  console.log(JSON.stringify({
    ok: true,
    suite: 'qa:proactivity-loop',
    permissionId: result.permissionId,
    actionName: result.actionName,
    runId: pendingExecution?.correlation?.runId,
  }, null, 2));
}

main().catch((error) => {
  console.error('[qa:proactivity-loop] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
