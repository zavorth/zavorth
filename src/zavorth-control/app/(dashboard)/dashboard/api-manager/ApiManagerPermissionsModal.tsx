"use client";

import { memo, useCallback, useState } from "react";
import { Button, Input, Modal } from "@/shared/components";
import { useTranslations } from "next-intl";

import type {
  AccessSchedule,
  ApiKey,
  Model,
  ProviderConnection,
  ProviderGroup,
} from "./api-manager-client-helpers";

interface ApiManagerPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: ApiKey;
  modelsByProvider: ProviderGroup[];
  allModels: Model[];
  allConnections: ProviderConnection[];
  searchModel: string;
  onSearchChange: (value: string) => void;
  onSave: (
    models: string[],
    noLog: boolean,
    connections: string[],
    autoResolve: boolean,
    isActive: boolean,
    maxSessions: number,
    accessSchedule: AccessSchedule | null
  ) => void;
}

const SCHEDULE_DAY_OPTIONS: [number, string][] = [
  [0, "daySun"],
  [1, "dayMon"],
  [2, "dayTue"],
  [3, "dayWed"],
  [4, "dayThu"],
  [5, "dayFri"],
  [6, "daySat"],
];

function groupConnectionsByProvider(allConnections: ProviderConnection[]) {
  return Object.entries(
    allConnections.reduce<Record<string, ProviderConnection[]>>((acc, conn) => {
      const provider = conn.provider || "Other";
      if (!acc[provider]) acc[provider] = [];
      acc[provider].push(conn);
      return acc;
    }, {})
  ).sort(([a], [b]) => a.localeCompare(b));
}

