import { OracleCloudflareRolloutService } from '../../src/services/OracleCloudflareRolloutService';

describe('OracleCloudflareRolloutService', () => {
  it('reports rollout ready when Oracle templates, Gemini and Cloudflare are configured', () => {
    const service = new OracleCloudflareRolloutService({
      projectRoot: 'C:/tmp/zavorth',
      existsSync: () => true,
      llmProvider: 'gemini',
      geminiCredentialReady: true,
      cloudflareAiGatewayEnabled: true,
      cloudflareAiGatewayAccountId: 'acct',
      cloudflareAiGatewayId: 'gw',
      cloudflareTunnelPublicHostname: 'zavorth.example.com',
      gemmaModel: 'gemma-4-31b-it',
      now: () => new Date('2026-04-02T21:00:00.000Z'),
    });

    const snapshot = service.inspect();

    expect(snapshot.readyForRemoteRollout).toBe(true);
    expect(snapshot.summary).toContain('pronta para rollout');
    expect(snapshot.steps.every((step) => step.id === 'validate-runtime' || step.status === 'done')).toBe(true);
  });

  it('reports the next missing step when gateway and tunnel are not configured', () => {
    const service = new OracleCloudflareRolloutService({
      projectRoot: 'C:/tmp/zavorth',
      existsSync: () => true,
      llmProvider: 'gemini',
      geminiCredentialReady: true,
      cloudflareAiGatewayEnabled: false,
      cloudflareAiGatewayAccountId: '',
      cloudflareAiGatewayId: '',
      cloudflareTunnelPublicHostname: '',
      publicBaseUrl: '',
      gemmaModel: 'gemma-4-31b-it',
    });

    const snapshot = service.inspect();

    expect(snapshot.readyForRemoteRollout).toBe(false);
    expect(snapshot.summary).toContain('CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID');
    expect(snapshot.steps.find((step) => step.id === 'cloudflare-ai-gateway')?.status).toBe('pending');
    expect(snapshot.steps.find((step) => step.id === 'cloudflare-tunnel')?.status).toBe('pending');
  });
});
