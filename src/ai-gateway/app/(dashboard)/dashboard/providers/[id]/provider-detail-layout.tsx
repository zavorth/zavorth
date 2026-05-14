"use client";

import Link from "next/link";
import { Card, CardSkeleton } from "@/shared/components";
import { CompatibleNodeCard } from "./provider-detail-layout/CompatibleNodeCard";
import { ProviderDetailConnectionsCard } from "./provider-detail-layout/ConnectionsCard";
import { ProviderDetailHeaderSection } from "./provider-detail-layout/HeaderSection";
import { ProviderDetailLayoutModals } from "./provider-detail-layout/LayoutModals";
import { ProviderDetailModelsPanel } from "./provider-detail-models-panel";
import type { ProviderDetailPageModel } from "./useProviderDetailPageModel";

export function ProviderDetailLayout(props: ProviderDetailPageModel) {
  const { loading, providerInfo, t, isSearchProvider, providerId } = props;

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!providerInfo) {
    return (
      <div className="text-center py-20">
        <p className="text-text-muted">{t("providerNotFound")}</p>
        <Link href="/dashboard/providers" className="text-primary mt-4 inline-block">
          {t("backToProviders")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <ProviderDetailHeaderSection {...props} />

      <CompatibleNodeCard {...props} />

      <ProviderDetailConnectionsCard {...props} />

      {!isSearchProvider && (
        <Card>
          <h2 className="text-lg font-semibold mb-4">{t("availableModels")}</h2>
          <ProviderDetailModelsPanel {...props} />
        </Card>
      )}

      {isSearchProvider && (
        <Card>
          <h2 className="text-lg font-semibold mb-4">{t("searchProvider") || "Search Provider"}</h2>
          <p className="text-sm text-text-muted">
            {t("searchProviderDesc") ||
              "This provider is used for web search via POST /v1/search. No model configuration needed - search providers are ready to use once an API key is connected."}
          </p>
          {providerId === "perplexity-search" && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <span className="material-symbols-outlined text-sm text-blue-400">link</span>
              <p className="text-xs text-blue-300">
                Uses the same API key as <strong>Perplexity</strong> (chat provider). If you already
                have Perplexity configured, no additional setup is needed.
              </p>
            </div>
          )}
        </Card>
      )}

      <ProviderDetailLayoutModals {...props} />
    </div>
  );
}
