import {
  isProfileAlwaysExpose,
  resolveMaxExposedTools,
  resolveExposureProfileName,
  isDestructiveExposureTool,
} from '../../src/runtime/agent/tools/ToolExposureProfile.js';

describe('Conversational tool exposure profile', () => {
  it('defaults env-style daily-ops to a lean max cap', () => {
    expect(resolveExposureProfileName({ envValue: 'daily-ops' })).toBe('daily-ops');
    expect(resolveMaxExposedTools('daily-ops')).toBeLessThanOrEqual(18);
    expect(resolveMaxExposedTools('safe')).toBeLessThanOrEqual(12);
    expect(resolveMaxExposedTools('full')).toBeLessThanOrEqual(40);
  });

  it('never auto-exposes destructive tools via profile always-include', () => {
    expect(isDestructiveExposureTool('remote_shell')).toBe(true);
    expect(isProfileAlwaysExpose('daily-ops', 'remote_shell')).toBe(false);
    expect(isProfileAlwaysExpose('daily-ops', 'plugin_suggest')).toBe(true);
    expect(isProfileAlwaysExpose('daily-ops', 'search_query')).toBe(true);
    expect(isProfileAlwaysExpose('daily-ops', 'doctor_run')).toBe(true);
  });

  it('keeps marketplace bulk tools off the daily hot path by default', () => {
    expect(isProfileAlwaysExpose('daily-ops', 'zavorth_skill_marketplace')).toBe(false);
    expect(isProfileAlwaysExpose('full', 'zavorth_skill_marketplace')).toBe(true);
  });
});
