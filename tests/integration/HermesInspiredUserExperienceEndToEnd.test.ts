import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';

import { DomainScopedBrowserProfileService } from '../../src/tool-runtime/tools/browser/DomainScopedBrowserProfileService.js';
import { PersonaRegistryService } from '../../src/runtime/agent/roster/PersonaRegistryService.js';
import { DynamicPersonaCompilerService } from '../../src/runtime/agent/roster/DynamicPersonaCompilerService.js';
import { SharedSurfaceBotCommandPack } from '../../src/domain/surface/presentation/shared-surface/SharedSurfaceBotCommandPack.js';
import { PeerReviewAdvisoryService } from '../../src/runtime/agent/advisory/PeerReviewAdvisoryService.js';
import { SmartDecisionAdvisor } from '../../src/services/approvals/SmartDecisionAdvisor.js';
import { SlackChannelAdapter } from '../../src/gateways/channels/slack/SlackChannelAdapter.js';
import type { IMessageContext } from '../../src/contracts/IMessageBroker.js';
import type { AgentPermissionService } from '../../src/services/permission/AgentPermissionService.js';
import type { GatewayEventBus } from '../../src/gateway/events/GatewayEventBus.js';
import type { ChannelPolicyManager } from '../../src/channels/policies/ChannelPolicyManager.js';

