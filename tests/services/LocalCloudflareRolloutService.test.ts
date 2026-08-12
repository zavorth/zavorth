import { LocalCloudflareRolloutService } from '../../src/services/LocalCloudflareRolloutService';

describe('LocalCloudflareRolloutService', () => {
  it('reports plan B ready when launcher, startup, Gemini and Cloudflare are configured', () => {
    const service = new LocalCloudflareRolloutService({
      projectRoot: 'C:/tmp/zavorth',
      existsSync: () => true,
      llmProvider: 'gemini',
      geminiCredentialReady: true,
      cloudflareAiGatewayEnabled: true,
      cloudflareAiGatewayAccountId: 'acct',
      cloudflareAiGatewayId: 'gw',
      cloudflareTunnelPublicHostname: 'zavorth.example.com',
      gemmaModel: 'gemma-2-27b-it',
      now: () => new Date('2026-04-02T22:30:00.000Z'),
    });

    const snapshot = service.inspect();

    expect(snapshot.readyForPlanB).toBe(true);
    expect(snapshot.summary).toContain('pronto para rollout');
    expect(snapshot.summary).toContain('gateway-first');
    expect(snapshot.steps.every((step) => step.id === 'validate-runtime' || step.status === 'done')).toBe(true);
    expect(snapshot.steps.find((step) => step.id === 'startup-installer')?.title).toContain('opcional');
  });

  it('reports the next missing step when Gemini credentials and tunnel are missing', () => {
    const service = new LocalCloudflareRolloutService({
      projectRoot: 'C:/tmp/zavorth',
      existsSync: () => true,
      llmProvider: 'gemini',
      geminiCredentialReady: false,
      cloudflareAiGatewayEnabled: false,
      cloudflareAiGatewayAccountId: '',
      cloudflareAiGatewayId: '',
      cloudflareTunnelPublicHostname: '',
      publicBaseUrl: '',
      gemmaModel: 'gemma-2-27b-it',
    });

    const snapshot = service.inspect();

    expect(snapshot.readyForPlanB).toBe(false);
    expect(snapshot.summary).toContain('GEMINI_API_KEY');
    expect(snapshot.steps.find((step) => step.id === 'gemini-credential')?.status).toBe('pending');
    expect(snapshot.steps.find((step) => step.id === 'cloudflare-tunnel')?.status).toBe('pending');
  });
});
