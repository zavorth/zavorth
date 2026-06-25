"use client";

import { useTranslations } from "next-intl";
import { HealthPageHeader } from "./health-page/HealthPageHeader";
import { HealthPageOverview } from "./health-page/HealthPageOverview";
import { HealthPageProviders } from "./health-page/HealthPageProviders";
import { useHealthDashboardModel } from "./health-page/useHealthDashboardModel";

export default function HealthPage() {
  const t = useTranslations("health");
  const tc = useTranslations("common");
  const tp = useTranslations("providers");
  const model = useHealthDashboardModel();

  if (!model.data && !model.error) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-text-muted mt-4">{t("loadingHealth")}</p>
        </div>
      </div>
    );
  }

  if (model.error && !model.data) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <span className="material-symbols-outlined text-red-500 text-[32px] mb-2">error</span>
          <p className="text-red-400">{t("failedToLoad", { error: model.error })}</p>
          <button
            onClick={() => void model.refresh()}
            className="mt-4 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm hover:bg-primary/20 transition-colors"
          >
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  const { system, providerHealth, providerSummary, rateLimitStatus, lockouts } = model.data;
  const cbEntries = Object.entries(providerHealth || {});
  const lockoutEntries = Object.entries(lockouts || {});

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <HealthPageHeader
        description={t("description")}
        lastRefresh={model.lastRefresh}
        onRefresh={() => void model.refresh()}
        refreshTitle={tc("refresh")}
        title={t("title")}
        updatedAtLabel={
          model.lastRefresh
            ? t("updatedAt", { time: model.lastRefresh.toLocaleTimeString() })
            : ""
        }
      />

      <HealthPageOverview
        cache={model.cache}
        cbEntries={cbEntries}
        data={model.data}
        degradation={model.degradation}
        providerSummary={providerSummary}
        signatureCache={model.signatureCache}
        system={system}
        t={t}
        telemetry={model.telemetry}
      />

      <HealthPageProviders
        cbEntries={cbEntries}
        lockoutEntries={lockoutEntries}
        onResetHealth={() => void model.resetHealth(t("resetConfirm"))}
        rateLimitStatus={rateLimitStatus}
        resetting={model.resetting}
        t={t}
        tc={tc}
        tp={tp}
      />
    </div>
  );
}
