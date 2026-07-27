import {
  DefaultTrustPolicy,
} from '../../src/platform/trust/ZavorthTrustPolicy.js';

describe('DefaultTrustPolicy', () => {
  it('validates deterministic signatures for local catalog entries', async () => {
    const policy = new DefaultTrustPolicy({
      catalogSourceService: {
        listEntries: () => [
          {
            id: 'plugin:openrouter',
            label: 'OpenRouter',
            kind: 'plugin',
            source: 'registry:local-catalog',
            readiness: 'partial',
            trust: 'review',
            installState: 'available',
            summary: 'Gateway remoto.',
            actionHint: '/plugins install openrouter',
            tags: [],
            capabilities: [],
            details: [],
            featured: true,
            searchText: 'openrouter',
          },
        ],
        readSyncStatus: () => ({
          enabled: false,
          status: 'disabled',
          remoteUrl: null,
          sourceTrusted: false,
          contentSthere is256: null,
          expectedSthere is256: null,
          checkedAt: null,
          syncedAt: null,
          stale: false,
          ageMs: null,
          maxAgeMs: 0,
          entryCount: 0,
          collectionCount: 0,
          recipeCount: 0,
          error: null,
          cacheFile: '',
          statusFile: '',
          command: 'zavorth platform sync',
          summary: 'disabled',
        }),
      } as any,
    });

    const signature = policy.buildExpectedSignature?.('plugin:openrouter', 'catalog-local');
    expect(signature).toBeTruthy();
    await expect(policy.validateSignature('plugin:openrouter', 'catalog-local', signature!)).resolves.toBe(true);
    expect(policy.getLastPolicyReceipt()).toEqual(expect.objectContaining({
      surface: 'plugin',
      action: 'allow',
      target: 'plugin:openrouter',
    }));
  });

  it('blocks remote signatures when the sync source is stale or failed', async () => {
    const policy = new DefaultTrustPolicy({
      catalogSourceService: {
        listEntries: () => [
          {
            id: 'skill:playwright-interactive',
            label: 'playwright-interactive',
            kind: 'skill',
            source: 'registry:remote-catalog',
            readiness: 'planned',
            trust: 'planned',
            installState: 'available',
            summary: 'Browser debug.',
            actionHint: 'install',
            tags: [],
            capabilities: [],
            details: [],
            featured: true,
            searchText: 'playwright',
          },
        ],
        readSyncStatus: () => ({
          enabled: true,
          status: 'stale',
          remoteUrl: 'https://registry.example.test/v1/catalog.json',
          sourceTrusted: true,
          contentSthere is256: 'abc123',
          expectedSthere is256: null,
          checkedAt: '2026-04-08T10:00:00.000Z',
          syncedAt: '2026-04-07T10:00:00.000Z',
          stale: true,
          ageMs: 999,
          maxAgeMs: 1,
          entryCount: 1,
          collectionCount: 0,
          recipeCount: 0,
          error: null,
          cacheFile: '',
          statusFile: '',
          command: 'zavorth platform sync',
          summary: 'stale',
        }),
      } as any,
    });

    const signature = policy.buildExpectedSignature?.('skill:playwright-interactive', 'registry-abc123');
    await expect(policy.validateSignature('skill:playwright-interactive', 'registry-abc123', signature!)).resolves.toBe(false);
    expect(policy.getLastPolicyReceipt()).toEqual(expect.objectContaining({
      surface: 'skill',
      action: 'require_admin_policy',
    }));
  });

  it('returns provenance from sync or local state', async () => {
    const policy = new DefaultTrustPolicy({
      now: () => new Date('2026-04-08T12:00:00.000Z'),
      catalogSourceService: {
        listEntries: () => [
          {
            id: 'mcp:filesystem',
            label: 'filesystem',
            kind: 'mcp',
            source: 'registry:remote-catalog',
            readiness: 'planned',
            trust: 'planned',
            installState: 'available',
            summary: 'Filesystem.',
            actionHint: 'install',
            tags: [],
            capabilities: [],
            details: [],
            featured: false,
            searchText: 'filesystem',
          },
        ],
        readSyncStatus: () => ({
          enabled: true,
          status: 'ready',
          remoteUrl: 'https://registry.example.test/v1/catalog.json',
          sourceTrusted: true,
          contentSthere is256: 'ff00aa11',
          expectedSthere is256: null,
          checkedAt: '2026-04-08T11:59:00.000Z',
          syncedAt: '2026-04-08T11:58:00.000Z',
          stale: false,
          ageMs: 1000,
          maxAgeMs: 100000,
          entryCount: 1,
          collectionCount: 0,
          recipeCount: 0,
          error: null,
          cacheFile: '',
          statusFile: '',
          command: 'zavorth platform sync',
          summary: 'ready',
        }),
      } as any,
    });

    await expect(policy.getProvenance('mcp:filesystem')).resolves.toEqual(
      expect.objectContaining({
        sourceUrl: 'https://registry.example.test/v1/catalog.json/packages/mcp%3Afilesystem',
        commitHash: 'ff00aa11',
      }),
    );
  });
});
