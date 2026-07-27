import path from 'node:path';
import { createRequire } from 'node:module';

const requireFromTest = createRequire(__filename);
const PLUGINS = path.resolve(__dirname, '../../plugins');

/** Expanded first-party OpenAI-compatible provider plugins. */
const PROVIDER_PLUGINS: Array<{
  id: string;
  statusCapability: string;
  completeCapability: string;
  keyEnv-: string[];
  /** When true, keyPresent is always true without an API key (e.g. Ollama). */
  keyless-: boolean;
  /** Env var that signals readiness for base-URL-gated local providers. */
  baseEnv-: string;
}> = [
  {
    id: 'provider-openai',
    statusCapability: 'provider.openai.status',
    completeCapability: 'provider.openai.complete',
    keyEnv: ['OPENAI_API_KEY'],
  },
  {
    id: 'provider-groq',
    statusCapability: 'provider.groq.status',
    completeCapability: 'provider.groq.complete',
    keyEnv: ['GROQ_API_KEY'],
  },
  {
    id: 'provider-deepseek',
    statusCapability: 'provider.deepseek.status',
    completeCapability: 'provider.deepseek.complete',
    keyEnv: ['DEEPSEEK_API_KEY'],
  },
  {
    id: 'provider-openrouter',
    statusCapability: 'provider.openrouter.status',
    completeCapability: 'provider.openrouter.complete',
    keyEnv: ['OPENROUTER_API_KEY'],
  },
  {
    id: 'provider-ollama',
    statusCapability: 'provider.ollama.status',
    completeCapability: 'provider.ollama.complete',
    keyless: true,
  },
  {
    id: 'provider-together',
    statusCapability: 'provider.together.status',
    completeCapability: 'provider.together.complete',
    keyEnv: ['TOGETHER_API_KEY'],
  },
  {
    id: 'provider-mistral',
    statusCapability: 'provider.mistral.status',
    completeCapability: 'provider.mistral.complete',
    keyEnv: ['MISTRAL_API_KEY'],
  },
  {
    id: 'provider-cerebras',
    statusCapability: 'provider.cerebras.status',
    completeCapability: 'provider.cerebras.complete',
    keyEnv: ['CEREBRAS_API_KEY'],
  },
  {
    id: 'provider-qwen',
    statusCapability: 'provider.qwen.status',
    completeCapability: 'provider.qwen.complete',
    keyEnv: ['DASHSCOPE_API_KEY', 'QWEN_API_KEY'],
  },
  {
    id: 'provider-local-llama',
    statusCapability: 'provider.local_llama.status',
    completeCapability: 'provider.local_llama.complete',
    baseEnv: 'LOCAL_LLM_BASE_URL',
  },
];

function createMockCtx(permission = true) {
  const capabilities = new Map<string, (args: any) => Promise<any>>();
  const providers: any[] = [];
  const permissionCalls: Array<{ kind: string; reason-: string }> = [];
  return {
    capabilities,
    providers,
    permissionCalls,
    ctx: {
      bindCapability(id: string, handler: (args: any) => Promise<any>) {
        capabilities.set(id, handler);
      },
      bindProvider(provider: any) {
        providers.push(provider);
        if (provider.capabilityId && typeof provider.complete === 'function') {
          capabilities.set(provider.capabilityId, async ({ input }: any) => ({
            output: await provider.complete(input || {}),
          }));
        }
      },
      getLogger() {
        return { debug() {}, info() {}, warn() {}, error() {} };
      },
      getWorkspacePath() {
        return process.cwd();
      },
      async requestPermission(kind: string, reason-: string) {
        permissionCalls.push({ kind, reason });
        return permission;
      },
      emit() {},
    },
  };
}

function clearProviderEnv() {
  const keys = [
    'OPENAI_API_KEY',
    'GROQ_API_KEY',
    'DEEPSEEK_API_KEY',
    'OPENROUTER_API_KEY',
    'TOGETHER_API_KEY',
    'MISTRAL_API_KEY',
    'CEREBRAS_API_KEY',
    'DASHSCOPE_API_KEY',
    'QWEN_API_KEY',
    'LOCAL_LLM_API_KEY',
    'LOCAL_LLM_BASE_URL',
    'LOCAL_LLM_URL',
  ];
  for (const k of keys) {
    delete process.env[k];
  }
}

