import { CC_COMPATIBLE_DEFAULT_CHAT_PATH } from "../provider-detail-model-compat";
import type { ProviderDetailPageModel } from "../useProviderDetailPageModel";

type ProviderInfo = NonNullable<ProviderDetailPageModel["providerInfo"]>;

export function getProviderHeaderIconPath({
  isOpenAICompatible,
  isAnthropicProtocolCompatible,
  providerInfo,
}: {
  isOpenAICompatible: ProviderDetailPageModel["isOpenAICompatible"];
  isAnthropicProtocolCompatible: ProviderDetailPageModel["isAnthropicProtocolCompatible"];
  providerInfo: ProviderInfo;
}) {
  if (isOpenAICompatible && providerInfo.apiType) {
    return providerInfo.apiType === "responses" ? "/providers/oai-r.png" : "/providers/oai-cc.png";
  }

  if (isAnthropicProtocolCompatible) {
    return "/providers/anthropic-m.png";
  }

  return `/providers/${providerInfo.id}.png`;
}

export function getCompatibleProtocolLabel({
  isAnthropicProtocolCompatible,
  providerNode,
  t,
}: Pick<ProviderDetailPageModel, "isAnthropicProtocolCompatible" | "providerNode" | "t">) {
  if (isAnthropicProtocolCompatible) {
    return t("messagesApi");
  }

  return providerNode?.apiType === "responses" ? t("responsesApi") : t("chatCompletions");
}

export function getCompatibleEndpointSuffix({
  isCcCompatible,
  isAnthropicCompatible,
  providerNode,
}: Pick<ProviderDetailPageModel, "isCcCompatible" | "isAnthropicCompatible" | "providerNode">) {
  if (isCcCompatible) {
    return (providerNode?.chatPath || CC_COMPATIBLE_DEFAULT_CHAT_PATH).replace(/^\//, "");
  }

  if (isAnthropicCompatible) {
    return (providerNode?.chatPath || "/messages").replace(/^\//, "");
  }

  if (providerNode?.apiType === "responses") {
    return (providerNode.chatPath || "/responses").replace(/^\//, "");
  }

  return (providerNode?.chatPath || "/chat/completions").replace(/^\//, "");
}

export function sortConnections(connections: ProviderDetailPageModel["connections"]) {
  return [...connections].sort((a, b) => (a.priority || 0) - (b.priority || 0));
}

export function groupConnectionsByTag(sortedConnections: ProviderDetailPageModel["connections"]) {
  const hasAnyTag = sortedConnections.some((connection) =>
    Boolean((connection.providerSpecificData?.tag as string | undefined)?.trim()),
  );

  const groupMap = new Map<string, typeof sortedConnections>();
  for (const connection of sortedConnections) {
    const tag = (connection.providerSpecificData?.tag as string | undefined)?.trim() || "";
    if (!groupMap.has(tag)) {
      groupMap.set(tag, []);
    }
    groupMap.get(tag)!.push(connection);
  }

  const groupKeys = Array.from(groupMap.keys()).sort((left, right) => {
    if (left === "") {
      return -1;
    }
    if (right === "") {
      return 1;
    }
    return left.localeCompare(right);
  });

  return {
    hasAnyTag,
    groupKeys,
    groupMap,
  };
}
