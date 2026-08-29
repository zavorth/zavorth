/**
 * Shared Surface Connect Command Pack.
 * Handles user-facing slash commands for zero-friction target integrations:
 * `/connect <target>`, `/disconnect <target>`, and `/connections [list|catalog|status]`.
 *
 * Strict Clean Code: English-first, zero `any`, no rigid heuristics, fully typed.
 */

import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import {
  ConnectionTargetResolver,
  type ConnectionResolution,
} from '../../../../services/connection/ConnectionTargetResolver.js';
import {
  ConnectionVerificationService,
} from '../../../../services/connection/ConnectionVerificationService.js';
import {
  ConnectionStateStore,
  type StoredConnection,
} from '../../../../services/connection/ConnectionStateStore.js';
import {
  ConnectionOAuthHandshakeService,
} from '../../../../services/connection/ConnectionOAuthHandshakeService.js';
import {
  ConnectionLockManager,
} from '../../../../services/connection/ConnectionLockManager.js';
import {
  ConnectionSemanticIntrospectionService,
} from '../../../../services/connection/ConnectionSemanticIntrospectionService.js';
import {
  LocalEncryptedProviderSecretStore,
} from '../../../../services/ProviderSecretStore.js';
import {
  getConnectStrings,
  formatTemplate,
} from './connection/SharedSurfaceConnectLocalization.js';
import { logger } from '../../../../logger.js';

export interface SharedSurfaceConnectCommandPackDeps {
  resolver: ConnectionTargetResolver;
  verifier?: ConnectionVerificationService;
  stateStore?: ConnectionStateStore;
  secretStore?: LocalEncryptedProviderSecretStore;
  handshakeService?: ConnectionOAuthHandshakeService;
  lockManager?: ConnectionLockManager;
  introspectionService?: ConnectionSemanticIntrospectionService;
  rateLimitMaxPerMinute?: number;
}

export class SharedSurfaceConnectCommandPack {
  private readonly resolver: ConnectionTargetResolver;
  private readonly verifier: ConnectionVerificationService;
  private readonly stateStore: ConnectionStateStore;
  private readonly secretStore: LocalEncryptedProviderSecretStore;
  private readonly handshakeService: ConnectionOAuthHandshakeService;
  private readonly lockManager: ConnectionLockManager;
  private readonly introspectionService: ConnectionSemanticIntrospectionService;
  private readonly rateLimitMaxPerMinute: number;
  private readonly userCallTimestamps = new Map<string, number[]>();

  constructor(deps: SharedSurfaceConnectCommandPackDeps) {
    this.resolver = deps.resolver;
    this.verifier = deps.verifier || new ConnectionVerificationService();
    this.stateStore = deps.stateStore || ConnectionStateStore.getInstance();
    this.secretStore = deps.secretStore || LocalEncryptedProviderSecretStore.getInstance();
    this.handshakeService =
      deps.handshakeService || new ConnectionOAuthHandshakeService({ stateStore: this.stateStore });
    this.lockManager = deps.lockManager || ConnectionLockManager.getInstance();
    this.introspectionService = deps.introspectionService || new ConnectionSemanticIntrospectionService();
    this.rateLimitMaxPerMinute = deps.rateLimitMaxPerMinute || 10;
  }

  public async maybeHandle(
    ctx: IMessageContext,
    commandType: string,
    args: string
  ): Promise<boolean> {
    const cmd = commandType.toLowerCase().trim();

    if (cmd === '/connect') {
      await this.handleConnect(ctx, args);
      return true;
    }

    if (cmd === '/disconnect') {
      await this.handleDisconnect(ctx, args);
      return true;
    }

    if (cmd === '/connections') {
      await this.handleConnections(ctx, args);
      return true;
    }

    return false;
  }

  private isRateLimited(userId: string): boolean {
    const now = Date.now();
    const windowStart = now - 60000;
    const timestamps = (this.userCallTimestamps.get(userId) || []).filter(t => t > windowStart);

    if (timestamps.length >= this.rateLimitMaxPerMinute) {
      return true;
    }

    timestamps.push(now);
    this.userCallTimestamps.set(userId, timestamps);
    return false;
  }

