import type { JSX } from "solid-js"
import { Show } from "solid-js"
import type { TuiThemeCurrent } from "@zavorth/plugin/tui"

export type SidebarCardVariant = "section" | "hero" | "ambient"

/**
 * Flat sidebar section — no rounded nested boxes (anti-OpenCode card stack).
 * All variants share the same quiet chrome: optional muted title + children.
 * `hero` / `ambient` are kept for call-site intent only.
 */
export function SidebarCard(props: {
  theme: TuiThemeCurrent
  variant?: SidebarCardVariant
  title?: string
  /** Optional chevron / control rendered before the title */
  lead?: JSX.Element
  onTitleClick?: () => void
  children?: JSX.Element
}) {
  const theme = () => props.theme

  return (
    <box gap={0} flexShrink={0}>
      <Show when={props.title || props.lead}>
        <box flexDirection="row" gap={1} onMouseDown={props.onTitleClick}>
          {props.lead}
          <Show when={props.title}>
            <text fg={theme().textMuted}>{props.title}</text>
          </Show>
        </box>
      </Show>
      {props.children}
    </box>
  )
}
