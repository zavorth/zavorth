import path from 'node:path';
import { createRequire } from 'node:module';


const requireFromTest = createRequire(__filename);
const PLUGINS = path.resolve(__dirname, '../../plugins');

function createMockCtx(permission = true) {
  const capabilities = new Map<string, (args: any) => Promise<any>>();
  const surface: string[] = [];
  const registrars = {
    registerSkill: true,
    registerCliCommand: true,
    registerAuxiliaryTask: true,
    registerWebSearchProvider: true,
    registerBrowserProvider: true,
    registerImageGenProvider: true,
    registerVideoGenProvider: true,
    registerTtsProvider: true,
    registerTranscriptionProvider: true,
    registerSecretSource: true,
    registerDashboardAuthProvider: true,
    registerContextEngine: true,
    registerSlackActionHandler: true,
    registerMiddleware: true,
  };
  const ctx: any = {
    bindCapability(id: string, handler: (args: any) => Promise<any>) {
      capabilities.set(id, handler);
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
    registerHook() {},
  };
  for (const name of Object.keys(registrars)) {
    ctx[name] = (..._args: any[]) => {
      surface.push(name);
    };
  }
  return { capabilities, surface, ctx };
}

describe('Wave 7 lifestyle & demos pack', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it('spotify-soft status and soft-fail without token', async () => {
    delete process.env.SPOTIFY_ACCESS_TOKEN;
    delete process.env.SPOTIFY_TOKEN;
    const mod = requireFromTest(path.join(PLUGINS, 'spotify-soft/index.js'));
    const mock = createMockCtx(false);
    mod.register(mock.ctx);
    const status = await mock.capabilities.get('spotify.status')!({ input: {} });
    expect(status.output.ok).toBe(true);
    expect(status.output.tokenConfigured).toBe(false);
    const now = await mock.capabilities.get('spotify.now_playing')!({ input: {} });
    expect(now.output.ok).toBe(false);
  });

  it('spotify-soft status never leaks token', async () => {
    process.env.SPOTIFY_ACCESS_TOKEN = 'spotify-secret-token-xyz';
    const mod = requireFromTest(path.join(PLUGINS, 'spotify-soft/index.js'));
    const mock = createMockCtx(true);
    mod.register(mock.ctx);
    const status = await mock.capabilities.get('spotify.status')!({ input: {} });
    expect(status.output.tokenConfigured).toBe(true);
    expect(JSON.stringify(status.output)).not.toContain('spotify-secret-token-xyz');
  });

  it('demo-showcase ping and status report surface', async () => {
    const mod = requireFromTest(path.join(PLUGINS, 'demo-showcase/index.js'));
    const mock = createMockCtx();
    mod.register(mock.ctx);
    const ping = await mock.capabilities.get('demo.showcase.ping')!({
      input: { message: 'wave7' },
    });
    expect(ping.output.ok).toBe(true);
    expect(ping.output.wave).toBe('W7');

    const status = await mock.capabilities.get('demo.showcase.status')!({ input: {} });
    expect(status.output.ok).toBe(true);
    expect(status.output.wave).toBe('W7');
    expect(Array.isArray(status.output.surface)).toBe(true);
    expect(status.output.surface.length).toBeGreaterThan(5);

    const auth = await mock.capabilities.get('demo.showcase.auth')!({
      input: { token: 'demo' },
    });
    expect(auth.output.authenticated).toBe(true);

    const search = await mock.capabilities.get('demo.showcase.web_search')!({
      input: { query: 'zavorth' },
    });
    expect(search.output.ok).toBe(true);
  });
});
