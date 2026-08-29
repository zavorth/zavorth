import {
  ConnectionTargetResolver,
  type ConnectionPluginRegistryPort,
  type ConnectionMcpClientPort,
} from '../../../src/services/connection/ConnectionTargetResolver.js';
import type { PluginConnectionDescriptor } from '../../../src/contracts/connection/index.js';

describe('ConnectionTargetResolver', () => {
  const mockStripeConnection: PluginConnectionDescriptor = {
    authType: 'api_key',
    usePkce: false,
    apiKey: {
      label: 'Stripe Secret Key',
      placeholder: 'sk_live_...',
      helpUrl: 'https://stripe.com/docs/keys',
    },
  };

  const mockObsidianConnection: PluginConnectionDescriptor = {
    authType: 'local_path',
    usePkce: false,
    localPath: {
      kind: 'directory',
      label: 'Obsidian Vault',
      expectedMarker: '.obsidian',
    },
  };

  const mockPluginRegistry: ConnectionPluginRegistryPort = {
    listEntries: () => [
      {
        manifest: {
          id: 'stripe',
          label: 'Stripe Payments',
          connection: mockStripeConnection,
        },
      },
      {
        manifest: {
          id: 'obsidian',
          label: 'Obsidian Vault',
          connection: mockObsidianConnection,
        },
      },
      {
        manifest: {
          id: 'no-conn-plugin',
          label: 'Plugin Without Connection',
        },
      },
    ],
  };

  const mockMcpClient: ConnectionMcpClientPort = {
    listServers: () => [
      {
        id: 'filesystem',
        name: 'Local Filesystem MCP',
        transport: 'stdio',
      },
      {
        id: 'postgres-mcp',
        name: 'PostgreSQL Database MCP',
        transport: 'stdio',
      },
    ],
  };

  it('resolves plugin manifest target by id with highest priority', async () => {
    const resolver = new ConnectionTargetResolver({
      pluginRegistry: mockPluginRegistry,
      mcpClient: mockMcpClient,
    });

    const res = await resolver.resolve('stripe');

    expect(res.source).toBe('manifest');
    expect(res.descriptor).toBeDefined();
    expect(res.descriptor?.authType).toBe('api_key');
    expect(res.descriptor?.apiKey?.label).toBe('Stripe Secret Key');
    expect(res.cardDescriptor?.targetId).toBe('stripe');
    expect(res.cardDescriptor?.displayName).toBe('Stripe Payments');
    expect(res.cardDescriptor?.status).toBe('disconnected');
    expect(res.error).toBeUndefined();
  });

  it('resolves plugin manifest target by label (case-insensitive with trimming)', async () => {
    const resolver = new ConnectionTargetResolver({
      pluginRegistry: mockPluginRegistry,
    });

    const res = await resolver.resolve('  STRIPE PAYMENTS  ');

    expect(res.source).toBe('manifest');
    expect(res.descriptor?.authType).toBe('api_key');
    expect(res.cardDescriptor?.targetId).toBe('stripe');
  });

  it('skips plugins without connection descriptors', async () => {
    const resolver = new ConnectionTargetResolver({
      pluginRegistry: mockPluginRegistry,
    });

    const res = await resolver.resolve('no-conn-plugin');

    expect(res.source).toBe('unknown');
    expect(res.error).toContain("Target 'no-conn-plugin' is not recognized");
  });

  it('resolves built-in OAuth providers (GitHub device code flow)', async () => {
    const resolver = new ConnectionTargetResolver({
      pluginRegistry: mockPluginRegistry,
    });

    const res = await resolver.resolve('github');

    expect(res.source).toBe('builtin-oauth');
    expect(res.descriptor).toBeDefined();
    expect(res.descriptor?.authType).toBe('oauth2');
    expect(res.descriptor?.oauth?.supportsDeviceCode).toBe(true);
    expect(res.descriptor?.oauth?.tokenUrl).toContain('github.com');
    expect(res.cardDescriptor?.displayName).toBe('GitHub');
    expect(res.cardDescriptor?.icon).toBe('github');
  });

  it('resolves built-in OAuth providers with PKCE (Claude)', async () => {
    const resolver = new ConnectionTargetResolver({
      pluginRegistry: mockPluginRegistry,
    });

    const res = await resolver.resolve('claude');

    expect(res.source).toBe('builtin-oauth');
    expect(res.descriptor?.authType).toBe('oauth2');
    expect(res.descriptor?.usePkce).toBe(true);
    expect(res.descriptor?.oauth?.authorizationUrl).toContain('claude.ai');
    expect(res.cardDescriptor?.displayName).toBe('Claude (Anthropic)');
  });

  it('resolves MCP server by id when no plugin or oauth provider matches', async () => {
    const resolver = new ConnectionTargetResolver({
      pluginRegistry: mockPluginRegistry,
      mcpClient: mockMcpClient,
    });

    const res = await resolver.resolve('filesystem');

    expect(res.source).toBe('mcp-server');
    expect(res.descriptor?.authType).toBe('custom');
    expect(res.cardDescriptor?.targetId).toBe('filesystem');
    expect(res.cardDescriptor?.displayName).toBe('Local Filesystem MCP');
  });

  it('resolves MCP server by name', async () => {
    const resolver = new ConnectionTargetResolver({
      pluginRegistry: mockPluginRegistry,
      mcpClient: mockMcpClient,
    });

    const res = await resolver.resolve('PostgreSQL Database MCP');

    expect(res.source).toBe('mcp-server');
    expect(res.cardDescriptor?.targetId).toBe('postgres-mcp');
  });

  it('returns deterministic error for completely unknown targets', async () => {
    const resolver = new ConnectionTargetResolver({
      pluginRegistry: mockPluginRegistry,
      mcpClient: mockMcpClient,
    });

    const res = await resolver.resolve('unsupported-xyz-service');

    expect(res.source).toBe('unknown');
    expect(res.descriptor).toBeUndefined();
    expect(res.error).toBe("Target 'unsupported-xyz-service' is not recognized. Use /connections catalog to view supported targets.");
  });

  it('handles empty, null, or whitespace target input gracefully', async () => {
    const resolver = new ConnectionTargetResolver({
      pluginRegistry: mockPluginRegistry,
    });

    const res = await resolver.resolve('   ');

    expect(res.source).toBe('unknown');
    expect(res.error).toContain("Target '' is not recognized");
  });

  it('lists all supported targets across all categories in alphabetical order', () => {
    const resolver = new ConnectionTargetResolver({
      pluginRegistry: mockPluginRegistry,
      mcpClient: mockMcpClient,
    });

    const targets = resolver.listSupportedTargets();

    expect(targets).toContain('stripe');
    expect(targets).toContain('obsidian');
    expect(targets).not.toContain('no-conn-plugin');
    expect(targets).toContain('github');
    expect(targets).toContain('claude');
    expect(targets).toContain('filesystem');
    expect(targets).toContain('postgres-mcp');

    // Check sorted order
    const sorted = [...targets].sort();
    expect(targets).toEqual(sorted);
  });
});
