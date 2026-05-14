import { getQuotaWindowStatus } from "@/domain/quotaCache";
import { getCodexModelScope } from "../compat/openSseCompat";

export type JsonRecord = Record<string, unknown>;

export interface ProviderConnectionView {
  id: string;
  isActive: boolean;
  rateLimitedUntil: string | null;
  testStatus: string | null;
  apiKey: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  expiresAt: string | null;
  projectId: string | null;
  providerSpecificData: JsonRecord;
  lastUsedAt: string | null;
  consecutiveUseCount: number;
  priority: number;
  lastError: string | null;
  lastErrorType: string | null;
  lastErrorSource: string | null;
  errorCode: string | number | null;
  backoffLevel: number;
}

export interface RecoverableConnectionState {
  connectionId: string;
  testStatus?: string | null;
  lastError?: string | null;
  rateLimitedUntil?: string | null;
  errorCode?: string | number | null;
  lastErrorType?: string | null;
  lastErrorSource?: string | null;
}

export interface CredentialSelectionOptions {
  allowSuppressedConnections?: boolean;
  bypassQuotaPolicy?: boolean;
}

export interface QuotaLimitPolicy {
  enabled: boolean;
  thresholdPercent: number;
  windows: string[];
}

const CODEX_QUOTA_THRESHOLD_PERCENT = 90;
const MIN_QUOTA_THRESHOLD_PERCENT = 1;
const MAX_QUOTA_THRESHOLD_PERCENT = 100;

export function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

export function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function toProviderConnection(value: unknown): ProviderConnectionView {
  const row = asRecord(value);
  return {
    id: toStringOrNull(row.id) || "",
    isActive: row.isActive === true,
    rateLimitedUntil: toStringOrNull(row.rateLimitedUntil),
    testStatus: toStringOrNull(row.testStatus),
    apiKey: toStringOrNull(row.apiKey),
    accessToken: toStringOrNull(row.accessToken),
    refreshToken: toStringOrNull(row.refreshToken),
    tokenExpiresAt: toStringOrNull(row.tokenExpiresAt),
    expiresAt: toStringOrNull(row.expiresAt),
    projectId: toStringOrNull(row.projectId),
    providerSpecificData: asRecord(row.providerSpecificData),
    lastUsedAt: toStringOrNull(row.lastUsedAt),
    consecutiveUseCount: toNumber(row.consecutiveUseCount, 0),
    priority: toNumber(row.priority, 999),
    lastError: toStringOrNull(row.lastError),
    lastErrorType: toStringOrNull(row.lastErrorType),
    lastErrorSource: toStringOrNull(row.lastErrorSource),
    errorCode:
      typeof row.errorCode === "string" || typeof row.errorCode === "number" ? row.errorCode : null,
    backoffLevel: toNumber(row.backoffLevel, 0),
  };
}

