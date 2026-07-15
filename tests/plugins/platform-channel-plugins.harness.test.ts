import path from 'node:path';
import { createRequire } from 'node:module';

const requireFromTest = createRequire(__filename);
const PLUGINS = path.resolve(__dirname, '../../plugins');

/** New first-party channel plugins under test (status must never leak secrets). */
const CHANNEL_PLUGINS = [
  {
    id: 'platform-slack',
    platform: 'slack',
    statusCap: 'platform.slack.status',
    sendCap: 'platform.slack.send',
    secretEnv: { SLACK_BOT_TOKEN: 'slack-bot-token-fixture-must-not-leak-99' },
    clearEnv: ['SLACK_BOT_TOKEN', 'SLACK_TOKEN'],
  },
  {
    id: 'platform-email',
    platform: 'email',
    statusCap: 'platform.email.status',
    sendCap: 'platform.email.send',
    secretEnv: {
      EMAIL_SMTP_HOST: 'smtp.secret.example',
      EMAIL_SMTP_USER: 'user-secret@example.com',
      EMAIL_SMTP_PASS: 'email-pass-must-not-leak-99',
    },
    clearEnv: [
      'EMAIL_SMTP_HOST',
      'SMTP_HOST',
      'EMAIL_SMTP_USER',
      'SMTP_USER',
      'EMAIL_SMTP_PASS',
      'SMTP_PASS',
      'EMAIL_API_KEY',
      'EMAIL_TOKEN',
    ],
  },
  {
    id: 'platform-matrix',
    platform: 'matrix',
    statusCap: 'platform.matrix.status',
    sendCap: 'platform.matrix.send',
    secretEnv: {
      MATRIX_HOMESERVER: 'https://matrix.secret.example',
      MATRIX_ACCESS_TOKEN: 'matrix-token-must-not-leak-99',
    },
    clearEnv: ['MATRIX_HOMESERVER', 'MATRIX_BASE_URL', 'MATRIX_ACCESS_TOKEN'],
  },
  {
    id: 'platform-signal',
    platform: 'signal',
    statusCap: 'platform.signal.status',
    sendCap: 'platform.signal.send',
    secretEnv: {
      SIGNAL_ACCOUNT_NUMBER: '+15555550123',
      SIGNAL_BRIDGE_TOKEN: 'signal-token-must-not-leak-99',
      SIGNAL_JSONRPC_URL: 'unix:///tmp/signal-secret.sock',
    },
    clearEnv: [
      'SIGNAL_ACCOUNT_NUMBER',
      'SIGNAL_BRIDGE_TOKEN',
      'SIGNAL_TOKEN',
      'SIGNAL_ACCESS_TOKEN',
      'SIGNAL_JSONRPC_URL',
      'SIGNAL_CLI_PATH',
      'SIGNAL_BRIDGE_URL',
    ],
  },
  {
    id: 'platform-teams',
    platform: 'teams',
    statusCap: 'platform.teams.status',
    sendCap: 'platform.teams.send',
    secretEnv: {
      TEAMS_WEBHOOK_URL: 'https://outlook.office.com/webhook/secret-must-not-leak-teams-99',
    },
    clearEnv: [
      'TEAMS_WEBHOOK_URL',
      'MSTEAMS_WEBHOOK_URL',
      'MICROSOFT_TEAMS_WEBHOOK_URL',
      'TEAMS_APP_ID',
      'MICROSOFT_TEAMS_APP_ID',
      'TEAMS_APP_PASSWORD',
      'TEAMS_CLIENT_SECRET',
      'MICROSOFT_TEAMS_CLIENT_SECRET',
      'MICROSOFT_TEAMS_TOKEN',
      'TEAMS_TOKEN',
    ],
  },
  {
    id: 'platform-imessage',
    platform: 'imessage',
    statusCap: 'platform.imessage.status',
    sendCap: 'platform.imessage.send',
    secretEnv: {
      IMESSAGE_BRIDGE_TOKEN: 'imessage-token-must-not-leak-99',
      IMESSAGE_BRIDGE_URL: 'https://bridge.secret.example/imessage',
    },
    clearEnv: [
      'IMESSAGE_BRIDGE_TOKEN',
      'IMESSAGE_TOKEN',
      'IMESSAGE_ACCESS_TOKEN',
      'IMESSAGE_BRIDGE_URL',
      'IMESSAGE_BRIDGE_SCRIPT',
      'IMESSAGE_NODE_ID',
      'IMESSAGE_ENABLED',
    ],
  },
  {
    id: 'platform-instagram',
    platform: 'instagram',
    statusCap: 'platform.instagram.status',
    sendCap: 'platform.instagram.send',
    secretEnv: {
      INSTAGRAM_ACCESS_TOKEN: 'ig-token-must-not-leak-99',
    },
    clearEnv: [
      'INSTAGRAM_ACCESS_TOKEN',
      'INSTAGRAM_TOKEN',
      'INSTAGRAM_PAGE_ACCESS_TOKEN',
      'INSTAGRAM_BUSINESS_ACCOUNT_ID',
      'INSTAGRAM_ACCOUNT_ID',
      'INSTAGRAM_PAGE_ID',
    ],
  },
  {
    id: 'platform-sms',
    platform: 'sms',
    statusCap: 'platform.sms.status',
    sendCap: 'platform.sms.send',
    secretEnv: {
      TWILIO_ACCOUNT_SID: 'ACsid-must-not-leak-99',
      TWILIO_AUTH_TOKEN: 'twilio-auth-must-not-leak-99',
    },
    clearEnv: [
      'TWILIO_ACCOUNT_SID',
      'SMS_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'SMS_AUTH_TOKEN',
      'TWILIO_FROM_NUMBER',
      'TWILIO_PHONE_NUMBER',
    ],
  },
] as const;

