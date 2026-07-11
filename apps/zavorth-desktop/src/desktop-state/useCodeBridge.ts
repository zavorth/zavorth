import { useEffect, useState } from 'react'
import type { CodeBridgeSummary } from '../global'

const POLL_MS = 5_000

const FALLBACK: CodeBridgeSummary = {
  tone: 'muted',
  label: 'Code offline',
  detail: 'No Zavorth Code CLI bridge yet',
  opsFresh: false,
  companionFresh: false,
}

/**
 * Poll Code CLI ops-bridge / companion-bridge via Electron main.
 * Outside Electron (vite-only) stays offline/muted.
 */
export function useCodeBridge(pollMs = POLL_MS): CodeBridgeSummary {
  const [summary, setSummary] = useState<CodeBridgeSummary>(FALLBACK)

  useEffect(() => {
    let cancelled = false
    const api = window.zavorthDesktop?.getCodeBridgeSummary
    if (!api) return

    const tick = async () => {
      try {
        const next = await api()
        if (!cancelled && next && typeof next.label === 'string') {
          setSummary(next)
        }
      } catch {
        if (!cancelled) setSummary(FALLBACK)
      }
    }

    void tick()
    const handle = window.setInterval(() => {
      void tick()
    }, pollMs)
    return () => {
      cancelled = true
      window.clearInterval(handle)
    }
  }, [pollMs])

  return summary
}
