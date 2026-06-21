import fs from 'fs';
import path from 'path';
import { OutboxRetryService } from '../../src/services/OutboxRetryService';
import { ChannelGatewayRegistry } from '../../src/gateways/ChannelGatewayRegistry';

describe('OutboxRetryService Tests (Fase 2)', () => {
  const tempDir = path.resolve(__dirname, 'temp-outbox-test');

  beforeAll(() => {
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should successfully deliver an outbox message and delete its file', async () => {
    // Setup mock gateway
    const mockGateway = {
      id: 'mock-channel',
      name: 'Mock Channel',
      resolveConfigured: () => true,
      outboxDirectory: tempDir,
      retrySendLive: jest.fn().mockResolvedValue({ ok: true, status: 'delivered', transport: 'mock' })
    };

    const registry = new ChannelGatewayRegistry();
    registry.registerGateway(mockGateway as any);

    // Create a mock envelope file in the temp directory
    const envelope = {
      id: 'msg-1',
      createdAt: new Date().toISOString(),
      platform: 'mock-channel',
      transport: 'local-outbox',
      recipients: ['recipient-1'],
      message: 'Hello World',
      payload: null
    };
    const filePath = path.join(tempDir, `2026-06-20T22-00-00-000Z-msg-1.json`);
    fs.writeFileSync(filePath, JSON.stringify(envelope, null, 2), 'utf8');

    const service = new OutboxRetryService(registry);
    await service.processOutbox();

    expect(mockGateway.retrySendLive).toHaveBeenCalledWith('Hello World', ['recipient-1'], 'Hello World');
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('should reschedule a transient failure with backoff', async () => {
    const mockGateway = {
      id: 'mock-channel-2',
      name: 'Mock Channel 2',
      resolveConfigured: () => true,
      outboxDirectory: tempDir,
      retrySendLive: jest.fn().mockResolvedValue({ ok: false, status: 'failed', reason: 'Timeout' })
    };

    const registry = new ChannelGatewayRegistry();
    registry.registerGateway(mockGateway as any);

    const envelope = {
      id: 'msg-2',
      createdAt: new Date().toISOString(),
      platform: 'mock-channel-2',
      transport: 'local-outbox',
      recipients: ['recipient-2'],
      message: 'Hello Transient',
      payload: null,
      attempts: 1
    };
    const filePath = path.join(tempDir, `2026-06-20T22-00-00-000Z-msg-2.json`);
    fs.writeFileSync(filePath, JSON.stringify(envelope, null, 2), 'utf8');

    const service = new OutboxRetryService(registry);
    await service.processOutbox();

    expect(fs.existsSync(filePath)).toBe(true);
    const updatedContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(updatedContent.attempts).toBe(2);
    expect(updatedContent.lastError).toBe('Timeout');
    expect(updatedContent.nextAttemptAt).toBeDefined();
    expect(new Date(updatedContent.nextAttemptAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('should move to rejected directory after exceeding max attempts', async () => {
    const mockGateway = {
      id: 'mock-channel-3',
      name: 'Mock Channel 3',
      resolveConfigured: () => true,
      outboxDirectory: tempDir,
      retrySendLive: jest.fn().mockResolvedValue({ ok: false, status: 'failed', reason: 'Forbidden' })
    };

    const registry = new ChannelGatewayRegistry();
    registry.registerGateway(mockGateway as any);

    const envelope = {
      id: 'msg-3',
      createdAt: new Date().toISOString(),
      platform: 'mock-channel-3',
      transport: 'local-outbox',
      recipients: ['recipient-3'],
      message: 'Hello Rejected',
      payload: null,
      attempts: 4 // Max attempts is 5, so next one will exceed it
    };
    const filePath = path.join(tempDir, `2026-06-20T22-00-00-000Z-msg-3.json`);
    fs.writeFileSync(filePath, JSON.stringify(envelope, null, 2), 'utf8');

    const service = new OutboxRetryService(registry);
    await service.processOutbox();

    expect(fs.existsSync(filePath)).toBe(false);
    const rejectedPath = path.join(tempDir, 'rejected', `2026-06-20T22-00-00-000Z-msg-3.json`);
    expect(fs.existsSync(rejectedPath)).toBe(true);

    const rejectedContent = JSON.parse(fs.readFileSync(rejectedPath, 'utf8'));
    expect(rejectedContent.attempts).toBe(5);
    expect(rejectedContent.status).toBe('rejected');
  });
});
