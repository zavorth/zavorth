/**
 * McpOAuthManager — OAuth 2.1 token management for MCP.
 *
 * Implements automatic token refresh with disk persistence,
 * mtime-based change detection, and 401 request deduplication.
 *
 * Usage:
 *   const manager = new McpOAuthManager({
 *     tokenPath: '.zavorth/mcp-tokens.json',
 *     clientId: 'zavorth-mcp',
 *     tokenEndpoint: 'https://auth.example.com/oauth/token',
 *   });
 *   const token = await manager.getAccessToken();
 */

import fs from 'fs';
import path from 'path';

export interface McpOAuthManagerOptions {
  tokenPath: string;
  clientId: string;
  clientSecret?: string;
  tokenEndpoint: string;
  scopes?: string[];
}

export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType: string;
  scope?: string;
}

interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType: string;
  scope?: string;
  lastModified: number;
}

export class McpOAuthManager {
  private readonly tokenPath: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly tokenEndpoint: string;
  private readonly scopes: string[];

  private cachedTokens: TokenData | null = null;
  private lastFileMtime = 0;
  private refreshPromises = new Map<string, Promise<TokenData>>();
  private deadClients = new Set<string>();

  constructor(options: McpOAuthManagerOptions) {
    this.tokenPath = options.tokenPath;
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret ?? '';
    this.tokenEndpoint = options.tokenEndpoint;
    this.scopes = options.scopes ?? [];
  }

  /**
   * Returns a valid access token. Refreshes if necessary.
   * Deduplicates concurrent requests.
   */
  async getAccessToken(): Promise<TokenData> {
    // Check memory cache
    const cached = await this.getFromDiskCache();
    if (cached && !this.isExpired(cached)) {
      return cached;
    }

    // Check if refresh is in progress
    const pendingKey = 'refresh';
    if (this.refreshPromises.has(pendingKey)) {
      return this.refreshPromises.get(pendingKey)!;
    }

    // Start refresh
    const refreshPromise = this.performRefresh();
    this.refreshPromises.set(pendingKey, refreshPromise);

    try {
      const result = await refreshPromise;
      return result;
    } finally {
      this.refreshPromises.delete(pendingKey);
    }
  }

  /**
   * Performs the token refresh.
   */
  private async performRefresh(): Promise<TokenData> {
    const stored = await this.readStoredTokens();

    if (stored?.refreshToken) {
      try {
        return await this.refreshWithToken(stored.refreshToken);
      } catch (error: unknown) {// If refresh failed with invalid_client, mark as dead
        if (this.isInvalidClientError(error)) {
          this.deadClients.add(this.clientId);
          throw new Error('Invalid client ID. Re-registration required.');
        }
        // If refresh failed, try with client credentials
      }
    }

    // Fallback: client credentials grant
    return await this.clientCredentialsGrant();
  }

  private async refreshWithToken(refreshToken: string): Promise<TokenData> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
    });

    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Refresh failed (${response.status}): ${errorBody}`);
    }

    const data = await response.json() as Record<string, unknown>;
    return this.parseTokenResponse(data);
  }

  private async clientCredentialsGrant(): Promise<TokenData> {
    const params: Record<string, string> = {
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    };

    if (this.scopes.length > 0) {
      params.scope = this.scopes.join(' ');
    }

    const body = new URLSearchParams(params);

    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Client credentials failed (${response.status}): ${errorBody}`);
    }

    const data = await response.json() as Record<string, unknown>;
    return this.parseTokenResponse(data);
  }

  private parseTokenResponse(data: Record<string, unknown>): TokenData {
    const expiresIn = Number(data.expires_in) || 3600;
    const token: TokenData = {
      accessToken: String(data.access_token),
      refreshToken: data.refresh_token ? String(data.refresh_token) : undefined,
      expiresAt: Date.now() + expiresIn * 1000,
      tokenType: String(data.token_type || 'Bearer'),
      scope: data.scope ? String(data.scope) : undefined,
    };

    // Save to disk
    this.writeStoredTokens(token);

    return token;
  }

  private isExpired(token: TokenData): boolean {
    // 30 second margin before expiry
    return Date.now() > token.expiresAt - 30_000;
  }

  private isInvalidClientError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('invalid_client') || message.includes('unauthorized_client');
  }

  /**
   * Saves tokens to disk.
   */
  private writeStoredTokens(token: TokenData): void {
    const dir = path.dirname(this.tokenPath);
    fs.mkdirSync(dir, { recursive: true });

    const stored: StoredTokens = {
      ...token,
      lastModified: Date.now(),
    };

    fs.writeFileSync(this.tokenPath, JSON.stringify(stored, null, 2), 'utf-8');
    this.cachedTokens = token;
  }

  /**
   * Reads tokens from disk.
   */
  private async readStoredTokens(): Promise<TokenData | null> {
    try {
      if (!fs.existsSync(this.tokenPath)) return null;

      const stat = fs.statSync(this.tokenPath);
      const currentMtime = stat.mtimeMs;

      // If the file did not change, use cache.
      if (currentMtime === this.lastFileMtime && this.cachedTokens) {
        return this.cachedTokens;
      }

      const content = fs.readFileSync(this.tokenPath, 'utf-8');
      const stored = JSON.parse(content) as StoredTokens;

      this.lastFileMtime = currentMtime;
      this.cachedTokens = stored;

      return stored;
    } catch (error: unknown) {return null;
    }
  }

  /**
   * Checks if disk changed since last read.
   */
  private async getFromDiskCache(): Promise<TokenData | null> {
    try {
      if (!fs.existsSync(this.tokenPath)) return null;

      const stat = fs.statSync(this.tokenPath);
      if (stat.mtimeMs === this.lastFileMtime && this.cachedTokens) {
        return this.cachedTokens;
      }

      return await this.readStoredTokens();
    } catch (error: unknown) {return null;
    }
  }

  /**
   * Clears stored tokens.
   */
  clearTokens(): void {
    this.cachedTokens = null;
    if (fs.existsSync(this.tokenPath)) {
      fs.unlinkSync(this.tokenPath);
    }
  }

  /**
   * Checks if client is marked as dead.
   */
  isDeadClient(): boolean {
    return this.deadClients.has(this.clientId);
  }

  /**
   * Removes client from dead clients list.
   */
  resetDeadClient(): void {
    this.deadClients.delete(this.clientId);
  }

  /**
   * Returns manager status.
   */
  getStatus(): {
    hasTokens: boolean;
    isExpired: boolean;
    expiresAt: number | null;
    isDeadClient: boolean;
    pendingRefreshes: number;
  } {
    const tokens = this.cachedTokens;
    return {
      hasTokens: tokens !== null,
      isExpired: tokens ? this.isExpired(tokens) : true,
      expiresAt: tokens?.expiresAt ?? null,
      isDeadClient: this.isDeadClient(),
      pendingRefreshes: this.refreshPromises.size,
    };
  }
}
