"use client";

import PropTypes from "prop-types";
import { ModelCompatPopover, providerText } from "./provider-detail-model-compat";

export function ModelRow({
  model,
  fullModel,
  copied,
  onCopy,
  t,
  showDeveloperToggle = true,
  effectiveModelNormalize,
  effectiveModelPreserveDeveloper,
  getUpstreamHeadersRecord,
  saveModelCompatFlags,
  compatDisabled,
  onToggleHidden,
  togglingHidden,
}: any) {
  const isHidden = Boolean(model.isHidden);
  return (
    <div
      className={`flex min-w-[220px] max-w-md items-center gap-2 rounded-lg border border-border px-3 py-2 hover:bg-sidebar/50 transition-opacity ${
        isHidden ? "opacity-50" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span
          className="material-symbols-outlined shrink-0 text-base"
          style={{ color: isHidden ? "var(--color-text-muted)" : undefined }}
        >
          smart_toy
        </span>
        <code className="rounded bg-sidebar px-1.5 py-0.5 font-mono text-xs text-text-muted">
          {fullModel}
        </code>
        <button
          onClick={() => onCopy(fullModel, `model-${model.id}`)}
          className="rounded p-0.5 text-text-muted hover:bg-sidebar hover:text-primary"
          title={t("copyModel")}
        >
          <span className="material-symbols-outlined text-sm">
            {copied === `model-${model.id}` ? "check" : "content_copy"}
          </span>
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onToggleHidden && (
          <button
            onClick={() => onToggleHidden(model.id, !isHidden)}
            disabled={togglingHidden}
            className="rounded p-0.5 text-text-muted hover:bg-sidebar hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed"
            title={
              isHidden
                ? providerText(t, "showModel", "Show model")
                : providerText(t, "hideModel", "Hide model")
            }
          >
            <span className="material-symbols-outlined text-sm">
              {isHidden ? "visibility_off" : "visibility"}
            </span>
          </button>
        )}
        <ModelCompatPopover
          t={t}
          effectiveModelNormalize={(p) => effectiveModelNormalize(model.id, p)}
          effectiveModelPreserveDeveloper={(p) => effectiveModelPreserveDeveloper(model.id, p)}
          getUpstreamHeadersRecord={getUpstreamHeadersRecord}
          onCompatPatch={(protocol, payload) =>
            saveModelCompatFlags(model.id, { compatByProtocol: { [protocol]: payload } })
          }
          showDeveloperToggle={showDeveloperToggle}
          disabled={compatDisabled}
        />
      </div>
    </div>
  );
}

ModelRow.propTypes = {
  model: PropTypes.shape({
    id: PropTypes.string.isRequired,
  }).isRequired,
  fullModel: PropTypes.string.isRequired,
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
  t: PropTypes.func,
  showDeveloperToggle: PropTypes.bool,
  effectiveModelNormalize: PropTypes.func.isRequired,
  effectiveModelPreserveDeveloper: PropTypes.func.isRequired,
  getUpstreamHeadersRecord: PropTypes.func.isRequired,
  saveModelCompatFlags: PropTypes.func.isRequired,
  compatDisabled: PropTypes.bool,
};

export function ModelVisibilityToolbar({
  t,
  filterValue,
  onFilterChange,
  activeCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  selectAllDisabled,
  deselectAllDisabled,
}: {
  t: ((key: string, values?: Record<string, unknown>) => string) & {
    has?: (key: string) => boolean;
  };
  filterValue: string;
  onFilterChange: (value: string) => void;
  activeCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  selectAllDisabled?: boolean;
  deselectAllDisabled?: boolean;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <span className="material-symbols-outlined pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[15px] text-text-muted">
          search
        </span>
        <input
          type="text"
          value={filterValue}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder={providerText(t, "filterModels", "Filter models...")}
          className="w-full rounded-lg border border-border bg-sidebar/50 py-1.5 pl-7 pr-3 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <button
        onClick={onSelectAll}
        disabled={selectAllDisabled}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-transparent px-2.5 py-1 text-[12px] text-text-main disabled:cursor-not-allowed disabled:opacity-50"
        title={providerText(t, "selectAllModels", "Select all")}
      >
        <span className="material-symbols-outlined text-[16px]">done_all</span>
        <span>{providerText(t, "selectAllModels", "Select all")}</span>
      </button>
      <button
        onClick={onDeselectAll}
        disabled={deselectAllDisabled}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-transparent px-2.5 py-1 text-[12px] text-text-main disabled:cursor-not-allowed disabled:opacity-50"
        title={providerText(t, "deselectAllModels", "Deselect all")}
      >
        <span className="material-symbols-outlined text-[16px]">remove_done</span>
        <span>{providerText(t, "deselectAllModels", "Deselect all")}</span>
      </button>
      <span className="whitespace-nowrap text-xs text-text-muted">
        {providerText(t, "modelsActiveCount", "{active}/{total} active", {
          active: activeCount,
          total: totalCount,
        })}
      </span>
    </div>
  );
}

export function PassthroughModelRow({
  modelId,
  fullModel,
  isHidden,
  copied,
  onCopy,
  onDeleteAlias,
  t,
  showDeveloperToggle = true,
  effectiveModelNormalize,
  effectiveModelPreserveDeveloper,
  getUpstreamHeadersRecord,
  saveModelCompatFlags,
  compatDisabled,
  onToggleHidden,
  togglingHidden,
}: any) {
  return (
    <div
      className={`flex gap-0 rounded-lg border border-border p-3 transition-opacity hover:bg-sidebar/50 ${
        isHidden ? "opacity-50" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className="material-symbols-outlined shrink-0 text-base text-text-muted"
          style={{ color: isHidden ? "var(--color-text-muted)" : undefined }}
        >
          smart_toy
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{modelId}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <code className="rounded bg-sidebar px-1.5 py-0.5 font-mono text-xs text-text-muted">
              {fullModel}
            </code>
            <button
              onClick={() => onCopy(fullModel, `model-${modelId}`)}
              className="rounded p-0.5 text-text-muted hover:bg-sidebar hover:text-primary"
              title={t("copyModel")}
            >
              <span className="material-symbols-outlined text-sm">
                {copied === `model-${modelId}` ? "check" : "content_copy"}
              </span>
            </button>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 self-start">
        {onToggleHidden && (
          <button
            onClick={() => onToggleHidden(modelId, !isHidden)}
            disabled={togglingHidden}
            className="rounded p-0.5 text-text-muted hover:bg-sidebar hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
            title={
              isHidden
                ? providerText(t, "showModel", "Show model")
                : providerText(t, "hideModel", "Hide model")
            }
          >
            <span className="material-symbols-outlined text-sm">
              {isHidden ? "visibility_off" : "visibility"}
            </span>
          </button>
        )}
        <ModelCompatPopover
          t={t}
          effectiveModelNormalize={(p) => effectiveModelNormalize(modelId, p)}
          effectiveModelPreserveDeveloper={(p) => effectiveModelPreserveDeveloper(modelId, p)}
          getUpstreamHeadersRecord={getUpstreamHeadersRecord}
          onCompatPatch={(protocol, payload) =>
            saveModelCompatFlags(modelId, { compatByProtocol: { [protocol]: payload } })
          }
          showDeveloperToggle={showDeveloperToggle}
          disabled={compatDisabled}
        />
        <button
          onClick={onDeleteAlias}
          className="rounded p-1 text-red-500 hover:bg-red-50"
          title={t("removeModel")}
        >
          <span className="material-symbols-outlined text-sm">delete</span>
        </button>
      </div>
    </div>
  );
}

PassthroughModelRow.propTypes = {
  modelId: PropTypes.string.isRequired,
  fullModel: PropTypes.string.isRequired,
  isHidden: PropTypes.bool,
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
  onDeleteAlias: PropTypes.func.isRequired,
  t: PropTypes.func,
  showDeveloperToggle: PropTypes.bool,
  effectiveModelNormalize: PropTypes.func.isRequired,
  effectiveModelPreserveDeveloper: PropTypes.func.isRequired,
  getUpstreamHeadersRecord: PropTypes.func.isRequired,
  saveModelCompatFlags: PropTypes.func.isRequired,
  compatDisabled: PropTypes.bool,
  onToggleHidden: PropTypes.func,
  togglingHidden: PropTypes.bool,
};
