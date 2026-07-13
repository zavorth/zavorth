import {
  ZAVORTH_SURFACE_AGENT_CONTRACT_VERSION,
  ZAVORTH_SURFACE_AGENT_GATES,
  ZAVORTH_SURFACE_AGENT_CANONICAL_PLATFORMS,
  normalizeSurfaceAgentPlatform,
  formatSurfaceAgentContractPitch,
} from '../../src/contracts/surface/SurfaceAgentContract.js';

describe('SurfaceAgentContract', () => {
  it('exposes stable version and gate ids', () => {
    expect(ZAVORTH_SURFACE_AGENT_CONTRACT_VERSION).toMatch(/surface-agent-contracts/);
    expect(ZAVORTH_SURFACE_AGENT_GATES.power).toBe('C1_POWER_ACTION');
    expect(ZAVORTH_SURFACE_AGENT_GATES.trust).toBe('C2_HIGH_RISK');
    expect(ZAVORTH_SURFACE_AGENT_GATES.extend).toBe('C3_SKILL_INSTALL');
  });

  it('lists multi-surface platforms without a primary channel', () => {
    expect(ZAVORTH_SURFACE_AGENT_CANONICAL_PLATFORMS).toEqual(
      expect.arrayContaining(['telegram', 'desktop', 'control', 'cli', 'discord', 'web', 'api']),
    );
    expect(ZAVORTH_SURFACE_AGENT_CANONICAL_PLATFORMS[0]).not.toBe('telegram-only');
  });

  it('normalizes aliases to canonical platforms', () => {
    expect(normalizeSurfaceAgentPlatform('ZavorthControl')).toBe('control');
    expect(normalizeSurfaceAgentPlatform('desktop-app')).toBe('desktop');
    expect(normalizeSurfaceAgentPlatform('command-line')).toBe('cli');
    expect(normalizeSurfaceAgentPlatform('future-channel-x')).toBe('future-channel-x');
  });

  it('pitch states no surface is product-primary', () => {
    const pitch = formatSurfaceAgentContractPitch();
    expect(pitch).toMatch(/No surface is product-primary/i);
    expect(pitch).toMatch(/C1/);
    expect(pitch).toMatch(/C2/);
    expect(pitch).toMatch(/C3/);
  });
});
