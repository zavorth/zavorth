import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProviderFactory } from '../../../src/providers/ProviderFactory.js';
import type { ChatMessage, LlmResponse } from '../../../src/providers/ILlmProvider.js';
import { config } from '../../../src/config/index.js';
import { LlmRuntimeService } from '../../../src/services/llm/LlmRuntimeService.js';
import { defaultLlmRuntimeTelemetryService } from '../../../src/services/llm/LlmRuntimeTelemetryService.js';

describe('LlmRuntimeService', () => {
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: 'ola',
    },
  ];

  const baseResponse: LlmResponse = {
    content: 'ok',
    toolCalls: [],
    finishReason: 'stop',
  };
  const originalOpenRouterModel = config.openRouterModel;
  const originalOpenAiModel = config.openaiModel;
  const originalAIGatewayBaseUrl = config.AIGatewayBaseUrl;
  const originalZavorthAIGatewayGatewayBaseUrl = config.zavorthAIGatewayGatewayBaseUrl;
  const originalAIGatewayGatewayStatusFile = config.AIGatewayGatewayStatusFile;
  let tempDir = '';

  beforeEach(() => {
    (config as any).openRouterModel = 'openrouter-default-model';
    (config as any).openaiModel = 'openai-default-model';
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-llm-runtime-'));
    (config as any).AIGatewayBaseUrl = 'http://127.0.0.1:21128/v1';
    (config as any).zavorthAIGatewayGatewayBaseUrl = 'http://127.0.0.1:21128/v1';
    (config as any).AIGatewayGatewayStatusFile = path.join(tempDir, 'ai-gateway-last.json');
    defaultLlmRuntimeTelemetryService.clear();
  });

  afterEach(() => {
    (config as any).openRouterModel = originalOpenRouterModel;
    (config as any).openaiModel = originalOpenAiModel;
    (config as any).AIGatewayBaseUrl = originalAIGatewayBaseUrl;
    (config as any).zavorthAIGatewayGatewayBaseUrl = originalZavorthAIGatewayGatewayBaseUrl;
    (config as any).AIGatewayGatewayStatusFile = originalAIGatewayGatewayStatusFile;
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    defaultLlmRuntimeTelemetryService.clear();
    jest.restoreAllMocks();
  });

  it('passes model overrides to the selected provider', async () => {
    const provider = {
      chat: jest.fn().mockResolvedValue(baseResponse),
    };
    jest.spyOn(ProviderFactory, 'create').mockReturnValue(provider as any);

    const runtime = new LlmRuntimeService('openrouter');
    jest.spyOn(runtime, 'isProviderAvailable').mockReturnValue(true);
    const result = await runtime.chatDetailed(messages, undefined, {
      providerName: 'openrouter',
      modelName: 'anthropic/claude-sonnet-4',
    });

    expect(result.providerName).toBe('openrouter');
    expect(result.modelName).toBe('anthropic/claude-sonnet-4');
    expect(result.route).toEqual(expect.objectContaining({
      source: 'LlmRuntimeService',
      requestedProviderName: 'openrouter',
      primaryProviderName: 'openrouter',
      providerName: 'openrouter',
      modelName: 'anthropic/claude-sonnet-4',
      fallbackAllowed: false,
      fallbackUsed: false,
      request: expect.objectContaining({
        messageCount: 1,
        inputChars: 3,
      }),
    }));
    expect(result.route.attempts).toEqual([
      expect.objectContaining({
        providerName: 'openrouter',
        status: 'succeeded',
        fallback: false,
        durationMs: expect.any(Number),
      }),
    ]);
    expect(provider.chat).toHaveBeenCalledWith(messages, undefined, {
      modelName: 'anthropic/claude-sonnet-4',
    });
  });

  it('redacts raw secrets before sending messages to providers', async () => {
    const provider = {
      chat: jest.fn().mockResolvedValue(baseResponse),
    };
    jest.spyOn(ProviderFactory, 'create').mockReturnValue(provider as any);

    const runtime = new LlmRuntimeService('openrouter');
    jest.spyOn(runtime, 'isProviderAvailable').mockReturnValue(true);

    const result = await runtime.chatDetailed([
      {
        role: 'user',
        content: 'Debug this token: OPENAI_API_KEY=sk-test12345678901234567890',
      },
    ], undefined, {
      providerName: 'openrouter',
    });

    expect(provider.chat).toHaveBeenCalledWith(
      [expect.objectContaining({
        content: expect.stringContaining('[redacted-secret]'),
      })],
      undefined,
      {
        modelName: 'openrouter-default-model',
      },
    );
    expect(JSON.stringify(provider.chat.mock.calls[0][0])).not.toContain('sk-test12345678901234567890');
    expect(result.metadata).toEqual(expect.objectContaining({
      llmEgressGuard: expect.objectContaining({
        redacted: true,
        findingCount: expect.any(Number),
      }),
    }));
    expect(JSON.stringify(result.route)).not.toContain('sk-test12345678901234567890');
  });

  it('resets to the fallback provider default model when changing providers', async () => {
    const primaryProvider = {
      chat: jest.fn().mockRejectedValue(new Error('primary failed')),
    };
    const fallbackProvider = {
      chat: jest.fn().mockResolvedValue(baseResponse),
    };

    jest.spyOn(ProviderFactory, 'create').mockImplementation((name: string) => {
      if (name === 'openrouter') {
        return primaryProvider as any;
      }

      if (name === 'openai') {
        return fallbackProvider as any;
      }

      throw new Error(`unexpected provider ${name}`);
    });

    const runtime = new LlmRuntimeService('openrouter');
    jest
      .spyOn(runtime, 'isProviderAvailable')
      .mockImplementation((name: string) => ['openrouter', 'openai'].includes(name));

    const result = await runtime.chatDetailed(messages, undefined, {
      providerName: 'openrouter',
      modelName: 'shared-model',
      allowFallback: true,
      fallbackOrder: ['openai'],
    });

    expect(result.providerName).toBe('openai');
    expect(result.modelName).toBe('openai-default-model');
    expect(result.route.fallbackUsed).toBe(true);
    expect(result.route.providerChain).toEqual(expect.arrayContaining(['openrouter', 'openai']));
    expect(result.route.attempts).toEqual([
      expect.objectContaining({
        providerName: 'openrouter',
        modelName: 'shared-model',
        status: 'failed',
        fallback: false,
        durationMs: expect.any(Number),
        error: 'primary failed',
      }),
      expect.objectContaining({
        providerName: 'openai',
        modelName: 'openai-default-model',
        status: 'succeeded',
        fallback: true,
        durationMs: expect.any(Number),
      }),
    ]);
    expect(primaryProvider.chat).toHaveBeenCalledWith(messages, undefined, {
      modelName: 'shared-model',
    });
    expect(fallbackProvider.chat).toHaveBeenCalledWith(messages, undefined, {
      modelName: 'openai-default-model',
    });
  });

  it('records sanitized fallback latency telemetry without prompt content', async () => {
    const primaryProvider = {
      chat: jest.fn().mockRejectedValue(new Error('primary failed with token sk-test-not-a-real-secret')),
    };
    const fallbackProvider = {
      chat: jest.fn().mockResolvedValue(baseResponse),
    };

    jest.spyOn(ProviderFactory, 'create').mockImplementation((name: string) => {
      if (name === 'openrouter') {
        return primaryProvider as any;
      }

      if (name === 'openai') {
        return fallbackProvider as any;
      }

      throw new Error(`unexpected provider ${name}`);
    });

    const runtime = new LlmRuntimeService('openrouter');
    jest
      .spyOn(runtime, 'isProviderAvailable')
      .mockImplementation((name: string) => ['openrouter', 'openai'].includes(name));

    await runtime.chatDetailed(messages, undefined, {
      providerName: 'openrouter',
      modelName: 'shared-model',
      allowFallback: true,
      fallbackOrder: ['openai'],
      telemetry: {
        surface: 'echo',
        runId: 'run-telemetry',
        traceId: 'trace-telemetry',
        sessionId: 'session-telemetry',
      },
    });

    const snapshot = defaultLlmRuntimeTelemetryService.buildSnapshot();
    expect(snapshot.summary).toEqual(expect.objectContaining({
      totalAttempts: 2,
      failed: 1,
      succeeded: 1,
      fallbackAttempts: 1,
      providerCount: 2,
      surfaceCount: 1,
    }));
    expect(snapshot.providers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        providerName: 'openrouter',
        failed: 1,
      }),
      expect.objectContaining({
        providerName: 'openai',
        succeeded: 1,
        fallbackAttempts: 1,
      }),
    ]));
    expect(snapshot.surfaces).toEqual([
      expect.objectContaining({
        surface: 'echo',
        attempts: 2,
      }),
    ]);
    expect(snapshot.recentAttempts[0]).toEqual(expect.objectContaining({
      providerName: 'openai',
      surface: 'echo',
      runId: 'run-telemetry',
      traceId: 'trace-telemetry',
      sessionId: 'session-telemetry',
      durationMs: expect.any(Number),
    }));
    expect(JSON.stringify(snapshot)).not.toContain('ola');
    expect(JSON.stringify(snapshot)).not.toContain('sk-test-not-a-real-secret');
  });

  it('records unavailable providers in route telemetry before using fallback', async () => {
    const fallbackProvider = {
      chat: jest.fn().mockResolvedValue(baseResponse),
    };
    jest.spyOn(ProviderFactory, 'create').mockImplementation((name: string) => {
      if (name === 'openai') {
        return fallbackProvider as any;
      }
      throw new Error(`unexpected provider ${name}`);
    });

    const runtime = new LlmRuntimeService('openrouter');
    jest
      .spyOn(runtime, 'isProviderAvailable')
      .mockImplementation((name: string) => name === 'openai');

    const result = await runtime.chatDetailed(messages, undefined, {
      providerName: 'openrouter',
      modelName: 'shared-model',
      allowFallback: true,
      fallbackOrder: ['openai'],
    });

    expect(result.providerName).toBe('openai');
    expect(result.route).toEqual(expect.objectContaining({
      primaryProviderName: 'openrouter',
      providerName: 'openai',
      fallbackAllowed: true,
      fallbackUsed: true,
    }));
    expect(result.route.attempts).toEqual([
      expect.objectContaining({
        providerName: 'openrouter',
        modelName: 'shared-model',
        status: 'skipped_unavailable',
        fallback: false,
        durationMs: expect.any(Number),
      }),
      expect.objectContaining({
        providerName: 'openai',
        modelName: 'openai-default-model',
        status: 'succeeded',
        fallback: true,
        durationMs: expect.any(Number),
      }),
    ]);
    expect(fallbackProvider.chat).toHaveBeenCalledWith(messages, undefined, {
      modelName: 'openai-default-model',
    });
  });

  it('treats the local aigateway as unavailable when the health snapshot is missing or stale', () => {
    const runtime = new LlmRuntimeService('aigateway');

    expect(runtime.isProviderAvailable('aigateway')).toBe(false);

    fs.writeFileSync(
      config.AIGatewayGatewayStatusFile,
      JSON.stringify({
        ready: true,
        running: true,
        checkedAt: new Date(Date.now() - (11 * 60 * 1000)).toISOString(),
      }),
      'utf8',
    );

    expect(runtime.isProviderAvailable('aigateway')).toBe(false);
  });

  it('treats the local aigateway as available only with a fresh healthy snapshot', () => {
    fs.writeFileSync(
      config.AIGatewayGatewayStatusFile,
      JSON.stringify({
        ready: true,
        running: true,
        checkedAt: new Date().toISOString(),
      }),
      'utf8',
    );

    const runtime = new LlmRuntimeService('aigateway');
    expect(runtime.isProviderAvailable('aigateway')).toBe(true);
  });
});
