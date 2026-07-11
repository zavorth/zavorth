import { TextAttributes } from "@opentui/core"
import { createMemo, Show } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useDialog } from "./dialog"
import { useKeyboard } from "@opentui/solid"
import { useKeybind } from "@tui/context/keybind"
import { useLanguage } from "@tui/context/language"

/**
 * Quick help — Zavorth chrome (◆ header, soft sections).
 * Opened by empty-prompt `?` or /help.
 */
export function DialogHelp() {
  const dialog = useDialog()
  const { theme } = useTheme()
  const keybind = useKeybind()
  const t = useLanguage().t

  // Only surface when user has bound a key (default is none)
  const lastUserKey = createMemo(() => keybind.print("messages_last_user"))

  useKeyboard((evt) => {
    if (evt.name === "return" || evt.name === "escape") {
      dialog.clear()
    }
  })

  return (
    <box paddingLeft={2} paddingRight={2} gap={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between" alignItems="center">
        <text>
          <span style={{ fg: theme.primary, bold: true }}>◆ </span>
          <span style={{ fg: theme.text, bold: true }}>{t("tui.dialog.help.title")}</span>
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          {t("tui.dialog.help.close_hint")}
        </text>
      </box>
      <text fg={theme.borderSubtle}>{"─".repeat(36)}</text>

      <box flexDirection="column" gap={0}>
        <text fg={theme.primary} attributes={TextAttributes.BOLD}>
          · {t("tui.dialog.help.section.navigation")}
        </text>
        <text fg={theme.textMuted}>
          {keybind.print("command_list")} · {t("tui.dialog.help.row.commands")}
        </text>
        <text fg={theme.textMuted}>? · {t("tui.dialog.help.row.this_help")}</text>
        <text fg={theme.textMuted}>esc · {t("tui.dialog.help.row.close")}</text>
        <Show when={lastUserKey()}>
          <text fg={theme.textMuted}>
            {lastUserKey()} · {t("tui.dialog.help.row.last_user")}
          </text>
        </Show>
      </box>

      <box flexDirection="column" gap={0}>
        <text fg={theme.primary} attributes={TextAttributes.BOLD}>
          · {t("tui.dialog.help.section.prompt")}
        </text>
        <text fg={theme.textMuted}>@ · {t("tui.dialog.help.row.files")}</text>
        <text fg={theme.textMuted}>$ · {t("tui.dialog.help.row.agents")}</text>
        <text fg={theme.textMuted}>/ · {t("tui.dialog.help.row.slash")}</text>
      </box>

      <box flexDirection="column" gap={0}>
        <text fg={theme.primary} attributes={TextAttributes.BOLD}>
          · {t("tui.dialog.help.section.session")}
        </text>
        <text fg={theme.textMuted}>{t("tui.dialog.help.row.interrupt")}</text>
        <text fg={theme.textMuted}>{t("tui.dialog.help.row.approval")}</text>
        <text fg={theme.textMuted}>/goal · {t("tui.dialog.help.row.goal")}</text>
        <text fg={theme.textMuted}>{t("tui.dialog.help.row.queue")}</text>
      </box>

      <box flexDirection="column" gap={0}>
        <text fg={theme.primary} attributes={TextAttributes.BOLD}>
          · {t("tui.dialog.help.section.skins")}
        </text>
        <text fg={theme.textMuted}>{t("tui.dialog.help.row.themes")}</text>
        <text fg={theme.textMuted}>{t("tui.dialog.help.row.fun")}</text>
      </box>

      <text fg={theme.textMuted}>
        {t("tui.dialog.help.footer", { keybind: keybind.print("command_list") })}
      </text>
    </box>
  )
}
