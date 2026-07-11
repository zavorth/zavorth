import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@zavorth/plugin/tui"
import { createMemo, Show } from "solid-js"

const id = "internal:sidebar-footer"

function View(props: { api: TuiPluginApi }) {
  const theme = () => props.api.theme.current
  const has = createMemo(() =>
    props.api.state.provider.some(
      (item) => item.id !== "zavorth" || Object.values(item.models).some((model) => model.cost?.input !== 0),
    ),
  )
  const done = createMemo(() => props.api.kv.get("dismissed_getting_started", false))
  const showSetup = createMemo(() => !has() && !done())

  const mark = createMemo(() => {
    const v = props.api.app.version
    if (!v || v === "local" || /^v?local$/i.test(v)) return "zavorth"
    return `zavorth ${v.replace(/^v/i, "")}`
  })

  return (
    <box gap={0}>
      <Show when={showSetup()}>
        <box flexDirection="row" gap={1}>
          <text fg={theme().textMuted}>
            <span style={{ fg: theme().text }}>/connect</span> setup
          </text>
          <text fg={theme().textMuted} onMouseDown={() => props.api.kv.set("dismissed_getting_started", true)}>
            ✕
          </text>
        </box>
      </Show>
      <text fg={theme().textMuted}>{mark()}</text>
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 100,
    slots: {
      sidebar_footer() {
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
