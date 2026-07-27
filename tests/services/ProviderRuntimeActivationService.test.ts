import {
  AnthropicCompatibleProviderLiveClient,
  GeminiRestProviderLiveClient,
  OpenAICompatibleProviderLiveClient,
} from '../../src/adapters/providers/ProviderP0LiveClients.js';
import { ProviderFactory } from '../../src/providers/ProviderFactory.js';

import { LiveReadinessService } from '../../src/services/LiveReadinessService.js';
import { ProviderRuntimeActivationService } from '../../src/services/ProviderRuntimeActivationService.js';
import { ZavorthProviderReadinessMatrixService } from '../../src/services/ZavorthProviderReadinessMatrixService.js';

const response = (payload: Record<string, unknown>, init: { status-: number } = {}) =>
  new Response(JSON.stringify(payload), {
    status: init.status || 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });

describe('ProviderRuntimeActivationService Connector registry', () => {
  it('closes Connector registry provider activation gates without live IO', () => {
    const snapshot = new ProviderRuntimeActivationService({
      now: () => new Date('2026-05-04T21:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.live-checkpoint-4');
    expect(snapshot.phase).toBe('Connector registry - Provider Runtime Activation P0');
    expect(snapshot.status).toBe('closed');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        providers: 24,
        firstClassLive: 6,
        compatibleLive: 15,
        localLive: 2,
        gatewayLive: 1,
        blocked: 0,
        generatedProviderManifestsRemainingP0: false,
        configSchemas: 24,
        providerFactoryRoutes: 24,
        chatSmokeCommands: 24,
        redactedReceipts: 24,
        liveIoRequiredByStage4Check: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        noLiveIoDuringStage4Check: true,
        providerFactoryRoutesMustResolveWithoutFallback: true,
        stagingLiveRequiresExplicitOperatorCommand: true,
        noSecretsSerialized: true,
      }),
    );
  });

  it('gives every P0 provider config, doctor, smoke command and receipt', () => {
    const snapshot = new ProviderRuntimeActivationService().buildSnapshot();
    const expected = [
      'anthropic',
      'cerebras',
      'cohere',
      'deepinfra',
      'deepseek',
      'falcon',
      'fireworks',
      'github-models',
      'google',
      'groq',
      'huggingface',
      'jais',
      'lmstudio',
      'mistral',
      'ollama',
      'openai',
      'openrouter',
      'perplexity',
      'qwen',
      'sambanova',
      'together',
      'vercel-ai-gateway',
      'vllm',
      'xai',
    ];

    expect(snapshot.entries.map((entry) => entry.providerId).sort()).toEqual(expected);
    for (const entry of snapshot.entries) {
      expect(entry.configSchema.requiredEnv.length).toBeGreaterThan(0);
      expect(entry.doctorCommand).toContain('--profile configured');
      expect(entry.stagingLiveSmokeCommand).toContain('--confirm-live-io');
      expect(entry.gates.map((gate) => gate.kind)).toEqual([
        'config-schema',
        'provider-factory-route',
        'runtime-adapter',
        'model-fallback',
        'chat-smoke',
        'error-normalization',
        'usage-receipt',
        'redacted-receipt',
        'staging-live-smoke',
      ]);
      expect(entry.receipt).toEqual(
        expect.objectContaining({
          liveIoPerformed: false,
          stagingLiveRequiresExplicitCommand: true,
          secretValuesSerialized: false,
        }),
      );
    }
  });

  it('resolves P0 providers without fallback masking', () => {
    const mistral = ProviderFactory.resolveRuntimeTarget('mistral');
    expect(mistral).toEqual(
      expect.objectContaining({
        providerName: 'mistral',
        adapterKind: 'openai_compatible',
        runtimeSupported: true,
      }),
    );
    expect(mistral.baseUrl).toBe('https://api.mistral.ai/v1');

    const cohere = ProviderFactory.resolveRuntimeTarget('cohere');
    expect(cohere).toEqual(
      expect.objectContaining({
        providerName: 'cohere',
        adapterKind: 'openai_compatible',
        runtimeSupported: true,
      }),
    );
    expect(cohere.baseUrl).toBe('https://api.cohere.ai/compatibility/v1');

    const sambanova = ProviderFactory.resolveRuntimeTarget('sambanova');
    expect(sambanova).toEqual(
      expect.objectContaining({
        providerName: 'sambanova',
        adapterKind: 'openai_compatible',
        runtimeSupported: true,
      }),
    );
    expect(sambanova.baseUrl).toBe('https://api.sambanova.ai/v1');

    const cerebras = ProviderFactory.resolveRuntimeTarget('cerebras');
    expect(cerebras.baseUrl).toBe('https://api.cerebras.ai/v1');

    const githubModels = ProviderFactory.resolveRuntimeTarget('github-models');
    expect(githubModels).toEqual(
      expect.objectContaining({
        providerName: 'github-models',
        adapterKind: 'openai_compatible',
        runtimeSupported: true,
      }),
    );
    expect(githubModels.baseUrl).toBe('https://models.github.ai/inference');

    const falcon = ProviderFactory.resolveRuntimeTarget('falcon');
    expect(falcon.baseUrl).toBe('https://router.huggingface.co/v1');

    const jais = ProviderFactory.resolveRuntimeTarget('jais');
    expect(jais.baseUrl).toBe('https://router.huggingface.co/v1');

    const google = ProviderFactory.resolveRuntimeTarget('google');
    expect(google).toEqual(
      expect.objectContaining({
        providerName: 'gemini',
        adapterKind: 'bespoke',
        runtimeSupported: true,
      }),
    );

    const anthropic = ProviderFactory.resolveRuntimeTarget('anthropic');
    expect(anthropic).toEqual(
      expect.objectContaining({
        providerName: 'anthropic-direct',
        adapterKind: 'bespoke',
        runtimeSupported: true,
      }),
    );

    const vercel = ProviderFactory.resolveRuntimeTarget('vercel-ai-gateway');
    expect(vercel).toEqual(
      expect.objectContaining({
        providerName: 'vercel-ai-gateway',
        adapterKind: 'openai_compatible',
        runtimeSupported: true,
      }),
    );
    expect(vercel.baseUrl).toBe('https://zavorth-control.vercel.sh/v1');
  });

  it('treats curated compatible provider defaults as native routes, not missing base URLs', () => {
    const originalEnv = {
      COHERE_API_KEY: process.env.COHERE_API_KEY,
      SAMBANOVA_API_KEY: process.env.SAMBANOVA_API_KEY,
      CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY,
      GITHUB_MODELS_TOKEN: process.env.GITHUB_MODELS_TOKEN,
      FALCON_API_KEY: process.env.FALCON_API_KEY,
      JAIS_API_KEY: process.env.JAIS_API_KEY,
    };
    process.env.COHERE_API_KEY = 'test-cohere';
    process.env.SAMBANOVA_API_KEY = 'test-sambanova';
    process.env.CEREBRAS_API_KEY = 'test-cerebras';
    process.env.GITHUB_MODELS_TOKEN = 'test-github-models';
    process.env.FALCON_API_KEY = 'test-falcon';
    process.env.JAIS_API_KEY = 'test-jais';

    try {
      const service = new ZavorthProviderReadinessMatrixService({
        now: () => new Date('2026-05-04T21:00:00.000Z'),
      });
      for (const provider of ['cohere', 'sambanova', 'cerebras', 'github-models', 'falcon', 'jais']) {
        const snapshot = service.buildSnapshot({ providerId: provider, probe: true });
        const entry = snapshot.entries[0];
        expect(entry).toEqual(
          expect.objectContaining({
            id: provider,
            status: 'ready',
            baseUrlConfigured: true,
            authConfigured: true,
          }),
        );
      }
    } finally {
      for (const [key, value] of Object.entries(originalEnv)) {
        if (typeof value === 'string') {
          process.env[key] = value;
        } else {
          delete process.env[key];
        }
      }
    }
  });

  it('moves P0 providers into partial-live readiness', () => {
    const readiness = new LiveReadinessService().buildSnapshot();
    const entries = new Map(readiness.entries.map((entry) => [entry.normalizedSourceName, entry]));

    expect(entries.get('anthropic')?.status).toBe('partial-live');
    expect(entries.get('mistral')?.status).toBe('partial-live');
    expect(entries.get('groq')?.status).toBe('partial-live');
    expect(entries.get('lmstudio')?.status).toBe('partial-live');
    expect(entries.get('vercel-ai-gateway')?.status).toBe('partial-live');
    expect(entries.get('amazon-bedrock')?.status).toBe('partial-live');
  });

  it('runs P0 live clients with redacted receipts', async () => {
    const calls: Array<{ url: string; body: string; authorization-: string; apiKey-: string }> = [];
    const fetchImpl = (async (url, init) => {
      calls.push({
        url: String(url),
        body: String(init?.body || ''),
        authorization: String((init?.headers as Record<string, string>)?.Authorization || ''),
        apiKey: String((init?.headers as Record<string, string>)?.['x-api-key'] || ''),
      });
      if (String(url).includes('/messages')) {
        return response({
          content: [{ text: 'anthropic ok' }],
          usage: { input_tokens: 2, output_tokens: 3 },
        });
      }
      if (String(url).includes(':generateContent')) {
        return response({
          candidates: [{ content: { parts: [{ text: 'gemini ok' }] } }],
          usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 5, totalTokenCount: 9 },
        });
      }
      return response({
        choices: [{ message: { content: 'openai compatible ok' } }],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      });
    }) as typeof fetch;

    const openaiReceipt = await new OpenAICompatibleProviderLiveClient({
      providerId: 'mistral',
      baseUrl: 'https://api.mistral.ai/v1',
      apiKey: 'provider-secret',
      modelName: 'mistral-large-latest',
    }, { fetchImpl, now: () => new Date('2026-05-04T21:01:00.000Z') }).chatSmoke({
      messages: [{ role: 'user', content: 'ping' }],
    });
    expect(openaiReceipt).toEqual(
      expect.objectContaining({
        providerId: 'mistral',
        family: 'openai-compatible',
        status: 'passed',
        totalTokens: 3,
        liveIo: true,
        secretValuesSerialized: false,
      }),
    );
    expect(calls[0].authorization).toBe('Bearer provider-secret');

    const anthropicReceipt = await new AnthropicCompatibleProviderLiveClient({
      providerId: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
      apiKey: 'anthropic-secret',
      modelName: 'claude-3-5-sonnet-latest',
    }, { fetchImpl }).chatSmoke({
      messages: [{ role: 'user', content: 'ping' }],
    });
    expect(anthropicReceipt.family).toBe('anthropic-compatible');
    expect(anthropicReceipt.totalTokens).toBe(5);
    expect(calls[1].apiKey).toBe('anthropic-secret');

    const geminiReceipt = await new GeminiRestProviderLiveClient({
      providerId: 'google',
      apiKey: 'gemini-secret',
      modelName: 'gemini-2.5-flash',
    }, { fetchImpl }).chatSmoke({
      messages: [{ role: 'user', content: 'ping' }],
    });
    expect(geminiReceipt.family).toBe('gemini-rest');
    expect(geminiReceipt.totalTokens).toBe(9);
    expect(geminiReceipt.secretValuesSerialized).toBe(false);
  });
});