export function getCodexScopeRateLimitedUntil(
  providerSpecificData: JsonRecord,
  model: string | null
): string | null {
  if (!model) return null;
  const scope = getCodexModelScope(model);
  const scopeMap = asRecord(providerSpecificData.codexScopeRateLimitedUntil);
  const value = scopeMap[scope];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function isCodexScopeUnavailable(
  connection: ProviderConnectionView,
  model: string | null
): boolean {
  const until = getCodexScopeRateLimitedUntil(connection.providerSpecificData, model);
  if (!until) return false;
  return new Date(until).getTime() > Date.now();
}

export function getEarliestCodexScopeRateLimitedUntil(
  connections: ProviderConnectionView[],
  model: string | null
): string | null {
  let earliest: string | null = null;
  let earliestMs = Infinity;

  for (const conn of connections) {
    const until = getCodexScopeRateLimitedUntil(conn.providerSpecificData, model);
    if (!until) continue;
    const ms = new Date(until).getTime();
    if (!Number.isFinite(ms) || ms <= Date.now()) continue;
    if (ms < earliestMs) {
      earliest = until;
      earliestMs = ms;
    }
  }

  return earliest;
}

export function isTerminalConnectionStatus(connection: ProviderConnectionView): boolean {
  const status = (connection.testStatus || "").trim().toLowerCase();
  return status === "credits_exhausted" || status === "banned" || status === "expired";
}

export function resolveQuotaLimitPolicy(
  provider: string,
  providerSpecificData: JsonRecord
): QuotaLimitPolicy {
  const rawPolicy = asRecord(providerSpecificData.limitPolicy);
  const rawWindows = Array.isArray(rawPolicy.windows) ? rawPolicy.windows : [];
  const windows = rawWindows.map(normalizeWindowName).filter(Boolean) as string[];

  if (provider === "codex") {
    const defaultWindows = applyCodexWindowPolicy(windows, providerSpecificData);
    const enabled = toBooleanOrDefault(rawPolicy.enabled, defaultWindows.length > 0);

    return {
      enabled,
      thresholdPercent: normalizeQuotaThreshold(rawPolicy.thresholdPercent),
      windows: defaultWindows,
    };
  }

  return {
    enabled: toBooleanOrDefault(rawPolicy.enabled, false),
    thresholdPercent: normalizeQuotaThreshold(rawPolicy.thresholdPercent),
    windows,
  };
}

export function evaluateQuotaLimitPolicy(
  provider: string,
  connection: ProviderConnectionView
): { blocked: boolean; reasons: string[]; resetAt: string | null } {
  const policy = resolveQuotaLimitPolicy(provider, connection.providerSpecificData);
  if (!policy.enabled || policy.windows.length === 0) {
    return { blocked: false, reasons: [], resetAt: null };
  }

  const reasons: string[] = [];
  const resetCandidates: Array<string | null> = [];

  for (const windowName of policy.windows) {
    const status = getQuotaWindowStatus(connection.id, windowName, policy.thresholdPercent);
    if (!status?.reachedThreshold) continue;
    reasons.push(`${windowName} usage ${Math.round(status.usedPercentage)}%`);
    resetCandidates.push(status.resetAt);
  }

  return {
    blocked: reasons.length > 0,
    reasons,
    resetAt: getEarliestFutureDate(resetCandidates),
  };
}

export function parseFutureDateMs(value: string | null): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms) || ms <= Date.now()) return null;
  return ms;
}

export function getEarliestFutureDate(candidates: Array<string | null>): string | null {
  return (
    candidates
      .map((candidate) => ({
        raw: candidate,
        ms: parseFutureDateMs(candidate),
      }))
      .filter((entry) => entry.ms !== null)
      .sort((a, b) => (a.ms as number) - (b.ms as number))[0]?.raw || null
  );
}

function toBooleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function getCodexLimitPolicy(providerSpecificData: JsonRecord): {
  use5h: boolean;
  useWeekly: boolean;
} {
  const policy = asRecord(providerSpecificData.codexLimitPolicy);
  return {
    use5h: toBooleanOrDefault(policy.use5h, true),
    useWeekly: toBooleanOrDefault(policy.useWeekly, true),
  };
}

function normalizeQuotaThreshold(value: unknown, fallback = CODEX_QUOTA_THRESHOLD_PERCENT): number {
  const parsed = toNumber(value, fallback);
  return Math.min(MAX_QUOTA_THRESHOLD_PERCENT, Math.max(MIN_QUOTA_THRESHOLD_PERCENT, parsed));
}

function normalizeWindowName(windowName: unknown): string | null {
  if (typeof windowName !== "string") return null;
  const normalized = windowName.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function uniqueWindows(windows: string[]): string[] {
  return [...new Set(windows)];
}

function normalizeCodexWindowName(windowName: unknown): string | null {
  if (typeof windowName !== "string") return null;
  const normalized = windowName.trim().toLowerCase();
  if (normalized === "session (5h)" || normalized === "5h" || normalized === "five_hour") {
    return "session";
  }
  if (normalized === "weekly (7d)" || normalized === "7d" || normalized === "seven_day") {
    return "weekly";
  }
  return normalized;
}

function applyCodexWindowPolicy(rawWindows: string[], providerSpecificData: JsonRecord): string[] {
  const codexPolicy = getCodexLimitPolicy(providerSpecificData);
  const normalizedRaw = rawWindows.map(normalizeCodexWindowName).filter(Boolean) as string[];

  let windows = [...normalizedRaw];
  windows = windows.filter((windowName) => {
    if (windowName === "session") return codexPolicy.use5h;
    if (windowName === "weekly") return codexPolicy.useWeekly;
    return true;
  });
  if (codexPolicy.use5h) windows.push("session");
  if (codexPolicy.useWeekly) windows.push("weekly");

  return uniqueWindows(windows);
}
