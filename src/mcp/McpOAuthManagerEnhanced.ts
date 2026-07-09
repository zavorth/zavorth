/**
 * McpOAuthManagerEnhanced — Full OAuth 2.1 management for MCP servers.
 *
 * Features over base version:
 * - Auto-refresh timer: refreshes token before expiry
 * - Multiple provider support: manage tokens for multiple MCP servers
 * - Token metadata: tracks provider, scopes, refresh count
 * - Proactive refresh: refreshes at 80% of token lifetime
 * - Graceful degradation: falls back to client credentials on refresh failure
 *
 * Usage:
 *   const manager = new McpOAuthManagerEnhanced({
 *     defaultTokenPath: '.zavorth/mcp-tokens.json',
 *     providers: {
 *       'github': { clientId: 'xxx', tokenEndpoint: 'https://github.com/login/oauth/access_token' },
 *       'google': { clientId: 'yyy', tokenEndpoint: 'https://oauth2.googleapis.com/token' },
 *     },
 *   });
 *   const token = await manager.getAccessToken('github');
 */

import fs from 'fs';
import path from 'path';

export interface ProviderConfig {
  clientId: string;
  clientSecret?: string;
  tokenEndpoint: string;
  scopes?: string[];
  tokenPath?: string;
}

export interface McpOAuthManagerEnhancedOptions {
  defaultTokenPath: string;
  providers?: Record<string, ProviderConfig>;
  refreshThresholdPercent?: number;
  maxRefreshRetries?: number;
}

export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType: string;
  scope?: string;
}

export interface TokenMetadata {
  provider: string;
  clientId: string;
  scopes: string[];
  refreshCount: number;
  lastRefreshedAt: number;
  lastUsedAt: number;
  createdAt: number;
}

interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType: string;
  scope?: string;
  metadata: TokenMetadata;
}

interface ProviderState {
  config: ProviderConfig;
  cachedTokens: TokenData | null;
  metadata: TokenMetadata | null;
  lastFileMtime: number;
  refreshTimer: ReturnType<typeof setTimeout> | null;
  refreshPromise: Promise<TokenData> | null;
}

export class McpOAuthManagerEnhanced {
  private readonly defaultTokenPath: string;
  private readonly refreshThreshold: number;
  private readonly maxRetries: number;
  private readonly providers = new Map<string, ProviderState>();
  private readonly deadClients = new Set<string>();

  constructor(options: McpOAuthManagerEnhancedOptions) {
    this.defaultTokenPath = options.defaultTokenPath;
    this.refreshThreshold = options.refreshThresholdPercent ?? 0.8;
    this.maxRetries = options.maxRefreshRetries ?? 3;

    if (options.providers) {
      for (const [name, config] of Object.entries(options.providers)) {
        this.registerProvider(name, config);
      }
    }
  }

  /**
   * Registers a new OAuth provider.
   */
  registerProvider(name: string, config: ProviderConfig): void {
    const tokenPath = config.tokenPath ?? path.join(
      path.dirname(this.defaultTokenPath),
      `${name}-tokens.json`,
    );

    this.providers.set(name, {
      config: { ...config, tokenPath },
      cachedTokens: null,
      metadata: null,
      lastFileMtime: 0,
      refreshTimer: null,
      refreshPromise: null,
    });
  }

  /**
   * Gets a valid access token for the specified provider.
   * Auto-refreshes before expiry.
   */
  async getAccessToken(provider: string = 'default'): Promise<TokenData> {
    const state = this.getProviderState(provider);
    if (!state) {
      throw new Error(`Provider "${provider}" not registered.`);
    }

    // Check memory cache
    const cached = await this.getFromDiskCache(state);
    if (cached && !this.isExpired(cached)) {
      this.scheduleRefreshIfNeeded(state, cached);
      return cached;
    }

    // Deduplicate concurrent refreshes
    if (state.refreshPromise) {
      return state.refreshPromise;
    }

    // Perform refresh
    state.refreshPromise = this.performRefresh(state);
    try {
      const result = await state.refreshPromise;
      return result;
    } finally {
      state.refreshPromise = null;
    }
  }