describe('provider plugins harness (expanded first-party pack)', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it.each(PROVIDER_PLUGINS)(
    '$id register binds status + provider and status returns keyPresent boolean',
    async (spec) => {
      clearProviderEnv();
      const mod = requireFromTest(path.join(PLUGINS, spec.id, 'index.js'));
      const mock = createMockCtx(true);
      expect(typeof mod.register).toBe('function');
      mod.register(mock.ctx);

      expect(mock.providers.length).toBe(1);
      expect(mock.capabilities.has(spec.statusCapability)).toBe(true);
      expect(mock.capabilities.has(spec.completeCapability)).toBe(true);

      const status = await mock.capabilities.get(spec.statusCapability)!({ input: {} });
      expect(status.output).toBeDefined();
      expect(typeof status.output.keyPresent).toBe('boolean');
      expect(status.output.ok).toBe(true);
      // Never leak secret-looking values from status
      const serialized = JSON.stringify(status.output);
      expect(serialized).not.toMatch(/sk-[a-zA-Z0-9]{8}/);
    },
  );

  it.each(PROVIDER_PLUGINS.filter((p) => p.keyEnv?.length))(
    '$id status keyPresent false without key; complete soft-fails',
    async (spec) => {
      clearProviderEnv();
      const mod = requireFromTest(path.join(PLUGINS, spec.id, 'index.js'));
      const mock = createMockCtx(true);
      mod.register(mock.ctx);

      const status = await mock.capabilities.get(spec.statusCapability)!({ input: {} });
      expect(status.output.keyPresent).toBe(false);

      const complete = await mock.capabilities.get(spec.completeCapability)!({
        input: { prompt: 'hi' },
      });
      expect(complete.output.ok).toBe(false);
      // Must soft-fail without network
      expect(mock.permissionCalls.length).toBe(0);
    },
  );

  it.each(PROVIDER_PLUGINS.filter((p) => p.keyEnv?.length))(
    '$id status keyPresent true with key set (value never returned)',
    async (spec) => {
      clearProviderEnv();
      const secret = 'sk-test-should-not-leak-value';
      process.env[spec.keyEnv![0]] = secret;

      const mod = requireFromTest(path.join(PLUGINS, spec.id, 'index.js'));
      const mock = createMockCtx(false);
      mod.register(mock.ctx);

      const status = await mock.capabilities.get(spec.statusCapability)!({ input: {} });
      expect(status.output.keyPresent).toBe(true);
      expect(JSON.stringify(status.output)).not.toContain(secret);

      const complete = await mock.capabilities.get(spec.completeCapability)!({
        input: { prompt: 'hi' },
      });
      // Permission denied soft-fail; no live network
      expect(complete.output.ok).toBe(false);
      expect(complete.output.blocked).toBe(true);
      expect(mock.permissionCalls.length).toBe(1);
    },
  );

  it('provider-ollama keyPresent true without API key; complete soft-fails when network.local denied', async () => {
    clearProviderEnv();
    const mod = requireFromTest(path.join(PLUGINS, 'provider-ollama/index.js'));
    const mock = createMockCtx(false);
    mod.register(mock.ctx);

    const status = await mock.capabilities.get('provider.ollama.status')!({ input: {} });
    expect(status.output.keyPresent).toBe(true);

    const complete = await mock.capabilities.get('provider.ollama.complete')!({
      input: { prompt: 'hi' },
    });
    expect(complete.output.ok).toBe(false);
    expect(complete.output.blocked).toBe(true);
    expect(mock.permissionCalls[0]?.kind).toBe('network.local');
  });

  it('provider-local-llama keyPresent tracks LOCAL_LLM_BASE_URL; soft-fails without base', async () => {
    clearProviderEnv();
    const mod = requireFromTest(path.join(PLUGINS, 'provider-local-llama/index.js'));
    const mock = createMockCtx(true);
    mod.register(mock.ctx);

    const statusMissing = await mock.capabilities.get('provider.local_llama.status')!({ input: {} });
    expect(statusMissing.output.keyPresent).toBe(false);

    const completeMissing = await mock.capabilities.get('provider.local_llama.complete')!({
      input: { prompt: 'hi' },
    });
    expect(completeMissing.output.ok).toBe(false);
    expect(mock.permissionCalls.length).toBe(0);

    process.env.LOCAL_LLM_BASE_URL = 'http://127.0.0.1:8080/v1';
    const mock2 = createMockCtx(false);
    mod.register(mock2.ctx);
    const statusPresent = await mock2.capabilities.get('provider.local_llama.status')!({ input: {} });
    expect(statusPresent.output.keyPresent).toBe(true);

    const completeDenied = await mock2.capabilities.get('provider.local_llama.complete')!({
      input: { prompt: 'hi' },
    });
    expect(completeDenied.output.ok).toBe(false);
    expect(completeDenied.output.blocked).toBe(true);
    expect(mock2.permissionCalls[0]?.kind).toBe('network.local');
  });
});
