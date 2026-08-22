import fs from 'fs';
import crypto from 'crypto';
import os from 'os';
import path from 'path';
import { SlackGateway } from '../../src/gateways/channels/slack/SlackGateway';

jest.mock('../../src/config/index.js', () => {
  const actualConfigModule = jest.requireActual('../../src/config/index.js') as Record<string, unknown>;
  const configFactory = jest.requireActual('../../src/config/sections/configFactory') as typeof import(
    '../../src/config/sections/configFactory'
  );

  // The real config singleton freezes env-derived values at module load,
  // before the per-test env setup runs. Expose a lazy view that rebuilds the
  // config from process.env on every read so results never depend on the
  // machine-level environment.
  const lazyConfig = new Proxy<Record<PropertyKey, unknown>>({}, {
    get(_target, property) {
      if (typeof property === 'symbol') {
        return undefined;
      }
      return Reflect.get(configFactory.buildZavorthConfig(), property);
    },
    has(_target, property) {
      return Reflect.has(configFactory.buildZavorthConfig(), property);
    },
    ownKeys() {
      return Reflect.ownKeys(configFactory.buildZavorthConfig());
    },
    getOwnPropertyDescriptor(_target, property) {
      const descriptor = Reflect.getOwnPropertyDescriptor(configFactory.buildZavorthConfig(), property);
      if (!descriptor) {
        return undefined;
      }
      descriptor.configurable = true;
      return descriptor;
    },
  });

  return { ...actualConfigModule, config: lazyConfig };
});

