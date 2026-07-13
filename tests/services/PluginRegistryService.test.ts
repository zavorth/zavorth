import type { ZavorthPluginManifest } from '../../src/contracts/PluginManifestContract.js';
import { ZAVORTH_PLUGIN_OS_API_VERSION } from '../../src/contracts/PluginManifestContract.js';
import { PluginRegistryService } from '../../src/services/PluginRegistryService.js';
import { PluginSandboxPolicyService } from '../../src/services/PluginSandboxPolicyService.js';

const baseManifest = (overrides: Partial<ZavorthPluginManifest> = {}): ZavorthPluginManifest => ({
  schemaVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
  id: 'search-searxng',
  label: 'SearxNG Search',
  version: '1.0.0',
  moduleKind: 'search',
  summary: 'Self-hosted search connector.',
  description: 'Routes search.query through a governed SearxNG adapter.',
  tags: ['search', 'provider'],
  source: {
    kind: 'registry',
    locator: 'registry://zavorth/search-searxng',
    digest: 'sha256:demo',
    trusted: false,
  },
  compatibility: {
    zavorthVersion: '>=1.1.0',
    pluginApiVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
  },
  capabilities: [
    {
      id: 'search.query',
      intent: 'web_search',
      label: 'Search Query',
      summary: 'Runs a policy-gated search query.',
      artifactKinds: ['search.result'],
      command: {
        name: 'search',
        aliases: ['find'],
        usage: '<query>',
      },
    },
  ],
  permissions: [
    {
      kind: 'network.external',
      scope: 'external',
      reason: 'Search provider calls external HTTP endpoints.',
      required: true,
    },
    {
      kind: 'artifact.write',
      scope: 'workspace',
      reason: 'Search results are stored as artifacts.',
      required: true,
    },
  ],
  entrypoint: {
    module: 'dist/modules/search-searxng.js',
    exportName: 'createSearchPlugin',
    runtime: 'node',
  },
  lifecycle: {
    actions: ['install', 'enable', 'disable', 'uninstall', 'invoke', 'doctor', 'upgrade'],
    defaultAction: 'invoke',
  },
  policy: {
    defaultTrust: 'review',
    requiresApproval: false,
    allowNetworkByDefault: false,
    allowFilesystemWriteByDefault: false,
    allowProcessSpawnByDefault: false,
    sandboxProfile: 'restricted',
  },
  artifactKinds: ['search.result'],
  receiptKinds: ['plugin.invocation', 'search.query.receipt'],
  ...overrides,
});

describe('Plugin OS Preview engine', () => {
  it('registers a manifest and exposes lifecycle state in the registry snapshot', () => {
    const service = new PluginRegistryService({
      now: () => new Date('2026-05-04T12:00:00.000Z'),
      manifests: [baseManifest()],
    });

    expect(service.buildSnapshot()).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          total: 1,
          installed: 0,
          enabled: 0,
          capabilities: 1,
        }),
      }),
    );

    const blockedInstall = service.install('search-searxng');
    expect(blockedInstall.status).toBe('approval_required');
    expect(blockedInstall.decision.requiredApprovals).toContain('external network permission requires approval');

    const install = service.install('search-searxng', { approved: true });
    const enable = service.enable('search-searxng', { approved: true });

    expect(install.status).toBe('applied');
    expect(enable.status).toBe('applied');
    expect(service.buildSnapshot().summary).toEqual(
      expect.objectContaining({
        installed: 1,
        enabled: 1,
      }),
    );
  });

  it('requires approval for sensitive invocation and then executes through an injected handler', async () => {
    const service = new PluginRegistryService({
      now: () => new Date('2026-05-04T12:10:00.000Z'),
      manifests: [baseManifest()],
      handlers: {
        'search-searxng': async (request, plan) => ({
          query: request.input?.query,
          capabilityId: plan.capabilityId,
          source: 'handler',
        }),
      },
    });

    service.install('search-searxng', { approved: true });
    service.enable('search-searxng', { approved: true });

    const approvalRequired = await service.invoke({
      pluginId: 'search-searxng',
      capabilityId: 'search.query',
      input: {
        query: 'zavorth',
      },
    });
    expect(approvalRequired.status).toBe('approval_required');

    const executed = await service.invoke({
      pluginId: 'search-searxng',
      capabilityId: 'search.query',
      approved: true,
      input: {
        query: 'zavorth',
      },
    });
    expect(executed.status).toBe('executed');
    expect(executed.output).toEqual(
      expect.objectContaining({
        query: 'zavorth',
        capabilityId: 'search.query',
      }),
    );
    expect(executed.receipt.decision.status).toBe('allow');
  });

  it('blocks system-scope permissions before runtime handler execution', async () => {
    const service = new PluginRegistryService({
      now: () => new Date('2026-05-04T12:20:00.000Z'),
      manifests: [
        baseManifest({
          id: 'unsafe-shell',
          moduleKind: 'tool',
          permissions: [
            {
              kind: 'process.spawn',
              scope: 'system',
              reason: 'Attempts to spawn unrestricted system processes.',
              required: true,
            },
          ],
          policy: {
            defaultTrust: 'trusted',
            requiresApproval: false,
            allowNetworkByDefault: false,
            allowFilesystemWriteByDefault: false,
            allowProcessSpawnByDefault: true,
            sandboxProfile: 'local-exec',
          },
        }),
      ],
      handlers: {
        'unsafe-shell': () => {
          throw new Error('handler should not run');
        },
      },
    });

    const result = await service.invoke({
      pluginId: 'unsafe-shell',
      capabilityId: 'search.query',
      approved: true,
    });

    expect(result.status).toBe('blocked');
    expect(result.receipt.decision.reasons).toContain('process.spawn requested system scope');
  });

  it('registerHandler and hasHandler wire runtime handlers after construction', async () => {
    const service = new PluginRegistryService({
      now: () => new Date('2026-05-04T12:25:00.000Z'),
      manifests: [baseManifest()],
    });

    service.install('search-searxng', { approved: true });
    service.enable('search-searxng', { approved: true });

    expect(service.hasHandler('search-searxng')).toBe(false);

    service.registerHandler('search-searxng', async (request) => ({
      query: request.input?.query,
      source: 'late-handler',
    }));

    expect(service.hasHandler('search-searxng')).toBe(true);

    const executed = await service.invoke({
      pluginId: 'search-searxng',
      capabilityId: 'search.query',
      approved: true,
      input: { query: 'late' },
    });

    expect(executed.status).toBe('executed');
    expect(executed.output).toEqual(
      expect.objectContaining({
        query: 'late',
        source: 'late-handler',
      }),
    );
  });

  it('evaluates sandbox decisions independently from registry state', () => {
    const decision = new PluginSandboxPolicyService({
      now: () => new Date('2026-05-04T12:30:00.000Z'),
    }).evaluate({
      manifest: baseManifest({
        policy: {
          defaultTrust: 'blocked',
          requiresApproval: false,
          allowNetworkByDefault: true,
          allowFilesystemWriteByDefault: false,
          allowProcessSpawnByDefault: false,
          sandboxProfile: 'networked',
        },
      }),
      action: 'invoke',
      approved: true,
    });

    expect(decision.status).toBe('blocked');
    expect(decision.trust).toBe('blocked');
    expect(decision.reasons).toContain('plugin trust is blocked');
  });
});
