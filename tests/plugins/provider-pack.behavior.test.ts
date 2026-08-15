import path from 'node:path';
import { createRequire } from 'node:module';


const requireFromTest = createRequire(__filename);
const PLUGINS = path.resolve(__dirname, '../../plugins');

function createMockCtx(permission = true) {
  const capabilities = new Map<string, (args: any) => Promise<any>>();
  const providers: any[] = [];
  return {
    capabilities,
    providers,
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
        return __dirname;
      },
      async requestPermission() {
        return permission;
      },
      emit() {},
    },
  };
}

describe('Wave 1 provider pack', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it('provider-status reports presence without values', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-should-not-leak';
    delete process.env.ANTHROPIC_API_KEY;
    const mod = requireFromTest(path.join(PLUGINS, 'provider-status/index.js'));
    const mock = createMockCtx();
    mod.register(mock.ctx);
    const status = await mock.capabilities.get('provider.pack.status')!({ input: {} });
    expect(status.output.ok).toBe(true);
    expect(status.output.configured).toBeGreaterThanOrEqual(1);
    const serialized = JSON.stringify(status.output);
    expect(serialized).not.toContain('sk-test-should-not-leak');
  });

  it('provider-openai-compatible status soft-fails without key', async () => {
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const mod = requireFromTest(path.join(PLUGINS, 'provider-openai-compatible/index.js'));
      const mock = createMockCtx(false);
      mod.register(mock.ctx);
      const status = await mock.capabilities.get('provider.openai_compatible.status')!({ input: {} });
      expect(status.output.keyPresent).toBe(false);
      const complete = await mock.capabilities.get('provider.openai_compatible.complete')!({
        input: { prompt: 'hi' },
      });
      expect(complete.output.ok).toBe(false);
    } finally {
      if (saved !== undefined) process.env.OPENAI_API_KEY = saved;
      else delete process.env.OPENAI_API_KEY;
    }
  });

  it('provider-xai / anthropic / gemini register status handlers', async () => {
    for (const id of ['provider-xai', 'provider-anthropic', 'provider-gemini']) {
      const mod = requireFromTest(path.join(PLUGINS, id, 'index.js'));
      const mock = createMockCtx();
      mod.register(mock.ctx);
      expect(mock.capabilities.size).toBeGreaterThanOrEqual(2);
      expect(mock.providers.length).toBe(1);
    }
  });
});
