import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@zavorth/plugin/tui"
import { createMemo, Show } from "solid-js"

const id = "internal:sidebar-lsp"

function View(props: { api: TuiPluginApi }) {
  const theme = () => props.api.theme.current
  const list = createMemo(() => props.api.state.lsp())
  // Never show idle — hide entirely when no language servers are running.
  const show = createMemo(() => list().length > 0)
  const up = createMemo(() => list().filter((item) => item.status === "connected").length)

  const line = createMemo(() => {
    const names = list()
      .slice(0, 3)
      .map((item) => item.id)
      .join(", ")
    const more = list().length > 3 ? ` +${list().length - 3}` : ""
    return `lsp ${up()}/${list().length} · ${names}${more}`
  })

  return (
    <Show when={show()}>
      <text fg={theme().textMuted}>{line()}</text>
    </Show>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 300,
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
