import { getProviderConnections, updateProviderConnection, getCachedSettings } from "@/lib/localDb";
import {
  checkFallbackError,
  COOLDOWN_MS,
  getCodexModelScope,
  getPassthroughProviders,
  getUnavailableUntil,
  hasPerModelQuota,
  isLocalProvider,
  lockModel,
} from "../compat/openSseCompat";
import * as log from "../utils/logger";
import {
  asRecord,
  getCodexScopeRateLimitedUntil,
  isTerminalConnectionStatus,
  toProviderConnection,
  type RecoverableConnectionState,
} from "./authConnectionSupport";
import { asErrorLike } from '../../../utils/errorLike';

const markMutexes = new Map<string, Promise<void>>();

/**
 * Mark account as unavailable - reads backoffLevel from DB, calculates cooldown with exponential backoff, saves new level.
 */
export async function markAccountUnavailable(
  connectionId: string,
  status: number,
  errorText: string,
  provider: string | null = null,
  model: string | null = null
) {
  const currentMutex = markMutexes.get(connectionId) || Promise.resolve();
  let resolveMutex: (() => void) | undefined;
  markMutexes.set(
    connectionId,
    new Promise((resolve) => {
      resolveMutex = resolve;
    })
  );

  try {
    await currentMutex;

    if (hasPerModelQuota(provider) && model && (status === 429 || status === 404)) {
      const reason = status === 404 ? "not_found" : "rate_limited";
      const cooldown = status === 404 ? COOLDOWN_MS.notFoundLocal : COOLDOWN_MS.rateLimit;
      lockModel(provider, connectionId, model, reason, cooldown);
      updateProviderConnection(connectionId, {
        lastErrorType: reason,
        lastError: `Model ${model} ${reason}`,
        lastErrorAt: new Date().toISOString(),
        errorCode: status,
      }).catch((e) => log.warn('AUTH', `Failed to update provider connection after model lockout: ${e}`));
      log.info(
        "AUTH",
        `Model-only lockout for ${provider}:${model} - ${status} ${reason} ${Math.ceil(cooldown / 1000)}s (connection stays active)`
      );
      return { shouldFallback: true, cooldownMs: cooldown };
    }

    const connectionsRaw = await getProviderConnections({ provider });
    const connections = (Array.isArray(connectionsRaw) ? connectionsRaw : [])
      .map(toProviderConnection)
      .filter((connection) => connection.id.length > 0);
    const conn = connections.find((connection) => connection.id === connectionId);
    const backoffLevel = conn?.backoffLevel || 0;

    if (conn && isTerminalConnectionStatus(conn)) {
      log.info(
        "AUTH",
        `${connectionId.slice(0, 8)} terminal status=${conn.testStatus}, skipping cooldown overwrite`
      );
      return { shouldFallback: true, cooldownMs: 0 };
    }

    if (conn?.rateLimitedUntil && new Date(conn.rateLimitedUntil).getTime() > Date.now()) {
      log.info(
        "AUTH",
        `${connectionId.slice(0, 8)} already marked unavailable (until ${conn.rateLimitedUntil}), skipping duplicate mark`
      );
      return {
        shouldFallback: true,
        cooldownMs: new Date(conn.rateLimitedUntil).getTime() - Date.now(),
      };
    }

    if (provider === "codex" && model) {
      const scopeRateLimitedUntil = getCodexScopeRateLimitedUntil(
        conn?.providerSpecificData || {},
        model
      );
      if (scopeRateLimitedUntil && new Date(scopeRateLimitedUntil).getTime() > Date.now()) {
        log.info(
          "AUTH",
          `${connectionId.slice(0, 8)} already scope-limited for ${getCodexModelScope(model)} (until ${scopeRateLimitedUntil}), skipping duplicate mark`
        );
        return {
          shouldFallback: true,
          cooldownMs: new Date(scopeRateLimitedUntil).getTime() - Date.now(),
        };
      }
    }

    const result = checkFallbackError(
      status,
      errorText,
      backoffLevel,
      model,
      provider
    );
    const { shouldFallback, cooldownMs, newBackoffLevel, reason } = result;
    if (!shouldFallback) return { shouldFallback: false, cooldownMs: 0 };

    const connBaseUrl = (conn?.providerSpecificData as Record<string, unknown>)?.baseUrl as
      | string
      | undefined;

    const isPassthroughProvider = provider && getPassthroughProviders().has(provider);
    const isPerModelQuotaProvider = hasPerModelQuota(provider);
    if (
      (isLocalProvider(connBaseUrl) || isPerModelQuotaProvider) &&
      status === 404 &&
      provider &&
      model
    ) {
      const localCooldown = COOLDOWN_MS.notFoundLocal;
      lockModel(provider, connectionId, model, "not_found", localCooldown);
      log.info(
        "AUTH",
        `Model-only lockout for ${model} - 404 lockout ${localCooldown / 1000}s (connection stays active)`
      );
      return { shouldFallback: true, cooldownMs: localCooldown };
    }

    if (isPerModelQuotaProvider && status === 429 && provider && model) {
      const modelCooldown = cooldownMs || COOLDOWN_MS.rateLimit;
      lockModel(provider, connectionId, model, reason || "rate_limited", modelCooldown);
      log.info(
        "AUTH",
        `Model-only lockout for ${model} - 429 rate limit ${Math.ceil(modelCooldown / 1000)}s (connection stays active)`
      );
      return { shouldFallback: true, cooldownMs: modelCooldown };
    }

    const rateLimitedUntil = getUnavailableUntil(cooldownMs);
    const errorMsg = typeof errorText === "string" ? errorText.slice(0, 100) : "Provider error";

    if (provider === "codex" && status === 429 && model && conn) {
      const scope = getCodexModelScope(model);
      const existingScopeMap = asRecord(conn.providerSpecificData.codexScopeRateLimitedUntil);
      const persistedScopeUntil = getCodexScopeRateLimitedUntil(conn.providerSpecificData, model);
      const scopeRateLimitedUntil = persistedScopeUntil || rateLimitedUntil;
      const scopeCooldownMs = Math.max(new Date(scopeRateLimitedUntil).getTime() - Date.now(), 0);

      await updateProviderConnection(connectionId, {
        testStatus: "unavailable",
        lastError: errorMsg,
        errorCode: status,
        lastErrorAt: new Date().toISOString(),
        backoffLevel: newBackoffLevel ?? backoffLevel,
        providerSpecificData: {
          ...conn.providerSpecificData,
          codexScopeRateLimitedUntil: {
            ...existingScopeMap,
            [scope]: scopeRateLimitedUntil,
          },
        },
      });

      if (scopeCooldownMs > 0) {
        lockModel(provider, connectionId, model, reason || "unknown", scopeCooldownMs);
      }

      if (status && errorMsg) {
        console.error(`X ${provider} [${status}] (${scope}): ${errorMsg}`);
      }

      return { shouldFallback: true, cooldownMs: scopeCooldownMs };
    }

    await updateProviderConnection(connectionId, {
      rateLimitedUntil,
      testStatus: "unavailable",
      lastError: errorMsg,
      errorCode: status,
      lastErrorAt: new Date().toISOString(),
      backoffLevel: newBackoffLevel ?? backoffLevel,
    });

    if (result.permanent) {
      try {
        const settings = await getCachedSettings();
        const autoDisableEnabled = settings.autoDisableBannedAccounts ?? false;
        if (autoDisableEnabled) {
          await updateProviderConnection(connectionId, { isActive: false });
          log.info(
            "AUTH",
            `Auto-disabled ${connectionId.slice(0, 8)} - permanent ban detected (autoDisableBannedAccounts=true)`
          );
        }
      } catch (error: unknown) { const err = asErrorLike(error); log.info("AUTH", `Auto-disable check failed (non-fatal): ${err}`);
      }
    }

    if (provider && model && cooldownMs > 0) {
      lockModel(provider, connectionId, model, reason || "unknown", cooldownMs);
    }

    if (provider && status && errorMsg) {
      console.error(`X ${provider} [${status}]: ${errorMsg}`);
    }

    return { shouldFallback: true, cooldownMs };
  } finally {
    if (resolveMutex) resolveMutex();
    markMutexes.delete(connectionId);
  }
}

export async function clearAccountError(
  connectionId: string,
  currentConnection: Partial<RecoverableConnectionState>
) {
  const hasError =
    (currentConnection.testStatus && currentConnection.testStatus !== "active") ||
    currentConnection.lastError ||
    currentConnection.rateLimitedUntil ||
    currentConnection.errorCode ||
    currentConnection.lastErrorType ||
    currentConnection.lastErrorSource;

  if (!hasError) return;

  await updateProviderConnection(connectionId, {
    testStatus: "active",
    lastError: null,
    lastErrorAt: null,
    lastErrorType: null,
    lastErrorSource: null,
    errorCode: null,
    rateLimitedUntil: null,
    backoffLevel: 0,
  });
  log.info("AUTH", `Account ${connectionId.slice(0, 8)} error cleared`);
}

export async function clearRecoveredProviderState(
  credentials: Partial<RecoverableConnectionState> | null
) {
  if (!credentials?.connectionId) return;
  await clearAccountError(credentials.connectionId, credentials);
}
