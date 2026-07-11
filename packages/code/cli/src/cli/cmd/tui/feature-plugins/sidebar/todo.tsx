import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@zavorth/plugin/tui"
import { createMemo, For, Show, createSignal } from "solid-js"
import { TodoItem } from "../../component/todo-item"
import { SidebarCard } from "./card"

const id = "internal:sidebar-todo"

function View(props: { api: TuiPluginApi; session_id: string }) {
  const [open, setOpen] = createSignal(true)
  const theme = () => props.api.theme.current
  const list = createMemo(() => props.api.state.session.todo(props.session_id))
  const tasks = createMemo(() => props.api.state.session.task(props.session_id))
  // Only with open todos, and only when the task list is not already covering work.
  const show = createMemo(
    () => tasks().length === 0 && list().length > 0 && list().some((item) => item.status !== "completed"),
  )

  return (
    <Show when={show()}>
      <SidebarCard
        theme={theme()}
        title="todo"
        lead={
          list().length > 3 ? (
            <text fg={theme().textMuted}>{open() ? "▼" : "▶"}</text>
          ) : undefined
        }
        onTitleClick={() => list().length > 3 && setOpen((x) => !x)}
      >
        <Show when={list().length <= 3 || open()}>
          <box gap={0}>
            <For each={list()}>{(item) => <TodoItem status={item.status} content={item.content} />}</For>
          </box>
        </Show>
      </SidebarCard>
    </Show>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 400,
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