  private async handleConnect(ctx: IMessageContext, rawArgs: string): Promise<void> {
    const userId = String(ctx.userId || 'default-user').trim() || 'default-user';

    if (this.isRateLimited(userId)) {
      await ctx.reply(
        'Rate limit exceeded: You can execute at most 10 connection commands per minute. Please wait.'
      );
      return;
    }

    const trimmed = String(rawArgs || '').trim();
    if (!trimmed) {
      await ctx.reply(
        [
          '**Connect Command Usage:**',
          '`/connect <target> [credential]`',
          '',
          '**Examples:**',
          '• `/connect github`',
          '• `/connect stripe sk_live_...`',
          '• `/connect obsidian /path/to/vault`',
          '',
          'Use `/connections catalog` to view all available targets.',
        ].join('\n')
      );
      return;
    }

    const parts = trimmed.split(/\s+/);
    const target = parts[0];
    const credentialValue = parts.slice(1).join(' ').trim();

    const resolution: ConnectionResolution = await this.resolver.resolve(target);
    if (resolution.source === 'unknown' || !resolution.descriptor || !resolution.cardDescriptor) {
      const intro = await this.introspectionService.introspect(target);
      if (intro.enabled && intro.guidance) {
        await ctx.reply(`${resolution.error || `Target '${target}' is not recognized.`}\n\n💡 **Guidance:** ${intro.guidance}`);
      } else {
        await ctx.reply(resolution.error || `Target '${target}' is not recognized.`);
      }
      return;
    }

    const lock = await this.lockManager.acquireLock(userId, target);
    if (!lock.acquired) {
      await ctx.reply(`⚠️ ${lock.error || 'A connection handshake is already in progress for this target.'}`);
      return;
    }

    try {
      const { descriptor, cardDescriptor } = resolution;
      const existing = await this.stateStore.getConnection(userId, target);

      // If already connected and no credential passed to update:
      if (existing && existing.status === 'connected' && !credentialValue) {
        await ctx.reply(
          [
            `Target **${cardDescriptor.displayName}** is already connected (status: \`connected\`).`,
            '',
            `• To reconnect or upgrade credentials: \`/connect ${target} <new_credentials>\``,
            `• To disconnect: \`/disconnect ${target}\``,
          ].join('\n')
        );
        return;
      }

    // AuthType: Local Path
    if (descriptor.authType === 'local_path') {
      if (!credentialValue) {
        await ctx.reply(
          `To connect **${cardDescriptor.displayName}**, specify the local directory path:\n\`/connect ${target} <path_to_directory>\``
        );
        return;
      }

      const verifyRes = await this.verifier.verify(target, descriptor, { localPath: credentialValue });
      if (!verifyRes.ok) {
        await ctx.reply(
          `❌ Failed to connect **${cardDescriptor.displayName}**: ${verifyRes.details} (${verifyRes.error || 'Check path'})`
        );
        return;
      }

      const now = new Date().toISOString();
      await this.stateStore.saveConnection({
        userId,
        targetId: target,
        displayName: cardDescriptor.displayName,
        authType: 'local_path',
        status: 'connected',
        localPath: credentialValue,
        connectedAt: existing ? existing.connectedAt : now,
        updatedAt: now,
      });

      await ctx.reply(
        `✅ Connected to **${cardDescriptor.displayName}** successfully!\nLocal directory verified at: \`${credentialValue}\``
      );
      return;
    }

    // AuthType: API Key
    if (descriptor.authType === 'api_key') {
      if (!credentialValue) {
        const label = descriptor.apiKey?.label || 'API Key';
        await ctx.reply(
          `To connect **${cardDescriptor.displayName}**, provide your ${label}:\n\`/connect ${target} <your_key>\``
        );
        return;
      }

      const verifyRes = await this.verifier.verify(target, descriptor, { apiKey: credentialValue });
      if (!verifyRes.ok) {
        await ctx.reply(
          `❌ Failed to connect **${cardDescriptor.displayName}**: ${verifyRes.details} (${verifyRes.error || 'Invalid key'})`
        );
        return;
      }

      let secretRef: string | undefined;
      try {
        secretRef = await this.stateStore.saveSecret(target, credentialValue);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        await ctx.reply(`❌ Failed to store encrypted credentials for **${cardDescriptor.displayName}**: ${msg}`);
        return;
      }

      const now = new Date().toISOString();
      await this.stateStore.saveConnection({
        userId,
        targetId: target,
        displayName: cardDescriptor.displayName,
        authType: 'api_key',
        status: 'connected',
        secretRef,
        connectedAt: existing ? existing.connectedAt : now,
        updatedAt: now,
      });

      await ctx.reply(
        `✅ Connected to **${cardDescriptor.displayName}** successfully!\nCredentials encrypted and stored securely in vault.`
      );
      return;
    }

    // AuthType: OAuth2
    if (descriptor.authType === 'oauth2') {
      if (descriptor.oauth?.supportsDeviceCode) {
        const verificationUrl = cardDescriptor.deviceCodeVerificationUrl || descriptor.oauth.deviceCodeUrl || 'https://github.com/login/device';
        await ctx.reply(
          [
            `🔑 **Connect ${cardDescriptor.displayName} (Device Code Flow):**`,
            `1. Open the authorization link: ${verificationUrl}`,
            '2. Confirm authorization in your browser.',
            '3. Zavorth will complete the handshake automatically.',
          ].join('\n')
        );
        return;
      }

      if (descriptor.oauth?.authorizationUrl) {
        try {
          const clientId = descriptor.oauth.clientId || `${target}-client`;
          const flow = await this.handshakeService.prepareAuthCodeFlow(
            target,
            descriptor,
            clientId
          );

          await ctx.reply(
            [
              `🔗 **Connect ${cardDescriptor.displayName}:**`,
              'Click the link below to authorize in your browser (ephemeral loopback listener active):',
              `[Authorize ${cardDescriptor.displayName}](${flow.authorizationUrl})`,
            ].join('\n')
          );

          // Asynchronously listen for callback without blocking UI
          void flow.serverInstance
            .waitForCallback()
            .then(async (callbackRes) => {
              try {
                const tokens = await this.handshakeService.exchangeAuthCode(
                  target,
                  descriptor,
                  clientId,
                  callbackRes.code,
                  flow.serverInstance.redirectUri,
                  flow.codeVerifier,
                  descriptor.oauth?.clientSecret
                );

                const secretRef = await this.stateStore.saveSecret(target, tokens.accessToken);
                const now = new Date().toISOString();

                await this.stateStore.saveConnection({
                  userId,
                  targetId: target,
                  displayName: cardDescriptor.displayName,
                  authType: 'oauth2',
                  status: 'connected',
                  secretRef,
                  connectedAt: existing ? existing.connectedAt : now,
                  updatedAt: now,
                });

                await ctx.reply(`✅ Successfully connected to **${cardDescriptor.displayName}** via OAuth2!`);
              } catch (exchangeErr: unknown) {
                const errText = exchangeErr instanceof Error ? exchangeErr.message : String(exchangeErr);
                await ctx.reply(`❌ OAuth token exchange failed for **${cardDescriptor.displayName}**: ${errText}`);
              }
            })
            .catch(async (waitErr: unknown) => {
              const errText = waitErr instanceof Error ? waitErr.message : String(waitErr);
              await ctx.reply(`⚠️ OAuth authorization ended for **${cardDescriptor.displayName}**: ${errText}`);
            })
            .finally(async () => {
              await this.lockManager.releaseLock(userId, target);
            });

          return;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn(`[SharedSurfaceConnectCommandPack] Ephemeral loopback server failed to start: ${msg}`);
          const authUrl = descriptor.oauth.authorizationUrl;
          if (!authUrl) {
            await ctx.reply(`⚠️ Failed to start OAuth callback listener: ${msg}`);
            await this.lockManager.releaseLock(userId, target);
            return;
          }
          await ctx.reply(
            [
              `🔗 **Connect ${cardDescriptor.displayName}:**`,
              `Click the link below to authorize Zavorth:`,
              `[Authorize ${cardDescriptor.displayName}](${authUrl})`,
            ].join('\n')
          );
          await this.lockManager.releaseLock(userId, target);
          return;
        }
      }

      await ctx.reply(`OAuth configuration for **${cardDescriptor.displayName}** is active.`);
      return;
    }

    // AuthType: Custom / MCP
    const now = new Date().toISOString();
    await this.stateStore.saveConnection({
      userId,
      targetId: target,
      displayName: cardDescriptor.displayName,
      authType: descriptor.authType,
      status: 'connected',
      connectedAt: existing ? existing.connectedAt : now,
      updatedAt: now,
    });

    await ctx.reply(`✅ Connection to **${cardDescriptor.displayName}** established.`);
    } finally {
      if (resolution.descriptor?.authType !== 'oauth2') {
        await this.lockManager.releaseLock(userId, target);
      }
    }
  }

