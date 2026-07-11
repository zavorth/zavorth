import { createMemo, createSignal, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { useLanguage } from "../context/language"

export type TrustRisk = "low" | "medium" | "high"

const HIGH_RISK = ["bash", "write", "edit", "multiedit", "apply_patch", "notebook_edit"]
const MEDIUM_RISK = ["webfetch", "websearch", "codesearch", "task", "actor", "workflow"]

const SCOPE_KEYS = ["path", "file", "filepath", "filePath", "directory", "target"] as const

export function riskForTool(tool: string): TrustRisk {
  const t = tool.toLowerCase()
  if (HIGH_RISK.includes(t)) return "high"
  if (MEDIUM_RISK.includes(t)) return "medium"
  return "low"
}

function scopeFromInput(input: Record<string, unknown> | undefined, workspaceLabel: string): string {
  if (!input) return workspaceLabel
  for (const key of SCOPE_KEYS) {
    const value = input[key]
    if (typeof value === "string" && value.trim()) return value
  }
  return workspaceLabel
}

/**
 * Collapsible trust strip on tool rows. Quiet by default; when a permission
 * is pending, the header picks up warning emphasis and the expanded panel
 * shows a one-line approve/deny/always tip. No solid color slabs.
 */
export function TrustLens(props: {
  tool: string
  input?: Record<string, unknown>
  status?: string
  permission?: boolean
}) {
  const { theme } = useTheme()
  const t = useLanguage().t
  const [open, setOpen] = createSignal(false)

  const risk = createMemo(() => riskForTool(props.tool))
  const pending = createMemo(() => Boolean(props.permission))

  const riskLabel = createMemo(() => {
    const r = risk()
    if (r === "high") return t("tui.trust.risk.high")
    if (r === "medium") return t("tui.trust.risk.medium")
    return t("tui.trust.risk.low")
  })

  const riskColor = createMemo(() => {
    const r = risk()
    if (r === "high") return theme.error
    if (r === "medium") return theme.warning
    return theme.success
  })

  // Header chrome: muted when idle; warning when approval is waiting
  // (stronger hierarchy without a full-width bar).
  const headerFg = createMemo(() => (pending() ? theme.warning : theme.textMuted))

  const scope = createMemo(() => scopeFromInput(props.input, t("tui.trust.workspace")))

  return (
    <box flexDirection="column" gap={0}>
      <box onMouseUp={() => setOpen((v) => !v)}>
        <text fg={theme.textMuted}>
          <span style={{ fg: theme.textMuted }}>{open() ? "▼" : "▶"} </span>
          <span style={{ fg: headerFg() }}>{`◇ ${t("tui.trust.label")}`}</span>
          {` · `}
          <span style={{ fg: riskColor() }}>{riskLabel()}</span>
          {` · ${props.tool}`}
          <Show when={pending()}>
            <span style={{ fg: theme.warning }}>{` · ${t("tui.trust.awaiting_approval")}`}</span>
          </Show>
        </text>
      </box>
      <Show when={open()}>
        <box flexDirection="column" paddingLeft={2} gap={0}>
          <text fg={theme.textMuted}>
            {t("tui.trust.risk")}:{" "}
            <span style={{ fg: riskColor() }}>
              {pending() && risk() === "high" ? t("tui.trust.risk_high") : riskLabel()}
            </span>
          </text>
          <text fg={theme.textMuted}>
            {t("tui.trust.tool")}: {props.tool}
          </text>
          <text fg={theme.textMuted}>
            {t("tui.trust.scope")}: {scope()}
          </text>
          <Show when={props.status}>
            <text fg={theme.textMuted}>
              {t("tui.trust.status")}: {props.status}
            </text>
          </Show>
          <Show when={pending()}>
            <text fg={theme.warning}>{t("tui.trust.awaiting_approval")}</text>
            <text fg={theme.textMuted}>{t("tui.trust.approval_hint")}</text>
          </Show>
        </box>
      </Show>
    </box>
  )
}
