"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge, Button } from "@/shared/components";
import { pickMaskedDisplayValue } from "@/shared/utils/maskEmail";

function normalizeCodexLimitPolicy(policy: unknown): { use5h: boolean; useWeekly: boolean } {
  const raw = policy as { use5h?: unknown; useWeekly?: unknown } | null | undefined;
  return {
    use5h: Boolean(raw?.use5h),
    useWeekly: Boolean(raw?.useWeekly),
  };
}

const ERROR_TYPE_LABELS: Record<string, { labelKey: string; variant: string }> = {
  runtime_error: { labelKey: "errorTypeRuntime", variant: "warning" },
  upstream_auth_error: { labelKey: "errorTypeUpstreamAuth", variant: "error" },
  account_deactivated: { labelKey: "Account Deactivated", variant: "error" },
  auth_missing: { labelKey: "errorTypeMissingCredential", variant: "warning" },
  token_refresh_failed: { labelKey: "errorTypeRefreshFailed", variant: "warning" },
  token_expired: { labelKey: "errorTypeTokenExpired", variant: "warning" },
  upstream_rate_limited: { labelKey: "errorTypeRateLimited", variant: "warning" },
  upstream_unavailable: { labelKey: "errorTypeUpstreamUnavailable", variant: "error" },
  network_error: { labelKey: "errorTypeNetworkError", variant: "warning" },
  unsupported: { labelKey: "errorTypeTestUnsupported", variant: "default" },
  upstream_error: { labelKey: "errorTypeUpstreamError", variant: "error" },
  banned: { labelKey: "403 Banned", variant: "error" },
  credits_exhausted: { labelKey: "No Credits", variant: "warning" },
};

function inferErrorType(connection: any, isCooldown: boolean) {
  if (isCooldown) return "upstream_rate_limited";
  if (connection.testStatus === "banned") return "banned";
  if (connection.testStatus === "credits_exhausted") return "credits_exhausted";
  if (connection.lastErrorType) return connection.lastErrorType;

  const code = Number(connection.errorCode);
  if (code === 401 || code === 403) return "upstream_auth_error";
  if (code === 429) return "upstream_rate_limited";
  if (code >= 500) return "upstream_unavailable";

  const msg = (connection.lastError || "").toLowerCase();
  if (!msg) return null;
  if (
    msg.includes("runtime") ||
    msg.includes("not runnable") ||
    msg.includes("not installed") ||
    msg.includes("healthcheck")
  )
    return "runtime_error";
  if (msg.includes("refresh failed")) return "token_refresh_failed";
  if (msg.includes("token expired") || msg.includes("expired")) return "token_expired";
  if (
    msg.includes("invalid api key") ||
    msg.includes("token invalid") ||
    msg.includes("revoked") ||
    msg.includes("access denied") ||
    msg.includes("unauthorized")
  )
    return "upstream_auth_error";
  if (
    msg.includes("rate limit") ||
    msg.includes("quota") ||
    msg.includes("too many requests") ||
    msg.includes("429")
  )
    return "upstream_rate_limited";
  if (
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("econn") ||
    msg.includes("enotfound")
  )
    return "network_error";
  if (msg.includes("not supported")) return "unsupported";
  return "upstream_error";
}

