import type { JSX } from "solid-js"
import type { RGBA } from "@opentui/core"
import open from "open"

export interface LinkProps {
  href: string
  children?: JSX.Element | string
  fg?: RGBA
}

/**
 * Link component that renders clickable hyperlinks.
 * Clicking anywhere on the link text opens the URL in the default browser via `open()`.
 *
 * OSC-8 note: OpenTUI Solid `<text>` boxes do not reliably emit/handle OSC-8
 * (`\x1b]8;;url\x07label\x1b]8;;\x07`) as native terminal hyperlinks — the
 * renderer owns the glyph stream. Mouse → `open(href)` is the supported path
 * inside the TUI. For raw stdout/stderr outside the Solid tree, see
 * `@tui/util/osc8` (`osc8(url, label)`).
 */
export function Link(props: LinkProps) {
  const displayText = props.children ?? props.href

  return (
    <text
      fg={props.fg}
      onMouseUp={() => {
        open(props.href).catch(() => {})
      }}
    >
      {displayText}
    </text>
  )
}
