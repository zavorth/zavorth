import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import {
  getProvider,
  generateAuthData,
  exchangeTokens,
  requestDeviceCode,
  pollForToken,
} from "@/lib/oauth/providers";
import type { ZavorthProviderAuthHandler } from "@/lib/oauth/authPlane";
import {
  createProviderConnection,
  updateProviderConnection,
  getProviderConnections,
  isCloudEnabled,
  resolveProxyForProvider,
} from "@/models";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";

import { syncToCloud } from "@/lib/cloudSync";
import { startLocalServer } from "@/lib/oauth/utils/server";
import { runWithProxyContext } from "@ZavorthGateway/open-sse/utils/proxyFetch.ts";
import {
  jsonObjectSchema,
  oauthExchangeSchema,
  oauthPollSchema,
} from "@/shared/validation/schemas";

import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../../../utils/errorLike.js';
// Shared interfaces for OAuth flow data in this route

interface OAuthTokenData {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
  name?: string;
  email?: string;
  displayName?: string;
  providerSpecificData?: Record<string, unknown>;
}

interface OAuthDeviceData {
  device_code?: string;
  user_code?: string;
  verification_uri?: string;
  verification_uri_complete?: string;
  expires_in?: number;
  interval?: number;
  [key: string]: unknown;
}

interface OAuthAuthData {
  authUrl: string | null;
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  redirectUri: string | null;
  flowType: string;
  fixedPort?: number;
  callbackPath?: string;
}

interface OAuthPollResult {
  success: boolean;
  tokens?: OAuthTokenData;
  error?: string;
  errorDescription?: string;
  pending?: boolean;
}

interface ProviderConnection {
  id: string;
  provider: string;
  email?: string;
  displayName?: string;
  authType?: string;
  name?: string;
  providerSpecificData?: Record<string, unknown>;
  [key: string]: unknown;
}