describe('Hermes-Inspired End-to-End User Experience Simulation', () => {
  const testDir = path.join(os.tmpdir(), `zavorth-e2e-user-${Date.now()}`);

  beforeAll(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  function createSimulatedUserMessage(platform: string, text: string): { ctx: IMessageContext; replies: string[] } {
    const replies: string[] = [];
    const ctx = {
      platform,
      userId: 'user_dev_01',
      chatId: 'channel_main',
      messageId: `msg_${Date.now()}`,
      rawText: text,
      reply: jest.fn(async (replyText: string) => {
        replies.push(replyText);
      }),
    } as unknown as IMessageContext;

    return { ctx, replies };
  }

  describe('User Journey 1: Real Browser Profile with Zero-Lock and Domain Purge', () => {
    it('creates an ephemeral vault from the user profile, purges sensitive cookies, and shreds on exit', async () => {
      const mockProfileDir = path.join(testDir, 'mock-chrome-user-profile');
      const networkDir = path.join(mockProfileDir, 'Network');
      fs.mkdirSync(networkDir, { recursive: true });

      const dbPath = path.join(networkDir, 'Cookies');
      const db = new Database(dbPath);
      db.exec(`
        CREATE TABLE cookies (
          creation_utc INTEGER NOT NULL,
          host_key TEXT NOT NULL,
          top_frame_site_key TEXT NOT NULL,
          name TEXT NOT NULL,
          value TEXT NOT NULL,
          encrypted_value BLOB NOT NULL
        );
      `);

      const insert = db.prepare(`
        INSERT INTO cookies (creation_utc, host_key, top_frame_site_key, name, value, encrypted_value)
        VALUES (?, ?, '', ?, ?, ?)
      `);
      insert.run(1, '.target-service.com', 'session', '', Buffer.from('TARGET_AUTH_COOKIE'));
      insert.run(2, '.google.com', 'SID', '', Buffer.from('SECRET_GOOGLE_LOGIN'));
      insert.run(3, '.chase.com', 'BANK_AUTH', '', Buffer.from('BANK_CREDENTIAL_COOKIE'));
      db.close();

      const vaultService = new DomainScopedBrowserProfileService();
      const snapshot = await vaultService.createDomainScopedSnapshot({
        browser: 'chrome',
        profileDir: mockProfileDir,
        userDataDir: mockProfileDir,
        profileName: 'Default',
        platform: 'windows',
        isDefault: true,
        exists: true,
        cookiesDbPath: dbPath,
      }, {
        allowedDomains: ['*.target-service.com'],
      });

      expect(fs.existsSync(snapshot.snapshotDir)).toBe(true);

      const snapshotDb = new Database(snapshot.cookiesDbPath, { readonly: true });
      const remainingRows = snapshotDb.prepare('SELECT host_key FROM cookies').all() as Array<{ host_key: string }>;
      snapshotDb.close();

      expect(remainingRows).toHaveLength(1);
      expect(remainingRows[0].host_key).toBe('.target-service.com');

      vaultService.disposeSnapshot(snapshot.snapshotDir);
      expect(fs.existsSync(snapshot.snapshotDir)).toBe(false);
    });
  });

  describe('User Journey 2: Omnichannel Persona Creation, Roster Management & @Mention', () => {
    it('allows a user to dynamically create a persona, list the roster, and invoke via @mention', async () => {
      const storageDir = path.join(testDir, 'bots');
      const registry = new PersonaRegistryService({ storageDir });
      const compiler = new DynamicPersonaCompilerService();
      const botPack = new SharedSurfaceBotCommandPack({
        personaRegistryService: registry,
        dynamicCompilerService: compiler,
      });

      // Step 1: User types /bot create
      const createMsg = createSimulatedUserMessage('telegram', '/bot create Senior PostgreSQL DBA specializing in query explain and indexes');
      const createHandled = await botPack.maybeHandle(createMsg.ctx, '/bot', 'create Senior PostgreSQL DBA specializing in query explain and indexes');
      expect(createHandled).toBe(true);
      expect(createMsg.replies[0]).toContain('Persona Created: @database-specialist');
      expect(createMsg.replies[0]).toContain('database_query');

      // Step 2: User types /bot list
      const listMsg = createSimulatedUserMessage('telegram', '/bot list');
      await botPack.maybeHandle(listMsg.ctx, '/bot', 'list');
      expect(listMsg.replies[0]).toContain('@database-specialist');
      expect(listMsg.replies[0]).toContain('@executor');

      // Step 3: User mentions @database-specialist in chat
      const rawUserTurn = '@database-specialist EXPLAIN ANALYZE SELECT * FROM users WHERE active = true;';
      const resolved = registry.resolveMention(rawUserTurn);
      expect(resolved).not.toBeNull();
      expect(resolved?.persona.id).toBe('database-specialist');
      expect(resolved?.strippedPrompt).toBe('EXPLAIN ANALYZE SELECT * FROM users WHERE active = true;');

      // Step 4: User inspects persona
      const inspectMsg = createSimulatedUserMessage('telegram', '/bot inspect database-specialist');
      await botPack.maybeHandle(inspectMsg.ctx, '/bot', 'inspect database-specialist');
      expect(inspectMsg.replies[0]).toContain('Persona Details: @database-specialist');
      expect(inspectMsg.replies[0]).toContain('database_explain');
    });
  });

  describe('User Journey 3: Dialectic Peer Review Deliberation & Active Veto', () => {
    it('generates a multi-perspective debate on /review and vetoes dangerous actions before execution', async () => {
      const advisory = new PeerReviewAdvisoryService();
      const botPack = new SharedSurfaceBotCommandPack({
        personaRegistryService: new PersonaRegistryService({ storageDir: path.join(testDir, 'bots') }),
        peerReviewService: advisory,
      });

      // Step 1: User runs /review
      const reviewMsg = createSimulatedUserMessage('discord', '/review Migrate to SQLite WAL mode with read-write sharing');
      await botPack.maybeHandle(reviewMsg.ctx, '/review', 'Migrate to SQLite WAL mode with read-write sharing');
      expect(reviewMsg.replies[0]).toContain('Peer Review Dialectic Deliberation');
      expect(reviewMsg.replies[0]).toContain('Thesis');
      expect(reviewMsg.replies[0]).toContain('Antithesis');
      expect(reviewMsg.replies[0]).toContain('Council Synthesis');

      // Step 2: Agent attempts a dangerous command under SmartDecisionAdvisor
      const mockPermission: Pick<AgentPermissionService, 'evaluate'> = {
        evaluate: jest.fn(() => ({ action: 'ask', matchedRule: null, reason: 'unverified' })),
      };
      const advisor = new SmartDecisionAdvisor({
        permissionService: mockPermission,
        peerReviewService: advisory,
        enabled: true,
      });

      const vetoResult = await advisor.advise({
        toolName: 'terminal_backends',
        pattern: 'rmdir /s /q C:\\Windows\\System32',
      });

      expect(vetoResult.action).toBe('deny');
      expect(vetoResult.source).toBe('peer-review-veto');
      expect(vetoResult.dissentingOpinions?.[0]).toContain('Destructive root or system-wide directory deletion');
    });
  });

  describe('User Journey 4: Slack Channel Webhook Concurrency and Deduplication', () => {
    it('suppresses duplicate webhook retries while accepting legitimate distinct messages', async () => {
      const mockEventBus: { emit: jest.Mock; subscribe: jest.Mock; unsubscribe: jest.Mock } = {
        emit: jest.fn(async () => undefined),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };
      const mockPolicy: Pick<ChannelPolicyManager, 'verifyAccess'> = {
        verifyAccess: jest.fn(async () => true),
      };

      let simulatedTime = 100000;
      const adapter = new SlackChannelAdapter(
        mockEventBus as unknown as GatewayEventBus,
        mockPolicy as unknown as ChannelPolicyManager,
        'xoxb-test',
        { now: () => new Date(simulatedTime), claimTtlMs: 30000 },
      );

      // User sends message
      await adapter.onMessageReceived({
        event_id: 'slack-evt-101',
        user: 'U999',
        channel: 'C888',
        text: 'Deploy to production',
        ts: '1710000000.000100',
      });
      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);

      // Slack retries message 1 second later due to timeout
      simulatedTime += 1000;
      await adapter.onMessageReceived({
        event_id: 'slack-evt-101',
        user: 'U999',
        channel: 'C888',
        text: 'Deploy to production',
        ts: '1710000000.000100',
      });
      expect(mockEventBus.emit).toHaveBeenCalledTimes(1); // Dropped!

      // New legitimate user message arrives
      simulatedTime += 2000;
      await adapter.onMessageReceived({
        event_id: 'slack-evt-102',
        user: 'U999',
        channel: 'C888',
        text: 'Check deployment logs',
        ts: '1710000003.000200',
      });
      expect(mockEventBus.emit).toHaveBeenCalledTimes(2); // Processed!
    });
  });
});
