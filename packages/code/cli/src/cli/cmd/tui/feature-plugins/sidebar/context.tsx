import type { AssistantMessage } from "@zavorth/sdk/v2"
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@zavorth/plugin/tui"
import { Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { completedTPS, formatTPS, streamingTPS } from "./tps"

const id = "internal:sidebar-context"
const REFRESH_MS = 1000

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

function View(props: { api: TuiPluginApi; session_id: string }) {
  const theme = () => props.api.theme.current
  const msg = createMemo(() => props.api.state.session.messages(props.session_id))
  const cost = createMemo(() => msg().reduce((sum, item) => sum + (item.role === "assistant" ? item.cost : 0), 0))

  const [tick, setTick] = createSignal(Date.now())

  const lastAssistant = createMemo(() =>
    msg().findLast((item): item is AssistantMessage => item.role === "assistant"),
  )

  const isStreaming = createMemo(() => {
    const m = lastAssistant()
    return m !== undefined && !m.time.completed
  })

  createEffect(() => {
    if (!isStreaming()) return
    const handle = setInterval(() => setTick(Date.now()), REFRESH_MS)
    onCleanup(() => clearInterval(handle))
  })

  const tps = createMemo<number | null>(() => {
    const m = lastAssistant()
    if (!m) return null

    if (isStreaming()) {
      tick()
      const parts = props.api.state.part(m.id)
      const combined = parts
        .filter((p) => p.type === "text" || p.type === "reasoning")
        .map((p) => p.text)
        .join("")
      return streamingTPS(combined, m.time.created, Date.now())
    }

    const idleTarget = msg().findLast(
      (item): item is AssistantMessage =>
        item.role === "assistant" &&
        item.time.completed !== undefined &&
        item.tokens.output + item.tokens.reasoning > 0,
    )
    if (!idleTarget || idleTarget.time.completed === undefined) return null
    return completedTPS(
      idleTarget.tokens.output,
      idleTarget.tokens.reasoning,
      idleTarget.time.created,
      idleTarget.time.completed,
    )
  })

  const tpsLabel = createMemo(() => formatTPS(tps()))

  const state = createMemo(() => {
    const last = msg().findLast((item): item is AssistantMessage => item.role === "assistant" && item.tokens.output > 0)
    if (!last) {
      return {
        tokens: 0,
        percent: null as number | null,
      }
    }

    const tokens =
      last.tokens.input + last.tokens.output + last.tokens.reasoning + last.tokens.cache.read + last.tokens.cache.write
    const model = props.api.state.provider.find((item) => item.id === last.providerID)?.models[last.modelID]
    return {
      tokens,
      percent: model?.limit.context ? Math.round((tokens / model.limit.context) * 100) : null,
    }
  })

  // One ambient line under the host title — no card chrome.
  // e.g. "ctx 32% · $0.12 · 40 t/s"
  const line = createMemo(() => {
    const parts: string[] = []
    const pct = state().percent
    parts.push(pct !== null ? `ctx ${pct}%` : "ctx —")
    parts.push(money.format(cost()))
    const t = tpsLabel()
    if (t) parts.push(t)
    if (isStreaming()) parts.push("live")
    return parts.join(" · ")
  })

  const show = createMemo(() => {
    // Hide until there is something useful (tokens, cost, or live stream).
    return state().percent !== null || cost() > 0 || isStreaming()
  })

  return (
    <Show when={show()}>
      <text fg={theme().textMuted}>{line()}</text>
    </Show>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 100,
    slots: {
      sidebar_content(_ctx, props) {
        return <View api={api} session_id={props.session_id} />
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id,
  tui,
}

export default plugin
