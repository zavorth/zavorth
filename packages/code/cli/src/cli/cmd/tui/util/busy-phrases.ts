/**
 * Stable Zavorth busy-verb catalog — rotate by tick, not every frame.
 * Catalog width is gated by KV `fun_mode`: low | med | high (default med).
 */

export type FunMode = "low" | "med" | "high"

/** Minimal verbs — serious / low fun. */
export const BUSY_VERBS_LOW = ["thinking", "working"] as const

/** Default medium set — useful variety without theatrics. */
export const BUSY_VERBS_MED = [
  "thinking",
  "working",
  "crafting",
  "reasoning",
  "building",
  "exploring",
  "tracing",
  "shaping",
] as const

/** High fun — slightly more characterful Zavorth lines. */
export const BUSY_VERBS_HIGH = [
  "thinking",
  "working",
  "crafting",
  "reasoning",
  "building",
  "exploring",
  "tracing",
  "shaping",
  "forging",
  "weaving",
  "aligning",
  "charting",
  "honing",
  "unraveling",
  "orbiting",
  "tuning",
] as const

/** Union of all verbs (for types + i18n). */
export const BUSY_VERBS = BUSY_VERBS_HIGH

export type BusyVerb = (typeof BUSY_VERBS)[number]

/** i18n key suffix for each verb → `tui.prompt.busy.${verb}` */
export const BUSY_VERB_I18N: Record<BusyVerb, string> = {
  thinking: "tui.prompt.busy.thinking",
  working: "tui.prompt.busy.working",
  crafting: "tui.prompt.busy.crafting",
  reasoning: "tui.prompt.busy.reasoning",
  building: "tui.prompt.busy.building",
  exploring: "tui.prompt.busy.exploring",
  tracing: "tui.prompt.busy.tracing",
  shaping: "tui.prompt.busy.shaping",
  forging: "tui.prompt.busy.forging",
  weaving: "tui.prompt.busy.weaving",
  aligning: "tui.prompt.busy.aligning",
  charting: "tui.prompt.busy.charting",
  honing: "tui.prompt.busy.honing",
  unraveling: "tui.prompt.busy.unraveling",
  orbiting: "tui.prompt.busy.orbiting",
  tuning: "tui.prompt.busy.tuning",
}

const FUN_MODES: FunMode[] = ["low", "med", "high"]

export function resolveFunMode(raw?: string | null): FunMode {
  const v = (raw ?? "med").trim().toLowerCase()
  if (v === "low" || v === "med" || v === "high") return v
  return "med"
}

export function cycleFunMode(current?: string | null): FunMode {
  const mode = resolveFunMode(current)
  const idx = FUN_MODES.indexOf(mode)
  return FUN_MODES[(idx + 1) % FUN_MODES.length]!
}

export function verbsForMode(mode: FunMode = "med"): readonly BusyVerb[] {
  if (mode === "low") return BUSY_VERBS_LOW
  if (mode === "high") return BUSY_VERBS_HIGH
  return BUSY_VERBS_MED
}

const ROTATE_MS = 2500

/** Simple string seed so different sessions start on different verbs. */
export function hashSeed(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) >>> 0
  }
  return h
}

/** Verb for elapsed busy time. Rotates every ~2.5s; seed offsets the start. */
export function busyVerbAt(elapsedMs: number, seed = 0, funMode: FunMode | string = "med"): BusyVerb {
  const verbs = verbsForMode(resolveFunMode(funMode))
  const step = Math.max(0, Math.floor(elapsedMs / ROTATE_MS))
  return verbs[(seed + step) % verbs.length]!
}

/**
 * Compact elapsed duration for the busy rail: `12s`, `1m 04s`, `1h 02m`.
 * Accepts milliseconds (Date.now() - start).
 */
export function formatDurationBusy(ms: number): string {
  const secs = Math.max(0, Math.floor(ms / 1000))
  if (secs < 60) return `${secs}s`
  if (secs < 3600) {
    const mins = Math.floor(secs / 60)
    const rem = secs % 60
    return `${mins}m ${String(rem).padStart(2, "0")}s`
  }
  const hours = Math.floor(secs / 3600)
  const remMins = Math.floor((secs % 3600) / 60)
  return remMins > 0 ? `${hours}h ${String(remMins).padStart(2, "0")}m` : `${hours}h`
}
