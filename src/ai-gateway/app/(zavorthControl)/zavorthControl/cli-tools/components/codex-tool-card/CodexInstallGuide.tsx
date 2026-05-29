import { Button } from "@/shared/components";

export function CodexInstallGuide({ codexStatus, showInstallGuide, setShowInstallGuide, t }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <span className="material-symbols-outlined text-yellow-500">warning</span>
        <div className="flex-1">
          <p className="font-medium text-yellow-600 dark:text-yellow-400">
            {codexStatus.installed
              ? t("cliNotRunnable", { tool: "Codex" })
              : t("cliNotInstalled", { tool: "Codex" })}
          </p>
          <p className="text-sm text-text-muted">
            {codexStatus.installed
              ? t("cliFoundFailedHealthcheck", {
                  tool: "Codex",
                  reason: codexStatus.reason ? ` (${codexStatus.reason})` : "",
                })
              : t("installCodexPrompt")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowInstallGuide(!showInstallGuide)}
        >
          <span className="material-symbols-outlined text-[18px] mr-1">
            {showInstallGuide ? "expand_less" : "help"}
          </span>
          {showInstallGuide ? t("hide") : t("howToInstall")}
        </Button>
      </div>
      {showInstallGuide && (
        <div className="p-4 bg-surface border border-border rounded-lg">
          <h4 className="font-medium mb-3">{t("installationGuide")}</h4>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-text-muted mb-1">{t("platforms")}</p>
              <code className="block px-3 py-2 bg-black/5 dark:bg-white/5 rounded font-mono text-xs">
                npm install -g @openai/codex
              </code>
            </div>
            <p className="text-text-muted">
              {t("afterInstallationRun")}{" "}
              <code className="px-1 bg-black/5 dark:bg-white/5 rounded">codex</code>{" "}
              {t("toVerify")}
            </p>
            <div className="pt-2 border-t border-border">
              <p className="text-text-muted text-xs">
                {t("codexAuthNotePrefix")}{" "}
                <code className="px-1 bg-black/5 dark:bg-white/5 rounded">
                  ~/.codex/auth.json
                </code>{" "}
                {t("codexAuthNoteMiddle")}{" "}
                <code className="px-1 bg-black/5 dark:bg-white/5 rounded">
                  OPENAI_API_KEY
                </code>
                . {t("codexAuthNoteSuffix")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
