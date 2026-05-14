"use client";

import { Button, Card } from "@/shared/components";
import {
  CC_COMPATIBLE_DETAILS_TITLE,
  CC_COMPATIBLE_LABEL,
} from "../provider-detail-model-compat";
import {
  getCompatibleEndpointSuffix,
  getCompatibleProtocolLabel,
} from "./helpers";
import type { ProviderDetailPageModel } from "../useProviderDetailPageModel";

type CompatibleNodeCardProps = Pick<
  ProviderDetailPageModel,
  | "isCompatible"
  | "providerNode"
  | "isCcCompatible"
  | "isAnthropicCompatible"
  | "isAnthropicProtocolCompatible"
  | "connections"
  | "setShowAddApiKeyModal"
  | "setShowEditNodeModal"
  | "t"
  | "providerId"
  | "router"
>;

export function CompatibleNodeCard({
  isCompatible,
  providerNode,
  isCcCompatible,
  isAnthropicCompatible,
  isAnthropicProtocolCompatible,
  connections,
  setShowAddApiKeyModal,
  setShowEditNodeModal,
  t,
  providerId,
  router,
}: CompatibleNodeCardProps) {
  if (!(isCompatible && providerNode)) {
    return null;
  }

  const handleDeleteCompatibleNode = async () => {
    if (
      !confirm(
        t("deleteCompatibleNodeConfirm", {
          type: isCcCompatible
            ? CC_COMPATIBLE_LABEL
            : isAnthropicCompatible
              ? t("anthropic")
              : t("openai"),
        }),
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/provider-nodes/${providerId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/dashboard/providers");
      }
    } catch (error) {
      console.log("Error deleting provider node:", error);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">
            {isCcCompatible
              ? CC_COMPATIBLE_DETAILS_TITLE
              : isAnthropicCompatible
                ? t("anthropicCompatibleDetails")
                : t("openaiCompatibleDetails")}
          </h2>
          <p className="text-sm text-text-muted">
            {getCompatibleProtocolLabel({ isAnthropicProtocolCompatible, providerNode, t })}{" "}
            - {(providerNode.baseUrl || "").replace(/\/$/, "")}/
            {getCompatibleEndpointSuffix({
              isCcCompatible,
              isAnthropicCompatible,
              providerNode,
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            icon="add"
            onClick={() => setShowAddApiKeyModal(true)}
            disabled={connections.length > 0}
          >
            {t("add")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon="edit"
            onClick={() => setShowEditNodeModal(true)}
          >
            {t("edit")}
          </Button>
          <Button size="sm" variant="secondary" icon="delete" onClick={handleDeleteCompatibleNode}>
            {t("delete")}
          </Button>
        </div>
      </div>
      {connections.length > 0 && (
        <p className="text-sm text-text-muted">{t("singleConnectionPerCompatible")}</p>
      )}
    </Card>
  );
}
