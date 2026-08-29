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
import type { ZavorthLocalizationService } from '../../../../services/localization/ZavorthLocalizationService.js';
import { createConnectionsAwareLocalizationService } from '../../../../services/localization/connectionsSupport.js';
import { logger } from '../../../../logger.js';

export interface SharedSurfaceConnectCommandPackDeps {
  resolver: ConnectionTargetResolver;
  verifier?: ConnectionVerificationService;
  stateStore?: ConnectionStateStore;
  secretStore?: LocalEncryptedProviderSecretStore;
  handshakeService?: ConnectionOAuthHandshakeService;
  lockManager?: ConnectionLockManager;
  introspectionService?: ConnectionSemanticIntrospectionService;
  localizationService?: ZavorthLocalizationService;
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
  private readonly localizationService: ZavorthLocalizationService;
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
    this.localizationService = deps.localizationService || createConnectionsAwareLocalizationService();
    this.rateLimitMaxPerMinute = deps.rateLimitMaxPerMinute || 10;
  }

  private getLocale(ctx: IMessageContext): string {
    const requested = String(ctx.locale || '').trim();
    if (!requested) {
      return 'en';
    }
    return this.localizationService.normalizeLocaleTag(requested) || 'en';
  }

  private t(key: string, params: Record<string, string | number> = {}, locale: string = 'en'): string {
    return this.localizationService.t(`connections.${key}`, params, locale);
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
    const locale = this.getLocale(ctx);

    if (this.isRateLimited(userId)) {
      await ctx.reply(this.t('rateLimitExceeded', {}, locale));
      return;
    }

    const trimmed = String(rawArgs || '').trim();
    if (!trimmed) {
      await ctx.reply(this.t('usageConnect', {}, locale));
      return;
    }

    const firstSpaceIndex = trimmed.indexOf(' ');
    const target = (firstSpaceIndex === -1 ? trimmed : trimmed.substring(0, firstSpaceIndex)).trim();
    const credentialValue = (firstSpaceIndex === -1 ? '' : trimmed.substring(firstSpaceIndex + 1)).trim();

    const resolution: ConnectionResolution = await this.resolver.resolve(target);
    if (resolution.source === 'unknown' || !resolution.descriptor || !resolution.cardDescriptor) {
      const intro = await this.introspectionService.introspect(target);
      if (intro.enabled && intro.guidance) {
        await ctx.reply(`${resolution.error || this.t('unrecognizedTarget', { target }, locale)}\n\n${this.t('guidanceLabel', {}, locale)} ${intro.guidance}`);
      } else {
        await ctx.reply(resolution.error || this.t('unrecognizedTarget', { target }, locale));
      }
      return;
    }

    const lock = await this.lockManager.acquireLock(userId, target);
    if (!lock.acquired) {
      await ctx.reply(`⚠️ ${lock.error || this.t('handshakeInProgress', {}, locale)}`);
      return;
    }

    try {
      const { descriptor, cardDescriptor } = resolution;
      const existing = await this.stateStore.getConnection(userId, target);

      // If already connected and no credential passed to update:
      if (existing && existing.status === 'connected' && !credentialValue) {
        await ctx.reply(
          [
            this.t('alreadyConnected', { target: cardDescriptor.displayName }, locale),
            '',
            this.t('reconnectHint', { target }, locale),
            this.t('disconnectHint', { target }, locale),
          ].join('\n')
        );
        return;
      }

      // AuthType: Local Path
      if (descriptor.authType === 'local_path') {
        if (!credentialValue) {
          const kind = descriptor.localPath?.kind || 'directory';
          await ctx.reply(this.t('localPathPrompt', { target: cardDescriptor.displayName, id: target, kind }, locale));
          return;
        }

        const verifyRes = await this.verifier.verify(target, descriptor, { localPath: credentialValue });
        if (!verifyRes.ok) {
          await ctx.reply(
            this.t('pathVerificationFailed', { target: cardDescriptor.displayName, details: `${verifyRes.details} (${verifyRes.error || 'Check path'})` }, locale)
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
          `✅ ${this.t('connectedSuccess', { target: cardDescriptor.displayName }, locale)}\n${this.t('localPathVerifiedSuffix', { path: credentialValue }, locale)}`
        );
        return;
      }

      // AuthType: API Key
      if (descriptor.authType === 'api_key') {
        if (!credentialValue) {
          const label = descriptor.apiKey?.label || 'API Key';
          await ctx.reply(this.t('apiKeyPrompt', { target: cardDescriptor.displayName, id: target, label }, locale));
          return;
        }

        const verifyRes = await this.verifier.verify(target, descriptor, { apiKey: credentialValue });
        if (!verifyRes.ok) {
          await ctx.reply(
            this.t('apiKeyVerificationFailed', { target: cardDescriptor.displayName, details: `${verifyRes.details} (${verifyRes.error || 'Invalid key'})` }, locale)
          );
          return;
        }

        let secretRef: string | undefined;
        try {
          secretRef = await this.stateStore.saveSecret(target, credentialValue);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.reply(this.t('secretStoreFailed', { target: cardDescriptor.displayName, details: msg }, locale));
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
          `✅ ${this.t('connectedSuccess', { target: cardDescriptor.displayName }, locale)}\n${this.t('credentialsVaultSuffix', {}, locale)}`
        );
        return;
      }

      // AuthType: OAuth2
      if (descriptor.authType === 'oauth2') {
        if (descriptor.oauth?.supportsDeviceCode) {
          const verificationUrl =
            cardDescriptor.deviceCodeVerificationUrl ||
            descriptor.oauth.verificationUri ||
            descriptor.oauth.deviceCodeUrl;

          if (!verificationUrl) {
            await ctx.reply(
              this.t('pathVerificationFailed', { target: cardDescriptor.displayName, details: this.t('missingDeviceVerificationUrl', {}, locale) }, locale)
            );
            return;
          }

          await ctx.reply(
            this.t('deviceCodeFlowInstructions', { target: cardDescriptor.displayName, url: verificationUrl }, locale)
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
              this.t('oauthClickLink', { target: cardDescriptor.displayName, url: flow.authorizationUrl }, locale)
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

                  await ctx.reply(this.t('oauthConnectedSuccess', { target: cardDescriptor.displayName }, locale));
                } catch (exchangeErr: unknown) {
                  const errText = exchangeErr instanceof Error ? exchangeErr.message : String(exchangeErr);
                  await ctx.reply(this.t('oauthExchangeFailed', { target: cardDescriptor.displayName, details: errText }, locale));
                }
              })
              .catch(async (waitErr: unknown) => {
                const errText = waitErr instanceof Error ? waitErr.message : String(waitErr);
                await ctx.reply(this.t('oauthEnded', { target: cardDescriptor.displayName, details: errText }, locale));
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
              await ctx.reply(this.t('oauthListenerFailed', { details: msg }, locale));
              await this.lockManager.releaseLock(userId, target);
              return;
            }
            await ctx.reply(this.t('oauthClickLink', { target: cardDescriptor.displayName, url: authUrl }, locale));
            await this.lockManager.releaseLock(userId, target);
            return;
          }
        }

        await ctx.reply(this.t('oauthConfigActive', { target: cardDescriptor.displayName }, locale));
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

      await ctx.reply(`✅ ${this.t('connectedSuccess', { target: cardDescriptor.displayName }, locale)}`);
    } finally {
      if (resolution.descriptor?.authType !== 'oauth2') {
        await this.lockManager.releaseLock(userId, target);
      }
    }
  }

  private async handleDisconnect(ctx: IMessageContext, rawArgs: string): Promise<void> {
    const userId = String(ctx.userId || 'default-user').trim() || 'default-user';
    const target = String(rawArgs || '').trim().toLowerCase();
    const locale = this.getLocale(ctx);

    if (!target) {
      await ctx.reply(this.t('usageDisconnect', {}, locale));
      return;
    }

    // Abort any in-flight handshake for this target immediately
    await this.lockManager.abortInFlight(userId, target);

    const existing = await this.stateStore.getConnection(userId, target);
    if (!existing || existing.status === 'disconnected') {
      await ctx.reply(this.t('notConnected', { target }, locale));
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

    await ctx.reply(`🔌 ${this.t('disconnectedSuccess', { target: existing.displayName }, locale)}`);
  }

  private async handleConnections(ctx: IMessageContext, rawArgs: string): Promise<void> {
    const userId = String(ctx.userId || 'default-user').trim() || 'default-user';
    const subCommand = String(rawArgs || '').trim().toLowerCase();
    const locale = this.getLocale(ctx);

    if (subCommand === 'catalog') {
      const targets = this.resolver.listSupportedTargets();
      if (targets.length === 0) {
        await ctx.reply(this.t('catalogEmpty', {}, locale));
        return;
      }

      const lines = targets.map(t => `• \`${t}\``).join('\n');
      await ctx.reply(
        [
          `**${this.t('catalogTitle', {}, locale)}:**`,
          lines,
          '',
          this.t('catalogConnectHint', {}, locale),
        ].join('\n')
      );
      return;
    }

    const connections = await this.stateStore.listConnections(userId);
    if (connections.length === 0) {
      await ctx.reply(this.t('noActiveConnections', {}, locale));
      return;
    }

    if (subCommand === 'status') {
      const statusLines = connections
        .map(
          c =>
            `• **${c.displayName}** (\`${c.targetId}\`)\n  - ${this.t('statusLabel', {}, locale)}: \`${c.status}\`\n  - ${this.t('healthLabel', {}, locale)}: \`${c.healthStatus || 'healthy'}\`\n  - ${this.t('authLabel', {}, locale)}: \`${c.authType}\`\n  - ${this.t('connectedAtLabel', {}, locale)}: \`${c.connectedAt}\``
        )
        .join('\n\n');

      await ctx.reply(`${this.t('statusHeader', {}, locale)}\n\n${statusLines}`);
      return;
    }

    const formatted = connections
      .map(c => `• **${c.displayName}** (\`${c.targetId}\`) — ● \`${c.status}\` [${c.healthStatus || 'healthy'}] (${c.authType})`)
      .join('\n');

    await ctx.reply(
      [
        this.t('activeConnectionsHeader', { count: connections.length }, locale),
        formatted,
        '',
        this.t('disconnectServiceHint', {}, locale),
      ].join('\n')
    );
  }
}
