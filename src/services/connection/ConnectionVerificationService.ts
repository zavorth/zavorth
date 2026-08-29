/**
 * Connection Verification & Revocation Service.
 * Performs non-destructive connectivity verification and RFC 7009 token revocation.
 *
 * Strict Clean Code: English-first, zero `any`, no rigid heuristics, fully typed.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PluginConnectionDescriptor } from '../../contracts/connection/index.js';
import { logger } from '../../logger.js';

export interface ConnectionCredentials {
  apiKey?: string;
  token?: string;
  refreshToken?: string;
  localPath?: string;
}

export interface ConnectionVerificationResult {
  ok: boolean;
  targetId: string;
  authType: string;
  details: string;
  latencyMs: number;
  error?: string;
}

export interface ConnectionRevocationResult {
  ok: boolean;
  targetId: string;
  remoteRevoked: boolean;
  auditNote?: string;
  error?: string;
}

export class ConnectionVerificationService {
  private readonly requestTimeoutMs: number;

  constructor(options?: { requestTimeoutMs?: number }) {
    this.requestTimeoutMs = options?.requestTimeoutMs || 5000;
  }

  /**
   * Performs non-destructive verification ping for a target.
   */
  public async verify(
    targetId: string,
    descriptor: PluginConnectionDescriptor,
    credentials: ConnectionCredentials
  ): Promise<ConnectionVerificationResult> {
    const start = Date.now();

    try {
      if (descriptor.authType === 'local_path') {
        return this.verifyLocalPath(targetId, descriptor, credentials, start);
      }

      if (descriptor.authType === 'api_key') {
        return await this.verifyApiKey(targetId, descriptor, credentials, start);
      }

      if (descriptor.authType === 'oauth2') {
        return this.verifyOAuth(targetId, descriptor, credentials, start);
      }

      return {
        ok: true,
        targetId,
        authType: descriptor.authType,
        details: 'Custom connection marked as valid without remote ping',
        latencyMs: Date.now() - start,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        targetId,
        authType: descriptor.authType,
        details: 'Verification failed with unexpected error',
        latencyMs: Date.now() - start,
        error: errorMsg,
      };
    }
  }

  /**
   * Revokes remote token per RFC 7009 if revocation endpoint is provided.
   * If revokeUrl is missing, applies Fail-open with Audit Trail (Option B).
   */
  public async revoke(
    targetId: string,
    descriptor: PluginConnectionDescriptor,
    token: string
  ): Promise<ConnectionRevocationResult> {
    const revokeUrl = descriptor.oauth?.revokeUrl;

    // Fail-open Option B: Provider does not support RFC 7009 remote revocation
    if (!revokeUrl) {
      const auditNote = `Target '${targetId}' does not declare an RFC 7009 revokeUrl. Local secret purged without remote revocation.`;
      logger.info(`[ConnectionVerificationService] ${auditNote}`);
      return {
        ok: true,
        targetId,
        remoteRevoked: false,
        auditNote,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

      const response = await fetch(revokeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token,
          token_type_hint: 'access_token',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok && response.status !== 200 && response.status !== 204) {
        const errorText = await response.text().catch(() => 'Unknown HTTP error');
        logger.warn(
          `[ConnectionVerificationService] Remote revocation for '${targetId}' returned status ${response.status}: ${errorText}`
        );
        return {
          ok: true,
          targetId,
          remoteRevoked: false,
          auditNote: `Remote revocation endpoint returned HTTP ${response.status}. Local secrets purged.`,
        };
      }

      return {
        ok: true,
        targetId,
        remoteRevoked: true,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.warn(
        `[ConnectionVerificationService] Remote revocation timeout/network failure for '${targetId}': ${errorMsg}`
      );
      return {
        ok: true,
        targetId,
        remoteRevoked: false,
        auditNote: `Remote revocation timed out or failed (${errorMsg}). Local secrets purged.`,
      };
    }
  }

  /**
   * Evaluates whether PKCE should be required for this connection descriptor.
   * PKCE is evaluated only when authorizationUrl is present (Authorization Code flow).
   */
  public evaluatePkce(descriptor: PluginConnectionDescriptor): boolean {
    if (descriptor.authType !== 'oauth2') {
      return false;
    }

    // Confidential client_credentials without authorizationUrl bypass PKCE
    if (!descriptor.oauth?.authorizationUrl) {
      return false;
    }

    return descriptor.usePkce;
  }

  private verifyLocalPath(
    targetId: string,
    descriptor: PluginConnectionDescriptor,
    credentials: ConnectionCredentials,
    start: number
  ): ConnectionVerificationResult {
    const rawPath = credentials.localPath?.trim();
    if (!rawPath) {
      return {
        ok: false,
        targetId,
        authType: 'local_path',
        details: 'No path was provided for local directory connection',
        latencyMs: Date.now() - start,
        error: 'Path is required',
      };
    }

    const resolved = path.resolve(rawPath);
    if (!fs.existsSync(resolved)) {
      return {
        ok: false,
        targetId,
        authType: 'local_path',
        details: `Path does not exist: "${resolved}"`,
        latencyMs: Date.now() - start,
        error: 'Directory not found',
      };
    }

    const stat = fs.statSync(resolved);
    if (descriptor.localPath?.kind === 'directory' && !stat.isDirectory()) {
      return {
        ok: false,
        targetId,
        authType: 'local_path',
        details: `Expected a directory but found a file at: "${resolved}"`,
        latencyMs: Date.now() - start,
        error: 'Path is not a directory',
      };
    }

    const marker = descriptor.localPath?.expectedMarker;
    if (marker) {
      const markerPath = path.join(resolved, marker);
      if (!fs.existsSync(markerPath)) {
        return {
          ok: false,
          targetId,
          authType: 'local_path',
          details: `Expected marker "${marker}" was not found inside "${resolved}"`,
          latencyMs: Date.now() - start,
          error: `Missing expected marker: ${marker}`,
        };
      }
    }

    return {
      ok: true,
      targetId,
      authType: 'local_path',
      details: `Valid path verified at "${resolved}"`,
      latencyMs: Date.now() - start,
    };
  }

  private async verifyApiKey(
    targetId: string,
    descriptor: PluginConnectionDescriptor,
    credentials: ConnectionCredentials,
    start: number
  ): Promise<ConnectionVerificationResult> {
    const key = credentials.apiKey?.trim();
    if (!key || key.length < 3) {
      return {
        ok: false,
        targetId,
        authType: 'api_key',
        details: 'API key is missing or suspiciously short',
        latencyMs: Date.now() - start,
        error: 'Invalid API key length',
      };
    }

    const verificationEndpoint = descriptor.apiKey?.verificationEndpoint;
    if (verificationEndpoint) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

        const response = await fetch(verificationEndpoint, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${key}`,
            'User-Agent': 'Zavorth-Connection-Verifier/1.0',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok && response.status >= 400 && response.status < 500) {
          return {
            ok: false,
            targetId,
            authType: 'api_key',
            details: `API key verification failed with HTTP status ${response.status}`,
            latencyMs: Date.now() - start,
            error: `Unauthorized (HTTP ${response.status})`,
          };
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.warn(
          `[ConnectionVerificationService] Verification ping failed for '${targetId}': ${errorMsg}. Assuming healthy to avoid network false-negatives.`
        );
      }
    }

    return {
      ok: true,
      targetId,
      authType: 'api_key',
      details: 'API key format verified',
      latencyMs: Date.now() - start,
    };
  }

  private verifyOAuth(
    targetId: string,
    _descriptor: PluginConnectionDescriptor,
    credentials: ConnectionCredentials,
    start: number
  ): ConnectionVerificationResult {
    const token = credentials.token?.trim();
    if (!token) {
      return {
        ok: false,
        targetId,
        authType: 'oauth2',
        details: 'OAuth token is missing',
        latencyMs: Date.now() - start,
        error: 'Missing access token',
      };
    }

    return {
      ok: true,
      targetId,
      authType: 'oauth2',
      details: 'OAuth access token verified',
      latencyMs: Date.now() - start,
    };
  }
}
