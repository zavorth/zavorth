import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@zavorth/plugin/tui"
import { createMemo, Show } from "solid-js"

const id = "internal:sidebar-mcp"

function View(props: { api: TuiPluginApi }) {
  const theme = () => props.api.theme.current
  const list = createMemo(() => props.api.state.mcp())
  const on = createMemo(() => list().filter((item) => item.status === "connected").length)
  const bad = createMemo(
    () =>
      list().filter(
        (item) =>
          item.status === "failed" || item.status === "needs_auth" || item.status === "needs_client_registration",
      ).length,
  )

  // Single collapsed ambient line only when connectors exist.
  const line = createMemo(() => {
    const parts = [`mcp ${on()}/${list().length}`]
    if (bad() > 0) parts.push(`${bad()} err`)
    return parts.join(" · ")
  })

  return (
    <Show when={list().length > 0}>
      <text fg={theme().textMuted}>{line()}</text>
    </Show>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 200,
    slots: {
      sidebar_content() {
        return <View api={api} />
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id,
  tui,
}

export default plugin
