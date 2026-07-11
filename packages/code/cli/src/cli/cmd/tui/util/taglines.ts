/** One-line boot banner taglines — Zavorth tone: calm, craft, gravity. */

export const TAGLINES = [
  "Ship with gravity.",
  "Event horizon for your code.",
  "Quiet power. Clear diffs.",
  "Build past the event horizon.",
  "Local-first. Signal-strong.",
  "Code that holds.",
  "Less noise. More orbit.",
  "Trust the workspace. Ship the change.",
  "Green light means go.",
  "From intent to impact.",
  "Precision over spectacle.",
  "Agents with good manners.",
  "Stay in the loop.",
  "Terminal gravity.",
  "One prompt. Clean landing.",
  "Orbit, then land.",
  "Focused craft for real codebases.",
  "The calm after the compile.",
] as const

export const DEFAULT_TAGLINE = TAGLINES[0]

export type TaglineMode = "random" | "default" | "off"

export function resolveTaglineMode(raw?: string | null): TaglineMode {
  const v = (raw ?? "random").trim().toLowerCase()
  if (v === "off" || v === "0" || v === "false" || v === "none") return "off"
  if (v === "default" || v === "fixed") return "default"
  return "random"
}

/** Pick a banner tagline. Returns null when mode is off. */
export function pickTagline(mode: TaglineMode | string = "random"): string | null {
  const resolved = resolveTaglineMode(typeof mode === "string" ? mode : mode)
  if (resolved === "off") return null
  if (resolved === "default") return DEFAULT_TAGLINE
  return TAGLINES[Math.floor(Math.random() * TAGLINES.length)]!
}
