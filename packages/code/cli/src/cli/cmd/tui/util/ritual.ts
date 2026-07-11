export type RitualState = {
  days: number // consecutive days
  lastDay: string // YYYY-MM-DD local
  enabled: boolean
  totalOpens: number
}

/** Local calendar day key YYYY-MM-DD. */
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function shiftDayKey(d: Date, deltaDays: number): string {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + deltaDays)
  return todayKey(next)
}

/**
 * Pure ritual streak touch. Callers persist via KV.
 * - if !enabled, still track (UI may hide)
 * - if lastDay is yesterday, days++
 * - if lastDay is today, keep days
 * - if older / missing, reset days to 1
 * - totalOpens++
 */
export function touchRitual(prev: RitualState | undefined, now: Date = new Date()): RitualState {
  const today = todayKey(now)
  const yesterday = shiftDayKey(now, -1)
  const enabled = prev?.enabled !== false
  const totalOpens = (prev?.totalOpens ?? 0) + 1

  if (!prev || !prev.lastDay) {
    return { days: 1, lastDay: today, enabled, totalOpens }
  }

  if (prev.lastDay === today) {
    return {
      days: Math.max(1, prev.days || 1),
      lastDay: today,
      enabled,
      totalOpens,
    }
  }

  if (prev.lastDay === yesterday) {
    return {
      days: Math.max(1, (prev.days || 0) + 1),
      lastDay: today,
      enabled,
      totalOpens,
    }
  }

  return { days: 1, lastDay: today, enabled, totalOpens }
}
