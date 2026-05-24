import { validateZavorthChannelLive } from '../../../src/cli/setup-studio/ZavorthChannelLiveValidationService.js';

describe('ZavorthChannelLiveValidationService', () => {
  it('does not run network tests without explicit consent', async () => {
    const result = await validateZavorthChannelLive({
      channelId: 'telegram',
      token: 'telegram-secret-token',
      explicitUserConsent: false,
    });

    expect(result.status).toBe('not-requested');
    expect(result.safety.networkCallPerformed).toBe(false);
    expect(result.safety.noMessageSent).toBe(true);
    expect(result.message).not.toContain('telegram-secret-token');
  });

  it('fails safely when a configured channel is missing credentials', async () => {
    const result = await validateZavorthChannelLive({
      channelId: 'slack',
      explicitUserConsent: true,
    });

    expect(result.status).toBe('failed');
    expect(result.safety.noMessageSent).toBe(true);
    expect(result.safety.rawSecretInOutput).toBe(false);
    expect(result.message).toContain('Slack token is required');
  });

  it('reports unsupported channels without making a network call', async () => {
    const result = await validateZavorthChannelLive({
      channelId: 'signal',
      explicitUserConsent: true,
    });

    expect(result.status).toBe('unsupported');
    expect(result.safety.networkCallPerformed).toBe(false);
  });
});
