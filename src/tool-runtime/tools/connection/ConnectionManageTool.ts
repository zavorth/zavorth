/**
 * Connection Manage Tool.
 * Provides the central LLM agent with native capability to inspect, explore,
 * connect, and disconnect integrations dynamically in response to natural language.
 *
 * Strict Clean Code: English-first, zero `any`, no rigid heuristics, fully typed.
 */

import { z } from 'zod';
import type { IZavorthTool, ToolCategory, ToolDangerLevel, ToolExecutionResult } from '../../types/IZavorthTool.js';
import {
  ConnectionTargetResolver,
  type ConnectionPluginRegistryPort,
} from '../../../services/connection/ConnectionTargetResolver.js';
import { ConnectionVerificationService } from '../../../services/connection/ConnectionVerificationService.js';
import { ConnectionStateStore } from '../../../services/connection/ConnectionStateStore.js';
import { ConnectionOAuthHandshakeService } from '../../../services/connection/ConnectionOAuthHandshakeService.js';
import { ConnectionLockManager } from '../../../services/connection/ConnectionLockManager.js';
import { ZavorthPluginRegistryService } from '../../../services/ZavorthPluginRegistryService.js';
import { logger } from '../../../logger.js';

const connectionManageSchema = z.object({
  action: z.enum(['list', 'catalog', 'connect', 'disconnect']).describe('Action to perform on integrations'),
  target: z.string().optional().describe('Target service identifier (e.g. github, stripe, obsidian, claude)'),
  credentials: z.string().optional().describe('API key, token, or local directory path for connection'),
  userId: z.string().optional().describe('User identifier context'),
});

export class ConnectionManageTool implements IZavorthTool {
  public readonly name = 'connection_manage';
  public readonly description =
    'Inspects, explores, connects, or disconnects external services, plugins, and OAuth integrations. Use this tool when the user asks to see active connections, browse available integrations, connect an API key or local path, or disconnect a service.';
  public readonly schema = connectionManageSchema;
  public readonly category: ToolCategory = 'INTERNAL';
  public readonly dangerLevel: ToolDangerLevel = 'moderate';
  public readonly requiresPermission = false;

  private readonly resolver: ConnectionTargetResolver;
  private readonly verifier: ConnectionVerificationService;
  private readonly stateStore: ConnectionStateStore;
  private readonly handshakeService: ConnectionOAuthHandshakeService;
  private readonly lockManager: ConnectionLockManager;

  constructor(options?: {
    resolver?: ConnectionTargetResolver;
    verifier?: ConnectionVerificationService;
    stateStore?: ConnectionStateStore;
    handshakeService?: ConnectionOAuthHandshakeService;
    lockManager?: ConnectionLockManager;
  }) {
    const pluginRegistryPort: ConnectionPluginRegistryPort = {
      listEntries: () => {
        try {
          const registry = new ZavorthPluginRegistryService();
          const snapshot = registry.buildSnapshot();
          return snapshot.entries.map(entry => ({
            manifest: {
              id: entry.id,
              label: entry.label,
              description: entry.summary,
            },
          }));
        } catch {
          return [];
        }
      },
    };

    this.resolver = options?.resolver || new ConnectionTargetResolver({ pluginRegistry: pluginRegistryPort });
    this.verifier = options?.verifier || new ConnectionVerificationService();
    this.stateStore = options?.stateStore || ConnectionStateStore.getInstance();
    this.handshakeService =
      options?.handshakeService || new ConnectionOAuthHandshakeService({ stateStore: this.stateStore });
    this.lockManager = options?.lockManager || ConnectionLockManager.getInstance();
  }

