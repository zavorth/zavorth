import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AnthropicDirectProviderAdapter } from '../../src/adapters/providers/AnthropicDirectProviderAdapter.js';
import { BedrockClaudeProviderAdapter } from '../../src/adapters/providers/BedrockClaudeProviderAdapter.js';
import { GoogleGenAiProviderAdapter } from '../../src/adapters/providers/GoogleGenAiProviderAdapter.js';
import { SourceProviderCredentialRouteService } from '../../src/services/SourceProviderCredentialRouteService.js';
import { SourceProviderMeshExpansionService } from '../../src/services/SourceProviderMeshExpansionService.js';
import { ProviderFactory } from '../../src/providers/ProviderFactory.js';

describe('SourceProviderMeshExpansionService Phase 3', () => {
  const now = () => new Date('2026-05-05T15:00:00.000Z');
  let tempRoot: string;
  let sourceRoot: string;
  let zavorthRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-source-provider-mesh-'));
    sourceRoot = path.join(tempRoot, 'source');
    zavorthRoot = path.join(tempRoot, 'zavorth');
    createFixtureSource(sourceRoot);
    createFixtureZavorth(zavorthRoot);
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    ProviderFactory.clearCache();
  });

  it('builds redacted credential routes without serializing secret values', () => {
    const route = new SourceProviderCredentialRouteService().buildRoute({
      providerId: 'anthropic-direct',
      routeKind: 'api-key',
      requiredEnv: ['ANTHROPIC_API_KEY'],
      optionalEnv: ['ANTHROPIC_MODEL'],
      env: {
        ANTHROPIC_API_KEY: 'secret-value',
        ANTHROPIC_MODEL: 'claude-test',
      },
    });

    expect(route.status).toBe('configured');
    expect(route.presentEnv).toEqual(['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL']);
    expect(route.missingEnv).toEqual([]);
    expect(route.secretEnv).toEqual(['ANTHROPIC_API_KEY']);
    expect(route.secretValuesSerialized).toBe(false);
    expect(JSON.stringify(route)).not.toContain('secret-value');
  });

  it('runs direct provider adapters with injected clients and no live IO', async () => {
    const anthropic = new AnthropicDirectProviderAdapter({
      client: {
        messages: {
          create: async () => ({
            content: [{ type: 'text', text: 'ok' }],
            stop_reason: 'end_turn',
          }),
        },
      },
    });
    const bedrock = new BedrockClaudeProviderAdapter({
      client: {
        send: async () => ({
          output: {
            message: {
              content: [{ text: 'ok' }],
            },
          },
          stopReason: 'end_turn',
        }),
      },
    });
    const google = new GoogleGenAiProviderAdapter({
      client: {
        models: {
          generateContent: async () => ({
            candidates: [{
              content: {
                parts: [{ text: 'ok' }],
              },
              finishReason: 'STOP',
            }],
          }),
        },
      },
    });

    await expect(anthropic.chat([{ role: 'user', content: 'hi' }])).resolves.toEqual(
      expect.objectContaining({ content: 'ok', finishReason: 'end_turn' }),
    );
    await expect(bedrock.chat([{ role: 'user', content: 'hi' }])).resolves.toEqual(
      expect.objectContaining({ content: 'ok', finishReason: 'end_turn' }),
    );
    await expect(google.chat([{ role: 'user', content: 'hi' }])).resolves.toEqual(
      expect.objectContaining({ content: 'ok', finishReason: 'STOP' }),
    );
  });

  it('exposes explicit ProviderFactory runtime targets for Phase 3 routes', () => {
    expect(ProviderFactory.resolveRuntimeTarget('anthropic-direct')).toEqual(
      expect.objectContaining({
        providerName: 'anthropic-direct',
        adapterKind: 'bespoke',
        runtimeSupported: true,
      }),
    );
    expect(ProviderFactory.resolveRuntimeTarget('anthropic-vertex')).toEqual(
      expect.objectContaining({
        providerName: 'anthropic-vertex',
        adapterKind: 'bespoke',
        runtimeSupported: true,
      }),
    );
    expect(ProviderFactory.resolveRuntimeTarget('bedrock-claude')).toEqual(
      expect.objectContaining({
        providerName: 'bedrock-claude',
        adapterKind: 'bespoke',
        runtimeSupported: true,
      }),
    );
    expect(ProviderFactory.resolveRuntimeTarget('google-genai')).toEqual(
      expect.objectContaining({
        providerName: 'google-genai',
        adapterKind: 'bespoke',
        runtimeSupported: true,
      }),
    );
    expect(ProviderFactory.resolveRuntimeTarget('lmstudio')).toEqual(
      expect.objectContaining({
        providerName: 'lmstudio',
        adapterKind: 'local_openai_compatible',
        runtimeSupported: true,
      }),
    );
    expect(ProviderFactory.resolveRuntimeTarget('vllm')).toEqual(
      expect.objectContaining({
        providerName: 'vllm',
        adapterKind: 'local_openai_compatible',
        runtimeSupported: true,
      }),
    );
  });

  it('emits a passing Phase 3 Provider Mesh expansion snapshot', () => {
    const service = new SourceProviderMeshExpansionService({
      now,
      sourceRoot,
      zavorthRoot,
    });
    const snapshot = service.buildSnapshot();
    const text = service.formatSnapshotText(snapshot);

    expect(snapshot.status).toBe('passed');
    expect(snapshot.phase).toBe(3);
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        packagesTracked: 7,
        packagesPresentInSource: 7,
        packagesImplementedInZavorth: 7,
        adaptersReady: 4,
        adaptersOwnerGated: 2,
        providerFactoryRoutes: 5,
        liveIoPerformed: false,
        enabledByDefault: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.adapters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerId: 'anthropic-direct',
          status: 'ready',
          decision: 'implemented',
        }),
        expect.objectContaining({
          providerId: 'anthropic-vertex',
          status: 'owner_decision_required',
          decision: 'implemented-owner-gated',
        }),
        expect.objectContaining({
          providerId: 'bedrock-claude',
          status: 'owner_decision_required',
          decision: 'implemented-owner-gated',
        }),
        expect.objectContaining({
          providerId: 'google-genai',
          status: 'ready',
          decision: 'implemented',
        }),
      ]),
    );
    expect(snapshot.localModelPolicy).toEqual(
      expect.objectContaining({
        noAnthropicApiImpersonationForLocalModels: true,
        openAiCompatibleRoutes: ['ollama', 'lmstudio', 'vllm', 'custom-openai-compatible'],
      }),
    );
    expect(snapshot.policy.noAnthropicApiImpersonation).toBe(true);
    expect(snapshot.commands.nextPhase).toBe('Phase 4 - Channel Mesh Expansion Pack');
    expect(text).toContain('Zavorth Source Provider Mesh Expansion - Phase 3');
    expect(text).toContain('Next: Phase 4 - Channel Mesh Expansion Pack');
  });
});

