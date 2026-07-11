import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@zavorth/plugin/tui"
import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import { useLanguage } from "@tui/context/language"
import {
  readCompanionStatus,
  writeCompanionBridge,
  type CompanionStatus,
} from "../../util/companion-bridge"

const id = "internal:home-companion"
const POLL_MS = 5_000

type Translate = (key: string, params?: Record<string, string | number | boolean>) => string

function statusLabel(status: CompanionStatus, t: Translate): string {
  if (status.online) {
    return status.name
      ? t("tui.companion.status.online_named", { name: status.name })
      : t("tui.companion.status.online")
  }
  return status.name
    ? t("tui.companion.status.offline_named", { name: status.name })
    : t("tui.companion.status.offline")
}

function toastMessage(status: CompanionStatus, t: Translate): string {
  if (status.online) {
    return status.name
      ? t("tui.companion.toast.online_named", { name: status.name })
      : t("tui.companion.toast.online")
  }
  return status.name
    ? t("tui.companion.toast.offline_named", { name: status.name })
    : t("tui.companion.toast.offline")
}

function countSessionApprovals(api: TuiPluginApi): number {
  const current = api.route.current
  if (current.name !== "session") return 0
  const params = current.params as { sessionID?: unknown } | undefined
  const sessionID = params?.sessionID != null ? String(params.sessionID) : ""
  if (!sessionID) return 0
  return api.state.session.permission(sessionID).length
}

/** Best-effort bridge write. Headlines are machine-friendly; WelcomeBox owns rich i18n pulse. */
async function exportBridge(api: TuiPluginApi, t?: Translate): Promise<void> {
  if (!api.state.ready) return

  const sessions = api.state.session.count()
  const providerReady = api.state.provider.length > 0
  const approvals = countSessionApprovals(api)
  const ready = providerReady && approvals === 0

  let headline: string
  if (t) {
    if (!providerReady) headline = t("tui.pulse.needs_provider")
    else if (approvals > 0) headline = t("tui.pulse.needs_approval", { count: approvals })
    else if (sessions === 0) headline = t("tui.pulse.first_light")
    else headline = t("tui.pulse.ready")
  } else {
    headline = ready ? "ready" : "not-ready"
  }

  await writeCompanionBridge({
    version: 1,
    updatedAt: Date.now(),
    product: "zavorth-code",
    pulse: {
      headline,
      ready,
      approvals,
      sessions,
    },
  }).catch(() => {
    // offline-first: companion bridge is best-effort
  })
}

function View(props: { api: TuiPluginApi }) {
  const theme = () => props.api.theme.current
  const t = useLanguage().t
  const [status, setStatus] = createSignal<CompanionStatus>({ online: false })

  const refresh = async () => {
    const next = await readCompanionStatus().catch((): CompanionStatus => ({ online: false }))
    setStatus(next)
    await exportBridge(props.api, t)
  }

  onMount(() => {
    void refresh()
    const handle = setInterval(() => {
      void refresh()
    }, POLL_MS)
    onCleanup(() => clearInterval(handle))
  })

  const label = createMemo(() => statusLabel(status(), t))
  const fg = createMemo(() => (status().online ? theme().success : theme().textMuted))

  // Only paint chrome when a companion is actually online — offline label
  // was stacking under the home footer as empty noise.
  return (
    <Show when={status().online}>
      <box
        width="100%"
        paddingLeft={2}
        paddingRight={2}
        paddingTop={0}
        paddingBottom={0}
        flexDirection="row"
        flexShrink={0}
        justifyContent="flex-end"
      >
        <text fg={fg()}>
          <span style={{ bold: true }}>◇ {label()}</span>
        </text>
      </box>
    </Show>
  )
}

const tui: TuiPlugin = async (api) => {
  void exportBridge(api)

  const stop = setInterval(() => {
    void exportBridge(api)
  }, POLL_MS)
  api.lifecycle.onDispose(() => {
    clearInterval(stop)
  })

  api.command.register(() => {
    const t = useLanguage().t
    return [
      {
        title: t("tui.command.companion.title"),
        value: "companion.status",
        category: "system",
        slash: {
          name: "companion",
        },
        onSelect() {
          void readCompanionStatus()
            .then((status) => {
              api.ui.toast({
                variant: status.online ? "success" : "info",
                message: toastMessage(status, t),
              })
            })
            .catch(() => {
              api.ui.toast({
                variant: "info",
                message: t("tui.companion.toast.offline"),
              })
            })
          api.ui.dialog.clear()
        },
      },
    ]
  })

  api.slots.register({
    order: 50,
    slots: {
      companion_status() {
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