  public async execute(
    params: z.infer<typeof connectionManageSchema>,
    context?: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    const userId = params.userId || String(context?.userId || 'default-user').trim() || 'default-user';

    switch (params.action) {
      case 'catalog': {
        const supported = this.resolver.listSupportedTargets();
        return {
          success: true,
          message: `Found ${supported.length} available targets in catalog.`,
          data: {
            catalog: supported,
          },
        };
      }

      case 'list': {
        const connections = await this.stateStore.listConnections(userId);
        return {
          success: true,
          message: `Found ${connections.length} active connection(s) for user.`,
          data: {
            connections: connections.map(c => ({
              targetId: c.targetId,
              displayName: c.displayName,
              authType: c.authType,
              status: c.status,
              connectedAt: c.connectedAt,
              updatedAt: c.updatedAt,
            })),
          },
        };
      }

      case 'disconnect': {
        const target = String(params.target || '').trim().toLowerCase();
        if (!target) {
          return {
            success: false,
            error: 'Target parameter is required for disconnect action.',
          };
        }

        // Abort any in-flight handshake for this target
        await this.lockManager.abortInFlight(userId, target);

        const existing = await this.stateStore.getConnection(userId, target);
        if (!existing || existing.status === 'disconnected') {
          return {
            success: true,
            message: `Target '${target}' is not currently connected.`,
            data: { disconnected: false, target },
          };
        }

        const resolution = await this.resolver.resolve(target);
        if (resolution.descriptor && existing.secretRef) {
          try {
            const secret = await this.stateStore.getSecret(existing.secretRef);
            if (secret) {
              await this.verifier.revoke(target, resolution.descriptor, secret);
            }
          } catch {
            // Continues local purge
          }
          try {
            await this.stateStore.deleteSecret(existing.secretRef);
          } catch {
            // Soft cleanup
          }
        }

        await this.stateStore.deleteConnection(userId, target);
        return {
          success: true,
          message: `Disconnected from ${existing.displayName} and purged local credentials.`,
          data: {
            disconnected: true,
            target,
            displayName: existing.displayName,
          },
        };
      }

      case 'connect': {
        const target = String(params.target || '').trim().toLowerCase();
        if (!target) {
          return {
            success: false,
            error: 'Target parameter is required for connect action.',
          };
        }

        const resolution = await this.resolver.resolve(target);
        if (resolution.source === 'unknown' || !resolution.descriptor || !resolution.cardDescriptor) {
          return {
            success: false,
            error: resolution.error || `Target '${target}' is not recognized.`,
          };
        }

        const lock = await this.lockManager.acquireLock(userId, target);
        if (!lock.acquired) {
          return {
            success: false,
            error: lock.error || 'A connection handshake is already in progress.',
          };
        }

        try {
          const { descriptor, cardDescriptor } = resolution;
          const cred = String(params.credentials || '').trim();

          if (descriptor.authType === 'local_path') {
            if (!cred) {
              return {
                success: false,
                message: `To connect ${cardDescriptor.displayName}, provide the local directory path.`,
                data: { requiresInput: 'local_path', target },
              };
            }

            const verifyRes = await this.verifier.verify(target, descriptor, { localPath: cred });
            if (!verifyRes.ok) {
              return {
                success: false,
                error: `Verification failed: ${verifyRes.details} (${verifyRes.error || 'Invalid path'})`,
              };
            }

            const now = new Date().toISOString();
            await this.stateStore.saveConnection({
              userId,
              targetId: target,
              displayName: cardDescriptor.displayName,
              authType: 'local_path',
              status: 'connected',
              localPath: cred,
              connectedAt: now,
              updatedAt: now,
            });

            return {
              success: true,
              message: `Connected to ${cardDescriptor.displayName} successfully! Local directory verified at: ${cred}`,
              data: { target, displayName: cardDescriptor.displayName, status: 'connected' },
            };
          }

          if (descriptor.authType === 'api_key') {
            if (!cred) {
              return {
                success: false,
                message: `To connect ${cardDescriptor.displayName}, provide your ${descriptor.apiKey?.label || 'API Key'}.`,
                data: { requiresInput: 'api_key', target },
              };
            }

            const verifyRes = await this.verifier.verify(target, descriptor, { apiKey: cred });
            if (!verifyRes.ok) {
              return {
                success: false,
                error: `Verification failed: ${verifyRes.details} (${verifyRes.error || 'Invalid key'})`,
              };
            }

            const secretRef = await this.stateStore.saveSecret(target, cred);
            const now = new Date().toISOString();
            await this.stateStore.saveConnection({
              userId,
              targetId: target,
              displayName: cardDescriptor.displayName,
              authType: 'api_key',
              status: 'connected',
              secretRef,
              connectedAt: now,
              updatedAt: now,
            });

            return {
              success: true,
              message: `Connected to ${cardDescriptor.displayName} successfully! Credentials encrypted in vault.`,
              data: { target, displayName: cardDescriptor.displayName, status: 'connected' },
            };
          }

          if (descriptor.authType === 'oauth2') {
            if (descriptor.oauth?.supportsDeviceCode) {
              const deviceUrl =
                cardDescriptor.deviceCodeVerificationUrl ||
                descriptor.oauth.verificationUri ||
                descriptor.oauth.deviceCodeUrl;

              if (!deviceUrl) {
                return {
                  success: false,
                  error: `Provider '${target}' declares device code support but has no verification URL configured.`,
                };
              }

              return {
                success: true,
                message: `Device Code OAuth flow instructions for ${cardDescriptor.displayName}. Open the verification link in your browser.`,
                data: {
                  target,
                  displayName: cardDescriptor.displayName,
                  authType: 'oauth2',
                  flowType: 'device_code',
                  verificationUrl: deviceUrl,
                  supportsDeviceCode: true,
                },
              };
            }

            if (descriptor.oauth?.authorizationUrl) {
              const clientId = descriptor.oauth.clientId || `${target}-client`;
              try {
                const flow = await this.handshakeService.prepareAuthCodeFlow(target, descriptor, clientId);
                return {
                  success: true,
                  message: `Authorization URL prepared for ${cardDescriptor.displayName} with PKCE protection.`,
                  data: {
                    target,
                    displayName: cardDescriptor.displayName,
                    authType: 'oauth2',
                    flowType: 'authorization_code_pkce',
                    authorizationUrl: flow.authorizationUrl,
                    redirectUri: flow.serverInstance.redirectUri,
                  },
                };
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                logger.warn(`[ConnectionManageTool] Ephemeral loopback server failed to start: ${msg}`);
                return {
                  success: true,
                  message: `OAuth authorization link for ${cardDescriptor.displayName}`,
                  data: {
                    target,
                    displayName: cardDescriptor.displayName,
                    authType: 'oauth2',
                    authorizationUrl: descriptor.oauth.authorizationUrl,
                    fallbackWarning: `Loopback listener could not start (${msg}). Manual authorization required.`,
                  },
                };
              }
            }

            return {
              success: true,
              message: `OAuth flow ready for ${cardDescriptor.displayName}`,
              data: {
                target,
                displayName: cardDescriptor.displayName,
                authType: 'oauth2',
              },
            };
          }

          const now = new Date().toISOString();
          await this.stateStore.saveConnection({
            userId,
            targetId: target,
            displayName: cardDescriptor.displayName,
            authType: descriptor.authType,
            status: 'connected',
            connectedAt: now,
            updatedAt: now,
          });

          return {
            success: true,
            message: `Connected to ${cardDescriptor.displayName}.`,
            data: { target, displayName: cardDescriptor.displayName, status: 'connected' },
          };
      } finally {
        if (resolution.descriptor?.authType !== 'oauth2') {
          await this.lockManager.releaseLock(userId, target);
        }
      }
    }
  }
}
}