function createMockCtx(permission = true) {
  const capabilities = new Map<string, (args: any) => Promise<any>>();
  const channels: any[] = [];
  const permissionCalls: string[] = [];
  return {
    capabilities,
    channels,
    permissionCalls,
    ctx: {
      bindCapability(id: string, handler: (args: any) => Promise<any>) {
        capabilities.set(id, handler);
      },
      bindChannel(adapter: any) {
        channels.push(adapter);
        if (adapter.capabilityId && typeof adapter.send === 'function') {
          // Prefer explicit bindCapability registration; do not overwrite.
          if (!capabilities.has(adapter.capabilityId)) {
            capabilities.set(adapter.capabilityId, async ({ input }: any) => ({
              output: await adapter.send(input || {}),
            }));
          }
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
      async requestPermission(kind: string) {
        permissionCalls.push(String(kind));
        return permission;
      },
      emit() {},
    },
  };
}

function clearPluginEnv(keys: readonly string[]) {
  for (const key of keys) {
    delete process.env[key];
  }
}

function applySecretEnv(env: Record<string, string>) {
  for (const [k, v] of Object.entries(env)) {
    process.env[k] = v;
  }
}

function collectSecretFragments(env: Record<string, string>): string[] {
  return Object.values(env).filter((v) => v.length >= 8);
}

describe('platform channel plugins harness', () => {
  const prevEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...prevEnv };
  });

  for (const plugin of CHANNEL_PLUGINS) {
    describe(plugin.id, () => {
      it('status without config reports platform + tokenPresent/configured false (no secrets)', async () => {
        clearPluginEnv(plugin.clearEnv);
        // Fresh require of CJS modules is cached; handlers re-read process.env at call time.
        const mod = requireFromTest(path.join(PLUGINS, `${plugin.id}/index.js`));
        const mock = createMockCtx(false);
        mod.register(mock.ctx);

        const status = await mock.capabilities.get(plugin.statusCap)!({ input: {} });
        expect(status.output).toBeDefined();
        expect(status.output.platform).toBe(plugin.platform);
        expect(status.output.ok).toBe(true);

        const hasTokenPresent = typeof status.output.tokenPresent === 'boolean';
        const hasConfigured = typeof status.output.configured === 'boolean';
        expect(hasTokenPresent || hasConfigured).toBe(true);
        if (hasTokenPresent) expect(status.output.tokenPresent).toBe(false);
        if (hasConfigured) expect(status.output.configured).toBe(false);

        expect(mock.channels.length).toBeGreaterThanOrEqual(1);
        expect(mock.channels[0].id).toBe(plugin.platform);
      });

      it('status with secrets set never exposes secret values', async () => {
        clearPluginEnv(plugin.clearEnv);
        applySecretEnv(plugin.secretEnv);
        const mod = requireFromTest(path.join(PLUGINS, `${plugin.id}/index.js`));
        const mock = createMockCtx(true);
        mod.register(mock.ctx);

        const status = await mock.capabilities.get(plugin.statusCap)!({ input: {} });
        expect(status.output.platform).toBe(plugin.platform);
        expect(status.output.ok).toBe(true);

        const hasTokenPresent = typeof status.output.tokenPresent === 'boolean';
        const hasConfigured = typeof status.output.configured === 'boolean';
        expect(hasTokenPresent || hasConfigured).toBe(true);
        if (hasTokenPresent) expect(status.output.tokenPresent).toBe(true);
        if (hasConfigured) expect(status.output.configured).toBe(true);

        const serialized = JSON.stringify(status.output);
        for (const fragment of collectSecretFragments(plugin.secretEnv)) {
          expect(serialized).not.toContain(fragment);
        }
        // Booleans only — no raw env dump.
        expect(serialized).not.toMatch(/xoxb-secret|must-not-leak/i);
      });

      it('send soft-fails without config and never throws', async () => {
        clearPluginEnv(plugin.clearEnv);
        const mod = requireFromTest(path.join(PLUGINS, `${plugin.id}/index.js`));
        const mock = createMockCtx(true);
        mod.register(mock.ctx);

        const send = await mock.capabilities.get(plugin.sendCap)!({
          input: { to: 'test', text: 'hi', channel: 'C1', chatId: '1', roomId: '!r:x' },
        });
        expect(send.output).toBeDefined();
        expect(send.output.ok).toBe(false);
        expect(send.output.delivered).toBe(false);
      });

      it('send requests network.external or channel.send when configured', async () => {
        clearPluginEnv(plugin.clearEnv);
        applySecretEnv(plugin.secretEnv);
        // SMS also needs From for send path past validation.
        if (plugin.id === 'platform-sms') {
          process.env.TWILIO_FROM_NUMBER = '+15555550100';
        }
        const mod = requireFromTest(path.join(PLUGINS, `${plugin.id}/index.js`));
        const mock = createMockCtx(false);
        mod.register(mock.ctx);

        const send = await mock.capabilities.get(plugin.sendCap)!({
          input: {
            to: '+15555559876',
            text: 'harness-ping',
            channel: 'C01234567',
            chatId: '1',
            roomId: '!room:example.com',
            recipient: 'user@example.com',
          },
        });
        expect(send.output).toBeDefined();
        expect(send.output.ok).toBe(false);
        // Permission denied or blocked path — no secret leak.
        const serialized = JSON.stringify(send.output);
        for (const fragment of collectSecretFragments(plugin.secretEnv)) {
          expect(serialized).not.toContain(fragment);
        }
        const kinds = mock.permissionCalls;
        expect(kinds.some((k) => k === 'network.external' || k === 'channel.send')).toBe(true);
      });
    });
  }

  it('all harness plugins are listed in curated marketplace as channel first-party', () => {
    const curatedPath = path.resolve(__dirname, '../../config/plugin-marketplace-curated.json');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const curated = requireFromTest(curatedPath) as Array<Record<string, unknown>>;
    for (const plugin of CHANNEL_PLUGINS) {
      const entry = curated.find((e) => e.id === plugin.id);
      expect(entry).toBeDefined();
      expect(entry!.moduleKind).toBe('channel');
      expect(entry!.tier).toBe('first-party');
      expect(entry!.source).toBe(`bundled://${plugin.id}`);
    }
  });
});
