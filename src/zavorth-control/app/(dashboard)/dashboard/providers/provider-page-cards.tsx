"use client";

import Image from "next/image";
import Link from "next/link";
import PropTypes from "prop-types";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { Badge, Card, Toggle } from "@/shared/components";
import {
  isAnthropicCompatibleProvider,
  isClaudeCodeCompatibleProvider,
  isOpenAICompatibleProvider,
} from "@/shared/constants/providers";
import { useTranslations } from "next-intl";

function getStatusDisplay(connected, error, errorCode, t) {
  const parts = [];
  if (connected > 0) {
    parts.push(
      <Badge key="connected" variant="success" size="sm" dot>
        {t("connected", { count: connected })}
      </Badge>
    );
  }
  if (error > 0) {
    const errText = errorCode
      ? t("errorCount", { count: error, code: errorCode })
      : t("errorCountNoCode", { count: error });
    parts.push(
      <Badge key="error" variant="error" size="sm" dot>
        {errText}
      </Badge>
    );
  }
  if (parts.length === 0) {
    return <span className="text-text-muted">{t("noConnections")}</span>;
  }
  return parts;
}

function getPickerRouteVariant(route) {
  if (!route) return "default";
  if (route.ready === true) return "success";
  if (route.readiness === "needs_probe" || route.readinessCode === "needs_probe") return "warning";
  return "default";
}

function PickerRouteBadge({ route }) {
  if (!route) return null;

  const label = [route.routeClass || route.routeKind || "route", route.readinessCode || route.readiness]
    .filter(Boolean)
    .join(" / ");

  return (
    <Badge variant={getPickerRouteVariant(route)} size="sm">
      {label || "picker route"}
    </Badge>
  );
}

const providerShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  color: PropTypes.string,
  textIcon: PropTypes.string,
  apiType: PropTypes.string,
}).isRequired;

const providerStatsShape = PropTypes.shape({
  connected: PropTypes.number,
  error: PropTypes.number,
  errorCode: PropTypes.string,
  errorTime: PropTypes.string,
  expiryStatus: PropTypes.string,
  total: PropTypes.number,
  allDisabled: PropTypes.bool,
}).isRequired;

const pickerRouteShape = PropTypes.shape({
  id: PropTypes.string,
  label: PropTypes.string,
  providerId: PropTypes.string,
  providerName: PropTypes.string,
  routeKind: PropTypes.string,
  routeClass: PropTypes.string,
  readiness: PropTypes.string,
  readinessCode: PropTypes.string,
  ready: PropTypes.bool,
  catalogSource: PropTypes.string,
});

export function ProviderCard({ providerId, provider, stats, authType, onToggle, pickerRoute }) {
  const t = useTranslations("providers");
  const tc = useTranslations("common");
  const { connected, error, errorCode, errorTime, allDisabled } = stats;

  const dotColors = {
    free: "bg-green-500",
    oauth: "bg-blue-500",
    apikey: "bg-amber-500",
    compatible: "bg-orange-500",
  };
  const dotLabels = {
    free: tc("free"),
    oauth: t("oauthLabel"),
    apikey: t("apiKeyLabel"),
    compatible: t("compatibleLabel"),
  };

  return (
    <Link href={`/dashboard/providers/${providerId}`} className="group">
      <Card
        padding="xs"
        className={`h-full hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors cursor-pointer ${allDisabled ? "opacity-50" : ""}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="size-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${provider.color}15` }}
            >
              <ProviderIcon providerId={provider.id} size={28} type="color" />
            </div>
            <div>
              <h3 className="font-semibold flex items-center gap-1.5">
                {provider.name}
                <span
                  className={`size-2 rounded-full ${dotColors[authType] || dotColors.oauth} shrink-0`}
                  title={dotLabels[authType] || t("oauthLabel")}
                />
              </h3>
              <div className="flex items-center gap-2 text-xs flex-wrap">
                {allDisabled ? (
                  <Badge variant="default" size="sm">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">pause_circle</span>
                      {t("disabled")}
                    </span>
                  </Badge>
                ) : (
                  <>
                    {getStatusDisplay(connected, error, errorCode, t)}
                    {stats.expiryStatus === "expired" && (
                      <Badge variant="error" size="sm" dot>
                        Expired
                      </Badge>
                    )}
                    {stats.expiryStatus === "expiring_soon" && (
                      <Badge variant="warning" size="sm" dot>
                        Expiring Soon
                      </Badge>
                    )}
                    <PickerRouteBadge route={pickerRoute} />
                    {errorTime && <span className="text-text-muted">• {errorTime}</span>}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stats.total > 0 && (
              <div
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onToggle(!allDisabled ? false : true);
                }}
              >
                <Toggle
                  size="sm"
                  checked={!allDisabled}
                  onChange={() => {}}
                  title={allDisabled ? t("enableProvider") : t("disableProvider")}
                />
              </div>
            )}
            <span className="material-symbols-outlined text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
              chevron_right
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

