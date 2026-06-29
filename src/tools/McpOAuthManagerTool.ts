/**
 * McpOAuthManagerTool — Tool wrapper for MCP OAuth token management.
 *
 * Exposes McpOAuthManager functionality through the tool registry,
 * allowing the agent to manage OAuth tokens for MCP servers.
 *
 * Actions: getToken, clearTokens, getStatus, revokeToken
 */

import { BaseTool } from './BaseTool.js';
import { McpOAuthManager } from '../mcp/McpOAuthManager.js';

export class McpOAuthManagerTool extends BaseTool {
  public readonly name = 'mcp_oauth_manager';
  public readonly description = 'Manage OAuth 2.1 tokens for MCP servers. Actions: getToken, clearTokens, getStatus';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['getToken', 'clearTokens', 'getStatus'],
        description: 'Action to perform.',
      },
      tokenPath: {
        type: 'string',
        description: 'Path to store tokens (required for getToken).',
      },
      clientId: {
        type: 'string',
        description: 'OAuth client ID (required for getToken).',
      },
      clientSecret: {
        type: 'string',
        description: 'OAuth client secret (optional).',
      },
      tokenEndpoint: {
        type: 'string',
        description: 'Token endpoint URL (required for getToken).',
      },
      scopes: {
        type: 'array',
        items: { type: 'string' },
        description: 'OAuth scopes (optional).',
      },
    },
    required: ['action'],
  };

  private managers = new Map<string, McpOAuthManager>();

  private getManager(args: Record<string, unknown>): McpOAuthManager | null {
    const tokenPath = String(args.tokenPath || '');
    if (!tokenPath) return null;

    let manager = this.managers.get(tokenPath);
    if (!manager) {
      const clientId = String(args.clientId || '');
      const clientSecret = args.clientSecret ? String(args.clientSecret) : undefined;
      const tokenEndpoint = String(args.tokenEndpoint || '');
      const scopes = Array.isArray(args.scopes) ? args.scopes.map(String) : undefined;

      if (!clientId || !tokenEndpoint) return null;

      manager = new McpOAuthManager({
        tokenPath,
        clientId,
        clientSecret,
        tokenEndpoint,
        scopes,
      });
      this.managers.set(tokenPath, manager);
    }

    return manager;
  }

  async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');

    switch (action) {
      case 'getToken': {
        const manager = this.getManager(args);
        if (!manager) return 'Error: tokenPath, clientId, and tokenEndpoint are required.';

        try {
          const token = await manager.getAccessToken();
          const expiresIn = Math.round((token.expiresAt - Date.now()) / 1000);
          return `Token obtained. Expires in ${expiresIn}s. Type: ${token.tokenType}`;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          return `Error obtaining token: ${message}`;
        }
      }

      case 'clearTokens': {
        const manager = this.getManager(args);
        if (!manager) return 'Error: tokenPath is required.';

        manager.clearTokens();
        return 'Tokens cleared.';
      }

      case 'getStatus': {
        const manager = this.getManager(args);
        if (!manager) return 'Error: tokenPath is required.';

        const status = manager.getStatus();
        const lines = [
          `Has tokens: ${status.hasTokens}`,
          `Is expired: ${status.isExpired}`,
          `Expires at: ${status.expiresAt ? new Date(status.expiresAt).toISOString() : 'N/A'}`,
          `Dead client: ${status.isDeadClient}`,
          `Pending refreshes: ${status.pendingRefreshes}`,
        ];
        return lines.join('\n');
      }

      default:
        return `Unknown action: ${action}. Valid actions: getToken, clearTokens, getStatus`;
    }
  }
}
