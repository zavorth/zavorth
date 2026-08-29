/**
 * Connection OAuth Handshake Service.
 * Coordinates OAuth 2.0 Authorization Code Flow with PKCE (RFC 7636)
 * and Device Authorization Grant (RFC 8628).
 *
 * Strict Clean Code: English-first, zero `any`, no rigid heuristics, fully typed.
 */

import * as crypto from 'node:crypto';
import type { PluginConnectionDescriptor } from '../../contracts/connection/index.js';
import { LocalOAuthCallbackServer, type LocalOAuthServerInstance } from './LocalOAuthCallbackServer.js';
import { ConnectionStateStore } from './ConnectionStateStore.js';
import { logger } from '../../logger.js';

export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  scope?: string;
  raw?: Record<string, unknown>;
}

export interface DeviceCodeInitiationResult {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export interface OAuthHandshakeResult {
  success: boolean;
  targetId: string;
  tokens?: OAuthTokenResponse;
  error?: string;
}

export interface ConnectionOAuthHandshakeServiceOptions {
  callbackServer?: LocalOAuthCallbackServer;
  stateStore?: ConnectionStateStore;
  requestTimeoutMs?: number;
}

export class ConnectionOAuthHandshakeService {
  private readonly callbackServer: LocalOAuthCallbackServer;
  private readonly stateStore: ConnectionStateStore;
  private readonly requestTimeoutMs: number;

  constructor(options: ConnectionOAuthHandshakeServiceOptions = {}) {
    this.callbackServer = options.callbackServer || new LocalOAuthCallbackServer();
    this.stateStore = options.stateStore || ConnectionStateStore.getInstance();
    this.requestTimeoutMs = options.requestTimeoutMs || 30000;
  }

  /**
   * Generates a cryptographically secure random PKCE code verifier (RFC 7636).
   * Generates 32 random bytes converted to base64url (43 characters).
   */
  public generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generates a PKCE code challenge from a code verifier using SHA-256 (RFC 7636 S256).
   */
  public generateCodeChallenge(codeVerifier: string): string {
    return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  }