describe('SlackGateway stub', () => {
  const originalEnv = process.env;
  const tempDirs: string[] = [];

  function loadGateway() {
    return SlackGateway;
  }

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.SLACK_ENABLED = 'true';
    process.env.SLACK_BOT_TOKEN = '';
    process.env.SLACK_SIGNING_SECRET = '';
    process.env.SLACK_TRANSPORT = '';
    process.env.SLACK_API_BASE_URL = '';
    process.env.SLACK_WORKSPACE_ID = '';
    process.env.SLACK_ALLOWED_CHANNEL_IDS = '';
    process.env.SLACK_OUTBOX_DIR = '';
    process.env.SLACK_STATUS_FILE = '';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('writes outbound envelopes and updates status when broadcasting', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-slack-stub-'));
    tempDirs.push(root);
    process.env.SLACK_ALLOWED_CHANNEL_IDS = 'ops,alerts';
    process.env.SLACK_OUTBOX_DIR = path.join(root, 'outbox');
    process.env.SLACK_STATUS_FILE = path.join(root, 'status.json');
    process.env.SLACK_WORKSPACE_ID = 'workspace-1';

    const SlackGateway = loadGateway();
    const gateway = new SlackGateway();

    await gateway.start();
    await gateway.broadcast('teste do platform plane');

    const outboxFiles = fs.readdirSync(process.env.SLACK_OUTBOX_DIR!);
    expect(outboxFiles.length).toBe(1);
    const envelope = JSON.parse(fs.readFileSync(path.join(process.env.SLACK_OUTBOX_DIR!, outboxFiles[0]), 'utf8'));
    const status = JSON.parse(fs.readFileSync(process.env.SLACK_STATUS_FILE!, 'utf8'));

    expect(envelope).toEqual(
      expect.objectContaining({
        transport: 'local',
        recipients: ['ops', 'alerts'],
        workspaceId: 'workspace-1',
        message: 'teste do platform plane',
      }),
    );
    expect(status).toEqual(
      expect.objectContaining({
        started: true,
        recipientsConfigured: 2,
        allowedChannelIds: ['ops', 'alerts'],
        workspaceId: 'workspace-1',
        workspaceConfigured: true,
      }),
    );
    expect(status.lastOutboundAt).toBeTruthy();
    expect(status.updatedAt).toBeTruthy();
  });

  it('sends outbound messages through the Slack Web API when native mode is enabled', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-slack-native-'));
    tempDirs.push(root);
    process.env.SLACK_ENABLED = 'true';
    process.env.SLACK_TRANSPORT = 'native';
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    process.env.SLACK_API_BASE_URL = 'https://slack.test/api';
    process.env.SLACK_ALLOWED_CHANNEL_IDS = 'ops,alerts';
    process.env.SLACK_OUTBOX_DIR = path.join(root, 'outbox');
    process.env.SLACK_STATUS_FILE = path.join(root, 'status.json');
    process.env.SLACK_WORKSPACE_ID = 'workspace-1';

    const SlackGateway = loadGateway();
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, ts: '1712345.0001' }),
    }));
    const gateway = new SlackGateway(undefined, { fetchImpl });

    await gateway.start();
    await gateway.broadcast('teste nactive do slack');

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://slack.test/api/chat.postMessage',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer xoxb-test-token',
        }),
      }),
    );
    const outboxExists = fs.existsSync(process.env.SLACK_OUTBOX_DIR!);
    const outboxFiles = outboxExists ? fs.readdirSync(process.env.SLACK_OUTBOX_DIR!) : [];
    const status = JSON.parse(fs.readFileSync(process.env.SLACK_STATUS_FILE!, 'utf8'));

    expect(outboxFiles).toEqual([]);
    expect(status).toEqual(
      expect.objectContaining({
        mode: 'native',
        transport: 'native',
        nativeConfigured: true,
        recipientsConfigured: 2,
        apiBaseUrl: 'https://slack.test/api',
        lastError: null,
      }),
    );
    expect(status.lastOutboundAt).toBeTruthy();
  });

  it('accepts signed webhook events and replies in-thread through the Slack Web API', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-slack-webhook-'));
    tempDirs.push(root);
    process.env.SLACK_ENABLED = 'true';
    process.env.SLACK_TRANSPORT = 'native';
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    process.env.SLACK_SIGNING_SECRET = 'slack-signing-secret';
    process.env.SLACK_API_BASE_URL = 'https://slack.test/api';
    process.env.SLACK_ALLOWED_CHANNEL_IDS = 'ops';
    process.env.SLACK_OUTBOX_DIR = path.join(root, 'outbox');
    process.env.SLACK_STATUS_FILE = path.join(root, 'status.json');

    const SlackGateway = loadGateway();
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, ts: '1712345.0002' }),
    }));
    const broker = {
      processMessage: jest.fn(async (ctx) => {
        await ctx.reply('pong do slack');
      }),
    };
    const gateway = new SlackGateway(broker, { fetchImpl });

    await gateway.start();

    const rawBody = JSON.stringify({
      type: 'event_callback',
      event: {
        type: 'app_mention',
        user: 'U-1',
        channel: 'C-ops',
        text: '<@bot> ping',
        ts: '1712345.0001',
      },
    });
    const timestamp = `${Math.floor(Date.now() / 1000)}`;
    const signature = `v0=${crypto.createHmac('sha256', 'slack-signing-secret').update(`v0:${timestamp}:${rawBody}`).digest('hex')}`;

    const result = await gateway.handleWebhookEvent({
      headers: {
        'x-slack-request-timestamp': timestamp,
        'x-slack-signature': signature,
      },
      rawBody,
      body: JSON.parse(rawBody),
    });

    const status = JSON.parse(fs.readFileSync(process.env.SLACK_STATUS_FILE!, 'utf8'));

    expect(result).toEqual({
      statusCode: 200,
      body: { ok: true, accepted: true },
    });
    expect(broker.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'slack',
        userId: 'U-1',
        chatId: 'C-ops',
        threadId: '1712345.0001',
        rawText: '<@bot> ping',
      }),
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://slack.test/api/chat.postMessage',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          channel: 'C-ops',
          text: 'pong do slack',
          thread_ts: '1712345.0001',
        }),
      }),
    );
    expect(status.lastInboundAt).toBeTruthy();
    expect(status.lastOutboundAt).toBeTruthy();
  });

  it('rejects Slack webhook requests with invalid signatures', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-slack-invalid-signature-'));
    tempDirs.push(root);
    process.env.SLACK_ENABLED = 'true';
    process.env.SLACK_TRANSPORT = 'native';
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    process.env.SLACK_SIGNING_SECRET = 'slack-signing-secret';
    process.env.SLACK_STATUS_FILE = path.join(root, 'status.json');
    process.env.SLACK_OUTBOX_DIR = path.join(root, 'outbox');

    const SlackGateway = loadGateway();
    const broker = {
      processMessage: jest.fn(),
    };
    const gateway = new SlackGateway(broker);

    await gateway.start();

    const result = await gateway.handleWebhookEvent({
      headers: {
        'x-slack-request-timestamp': `${Math.floor(Date.now() / 1000)}`,
        'x-slack-signature': 'v0=invalid',
      },
      rawBody: JSON.stringify({ type: 'event_callback' }),
      body: { type: 'event_callback' },
    });

    const status = JSON.parse(fs.readFileSync(process.env.SLACK_STATUS_FILE!, 'utf8'));

    expect(result).toEqual({
      statusCode: 401,
      body: { ok: false, error: 'Slack signature invalid.' },
    });
    expect(broker.processMessage).not.toHaveBeenCalled();
    expect(status.lastError).toContain('invalid signature');
  });
});