export const ApiManagerPermissionsModal = memo(function ApiManagerPermissionsModal({
  isOpen,
  onClose,
  apiKey,
  modelsByProvider,
  allModels,
  allConnections,
  searchModel,
  onSearchChange,
  onSave,
}: ApiManagerPermissionsModalProps) {
  const t = useTranslations("apiManager");
  const tc = useTranslations("common");

  const initialModels = Array.isArray(apiKey?.allowedModels) ? apiKey.allowedModels : [];
  const initialConnections = Array.isArray(apiKey?.allowedConnections)
    ? apiKey.allowedConnections
    : [];
  const [selectedModels, setSelectedModels] = useState<string[]>(initialModels);
  const [allowAll, setAllowAll] = useState(initialModels.length === 0);
  const [noLogEnabled, setNoLogEnabled] = useState(apiKey?.noLog === true);
  const [autoResolveEnabled, setAutoResolveEnabled] = useState(apiKey?.autoResolve === true);
  const [keyIsActive, setKeyIsActive] = useState(apiKey?.isActive !== false);
  const [maxSessions, setMaxSessions] = useState(
    typeof apiKey?.maxSessions === "number" && apiKey.maxSessions > 0 ? apiKey.maxSessions : 0
  );
  const [scheduleEnabled, setScheduleEnabled] = useState(apiKey?.accessSchedule?.enabled === true);
  const [scheduleFrom, setScheduleFrom] = useState(apiKey?.accessSchedule?.from ?? "08:00");
  const [scheduleUntil, setScheduleUntil] = useState(apiKey?.accessSchedule?.until ?? "18:00");
  const [scheduleDays, setScheduleDays] = useState<number[]>(
    apiKey?.accessSchedule?.days ?? [1, 2, 3, 4, 5]
  );
  const [scheduleTz, setScheduleTz] = useState(
    apiKey?.accessSchedule?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [selectedConnections, setSelectedConnections] = useState<string[]>(initialConnections);
  const [allowAllConnections, setAllowAllConnections] = useState(initialConnections.length === 0);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(() => {
    if (initialModels.length > 0) {
      return new Set(modelsByProvider.map(([provider]) => provider));
    }
    return new Set();
  });

  const handleToggleModel = useCallback(
    (modelId: string) => {
      if (allowAll) return;

      setSelectedModels((prev) => {
        if (prev.includes(modelId)) {
          return prev.filter((model) => model !== modelId);
        }
        return [...prev, modelId];
      });
    },
    [allowAll]
  );

  const handleToggleProvider = useCallback(
    (provider: string, models: Model[]) => {
      if (allowAll) return;

      const modelIds = models.map((model) => model.id);
      setSelectedModels((prev) => {
        const allSelected = modelIds.every((id) => prev.includes(id));
        if (allSelected) {
          return prev.filter((modelId) => !modelIds.includes(modelId));
        }
        return [...new Set([...prev, ...modelIds])];
      });
    },
    [allowAll]
  );

  const handleSelectAll = useCallback(() => {
    setAllowAll(true);
    setSelectedModels([]);
  }, []);

  const handleRestrictMode = useCallback(() => {
    setAllowAll(false);
    setExpandedProviders(new Set(modelsByProvider.map(([provider]) => provider)));
  }, [modelsByProvider]);

  const handleToggleExpand = useCallback((provider: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  }, []);

  const handleSelectAllModels = useCallback(() => {
    setSelectedModels(allModels.map((model) => model.id));
  }, [allModels]);

  const handleDeselectAllModels = useCallback(() => {
    setSelectedModels([]);
  }, []);

  const handleToggleConnection = useCallback(
    (connectionId: string) => {
      if (allowAllConnections) return;

      setSelectedConnections((prev) =>
        prev.includes(connectionId)
          ? prev.filter((connection) => connection !== connectionId)
          : [...prev, connectionId]
      );
    },
    [allowAllConnections]
  );

  const handleSave = useCallback(() => {
    const schedule: AccessSchedule | null = scheduleEnabled
      ? {
          enabled: true,
          from: scheduleFrom,
          until: scheduleUntil,
          days: scheduleDays,
          tz: scheduleTz,
        }
      : null;

    onSave(
      allowAll ? [] : selectedModels,
      noLogEnabled,
      allowAllConnections ? [] : selectedConnections,
      autoResolveEnabled,
      keyIsActive,
      maxSessions,
      schedule
    );
  }, [
    allowAll,
    allowAllConnections,
    autoResolveEnabled,
    keyIsActive,
    maxSessions,
    noLogEnabled,
    onSave,
    scheduleDays,
    scheduleEnabled,
    scheduleFrom,
    scheduleTz,
    scheduleUntil,
    selectedConnections,
    selectedModels,
  ]);

  const selectedCount = selectedModels.length;
  const totalModels = allModels.length;
  const groupedConnections = groupConnectionsByProvider(allConnections);

  return (
    <Modal
      isOpen={onClose ? isOpen : false}
      title={t("permissionsTitle", { name: apiKey?.name || "" })}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 p-1 bg-surface rounded-lg">
          <button
            onClick={handleSelectAll}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
              allowAll
                ? "bg-primary text-white"
                : "text-text-muted hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">lock_open</span>
            {t("allowAll")}
          </button>
          <button
            onClick={handleRestrictMode}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
              !allowAll
                ? "bg-primary text-white"
                : "text-text-muted hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">lock</span>
            {t("restrict")}
          </button>
        </div>

        <div
          className={`flex items-start gap-2 p-3 rounded-lg ${
            allowAll
              ? "bg-green-500/10 border border-green-500/30"
              : "bg-amber-500/10 border border-amber-500/30"
          }`}
        >
          <span
            className={`material-symbols-outlined text-[18px] ${
              allowAll ? "text-green-500" : "text-amber-500"
            }`}
          >
            {allowAll ? "info" : "warning"}
          </span>
          <p
            className={`text-xs ${
              allowAll
                ? "text-green-700 dark:text-green-300"
                : "text-amber-700 dark:text-amber-300"
            }`}
          >
            {allowAll ? t("allowAllDesc") : t("restrictDesc", { selectedCount, totalModels })}
          </p>
        </div>

        <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-surface/40">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-text-main">{t("keyActive")}</p>
            <p className="text-xs text-text-muted">{t("keyActiveDesc")}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={keyIsActive}
            onClick={() => setKeyIsActive((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              keyIsActive
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                : "bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30"
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {keyIsActive ? "check_circle" : "block"}
            </span>
            {keyIsActive ? tc("enabled") : tc("disabled")}
          </button>
        </div>

        <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-surface/40">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-text-main">Max Active Sessions</p>
            <p className="text-xs text-text-muted">
              0 = unlimited. Return 429 when this key exceeds concurrent sticky sessions.
            </p>
          </div>
          <div className="w-32">
            <Input
              type="number"
              min={0}
              step={1}
              value={String(maxSessions)}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value || "0", 10);
                setMaxSessions(Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-surface/40">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-text-main">{t("accessSchedule")}</p>
              <p className="text-xs text-text-muted">{t("accessScheduleDesc")}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={scheduleEnabled}
              onClick={() => setScheduleEnabled((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors shrink-0 ${
                scheduleEnabled
                  ? "bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30"
                  : "bg-black/5 dark:bg-white/5 text-text-muted border border-border"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">schedule</span>
              {scheduleEnabled ? tc("enabled") : tc("disabled")}
            </button>
          </div>
          {scheduleEnabled && (
            <div className="flex flex-col gap-3 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-text-muted mb-1 block">{t("scheduleFrom")}</label>
                  <input
                    type="time"
                    value={scheduleFrom}
                    onChange={(e) => setScheduleFrom(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-background text-text-main"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">
                    {t("scheduleUntil")}
                  </label>
                  <input
                    type="time"
                    value={scheduleUntil}
                    onChange={(e) => setScheduleUntil(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-background text-text-main"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1.5 block">{t("scheduleDays")}</label>
                <div className="flex gap-1 flex-wrap">
                  {SCHEDULE_DAY_OPTIONS.map(([dayIdx, key]) => {
                    const selected = scheduleDays.includes(dayIdx);
                    return (
                      <button
                        key={dayIdx}
                        type="button"
                        onClick={() =>
                          setScheduleDays((prev) =>
                            prev.includes(dayIdx)
                              ? prev.filter((day) => day !== dayIdx)
                              : [...prev, dayIdx].sort((a, b) => a - b)
                          )
                        }
                        className={`px-2 py-1 text-[11px] font-medium rounded transition-all ${
                          selected
                            ? "bg-primary text-white"
                            : "bg-surface border border-border text-text-muted hover:border-primary/50"
                        }`}
                      >
                        {t(key)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">
                  {t("scheduleTimezone")}
                </label>
                <input
                  type="text"
                  value={scheduleTz}
                  onChange={(e) => setScheduleTz(e.target.value)}
                  placeholder="America/Sao_Paulo"
                  className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-background text-text-main font-mono"
                />
                <p className="text-[10px] text-text-muted mt-1">{t("scheduleTimezoneHint")}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-surface/40">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-text-main">No-Log Payload Privacy</p>
            <p className="text-xs text-text-muted">
              Disable request/response payload persistence for this API key.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={noLogEnabled}
            onClick={() => setNoLogEnabled((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              noLogEnabled
                ? "bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30"
                : "bg-black/5 dark:bg-white/5 text-text-muted border border-border"
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {noLogEnabled ? "visibility_off" : "visibility"}
            </span>
            {noLogEnabled ? tc("enabled") : tc("disabled")}
          </button>
        </div>

        <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-surface/40">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-text-main">{t("autoResolve")}</p>
            <p className="text-xs text-text-muted">{t("autoResolveDesc")}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoResolveEnabled}
            onClick={() => setAutoResolveEnabled((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              autoResolveEnabled
                ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30"
                : "bg-black/5 dark:bg-white/5 text-text-muted border border-border"
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {autoResolveEnabled ? "auto_fix_high" : "auto_fix_normal"}
            </span>
            {autoResolveEnabled ? tc("enabled") : tc("disabled")}
          </button>
        </div>

        {!allowAll && selectedCount > 0 && (
          <div className="flex flex-col gap-1.5 p-2 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-primary">
                {t("selectedCount", { count: selectedCount })}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={handleSelectAllModels}
                  className="text-[10px] text-primary hover:bg-primary/10 px-1.5 py-0.5 rounded transition-colors"
                >
                  {tc("all")}
                </button>
                <button
                  onClick={handleDeselectAllModels}
                  className="text-[10px] text-red-500 hover:bg-red-500/10 px-1.5 py-0.5 rounded transition-colors"
                >
                  {t("clear")}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto content-start">
              {selectedModels.map((modelId) => (
                <span
                  key={modelId}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-white dark:bg-surface text-text-main text-[10px] rounded border border-border"
                >
                  <span className="font-mono truncate max-w-[120px]" title={modelId}>
                    {modelId}
                  </span>
                  <button
                    onClick={() => handleToggleModel(modelId)}
                    className="text-text-muted hover:text-red-500 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[12px]">close</span>
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {!allowAll && (
          <>
            <div className="relative">
              <Input
                value={searchModel}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t("searchModels")}
                icon="search"
              />
              {searchModel && (
                <button
                  onClick={() => onSearchChange("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>

            <div className="max-h-[280px] overflow-y-auto border border-border rounded-lg divide-y divide-border">
              {modelsByProvider.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-text-muted">
                  <span className="material-symbols-outlined text-2xl mb-1">search_off</span>
                  <p className="text-xs">{t("noModelsFound")}</p>
                </div>
              ) : (
                modelsByProvider.map(([provider, models]) => {
                  const selectedInProvider = selectedModels.filter((modelId) =>
                    models.some((model) => model.id === modelId)
                  ).length;
                  const allSelected = models.every((model) => selectedModels.includes(model.id));
                  const someSelected = selectedInProvider > 0 && !allSelected;

                  return (
                    <div key={provider} className="group">
                      <button
                        onClick={() => handleToggleExpand(provider)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface/50 transition-colors text-left"
                      >
                        <span
                          className={`material-symbols-outlined text-base transition-transform duration-200 ${
                            expandedProviders.has(provider) ? "rotate-90" : ""
                          }`}
                        >
                          chevron_right
                        </span>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div
                            className="relative flex items-center cursor-pointer shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleProvider(provider, models);
                            }}
                          >
                            <div
                              className={`w-4 h-4 rounded border-2 transition-colors flex items-center justify-center ${
                                allSelected
                                  ? "bg-primary border-primary"
                                  : someSelected
                                    ? "bg-primary/20 border-primary"
                                    : "border-border hover:border-primary/50"
                              }`}
                            >
                              {allSelected && (
                                <span className="material-symbols-outlined text-white text-[12px]">
                                  check
                                </span>
                              )}
                              {someSelected && !allSelected && (
                                <span className="material-symbols-outlined text-primary text-[12px]">
                                  remove
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-text-main truncate">
                            {provider}
                          </span>
                          <span className="text-[10px] text-text-muted bg-surface px-1 py-0.5 rounded shrink-0">
                            {models.length}
                          </span>
                        </div>
                        {selectedInProvider > 0 && (
                          <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
                            {selectedInProvider}
                          </span>
                        )}
                      </button>

                      {expandedProviders.has(provider) && (
                        <div className="px-3 pb-2 pl-9">
                          <div className="flex flex-wrap gap-1">
                            {models.map((model) => {
                              const isSelected = selectedModels.includes(model.id);
                              return (
                                <button
                                  key={model.id}
                                  onClick={() => handleToggleModel(model.id)}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-mono transition-all ${
                                    isSelected
                                      ? "bg-primary text-white"
                                      : "bg-surface border border-border text-text-muted hover:border-primary/50 hover:text-text-main"
                                  }`}
                                  title={model.id}
                                >
                                  {model.id}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {allConnections.length > 0 && (
          <div className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-surface/40">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-text-main">Allowed Connections</p>
              <div className="flex gap-1 p-0.5 bg-surface rounded-md">
                <button
                  onClick={() => {
                    setAllowAllConnections(true);
                    setSelectedConnections([]);
                  }}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                    allowAllConnections
                      ? "bg-primary text-white"
                      : "text-text-muted hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setAllowAllConnections(false)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                    !allowAllConnections
                      ? "bg-primary text-white"
                      : "text-text-muted hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  Restrict
                </button>
              </div>
            </div>
            <p className="text-xs text-text-muted">
              {allowAllConnections
                ? "This key can use any active connection."
                : `Restricted to ${selectedConnections.length} connection${selectedConnections.length !== 1 ? "s" : ""}.`}
            </p>
            {!allowAllConnections && (
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                {groupedConnections.map(([provider, connections]) => (
                  <div key={provider}>
                    <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-1 py-0.5">
                      {provider}
                    </p>
                    {connections.map((connection) => {
                      const isSelected = selectedConnections.includes(connection.id);
                      return (
                        <button
                          key={connection.id}
                          onClick={() => handleToggleConnection(connection.id)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-all ${
                            isSelected
                              ? "bg-primary/10 text-primary"
                              : "text-text-muted hover:bg-surface/50 hover:text-text-main"
                          }`}
                        >
                          <div
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                              isSelected ? "bg-primary border-primary" : "border-border"
                            }`}
                          >
                            {isSelected && (
                              <span className="material-symbols-outlined text-white text-[10px]">
                                check
                              </span>
                            )}
                          </div>
                          <span className="truncate flex-1">
                            {connection.name || connection.id.slice(0, 8)}
                          </span>
                          {!connection.isActive && (
                            <span className="text-[9px] text-red-400 shrink-0">inactive</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSave} fullWidth>
            {t("savePermissions")}
          </Button>
          <Button onClick={onClose} variant="ghost" fullWidth>
            {tc("cancel")}
          </Button>
        </div>
      </div>
    </Modal>
  );
});