interface CodexCallbackParams {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

interface CodexCallbackState {
  callbackParams: CodexCallbackParams | null;
  close: () => void;
  port: number;
  redirectUri: string;
  codeVerifier: string;
  state: string;
  startedAt: number;
}

type OAuthRequestBody = Record<string, unknown> & {
  code?: string;
  redirectUri?: string;
  codeVerifier?: string;
  state?: string;
  deviceCode?: string;
  extraData?: Record<string, unknown>;
};

// Use globalThis to persist callback server state across Next.js HMR reloads
declare global {
  // eslint-disable-next-line no-var
  var __codexCallbackState: CodexCallbackState | null;
}
if (!globalThis.__codexCallbackState) {
  globalThis.__codexCallbackState = null;
}

/**
 * Constant-time string comparison to prevent timing-oracle attacks (CWE-208).
 * Handles null/undefined safely and different-length strings.
 */
function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return a === b;
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function normalizeOAuthRedirectUri(value: string | null, request: Request): string {
  const redirectUri = value || "http://localhost:8080/callback";
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch (error: unknown) {throw new Error("Invalid redirect_uri");
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLoopbackHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]";

  if (parsed.protocol === "http:" && isLoopbackHost) {
    return parsed.toString();
  }

  const requestOrigin = new URL(request.url).origin;
  const configuredBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.CLOUD_URL || null;
  const allowedOrigins = new Set([requestOrigin]);
  if (configuredBaseUrl) {
    try {
      allowedOrigins.add(new URL(configuredBaseUrl).origin);
    } catch (error: unknown) {// Ignore invalid deployment base URL; it should not expand redirect allowances.
      logger.warn('[route] network request failed', error);
    }
  }

  if (parsed.protocol !== "https:" || !allowedOrigins.has(parsed.origin)) {
    throw new Error("redirect_uri must use a loopback URL or the configured gateway origin");
  }
  return parsed.toString();
}

/**
 * Dynamic OAuth API Route
 * Handles: authorize, exchange, device-code, poll, start-callback-server, poll-callback
 */

// GET /api/oauth/[provider]/authorize - Generate auth URL
// GET /api/oauth/[provider]/device-code - Request device code (for device_code flow)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string; action: string }> }
) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { provider, action } = await params;
    const { searchParams } = new URL(request.url);

    if (action === "authorize") {
      const redirectUri = normalizeOAuthRedirectUri(searchParams.get("redirect_uri"), request);
      const authData = generateAuthData(provider, redirectUri);
      if (provider === "qoder" && !authData.authUrl) {
        return NextResponse.json({
          ...authData,
          supported: false,
          error:
            "Qoder browser OAuth is experimental and disabled by default. Configure QODER_OAUTH_* environment variables or use a Personal Access Token.",
        });
      }
      return NextResponse.json(authData);
    }

    if (action === "device-code") {
      const providerData = getProvider(provider);
      if (providerData.flowType !== "device_code") {
        return NextResponse.json(
          { error: "Provider does not support device code flow" },
          { status: 400 }
        );
      }

      const authData = generateAuthData(provider, null);

      // Resolve proxy for this provider (provider-level → global → direct)
      const proxy = await resolveProxyForProvider(provider);

      // Request device code (through proxy if configured)
      let deviceData: OAuthDeviceData;
      if (provider === "github" || provider === "kiro" || provider === "kilocode") {
        // GitHub, Kiro, and KiloCode don't use PKCE for device code
        deviceData = await runWithProxyContext(proxy, () => requestDeviceCode(provider)) as OAuthDeviceData;
      } else {
        // Qwen and other providers use PKCE
        deviceData = await runWithProxyContext(proxy, () =>
          requestDeviceCode(provider, authData.codeChallenge)
        ) as OAuthDeviceData;
      }

      return NextResponse.json({
        ...deviceData,
        codeVerifier: authData.codeVerifier,
      });
    }

    if (action === "start-callback-server") {
      return await handleStartCallbackServer(provider, searchParams);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    console.log("OAuth GET error:", error);
    return NextResponse.json({ error: error instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

/**
 * Start Codex callback server on port 1455
 * Returns the auth URL and stores codeVerifier for later exchange
 */
async function handleStartCallbackServer(provider: string, searchParams: URLSearchParams) {
  if (provider !== "codex") {
    return NextResponse.json(
      { error: "Callback server only supported for codex" },
      { status: 400 }
    );
  }

  // Clean up existing server if any
  if (globalThis.__codexCallbackState?.close) {
    try {
      globalThis.__codexCallbackState.close();
    } catch (error: unknown) {/* ignore */ logger.warn('[route] resource cleanup failed', error); }
  }
  globalThis.__codexCallbackState = null;

  try {
    // Start temp server on port 1455
    const { port, close } = await startLocalServer((params) => {
      // Write directly to globalThis so it survives module reloads
      if (globalThis.__codexCallbackState) {
        globalThis.__codexCallbackState.callbackParams = params;
      }
    }, 1455);

    const redirectUri = `http://localhost:${port}/auth/callback`;
    const authData = generateAuthData(provider, redirectUri);

    globalThis.__codexCallbackState = {
      callbackParams: null,
      close,
      port,
      redirectUri,
      codeVerifier: authData.codeVerifier,
      state: authData.state,
      startedAt: Date.now(),
    };

    // Auto-cleanup after 5 minutes
    const startedAt = Date.now();
    setTimeout(() => {
      if (globalThis.__codexCallbackState?.startedAt === startedAt) {
        try {
          close();
        } catch (error: unknown) {/* ignore */ logger.warn('[route] resource cleanup failed', error); }
        globalThis.__codexCallbackState = null;
      }
    }, 300000);

    return NextResponse.json({
      authUrl: authData.authUrl,
      codeVerifier: authData.codeVerifier,
      redirectUri,
      serverPort: port,
    });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[route] resource cleanup failed', error);
    return NextResponse.json({ error: error instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

// POST /api/oauth/[provider]/exchange - Exchange code for tokens and save
// POST /api/oauth/[provider]/poll - Poll for token (device_code flow)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string; action: string }> }
) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { provider, action } = await params;
    let rawBody: Record<string, unknown> = {};
    try {
      rawBody = await request.json() as Record<string, unknown>;
    } catch (error: unknown) {if (action !== "poll-callback") {
        return NextResponse.json(
          {
            error: {
              message: "Invalid request",
              details: [{ field: "body", message: "Invalid JSON body" }],
            },
          },
          { status: 400 }
        );
      }
    }

    let body: OAuthRequestBody = rawBody as OAuthRequestBody;
    if (action === "exchange") {
      const validation = validateBody(oauthExchangeSchema, rawBody);
      if (isValidationFailure(validation)) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      body = validation.data;
    } else if (action === "poll") {
      const validation = validateBody(oauthPollSchema, rawBody);
      if (isValidationFailure(validation)) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      body = validation.data;
    } else if (action === "poll-callback") {
      const validation = validateBody(jsonObjectSchema, rawBody || {});
      if (isValidationFailure(validation)) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      body = validation.data;
    }

    if (action === "exchange") {
      const { code, redirectUri, codeVerifier, state } = body;
      const normalizedRedirectUri = normalizeOAuthRedirectUri(redirectUri ?? null, request);
      const normalizedState = typeof state === "string" && state.length > 0 ? state : undefined;
      const providerData = getProvider(provider);

      if (providerData.flowType === "authorization_code_pkce" && !codeVerifier) {
        return NextResponse.json(
          {
            error: {
              message: "Invalid request",
              details: [
                {
                  field: "codeVerifier",
                  message: `Code verifier is required for ${provider} OAuth exchange`,
                },
              ],
            },
          },
          { status: 400 }
        );
      }

      // Resolve proxy for this provider (provider-level → global → direct)
      const proxy = await resolveProxyForProvider(provider);

      // Exchange code for tokens (through proxy if configured)
      const tokenData = await runWithProxyContext(proxy, () =>
        exchangeTokens(provider, code, normalizedRedirectUri, codeVerifier, normalizedState)
      );

      // Normalize: if name is missing, use email or displayName as fallback so accounts
      // always show a real label (e.g. user@gmail.com) instead of "Account #abc123"
      if (!tokenData.name && (tokenData.email || tokenData.displayName)) {
        tokenData.name = tokenData.email || tokenData.displayName;
      }

      // Upsert: update existing connection if same provider+email, else create new
      const expiresAt = tokenData.expiresIn
        ? new Date(Date.now() + tokenData.expiresIn * 1000).toISOString()
        : null;

      let connection: ProviderConnection | null = null;
      if (tokenData.email) {
        const existing = await getProviderConnections({ provider });
        const match = existing.find((c: ProviderConnection) => {
          // safeEqual: constant-time comparison to prevent timing attacks (CWE-208, finding #258-6/7)
          if (!safeEqual(c.email, tokenData.email) || c.authType !== "oauth") return false;
          // For Codex, also check workspaceId to avoid overwriting different workspace connections
          if (provider === "codex" && tokenData.providerSpecificData?.workspaceId) {
            const existingWorkspace = c.providerSpecificData?.workspaceId;
            return safeEqual(existingWorkspace, tokenData.providerSpecificData.workspaceId);
          }
          return true;
        });
        const matchId = typeof match?.id === "string" ? match.id : null;
        if (matchId) {
          connection = await updateProviderConnection(matchId, {
            ...tokenData,
            expiresAt,
            testStatus: "active",
            isActive: true,
          });
        }
      }
      if (!connection) {
        connection = await createProviderConnection({
          provider,
          authType: "oauth",
          ...tokenData,
          expiresAt,
          testStatus: "active",
        });
      }

      // Auto sync to Cloud if enabled
      await syncToCloudIfEnabled();

      return NextResponse.json({
        success: true,
        connection: {
          id: connection.id,
          provider: connection.provider,
          email: connection.email,
          displayName: connection.displayName,
        },
      });
    }

    if (action === "poll") {
      const { deviceCode, codeVerifier, extraData } = body;

      // Resolve proxy for this provider (provider-level → global → direct)
      const proxy = await resolveProxyForProvider(provider);

      // Poll for token (through proxy if configured)
      let result: OAuthPollResult;
      if (provider === "github" || provider === "kimi-coding" || provider === "kilocode") {
        // For providers that don't use PKCE (like GitHub, Kiro, Kimi Coding), don't pass codeVerifier
        result = await runWithProxyContext(proxy, () =>
          pollForToken(provider, deviceCode)
        ) as OAuthPollResult;
      } else if (provider === "kiro") {
        // Kiro needs extraData (clientId, clientSecret) from device code response
        result = await runWithProxyContext(proxy, () =>
          pollForToken(provider, deviceCode, null, extraData)
        ) as OAuthPollResult;
      } else {
        // Qwen and other providers use PKCE
        if (!codeVerifier) {
          return NextResponse.json({ error: "Missing code verifier" }, { status: 400 });
        }
        result = await runWithProxyContext(proxy, () =>
          pollForToken(provider, deviceCode, codeVerifier)
        ) as OAuthPollResult;
      }

      if (result.success) {
        // Normalize: if name is missing, use email as fallback display label
        if (!result.tokens.name && (result.tokens.email || result.tokens.displayName)) {
          result.tokens.name = result.tokens.email || result.tokens.displayName;
        }

        // Upsert: update existing connection if same provider+email, else create new
        const expiresAt = result.tokens.expiresIn
          ? new Date(Date.now() + result.tokens.expiresIn * 1000).toISOString()
          : null;

        let connection: ProviderConnection | null = null;
        if (result.tokens?.email) {
          const existing = await getProviderConnections({ provider });
          const match = existing.find((c: ProviderConnection) => {
            // safeEqual: constant-time comparison to prevent timing attacks (CWE-208, finding #258-8/9)
            if (!safeEqual(c.email, result.tokens.email) || c.authType !== "oauth") return false;
            // For Codex, also check workspaceId to avoid overwriting different workspace connections
            if (provider === "codex" && result.tokens.providerSpecificData?.workspaceId) {
              const existingWorkspace = c.providerSpecificData?.workspaceId;
              return safeEqual(existingWorkspace, result.tokens.providerSpecificData.workspaceId);
            }
            return true;
          });
          const matchId = typeof match?.id === "string" ? match.id : null;
          if (matchId) {
            connection = await updateProviderConnection(matchId, {
              ...result.tokens,
              expiresAt,
              testStatus: "active",
              isActive: true,
            });
          }
        }
        if (!connection) {
          connection = await createProviderConnection({
            provider,
            authType: "oauth",
            ...result.tokens,
            expiresAt,
            testStatus: "active",
          });
        }

        // Auto sync to Cloud if enabled
        await syncToCloudIfEnabled();

        return NextResponse.json({
          success: true,
          connection: {
            id: connection.id,
            provider: connection.provider,
          },
        });
      }

      // Still pending or error - don't create connection for pending states
      const isPending =
        result.pending || result.error === "authorization_pending" || result.error === "slow_down";

      return NextResponse.json({
        success: false,
        error: result.error,
        errorDescription: result.errorDescription,
        pending: isPending,
      });
    }

    if (action === "poll-callback") {
      // Poll for Codex callback server result
      if (provider !== "codex") {
        return NextResponse.json(
          { error: "poll-callback only supported for codex" },
          { status: 400 }
        );
      }

      if (!globalThis.__codexCallbackState) {
        return NextResponse.json({
          success: false,
          error: "no_server",
          errorDescription: "Callback server not running",
        });
      }

      if (!globalThis.__codexCallbackState.callbackParams) {
        return NextResponse.json({ success: false, pending: true });
      }

      // Callback received! Extract code and exchange for tokens
      const params = globalThis.__codexCallbackState.callbackParams;
      const { redirectUri, codeVerifier, state, close } = globalThis.__codexCallbackState;

      // Clean up server
      try {
        close();
      } catch (error: unknown) {/* ignore */ logger.warn('[route] resource cleanup failed', error); }
      globalThis.__codexCallbackState = null;

      if (params.error) {
        return NextResponse.json({
          success: false,
          error: params.error,
          errorDescription: params.error_description,
        });
      }

      if (!params.code) {
        return NextResponse.json({
          success: false,
          error: "no_code",
          errorDescription: "No authorization code received",
        });
      }

      if (!safeEqual(params.state, state)) {
        return NextResponse.json(
          {
            success: false,
            error: "invalid_state",
            errorDescription: "OAuth state did not match the active callback session",
          },
          { status: 400 }
        );
      }

      try {
        // Resolve proxy for this provider
        const proxy = await resolveProxyForProvider(provider);

        // Exchange code for tokens (through proxy if configured)
        const tokenData = await runWithProxyContext(proxy, () =>
          exchangeTokens(provider, params.code, redirectUri, codeVerifier, params.state)
        );

        // Normalize: if name is missing, use email as fallback display label
        if (!tokenData.name && (tokenData.email || tokenData.displayName)) {
          tokenData.name = tokenData.email || tokenData.displayName;
        }

        // Upsert: update existing connection if same provider+email, else create new
        const expiresAt = tokenData.expiresIn
          ? new Date(Date.now() + tokenData.expiresIn * 1000).toISOString()
          : null;

        let connection: ProviderConnection | null = null;
        if (tokenData.email) {
          const existing = await getProviderConnections({ provider });
          const match = existing.find((c: ProviderConnection) => {
            // safeEqual: constant-time comparison to prevent timing attacks (CWE-208, finding #258-6/7)
            if (!safeEqual(c.email, tokenData.email) || c.authType !== "oauth") return false;
            // For Codex, also check workspaceId to avoid overwriting different workspace connections
            if (provider === "codex" && tokenData.providerSpecificData?.workspaceId) {
              const existingWorkspace = c.providerSpecificData?.workspaceId;
              return safeEqual(existingWorkspace, tokenData.providerSpecificData.workspaceId);
            }
            return true;
          });
          const matchId = typeof match?.id === "string" ? match.id : null;
          if (matchId) {
            connection = await updateProviderConnection(matchId, {
              ...tokenData,
              expiresAt,
              testStatus: "active",
              isActive: true,
            });
          }
        }
        if (!connection) {
          connection = await createProviderConnection({
            provider,
            authType: "oauth",
            ...tokenData,
            expiresAt,
            testStatus: "active",
          });
        }

        await syncToCloudIfEnabled();

        return NextResponse.json({
          success: true,
          connection: {
            id: connection.id,
            provider: connection.provider,
            email: connection.email,
            displayName: connection.displayName,
          },
        });
      } catch (error: unknown) {logger.warn('[route] connection failed', error);
    return NextResponse.json({ success: false, error: exchangeErr instanceof Error ? exchangeErr.message : "Unknown exchange error" }, { status: 500 });
  }
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    console.log("OAuth POST error:", error);
    return NextResponse.json({ error: error instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

/**
 * Sync to Cloud if enabled
 */
async function syncToCloudIfEnabled() {
  try {
    const cloudEnabled = await isCloudEnabled();
    if (!cloudEnabled) return;

    const machineId = await getConsistentMachineId();
    await syncToCloud(machineId);
  } catch (error: unknown) {console.log("Error syncing to cloud after OAuth:", error);
  }
}
