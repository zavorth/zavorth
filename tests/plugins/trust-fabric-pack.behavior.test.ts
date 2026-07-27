import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const requireFromTest = createRequire(__filename);
const PLUGINS = path.resolve(__dirname, '../../plugins');

function createMockCtx(workspace: string, permission = true) {
  const capabilities = new Map<string, (args: any) => Promise<any>>();
  const hooks: Array<{ event: string; cb: Function }> = [];
  return {
    capabilities,
    hooks,
    ctx: {
      bindCapability(id: string, handler: (args: any) => Promise<any>) {
        capabilities.set(id, handler);
      },
      registerSecretSource() {},
      registerDashboardAuthProvider() {},
      registerContextEngine() {},
      registerMiddleware(event: string, cb: Function) {
        hooks.push({ event, cb });
      },
      registerHook(event: string, cb: Function) {
        hooks.push({ event, cb });
      },
      getLogger() {
        return { debug() {}, info() {}, warn() {}, error() {} };
      },
      getWorkspacePath() {
        return workspace;
      },
      async requestPermission() {
        return permission;
      },
      emit() {},
    },
  };
}

describe('Trust fabric capability pack', () => {
  const tempRoots: string[] = [];
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function tempWorkspace() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-trust-pack-'));
    tempRoots.push(root);
    return root;
  }

  it('secret-source-env never returns values', async () => {
    process.env.OPENAI_API_KEY = 'sk-secret-must-not-appear';
    const root = tempWorkspace();
    const mod = requireFromTest(path.join(PLUGINS, 'secret-source-env/index.js'));
    const mock = createMockCtx(root, true);
    mod.register(mock.ctx);
    const status = await mock.capabilities.get('secret.env.status')!({ input: {} });
    expect(status.output.ok).toBe(true);
    expect(JSON.stringify(status.output)).not.toContain('sk-secret-must-not-appear');
    const got = await mock.capabilities.get('secret.env.get')!({
      input: { name: 'OPENAI_API_KEY' },
    });
    expect(got.output.present).toBe(true);
    expect(JSON.stringify(got.output)).not.toContain('sk-secret-must-not-appear');
    const denied = await mock.capabilities.get('secret.env.get')!({
      input: { name: 'NOT_ALLOWLISTED_XYZ' },
    });
    expect(denied.output.ok).toBe(false);
  });

  it('secret-source-file set/has/list without leaking values', async () => {
    const root = tempWorkspace();
    const mod = requireFromTest(path.join(PLUGINS, 'secret-source-file/index.js'));
    const mock = createMockCtx(root, true);
    mod.register(mock.ctx);
    const set = await mock.capabilities.get('secret.file.set')!({
      input: { name: 'demo', value: 'super-secret-value-xyz' },
    });
    expect(set.output.ok).toBe(true);
    expect(JSON.stringify(set.output)).not.toContain('super-secret-value-xyz');
    const has = await mock.capabilities.get('secret.file.has')!({ input: { name: 'demo' } });
    expect(has.output.present).toBe(true);
    const list = await mock.capabilities.get('secret.file.list')!({ input: {} });
    expect(JSON.stringify(list.output)).not.toContain('super-secret-value-xyz');
  });

  it('dashboard-auth-basic verify soft-fails without env', async () => {
    delete process.env.DASHBOARD_BASIC_USER;
    delete process.env.DASHBOARD_BASIC_PASSWORD;
    const root = tempWorkspace();
    const mod = requireFromTest(path.join(PLUGINS, 'dashboard-auth-basic/index.js'));
    const mock = createMockCtx(root);
    mod.register(mock.ctx);
    const status = await mock.capabilities.get('dashboard.auth.basic.status')!({ input: {} });
    expect(status.output.ok).toBe(true);
    const verify = await mock.capabilities.get('dashboard.auth.basic.verify')!({
      input: { username: 'a', password: 'b' },
    });
    expect(verify.output.authenticated).toBe(false);
  });

  it('dashboard-auth-token verify works when configured', async () => {
    process.env.DASHBOARD_AUTH_TOKEN = 'tok-abc-123';
    const root = tempWorkspace();
    const mod = requireFromTest(path.join(PLUGINS, 'dashboard-auth-token/index.js'));
    const mock = createMockCtx(root);
    mod.register(mock.ctx);
    const ok = await mock.capabilities.get('dashboard.auth.token.verify')!({
      input: { authorization: 'Bearer tok-abc-123' },
    });
    expect(ok.output.authenticated).toBe(true);
    expect(JSON.stringify(ok.output)).not.toContain('tok-abc-123');
  });

  it('context-engine-bridge status soft-fails when unavailable', async () => {
    const root = tempWorkspace();
    const mod = requireFromTest(path.join(PLUGINS, 'context-engine-bridge/index.js'));
    const mock = createMockCtx(root);
    mod.register(mock.ctx);
    const status = await mock.capabilities.get('context.engine.status')!({ input: {} });
    expect(status.output.ok).toBeDefined();
  });

  it('middleware-rate-limit check and configure', async () => {
    const root = tempWorkspace();
    const mod = requireFromTest(path.join(PLUGINS, 'middleware-rate-limit/index.js'));
    const mock = createMockCtx(root, true);
    mod.register(mock.ctx);
    const conf = await mock.capabilities.get('middleware.ratelimit.configure')!({
      input: { limit: 5, windowMs: 60000 },
    });
    expect(conf.output.ok).toBe(true);
    const check = await mock.capabilities.get('middleware.ratelimit.check')!({
      input: { key: 'agent' },
    });
    expect(check.output.ok).toBe(true);
    expect(typeof check.output.allowed).toBe('boolean');
  });
});
