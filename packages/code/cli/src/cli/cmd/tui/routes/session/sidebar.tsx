import { useProject } from "@tui/context/project"
import { useSync } from "@tui/context/sync"
import { createMemo, Show } from "solid-js"
import { useTheme } from "../../context/theme"
import { useTuiConfig } from "../../context/tui-config"
import { InstallationChannel, InstallationVersion } from "@/installation/version"
import { TuiPluginRuntime } from "../../plugin"
import { getScrollAcceleration } from "../../util/scroll"
import { useLanguage } from "../../context/language"

/** Slim quiet rail width (columns). Keep in sync with contentWidth in session/index. */
export const SIDEBAR_WIDTH = 32

/**
 * Session sidebar — minimal quiet rail.
 *
 * Chat stays primary. When open: title, optional approvals, ambient plugins
 * (pulse / active work only), and a tiny version footer.
 * No stacked OpenCode-style rounded cards — plugins render flat sections.
 */
export function Sidebar(props: { sessionID: string; overlay?: boolean }) {
  const project = useProject()
  const sync = useSync()
  const { theme } = useTheme()
  const tuiConfig = useTuiConfig()
  const t = useLanguage().t
  const session = createMemo(() => sync.session.get(props.sessionID))
  const workspaceStatus = () => {
    const workspaceID = session()?.workspaceID
    if (!workspaceID) return "error"
    return project.workspace.status(workspaceID) ?? "error"
  }
  const workspaceLabel = () => {
    const workspaceID = session()?.workspaceID
    if (!workspaceID) return "unknown"
    const info = project.workspace.get(workspaceID)
    if (!info) return "unknown"
    return `${info.type}: ${info.name}`
  }
  const scrollAcceleration = createMemo(() => getScrollAcceleration(tuiConfig))

  const versionMark = createMemo(() => {
    const v = InstallationVersion
    if (!v || v === "local" || InstallationChannel === "local") return "zavorth"
    return `zavorth ${v.replace(/^v/i, "")}`
  })

  const approvals = createMemo(() => (sync.data.permission[props.sessionID] ?? []).length)

  return (
    <Show when={session()}>
      <box
        backgroundColor={theme.backgroundPanel}
        width={SIDEBAR_WIDTH}
        height="100%"
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={1}
        paddingRight={1}
        position={props.overlay ? "absolute" : "relative"}
        border={["left"]}
        borderColor={theme.borderSubtle}
      >
        <scrollbox
          flexGrow={1}
          scrollAcceleration={scrollAcceleration()}
          verticalScrollbarOptions={{
            trackOptions: {
              backgroundColor: theme.backgroundPanel,
              foregroundColor: theme.borderSubtle,
            },
          }}
        >
          <box flexShrink={0} gap={1} paddingRight={0}>
            <TuiPluginRuntime.Slot
              name="sidebar_title"
              mode="single_winner"
              session_id={props.sessionID}
              title={session()!.title}
              share_url={session()!.share?.url}
            >
              <box gap={0}>
                <text fg={theme.text} wrapMode="none">
                  <b>{session()!.title}</b>
                </text>
                <Show when={approvals() > 0}>
                  <text fg={theme.warning}>
                    △{" "}
                    {approvals() === 1
                      ? t("tui.prompt.rail.approvals_one")
                      : t("tui.prompt.rail.approvals", { count: approvals() })}
                  </text>
                </Show>
                <Show when={session()!.workspaceID}>
                  <text fg={theme.textMuted}>
                    <span style={{ fg: workspaceStatus() === "connected" ? theme.success : theme.error }}>●</span>{" "}
                    {workspaceLabel()}
                  </text>
                </Show>
              </box>
            </TuiPluginRuntime.Slot>

            {/* Ambient pulse + active work only (plugins self-hide when empty) */}
            <TuiPluginRuntime.Slot name="sidebar_content" session_id={props.sessionID} />
          </box>
        </scrollbox>

        <box flexShrink={0} gap={0} paddingTop={1}>
          <TuiPluginRuntime.Slot name="sidebar_footer" mode="single_winner" session_id={props.sessionID}>
            <text fg={theme.textMuted}>{versionMark()}</text>
          </TuiPluginRuntime.Slot>
        </box>
      </box>
    </Show>
  )
}
