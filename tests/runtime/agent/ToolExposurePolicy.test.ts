import { ToolExposurePolicy } from '../../../src/runtime/agent/ToolExposurePolicy.js';

describe('ToolExposurePolicy', () => {
  it('keeps Cognitive Firewall quarantined tools blocked in the universal exposure profile', () => {
    const policy = new ToolExposurePolicy();

    const profile = policy.buildProfile({
      toolHintProfile: {
        intentCategory: 'full_toolset',
        groups: ['all'],
        recommendedToolNames: ['read_file', 'plugin_send'],
        quarantinedToolNames: ['plugin_send'],
        toolExposureGatedByCognitiveFirewall: true,
        isHardGate: true,
        reason: 'plugin not trusted by operator',
      },
    });

    expect(profile.tools.map((tool) => tool.id)).toEqual(['read_file']);
    expect(profile.blockedTools).toEqual([
      expect.objectContaining({
        id: 'plugin_send',
        reason: 'blocked-by-cognitive-firewall-plugin-quarantine',
      }),
    ]);
    expect(profile.toolExposureGatedByCognitiveFirewall).toBe(true);
    expect(profile.toolExposureGatedByImportedCapabilityTrust).toBeUndefined();
    expect(profile.summary).toContain('1 ferramenta bloqueada');
  });
});
