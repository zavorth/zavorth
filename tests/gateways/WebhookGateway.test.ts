import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../../src/config/index.js';
import { MatrixGateway } from '../../src/gateways/channels/simple/MatrixGateway.js';

describe('WebhookGateway live delivery', () => {
  const originalBaseUrl = config.matrixBaseUrl;
  const originalToken = config.matrixAccessToken;

  afterEach(() => {
    (config as any).matrixBaseUrl = originalBaseUrl;
    (config as any).matrixAccessToken = originalToken;
  });

  it('delivers configured Matrix messages through HTTP instead of silently queuing an outbox file', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-webhook-gateway-'));
    (config as any).matrixBaseUrl = 'https://matrix.example.test';
    (config as any).matrixAccessToken = 'token';
    const fetchImpl = jest.fn(async () => new Response('{}', { status: 200 }));
    const gateway = new MatrixGateway({
      eventBus: { emit: jest.fn() } as any,
      policyManager: { verifyAccess: jest.fn(async () => true) } as any,
      fetchImpl: fetchImpl as any,
      outboxDir: path.join(root, 'outbox'),
      statusFile: path.join(root, 'status.json'),
    });

    try {
      const delivery = await gateway.sendMessage({ text: 'hello', recipients: ['!room:example.test'] });
      expect(delivery).toEqual(expect.objectContaining({ ok: true, status: 'delivered', httpStatus: 200 }));
      expect(fetchImpl).toHaveBeenCalledWith(
        expect.stringContaining('/rooms/!room%3Aexample.test/send/m.room.message/'),
        expect.objectContaining({ method: 'PUT' }),
      );
      expect(fs.readdirSync(path.join(root, 'outbox'))).toEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('records the actual gateway id when inbound policy blocks a message', async () => {
    const logged: any[] = [];
    const gateway = new MatrixGateway({
      eventBus: { emit: jest.fn() } as any,
      policyManager: { verifyAccess: jest.fn(async () => false) } as any,
      auditLogger: { logChannelAccessDecision: (entry: unknown) => logged.push(entry) } as any,
    });

    const accepted = await gateway.onMessageReceived({
      sender: '@user:example.test',
      room_id: '!room:example.test',
      content: { body: 'hello' },
    });
    expect(accepted).toBe(false);
    expect(logged[0]).toEqual(expect.objectContaining({ channel: 'matrix' }));
  });

  it('authorizes the sender before processing an untrusted voice attachment', async () => {
    const gateway = new MatrixGateway({
      eventBus: { emit: jest.fn() } as any,
      policyManager: { verifyAccess: jest.fn(async () => false) } as any,
      auditLogger: { logChannelAccessDecision: jest.fn() } as any,
    });
    const accepted = await gateway.onMessageReceived({
      sender: '@blocked:example.test',
      room_id: '!room:example.test',
      audio_url: 'https://media.example.test/costly.ogg',
      content: { body: '' },
    });
    expect(accepted).toBe(false);
  });

  describe('Transient error handling and outbox retry queuing', () => {
    it('correctly identifies transient errors', () => {
      const gateway = new MatrixGateway({
        eventBus: { emit: jest.fn() } as any,
        policyManager: { verifyAccess: jest.fn(async () => true) } as any,
      });

      expect(
        gateway.isTransientError({
          ok: false,
          status: 'failed',
          transport: 'matrix',
          httpStatus: 429,
          reason: 'Too Many Requests',
        }),
      ).toBe(true);
      expect(
        gateway.isTransientError({
          ok: false,
          status: 'failed',
          transport: 'matrix',
          httpStatus: 503,
          reason: 'Service Unavailable',
        }),
      ).toBe(true);
      expect(
        gateway.isTransientError({
          ok: false,
          status: 'failed',
          transport: 'matrix',
          httpStatus: 400,
          reason: 'Bad Request',
        }),
      ).toBe(false);
      expect(
        gateway.isTransientError({ ok: false, status: 'failed', transport: 'matrix', reason: 'fetch failed' }),
      ).toBe(true);
      expect(
        gateway.isTransientError({ ok: false, status: 'failed', transport: 'matrix', reason: 'Connection timeout' }),
      ).toBe(true);
    });

    it('queues message to outbox on transient live delivery failure', async () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-webhook-gateway-retry-'));
      (config as any).matrixBaseUrl = 'https://matrix.example.test';
      (config as any).matrixAccessToken = 'token';
      const fetchImpl = jest.fn(async () => new Response('Internal Server Error', { status: 500 }));
      const gateway = new MatrixGateway({
        eventBus: { emit: jest.fn() } as any,
        policyManager: { verifyAccess: jest.fn(async () => true) } as any,
        fetchImpl: fetchImpl as any,
        outboxDir: path.join(root, 'outbox'),
        statusFile: path.join(root, 'status.json'),
      });

      try {
        const delivery = await gateway.sendMessage({ text: 'hello retry', recipients: ['!room:example.test'] });
        expect(delivery.status).toBe('queued');
        expect(delivery.transport).toBe('local-outbox');

        const files = fs.readdirSync(path.join(root, 'outbox'));
        expect(files.length).toBe(1);
        const queuedEnvelope = JSON.parse(fs.readFileSync(path.join(root, 'outbox', files[0]), 'utf8'));
        expect(queuedEnvelope.message).toBe('hello retry');
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  });
});
