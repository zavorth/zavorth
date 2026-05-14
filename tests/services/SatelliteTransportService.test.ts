import {
  validateSatelliteEnvelope,
  type SatelliteEnvelope,
} from '../../src/contracts/SatelliteContract.js';
import { SatelliteTransportService } from '../../src/services/SatelliteTransportService.js';

function buildEnvelope(type: string, payload: unknown, messageId = `msg-${type}`): string {
  return JSON.stringify({
    type,
    messageId,
    replyTo: null,
    payload,
    timestamp: '2026-05-03T22:00:00.000Z',
  });
}

describe('SatelliteTransportService', () => {
  it('validates canonical Satellite envelopes', () => {
    expect(validateSatelliteEnvelope({
      type: 'status.request',
      messageId: 'status-1',
      payload: {},
      timestamp: '2026-05-03T22:00:00.000Z',
    })).toEqual(expect.objectContaining({ ok: true }));

    expect(validateSatelliteEnvelope({
      type: 'unknown',
      messageId: 'status-1',
      payload: {},
      timestamp: '2026-05-03T22:00:00.000Z',
    })).toEqual(expect.objectContaining({
      ok: false,
      code: 'INVALID_MESSAGE_TYPE',
    }));
  });

  it('performs challenge/response auth with nonce validation', async () => {
    const sent: SatelliteEnvelope[] = [];
    const auth = {
      validate: jest.fn((token: string) => token === 'secret-token'),
    };
    const service = new SatelliteTransportService({
      auth: auth as any,
      now: () => new Date('2026-05-03T22:00:00.000Z'),
    });

    service.onConnect('sat-1', (envelope) => sent.push(envelope));
    const challenge = sent[0];

    expect(challenge.type).toBe('auth.challenge');
    expect((challenge.payload as any).nonce).toBeTruthy();

    await service.onMessage('sat-1', buildEnvelope('auth.response', {
      token: 'secret-token',
      nonce: 'wrong-nonce',
    }, 'auth-wrong'));

    expect(sent.at(-1)).toEqual(expect.objectContaining({
      type: 'auth.error',
      replyTo: 'auth-wrong',
    }));

    await service.onMessage('sat-1', buildEnvelope('auth.response', {
      token: 'secret-token',
      nonce: (challenge.payload as any).nonce,
    }, 'auth-ok'));

    expect(auth.validate).toHaveBeenCalledWith('secret-token');
    expect(sent.at(-1)).toEqual(expect.objectContaining({
      type: 'auth.ok',
      replyTo: 'auth-ok',
    }));
  });

  it('responds to heartbeat and status using the real capability registry surface', async () => {
    const sent: SatelliteEnvelope[] = [];
    const heartbeat = jest.fn(() => ({
      heartbeat: { receivedAt: '2026-05-03T22:00:01.000Z' },
    }));
    const service = new SatelliteTransportService({
      now: () => new Date('2026-05-03T22:00:00.000Z'),
      capabilityRegistry: {
        getAll: () => [
          { id: 'satellite.connect', enabled: true },
          { id: 'camera.capture', enabled: true },
          { id: 'disabled.capability', enabled: false },
        ] as any,
      },
      handleHeartbeat: heartbeat,
    });

    service.onConnect('sat-1', (envelope) => sent.push(envelope));
    await service.onMessage('sat-1', buildEnvelope('heartbeat.ping', {
      nodeId: 'mobile-node',
      sharedSecret: 'mesh-secret',
    }, 'hb-1'));
    await service.onMessage('sat-1', buildEnvelope('status.request', {}, 'status-1'));

    expect(heartbeat).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: 'mobile-node', sharedSecret: 'mesh-secret' }),
      expect.objectContaining({ sessionId: 'sat-1' }),
      expect.objectContaining({ messageId: 'hb-1' }),
    );
    expect(sent.find((entry) => entry.replyTo === 'hb-1')).toEqual(expect.objectContaining({
      type: 'heartbeat.pong',
      payload: expect.objectContaining({ ok: true }),
    }));
    expect(sent.find((entry) => entry.replyTo === 'status-1')).toEqual(expect.objectContaining({
      type: 'status.response',
      payload: expect.objectContaining({
        capabilities: ['camera.capture', 'satellite.connect'],
      }),
    }));
  });

  it('dispatches registered capability invocations through the injected bridge', async () => {
    const sent: SatelliteEnvelope[] = [];
    const invokeCapability = jest.fn(async () => ({
      ok: true,
      result: { queued: true, invocationId: 'invoke-1' },
      error: null,
    }));
    const service = new SatelliteTransportService({
      capabilityRegistry: {
        getAll: () => [
          { id: 'camera.capture', enabled: true, command: null },
        ] as any,
      },
      invokeCapability,
    });

    service.onConnect('sat-1', (envelope) => sent.push(envelope));
    await service.onMessage('sat-1', buildEnvelope('capability.invoke', {
      capabilityId: 'camera.capture',
      args: { nodeId: 'mobile-node', payload: { quality: 'preview' } },
    }, 'cap-1'));

    expect(invokeCapability).toHaveBeenCalledWith(
      expect.objectContaining({ capabilityId: 'camera.capture' }),
      expect.objectContaining({ sessionId: 'sat-1' }),
      expect.objectContaining({ messageId: 'cap-1' }),
      expect.objectContaining({ id: 'camera.capture' }),
    );
    expect(sent.at(-1)).toEqual(expect.objectContaining({
      type: 'capability.result',
      replyTo: 'cap-1',
      payload: expect.objectContaining({
        ok: true,
        result: { queued: true, invocationId: 'invoke-1' },
      }),
    }));
  });
});
