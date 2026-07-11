/** One-time contextual tips (Hermes-style). Tracked in KV under "first_touch". */

export type FirstTouchKey =
  | "busy_interrupt"
  | "approval"
  | "agent_mention"
  | "file_mention"
  | "slash"
  | "needs_provider"
  | "init_project"
  | "multi_tool"
  | "compact"

const KV_KEY = "first_touch"

type KvLike = {
  ready: boolean
  get: (key: string, defaultValue?: any) => any
  set: (key: string, value: any) => void
}

function read(kv: KvLike): Record<string, true> {
  const raw = kv.get(KV_KEY, {})
  if (!raw || typeof raw !== "object") return {}
  return raw as Record<string, true>
}

/** True only once per key after KV is ready. */
export function shouldShow(kv: KvLike, key: FirstTouchKey): boolean {
  if (!kv.ready) return false
  return !read(kv)[key]
}

/** Persist that this tip was shown (call immediately when displaying). */
export function markSeen(kv: KvLike, key: FirstTouchKey): void {
  const next = { ...read(kv), [key]: true as const }
  kv.set(KV_KEY, next)
}
