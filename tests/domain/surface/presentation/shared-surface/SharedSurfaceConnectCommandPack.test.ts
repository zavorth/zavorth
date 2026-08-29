import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { IMessageContext } from '../../../../../src/contracts/IMessageBroker.js';
import { SharedSurfaceConnectCommandPack } from '../../../../../src/domain/surface/presentation/shared-surface/SharedSurfaceConnectCommandPack.js';
import {
  ConnectionTargetResolver,
  type ConnectionPluginRegistryPort,
} from '../../../../../src/services/connection/ConnectionTargetResolver.js';
import { ConnectionVerificationService } from '../../../../../src/services/connection/ConnectionVerificationService.js';
import { ConnectionStateStore } from '../../../../../src/services/connection/ConnectionStateStore.js';
import { ConnectionOAuthHandshakeService } from '../../../../../src/services/connection/ConnectionOAuthHandshakeService.js';
import { LocalOAuthCallbackServer } from '../../../../../src/services/connection/LocalOAuthCallbackServer.js';
import type { PluginConnectionDescriptor } from '../../../../../src/contracts/connection/index.js';

function createMockContext(prefix: string = 'test-user'): { ctx: IMessageContext; replies: string[] } {
  const replies: string[] = [];
  const uniqueUserId = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const ctx: IMessageContext = {
    userId: uniqueUserId,
    chatId: 'test-chat',
    platform: 'terminal',
    rawMessage: '',
    isGroup: false,
    reply: async (text: string) => {
      replies.push(text);
    },
  } as unknown as IMessageContext;

  return { ctx, replies };
}