  /**
   * Initiates an RFC 8628 Device Authorization flow for device-code enabled targets (e.g. GitHub).
   */
  public async initiateDeviceCodeFlow(
    targetId: string,
    descriptor: PluginConnectionDescriptor,
    clientId: string
  ): Promise<DeviceCodeInitiationResult> {
    const deviceCodeUrl = descriptor.oauth?.deviceCodeUrl;
    if (!deviceCodeUrl) {
      throw new Error(`Target '${targetId}' does not declare a deviceCodeUrl.`);
    }

    const scopes = (descriptor.oauth?.scopes || []).join(' ');
    const params = new URLSearchParams({
      client_id: clientId,
      scope: scopes,
    });

    const response = await fetch(deviceCodeUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Device code initiation failed (HTTP ${response.status}): ${errBody}`);
    }

    const data = (await response.json()) as Record<string, unknown>;

    return {
      deviceCode: String(data.device_code || ''),
      userCode: String(data.user_code || ''),
      verificationUri: String(data.verification_uri || data.verification_url || 'https://github.com/login/device'),
      expiresIn: typeof data.expires_in === 'number' ? data.expires_in : 900,
      interval: typeof data.interval === 'number' ? data.interval : 5,
    };
  }

  /**
   * Polls token endpoint for Device Code Flow completion (RFC 8628).
   */
  public async pollDeviceToken(
    targetId: string,
    descriptor: PluginConnectionDescriptor,
    clientId: string,
    deviceCode: string,
    options?: { maxAttempts?: number; pollIntervalSec?: number }
  ): Promise<OAuthTokenResponse> {
    const tokenUrl = descriptor.oauth?.tokenUrl;
    if (!tokenUrl) {
      throw new Error(`Target '${targetId}' does not declare a tokenUrl.`);
    }

    const maxAttempts = options?.maxAttempts || 60;
    let pollIntervalMs = (options?.pollIntervalSec || 5) * 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

      const params = new URLSearchParams({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      if (response.ok) {
        const json = (await response.json()) as Record<string, unknown>;
        if (json.access_token) {
          return {
            accessToken: String(json.access_token),
            refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
            tokenType: json.token_type ? String(json.token_type) : undefined,
            expiresIn: typeof json.expires_in === 'number' ? json.expires_in : undefined,
            scope: json.scope ? String(json.scope) : undefined,
            raw: json,
          };
        }

        const error = String(json.error || '');
        if (error === 'authorization_pending') {
          continue;
        }

        if (error === 'slow_down') {
          pollIntervalMs += 5000;
          continue;
        }

        if (error === 'expired_token') {
          throw new Error('Device code expired. Please restart authorization.');
        }

        if (error === 'access_denied') {
          throw new Error('User declined authorization.');
        }

        throw new Error(`OAuth error: ${json.error_description || error}`);
      }
    }

    throw new Error('Device authorization timed out. Please try again.');
  }

  /**
   * Prepares the Authorization Code URL with PKCE and starts the local callback server.
   */
  public async prepareAuthCodeFlow(
    targetId: string,
    descriptor: PluginConnectionDescriptor,
    clientId: string,
    options?: { timeoutMs?: number }
  ): Promise<{
    serverInstance: LocalOAuthServerInstance;
    authorizationUrl: string;
    codeVerifier: string;
  }> {
    const rawAuthUrl = descriptor.oauth?.authorizationUrl;
    if (!rawAuthUrl) {
      throw new Error(`Target '${targetId}' does not support Authorization Code flow (missing authorizationUrl).`);
    }

    const serverInstance = await this.callbackServer.start({
      timeoutMs: options?.timeoutMs,
    });

    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);

    const url = new URL(rawAuthUrl);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', serverInstance.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', serverInstance.state);

    if (descriptor.oauth?.scopes && descriptor.oauth.scopes.length > 0) {
      url.searchParams.set('scope', descriptor.oauth.scopes.join(' '));
    }

    if (descriptor.usePkce) {
      url.searchParams.set('code_challenge', codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
    }

    return {
      serverInstance,
      authorizationUrl: url.toString(),
      codeVerifier,
    };
  }

  /**
   * Completes the Authorization Code exchange after callback is received.
   */
  public async exchangeAuthCode(
    targetId: string,
    descriptor: PluginConnectionDescriptor,
    clientId: string,
    code: string,
    redirectUri: string,
    codeVerifier: string,
    clientSecret?: string
  ): Promise<OAuthTokenResponse> {
    const tokenUrl = descriptor.oauth?.tokenUrl;
    if (!tokenUrl) {
      throw new Error(`Target '${targetId}' does not declare a tokenUrl.`);
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier,
    });

    if (clientSecret) {
      params.set('client_secret', clientSecret);
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
      throw new Error(`Token exchange failed (HTTP ${response.status}): ${errBody}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    if (!data.access_token) {
      throw new Error(`OAuth response missing access_token: ${JSON.stringify(data)}`);
    }

    return {
      accessToken: String(data.access_token),
      refreshToken: data.refresh_token ? String(data.refresh_token) : undefined,
      tokenType: data.token_type ? String(data.token_type) : undefined,
      expiresIn: typeof data.expires_in === 'number' ? data.expires_in : undefined,
      scope: data.scope ? String(data.scope) : undefined,
      raw: data,
    };
  }

  /**
   * Executes the full end-to-end Authorization Code flow with PKCE.
   */
  public async executeAuthCodeHandshake(
    userId: string,
    targetId: string,
    descriptor: PluginConnectionDescriptor,
    clientId: string,
    clientSecret?: string
  ): Promise<OAuthHandshakeResult> {
    try {
      const { serverInstance, codeVerifier } = await this.prepareAuthCodeFlow(
        targetId,
        descriptor,
        clientId
      );

      const callbackResult = await serverInstance.waitForCallback();

      const tokens = await this.exchangeAuthCode(
        targetId,
        descriptor,
        clientId,
        callbackResult.code,
        serverInstance.redirectUri,
        codeVerifier,
        clientSecret
      );

      const secretRef = await this.stateStore.saveSecret(targetId, tokens.accessToken);
      const now = new Date().toISOString();

      await this.stateStore.saveConnection({
        userId,
        targetId,
        displayName: targetId,
        authType: 'oauth2',
        status: 'connected',
        secretRef,
        connectedAt: now,
        updatedAt: now,
      });

      return {
        success: true,
        targetId,
        tokens,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[ConnectionOAuthHandshakeService] OAuth handshake failed for '${targetId}': ${msg}`);
      return {
        success: false,
        targetId,
        error: msg,
      };
    }
  }
}
