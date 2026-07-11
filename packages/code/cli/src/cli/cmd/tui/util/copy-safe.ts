/**
 * Copy-safe wrap helpers for TUI text.
 *
 * Goal: keep paths, URLs, and secret-like tokens from mid-token wrap damage
 * that corrupts clipboard selection.
 *
 * Strategy:
 * - `isProtectedToken` / `segmentForWrap` — wrap algorithms should split on
 *   whitespace only and treat protected tokens as unbreakable units.
 * - `protectTokens` — inserts zero-width spaces (U+200B) after path separators
 *   inside protected tokens so wrap prefers segment boundaries (not mid-slug),
 *   without wrecking markdown/syntax highlighters.
 * - `stripProtection` — remove soft-break markers before programmatic copy.
 *
 * Note: visual soft-wrap that injects real newlines into the buffer is never
 * fully copy-safe; prefer layout-only wrap + atomic tokens when possible.
 */

const ZWSP = "\u200B"

/** True when `s` should stay atomic under wrap (paths, URLs, secrets, …). */
export function isProtectedToken(s: string): boolean {
  if (!s || s.length < 2) return false
  if (/\s/.test(s)) return false

  // URLs
  if (/^https?:\/\//i.test(s)) return true
  if (/^mailto:/i.test(s)) return true
  if (/^file:\/\//i.test(s)) return true

  // Emails
  if (/^[\w.+-]+@[\w.-]+\.\w{2,}$/.test(s)) return true

  // Windows / UNC paths
  if (/^[A-Za-z]:[\\/]/.test(s)) return true
  if (s.startsWith("\\\\") || s.startsWith("//")) return true

  // POSIX / relative / home paths
  if (s.startsWith("~/") || s.startsWith("./") || s.startsWith("../")) return true
  if (s.startsWith("/") && s.length > 1) return true

  // Env-style or secret-looking tokens
  if (/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(s)) return true
  if (/^(sk|pk|rk|api|ghp|gho|ghu|ghs|ghr|github_pat|xox[baprs]|xoxe)[-_]/i.test(s)) return true
  if (/^Bearer\./i.test(s)) return true
  // Long base64 / hex blobs (API keys, tokens)
  if (s.length >= 32 && /^[A-Za-z0-9_/+-]+=*$/.test(s)) return true
  if (s.length >= 32 && /^[0-9a-fA-F-]+$/.test(s)) return true

  // Path-like multi-segment tokens without spaces
  if (s.includes("/") && s.length > 8 && /^[\w.~@$%+/=[\]()#?&:.-]+$/.test(s)) return true
  if (s.includes("\\") && s.length > 8 && /^[\w.~@$%+/=[\]()#?&:\\.-]+$/.test(s)) return true

  return false
}

/**
 * Soft-break protected tokens at path separators so wrap hits `/` or `\`
 * boundaries instead of arbitrary mid-slug cuts. Non-protected text is unchanged.
 *
 * Highlighter-friendly: ZWSP is typically ignored by markdown/syntax parsers.
 * Call `stripProtection` before writing to the clipboard programmatically.
 */
export function protectTokens(text: string): string {
  if (!text) return text
  return text.replace(/\S+/g, (token) => {
    if (!isProtectedToken(token)) return token
    // Optional break after path/URL separators (not inside alphanumerics)
    return token.replace(/(?<=[\\/])(?=.)/g, ZWSP)
  })
}

/**
 * Remove copy-safe markers and stray hyperlink escapes so clipboard text stays clean.
 *
 * Strips:
 * - Soft-break / BOM: U+200B (ZWSP), U+2060 (WORD JOINER), U+FEFF (BOM)
 * - OSC-8 hyperlink wrappers (`ESC ] 8 ; … BEL` / ST) — keeps visible label text
 *
 * Safe for plain paths, markdown, and terminal selection that may have absorbed
 * display-only wrap helpers. Does **not** strip arbitrary CSI color codes (those
 * are rare in selection buffers and may appear in intentional paste of logs).
 *
 * Prefer calling via `clipboard.copy()` (always strips); call directly only when
 * preparing text for a non-clipboard sink.
 */
export function stripProtection(text: string): string {
  if (!text) return text
  // Soft-break / BOM markers from protectTokens
  let out = text.replace(/[\u2060\u200B\uFEFF]/g, "")
  // OSC-8 open/close: ESC ] 8 ; params BEL|ST — leave the human-visible label
  out = out.replace(/\x1b\]8;[^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
  return out
}

/**
 * Wrap-safe segmentation: split on whitespace runs but keep each
 * `/path/like` and `https://…` token atomic.
 *
 * Consumers that implement their own wrap should rejoin with spaces and only
 * break between returned segments (never inside a segment where
 * `isProtectedToken(segment)` is true).
 */
export function segmentForWrap(text: string): string[] {
  if (!text) return []
  const parts = text.split(/(\s+)/)
  return parts.filter((p) => p.length > 0)
}
