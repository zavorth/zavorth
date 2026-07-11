import { TextAttributes } from "@opentui/core"
import { createStore } from "solid-js/store"
import { useKeyboard } from "@opentui/solid"
import { useTheme } from "@tui/context/theme"
import { useLanguage } from "@tui/context/language"
import { useDialog, type DialogContext } from "@tui/ui/dialog"

export const FREE_AGREEMENT_KEY = "free_agreement_accepted"

// Model IDs that count as "free" and require the one-time local notice.
export const FREE_MODEL_IDS = new Set(["zavorth-auto", "zavorth-free"])

/**
 * Local-first workspace notice (not cloud Terms of Service).
 * No external links — Zavorth is a local agent.
 */
export function DialogAgreement(props: { onConfirm?: () => void; onCancel?: () => void }) {
  const dialog = useDialog()
  const { theme } = useTheme()
  const t = useLanguage().t
  const [store, setStore] = createStore({
    active: "confirm" as "confirm" | "cancel",
  })

  const confirm = () => {
    dialog.clear()
    props.onConfirm?.()
  }
  const cancel = () => {
    dialog.clear()
    props.onCancel?.()
  }

  useKeyboard((evt) => {
    if (evt.name === "return") {
      if (store.active === "confirm") confirm()
      else cancel()
      return
    }
    if (evt.name === "left" || evt.name === "right") {
      setStore("active", store.active === "confirm" ? "cancel" : "confirm")
    }
  })

  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.primary}>
          ◇ {t("tui.dialog.agreement.title")}
        </text>
        <text fg={theme.textMuted} onMouseUp={() => cancel()}>
          {t("tui.dialog.close_hint")}
        </text>
      </box>

      <box
        borderStyle="rounded"
        borderColor={theme.primary}
        backgroundColor={theme.backgroundPanel}
        paddingLeft={1}
        paddingRight={1}
        paddingTop={0}
        paddingBottom={0}
        gap={0}
      >
        <text fg={theme.text}>{t("tui.home.agreement.prefix")}</text>
        <text fg={theme.textMuted}>{t("tui.dialog.agreement.body")}</text>
        <text fg={theme.textMuted}>{t("tui.dialog.agreement.message")}</text>
      </box>

      <box flexDirection="row" justifyContent="flex-end" paddingBottom={1} gap={1}>
        <box
          borderStyle="rounded"
          borderColor={store.active === "cancel" ? theme.borderActive : theme.borderSubtle}
          paddingLeft={1}
          paddingRight={1}
          backgroundColor={store.active === "cancel" ? theme.backgroundElement : undefined}
          onMouseUp={() => cancel()}
        >
          <text fg={store.active === "cancel" ? theme.text : theme.textMuted}>
            {t("tui.dialog.confirm.cancel")}
          </text>
        </box>
        <box
          borderStyle="rounded"
          borderColor={store.active === "confirm" ? theme.primary : theme.borderSubtle}
          paddingLeft={1}
          paddingRight={1}
          backgroundColor={store.active === "confirm" ? theme.primary : undefined}
          onMouseUp={() => confirm()}
        >
          <text fg={store.active === "confirm" ? theme.background : theme.textMuted}>
            {t("tui.dialog.agreement.confirm")}
          </text>
        </box>
      </box>
    </box>
  )
}

DialogAgreement.show = (
  dialog: DialogContext,
  options: { onConfirm: () => void; onClose?: () => void },
) => {
  dialog.replace(() => <DialogAgreement onConfirm={options.onConfirm} />, options.onClose)
}