  /**
   * Gets token metadata for a provider.
   */
  getMetadata(provider: string = 'default'): TokenMetadata | null {
    const state = this.providers.get(provider);
    return state?.metadata ?? null;
  }

  /**
   * Lists all registered providers and their status.
   */
  listProviders(): Array<{
    name: string;
    hasTokens: boolean;
    isExpired: boolean;
    expiresAt: number | null;
    refreshCount: number;
  }> {
    const result: Array<{
      name: string;
      hasTokens: boolean;
      isExpired: boolean;
      expiresAt: number | null;
      refreshCount: number;
    }> = [];

    for (const [name, state] of this.providers) {
      const tokens = state.cachedTokens;
      result.push({
        name,
        hasTokens: tokens !== null,
        isExpired: tokens ? this.isExpired(tokens) : true,
        expiresAt: tokens?.expiresAt ?? null,
        refreshCount: state.metadata?.refreshCount ?? 0,
      });
    }

    return result;
  }

  private getProviderState(provider: string): ProviderState | undefined {
    return this.providers.get(provider);
  }

  private async performRefresh(state: ProviderState): Promise<TokenData> {
    const stored = await this.readStoredTokens(state);

    if (stored?.refreshToken) {
      for (let attempt = 0; attempt < this.maxRetries; attempt++) {
        try {
          return await this.refreshWithToken(state, stored.refreshToken);
        } catch (error: any) { const err = error; const e = error;
          if (this.isInvalidClientError(error)) {
            this.deadClients.add(state.config.clientId);
            throw new Error('Client ID invalid. Re-registration required.');
          }
          if (attempt === this.maxRetries - 1) break;
          await this.delay(1000 * Math.pow(2, attempt));
        }
      }
    }

    // Fallback: client credentials
    return await this.clientCredentialsGrant(state);
  }

