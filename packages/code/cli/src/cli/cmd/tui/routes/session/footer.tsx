import { createMemo, Show } from "solid-js"
import { useTheme } from "../../context/theme"
import { useSync } from "../../context/sync"
import { useRouteData } from "../../context/route"
import { useTerminalDimensions } from "@opentui/solid"
import type { AssistantMessage } from "@zavorth/sdk/v2"
import { useLanguage } from "../../context/language"

/**
 * Minimal session chrome above the composer.
 * Universal signals only (every session benefits) — never goal-only chrome.
 * Path / branch / model live under the prompt or on home.
 */
export function Footer() {
  const { theme } = useTheme()
  const sync = useSync()
  const route = useRouteData("session")
  const dimensions = useTerminalDimensions()
  const t = useLanguage().t

  const width = createMemo(() => dimensions().width)

  const messages = createMemo(() => sync.data.message[route.sessionID]?.["main"] ?? [])

  const approvals = createMemo(() => (sync.data.permission[route.sessionID] ?? []).length)

  const ctxPct = createMemo(() => {
    const msg = messages()
    const last = msg.findLast(
      (item): item is AssistantMessage => item.role === "assistant" && item.tokens.output > 0,
    )
    if (!last) return undefined
    const tokens =
      last.tokens.input +
      last.tokens.output +
      last.tokens.reasoning +
      last.tokens.cache.read +
      last.tokens.cache.write
    if (tokens <= 0) return undefined
    const modelInfo = sync.data.provider.find((item) => item.id === last.providerID)?.models[last.modelID]
    const limit = modelInfo?.limit.context
    if (!limit || limit <= 0) return undefined
    return Math.round((tokens / limit) * 100)
  })

  // High context pressure — useful for all users before compaction
  const ctxLabel = createMemo(() => {
    const pct = ctxPct()
    if (pct === undefined || pct < 50) return undefined
    return t("tui.session.footer.ctx", { pct })
  })

  // Pending tool approvals — actionable for everyone
  const approvalLabel = createMemo(() => {
    const n = approvals()
    if (n <= 0) return undefined
    if (n === 1) return t("tui.session.footer.approval_one")
    return t("tui.session.footer.approval_many", { count: n })
  })

  const line = createMemo(() => {
    if (width() < 20) return ""
    const parts: string[] = []
    const a = approvalLabel()
    if (a) parts.push(a)
    const ctx = ctxLabel()
    if (ctx) parts.push(ctx)
    return parts.join(" · ")
  })

  const fg = createMemo(() => (approvals() > 0 ? theme.warning : theme.textMuted))

  return (
    <Show when={line()}>
      <box flexDirection="row" flexShrink={0} paddingTop={0} paddingBottom={0}>
        <text fg={fg()} wrapMode="none">
          {line()}
        </text>
      </box>
    </Show>
  )
}
