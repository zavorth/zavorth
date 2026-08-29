/**
 * Connection Token Refresh Service.
 * Proactively checks and refreshes expiring OAuth2 access tokens in the background,
 * maintaining persistent health statuses (healthy, expiring, error).
 *
 * Strict Clean Code: English-first, zero `any`, no rigid heuristics, fully typed.
 */

import { ConnectionStateStore, type StoredConnection, type ConnectionHealthStatus } from './ConnectionStateStore.js';
import { ConnectionTargetResolver } from './ConnectionTargetResolver.js';
import { logger } from '../../logger.js';

export interface TokenRefreshSummary {
  checkedCount: number;
  refreshedCount: number;
  failedCount: number;
  results: Array<{
    userId: string;
    targetId: string;
    refreshed: boolean;
    error?: string;
  }>;
}

export interface ConnectionTokenRefreshServiceOptions {
  stateStore?: ConnectionStateStore;
  resolver?: ConnectionTargetResolver;
  refreshLeadTimeMs?: number; // Time window before expiry to trigger refresh (default 5 min = 300,000ms)
}

export class ConnectionTokenRefreshService {
  private readonly stateStore: ConnectionStateStore;
  private readonly resolver: ConnectionTargetResolver;
  private readonly refreshLeadTimeMs: number;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(options: ConnectionTokenRefreshServiceOptions = {}) {
    this.stateStore = options.stateStore || ConnectionStateStore.getInstance();
    this.resolver = options.resolver || new ConnectionTargetResolver({ pluginRegistry: { listEntries: () => [] } });
    this.refreshLeadTimeMs = options.refreshLeadTimeMs || 300000; // 5 minutes
  }

  /**
   * Checks all stored connections and refreshes those nearing expiration.
   */
  public async checkAndRefreshAll(userId?: string): Promise<TokenRefreshSummary> {
    const connections: StoredConnection[] = await this.stateStore.listConnections(userId);
    const now = Date.now();

    const summary: TokenRefreshSummary = {
      checkedCount: 0,
      refreshedCount: 0,
      failedCount: 0,
      results: [],
    };

    for (const conn of connections) {
      if (conn.authType !== 'oauth2' || !conn.refreshTokenRef || !conn.expiresAt) {
        continue;
      }

      summary.checkedCount++;
      const expiryTime = new Date(conn.expiresAt).getTime();
      const timeRemaining = expiryTime - now;

      // Only refresh if expiring within the lead time (or already expired)
      if (timeRemaining > this.refreshLeadTimeMs) {
        continue;
      }

      try {
        const resolution = await this.resolver.resolve(conn.targetId);
        const tokenUrl = resolution.descriptor?.oauth?.tokenUrl;

        if (!tokenUrl) {
          throw new Error(`Target '${conn.targetId}' does not declare a tokenUrl for refresh.`);
        }

        const refreshToken = await this.stateStore.getSecret(conn.refreshTokenRef);
        if (!refreshToken) {
          throw new Error(`No refresh token found in vault for reference '${conn.refreshTokenRef}'.`);
        }

        const clientId = resolution.descriptor?.oauth?.clientId || `${conn.targetId}-client`;
        const params = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
        });

        if (resolution.descriptor?.oauth?.clientSecret) {
          params.set('client_secret', resolution.descriptor.oauth.clientSecret);
        }

        const response = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params,
        });

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status}: ${errBody}`);
        }

        const data = (await response.json()) as Record<string, unknown>;
        if (!data.access_token) {
          throw new Error(`Token endpoint response missing access_token: ${JSON.stringify(data)}`);
        }

        // Store new access token
        const newSecretRef = await this.stateStore.saveSecret(conn.targetId, String(data.access_token));

        // If a new refresh token was rotated in, update it
        let newRefreshTokenRef = conn.refreshTokenRef;
        if (data.refresh_token) {
          newRefreshTokenRef = await this.stateStore.saveSecret(conn.targetId, String(data.refresh_token));
        }

        const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
        const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
        const updatedNow = new Date().toISOString();

        await this.stateStore.saveConnection({
          ...conn,
          secretRef: newSecretRef,
          refreshTokenRef: newRefreshTokenRef,
          expiresAt: newExpiresAt,
          status: 'connected',
          healthStatus: 'healthy',
          updatedAt: updatedNow,
        });

        summary.refreshedCount++;
        summary.results.push({
          userId: conn.userId,
          targetId: conn.targetId,
          refreshed: true,
        });

        logger.info(`[ConnectionTokenRefreshService] Refreshed token for '${conn.targetId}' (user: ${conn.userId}).`);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        summary.failedCount++;
        summary.results.push({
          userId: conn.userId,
          targetId: conn.targetId,
          refreshed: false,
          error: errorMsg,
        });

        logger.warn(
          `[ConnectionTokenRefreshService] Failed to refresh token for '${conn.targetId}' (user: ${conn.userId}): ${errorMsg}`
        );

        // Mark connection health status as error so UI/CLI can notify user
        await this.stateStore.saveConnection({
          ...conn,
          healthStatus: 'error',
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return summary;
  }

  /**
   * Starts background loop for periodic token expiration check.
   */
  public startProactiveRefreshLoop(intervalMs: number = 60000): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(() => {
      void this.checkAndRefreshAll();
    }, intervalMs);

    this.refreshTimer.unref();
  }

  /**
   * Stops the background proactive refresh loop.
   */
  public stopProactiveRefreshLoop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
