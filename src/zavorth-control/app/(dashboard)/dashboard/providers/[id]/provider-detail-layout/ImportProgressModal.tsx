"use client";

import { Modal } from "@/shared/components";
import type { ProviderDetailPageModel } from "../useProviderDetailPageModel";

type ImportProgressModalProps = Pick<
  ProviderDetailPageModel,
  "showImportModal" | "setShowImportModal" | "importProgress" | "t"
>;

function isSuccessImportLog(log: string) {
  return log.startsWith("âœ“") || log.startsWith(String.fromCharCode(10003));
}

export function ProviderDetailImportProgressModal({
  showImportModal,
  setShowImportModal,
  importProgress,
  t,
}: ImportProgressModalProps) {
  return (
    <Modal
      isOpen={showImportModal}
      onClose={() => {
        if (importProgress.phase === "done" || importProgress.phase === "error") {
          setShowImportModal(false);
        }
      }}
      title={t("importingModelsTitle")}
      size="md"
      closeOnOverlay={false}
      showCloseButton={importProgress.phase === "done" || importProgress.phase === "error"}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          {(importProgress.phase === "fetching" || importProgress.phase === "importing") && (
            <span className="material-symbols-outlined text-primary animate-spin">
              progress_activity
            </span>
          )}
          {importProgress.phase === "done" && (
            <span className="material-symbols-outlined text-green-500">check_circle</span>
          )}
          {importProgress.phase === "error" && (
            <span className="material-symbols-outlined text-red-500">error</span>
          )}
          <span className="text-sm font-medium text-text-main">{importProgress.status}</span>
        </div>

        {(importProgress.phase === "importing" || importProgress.phase === "done") &&
          importProgress.total > 0 && (
            <div className="w-full">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-text-muted">
                  {importProgress.current} / {importProgress.total}
                </span>
                <span className="text-xs text-text-muted">
                  {Math.round((importProgress.current / importProgress.total) * 100)}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300 ease-out"
                  style={{
                    width: `${(importProgress.current / importProgress.total) * 100}%`,
                    background:
                      importProgress.phase === "done"
                        ? "linear-gradient(90deg, #22c55e, #16a34a)"
                        : "linear-gradient(90deg, var(--color-primary), var(--color-primary-hover, var(--color-primary)))",
                  }}
                />
              </div>
            </div>
          )}

        {importProgress.phase === "fetching" && (
          <div className="w-full h-2.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full animate-pulse"
              style={{
                width: "60%",
                background:
                  "linear-gradient(90deg, var(--color-primary), var(--color-primary-hover, var(--color-primary)))",
              }}
            />
          </div>
        )}

        {importProgress.phase === "error" && importProgress.error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{importProgress.error}</p>
          </div>
        )}

        {importProgress.logs.length > 0 && (
          <div className="max-h-48 overflow-y-auto rounded-lg bg-black/5 dark:bg-white/5 p-3 border border-black/5 dark:border-white/5">
            <div className="flex flex-col gap-1">
              {importProgress.logs.map((log, index) => (
                <p
                  key={index}
                  className={`text-xs font-mono ${
                    isSuccessImportLog(log) ? "text-green-500 font-semibold" : "text-text-muted"
                  }`}
                >
                  {log}
                </p>
              ))}
            </div>
          </div>
        )}

        {importProgress.phase === "done" && (
          <div className="flex justify-center">
            <button
              onClick={() => setShowImportModal(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:opacity-90 transition-opacity"
            >
              {t("close") || "Close"}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
