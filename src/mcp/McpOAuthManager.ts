/**
 * McpOAuthManager — Gerenciamento de tokens OAuth 2.1 para MCP.
 *
 * Implementa refresh automático de tokens com persistência em disco,
 * detecção de mudanças por mtime, e deduplicação de requisições 401.
 *
 * Uso:
 *   const manager = new McpOAuthManager({
 *     tokenPath: '.zavorth/mcp-tokens.json',
 *     clientId: 'zavorth-mcp',
 *     tokenEndpoint: 'https://auth.example.com/oauth/token',
 *   });
 *   const token = await manager.getAccessToken();
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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
   * Retorna um access token válido. Faz refresh se necessário.
   * Deduplica requisições concorrentes.
   */
  async getAccessToken(): Promise<TokenData> {
    // Verificar cache em memória
    const cached = await this.getFromDiskCache();
    if (cached && !this.isExpired(cached)) {
      return cached;
    }

    // Verificar se há refresh em andamento
    const pendingKey = 'refresh';
    if (this.refreshPromises.has(pendingKey)) {
      return this.refreshPromises.get(pendingKey)!;
    }

    // Iniciar refresh
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
   * Realiza o refresh do token.
   */
  private async performRefresh(): Promise<TokenData> {
    const stored = await this.readStoredTokens();

    if (stored?.refreshToken) {
      try {
        return await this.refreshWithToken(stored.refreshToken);
      } catch (error: unknown) {
        // Se refresh falhou com invalid_client, marcar como dead
        if (this.isInvalidClientError(error)) {
          this.deadClients.add(this.clientId);
          throw new Error('Client ID inválido. Re-registro necessário.');
        }
        // Se refresh falhou, tentar com client credentials
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
      throw new Error(`Refresh falhou (${response.status}): ${errorBody}`);
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
      throw new Error(`Client credentials falhou (${response.status}): ${errorBody}`);
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

    // Salvar em disco
    this.writeStoredTokens(token);

    return token;
  }

  private isExpired(token: TokenData): boolean {
    // Margem de 30 segundos antes de expirar
    return Date.now() > token.expiresAt - 30_000;
  }

  private isInvalidClientError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('invalid_client') || message.includes('unauthorized_client');
  }

  /**
   * Salva tokens em disco.
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
   * Lê tokens do disco.
   */
  private async readStoredTokens(): Promise<TokenData | null> {
    try {
      if (!fs.existsSync(this.tokenPath)) return null;

      const stat = fs.statSync(this.tokenPath);
      const currentMtime = stat.mtimeMs;

      // Se o arquivo não mudou, usar cache
      if (currentMtime === this.lastFileMtime && this.cachedTokens) {
        return this.cachedTokens;
      }

      const content = fs.readFileSync(this.tokenPath, 'utf-8');
      const stored = JSON.parse(content) as StoredTokens;

      this.lastFileMtime = currentMtime;
      this.cachedTokens = stored;

      return stored;
    } catch {
      return null;
    }
  }

  /**
   * Verifica se o disco mudou desde a última leitura.
   */
  private async getFromDiskCache(): Promise<TokenData | null> {
    try {
      if (!fs.existsSync(this.tokenPath)) return null;

      const stat = fs.statSync(this.tokenPath);
      if (stat.mtimeMs === this.lastFileMtime && this.cachedTokens) {
        return this.cachedTokens;
      }

      return await this.readStoredTokens();
    } catch {
      return null;
    }
  }

  /**
   * Limpa tokens armazenados.
   */
  clearTokens(): void {
    this.cachedTokens = null;
    if (fs.existsSync(this.tokenPath)) {
      fs.unlinkSync(this.tokenPath);
    }
  }

  /**
   * Verifica se o client está marcado como dead.
   */
  isDeadClient(): boolean {
    return this.deadClients.has(this.clientId);
  }

  /**
   * Remove o client da lista de dead clients.
   */
  resetDeadClient(): void {
    this.deadClients.delete(this.clientId);
  }

  /**
   * Retorna status do manager.
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
