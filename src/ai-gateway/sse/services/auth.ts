import { randomUUID } from "crypto";
import {
  getProviderConnections,
  validateApiKey,
  updateProviderConnection,
  getSettings,
} from "@/lib/localDb";
import { isAccountQuotaExhausted } from "@/domain/quotaCache";
import {
  isAccountUnavailable,
  getEarliestRateLimitedUntil,
  formatRetryAfter,
  isModelLocked,
} from "../compat/openSseCompat";
import { getProviderAlias, resolveProviderId } from "@/shared/constants/providers";
import * as log from "../utils/logger";
import { fisherYatesShuffle, getNextFromDeckSync } from "@/shared/utils/shuffleDeck";
import {
  evaluateQuotaLimitPolicy,
  getCodexScopeRateLimitedUntil,
  getEarliestCodexScopeRateLimitedUntil,
  getEarliestFutureDate,
  isCodexScopeUnavailable,
  isTerminalConnectionStatus,
  parseFutureDateMs,
  toNumber,
  toProviderConnection,
  type CredentialSelectionOptions,
} from "./authConnectionSupport";

export { evaluateQuotaLimitPolicy, resolveQuotaLimitPolicy } from "./authConnectionSupport";
export {
  clearAccountError,
  clearRecoveredProviderState,
  markAccountUnavailable,
} from "./authAccountState";

let selectionMutex = Promise.resolve();

// Strict-Random shuffle deck moved to src/shared/utils/shuffleDeck.ts.
// Re-export for backwards compatibility with existing test imports.
export { fisherYatesShuffle, getNextFromDeckSync as getNextFromDeck };

function getProviderSearchPool(provider: string): string[] {
  const canonicalProvider = resolveProviderId(provider);
  const canonicalAlias = getProviderAlias(canonicalProvider);

  if (provider === "nvidia") {
    return ["nvidia", "nvidia_nim"];
  }
  if (provider === "nvidia_nim") {
    return ["nvidia_nim", "nvidia"];
  }

  return Array.from(new Set([provider, canonicalProvider, canonicalAlias].filter(Boolean)));
}