  private async refreshWithToken(state: ProviderState, refreshToken: string): Promise<TokenData> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: state.config.clientId,
      client_secret: state.config.clientSecret ?? '',
      refresh_token: refreshToken,
    });

    const response = await fetch(state.config.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Refresh failed (${response.status}): ${errorBody}`);
    }

    const data = await response.json() as Record<string, unknown>;
    return this.parseTokenResponse(state, data);
  }

  private async clientCredentialsGrant(state: ProviderState): Promise<TokenData> {
    const params: Record<string, string> = {
      grant_type: 'client_credentials',
      client_id: state.config.clientId,
      client_secret: state.config.clientSecret ?? '',
    };

    if (state.config.scopes && state.config.scopes.length > 0) {
      params.scope = state.config.scopes.join(' ');
    }

    const body = new URLSearchParams(params);

    const response = await fetch(state.config.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Client credentials failed (${response.status}): ${errorBody}`);
    }

    const data = await response.json() as Record<string, unknown>;
    return this.parseTokenResponse(state, data);
  }

  private parseTokenResponse(state: ProviderState, data: Record<string, unknown>): TokenData {
    const expiresIn = Number(data.expires_in) || 3600;
    const now = Date.now();

    const token: TokenData = {
      accessToken: String(data.access_token),
      refreshToken: data.refresh_token ? String(data.refresh_token) : undefined,
      expiresAt: now + expiresIn * 1000,
      tokenType: String(data.token_type || 'Bearer'),
      scope: data.scope ? String(data.scope) : undefined,
    };

    // Update metadata
    const existingMetadata = state.metadata;
    state.metadata = {
      provider: this.getProviderName(state),
      clientId: state.config.clientId,
      scopes: state.config.scopes ?? [],
      refreshCount: (existingMetadata?.refreshCount ?? 0) + 1,
      lastRefreshedAt: now,
      lastUsedAt: now,
      createdAt: existingMetadata?.createdAt ?? now,
    };

    // Persist
    this.writeStoredTokens(state, token);
    this.scheduleRefreshIfNeeded(state, token);

    return token;
  }

  private scheduleRefreshIfNeeded(state: ProviderState, token: TokenData): void {
    if (state.refreshTimer) {
      clearTimeout(state.refreshTimer);
      state.refreshTimer = null;
    }

    const now = Date.now();
    const lifetime = token.expiresAt - now;
    const refreshAt = lifetime * (1 - this.refreshThreshold);

    if (refreshAt > 0) {
      state.refreshTimer = setTimeout(async () => {
        try {
          await this.getAccessToken(this.getProviderName(state));
        } catch (error: any) { const err = error; const e = error;
          // Silent failure - will retry on next getAccessToken call
        }
      }, refreshAt);
    }
  }

  private isExpired(token: TokenData): boolean {
    return Date.now() > token.expiresAt - 30_000;
  }

  private isInvalidClientError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('invalid_client') || message.includes('unauthorized_client');
  }

  private writeStoredTokens(state: ProviderState, token: TokenData): void {
    const tokenPath = state.config.tokenPath!;
    const dir = path.dirname(tokenPath);
    fs.mkdirSync(dir, { recursive: true });

    const stored: StoredTokens = {
      ...token,
      metadata: state.metadata!,
    };

    fs.writeFileSync(tokenPath, JSON.stringify(stored, null, 2), 'utf-8');
    state.cachedTokens = token;
  }

  private async readStoredTokens(state: ProviderState): Promise<TokenData | null> {
    const tokenPath = state.config.tokenPath;
    if (!tokenPath || !fs.existsSync(tokenPath)) return null;

    try {
      const stat = fs.statSync(tokenPath);
      if (stat.mtimeMs === state.lastFileMtime && state.cachedTokens) {
        return state.cachedTokens;
      }

      const content = fs.readFileSync(tokenPath, 'utf-8');
      const stored = JSON.parse(content) as StoredTokens;

      state.lastFileMtime = stat.mtimeMs;
      state.cachedTokens = stored;
      state.metadata = stored.metadata;

      return stored;
    } catch (error: any) { const err = error; const e = error;
      return null;
    }
  }

  private async getFromDiskCache(state: ProviderState): Promise<TokenData | null> {
    const tokenPath = state.config.tokenPath;
    if (!tokenPath || !fs.existsSync(tokenPath)) return null;

    const stat = fs.statSync(tokenPath);
    if (stat.mtimeMs === state.lastFileMtime && state.cachedTokens) {
      return state.cachedTokens;
    }

    return await this.readStoredTokens(state);
  }

  private getProviderName(state: ProviderState): string {
    for (const [name, s] of this.providers) {
      if (s === state) return name;
    }
    return 'unknown';
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clears tokens for a provider.
   */
  clearTokens(provider: string = 'default'): void {
    const state = this.providers.get(provider);
    if (!state) return;

    state.cachedTokens = null;
    state.metadata = null;
    if (state.refreshTimer) {
      clearTimeout(state.refreshTimer);
      state.refreshTimer = null;
    }
    if (state.config.tokenPath && fs.existsSync(state.config.tokenPath)) {
      fs.unlinkSync(state.config.tokenPath);
    }
  }

  /**
   * Checks if a client is dead.
   */
  isDeadClient(clientId: string): boolean {
    return this.deadClients.has(clientId);
  }

  /**
   * Resets a dead client.
   */
  resetDeadClient(clientId: string): void {
    this.deadClients.delete(clientId);
  }

  /**
   * Destroys the manager, clearing all timers.
   */
  destroy(): void {
    for (const state of this.providers.values()) {
      if (state.refreshTimer) {
        clearTimeout(state.refreshTimer);
        state.refreshTimer = null;
      }
    }
  }
}
