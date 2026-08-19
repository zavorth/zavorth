import { ZavorthAgentGateway } from '../../../src/runtime/agent/ZavorthAgentGateway.js';
import type { ChatMessage, ToolDefinition } from '../../../src/providers/ILlmProvider.js';
import type { LlmRuntimeResult } from '../../../src/services/llm/LlmRuntimeService.js';

describe('ZavorthAgentGateway live LLM steering', () => {
  it('aborts and reissues the active LLM call when /steer arrives mid-flight', async () => {
    const capturedMessages: ChatMessage[][] = [];
    const capturedSignals: Array<AbortSignal | undefined> = [];
    const emitted: Array<{ type: string; payload?: Record<string, unknown> }> = [];
    const firstCallAbort = jest.fn();
    const llmRuntime = {
      chatDetailed: jest.fn((messages: ChatMessage[], _tools?: ToolDefinition[], options?: { signal?: AbortSignal }) => {
        capturedMessages.push(messages.map((message) => ({ ...message })));
        capturedSignals.push(options?.signal);
        if (capturedMessages.length === 1) {
          return new Promise<LlmRuntimeResult>((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => {
              firstCallAbort();
              const error = new Error('aborted by live steering');
              error.name = 'AbortError';
              reject(error);
            }, { once: true });
          });
        }
        return Promise.resolve(llmResult('Resposta revisada com steering em uma frase.'));
      }),
      getPreferredProviderName: jest.fn(() => 'openai'),
    };
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-30T12:00:00.000Z'),
      idFactory: createIdFactory(),
      llmRuntime,
      defaultProviderLabel: 'OpenAI',
      defaultModelLabel: 'gpt-4o',
      runtimeEventBus: {
        emit: async (type, payload) => {
          emitted.push({ type, payload });
        },
      },
    });

    const pending = gateway.handle({
      userId: 'operator',
      channel: 'web',
      sessionId: 'web:live-steering',
      text: 'responda oi pelo runtime real',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
      },
    });

    await waitUntil(() => capturedMessages.length === 1, 5000);
    const activeRun = gateway.buildSnapshot({ activeSessionId: 'web:live-steering' }).activeRun;
    expect(activeRun).toEqual(expect.objectContaining({
      sessionId: 'web:live-steering',
      status: 'running',
    }));

    const steered = gateway.steer({
      runId: activeRun?.id,
      sessionId: 'web:live-steering',
      text: 'Responda em uma unica frase e mencione que o steering chegou ao vivo.',
      source: 'zavorth-control-steer',
      queueItemId: 'queue-live-1',
    });

    expect(steered.ok).toBe(true);
    expect(steered.ack).toEqual(expect.objectContaining({
      runId: activeRun?.id,
      status: 'accepted',
    }));

    const result = await pending;

    expect(llmRuntime.chatDetailed).toHaveBeenCalledTimes(2);
    expect(capturedSignals[0]).toBeInstanceOf(AbortSignal);
    expect(firstCallAbort).toHaveBeenCalledTimes(1);
    expect(capturedMessages[1]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: 'assistant',
        content: expect.stringContaining('Previous model call was interrupted before returning'),
      }),
      expect.objectContaining({
        role: 'user',
        content: expect.stringContaining('Operator steering arrived while the previous model call was still in flight.'),
      }),
    ]));
    expect(capturedMessages[1].map((message) => message.content).join('\n')).toContain(
      'Responda em uma unica frase',
    );
    expect(result.replies[0].text).toBe('Resposta revisada com steering em uma frase.');
    expect(result.run.steering).toEqual([
      expect.objectContaining({
        queueItemId: 'queue-live-1',
        status: 'applied',
      }),
    ]);
    expect(result.run.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'steering',
        title: 'Live steering assimilated',
        metadata: expect.objectContaining({
          mode: 'same-run-llm-interrupt-reissue',
          interruptCount: 1,
          abortSignalUsed: true,
          nativeAgentRunSteering: true,
        }),
      }),
      expect.objectContaining({
        kind: 'steering',
        title: 'Steering applied',
      }),
    ]));
    expect(result.run.metadata.agentRunSteeringLive).toEqual(expect.objectContaining({
      source: 'AgentRunLlmRuntimeExecutor',
      mode: 'same-run-llm-interrupt-reissue',
      frameCount: 1,
      interruptCount: 1,
      abortSignalUsed: true,
    }));
    expect(emitted).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'agent.stream.lifecycle',
        payload: expect.objectContaining({
          // Product events use phase (legacy tests still said "gate").
          phase: 'executor-started',
          runId: result.run.id,
          sessionId: 'web:live-steering',
        }),
      }),
      expect.objectContaining({
        type: 'agent.stream.assistant',
        payload: expect.objectContaining({
          phase: 'delta',
          accumulated: 'Resposta revisada com steering em uma frase.',
          runId: result.run.id,
          sessionId: 'web:live-steering',
        }),
      }),
      expect.objectContaining({
        type: 'agent.stream.lifecycle',
        payload: expect.objectContaining({
          phase: 'llm-reissued-after-steering',
          runId: result.run.id,
          sessionId: 'web:live-steering',
        }),
      }),
    ]));
  });
});

function createIdFactory(): (prefix: string) => string {
  let next = 0;
  return (prefix: string) => `${prefix}-${++next}`;
}

async function waitUntil(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for condition.');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function llmResult(content: string): LlmRuntimeResult {
  return {
    providerName: 'openai',
    modelName: 'gpt-4o',
    response: {
      content,
      toolCalls: [],
      finishReason: 'stop',
    },
    route: {
      source: 'LlmRuntimeService',
      requestedProviderName: 'openai',
      primaryProviderName: 'openai',
      providerName: 'openai',
      modelName: 'gpt-4o',
      fallbackAllowed: true,
      fallbackUsed: false,
      providerChain: ['openai'],
      attempts: [],
      request: {
        messageCount: 2,
        toolCount: 0,
        inputChars: 128,
      },
    },
  };
}
