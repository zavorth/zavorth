import {
  ProviderLongTailCompatibleLiveClient,
  ProviderLongTailEmbeddingLiveClient,
} from '../../src/adapters/providers/ProviderLongTailLiveClients.js';
import { ProviderFactory } from '../../src/providers/ProviderFactory.js';

import { LiveReadinessService } from '../../src/services/LiveReadinessService.js';
import { ProviderLongTailActivationService } from '../../src/services/ProviderLongTailActivationService.js';
import { ProviderMeshReadinessService } from '../../src/services/ProviderMeshReadinessService.js';

const response = (payload: Record<string, unknown>, init: { status?: number } = {}) =>
  new Response(JSON.stringify(payload), {
    status: init.status || 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });

describe('ProviderLongTailActivationService Credential vault', () => {
  it('closes Credential vault long-tail activation gates without live IO', () => {
    const snapshot = new ProviderLongTailActivationService({
      now: () => new Date('2026-05-04T22:30:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.live-checkpoint-5');
    expect(snapshot.phase).toBe('Credential vault - Provider Runtime Activation Long Tail');
    expect(snapshot.status).toBe('closed');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        providers: 29,
        compatibleLive: 16,
        managedGatewayLive: 11,
        localLive: 1,
        embeddingLive: 1,
        blocked: 0,
        generatedProviderManifestsRemainingLongTail: false,
        generatedProviderManifestsRemainingTotal: false,
        configSchemas: 29,
        providerFactoryRoutes: 29,
        smokeCommands: 29,
        chatSmokeCommands: 28,
        embeddingSmokeCommands: 1,
        redactedReceipts: 29,
        liveIoRequiredByStage5Check: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        noLiveIoDuringStage5Check: true,
        namedManifestsRequiredForEveryLongTailProvider: true,
        providerFactoryRoutesMustResolveWithoutFallback: true,
        managedGatewaysRequireOperatorBaseUrl: true,
        noSecretsSerialized: true,
      }),
    );
    expect(snapshot.commands.nextStage).toBe('Intent model3 - Live Consistency Certification');
  });

  it('gives every long-tail provider config, doctor, smoke command and receipt', () => {
    const snapshot = new ProviderLongTailActivationService().buildSnapshot();
    const expected = [
      'alibaba',
      'amazon-bedrock',
      'amazon-bedrock-mantle',
      'anthropic-vertex',
      'arcee',
      'cerebras',
      'chutes',
      'cloudflare-ai-gateway',
      'copilot-proxy',
      'github-copilot',
      'gradium',
      'kilocode',
      'kimi-coding',
      'litellm',
      'microsoft',
      'microsoft-foundry',
      'moonshot',
      'nvidia',
      'opencode',
      'opencode-go',
      'qianfan',
      'sglang',
      'stepfun',
      'tencent',
      'tokenjuice',
      'venice',
      'voyage',
      'xiaomi',
      'zai',
    ];

    expect(snapshot.entries.map((entry) => entry.providerId).sort()).toEqual(expected);
    for (const entry of snapshot.entries) {
      expect(entry.configSchema.requiredEnv.length).toBeGreaterThan(0);
      expect(entry.doctorCommand).toContain('--profile configured');
      expect(entry.stagingLiveSmokeCommand).toContain('--confirm-live-io');
      expect(entry.gates.map((gate) => gate.kind)).toContain('named-manifest');
      expect(entry.gates.map((gate) => gate.kind)).toContain('provider-factory-route');
      expect(entry.gates.map((gate) => gate.kind)).toContain('staging-live-smoke');
      expect(entry.receipt).toEqual(
        expect.objectContaining({
          liveIoPerformed: false,
          stagingLiveRequiresExplicitCommand: true,
          secretValuesSerialized: false,
        }),
      );
    }
  });

  it('removes generated provider manifests from the provider mesh', () => {
    const providerMesh = new ProviderMeshReadinessService().buildSnapshot();

    expect(providerMesh.summary.generatedProviderManifests).toBe(0);
    expect(providerMesh.generatedProviderManifests).toHaveLength(0);
    expect(providerMesh.entries.filter((entry) => entry.generatedProviderManifest)).toHaveLength(0);
  });

  it('resolves long-tail providers without fallback masking', () => {
    const alibaba = ProviderFactory.resolveRuntimeTarget('alibaba');
    expect(alibaba).toEqual(
      expect.objectContaining({
        providerName: 'alibaba',
        adapterKind: 'openai_compatible',
        runtimeSupported: true,
      }),
    );
    expect(alibaba.baseUrl).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1');

    const bedrock = ProviderFactory.resolveRuntimeTarget('amazon-bedrock');
    expect(bedrock).toEqual(
      expect.objectContaining({
        providerName: 'bedrock-claude',
        adapterKind: 'bespoke',
        firstClassProvider: true,
        genericCompatible: false,
        runtimeSupported: true,
      }),
    );

    const sglang = ProviderFactory.resolveRuntimeTarget('sglang');
    expect(sglang).toEqual(
      expect.objectContaining({
        providerName: 'sglang',
        adapterKind: 'local_openai_compatible',
        runtimeSupported: true,
      }),
    );
    expect(sglang.baseUrl).toBe('http://localhost:30000/v1');
  });

  it('moves long-tail providers into partial-live readiness', () => {
    const readiness = new LiveReadinessService().buildSnapshot();
    const entries = new Map(readiness.entries.map((entry) => [entry.normalizedSourceName, entry]));
    const providerEntries = readiness.entries.filter((entry) => entry.primitiveId === 'provider.call');

    expect(entries.get('alibaba')?.status).toBe('partial-live');
    expect(entries.get('amazon-bedrock')?.status).toBe('partial-live');
    expect(entries.get('anthropic-vertex')?.status).toBe('partial-live');
    expect(entries.get('sglang')?.status).toBe('partial-live');
    expect(entries.get('voyage')?.status).toBe('partial-live');
    expect(entries.get('zai')?.status).toBe('partial-live');
    expect(providerEntries.filter((entry) => entry.status === 'template-only')).toHaveLength(0);
  });

  it('runs long-tail live clients with redacted receipts', async () => {
    const calls: Array<{ url: string; body: string; authorization?: string }> = [];
    const fetchImpl = (async (url, init) => {
      calls.push({
        url: String(url),
        body: String(init?.body || ''),
        authorization: String((init?.headers as Record<string, string>)?.Authorization || ''),
      });
      if (String(url).includes('/embeddings')) {
        return response({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
          usage: { prompt_tokens: 4, total_tokens: 4 },
        });
      }
      return response({
        choices: [{ message: { content: 'long tail ok' } }],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      });
    }) as typeof fetch;

    const chatReceipt = await new ProviderLongTailCompatibleLiveClient({
      providerId: 'alibaba',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'provider-secret',
      modelName: 'qwen-plus',
    }, { fetchImpl, now: () => new Date('2026-05-04T22:31:00.000Z') }).chatSmoke({
      messages: [{ role: 'user', content: 'ping' }],
    });
    expect(chatReceipt).toEqual(
      expect.objectContaining({
        providerId: 'alibaba',
        family: 'openai-compatible',
        status: 'passed',
        totalTokens: 3,
        liveIo: true,
        secretValuesSerialized: false,
      }),
    );
    expect(calls[0].authorization).toBe('Bearer provider-secret');

    const embeddingReceipt = await new ProviderLongTailEmbeddingLiveClient({
      providerId: 'voyage',
      baseUrl: 'https://api.voyageai.com/v1',
      apiKey: 'voyage-secret',
      modelName: 'voyage-3-large',
    }, { fetchImpl }).embeddingSmoke({
      input: 'hello embedding',
    });
    expect(embeddingReceipt).toEqual(
      expect.objectContaining({
        providerId: 'voyage',
        family: 'embedding-compatible',
        status: 'passed',
        embeddingCount: 1,
        dimensions: 3,
        totalTokens: 4,
        liveIo: true,
        secretValuesSerialized: false,
      }),
    );
    expect(calls[1].authorization).toBe('Bearer voyage-secret');
  });

  it('runs configured doctors and blocks staging-live when config is missing', async () => {
    const service = new ProviderLongTailActivationService({
      env: {},
      now: () => new Date('2026-05-04T22:32:00.000Z'),
    });

    const doctor = service.runConfiguredDoctor({ providerId: 'alibaba' });
    expect(doctor).toEqual(
      expect.objectContaining({
        providerId: 'alibaba',
        family: 'openai-compatible',
        status: 'missing-config',
        configured: false,
        baseUrlConfigured: true,
        apiKeyConfigured: false,
        liveIoPerformed: false,
        secretValuesSerialized: false,
      }),
    );
    expect(doctor.missingRequiredEnv).toContain('ALIBABA_API_KEY');

    const blocked = await service.runStagingLiveSmoke({
      providerId: 'alibaba',
      confirmLiveIo: false,
      prompt: 'should not call provider',
    });
    expect(blocked).toEqual(
      expect.objectContaining({
        providerId: 'alibaba',
        status: 'blocked',
        confirmed: false,
        smokeReceipt: null,
        liveIoPerformed: false,
      }),
    );
  });

  it('runs staging-live smoke through chat, managed gateway, local, and embedding families', async () => {
    const calls: Array<{ url: string; body: string; authorization?: string }> = [];
    const fetchImpl = (async (url, init) => {
      calls.push({
        url: String(url),
        body: String(init?.body || ''),
        authorization: String((init?.headers as Record<string, string>)?.Authorization || ''),
      });
      if (String(url).includes('/embeddings')) {
        return response({
          data: [{ embedding: [0.1, 0.2] }],
          usage: { prompt_tokens: 2, total_tokens: 2 },
        });
      }
      return response({
        choices: [{ message: { content: 'provider smoke ok' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    }) as typeof fetch;

    const service = new ProviderLongTailActivationService({
      fetchImpl,
      env: {
        ALIBABA_API_KEY: 'alibaba-secret',
        LITELLM_API_KEY: 'litellm-secret',
        LITELLM_BASE_URL: 'https://litellm.example.test/v1',
        SGLANG_BASE_URL: 'http://127.0.0.1:30000/v1',
        VOYAGE_API_KEY: 'voyage-secret',
        VOYAGE_BASE_URL: 'https://api.voyageai.com/v1',
      },
      now: () => new Date('2026-05-04T22:33:00.000Z'),
    });

    const compatible = await service.runStagingLiveSmoke({
      providerId: 'alibaba',
      confirmLiveIo: true,
      prompt: 'provider compatible smoke',
    });
    expect(compatible).toEqual(
      expect.objectContaining({
        status: 'passed',
        liveIoPerformed: true,
        secretValuesSerialized: false,
      }),
    );
    expect(compatible.smokeReceipt).toEqual(
      expect.objectContaining({
        providerId: 'alibaba',
        family: 'openai-compatible',
        status: 'passed',
        totalTokens: 2,
      }),
    );

    const managed = await service.runStagingLiveSmoke({
      providerId: 'litellm',
      confirmLiveIo: true,
    });
    expect(managed.status).toBe('passed');
    expect(managed.smokeReceipt).toEqual(
      expect.objectContaining({
        providerId: 'litellm',
        family: 'managed-gateway-compatible',
        status: 'passed',
      }),
    );

    const local = await service.runStagingLiveSmoke({
      providerId: 'sglang',
      confirmLiveIo: true,
    });
    expect(local.status).toBe('passed');
    expect(local.doctor.apiKeyConfigured).toBe(false);
    expect(local.smokeReceipt).toEqual(
      expect.objectContaining({
        providerId: 'sglang',
        family: 'local-openai-compatible',
        status: 'passed',
      }),
    );

    const embedding = await service.runStagingLiveSmoke({
      providerId: 'voyage',
      confirmLiveIo: true,
      embeddingInput: 'provider embedding smoke',
    });
    expect(embedding.status).toBe('passed');
    expect(embedding.smokeReceipt).toEqual(
      expect.objectContaining({
        providerId: 'voyage',
        family: 'embedding-compatible',
        status: 'passed',
        embeddingCount: 1,
        dimensions: 2,
      }),
    );

    expect(calls[0].authorization).toBe('Bearer alibaba-secret');
    expect(JSON.parse(calls[0].body)).toEqual(
      expect.objectContaining({
        model: 'qwen-plus',
      }),
    );
  });
});