function createFixtureSource(root: string): void {
  fs.mkdirSync(path.join(root, 'extensions', 'providers'), { recursive: true });
  writeJson(path.join(root, 'package.json'), {
    name: 'source-fixture',
    dependencies: {
      '@anthropic-ai/sdk': '^0.81.0',
      '@anthropic-ai/vertex-sdk': '^0.16.0',
      '@aws-sdk/client-bedrock-runtime': '^3.900.0',
      '@google/genai': '^1.30.0',
      'proxy-agent': '^6.5.0',
      'https-proxy-agent': '^7.0.6',
      undici: '^7.16.0',
    },
  });
  fs.writeFileSync(path.join(root, 'extensions', 'providers', 'providers.ts'), [
    "import Anthropic from '@anthropic-ai/sdk';",
    "import AnthropicVertex from '@anthropic-ai/vertex-sdk';",
    "import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';",
    "import { GoogleGenAI } from '@google/genai';",
    "import { ProxyAgent } from 'proxy-agent';",
    "import { HttpsProxyAgent } from 'https-proxy-agent';",
    "import { fetch } from 'undici';",
    'export const providers = { Anthropic, AnthropicVertex, BedrockRuntimeClient, GoogleGenAI, ProxyAgent, HttpsProxyAgent, fetch };',
  ].join('\n'));
}

function createFixtureZavorth(root: string): void {
  fs.mkdirSync(path.join(root, 'src', 'adapters', 'providers'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'services'), { recursive: true });
  writeJson(path.join(root, 'package.json'), {
    name: 'zavorth-fixture',
    dependencies: {
      '@anthropic-ai/sdk': '^0.81.0',
      '@anthropic-ai/vertex-sdk': '^0.16.0',
      '@aws-sdk/client-bedrock-runtime': '^3.900.0',
      '@google/genai': '^1.30.0',
      'proxy-agent': '^6.5.0',
      'https-proxy-agent': '^7.0.6',
      undici: '^7.16.0',
    },
  });
  for (const file of [
    'AnthropicDirectProviderAdapter.ts',
    'AnthropicVertexProviderAdapter.ts',
    'BedrockClaudeProviderAdapter.ts',
    'GoogleGenAiProviderAdapter.ts',
  ]) {
    fs.writeFileSync(path.join(root, 'src', 'adapters', 'providers', file), 'export {};');
  }
  fs.writeFileSync(path.join(root, 'src', 'services', 'SourceProviderMeshExpansionService.ts'), 'export {};');
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}
