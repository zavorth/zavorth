import { Button } from "@/shared/components";
import { CodexBackupsSection } from "./CodexBackupsSection";
import { CodexProfilesSection } from "./CodexProfilesSection";

export function CodexConfigPanel({
  activeProviders,
  apiKeys,
  applying,
  backups,
  baseUrl,
  cloudEnabled,
  codexStatus,
  customBaseUrl,
  fetchBackups,
  fetchProfiles,
  getDisplayUrl,
  handleActivateProfile,
  handleApplySettings,
  handleDeleteProfile,
  handleResetSettings,
  handleRestoreBackup,
  handleSaveProfile,
  message,
  newProfileName,
  profiles,
  restoring,
  restoringBackup,
  savingProfile,
  selectedApiKey,
  selectedModel,
  setCustomBaseUrl,
  setModalOpen,
  setNewProfileName,
  setSelectedApiKey,
  setSelectedModel,
  setShowBackups,
  setShowManualConfigModal,
  setShowProfiles,
  showBackups,
  showProfiles,
  t,
  activatingProfile,
}) {
  return (
    <>
      <div className="flex flex-col gap-2">
        {codexStatus?.config &&
          (() => {
            const parsed = codexStatus.config.match(/base_url\s*=\s*"([^"]+)"/);
            const currentBaseUrl = parsed ? parsed[1] : null;
            return currentBaseUrl ? (
              <div className="flex items-center gap-2">
                <span className="w-32 shrink-0 text-sm font-semibold text-text-main text-right">
                  {t("current")}
                </span>
                <span className="material-symbols-outlined text-text-muted text-[14px]">
                  arrow_forward
                </span>
                <span className="flex-1 px-2 py-1.5 text-xs text-text-muted truncate">
                  {currentBaseUrl}
                </span>
              </div>
            ) : null;
          })()}

        <div className="flex items-center gap-2">
          <span className="w-32 shrink-0 text-sm font-semibold text-text-main text-right">
            {t("baseUrl")}
          </span>
          <span className="material-symbols-outlined text-text-muted text-[14px]">
            arrow_forward
          </span>
          <input
            type="text"
            value={getDisplayUrl()}
            onChange={(e) => setCustomBaseUrl(e.target.value)}
            placeholder={t("baseUrlPlaceholder")}
            className="flex-1 px-2 py-1.5 bg-surface rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          {customBaseUrl && customBaseUrl !== `${baseUrl}/v1` && (
            <button
              onClick={() => setCustomBaseUrl("")}
              className="p-1 text-text-muted hover:text-primary rounded transition-colors"
              title={t("resetToDefault")}
            >
              <span className="material-symbols-outlined text-[14px]">restart_alt</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="w-32 shrink-0 text-sm font-semibold text-text-main text-right">
            {t("apiKey")}
          </span>
          <span className="material-symbols-outlined text-text-muted text-[14px]">
            arrow_forward
          </span>
          {apiKeys.length > 0 ? (
            <select
              value={selectedApiKey}
              onChange={(e) => setSelectedApiKey(e.target.value)}
              className="flex-1 px-2 py-1.5 bg-surface rounded text-xs border border-border focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              {apiKeys.map((key) => (
                <option key={key.id} value={key.key}>
                  {key.key}
                </option>
              ))}
            </select>
          ) : (
            <span className="flex-1 text-xs text-text-muted px-2 py-1.5">
              {cloudEnabled ? t("noApiKeysCreateOne") : t("defaultZavorthGatewayKey")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="w-32 shrink-0 text-sm font-semibold text-text-main text-right">
            {t("model")}
          </span>
          <span className="material-symbols-outlined text-text-muted text-[14px]">
            arrow_forward
          </span>
          <input
            type="text"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            placeholder={t("providerModelPlaceholder")}
            className="flex-1 px-2 py-1.5 bg-surface rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <button
            onClick={() => setModalOpen(true)}
            disabled={!activeProviders?.length}
            className={`px-2 py-1.5 rounded border text-xs transition-colors shrink-0 whitespace-nowrap ${activeProviders?.length ? "bg-surface border-border text-text-main hover:border-primary cursor-pointer" : "opacity-50 cursor-not-allowed border-border"}`}
          >
            {t("selectModel")}
          </button>
          {selectedModel && (
            <button
              onClick={() => setSelectedModel("")}
              className="p-1 text-text-muted hover:text-red-500 rounded transition-colors"
              title={t("clear")}
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}
        >
          <span className="material-symbols-outlined text-[14px]">
            {message.type === "success" ? "check_circle" : "error"}
          </span>
          <span>{message.text}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={handleApplySettings}
          disabled={!selectedApiKey || !selectedModel}
          loading={applying}
        >
          <span className="material-symbols-outlined text-[14px] mr-1">save</span>
          {t("apply")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleResetSettings}
          disabled={!codexStatus.hasZavorthGateway}
          loading={restoring}
        >
          <span className="material-symbols-outlined text-[14px] mr-1">restore</span>
          {t("reset")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowManualConfigModal(true)}>
          <span className="material-symbols-outlined text-[14px] mr-1">content_copy</span>
          {t("manualConfig")}
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setShowProfiles(!showProfiles);
            if (!showProfiles) fetchProfiles();
          }}
        >
          <span className="material-symbols-outlined text-[14px] mr-1">manage_accounts</span>
          {t("profiles")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setShowBackups(!showBackups);
            if (!showBackups) fetchBackups();
          }}
        >
          <span className="material-symbols-outlined text-[14px] mr-1">history</span>
          {t("backups")}
          {backups.length > 0 && ` (${backups.length})`}
        </Button>
      </div>

      {showProfiles && (
        <CodexProfilesSection
          activatingProfile={activatingProfile}
          handleActivateProfile={handleActivateProfile}
          handleDeleteProfile={handleDeleteProfile}
          handleSaveProfile={handleSaveProfile}
          newProfileName={newProfileName}
          profiles={profiles}
          savingProfile={savingProfile}
          setNewProfileName={setNewProfileName}
          t={t}
        />
      )}

      {showBackups && (
        <CodexBackupsSection
          backups={backups}
          handleRestoreBackup={handleRestoreBackup}
          restoringBackup={restoringBackup}
          t={t}
        />
      )}
    </>
  );
}
