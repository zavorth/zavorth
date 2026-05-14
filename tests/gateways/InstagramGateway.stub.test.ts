import fs from 'fs';
import os from 'os';
import path from 'path';

describe('InstagramGateway', () => {
  const originalEnv = process.env;
  const tempDirs: string[] = [];

  function loadGateway() {
    let InstagramGateway: any;

    jest.isolateModules(() => {
      ({ InstagramGateway } = require('../../src/gateways/InstagramGateway.stub'));
    });

    return InstagramGateway;
  }

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.INSTAGRAM_ENABLED = 'true';
    process.env.INSTAGRAM_PROVIDER = '';
    process.env.INSTAGRAM_GRAPH_API_VERSION = '';
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = '';
    process.env.INSTAGRAM_ACCESS_TOKEN = '';
    process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN = '';
    process.env.INSTAGRAM_ALLOWED_RECIPIENT_IDS = '';
    process.env.INSTAGRAM_OUTBOX_DIR = '';
    process.env.INSTAGRAM_STATUS_FILE = '';
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

  it('writes outbound envelopes and status in supervised local mode', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-instagram-stub-'));
    tempDirs.push(root);
    process.env.INSTAGRAM_ALLOWED_RECIPIENT_IDS = 'ig-user-1,ig-user-2';
    process.env.INSTAGRAM_OUTBOX_DIR = path.join(root, 'outbox');
    process.env.INSTAGRAM_STATUS_FILE = path.join(root, 'status.json');

    const InstagramGateway = loadGateway();
    const gateway = new InstagramGateway();

    await gateway.start();
    await gateway.broadcast('teste do instagram');

    const outboxFiles = fs.readdirSync(process.env.INSTAGRAM_OUTBOX_DIR!);
    const envelope = JSON.parse(
      fs.readFileSync(path.join(process.env.INSTAGRAM_OUTBOX_DIR!, outboxFiles[0]), 'utf8'),
    );
    const status = JSON.parse(fs.readFileSync(process.env.INSTAGRAM_STATUS_FILE!, 'utf8'));

    expect(outboxFiles).toHaveLength(1);
    expect(envelope).toEqual(expect.objectContaining({
      platform: 'instagram',
      transport: 'stub',
      recipients: ['ig-user-1', 'ig-user-2'],
      message: 'teste do instagram',
    }));
    expect(status).toEqual(expect.objectContaining({
      mode: 'stub',
      provider: 'stub',
      started: true,
      recipientsConfigured: 2,
      allowedRecipientIds: ['ig-user-1', 'ig-user-2'],
      webhookStatus: 'not_applicable',
      lastError: null,
    }));
    expect(status.lastOutboundAt).toBeTruthy();
  });

  it('sends outbound text through the Instagram Messaging API when selected', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-instagram-meta-'));
    tempDirs.push(root);
    process.env.INSTAGRAM_PROVIDER = 'meta-messaging';
    process.env.INSTAGRAM_GRAPH_API_VERSION = 'v21.0';
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = 'ig-business-1';
    process.env.INSTAGRAM_ACCESS_TOKEN = 'ig-access-token';
    process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN = 'ig-verify';
    process.env.INSTAGRAM_ALLOWED_RECIPIENT_IDS = 'ig-user-1,ig-user-2';
    process.env.INSTAGRAM_OUTBOX_DIR = path.join(root, 'outbox');
    process.env.INSTAGRAM_STATUS_FILE = path.join(root, 'status.json');

    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        recipient_id: 'ig-user-1',
        message_id: 'ig-mid-1',
      }),
    }));
    const InstagramGateway = loadGateway();
    const gateway = new InstagramGateway(undefined, { fetchImpl });

    await gateway.start();
    await gateway.broadcast('teste real do instagram');

    const outboxFiles = fs.existsSync(process.env.INSTAGRAM_OUTBOX_DIR!)
      ? fs.readdirSync(process.env.INSTAGRAM_OUTBOX_DIR!)
      : [];
    const status = JSON.parse(fs.readFileSync(process.env.INSTAGRAM_STATUS_FILE!, 'utf8'));

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://graph.facebook.com/v21.0/ig-business-1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer ig-access-token',
        }),
        body: JSON.stringify({
          recipient: { id: 'ig-user-1' },
          message: { text: 'teste real do instagram' },
        }),
      }),
    );
    expect(outboxFiles).toEqual([]);
    expect(status).toEqual(expect.objectContaining({
      mode: 'meta-messaging',
      provider: 'meta-messaging',
      providerConfigured: true,
      webhookConfigured: true,
      connected: true,
      lastError: null,
    }));
    expect(status.lastOutboundAt).toBeTruthy();
  });

  it('verifies Meta webhook challenge and dispatches inbound Instagram DMs with native replies', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-instagram-webhook-'));
    tempDirs.push(root);
    process.env.INSTAGRAM_PROVIDER = 'meta-messaging';
    process.env.INSTAGRAM_GRAPH_API_VERSION = 'v20.0';
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = 'ig-business-1';
    process.env.INSTAGRAM_ACCESS_TOKEN = 'ig-access-token';
    process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN = 'ig-verify';
    process.env.INSTAGRAM_ALLOWED_RECIPIENT_IDS = 'ig-user-1';
    process.env.INSTAGRAM_OUTBOX_DIR = path.join(root, 'outbox');
    process.env.INSTAGRAM_STATUS_FILE = path.join(root, 'status.json');

    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        recipient_id: 'ig-user-1',
        message_id: 'ig-reply-1',
      }),
    }));
    const broker = {
      processMessage: jest.fn(async (ctx) => {
        await ctx.reply('pong do instagram');
      }),
    };
    const InstagramGateway = loadGateway();
    const gateway = new InstagramGateway(broker, { fetchImpl });

    await gateway.start();

    expect(
      gateway.handleWebhookVerification(new URL('https://zavorth.test/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=ig-verify&hub.challenge=ig-challenge')),
    ).toEqual({
      statusCode: 200,
      textBody: 'ig-challenge',
    });

    const result = await gateway.handleWebhookEvent({
      body: {
        entry: [
          {
            messaging: [
              {
                sender: { id: 'ig-user-1' },
                message: {
                  mid: 'ig-mid-original',
                  text: 'ping',
                },
              },
            ],
          },
        ],
      },
    });
    const status = JSON.parse(fs.readFileSync(process.env.INSTAGRAM_STATUS_FILE!, 'utf8'));

    expect(result).toEqual({
      statusCode: 200,
      body: {
        ok: true,
        accepted: true,
        received: 1,
        processed: 1,
      },
    });
    expect(broker.processMessage).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'instagram',
      userId: 'ig-user-1',
      chatId: 'ig-user-1',
      channelId: 'ig-user-1',
      messageId: 'ig-mid-original',
      rawText: 'ping',
    }));
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://graph.facebook.com/v20.0/ig-business-1/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          recipient: { id: 'ig-user-1' },
          message: { text: 'pong do instagram' },
        }),
      }),
    );
    expect(status.lastInboundAt).toBeTruthy();
    expect(status.lastOutboundAt).toBeTruthy();
  });
});
