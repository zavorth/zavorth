/**
 * OSC-8 hyperlink escape sequences for terminals that support them
 * (iTerm2, kitty, WezTerm, Ghostty, Windows Terminal, …).
 *
 * ## TUI policy (do not force into Solid markdown)
 *
 * OpenTUI Solid `<text>` / `<code>` / `<markdown>` boxes do **not** reliably
 * forward raw OSC sequences as native clickable links — the renderer owns the
 * glyph stream and may show escape junk or ignore the link.
 *
 * **Inside the TUI:** use `@tui/ui/link` (mouse → `open(href)`). That is the
 * supported, portable path.
 *
 * **Outside the Solid tree:** raw stdout/stderr (e.g. optional adornment on a
 * toast label when `supportsOsc8()` is true). Even then, keep a plain-text
 * fallback; never rely on OSC-8 for required UX.
 *
 * If OSC-8 text is later selected/copied, `stripProtection` / `clipboard.copy`
 * remove the wrappers so editors receive clean label text.
 *
 * Format: ESC ] 8 ; ; url BEL label ESC ] 8 ; ; BEL
 * @see https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda
 */

/** Build an OSC-8 hyperlink: visible `label`, target `url`. */
export function osc8(url: string, label: string): string {
  const safeUrl = url.replace(/[\x00-\x1f\x7f]/g, "")
  return `\x1b]8;;${safeUrl}\x07${label}\x1b]8;;\x07`
}

/**
 * True when env hints suggest OSC-8 is worth emitting on raw TTY writes.
 * Still not a guarantee the host will paint a clickable link — use for
 * optional adornment only.
 */
export function supportsOsc8(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.zavorth_TUI_PLAIN === "true" || env.zavorth_TUI_PLAIN === "1") return false
  if (env.TERM === "dumb") return false
  if (env.VTE_VERSION) {
    const v = Number.parseInt(env.VTE_VERSION, 10)
    // VTE enabled OSC-8 around 0.50+ (version as integer YYYYMM or similar)
    if (!Number.isNaN(v) && v > 0 && v < 5000) return false
  }
  const program = env.TERM_PROGRAM ?? ""
  if (
    program === "iTerm.app" ||
    program === "WezTerm" ||
    program === "ghostty" ||
    program === "vscode" ||
    program === "WarpTerminal"
  ) {
    return true
  }
  if (env.WT_SESSION || env.KITTY_WINDOW_ID) return true
  if (env.TERM?.includes("kitty") || env.TERM?.includes("wezterm")) return true
  // Conservative default: emit on real TTYs; consumers still need raw write path
  return Boolean(process.stdout.isTTY)
}