function getStatusPresentation(connection: any, effectiveStatus: string, isCooldown: boolean, t: any) {
  if (connection.isActive === false) {
    return {
      statusVariant: "default",
      statusLabel: t("statusDisabled"),
      errorType: null,
      errorBadge: null,
      errorTextClass: "text-text-muted",
    };
  }

  if (effectiveStatus === "active" || effectiveStatus === "success") {
    return {
      statusVariant: "success",
      statusLabel: t("statusConnected"),
      errorType: null,
      errorBadge: null,
      errorTextClass: "text-text-muted",
    };
  }

  const errorType = inferErrorType(connection, isCooldown);
  const errorBadge = errorType ? ERROR_TYPE_LABELS[errorType] || null : null;

  if (errorType === "runtime_error") {
    return {
      statusVariant: "warning",
      statusLabel: t("statusRuntimeIssue"),
      errorType,
      errorBadge,
      errorTextClass: "text-yellow-600 dark:text-yellow-400",
    };
  }

  if (errorType === "account_deactivated") {
    return {
      statusVariant: "error",
      statusLabel: t("statusDeactivated", "Deactivated"),
      errorType,
      errorBadge,
      errorTextClass: "text-red-600 font-bold",
    };
  }

  if (
    errorType === "upstream_auth_error" ||
    errorType === "auth_missing" ||
    errorType === "token_refresh_failed" ||
    errorType === "token_expired"
  ) {
    return {
      statusVariant: "error",
      statusLabel: t("statusAuthFailed"),
      errorType,
      errorBadge,
      errorTextClass: "text-red-500",
    };
  }

  if (errorType === "upstream_rate_limited") {
    return {
      statusVariant: "warning",
      statusLabel: t("statusRateLimited"),
      errorType,
      errorBadge,
      errorTextClass: "text-yellow-600 dark:text-yellow-400",
    };
  }

  if (errorType === "network_error") {
    return {
      statusVariant: "warning",
      statusLabel: t("statusNetworkIssue"),
      errorType,
      errorBadge,
      errorTextClass: "text-yellow-600 dark:text-yellow-400",
    };
  }

  if (errorType === "unsupported") {
    return {
      statusVariant: "default",
      statusLabel: t("statusTestUnsupported"),
      errorType,
      errorBadge,
      errorTextClass: "text-text-muted",
    };
  }

  if (errorType === "banned") {
    return {
      statusVariant: "error",
      statusLabel: t("statusBanned", "Banned (403)"),
      errorType,
      errorBadge,
      errorTextClass: "text-red-600 font-bold",
    };
  }

  if (errorType === "credits_exhausted") {
    return {
      statusVariant: "warning",
      statusLabel: t("statusCreditsExhausted", "Out of Credits"),
      errorType,
      errorBadge,
      errorTextClass: "text-amber-500",
    };
  }

  const fallbackStatusMap: Record<string, string> = {
    unavailable: t("statusUnavailable"),
    failed: t("statusFailed"),
    error: t("statusError"),
  };

  return {
    statusVariant: "error",
    statusLabel: fallbackStatusMap[effectiveStatus] || effectiveStatus || t("statusError"),
    errorType,
    errorBadge,
    errorTextClass: "text-red-500",
  };
}

function CooldownTimer({ until }: { until: string }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const updateRemaining = () => {
      const diff = new Date(until).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("");
        return;
      }
      const secs = Math.floor(diff / 1000);
      if (secs < 60) {
        setRemaining(`${secs}s`);
      } else if (secs < 3600) {
        setRemaining(`${Math.floor(secs / 60)}m ${secs % 60}s`);
      } else {
        const hrs = Math.floor(secs / 3600);
        const mins = Math.floor((secs % 3600) / 60);
        setRemaining(`${hrs}h ${mins}m`);
      }
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [until]);

  if (!remaining) return null;
  return <span className="text-xs text-orange-500 font-mono">⏱ {remaining}</span>;
}

