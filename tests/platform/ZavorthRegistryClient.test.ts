import { ZavorthRegistryClient } from '../../src/platform/registry/ZavorthRegistryClient.js';

describe('ZavorthRegistryClient', () => {
  it('resolves package info from the merged platform catalog', async () => {
    const client = new ZavorthRegistryClient({
      trustPolicy: {
        validateSignature: jest.fn(async () => true),
        isPublisherTrusted: jest.fn(async () => true),
        getProvenance: jest.fn(async () => ({
          sourceUrl: 'zavorth://catalog/plugin:openrouter',
          verifiedAt: '2026-04-08T12:00:00.000Z',
        })),
        buildExpectedSignature: jest.fn(() => 'sha256:testsig'),
      },
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
          contentSha256: null,
          expectedSha256: null,
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
      platformActionService: {
        execute: jest.fn(async () => ({
          ok: true,
        })),
      } as any,
    });

    await expect(client.fetchPackageInfo('openrouter')).resolves.toEqual(
      expect.objectContaining({
        id: 'plugin:openrouter',
        kind: 'plugin',
        version: 'catalog-local',
        signature: 'sha256:testsig',
      }),
    );
  });

  it('delegates install to the platform action service after trust checks', async () => {
    const execute = jest.fn(async () => ({ ok: true, status: 'applied' }));
    const client = new ZavorthRegistryClient({
      trustPolicy: {
        validateSignature: jest.fn(async () => true),
        isPublisherTrusted: jest.fn(async () => true),
        getProvenance: jest.fn(async () => ({
          sourceUrl: 'zavorth://catalog/plugin:openrouter',
          verifiedAt: '2026-04-08T12:00:00.000Z',
        })),
        buildExpectedSignature: jest.fn(() => 'sha256:testsig'),
      },
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
          contentSha256: null,
          expectedSha256: null,
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
      platformActionService: { execute } as any,
    });

    await expect(client.install('plugin:openrouter')).resolves.toBe(true);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        entryId: 'plugin:openrouter',
        actionId: 'install',
        requestedBy: 'registry-client',
      }),
    );
  });
});