describe('SharedSurfaceConnectCommandPack', () => {
  let tempDir: string;
  let commandPack: SharedSurfaceConnectCommandPack;
  let stateStore: ConnectionStateStore;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-cmd-test-'));

    const mockStripeConnection: PluginConnectionDescriptor = {
      authType: 'api_key',
      usePkce: false,
      apiKey: {
        label: 'Stripe Secret Key',
        placeholder: 'sk_live_...',
      },
    };

    const mockObsidianConnection: PluginConnectionDescriptor = {
      authType: 'local_path',
      usePkce: false,
      localPath: {
        kind: 'directory',
        label: 'Obsidian Vault',
      },
    };

    const pluginRegistry: ConnectionPluginRegistryPort = {
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
      ],
    };

    const resolver = new ConnectionTargetResolver({ pluginRegistry });
    const verifier = new ConnectionVerificationService({ requestTimeoutMs: 500 });
    stateStore = ConnectionStateStore.getInstance();

    const handshakeService = new ConnectionOAuthHandshakeService({
      callbackServer: new LocalOAuthCallbackServer({ timeoutMs: 100 }),
    });

    commandPack = new SharedSurfaceConnectCommandPack({
      resolver,
      verifier,
      stateStore,
      handshakeService,
      rateLimitMaxPerMinute: 10,
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('shows usage instructions when /connect is invoked without target', async () => {
    const { ctx, replies } = createMockContext('user-1');
    const handled = await commandPack.maybeHandle(ctx, '/connect', '');

    expect(handled).toBe(true);
    expect(replies[0]).toContain('**Connect Command Usage:**');
    expect(replies[0]).toContain('/connections catalog');
  });

  it('returns deterministic error when connecting unknown target', async () => {
    const { ctx, replies } = createMockContext('user-2');
    const handled = await commandPack.maybeHandle(ctx, '/connect', 'nonexistent_target');

    expect(handled).toBe(true);
    expect(replies[0]).toContain("Target 'nonexistent_target' is not recognized");
  });

  it('prompts for API key when connecting api_key service without key', async () => {
    const { ctx, replies } = createMockContext('user-3');
    const handled = await commandPack.maybeHandle(ctx, '/connect', 'stripe');

    expect(handled).toBe(true);
    expect(replies[0]).toContain('To connect **Stripe Payments**, provide your Stripe Secret Key');
    expect(replies[0]).toContain('/connect stripe <your_key>');
  });

  it('verifies and saves connection when valid API key is provided', async () => {
    const { ctx, replies } = createMockContext('user-4');
    const handled = await commandPack.maybeHandle(ctx, '/connect', 'stripe sk_live_test123456');

    expect(handled).toBe(true);
    expect(replies[0]).toContain('Connected to **Stripe Payments** successfully');

    const conn = await stateStore.getConnection(ctx.userId, 'stripe');
    expect(conn).toBeDefined();
    expect(conn?.status).toBe('connected');
    expect(conn?.authType).toBe('api_key');
  });

  it('displays already connected message when connecting target already active without new key', async () => {
    const { ctx, replies } = createMockContext('user-5');

    // First connect
    await commandPack.maybeHandle(ctx, '/connect', 'stripe sk_live_initial');
    expect(replies[0]).toContain('Connected to **Stripe Payments** successfully');

    // Second connect without arguments
    await commandPack.maybeHandle(ctx, '/connect', 'stripe');
    expect(replies[1]).toContain('Target **Stripe Payments** is already connected');
    expect(replies[1]).toContain('/disconnect stripe');
  });

  it('prompts for directory path when connecting local_path target without path', async () => {
    const { ctx, replies } = createMockContext('user-6');
    const handled = await commandPack.maybeHandle(ctx, '/connect', 'obsidian');

    expect(handled).toBe(true);
    expect(replies[0]).toContain('specify the local directory path');
  });

  it('verifies and connects local_path target when valid directory is provided', async () => {
    const { ctx, replies } = createMockContext('user-7');
    const handled = await commandPack.maybeHandle(ctx, '/connect', `obsidian ${tempDir}`);

    expect(handled).toBe(true);
    expect(replies[0]).toContain('Connected to **Obsidian Vault** successfully');

    const conn = await stateStore.getConnection(ctx.userId, 'obsidian');
    expect(conn?.status).toBe('connected');
    expect(conn?.localPath).toBe(tempDir);
  });

  it('provides device code instructions for GitHub OAuth', async () => {
    const { ctx, replies } = createMockContext('user-8');
    const handled = await commandPack.maybeHandle(ctx, '/connect', 'github');

    expect(handled).toBe(true);
    expect(replies[0]).toContain('Device Code Flow');
    expect(replies[0]).toContain('github.com/login/device');
  });

  it('provides authorization link for Claude OAuth', async () => {
    const { ctx, replies } = createMockContext('user-9');
    const handled = await commandPack.maybeHandle(ctx, '/connect', 'claude');

    expect(handled).toBe(true);
    expect(replies[0]).toContain('Click the link below to authorize');
    expect(replies[0]).toContain('claude.ai');

    // Wait for the 100ms ephemeral test server to close cleanly
    await new Promise(r => setTimeout(r, 150));
  });

  it('handles /disconnect idempotently for unconfigured targets', async () => {
    const { ctx, replies } = createMockContext('user-10');
    const handled = await commandPack.maybeHandle(ctx, '/disconnect', 'unconfigured_target');

    expect(handled).toBe(true);
    expect(replies[0]).toBe("Not connected to 'unconfigured_target'.");
  });

  it('disconnects active target, purges credentials and updates state', async () => {
    const { ctx, replies } = createMockContext('user-11');

    // Connect
    await commandPack.maybeHandle(ctx, '/connect', 'stripe sk_live_test_to_disconnect');

    // Disconnect
    const handled = await commandPack.maybeHandle(ctx, '/disconnect', 'stripe');
    expect(handled).toBe(true);
    expect(replies[1]).toContain('Disconnected from **Stripe Payments**');

    const conn = await stateStore.getConnection(ctx.userId, 'stripe');
    expect(conn).toBeNull();
  });

  it('lists active connections with /connections', async () => {
    const { ctx, replies } = createMockContext('user-12');

    // Empty list
    await commandPack.maybeHandle(ctx, '/connections', '');
    expect(replies[0]).toContain('No active connections found');

    // Connect one
    await commandPack.maybeHandle(ctx, '/connect', 'stripe sk_live_list_test');

    // Non-empty list
    await commandPack.maybeHandle(ctx, '/connections', 'list');
    expect(replies[2]).toContain('Your Active Connections (1):');
    expect(replies[2]).toContain('Stripe Payments');
  });

  it('shows available catalog with /connections catalog', async () => {
    const { ctx, replies } = createMockContext('user-13');
    const handled = await commandPack.maybeHandle(ctx, '/connections', 'catalog');

    expect(handled).toBe(true);
    expect(replies[0]).toContain('Available Connection Catalog:');
    expect(replies[0]).toContain('`github`');
    expect(replies[0]).toContain('`stripe`');
    expect(replies[0]).toContain('`obsidian`');
  });

  it('enforces rate limit of max 10 calls per minute per user', async () => {
    const { ctx, replies } = createMockContext('user-rate-limit');

    // Execute 10 times
    for (let i = 0; i < 10; i++) {
      await commandPack.maybeHandle(ctx, '/connect', '');
    }
    expect(replies.length).toBe(10);
    expect(replies[9]).toContain('**Connect Command Usage:**');

    // 11th execution should trigger rate limit message
    await commandPack.maybeHandle(ctx, '/connect', '');
    expect(replies[10]).toContain('Rate limit exceeded');
  });

  it('dynamically adapts messages to Portuguese when context locale is pt', async () => {
    const { ctx, replies } = createMockContext('user-pt');
    (ctx as unknown as { locale: string }).locale = 'pt';

    const handled = await commandPack.maybeHandle(ctx, '/connect', '');
    expect(handled).toBe(true);
    expect(replies[0]).toContain('**Uso do Comando Connect:**');
    expect(replies[0]).toContain('`/connect <alvo> [credencial]`');

    // Test Portuguese disconnect
    await commandPack.maybeHandle(ctx, '/disconnect', 'stripe');
    expect(replies[1]).toContain("Não conectado a 'stripe'");

    // Test Portuguese catalog
    await commandPack.maybeHandle(ctx, '/connections', 'catalog');
    expect(replies[2]).toContain('**Catálogo de Conexões Disponíveis:**');
  });

  it('correctly parses target and credentials with multiple spaces without regex', async () => {
    const { ctx, replies } = createMockContext('user-spaces');
    const handled = await commandPack.maybeHandle(ctx, '/connect', 'stripe    sk_live_test999888   ');
    expect(handled).toBe(true);
    expect(replies[0]).toContain('Connected to **Stripe Payments** successfully');
  });
});
