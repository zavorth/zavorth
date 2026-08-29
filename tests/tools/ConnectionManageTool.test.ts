import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ConnectionManageTool } from '../../src/tool-runtime/tools/connection/ConnectionManageTool.js';
import {
  ConnectionTargetResolver,
  type ConnectionPluginRegistryPort,
} from '../../src/services/connection/ConnectionTargetResolver.js';
import { ConnectionVerificationService } from '../../src/services/connection/ConnectionVerificationService.js';
import { ConnectionStateStore } from '../../src/services/connection/ConnectionStateStore.js';
import type { PluginConnectionDescriptor } from '../../src/contracts/connection/index.js';

describe('ConnectionManageTool', () => {
  let tempDir: string;
  let tool: ConnectionManageTool;
  let stateStore: ConnectionStateStore;
  let testUserId: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-tool-test-'));
    testUserId = `tool-user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const mockStripeConnection: PluginConnectionDescriptor = {
      authType: 'api_key',
      usePkce: false,
      apiKey: {
        label: 'Stripe API Key',
        placeholder: 'sk_live_...',
      },
    };

    const mockObsidianConnection: PluginConnectionDescriptor = {
      authType: 'local_path',
      usePkce: false,
      localPath: {
        kind: 'directory',
        label: 'Obsidian Notes',
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
            label: 'Obsidian Notes',
            connection: mockObsidianConnection,
          },
        },
      ],
    };

    const resolver = new ConnectionTargetResolver({ pluginRegistry });
    const verifier = new ConnectionVerificationService({ requestTimeoutMs: 500 });
    stateStore = ConnectionStateStore.getInstance();

    tool = new ConnectionManageTool({
      resolver,
      verifier,
      stateStore,
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('declares correct metadata and schema for the LLM agent', () => {
    expect(tool.name).toBe('connection_manage');
    expect(tool.category).toBe('INTERNAL');
    expect(tool.dangerLevel).toBe('moderate');
    expect(tool.description).toContain('Inspects, explores, connects, or disconnects external services');
  });

  it('lists the available connection catalog', async () => {
    const res = await tool.execute({ action: 'catalog' });
    expect(res.success).toBe(true);
    expect(res.data?.catalog).toBeDefined();
    expect(res.data?.catalog).toContain('stripe');
    expect(res.data?.catalog).toContain('github');
  });

  it('lists empty connections initially for fresh user', async () => {
    const res = await tool.execute({ action: 'list', userId: testUserId });
    expect(res.success).toBe(true);
    expect(res.data?.connections).toEqual([]);
  });

  it('connects an API key integration successfully', async () => {
    const res = await tool.execute({
      action: 'connect',
      target: 'stripe',
      credentials: 'sk_live_123456789',
      userId: testUserId,
    });

    expect(res.success).toBe(true);
    expect(res.message).toContain('Connected to Stripe Payments successfully');

    const conn = await stateStore.getConnection(testUserId, 'stripe');
    expect(conn?.status).toBe('connected');
    expect(conn?.authType).toBe('api_key');
  });

  it('connects a local directory integration successfully', async () => {
    const res = await tool.execute({
      action: 'connect',
      target: 'obsidian',
      credentials: tempDir,
      userId: testUserId,
    });

    expect(res.success).toBe(true);
    expect(res.message).toContain('Connected to Obsidian Notes successfully');

    const conn = await stateStore.getConnection(testUserId, 'obsidian');
    expect(conn?.status).toBe('connected');
    expect(conn?.localPath).toBe(tempDir);
  });

  it('disconnects an active integration cleanly and purges secrets', async () => {
    // First connect
    await tool.execute({
      action: 'connect',
      target: 'stripe',
      credentials: 'sk_live_test_to_disconnect',
      userId: testUserId,
    });

    // Then disconnect
    const res = await tool.execute({
      action: 'disconnect',
      target: 'stripe',
      userId: testUserId,
    });

    expect(res.success).toBe(true);
    expect(res.message).toContain('Disconnected from Stripe Payments');

    const conn = await stateStore.getConnection(testUserId, 'stripe');
    expect(conn).toBeNull();
  });

  it('returns clean message when disconnecting an unconfigured target', async () => {
    const res = await tool.execute({
      action: 'disconnect',
      target: 'unconfigured_target',
      userId: testUserId,
    });

    expect(res.success).toBe(true);
    expect(res.message).toContain("Target 'unconfigured_target' is not currently connected");
  });
});