export async function getProviderCredentials(
  provider: string,
  excludeConnectionId: string | null = null,
  allowedConnections: string[] | null = null,
  requestedModel: string | null = null,
  options: CredentialSelectionOptions = {}
) {
  const currentMutex = selectionMutex;
  let resolveMutex: (() => void) | undefined;
  selectionMutex = new Promise((resolve) => {
    resolveMutex = resolve;
  });

  try {
    await currentMutex;

    const allowSuppressedConnections = options.allowSuppressedConnections === true;
    const bypassQuotaPolicy = options.bypassQuotaPolicy === true;
    const providersToSearch = getProviderSearchPool(provider);
    const connectionResults = await Promise.all(
      providersToSearch.map((p) => getProviderConnections({ provider: p, isActive: true }))
    );
    const connectionsRaw = connectionResults.filter(Array.isArray).flat();

    let connections = (Array.isArray(connectionsRaw) ? connectionsRaw : [])
      .map(toProviderConnection)
      .filter((conn) => conn.id.length > 0);
    if (allowedConnections && allowedConnections.length > 0) {
      connections = connections.filter((conn) => allowedConnections.includes(conn.id));
    }
    log.debug(
      "AUTH",
      `${provider} | total connections: ${connections.length}, excludeId: ${excludeConnectionId || "none"}`
    );

    if (connections.length === 0) {
      const allConnectionsResults = await Promise.all(
        providersToSearch.map((p) => getProviderConnections({ provider: p }))
      );
      const allConnectionsRaw = allConnectionsResults.filter(Array.isArray).flat();
      const allConnections = (Array.isArray(allConnectionsRaw) ? allConnectionsRaw : [])
        .map(toProviderConnection)
        .filter((conn) => conn.id.length > 0);
      log.debug("AUTH", `${provider} | all connections (incl inactive): ${allConnections.length}`);
      if (allConnections.length > 0) {
        const earliest = getEarliestRateLimitedUntil(allConnections);
        if (earliest) {
          log.warn(
            "AUTH",
            `${provider} | all ${allConnections.length} accounts rate limited (${formatRetryAfter(earliest)})`
          );
          return {
            allRateLimited: true,
            retryAfter: earliest,
            retryAfterHuman: formatRetryAfter(earliest),
          };
        }
        log.warn("AUTH", `${provider} | ${allConnections.length} accounts found but none active`);
        allConnections.forEach((c) => {
          log.debug(
            "AUTH",
            `  -> ${c.id?.slice(0, 8)} | isActive=${c.isActive} | rateLimitedUntil=${c.rateLimitedUntil || "none"} | testStatus=${c.testStatus}`
          );
        });
      }
      log.warn("AUTH", `No credentials for ${provider}`);
      return null;
    }

    for (const c of connections) {
      if (
        c.backoffLevel > 0 &&
        !isTerminalConnectionStatus(c) &&
        !isAccountUnavailable(c.rateLimitedUntil)
      ) {
        c.backoffLevel = 0;
        updateProviderConnection(c.id, {
          backoffLevel: 0,
          testStatus: "active",
          lastError: null,
          lastErrorAt: null,
          lastErrorType: null,
          lastErrorSource: null,
          errorCode: null,
        }).catch(() => {});
      }
    }

    const availableConnections = connections.filter((c) => {
      if (excludeConnectionId && c.id === excludeConnectionId) return false;
      if (!allowSuppressedConnections) {
        if (isAccountUnavailable(c.rateLimitedUntil)) return false;
        if (isTerminalConnectionStatus(c)) return false;
        if (provider === "codex" && isCodexScopeUnavailable(c, requestedModel)) return false;
        if (requestedModel && isModelLocked(provider, c.id, requestedModel)) return false;
      }
      return true;
    });

    log.debug(
      "AUTH",
      `${provider} | available: ${availableConnections.length}/${connections.length}`
    );
    connections.forEach((c) => {
      const excluded = excludeConnectionId && c.id === excludeConnectionId;
      const rateLimited = isAccountUnavailable(c.rateLimitedUntil);
      const terminalStatus = isTerminalConnectionStatus(c);
      const codexScopeLimited = provider === "codex" && isCodexScopeUnavailable(c, requestedModel);
      if (excluded || rateLimited) {
        log.debug(
          "AUTH",
          `  -> ${c.id?.slice(0, 8)} | ${excluded ? "excluded" : ""} ${rateLimited ? `rateLimited until ${c.rateLimitedUntil}` : ""}${allowSuppressedConnections && rateLimited ? " (retained for combo live test)" : ""}`
        );
      } else if (terminalStatus) {
        log.debug(
          "AUTH",
          allowSuppressedConnections
            ? `  -> ${c.id?.slice(0, 8)} | retained terminal status=${c.testStatus} for combo live test`
            : `  -> ${c.id?.slice(0, 8)} | skipped terminal status=${c.testStatus}`
        );
      } else if (codexScopeLimited) {
        const scopeUntil = getCodexScopeRateLimitedUntil(c.providerSpecificData, requestedModel);
        log.debug(
          "AUTH",
          allowSuppressedConnections
            ? `  -> ${c.id?.slice(0, 8)} | retained codex scope-limited account until ${scopeUntil} for combo live test`
            : `  -> ${c.id?.slice(0, 8)} | codex scope-limited until ${scopeUntil}`
        );
      }
    });

    if (availableConnections.length === 0) {
      const earliest =
        getEarliestRateLimitedUntil(connections) ||
        (provider === "codex"
          ? getEarliestCodexScopeRateLimitedUntil(connections, requestedModel)
          : null);
      if (earliest) {
        const rateLimitedConns = connections.filter(
          (c) => c.rateLimitedUntil && new Date(c.rateLimitedUntil).getTime() > Date.now()
        );
        const earliestConn = rateLimitedConns.sort(
          (a, b) =>
            new Date(a.rateLimitedUntil || 0).getTime() -
            new Date(b.rateLimitedUntil || 0).getTime()
        )[0];
        log.warn(
          "AUTH",
          `${provider} | all ${connections.length} active accounts rate limited (${formatRetryAfter(earliest)}) | lastErrorCode=${earliestConn?.errorCode}, lastError=${earliestConn?.lastError?.slice(0, 50)}`
        );
        return {
          allRateLimited: true,
          retryAfter: earliest,
          retryAfterHuman: formatRetryAfter(earliest),
          lastError: earliestConn?.lastError || null,
          lastErrorCode: earliestConn?.errorCode || null,
        };
      }
      log.warn("AUTH", `${provider} | all ${connections.length} accounts unavailable`);
      return null;
    }

    let policyEligibleConnections = availableConnections;
    const blockedByPolicy: Array<{
      id: string;
      reasons: string[];
      resetAt: string | null;
    }> = [];

    if (!bypassQuotaPolicy) {
      policyEligibleConnections = availableConnections.filter((connection) => {
        const evaluation = evaluateQuotaLimitPolicy(provider, connection);
        if (!evaluation.blocked) return true;

        blockedByPolicy.push({
          id: connection.id,
          reasons: evaluation.reasons,
          resetAt: evaluation.resetAt,
        });
        return false;
      });
    } else if (availableConnections.length > 0) {
      log.debug("AUTH", `${provider} | bypassing quota policy for combo live test`);
    }

    if (blockedByPolicy.length > 0) {
      log.info(
        "AUTH",
        `${provider} | quota policy filtered ${blockedByPolicy.length} account(s): ${blockedByPolicy
          .map((entry) => `${entry.id.slice(0, 8)}(${entry.reasons.join(", ")})`)
          .join("; ")}`
      );
    }

    if (policyEligibleConnections.length === 0 && availableConnections.length > 0) {
      const earliestResetAt = getEarliestFutureDate(blockedByPolicy.map((entry) => entry.resetAt));
      const earliestResetMs = parseFutureDateMs(earliestResetAt);

      const retryAfter = earliestResetMs
        ? new Date(earliestResetMs).toISOString()
        : new Date(Date.now() + 5 * 60 * 1000).toISOString();

      return {
        allRateLimited: true,
        retryAfter,
        retryAfterHuman: formatRetryAfter(retryAfter),
        lastError: `All ${provider} accounts reached configured quota threshold`,
        lastErrorCode: 429,
      };
    }

    const withQuota = policyEligibleConnections.filter((c) => !isAccountQuotaExhausted(c.id));
    const exhaustedQuota = policyEligibleConnections.filter((c) => isAccountQuotaExhausted(c.id));
    const orderedConnections =
      withQuota.length > 0 ? [...withQuota, ...exhaustedQuota] : policyEligibleConnections;

    if (exhaustedQuota.length > 0) {
      log.debug(
        "AUTH",
        `${provider} | quota-aware: ${withQuota.length} with quota, ${exhaustedQuota.length} exhausted`
      );
    }

    const settings = await getSettings();
    const strategy = settings.fallbackStrategy || "fill-first";

    let connection;
    if (strategy === "round-robin") {
      const stickyLimit = toNumber((settings as Record<string, unknown>).stickyRoundRobinLimit, 3);
      const isFallbackScenario = excludeConnectionId !== null;

      if (!isFallbackScenario) {
        const byRecency = [...orderedConnections].sort((a: any, b: any) => {
          if (!a.lastUsedAt && !b.lastUsedAt) return (a.priority || 999) - (b.priority || 999);
          if (!a.lastUsedAt) return 1;
          if (!b.lastUsedAt) return -1;
          return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
        });

        const current = byRecency[0];
        const currentCount = current?.consecutiveUseCount || 0;

        if (current && current.lastUsedAt && currentCount < stickyLimit) {
          connection = current;
          log.debug(
            "AUTH",
            `${provider} round-robin: staying with ${current.id?.slice(0, 8)}... (count=${currentCount}/${stickyLimit})`
          );
          await updateProviderConnection(connection.id, {
            lastUsedAt: new Date().toISOString(),
            consecutiveUseCount: (connection.consecutiveUseCount || 0) + 1,
          });
        } else {
          const sortedByOldest = [...orderedConnections].sort((a: any, b: any) => {
            const aBackoff = a.backoffLevel || 0;
            const bBackoff = b.backoffLevel || 0;
            if (aBackoff !== bBackoff) return aBackoff - bBackoff;
            if (!a.lastUsedAt && !b.lastUsedAt) return (a.priority || 999) - (b.priority || 999);
            if (!a.lastUsedAt) return -1;
            if (!b.lastUsedAt) return 1;
            return new Date(a.lastUsedAt).getTime() - new Date(b.lastUsedAt).getTime();
          });

          connection = sortedByOldest[0];
          log.debug(
            "AUTH",
            `${provider} round-robin: switching to LRU ${connection.id?.slice(0, 8)}... (current count=${currentCount} >= limit=${stickyLimit} or no lastUsedAt)`
          );

          await updateProviderConnection(connection.id, {
            lastUsedAt: new Date().toISOString(),
            consecutiveUseCount: 1,
          });
        }
      } else {
        const sortedByOldest = [...orderedConnections].sort((a: any, b: any) => {
          const aBackoff = a.backoffLevel || 0;
          const bBackoff = b.backoffLevel || 0;
          if (aBackoff !== bBackoff) return aBackoff - bBackoff;
          if (!a.lastUsedAt && !b.lastUsedAt) return (a.priority || 999) - (b.priority || 999);
          if (!a.lastUsedAt) return -1;
          if (!b.lastUsedAt) return 1;
          return new Date(a.lastUsedAt).getTime() - new Date(b.lastUsedAt).getTime();
        });

        connection = sortedByOldest[0];
        log.info(
          "AUTH",
          `${provider} round-robin: FALLBACK MODE - excluded ${excludeConnectionId?.slice(0, 8)}..., picked LRU ${connection.id?.slice(0, 8)}...`
        );

        await updateProviderConnection(connection.id, {
          lastUsedAt: new Date().toISOString(),
          consecutiveUseCount: 1,
        });
      }
    } else if (strategy === "p2c") {
      if (orderedConnections.length <= 2) {
        connection = orderedConnections[0];
      } else {
        const i =
          parseInt(randomUUID().replace(/-/g, "").substring(0, 8), 16) % orderedConnections.length;
        let j =
          parseInt(randomUUID().replace(/-/g, "").substring(0, 8), 16) %
          (orderedConnections.length - 1);
        if (j >= i) j++;
        const a = orderedConnections[i];
        const b = orderedConnections[j];
        const scoreA = (a.consecutiveUseCount || 0) + (a.lastError ? 10 : 0);
        const scoreB = (b.consecutiveUseCount || 0) + (b.lastError ? 10 : 0);
        connection = scoreA <= scoreB ? a : b;
      }
    } else if (strategy === "random") {
      const idx =
        parseInt(randomUUID().replace(/-/g, "").substring(0, 8), 16) % orderedConnections.length;
      connection = orderedConnections[idx];
    } else if (strategy === "least-used") {
      const sorted = [...orderedConnections].sort((a, b) => {
        if (!a.lastUsedAt && !b.lastUsedAt) return (a.priority || 999) - (b.priority || 999);
        if (!a.lastUsedAt) return -1;
        if (!b.lastUsedAt) return 1;
        return new Date(a.lastUsedAt).getTime() - new Date(b.lastUsedAt).getTime();
      });
      connection = sorted[0];
    } else if (strategy === "cost-optimized") {
      const sorted = [...orderedConnections].sort(
        (a, b) => (a.priority || 999) - (b.priority || 999)
      );
      connection = sorted[0];
    } else if (strategy === "strict-random") {
      const ids = orderedConnections.map((c) => c.id);
      const selectedId = getNextFromDeckSync(`conn:${provider}`, ids);
      connection = orderedConnections.find((c) => c.id === selectedId) || orderedConnections[0];
    } else {
      connection = orderedConnections[0];
    }

    return {
      apiKey: connection.apiKey,
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      expiresAt: connection.tokenExpiresAt || connection.expiresAt || null,
      projectId: connection.projectId,
      copilotToken:
        typeof connection.providerSpecificData.copilotToken === "string"
          ? connection.providerSpecificData.copilotToken
          : null,
      providerSpecificData: connection.providerSpecificData,
      connectionId: connection.id,
      testStatus: connection.testStatus,
      lastError: connection.lastError,
      lastErrorType: connection.lastErrorType,
      lastErrorSource: connection.lastErrorSource,
      errorCode: connection.errorCode,
      rateLimitedUntil: connection.rateLimitedUntil,
    };
  } finally {
    if (resolveMutex) resolveMutex();
  }
}

export function extractApiKey(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

export async function isValidApiKey(apiKey: string) {
  if (!apiKey) return false;
  return await validateApiKey(apiKey);
}
