import { createMemo } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useLanguage } from "@tui/context/language"
import { useLocal } from "@tui/context/local"
import { useSync } from "@tui/context/sync"
import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select"
import type { DialogContext } from "@tui/ui/dialog"
import { DialogZavorthLogin } from "@tui/component/dialog-zavorth-login"
import { DialogModel } from "@tui/component/dialog-model"
import { DialogMcp } from "@tui/component/dialog-mcp"
import { buildRepairChecklist, mcpHasFailure, type RepairStep } from "../util/repair-hints"

function runRepairAction(step: RepairStep, dialog: DialogContext) {
  if (step.action === "none") return
  if (step.action === "connect") {
    dialog.replace(() => <DialogZavorthLogin />)
    return
  }
  if (step.action === "model") {
    dialog.replace(() => <DialogModel />)
    return
  }
  if (step.action === "mcp") {
    dialog.replace(() => <DialogMcp />)
    return
  }
  dialog.clear()
}

/** Guided repair — status rows + jump-to-fix actions (not a passive alert). */
export function DialogRepair() {
  const sync = useSync()
  const local = useLocal()
  const t = useLanguage().t
  const { theme } = useTheme()

  const steps = createMemo(() =>
    buildRepairChecklist({
      providerReady: (sync.data.provider ?? []).length > 0,
      hasModel: !!local.model.current(),
      mcpFailed: mcpHasFailure(sync.data.mcp ?? {}),
      copy: {
        noProvider: t("tui.repair.hint.no_provider"),
        noModel: t("tui.repair.hint.no_model"),
        trust: t("tui.repair.hint.trust"),
        mcpFailed: t("tui.repair.hint.mcp_failed"),
        allClear: t("tui.repair.hint.all_clear"),
        footer: t("tui.repair.hint.footer"),
        providerOk: t("tui.repair.status.provider_ok"),
        modelOk: t("tui.repair.status.model_ok"),
        mcpOk: t("tui.repair.status.mcp_ok"),
        actionConnect: t("tui.repair.action.connect"),
        actionModel: t("tui.repair.action.model"),
        actionMcp: t("tui.repair.action.mcp"),
        actionDismiss: t("tui.repair.action.dismiss"),
        statusOk: t("tui.repair.status.ok"),
        statusNeedsFix: t("tui.repair.status.needs_fix"),
      },
    }),
  )

  const options = createMemo((): DialogSelectOption<string>[] =>
    steps().map((step) => ({
      value: step.id,
      title: step.label,
      description:
        step.description ?? (step.ok ? t("tui.repair.status.ok") : t("tui.repair.status.needs_fix")),
      keywords: [step.action, step.id],
      gutter: (
        <text flexShrink={0} fg={step.ok ? theme.success : theme.warning}>
          {step.ok ? "●" : "△"}
        </text>
      ),
      onSelect: (ctx) => runRepairAction(step, ctx),
    })),
  )

  const current = createMemo(() => steps().find((s) => !s.ok)?.id ?? steps().at(-1)?.id)

  return (
    <DialogSelect
      title={t("tui.ops.dialog.repair")}
      hint={t("tui.repair.dialog.hint")}
      options={options()}
      current={current()}
      skipFilter
      flat
    />
  )
}