ProviderCard.propTypes = {
  providerId: PropTypes.string.isRequired,
  provider: providerShape,
  stats: providerStatsShape,
  authType: PropTypes.string,
  onToggle: PropTypes.func.isRequired,
  pickerRoute: pickerRouteShape,
};

export function ApiKeyProviderCard({ providerId, provider, stats, authType, onToggle, pickerRoute }) {
  const t = useTranslations("providers");
  const tc = useTranslations("common");
  const { connected, error, errorCode, errorTime, allDisabled } = stats;
  const isCompatible = isOpenAICompatibleProvider(providerId);
  const isCcCompatible = isClaudeCodeCompatibleProvider(providerId);
  const isAnthropicCompatible =
    isAnthropicCompatibleProvider(providerId) && !isClaudeCodeCompatibleProvider(providerId);

  const dotColors = {
    free: "bg-green-500",
    oauth: "bg-blue-500",
    apikey: "bg-amber-500",
    compatible: "bg-orange-500",
  };
  const dotLabels = {
    free: tc("free"),
    oauth: t("oauthLabel"),
    apikey: t("apiKeyLabel"),
    compatible: t("compatibleLabel"),
  };

  const staticIconPath = (() => {
    if (isCompatible) {
      return provider.apiType === "responses" ? "/providers/oai-r.png" : "/providers/oai-cc.png";
    }
    if (isAnthropicCompatible || isCcCompatible) return "/providers/anthropic-m.png";
    return null;
  })();

  return (
    <Link href={`/dashboard/providers/${providerId}`} className="group">
      <Card
        padding="xs"
        className={`h-full hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors cursor-pointer ${allDisabled ? "opacity-50" : ""}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="size-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${provider.color}15` }}
            >
              {staticIconPath ? (
                <Image
                  src={staticIconPath}
                  alt={provider.name}
                  width={30}
                  height={30}
                  className="object-contain rounded-lg max-w-[30px] max-h-[30px]"
                  sizes="30px"
                />
              ) : (
                <ProviderIcon providerId={provider.id} size={28} type="color" />
              )}
            </div>
            <div>
              <h3 className="font-semibold flex items-center gap-1.5">
                {provider.name}
                <span
                  className={`size-2 rounded-full ${dotColors[authType] || dotColors.apikey} shrink-0`}
                  title={dotLabels[authType] || t("apiKeyLabel")}
                />
              </h3>
              <div className="flex items-center gap-2 text-xs flex-wrap">
                {allDisabled ? (
                  <Badge variant="default" size="sm">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">pause_circle</span>
                      {t("disabled")}
                    </span>
                  </Badge>
                ) : (
                  <>
                    {getStatusDisplay(connected, error, errorCode, t)}
                    {stats.expiryStatus === "expired" && (
                      <Badge variant="error" size="sm" dot>
                        Expired
                      </Badge>
                    )}
                    {stats.expiryStatus === "expiring_soon" && (
                      <Badge variant="warning" size="sm" dot>
                        Expiring Soon
                      </Badge>
                    )}
                    {isCompatible && (
                      <Badge variant="default" size="sm">
                        {provider.apiType === "responses" ? t("responses") : t("chat")}
                      </Badge>
                    )}
                    {isCcCompatible && <Badge variant="default" size="sm">CC</Badge>}
                    {isAnthropicCompatible && (
                      <Badge variant="default" size="sm">
                        {t("messages")}
                      </Badge>
                    )}
                    {errorTime && <span className="text-text-muted">• {errorTime}</span>}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stats.total > 0 && (
              <div
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onToggle(!allDisabled ? false : true);
                }}
              >
                <Toggle
                  size="sm"
                  checked={!allDisabled}
                  onChange={() => {}}
                  title={allDisabled ? t("enableProvider") : t("disableProvider")}
                />
              </div>
            )}
            <span className="material-symbols-outlined text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
              chevron_right
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

ApiKeyProviderCard.propTypes = {
  providerId: PropTypes.string.isRequired,
  provider: providerShape,
  stats: providerStatsShape,
  authType: PropTypes.string,
  onToggle: PropTypes.func.isRequired,
  pickerRoute: pickerRouteShape,
};
