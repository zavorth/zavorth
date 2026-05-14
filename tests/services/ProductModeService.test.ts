import {
  buildZavorthProductModeSnapshot,
  inferZavorthProductModeFromProfile,
  normalizeZavorthProductMode,
  resolveDefaultRuntimeProfileForProductMode,
} from '../../src/services/ProductModeService';

describe('ProductModeService', () => {
  it('maps product modes to the expected runtime defaults', () => {
    expect(resolveDefaultRuntimeProfileForProductMode('chat')).toBe('core');
    expect(resolveDefaultRuntimeProfileForProductMode('assistant')).toBe('core');
    expect(resolveDefaultRuntimeProfileForProductMode('builder')).toBe('core');
    expect(resolveDefaultRuntimeProfileForProductMode('operator')).toBe('ops');
  });

  it('infers a sensible mode from the current runtime profile', () => {
    expect(inferZavorthProductModeFromProfile('core')).toBe('builder');
    expect(inferZavorthProductModeFromProfile('ops')).toBe('operator');
    expect(inferZavorthProductModeFromProfile('full')).toBe('operator');
  });

  it('builds an aligned snapshot for builder mode on core', () => {
    const snapshot = buildZavorthProductModeSnapshot('builder', 'core');

    expect(snapshot).toMatchObject({
      id: 'builder',
      defaultRuntimeProfile: 'core',
      runtimeProfile: 'core',
      profileAligned: true,
    });
    expect(snapshot.visibleSurfaces).toContain('tool-cards');
  });

  it('falls back to a profile-derived mode when the raw value is invalid', () => {
    expect(normalizeZavorthProductMode('banana', 'core')).toBe('builder');
    expect(normalizeZavorthProductMode('banana', 'ops')).toBe('operator');
  });
});
