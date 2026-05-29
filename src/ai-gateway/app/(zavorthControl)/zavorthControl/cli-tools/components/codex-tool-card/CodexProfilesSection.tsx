import { Button } from "@/shared/components";

export function CodexProfilesSection({
  activatingProfile,
  handleActivateProfile,
  handleDeleteProfile,
  handleSaveProfile,
  newProfileName,
  profiles,
  savingProfile,
  setNewProfileName,
  t,
}) {
  return (
    <div className="mt-2 p-3 bg-surface border border-border rounded-lg">
      <h4 className="text-xs font-semibold text-text-main mb-2 flex items-center gap-1">
        <span className="material-symbols-outlined text-[14px]">manage_accounts</span>
        {t("savedProfiles")}
      </h4>
      {profiles.length === 0 ? (
        <p className="text-xs text-text-muted">{t("noProfilesYet")}</p>
      ) : (
        <div className="space-y-1.5 mb-3">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 px-2 py-1.5 bg-black/5 dark:bg-white/5 rounded text-xs"
            >
              <span className="material-symbols-outlined text-[14px] text-text-muted">
                person
              </span>
              <span className="font-medium flex-1 truncate">{p.name}</span>
              <span className="text-text-muted truncate max-w-[140px]" title={p.authLabel}>
                {p.authLabel}
              </span>
              <button
                onClick={() => handleActivateProfile(p.id)}
                disabled={activatingProfile === p.id}
                className="px-2 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                {activatingProfile === p.id ? "..." : t("activate")}
              </button>
              <button
                onClick={() => handleDeleteProfile(p.id)}
                className="p-0.5 text-text-muted hover:text-red-500 transition-colors"
                title={t("deleteProfile")}
              >
                <span className="material-symbols-outlined text-[14px]">delete</span>
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newProfileName}
          onChange={(e) => setNewProfileName(e.target.value)}
          placeholder={t("profileNamePlaceholder")}
          className="flex-1 px-2 py-1.5 bg-surface rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
          onKeyDown={(e) => e.key === "Enter" && handleSaveProfile()}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={handleSaveProfile}
          disabled={!newProfileName.trim()}
          loading={savingProfile}
        >
          <span className="material-symbols-outlined text-[14px] mr-1">save</span>
          {t("saveCurrent")}
        </Button>
      </div>
    </div>
  );
}
