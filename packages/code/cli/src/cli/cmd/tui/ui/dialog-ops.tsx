import { TextAttributes } from "@opentui/core"
import { For, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { useDialog } from "./dialog"
import { useLanguage } from "@tui/context/language"
import type { OpsSnapshot } from "../util/ops-bridge"

export type DialogOpsProps = {
  title: string
  snapshot: OpsSnapshot
  mode: "pulse" | "ready" | "doctor"
}

export function DialogOps(props: DialogOpsProps) {
  const dialog = useDialog()
  const { theme } = useTheme()
  const t = useLanguage().t

  const showChecks = () => props.mode === "doctor" || props.mode === "ready"

  return (
    <box paddingLeft={2} paddingRight={2} gap={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          {props.title}
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          {t("tui.dialog.close_hint")}
        </text>
      </box>

      <text attributes={TextAttributes.BOLD} fg={theme.text}>
        {props.snapshot.headline}
      </text>

      <Show when={showChecks()}>
        <box gap={0}>
          <For each={props.snapshot.checks}>
            {(check) => (
              <box flexDirection="row" gap={1}>
                <text flexShrink={0} fg={check.ok ? theme.success : theme.warning}>
                  {check.ok ? "●" : "△"}
                </text>
                <text fg={theme.text} wrapMode="word">
                  {check.label}
                  <Show when={check.detail}>
                    <span style={{ fg: theme.textMuted }}>{` · ${check.detail}`}</span>
                  </Show>
                </text>
              </box>
            )}
          </For>
        </box>
      </Show>

      <text fg={theme.textMuted}>
        {t("tui.pulse.next", { action: props.snapshot.nextAction })}
      </text>

      <Show when={props.snapshot.approvals > 0}>
        <text fg={theme.warning}>
          {t("tui.ops.approvals_pending", { count: props.snapshot.approvals })}
        </text>
      </Show>
    </box>
  )
}
