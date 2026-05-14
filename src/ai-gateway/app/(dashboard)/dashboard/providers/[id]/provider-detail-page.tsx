"use client";

import { ProviderDetailLayout } from "./provider-detail-layout";
import { useProviderDetailPageModel } from "./useProviderDetailPageModel";

export default function ProviderDetailPage() {
  const pageModel = useProviderDetailPageModel();

  return <ProviderDetailLayout {...pageModel} />;
}
