import { ToolExposurePolicy } from '../../../src/runtime/agent/ToolExposurePolicy';

describe('ChannelToolExecutionPolicy', () => {
  let policy: ToolExposurePolicy;

  beforeEach(() => {
    policy = new ToolExposurePolicy();
  });

  it('deve retornar zero tools quando channelUserIdAllowed for false', () => {
    const profile = policy.buildProfile({
      requestedTools: ['read_file', 'network_fetch', 'bash'],
      metadata: {
        channelUserIdAllowed: false,
        groupToolPolicy: {
          untrustedUserMode: 'safe-only', // should be overridden to 'none'
        },
      },
    });

    expect(profile.tools).toHaveLength(0);
    expect(profile.mode).toBe('unknown'); // Mode resolved for 0 tools
    expect(profile.blockedTools).toBeDefined();
    expect(profile.blockedTools!.length).toBeGreaterThan(0);
  });
});
