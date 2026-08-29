import { ConnectionTokenRefreshService } from '../../../src/services/connection/ConnectionTokenRefreshService.js';
import { ConnectionStateStore, type StoredConnection } from '../../../src/services/connection/ConnectionStateStore.js';
import { ConnectionTargetResolver } from '../../../src/services/connection/ConnectionTargetResolver.js';
import type { PluginConnectionDescriptor } from '../../../src/contracts/connection/index.js';

describe('ConnectionTokenRefreshService', () => {
  let refreshService: ConnectionTokenRefreshService;
  let stateStore: ConnectionStateStore;
  let testUserId: string;

  beforeEach(() => {
    stateStore = ConnectionStateStore.getInstance();
    testUserId = `refresh-user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const mockDescriptor: PluginConnectionDescriptor = {
      authType: 'oauth2',
      usePkce: false,
      oauth: {
        tokenUrl: 'https://auth.example.com/oauth/token',
        scopes: [],
      },
    };

    const resolver = new ConnectionTargetResolver({
      pluginRegistry: {
        listEntries: () => [
          {
            manifest: {
              id: 'mock-oauth',
              label: 'Mock OAuth Service',
              connection: mockDescriptor,
            },
          },
        ],
      },
    });

    refreshService = new ConnectionTokenRefreshService({
      stateStore,
      resolver,
      refreshLeadTimeMs: 300000, // 5 min
    });
  });

  afterEach(async () => {
    refreshService.stopProactiveRefreshLoop();
    await stateStore.deleteConnection(testUserId, 'mock-oauth');
    await stateStore.deleteConnection(testUserId, 'api-key-service');
  });

  it('ignores non-oauth connections and non-expiring connections', async () => {
    const conn: StoredConnection = {
      userId: testUserId,
      targetId: 'api-key-service',
      displayName: 'API Key Service',
      authType: 'api_key',
      status: 'connected',
      connectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await stateStore.saveConnection(conn);

    const summary = await refreshService.checkAndRefreshAll(testUserId);
    expect(summary.checkedCount).toBe(0);
    expect(summary.refreshedCount).toBe(0);
  });

  it('skips oauth connections that are not yet expiring', async () => {
    const farFuture = new Date(Date.now() + 86400000).toISOString(); // 1 day future
    const secretRef = await stateStore.saveSecret('mock-oauth', 'mock_refresh_token');

    const conn: StoredConnection = {
      userId: testUserId,
      targetId: 'mock-oauth',
      displayName: 'Mock OAuth',
      authType: 'oauth2',
      status: 'connected',
      secretRef,
      refreshTokenRef: secretRef,
      expiresAt: farFuture,
      connectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await stateStore.saveConnection(conn);

    const summary = await refreshService.checkAndRefreshAll(testUserId);
    expect(summary.checkedCount).toBe(1);
    expect(summary.refreshedCount).toBe(0); // Not within 5 min window
  });

  it('marks health status as error if refresh fails', async () => {
    const nearExpiry = new Date(Date.now() + 60000).toISOString(); // 1 min future (within 5 min)
    const secretRef = await stateStore.saveSecret('mock-oauth', 'invalid_refresh_token');

    const conn: StoredConnection = {
      userId: testUserId,
      targetId: 'mock-oauth',
      displayName: 'Mock OAuth',
      authType: 'oauth2',
      status: 'connected',
      secretRef,
      refreshTokenRef: secretRef,
      expiresAt: nearExpiry,
      connectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await stateStore.saveConnection(conn);

    // Mock fetch to simulate failure
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'invalid_grant',
    }) as unknown as typeof fetch;

    try {
      const summary = await refreshService.checkAndRefreshAll(testUserId);
      expect(summary.checkedCount).toBe(1);
      expect(summary.failedCount).toBe(1);

      const updated = await stateStore.getConnection(testUserId, 'mock-oauth');
      expect(updated?.healthStatus).toBe('error');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('successfully refreshes token and updates expiresAt and healthStatus', async () => {
    const nearExpiry = new Date(Date.now() + 60000).toISOString();
    const secretRef = await stateStore.saveSecret('mock-oauth', 'valid_refresh_token');

    const conn: StoredConnection = {
      userId: testUserId,
      targetId: 'mock-oauth',
      displayName: 'Mock OAuth',
      authType: 'oauth2',
      status: 'connected',
      secretRef,
      refreshTokenRef: secretRef,
      expiresAt: nearExpiry,
      connectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await stateStore.saveConnection(conn);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'new_fresh_access_token_123',
        refresh_token: 'new_rotated_refresh_token_456',
        expires_in: 7200,
      }),
    }) as unknown as typeof fetch;

    try {
      const summary = await refreshService.checkAndRefreshAll(testUserId);
      expect(summary.checkedCount).toBe(1);
      expect(summary.refreshedCount).toBe(1);

      const updated = await stateStore.getConnection(testUserId, 'mock-oauth');
      expect(updated?.healthStatus).toBe('healthy');
      expect(new Date(updated?.expiresAt || '').getTime()).toBeGreaterThan(Date.now() + 7000 * 1000);

      const savedAccessToken = await stateStore.getSecret(updated?.secretRef || '');
      expect(savedAccessToken).toBe('new_fresh_access_token_123');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('starts and stops proactive loop cleanly', () => {
    refreshService.startProactiveRefreshLoop(5000);
    refreshService.stopProactiveRefreshLoop();
  });
});
