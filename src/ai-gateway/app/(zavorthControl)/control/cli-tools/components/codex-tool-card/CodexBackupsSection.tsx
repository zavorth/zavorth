export function CodexBackupsSection({ backups, handleRestoreBackup, restoringBackup, t }) {
  return (
    <div className="mt-2 p-3 bg-surface border border-border rounded-lg">
      <h4 className="text-xs font-semibold text-text-main mb-2 flex items-center gap-1">
        <span className="material-symbols-outlined text-[14px]">history</span>
        {t("configBackups")}
      </h4>
      {backups.length === 0 ? (
        <p className="text-xs text-text-muted">{t("noBackupsYet")}</p>
      ) : (
        <div className="space-y-1.5">
          {backups.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-2 px-2 py-1.5 bg-black/5 dark:bg-white/5 rounded text-xs"
            >
              <span className="material-symbols-outlined text-[14px] text-text-muted">
                description
              </span>
              <span className="flex-1 truncate font-mono" title={b.id}>
                {b.id}
              </span>
              <span className="text-text-muted whitespace-nowrap">
                {new Date(b.createdAt).toLocaleString()}
              </span>
              <button
                onClick={() => handleRestoreBackup(b.id)}
                disabled={restoringBackup === b.id}
                className="px-2 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                {restoringBackup === b.id ? "..." : t("restore")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
