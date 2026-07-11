import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@zavorth/plugin/tui"
import { createMemo, Show } from "solid-js"
import { SidebarCard } from "./card"

const id = "internal:sidebar-goal"

function View(props: { api: TuiPluginApi; session_id: string }) {
  const theme = () => props.api.theme.current
  const goal = createMemo(() => props.api.state.session.goal(props.session_id))
  // The latest verdict (keyed by the most recently judged turn) drives the
  // status line; per-turn reasons live inline on the message stream.
  const latest = createMemo(() => {
    const g = goal()
    if (!g?.lastMessageID) return undefined
    return g.verdicts[g.lastMessageID]
  })

  // Show whenever there is an active goal, or a verdict survives from a goal
  // that just cleared (so the ✓/⊘ result lingers briefly).
  const show = createMemo(() => Boolean(goal()?.condition || latest()))

  const status = createMemo(() => {
    const v = latest()
    if (!v) return undefined
    if (v.error) return { label: "error" }
    if (v.ok) return { label: "met" }
    if (v.impossible) return { label: "impossible" }
    return { label: `r${v.attempt} · open` }
  })

  return (
    <Show when={show()}>
      <SidebarCard theme={theme()} title="goal">
        <Show when={goal()?.condition}>
          {(condition) => (
            <text fg={theme().textMuted} wrapMode="word">
              {condition()}
            </text>
          )}
        </Show>
        <Show when={status()}>
          {(s) => (
            <text fg={theme().textMuted} wrapMode="word">
              {s().label}
            </text>
          )}
        </Show>
      </SidebarCard>
    </Show>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 350,
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