  private async handleDisconnect(ctx: IMessageContext, rawArgs: string): Promise<void> {
    const userId = String(ctx.userId || 'default-user').trim() || 'default-user';
    const target = String(rawArgs || '').trim().toLowerCase();

    if (!target) {
      await ctx.reply('Usage: `/disconnect <target>`\nExample: `/disconnect stripe`');
      return;
    }

    // Abort any in-flight handshake for this target immediately
    await this.lockManager.abortInFlight(userId, target);

    const existing = await this.stateStore.getConnection(userId, target);
    if (!existing || existing.status === 'disconnected') {
      // Idempotent clean response
      await ctx.reply(`Not connected to '${target}'.`);
      return;
    }

    // Check descriptor for revocation
    const resolution = await this.resolver.resolve(target);
    if (resolution.descriptor && existing.secretRef) {
      try {
        const secret = await this.stateStore.getSecret(existing.secretRef);
        if (secret) {
          await this.verifier.revoke(target, resolution.descriptor, secret);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`[SharedSurfaceConnectCommandPack] Remote token revocation failed for '${target}': ${msg}`);
      }
    }

    // Purge local secret from vault
    if (existing.secretRef) {
      try {
        await this.stateStore.deleteSecret(existing.secretRef);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[SharedSurfaceConnectCommandPack] Vault secret deletion failed for '${target}': ${msg}`);
      }
    }

    // Delete connection from state store
    await this.stateStore.deleteConnection(userId, target);

    await ctx.reply(`🔌 Disconnected from **${existing.displayName}**. Local secrets purged.`);
  }

  private async handleConnections(ctx: IMessageContext, rawArgs: string): Promise<void> {
    const userId = String(ctx.userId || 'default-user').trim() || 'default-user';
    const subCommand = String(rawArgs || '').trim().toLowerCase();

    if (subCommand === 'catalog') {
      const targets = this.resolver.listSupportedTargets();
      if (targets.length === 0) {
        await ctx.reply('No targets are currently available in the connection catalog.');
        return;
      }

      const lines = targets.map(t => `• \`${t}\``).join('\n');
      await ctx.reply(
        [
          '**Available Connection Catalog:**',
          lines,
          '',
          'To connect any target, type: `/connect <target>`',
        ].join('\n')
      );
      return;
    }

    const connections = await this.stateStore.listConnections(userId);
    if (connections.length === 0) {
      await ctx.reply(
        [
          'No active connections found.',
          '',
          '• Connect an integration: `/connect <target>`',
          '• View available catalog: `/connections catalog`',
        ].join('\n')
      );
      return;
    }

    if (subCommand === 'status') {
      const connections = await this.stateStore.listConnections(userId);
      if (connections.length === 0) {
        await ctx.reply('No active connections to report status.');
        return;
      }

      const statusLines = connections
        .map(
          c =>
            `• **${c.displayName}** (\`${c.targetId}\`)\n  - Status: \`${c.status}\`\n  - Health: \`${c.healthStatus || 'healthy'}\`\n  - Auth: \`${c.authType}\`\n  - Connected At: \`${c.connectedAt}\``
        )
        .join('\n\n');

      await ctx.reply(`**Connection Health Status:**\n\n${statusLines}`);
      return;
    }

    const formatted = connections
      .map(c => `• **${c.displayName}** (\`${c.targetId}\`) — ● \`${c.status}\` [${c.healthStatus || 'healthy'}] (${c.authType})`)
      .join('\n');

    await ctx.reply(
      [
        `**Your Active Connections (${connections.length}):**`,
        formatted,
        '',
        '• Disconnect a service: `/disconnect <target>`',
      ].join('\n')
    );
  }
}
