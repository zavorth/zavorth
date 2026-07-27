import { createRuntimeRefresh } from '../../apps/zavorth-control-vite-shell/src/runtime-refresh';

describe('runtime channel refresh', () => {
  it('loads the canonical channel endpoint only after protected runtime access succeeds', async () => {
    const state: Record<string, any> = {};
    const channelSnapshot = {
      generatedAt: '2026-07-16T12:00:00.000Z',
      summary: { total: 34 },
      entries: [{ id: 'web', readiness: 'ready', configured: true }],
    };
    const readJson = jest.fn(async (path: string) => {
      if (path === '/api/auth/status') return { authenticated: true };
      if (path.startsWith('/api/web/zavorthControl')) return { live: true, authRequired: false, snapshot: {} };
      if (path === '/api/web/channels') return { ok: true, channels: channelSnapshot };
      return null;
    });
    const refresh = createRuntimeRefresh({
      applyRuntimeData: jest.fn(),
      authHeaders: () => ({ 'X-Zavorth-Token': 'test-token' }),
      buildZavorthControlQueryString: () => '',
      connectRealtime: jest.fn(),
      fetchCurrentArtifacts: jest.fn(async () => null),
      fetchDashboardEvents: jest.fn(async () => null),
      hasStoredToken: () => true,
      hydrateCurrentSession: jest.fn(async () => null),
      readJson,
      readSessionId: () => '',
      readToken: () => 'test-token',
      readRunId: () => '',
      state,
      updatePulse: jest.fn(),
      writeRunId: jest.fn(),
    });

    await refresh({ skipRealtime: true, skipSessionHydrate: true });

    expect(readJson).toHaveBeenCalledWith('/api/web/channels', expect.objectContaining({
      headers: { 'X-Zavorth-Token': 'test-token' },
    }));
    expect(state.channelMesh).toBe(channelSnapshot);
  });

  it('does not request the channel catalog before the runtime is unlocked', async () => {
    const state: Record<string, any> = {};
    const readJson = jest.fn(async (path: string) => {
      if (path === '/api/auth/status') return { authenticated: false };
      return null;
    });
    const refresh = createRuntimeRefresh({
      applyRuntimeData: jest.fn(),
      authHeaders: () => ({}),
      buildZavorthControlQueryString: () => '',
      connectRealtime: jest.fn(),
      fetchCurrentArtifacts: jest.fn(async () => null),
      fetchDashboardEvents: jest.fn(async () => null),
      hasStoredToken: () => false,
      hydrateCurrentSession: jest.fn(async () => null),
      readJson,
      readSessionId: () => '',
      readToken: () => '',
      readRunId: () => '',
      state,
      updatePulse: jest.fn(),
      writeRunId: jest.fn(),
    });

    await refresh({ skipRealtime: true, skipSessionHydrate: true });

    expect(readJson).not.toHaveBeenCalledWith('/api/web/channels', expect.anything());
    expect(state.channelMesh).toBeNull();
  });
});
