import fs from 'fs';
import os from 'os';
import path from 'path';

describe('WhatsAppGateway stub', () => {
  const originalEnv = process.env;
  const tempDirs: string[] = [];

  function loadGateway() {
    let WhatsAppGateway: any;

    jest.isolateModules(() => {
      ({ WhatsAppGateway } = require('../../src/gateways/channels/whatsapp/WhatsAppGateway'));
    });

    return WhatsAppGateway;
  }

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.WHATSAPP_ENABLED = 'true';
    process.env.WHATSAPP_PROVIDER = '';
    process.env.WHATSAPP_CLOUD_API_VERSION = '';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '';
    process.env.WHATSAPP_ACCESS_TOKEN = '';
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = '';
    process.env.WHATSAPP_ALLOWED_CHAT_IDS = '';
    process.env.WHATSAPP_OUTBOX_DIR = '';
    process.env.WHATSAPP_STATUS_FILE = '';
    process.env.WHATSAPP_SESSION_DIR = '';
    process.env.WHATSAPP_QR_TEXT = '';
    process.env.WHATSAPP_QR_TEXT_FILE = '';
    process.env.WHATSAPP_QR_EXPIRES_IN_MS = '';
    process.env.WHATSAPP_QR_EXPIRES_AT = '';
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

  it('writes outbound test envelopes and updates status when broadcasting', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-whatsapp-stub-'));
    tempDirs.push(root);
    process.env.WHATSAPP_ALLOWED_CHAT_IDS = 'chat-1,chat-2';
    process.env.WHATSAPP_OUTBOX_DIR = path.join(root, 'outbox');
    process.env.WHATSAPP_STATUS_FILE = path.join(root, 'status.json');
    process.env.WHATSAPP_SESSION_DIR = path.join(root, 'session');

    const WhatsAppGateway = loadGateway();
    const gateway = new WhatsAppGateway();

    await gateway.start();
    await gateway.broadcast('teste do channel mesh');

    const outboxFiles = fs.readdirSync(process.env.WHATSAPP_OUTBOX_DIR!);
    expect(outboxFiles.length).toBe(1);
    const envelope = JSON.parse(
      fs.readFileSync(path.join(process.env.WHATSAPP_OUTBOX_DIR!, outboxFiles[0]), 'utf8'),
    );
    const status = JSON.parse(fs.readFileSync(process.env.WHATSAPP_STATUS_FILE!, 'utf8'));

    expect(envelope).toEqual(
      expect.objectContaining({
        transport: 'stub',
        recipients: ['chat-1', 'chat-2'],
        message: 'teste do channel mesh',
      }),
    );
    expect(status).toEqual(
      expect.objectContaining({
        started: true,
        recipientsConfigured: 2,
        allowedChatIds: ['chat-1', 'chat-2'],
        sessionDir: process.env.WHATSAPP_SESSION_DIR,
        sessionDirConfigured: true,
      }),
    );
    expect(status.lastOutboundAt).toBeTruthy();
    expect(status.updatedAt).toBeTruthy();
  });

  it('generates a WhatsApp QR login receipt from the supervised local session', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-whatsapp-qr-'));
    tempDirs.push(root);
    process.env.WHATSAPP_PROVIDER = 'baileys';
    process.env.WHATSAPP_ALLOWED_CHAT_IDS = 'chat-1';
    process.env.WHATSAPP_OUTBOX_DIR = path.join(root, 'outbox');
    process.env.WHATSAPP_STATUS_FILE = path.join(root, 'status.json');
    process.env.WHATSAPP_SESSION_DIR = path.join(root, 'session');
    fs.mkdirSync(process.env.WHATSAPP_SESSION_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(process.env.WHATSAPP_SESSION_DIR, 'qr.txt'),
      '1@sample-whatsapp-login-qr,abc123',
      'utf8',
    );

    const WhatsAppGateway = loadGateway();
    const gateway = new WhatsAppGateway();

    await gateway.start();
    const receipt = await gateway.requestLoginQr();
    const status = JSON.parse(fs.readFileSync(process.env.WHATSAPP_STATUS_FILE!, 'utf8'));

    expect(receipt).toEqual(expect.objectContaining({
      ok: true,
      status: 'ready',
      loginQr: expect.objectContaining({
        supported: true,
        state: 'ready',
        dataUrl: expect.stringMatching(/^data:image\/png;base64,/),
      }),
    }));
    expect(status).toEqual(expect.objectContaining({
      mode: 'baileys',
      provider: 'baileys',
      providerModeLabel: 'Local Baileys bridge',
      started: true,
      linked: true,
      lifecycleState: 'awaiting_qr',
      recipientPolicy: expect.objectContaining({
        state: 'allowlist',
        allowedCount: 1,
      }),
      localBridge: expect.objectContaining({
        provider: 'baileys',
        sessionDirConfigured: true,
        qrState: 'ready',
      }),
      loginQr: expect.objectContaining({
        supported: true,
        state: 'ready',
        dataUrl: null,
      }),
    }));
  });

  it('marks an expired WhatsApp QR without rendering a stale login image', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-whatsapp-qr-expired-'));
    tempDirs.push(root);
    process.env.WHATSAPP_PROVIDER = 'baileys';
    process.env.WHATSAPP_ALLOWED_CHAT_IDS = 'chat-1';
    process.env.WHATSAPP_OUTBOX_DIR = path.join(root, 'outbox');
    process.env.WHATSAPP_STATUS_FILE = path.join(root, 'status.json');
    process.env.WHATSAPP_SESSION_DIR = path.join(root, 'session');
    process.env.WHATSAPP_QR_EXPIRES_AT = '2020-01-01T00:00:00.000Z';
    fs.mkdirSync(process.env.WHATSAPP_SESSION_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(process.env.WHATSAPP_SESSION_DIR, 'qr.txt'),
      '1@expired-whatsapp-login-qr,abc123',
      'utf8',
    );

    const WhatsAppGateway = loadGateway();
    const gateway = new WhatsAppGateway();

    await gateway.start();
    const receipt = await gateway.requestLoginQr();
    const status = JSON.parse(fs.readFileSync(process.env.WHATSAPP_STATUS_FILE!, 'utf8'));

    expect(receipt).toEqual(expect.objectContaining({
      ok: false,
      status: 'pending',
      loginQr: expect.objectContaining({
        supported: true,
        state: 'expired',
        dataUrl: null,
        expiresAt: '2020-01-01T00:00:00.000Z',
      }),
    }));
    expect(status.loginQr).toEqual(expect.objectContaining({
      state: 'expired',
      dataUrl: null,
    }));
    expect(status.localBridge).toEqual(expect.objectContaining({
      qrState: 'expired',
    }));
  });

  it('records first-class local relink and logout receipts without deleting session credentials', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-whatsapp-lifecycle-'));
    tempDirs.push(root);
    process.env.WHATSAPP_PROVIDER = 'baileys';
    process.env.WHATSAPP_ALLOWED_CHAT_IDS = 'chat-1';
    process.env.WHATSAPP_OUTBOX_DIR = path.join(root, 'outbox');
    process.env.WHATSAPP_STATUS_FILE = path.join(root, 'status.json');
    process.env.WHATSAPP_SESSION_DIR = path.join(root, 'session');
    fs.mkdirSync(process.env.WHATSAPP_SESSION_DIR, { recursive: true });
    fs.writeFileSync(path.join(process.env.WHATSAPP_SESSION_DIR, 'creds.json'), '{"safe":true}', 'utf8');

    const WhatsAppGateway = loadGateway();
    const gateway = new WhatsAppGateway();

    const relinkReceipt = await gateway.relink();
    const afterRelink = JSON.parse(fs.readFileSync(process.env.WHATSAPP_STATUS_FILE!, 'utf8'));
    const logoutReceipt = await gateway.logout();
    const afterLogout = JSON.parse(fs.readFileSync(process.env.WHATSAPP_STATUS_FILE!, 'utf8'));

    expect(relinkReceipt).toEqual(expect.objectContaining({
      ok: true,
      status: 'applied',
      receiptFile: expect.stringMatching(/whatsapp-relink-/),
    }));
    expect(afterRelink).toEqual(expect.objectContaining({
      started: true,
      lifecycleState: 'awaiting_qr',
    }));
    expect(logoutReceipt).toEqual(expect.objectContaining({
      ok: true,
      status: 'applied',
      receiptFile: expect.stringMatching(/whatsapp-logout-/),
    }));
    expect(afterLogout).toEqual(expect.objectContaining({
      started: false,
      lifecycleState: 'stopped',
    }));
    expect(fs.existsSync(path.join(process.env.WHATSAPP_SESSION_DIR!, 'creds.json'))).toBe(true);
    expect(fs.existsSync(String(relinkReceipt.receiptFile))).toBe(true);
    expect(fs.existsSync(String(logoutReceipt.receiptFile))).toBe(true);
  });

  it('persists provider decision metadata for future Cloud API rollout', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-whatsapp-provider-'));
    tempDirs.push(root);
    process.env.WHATSAPP_ENABLED = 'true';
    process.env.WHATSAPP_PROVIDER = 'cloud-api';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '1234567890';
    process.env.WHATSAPP_ACCESS_TOKEN = 'wa-access-token';
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-me';
    process.env.WHATSAPP_ALLOWED_CHAT_IDS = 'chat-1';
    process.env.WHATSAPP_OUTBOX_DIR = path.join(root, 'outbox');
    process.env.WHATSAPP_STATUS_FILE = path.join(root, 'status.json');

    const WhatsAppGateway = loadGateway();
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        messaging_product: 'whatsapp',
        messages: [{ id: 'wamid.provider' }],
      }),
    }));
    const gateway = new WhatsAppGateway(undefined, { fetchImpl });

    await gateway.start();
    await gateway.broadcast('teste do provider whatsapp');

    const status = JSON.parse(fs.readFileSync(process.env.WHATSAPP_STATUS_FILE!, 'utf8'));

    expect(status).toEqual(
      expect.objectContaining({
        mode: 'cloud-api',
        provider: 'cloud-api',
        providerModeLabel: 'Meta WhatsApp Cloud API',
        providerConfigured: true,
        phoneNumberId: '1234567890',
        webhookConfigured: true,
        webhookStatus: 'configured',
        lifecycleState: 'connected',
        localBridge: null,
      }),
    );
    expect(String(status.providerDecision || '')).toMatch(/Cloud API (conectada|connected)/i);
  });

  it('sends outbound messages through the WhatsApp Cloud API when the provider is enabled', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-whatsapp-cloud-api-'));
    tempDirs.push(root);
    process.env.WHATSAPP_ENABLED = 'true';
    process.env.WHATSAPP_PROVIDER = 'cloud-api';
    process.env.WHATSAPP_CLOUD_API_VERSION = 'v21.0';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '1234567890';
    process.env.WHATSAPP_ACCESS_TOKEN = 'wa-access-token';
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-me';
    process.env.WHATSAPP_ALLOWED_CHAT_IDS = '5511999999999,5511888888888';
    process.env.WHATSAPP_OUTBOX_DIR = path.join(root, 'outbox');
    process.env.WHATSAPP_STATUS_FILE = path.join(root, 'status.json');

    const WhatsAppGateway = loadGateway();
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        messaging_product: 'whatsapp',
        messages: [{ id: 'wamid.abc' }],
      }),
    }));
    const gateway = new WhatsAppGateway(undefined, { fetchImpl });

    await gateway.start();
    await gateway.broadcast('teste real do whatsapp');

    const outboxExists = fs.existsSync(process.env.WHATSAPP_OUTBOX_DIR!);
    const outboxFiles = outboxExists ? fs.readdirSync(process.env.WHATSAPP_OUTBOX_DIR!) : [];
    const status = JSON.parse(fs.readFileSync(process.env.WHATSAPP_STATUS_FILE!, 'utf8'));

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://graph.facebook.com/v21.0/1234567890/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer wa-access-token',
        }),
      }),
    );
    expect(outboxFiles).toEqual([]);
    expect(status).toEqual(
      expect.objectContaining({
        mode: 'cloud-api',
        provider: 'cloud-api',
        providerConfigured: true,
        lastError: null,
      }),
    );
    expect(status.lastOutboundAt).toBeTruthy();
  });

  it('verifies the WhatsApp Cloud API webhook and dispatches inbound messages with native replies', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-whatsapp-webhook-'));
    tempDirs.push(root);
    process.env.WHATSAPP_ENABLED = 'true';
    process.env.WHATSAPP_PROVIDER = 'cloud-api';
    process.env.WHATSAPP_CLOUD_API_VERSION = 'v20.0';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '1234567890';
    process.env.WHATSAPP_ACCESS_TOKEN = 'wa-access-token';
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-me';
    process.env.WHATSAPP_ALLOWED_CHAT_IDS = '5511999999999';
    process.env.WHATSAPP_OUTBOX_DIR = path.join(root, 'outbox');
    process.env.WHATSAPP_STATUS_FILE = path.join(root, 'status.json');

    const WhatsAppGateway = loadGateway();
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        messaging_product: 'whatsapp',
        messages: [{ id: 'wamid.reply' }],
      }),
    }));
    const broker = {
      processMessage: jest.fn(async (ctx) => {
        await ctx.reply('pong do whatsapp');
      }),
    };
    const gateway = new WhatsAppGateway(broker, { fetchImpl });

    await gateway.start();

    expect(
      gateway.handleWebhookVerification(new URL('https://zavorth.test/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=challenge-123')),
    ).toEqual({
      statusCode: 200,
      textBody: 'challenge-123',
    });

    const result = await gateway.handleWebhookEvent({
      body: {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '5511999999999',
                      id: 'wamid.original',
                      type: 'text',
                      text: {
                        body: 'ping',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    });

    const status = JSON.parse(fs.readFileSync(process.env.WHATSAPP_STATUS_FILE!, 'utf8'));

    expect(result).toEqual({
      statusCode: 200,
      body: {
        ok: true,
        accepted: true,
        received: 1,
        processed: 1,
      },
    });
    expect(broker.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'whatsapp',
        userId: '5511999999999',
        chatId: '5511999999999',
        messageId: 'wamid.original',
        rawText: 'ping',
      }),
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://graph.facebook.com/v20.0/1234567890/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: '5511999999999',
          type: 'text',
          text: {
            body: 'pong do whatsapp',
          },
          context: {
            message_id: 'wamid.original',
          },
        }),
      }),
    );
    expect(status.lastInboundAt).toBeTruthy();
    expect(status.lastOutboundAt).toBeTruthy();
  });
});
