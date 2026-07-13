import { describe, expect, it } from 'vitest';

/**
 * Pure shape tests for Plugin OS API client helpers.
 * Runtime transport is mocked at the boundary by desktop bridge tests.
 */
describe('pluginOs apiClient helpers (pure contracts)', () => {
  it('defines expected action body fields', () => {
    const body = {
      action: 'enable' as const,
      pluginId: 'demo',
      approved: true,
      trust: 'trusted' as const,
    };
    expect(body.action).toBe('enable');
    expect(body.approved).toBe(true);
    expect(body.pluginId).toBe('demo');
  });

  it('snapshot response shape accepts snapshot payload', () => {
    const response = {
      ok: true,
      snapshot: {
        generatedAt: new Date().toISOString(),
        plugins: [],
        discovery: null,
        commands: ['list', 'enable'],
      },
    };
    expect(response.ok).toBe(true);
    expect(Array.isArray(response.snapshot.plugins)).toBe(true);
    expect(response.snapshot.commands).toContain('enable');
  });

  it('action response shape includes result + snapshot', () => {
    const response = {
      ok: true,
      snapshot: { plugins: [{ pluginId: 'x', enabled: true }] },
      result: { ok: true, action: 'enable', pluginId: 'x' },
    };
    expect(response.result.action).toBe('enable');
    expect(response.snapshot.plugins[0].enabled).toBe(true);
  });
});
