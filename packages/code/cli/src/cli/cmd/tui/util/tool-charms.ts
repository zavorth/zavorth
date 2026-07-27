/** Witty Zavorth one-liners for long-running tool calls (≥8s). English-only catalog. */

export const TOOL_CHARMS = [
  "still cooking…",
  "deep in the stack…",
  "patience, green machine…",
  "letting the bits marinate…",
  "tracing the rabbit hole…",
  "hold on — quality takes a beat…",
  "compiling vibes…",
  "negotiating with the filesystem…",
  "sharpening the chisel…",
  "almost elegant…",
  "the green machine hums…",
  "one more layer of the onion…",
] as const

export type ToolCharm = (typeof TOOL_CHARMS)[number]

/** Show charms only after this much tool wall time. */
export const CHARM_THRESHOLD_MS = 8000

/** Rotate / unlock the next charm slot about this often while running. */
export const CHARM_ROTATE_MS = 10000

/** Never more than this many charm lines under a tool header. */
export const MAX_CHARMS = 2

/** Simple string seed so different tools land on different lines. */
export function hashSeed(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) >>> 0
  }
  return h
}

/**
 * Wall-clock elapsed for a tool state that may carry `time.start` / `time.end`.
 * Pending tools with no clock return 0. Running tools use `now` as the end bound.
 */
export function toolElapsedMs(
  state: { status?: string; time?: { start?: number; end?: number } },
  now = Date.now(),
): number {
  const start = state.time?.start
  if (typeof start !== "number") return 0
  const end = typeof state.time?.end === "number" ? state.time.end : now
  return Math.max(0, end - start)
}

/**
 * Up to {@link MAX_CHARMS} witty lines for a tool that has been at it ≥ {@link CHARM_THRESHOLD_MS}.
 * Slot 1 unlocks at the threshold; slot 2 after another rotate window. Text advances every ~10s.
 */
export function charmsForElapsed(elapsedMs: number, seed = 0): string[] {
  if (elapsedMs < CHARM_THRESHOLD_MS) return []
  const step = Math.floor((elapsedMs - CHARM_THRESHOLD_MS) / CHARM_ROTATE_MS)
  const count = Math.min(MAX_CHARMS, step + 1)
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const idx = (seed + step - (count ? 1 - i)) % TOOL_CHARMS.length
    const safe = ((idx % TOOL_CHARMS.length) + TOOL_CHARMS.length) % TOOL_CHARMS.length
    out.push(TOOL_CHARMS[safe]!)
  }
  return out
}
