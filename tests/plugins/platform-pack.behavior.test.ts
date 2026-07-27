import path from 'node:path';
import { createRequire } from 'node:module';

const requireFromTest = createRequire(__filename);
const PLUGINS = path.resolve(__dirname, '../../plugins');

function createMockCtx(permission = true) {
  const capabilities = new Map<string, (args: any) => Promise<any>>();
  const channels: any[] = [];
  return {
    capabilities,
    channels,
    ctx: {
      bindCapability(id: string, handler: (args: any) => Promise<any>) {
        capabilities.set(id, handler);
      },
      bindChannel(adapter: any) {
        channels.push(adapter);
        if (adapter.capabilityId && typeof adapter.send === 'function') {
          capabilities.set(adapter.capabilityId, async ({ input }: any) => ({
            output: await adapter.send(input || {}),
          }));
        }
      },
      registerPlatform(adapter: any) {
        this.bindChannel(adapter);
      },
      getLogger() {
        return { debug() {}, info() {}, warn() {}, error() {} };
      },
      getWorkspacePath() {
        return process.cwd();
      },
      async requestPermission() {
        return permission;
      },
      emit() {},
    },
  };
}

describe('Platform capability pack', () => {
  const prevEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...prevEnv };
  });

  it('platform-telegram status without token and soft-fail send', async () => {
    const saved = process.env.TELEGRAM_BOT_TOKEN;
    const saved2 = process.env.TELEGRAM_TOKEN;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_TOKEN;
    try {
      const mod = requireFromTest(path.join(PLUGINS, 'platform-telegram/index.js'));
      const mock = createMockCtx(false);
      mod.register(mock.ctx);
      const status = await mock.capabilities.get('platform.telegram.status')!({ input: {} });
      expect(status.output.tokenPresent).toBe(false);
      const send = await mock.capabilities.get('platform.telegram.send')!({
        input: { chatId: '1', text: 'hi' },
      });
      expect(send.output.ok).toBe(false);
      expect(send.output.delivered).toBe(false);
      expect(mock.channels.length).toBeGreaterThanOrEqual(1);
    } finally {
      if (saved !== undefined) process.env.TELEGRAM_BOT_TOKEN = saved;
      else delete process.env.TELEGRAM_BOT_TOKEN;
      if (saved2 !== undefined) process.env.TELEGRAM_TOKEN = saved2;
      else delete process.env.TELEGRAM_TOKEN;
    }
  });

  it('platform-discord status without token', async () => {
    const saved = process.env.DISCORD_BOT_TOKEN;
    delete process.env.DISCORD_BOT_TOKEN;
    try {
      const mod = requireFromTest(path.join(PLUGINS, 'platform-discord/index.js'));
      const mock = createMockCtx();
      mod.register(mock.ctx);
      const status = await mock.capabilities.get('platform.discord.status')!({ input: {} });
      expect(status.output.tokenPresent).toBe(false);
      const serialized = JSON.stringify(status.output);
      expect(serialized).not.toMatch(/Bot\s+\w{10,}/);
    } finally {
      if (saved !== undefined) process.env.DISCORD_BOT_TOKEN = saved;
      else delete process.env.DISCORD_BOT_TOKEN;
    }
  });

  it('platform-whatsapp status reports presence only', async () => {
    process.env.WHATSAPP_TOKEN = 'secret-token-must-not-leak';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '12345';
    const mod = requireFromTest(path.join(PLUGINS, 'platform-whatsapp/index.js'));
    const mock = createMockCtx();
    mod.register(mock.ctx);
    const status = await mock.capabilities.get('platform.whatsapp.status')!({ input: {} });
    expect(status.output.ok).toBe(true);
    const serialized = JSON.stringify(status.output);
    expect(serialized).not.toContain('secret-token-must-not-leak');
  });

  it('platform-webhook rejects private URL override', async () => {
    delete process.env.ZAVORTH_PLATFORM_WEBHOOK_URL;
    delete process.env.PLATFORM_WEBHOOK_URL;
    const mod = requireFromTest(path.join(PLUGINS, 'platform-webhook/index.js'));
    const mock = createMockCtx(true);
    mod.register(mock.ctx);
    const send = await mock.capabilities.get('platform.webhook.send')!({
      input: { url: 'http://127.0.0.1/hook', text: 'nope' },
    });
    expect(send.output.ok).toBe(false);
    expect(String(send.output.message || '')).toMatch(/reject|HTTPS|public|localhost/i);
  });
});
