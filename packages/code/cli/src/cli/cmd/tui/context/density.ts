export type UiDensity = "comfortable" | "compact"

/** Spacing helpers for comfortable vs compact UI density. */
export function densityPad(density: UiDensity) {
  return density === "compact" ? { pad: 0, gap: 0 } : { pad: 1, gap: 1 }
}

export function isUiDensity(value: unknown): value is UiDensity {
  return value === "comfortable" || value === "compact"
}

export function toggleUiDensity(current: UiDensity): UiDensity {
  return current === "compact" ? "comfortable" : "compact"
}
