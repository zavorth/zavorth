import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@zavorth/plugin/tui"
import { createMemo, For, Show, createSignal } from "solid-js"
import { SidebarCard } from "./card"

const id = "internal:sidebar-files"

function View(props: { api: TuiPluginApi; session_id: string }) {
  const [open, setOpen] = createSignal(true)
  const theme = () => props.api.theme.current
  const list = createMemo(() => props.api.state.session.diff(props.session_id))

  return (
    <Show when={list().length > 0}>
      <SidebarCard
        theme={theme()}
        title="changes"
        lead={
          list().length > 3 ? (
            <text fg={theme().textMuted}>{open() ? "▼" : "▶"}</text>
          ) : undefined
        }
        onTitleClick={() => list().length > 3 && setOpen((x) => !x)}
      >
        <Show when={list().length <= 3 || open()}>
          <box gap={0}>
            <For each={list()}>
              {(item) => (
                <box flexDirection="row" gap={1} justifyContent="space-between">
                  <text fg={theme().textMuted} wrapMode="none">
                    {item.file}
                  </text>
                  <box flexDirection="row" gap={1} flexShrink={0}>
                    <Show when={item.additions}>
                      <text fg={theme().diffAdded}>+{item.additions}</text>
                    </Show>
                    <Show when={item.deletions}>
                      <text fg={theme().diffRemoved}>-{item.deletions}</text>
                    </Show>
                  </box>
                </box>
              )}
            </For>
          </box>
        </Show>
      </SidebarCard>
    </Show>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 500,
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
