import { describe, expect, it } from '@jest/globals';

import { ZavorthChannelLiveCanaryService } from '../../src/services/ZavorthChannelLiveCanaryService.js';

describe('ZavorthChannelLiveCanaryService', () => {
  it('reports honest setup state without performing external IO', () => {
    const snapshot = new ZavorthChannelLiveCanaryService({
      env: {},
      now: () => new Date('2026-06-02T12:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.surface).toBe('channel-live-canary');
    expect(snapshot.status).not.toBe('blocked');
    expect(snapshot.summary.total).toBeGreaterThanOrEqual(10);
    expect(snapshot.summary.needsCredentials + snapshot.summary.needsBridge + snapshot.summary.catalogOnly).toBeGreaterThan(0);
    expect(snapshot.guarantees).toMatchObject({
      noExternalIoDuringCheck: true,
      outboundRequiresAllowlist: true,
      secretsRedacted: true,
    });
  });

  it('marks a configured allowlisted channel as ready for live proof, not default live routing', () => {
    const snapshot = new ZavorthChannelLiveCanaryService({
      env: {
        TELEGRAM_BOT_TOKEN: 'redacted-test-token',
        TELEGRAM_ALLOWED_USER_IDS: '123',
      },
      now: () => new Date('2026-06-02T12:00:00.000Z'),
    }).buildSnapshot();
    const telegram = snapshot.items.find((item) => item.id === 'telegram');

    expect(telegram).toMatchObject({
      status: 'configured_pending_proof',
      canRunLiveProof: true,
      safeDefaultRoute: false,
    });
    expect(JSON.stringify(snapshot)).not.toContain('redacted-test-token');
  });
});
