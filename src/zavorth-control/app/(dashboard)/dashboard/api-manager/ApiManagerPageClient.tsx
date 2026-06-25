"use client";

import { Card, Button, Input, Modal, CardSkeleton } from "@/shared/components";
import { ApiManagerPermissionsModal } from "./ApiManagerPermissionsModal";
import { useApiManagerPage } from "./api-manager-page/useApiManagerPage";

export default function ApiManagerPageClient() {
  const {
    allConnections,
    allModels,
    allowKeyReveal,
    clearError,
    copied,
    copy,
    createdKey,
    editingKey,
    error,
    filteredModelsByProvider,
    handleCopyExistingKey,
    handleCreateKey,
    handleDeleteKey,
    handleOpenPermissions,
    handleUpdatePermissions,
    keys,
    loading,
    newKeyName,
    searchModel,
    sessionCounts,
    setCreatedKey,
    setEditingKey,
    setNewKeyName,
    setSearchModel,
    setShowAddModal,
    setShowPermissionsModal,
    showAddModal,
    showPermissionsModal,
    t,
    tc,
    usageStats,
  } = useApiManagerPage();

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <span className="material-symbols-outlined text-red-500">error</span>
          <p className="text-sm text-red-700 dark:text-red-300 flex-1">{error}</p>
          <button
            onClick={clearError}
            className="text-red-500 hover:text-red-700 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}

      {keys.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10">
                <span className="material-symbols-outlined text-primary text-lg">vpn_key</span>
              </div>
              <div>
                <p className="text-2xl font-bold">{keys.length}</p>
                <p className="text-xs text-text-muted">{t("totalKeys")}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-9 rounded-lg bg-amber-500/10">
                <span className="material-symbols-outlined text-amber-500 text-lg">lock</span>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {
                    keys.filter((k) => Array.isArray(k.allowedModels) && k.allowedModels.length > 0)
                      .length
                  }
                </p>
                <p className="text-xs text-text-muted">{t("restricted")}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-9 rounded-lg bg-blue-500/10">
                <span className="material-symbols-outlined text-blue-500 text-lg">bar_chart</span>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {Object.values(usageStats).reduce((sum, s) => sum + s.totalRequests, 0)}
                </p>
                <p className="text-xs text-text-muted">{t("totalRequests")}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-9 rounded-lg bg-emerald-500/10">
                <span className="material-symbols-outlined text-emerald-500 text-lg">
                  model_training
                </span>
              </div>
              <div>
                <p className="text-2xl font-bold">{allModels.length}</p>
                <p className="text-xs text-text-muted">{t("modelsAvailable")}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">{t("keyManagement")}</h2>
            <p className="text-sm text-text-muted">{t("keyManagementDesc")}</p>
          </div>
          <Button icon="add" onClick={() => setShowAddModal(true)}>
            {t("createKey")}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-amber-500/10 shrink-0">
              <span className="material-symbols-outlined text-xl text-amber-500">vpn_key</span>
            </div>
            <div>
              <h3 className="font-semibold">{t("registeredKeys")}</h3>
              <p className="text-xs text-text-muted">
                {keys.length}{" "}
                {keys.length === 1
                  ? t("keyRegistered", { count: keys.length })
                  : t("keysRegistered", { count: keys.length })}
              </p>
            </div>
          </div>
        </div>

        <p className="text-sm text-text-muted mb-4">{t("keysSecurityNote")}</p>

        {keys.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-lg">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
              <span className="material-symbols-outlined text-[32px]">vpn_key</span>
            </div>
            <p className="text-text-main font-medium mb-2">{t("noKeys")}</p>
            <p className="text-sm text-text-muted mb-4">{t("noKeysDesc")}</p>
            <Button icon="add" onClick={() => setShowAddModal(true)}>
              {t("createFirstKey")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-surface/50 border-b border-border text-xs font-semibold text-text-muted uppercase tracking-wider">
              <div className="col-span-2">{t("name")}</div>
              <div className="col-span-3">{t("key")}</div>
              <div className="col-span-2">{t("permissions")}</div>
              <div className="col-span-2">{t("usage")}</div>
              <div className="col-span-1">{t("created")}</div>
              <div className="col-span-2 text-right">{t("actions")}</div>
            </div>

            {keys.map((key) => {
              const stats = usageStats[key.id];
              const isRestricted = Array.isArray(key.allowedModels) && key.allowedModels.length > 0;
              const hasConnectionRestrictions =
                Array.isArray(key.allowedConnections) && key.allowedConnections.length > 0;
              const noLogEnabled = key.noLog === true;
              const keyIsActive = key.isActive !== false;
              const maxSessions = typeof key.maxSessions === "number" ? key.maxSessions : 0;
              const hasSessionLimit = maxSessions > 0;
              const activeSessions = sessionCounts[key.id] || 0;
              const hasSchedule = key.accessSchedule?.enabled === true;
              return (
                <div
                  key={key.id}
                  className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-black/[0.03] dark:border-white/[0.03] last:border-b-0 hover:bg-surface/30 transition-colors group"
                >
                  <div className="col-span-2 flex items-center gap-2">
                    <span
                      className={`material-symbols-outlined text-sm ${isRestricted ? "text-amber-500" : "text-emerald-500"}`}
                    >
                      {isRestricted ? "lock" : "lock_open"}
                    </span>
                    <span className="text-sm font-medium truncate" title={key.name}>
                      {key.name}
                    </span>
                  </div>
                  <div className="col-span-3 flex items-center gap-1.5">
                    <code className="text-sm text-text-muted font-mono truncate">{key.key}</code>
                    {allowKeyReveal ? (
                      <button
                        onClick={() => handleCopyExistingKey(key.id)}
                        className="p-1 text-text-muted/60 hover:text-primary transition-colors shrink-0"
                        title={tc("copy")}
                        aria-label={tc("copy")}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {copied === `existing_key_${key.id}` ? "check" : "content_copy"}
                        </span>
                      </button>
                    ) : (
                      <span
                        className="p-1 text-text-muted/40 opacity-0 group-hover:opacity-100 transition-all shrink-0 cursor-help"
                        title={t("keyOnlyAvailableAtCreation")}
                      >
                        <span className="material-symbols-outlined text-[14px]">lock</span>
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 flex items-center">
                    <div className="flex flex-col items-start gap-1">
                      {isRestricted ? (
                        <button
                          onClick={() => handleOpenPermissions(key)}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">lock</span>
                          {t("modelsCount", { count: key.allowedModels.length })}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenPermissions(key)}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-medium hover:bg-green-500/20 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">lock_open</span>
                          {t("allModels")}
                        </button>
                      )}
                      {hasConnectionRestrictions && (
                        <button
                          onClick={() => handleOpenPermissions(key)}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">cable</span>
                          {key.allowedConnections.length} conn
                        </button>
                      )}
                      {noLogEnabled && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[11px] font-medium">
                          <span className="material-symbols-outlined text-[12px]">
                            visibility_off
                          </span>
                          No-Log
                        </span>
                      )}
                      {key.autoResolve && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[11px] font-medium">
                          <span className="material-symbols-outlined text-[12px]">
                            auto_fix_high
                          </span>
                          Auto-Resolve
                        </span>
                      )}
                      {hasSessionLimit && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-medium">
                          <span className="material-symbols-outlined text-[12px]">group</span>
                          Sessions: {activeSessions}/{maxSessions}
                        </span>
                      )}
                      {!keyIsActive && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 text-[11px] font-medium">
                          <span className="material-symbols-outlined text-[12px]">block</span>
                          {t("disabled")}
                        </span>
                      )}
                      {hasSchedule && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[11px] font-medium">
                          <span className="material-symbols-outlined text-[12px]">schedule</span>
                          {t("scheduleActive")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2 flex flex-col justify-center">
                    <span className="text-sm font-medium tabular-nums">
                      {stats?.totalRequests ?? 0}{" "}
                      <span className="text-text-muted font-normal text-xs">{t("reqs")}</span>
                    </span>
                    {stats?.lastUsed ? (
                      <span className="text-[10px] text-text-muted">
                        {t("lastUsedOn", { date: new Date(stats.lastUsed).toLocaleDateString() })}
                      </span>
                    ) : (
                      <span className="text-[10px] text-text-muted italic">{t("neverUsed")}</span>
                    )}
                  </div>
                  <div className="col-span-1 flex items-center text-sm text-text-muted">
                    {new Date(key.createdAt).toLocaleDateString()}
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleOpenPermissions(key)}
                      className="p-2 hover:bg-primary/10 rounded text-text-muted hover:text-primary opacity-0 group-hover:opacity-100 transition-all"
                      title={t("editPermissions")}
                    >
                      <span className="material-symbols-outlined text-[18px]">tune</span>
                    </button>
                    <button
                      onClick={() => handleDeleteKey(key.id)}
                      className="p-2 hover:bg-red-500/10 rounded text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      title={t("deleteKey")}
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center size-10 rounded-lg bg-blue-500/10 shrink-0">
            <span className="material-symbols-outlined text-xl text-blue-500">lightbulb</span>
          </div>
          <div>
            <h3 className="font-semibold mb-2">{t("usageTips")}</h3>
            <ul className="text-sm text-text-muted space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-xs text-primary mt-1">check</span>
                <span>{t("tipAuth")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-xs text-primary mt-1">check</span>
                <span>{t("tipSecure")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-xs text-primary mt-1">check</span>
                <span>{t("tipSeparate")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-xs text-primary mt-1">check</span>
                <span>{t("tipRestrict")}</span>
              </li>
            </ul>
          </div>
        </div>
      </Card>

      <Modal
        isOpen={showAddModal}
        title={t("createKey")}
        onClose={() => {
          setShowAddModal(false);
          setNewKeyName("");
        }}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-text-main mb-1.5 block">
              {t("keyName")}
            </label>
            <Input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder={t("keyNamePlaceholder")}
              autoFocus
            />
            <p className="text-xs text-text-muted mt-1.5">{t("keyNameDesc")}</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setShowAddModal(false);
                setNewKeyName("");
              }}
              variant="ghost"
              fullWidth
            >
              {tc("cancel")}
            </Button>
            <Button onClick={handleCreateKey} fullWidth disabled={!newKeyName.trim()}>
              {t("createKey")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!createdKey} title={t("keyCreated")} onClose={() => setCreatedKey(null)}>
        <div className="flex flex-col gap-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-green-600 dark:text-green-400">
                check_circle
              </span>
              <div>
                <p className="text-sm text-green-800 dark:text-green-200 font-medium mb-1">
                  {t("keyCreatedSuccess")}
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">{t("keyCreatedNote")}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Input value={createdKey || ""} readOnly className="flex-1 font-mono text-sm" />
            <Button
              variant="secondary"
              icon={copied === "created_key" ? "check" : "content_copy"}
              onClick={() => copy(createdKey, "created_key")}
            >
              {copied === "created_key" ? tc("copied") : tc("copy")}
            </Button>
          </div>
          <Button onClick={() => setCreatedKey(null)} fullWidth>
            {t("done")}
          </Button>
        </div>
      </Modal>

      {editingKey && (
        <ApiManagerPermissionsModal
          key={editingKey.id}
          isOpen={showPermissionsModal}
          onClose={() => {
            setShowPermissionsModal(false);
            setEditingKey(null);
          }}
          apiKey={editingKey}
          modelsByProvider={filteredModelsByProvider}
          allModels={allModels}
          allConnections={allConnections}
          searchModel={searchModel}
          onSearchChange={setSearchModel}
          onSave={handleUpdatePermissions}
        />
      )}
    </div>
  );
}
