import { ZavorthE2EHarness } from '../../src/testing/e2e/ZavorthE2EHarness.js';

describe('MultiChannelAgentE2E', () => {
  let harness: ZavorthE2EHarness;

  beforeAll(() => {
    harness = new ZavorthE2EHarness({ enableScheduler: true });
  });

  afterAll(() => {
    harness.dispose();
  });

  it('should process user requests across Telegram, Discord, and Slack', async () => {
    // 1. Telegram turn
    const tgResponse = await harness.sendMessage('telegram', 'Hello agent from Telegram!');
    expect(tgResponse.channel).toBe('telegram');
    expect(tgResponse.text).toContain('Processed request: "Hello agent from Telegram!"');

    // 2. Discord turn
    const discordResponse = await harness.sendMessage('discord', 'Hello agent from Discord!');
    expect(discordResponse.channel).toBe('discord');
    expect(discordResponse.text).toContain('Processed request: "Hello agent from Discord!"');

    // 3. Slack turn with plugin query
    const slackResponse = await harness.sendMessage('slack', '/plugin list');
    expect(slackResponse.channel).toBe('slack');
    expect(slackResponse.text).toContain('Active plugins count:');
    expect(slackResponse.toolCalls?.length).toBeGreaterThan(0);
    expect(slackResponse.toolCalls?.[0].name).toBe('zavorth_plugin_sdk');

    // 4. Verify stream events recorded
    const streamEvents = harness.gateway.getStreamEvents();
    expect(streamEvents.length).toBeGreaterThanOrEqual(3);
  });
});
