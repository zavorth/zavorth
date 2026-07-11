import { createMemo } from "solid-js"
import { useLocal } from "@tui/context/local"
import { useTheme } from "@tui/context/theme"
import { useLanguage } from "@tui/context/language"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"

export function DialogAgent() {
  const local = useLocal()
  const dialog = useDialog()
  const { theme } = useTheme()
  const t = useLanguage().t

  const options = createMemo(() =>
    local.agent.list().map((item) => {
      const color = local.agent.color(item.name)
      return {
        value: item.name,
        title: item.name,
        description: item.native ? t("tui.agent.badge.native") : item.description,
        gutter: (
          <text fg={color ?? theme.primary} flexShrink={0}>
            ◆
          </text>
        ),
      }
    }),
  )

  return (
    <DialogSelect
      title={t("tui.agent.switch.title")}
      hint={t("tui.agent.switch.hint")}
      placeholder={t("tui.agent.switch.placeholder")}
      current={local.agent.current()?.name}
      options={options()}
      onSelect={(option) => {
        local.agent.set(option.value)
        dialog.clear()
      }}
    />
  )
}
