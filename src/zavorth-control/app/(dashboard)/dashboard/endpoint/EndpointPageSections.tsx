"use client";

import { useMemo } from "react";
import PropTypes from "prop-types";
import { Modal } from "@/shared/components";
import { AI_PROVIDERS, getProviderByAlias } from "@/shared/constants/providers";
import { useTranslations } from "next-intl";

type EndpointModel = {
  id: string;
  parent?: string | null;
  owned_by?: string | null;
  type?: string | null;
  root?: string | null;
  custom?: boolean;
};

type CopyHandler = (value: string, copyKey?: string) => void;

type ProviderModelsModalProps = {
  provider: any;
  models: EndpointModel[];
  copy: CopyHandler;
  copied: string | null;
  onClose: () => void;
};

type EndpointSectionProps = {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  path: string;
  description: string;
  models: EndpointModel[];
  expanded: boolean;
  onToggle: () => void;
  copy: CopyHandler;
  copied: string | null;
  baseUrl: string;
};

export function ProviderModelsModal({
  provider,
  models,
  copy,
  copied,
  onClose,
}: ProviderModelsModalProps) {
  const t = useTranslations("endpoint");
  const tc = useTranslations("common");
  const providerAlias = provider.provider.alias || provider.id;
  const providerModels = useMemo(() => {
    return models.filter(
      (model) =>
        !model.parent && (model.owned_by === providerAlias || model.owned_by === provider.id)
    );
  }, [models, providerAlias, provider.id]);

  const chatModels = providerModels.filter((model) => !model.type);
  const embeddingModels = providerModels.filter((model) => model.type === "embedding");
  const imageModels = providerModels.filter((model) => model.type === "image");

  const renderModelGroup = (title: string, icon: string, groupModels: EndpointModel[]) => {
    if (groupModels.length === 0) {
      return null;
    }

    return (
      <div className="mb-4">
        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm">{icon}</span>
          {title} ({groupModels.length})
        </h4>
        <div className="flex flex-col gap-1">
          {groupModels.map((model) => {
            const copyKey = `modal-${model.id}`;
            return (
              <div
                key={model.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface/60 group"
              >
                <code className="text-sm font-mono flex-1 truncate">{model.id}</code>
                {model.custom && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    {t("custom")}
                  </span>
                )}
                <button
                  onClick={() => copy(model.id, copyKey)}
                  className="p-1 hover:bg-sidebar rounded text-text-muted hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                  title={tc("copy")}
                >
                  <span className="material-symbols-outlined text-sm">
                    {copied === copyKey ? "check" : "content_copy"}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t("providerModelsTitle", { provider: provider.provider.name })}
    >
      <div className="max-h-[60vh] overflow-y-auto">
        {providerModels.length === 0 ? (
          <p className="text-sm text-text-muted py-4 text-center">{t("noModelsForProvider")}</p>
        ) : (
          <>
            {renderModelGroup(t("chat"), "chat", chatModels)}
            {renderModelGroup(t("embedding"), "data_array", embeddingModels)}
            {renderModelGroup(t("image"), "image", imageModels)}
          </>
        )}
      </div>
    </Modal>
  );
}

ProviderModelsModal.propTypes = {
  provider: PropTypes.object.isRequired,
  models: PropTypes.array.isRequired,
  copy: PropTypes.func.isRequired,
  copied: PropTypes.string,
  onClose: PropTypes.func.isRequired,
};

export function EndpointSection({
  icon,
  iconColor,
  iconBg,
  title,
  path,
  description,
  models,
  expanded,
  onToggle,
  copy,
  copied,
  baseUrl,
}: EndpointSectionProps) {
  const t = useTranslations("endpoint");
  const grouped = useMemo(() => {
    const groupedMap: Record<string, EndpointModel[]> = {};
    for (const model of models) {
      const owner = model.owned_by || "unknown";
      if (!groupedMap[owner]) {
        groupedMap[owner] = [];
      }
      groupedMap[owner].push(model);
    }
    return Object.entries(groupedMap).sort((a, b) => b[1].length - a[1].length);
  }, [models]);

  const resolveProvider = (id: string) => AI_PROVIDERS[id] || getProviderByAlias(id);
  const providerColor = (id: string) => resolveProvider(id)?.color || "#888";
  const providerName = (id: string) => resolveProvider(id)?.name || id;
  const copyId = `endpoint_${path}`;
  const endpointUrl = `${baseUrl.replace(/\/v1$/, "")}${path}`;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 hover:bg-surface/50 transition-colors text-left"
      >
        <div className={`flex items-center justify-center size-10 rounded-lg ${iconBg} shrink-0`}>
          <span className={`material-symbols-outlined text-xl ${iconColor}`}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{title}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface text-text-muted font-medium">
              {t("modelsCount", { count: models.length })}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">{description}</p>
        </div>
        <span
          className={`material-symbols-outlined text-text-muted text-lg transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 pb-4">
          <div className="flex items-center gap-2 mt-3 mb-3">
            <code className="flex-1 text-xs font-mono text-text-muted bg-surface/80 px-3 py-1.5 rounded-lg truncate">
              {endpointUrl}
            </code>
            <button
              onClick={() => copy(endpointUrl, copyId)}
              className="p-1.5 hover:bg-surface rounded-lg text-text-muted hover:text-primary transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">
                {copied === copyId ? "check" : "content_copy"}
              </span>
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {grouped.map(([providerId, providerModels]) => (
              <div key={providerId}>
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: providerColor(providerId) }}
                  />
                  <span className="text-xs font-semibold text-text-main">
                    {providerName(providerId)}
                  </span>
                  <span className="text-xs text-text-muted">({providerModels.length})</span>
                </div>
                <div className="ml-5 flex flex-wrap gap-1.5">
                  {providerModels.map((model) => (
                    <span
                      key={model.id}
                      className="text-xs px-2 py-0.5 rounded-md bg-surface/80 text-text-muted font-mono"
                      title={model.id}
                    >
                      {model.root || model.id.split("/").pop()}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

EndpointSection.propTypes = {
  icon: PropTypes.string.isRequired,
  iconColor: PropTypes.string.isRequired,
  iconBg: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  path: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  models: PropTypes.array.isRequired,
  expanded: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  copy: PropTypes.func.isRequired,
  copied: PropTypes.string,
  baseUrl: PropTypes.string.isRequired,
};
