import { ToolExposurePolicy } from '../../../src/runtime/agent/ToolExposurePolicy';

describe('ChannelToolExecutionPolicy', () => {
  let policy: ToolExposurePolicy;

  beforeEach(() => {
    policy = new ToolExposurePolicy();
  });

  it('narrows tools when channelUserIdAllowed is false and group policy is safe-only', () => {
    const profile = policy.buildProfile({
      requestedTools: ['read_file', 'network_fetch', 'bash'],
      metadata: {
        channelUserIdAllowed: false,
        groupToolPolicy: {
          untrustedUserMode: 'safe-only',
        },
      },
    });

    expect(profile.tools.map((tool) => tool.id)).toEqual(['read_file']);
    expect(profile.mode).toBe('safe');
    expect(profile.blockedTools).toBeDefined();
    expect(profile.blockedTools).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'network_fetch', reason: 'unauthorized-user-in-group' }),
      expect.objectContaining({ id: 'bash', reason: 'unauthorized-user-in-group' }),
    ]));
  });
});
