"use client";

import Image from "next/image";
import Link from "next/link";
import { getProviderHeaderIconPath } from "./helpers";
import type { ProviderDetailPageModel } from "../useProviderDetailPageModel";

type HeaderSectionProps = Pick<
  ProviderDetailPageModel,
  | "providerInfo"
  | "t"
  | "connections"
  | "isOpenAICompatible"
  | "isAnthropicProtocolCompatible"
  | "headerImgError"
  | "setHeaderImgError"
>;

export function ProviderDetailHeaderSection({
  providerInfo,
  t,
  connections,
  isOpenAICompatible,
  isAnthropicProtocolCompatible,
  headerImgError,
  setHeaderImgError,
}: HeaderSectionProps) {
  if (!providerInfo) {
    return null;
  }

  const headerIconPath = getProviderHeaderIconPath({
    isOpenAICompatible,
    isAnthropicProtocolCompatible,
    providerInfo,
  });

  return (
    <div>
      <Link
        href="/dashboard/providers"
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary transition-colors mb-4"
      >
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        {t("backToProviders")}
      </Link>
      <div className="flex items-center gap-4">
        <div
          className="rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${providerInfo.color}15` }}
        >
          {headerImgError ? (
            <span className="text-sm font-bold" style={{ color: providerInfo.color }}>
              {providerInfo.textIcon || providerInfo.id.slice(0, 2).toUpperCase()}
            </span>
          ) : (
            <Image
              src={headerIconPath}
              alt={providerInfo.name}
              width={48}
              height={48}
              className="object-contain rounded-lg max-w-[48px] max-h-[48px]"
              sizes="48px"
              onError={() => setHeaderImgError(true)}
            />
          )}
        </div>
        <div>
          {providerInfo.website ? (
            <a
              href={providerInfo.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-3xl font-semibold tracking-tight hover:underline inline-flex items-center gap-2"
              style={{ color: providerInfo.color }}
            >
              {providerInfo.name}
              <span className="material-symbols-outlined text-lg opacity-60">open_in_new</span>
            </a>
          ) : (
            <h1 className="text-3xl font-semibold tracking-tight">{providerInfo.name}</h1>
          )}
          <p className="text-text-muted">{t("connectionCountLabel", { count: connections.length })}</p>
        </div>
      </div>
    </div>
  );
}