export function ConnectionRow({
  connection,
  isOAuth,
  isCodex,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onToggleActive,
  onToggleRateLimit,
  onToggleCodex5h,
  onToggleCodexWeekly,
  onRetest,
  isRetesting,
  onEdit,
  onDelete,
  onReauth,
  onProxy,
  hasProxy,
  proxySource,
  proxyHost,
  onRefreshToken,
  isRefreshing,
  onApplyCodexAuthLocal,
  isApplyingCodexAuthLocal,
  onExportCodexAuthFile,
  isExportingCodexAuthFile,
}: any) {
  const t = useTranslations("providers");
  const displayName = isOAuth
    ? pickMaskedDisplayValue([connection.name, connection.email, connection.displayName], t("oauthAccount"))
    : connection.name;
  const applyCodexAuthLabel =
    typeof t.has === "function" && t.has("applyCodexAuthLocal")
      ? t("applyCodexAuthLocal")
      : "Apply auth";
  const exportCodexAuthLabel =
    typeof t.has === "function" && t.has("exportCodexAuthFile")
      ? t("exportCodexAuthFile")
      : "Export auth";

  const [isCooldown, setIsCooldown] = useState(false);
  const effectiveExpiresAt = connection.tokenExpiresAt || connection.expiresAt;
  const getTokenMinsLeft = () => {
    if (!isOAuth || !effectiveExpiresAt) return null;
    const expiresMs = new Date(effectiveExpiresAt).getTime();
    return Math.floor((expiresMs - Date.now()) / 60000);
  };
  const [tokenMinsLeft, setTokenMinsLeft] = useState<number | null>(getTokenMinsLeft);

  useEffect(() => {
    if (!isOAuth || !effectiveExpiresAt) return;
    const update = () => {
      const expiresMs = new Date(effectiveExpiresAt).getTime();
      setTokenMinsLeft(Math.floor((expiresMs - Date.now()) / 60000));
    };
    update();
    const iv = setInterval(update, 30000);
    return () => clearInterval(iv);
  }, [isOAuth, effectiveExpiresAt]);

  useEffect(() => {
    const checkCooldown = () => {
      const cooldown =
        connection.rateLimitedUntil && new Date(connection.rateLimitedUntil).getTime() > Date.now();
      setIsCooldown(cooldown);
    };

    checkCooldown();
    const interval = connection.rateLimitedUntil ? setInterval(checkCooldown, 1000) : null;
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [connection.rateLimitedUntil]);

  const effectiveStatus =
    connection.testStatus === "unavailable" && !isCooldown ? "active" : connection.testStatus;
  const statusPresentation = getStatusPresentation(connection, effectiveStatus, isCooldown, t);
  const rateLimitEnabled = !!connection.rateLimitProtection;
  const codexPolicy =
    connection.providerSpecificData &&
    typeof connection.providerSpecificData === "object" &&
    connection.providerSpecificData.codexLimitPolicy &&
    typeof connection.providerSpecificData.codexLimitPolicy === "object"
      ? connection.providerSpecificData.codexLimitPolicy
      : {};
  const normalizedCodexPolicy = normalizeCodexLimitPolicy(codexPolicy);
  const codex5hEnabled = normalizedCodexPolicy.use5h;
  const codexWeeklyEnabled = normalizedCodexPolicy.useWeekly;

  return (
    <div
      className={`group flex items-center justify-between p-3 rounded-lg hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors ${connection.isActive === false ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex flex-col">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className={`p-0.5 rounded ${isFirst ? "text-text-muted/30 cursor-not-allowed" : "hover:bg-sidebar text-text-muted hover:text-primary"}`}
          >
            <span className="material-symbols-outlined text-sm">keyboard_arrow_up</span>
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className={`p-0.5 rounded ${isLast ? "text-text-muted/30 cursor-not-allowed" : "hover:bg-sidebar text-text-muted hover:text-primary"}`}
          >
            <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
          </button>
        </div>
        <span className="material-symbols-outlined text-base text-text-muted">{isOAuth ? "lock" : "key"}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{displayName}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant={statusPresentation.statusVariant as any} size="sm" dot>
              {statusPresentation.statusLabel}
            </Badge>
            {tokenMinsLeft !== null &&
              (tokenMinsLeft < 0 ? (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-red-500/15 text-red-500">
                  <span className="material-symbols-outlined text-[11px]">error</span>
                  expired
                </span>
              ) : tokenMinsLeft < 30 ? (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-500/15 text-amber-500">
                  <span className="material-symbols-outlined text-[11px]">warning</span>
                  {`~${tokenMinsLeft}m`}
                </span>
              ) : null)}
            {isCooldown && connection.isActive !== false && <CooldownTimer until={connection.rateLimitedUntil} />}
            {statusPresentation.errorBadge && connection.isActive !== false && (
              <Badge variant={statusPresentation.errorBadge.variant} size="sm">
                {t(statusPresentation.errorBadge.labelKey)}
              </Badge>
            )}
            {connection.lastError && connection.isActive !== false && (
              <span className={`text-xs truncate max-w-[300px] ${statusPresentation.errorTextClass}`} title={connection.lastError.replace(/[<>]/g, "")}>
                {connection.lastError.replace(/[<>]/g, "")}
              </span>
            )}
            <span className="text-xs text-text-muted">#{connection.priority}</span>
            {connection.globalPriority && (
              <span className="text-xs text-text-muted">{t("autoPriority", { priority: connection.globalPriority })}</span>
            )}
            <span className="text-text-muted/30 select-none">|</span>
            <button
              onClick={() => onToggleRateLimit(!rateLimitEnabled)}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-all cursor-pointer ${
                rateLimitEnabled
                  ? "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25"
                  : "bg-black/[0.03] dark:bg-white/[0.03] text-text-muted/50 hover:text-text-muted hover:bg-black/[0.06] dark:hover:bg-white/[0.06]"
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">shield</span>
              {rateLimitEnabled ? t("rateLimitProtected") : t("rateLimitUnprotected")}
            </button>
            {isCodex && (
              <>
                <span className="text-text-muted/30 select-none">|</span>
                <button
                  onClick={() => onToggleCodex5h?.(!codex5hEnabled)}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-all cursor-pointer ${
                    codex5hEnabled
                      ? "bg-blue-500/15 text-blue-500 hover:bg-blue-500/25"
                      : "bg-black/[0.03] dark:bg-white/[0.03] text-text-muted/50 hover:text-text-muted hover:bg-black/[0.06] dark:hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[13px]">timer</span>
                  5h {codex5hEnabled ? "ON" : "OFF"}
                </button>
                <button
                  onClick={() => onToggleCodexWeekly?.(!codexWeeklyEnabled)}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-all cursor-pointer ${
                    codexWeeklyEnabled
                      ? "bg-violet-500/15 text-violet-500 hover:bg-violet-500/25"
                      : "bg-black/[0.03] dark:bg-white/[0.03] text-text-muted/50 hover:text-text-muted hover:bg-black/[0.06] dark:hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[13px]">date_range</span>
                  Weekly {codexWeeklyEnabled ? "ON" : "OFF"}
                </button>
              </>
            )}
            {hasProxy && (
              <>
                <span className="text-text-muted/30 select-none">|</span>
                <span
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${
                    proxySource === "global"
                      ? "bg-emerald-500/15 text-emerald-500"
                      : proxySource === "provider"
                        ? "bg-amber-500/15 text-amber-500"
                        : "bg-blue-500/15 text-blue-500"
                  }`}
                >
                  <span className="material-symbols-outlined text-[13px]">vpn_lock</span>
                  {proxyHost || t("proxy")}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" icon="refresh" loading={isRetesting} disabled={connection.isActive === false} onClick={onRetest} className="!h-7 !px-2 text-xs">
          {t("retest")}
        </Button>
        {onRefreshToken && (
          <Button size="sm" variant="ghost" icon="token" loading={isRefreshing} disabled={connection.isActive === false || isRefreshing} onClick={onRefreshToken} className="!h-7 !px-2 text-xs text-amber-500 hover:text-amber-400">
            Token
          </Button>
        )}
        {isCodex && onApplyCodexAuthLocal && (
          <Button size="sm" variant="ghost" icon="download_done" loading={isApplyingCodexAuthLocal} disabled={isApplyingCodexAuthLocal} onClick={onApplyCodexAuthLocal} className="!h-7 !px-2 text-xs text-emerald-500 hover:text-emerald-400">
            {applyCodexAuthLabel}
          </Button>
        )}
        {isCodex && onExportCodexAuthFile && (
          <Button size="sm" variant="ghost" icon="ios_share" loading={isExportingCodexAuthFile} disabled={isExportingCodexAuthFile} onClick={onExportCodexAuthFile} className="!h-7 !px-2 text-xs text-blue-500 hover:text-blue-400">
            {exportCodexAuthLabel}
          </Button>
        )}
        <Button size="sm" variant="ghost" icon="edit" onClick={onEdit} className="!h-7 !px-2 text-xs">
          {t("edit")}
        </Button>
        <Button size="sm" variant="ghost" icon="open_in_new" onClick={onProxy} className="!h-7 !px-2 text-xs">
          {t("proxy")}
        </Button>
        <Button size="sm" variant="ghost" icon="delete" onClick={onDelete} className="!h-7 !px-2 text-xs text-red-500 hover:text-red-400">
          {t("delete")}
        </Button>
      </div>
    </div>
  );
}

