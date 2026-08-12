/**
 * Server-side Zavorth Code file-bridge reader/writer.
 * Contract: zavorth-code/docs/bridge-contract.md
 * Mirrors scripts/lib/zavorth-code-bridge.mjs for Next.js runtime.
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

export const ONLINE_WINDOW_MS = 60_000
export const OPS_STALE_MS = 120_000

export type CodeBridgeSummary = {
  stateDir: string
  paths: {
    ops: string
    companion: string
    companionStatus: string
  }
  ops?: Record<string, unknown>
  companion?: Record<string, unknown>
  companionStatus: { online: boolean; lastSeen?: number; name?: string }
  opsFresh: boolean
  companionFresh: boolean
  tone: "ready" | "warning" | "muted" | string
  label: string
  detail: string
}

export function resolveCodeStateDir(env: NodeJS.ProcessEnv = process.env): string {
  const home = env.ZAVORTH_HOME || env.MIMOCODE_HOME
  if (home) {
    if (!path.isAbsolute(home)) {
      throw new Error(`ZAVORTH_HOME must be absolute, got: ${JSON.stringify(home)}`)
    }
    return path.join(home, "state")
  }
  const xdg = env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state")
  return path.join(xdg, "zavorth")
}

function readJsonIfPresent(filePath: string): Record<string, unknown> | undefined {
  try {
    if (!fs.existsSync(filePath)) return undefined
    const raw = fs.readFileSync(filePath, "utf8")
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== "object") return undefined
    return data as Record<string, unknown>
  } catch {
    return undefined
  }
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const tmp = `${filePath}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8")
  fs.renameSync(tmp, filePath)
}

export function opsBridgePath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveCodeStateDir(env), "ops-bridge.json")
}

export function companionBridgePath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveCodeStateDir(env), "companion-bridge.json")
}

export function companionStatusPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveCodeStateDir(env), "companion-status.json")
}

export function isBridgeFresh(updatedAt: unknown, windowMs = OPS_STALE_MS): boolean {
  if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt)) return false
  return Date.now() - updatedAt <= windowMs
}

export function readCompanionStatus(env: NodeJS.ProcessEnv = process.env): {
  online: boolean
  lastSeen?: number
  name?: string
} {
  const raw = readJsonIfPresent(companionStatusPath(env))
  if (!raw) return { online: false }
  const lastSeen = typeof raw.lastSeen === "number" ? raw.lastSeen : undefined
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : undefined
  const online = lastSeen !== undefined && Date.now() - lastSeen <= ONLINE_WINDOW_MS
  return { online, lastSeen, name }
}

export function writeCompanionStatus(
  input: { name?: string; online?: boolean } = {},
  env: NodeJS.ProcessEnv = process.env,
): { lastSeen: number; online: boolean; name?: string } {
  const name = typeof input.name === "string" && input.name.trim() ? input.name.trim() : undefined
  const payload = {
    lastSeen: Date.now(),
    online: input.online !== false,
    ...(name ? { name } : {}),
  }
  writeJsonAtomic(companionStatusPath(env), payload)
  return payload
}

export function summarizeCodeBridge(env: NodeJS.ProcessEnv = process.env): CodeBridgeSummary {
  const stateDir = resolveCodeStateDir(env)
  const ops = readJsonIfPresent(opsBridgePath(env))
  const companion = readJsonIfPresent(companionBridgePath(env))
  const companionStatus = readCompanionStatus(env)
  const opsFresh = isBridgeFresh(ops?.updatedAt)
  const companionFresh = isBridgeFresh(companion?.updatedAt)

  let tone: CodeBridgeSummary["tone"] = "muted"
  let label = "Code offline"
  let detail = "No recent ops-bridge from Zavorth Code CLI"

  if (ops && opsFresh) {
    const approvals = Number(ops.approvals || 0)
    if (ops.ready === true) {
      tone = "ready"
      label = "Code ready"
      detail = typeof ops.headline === "string" ? ops.headline : "Zavorth Code CLI is ready"
    } else if (approvals > 0) {
      tone = "warning"
      label = approvals === 1 ? "Code · 1 approval" : `Code · ${approvals} approvals`
      detail =
        (typeof ops.nextAction === "string" && ops.nextAction) ||
        (typeof ops.headline === "string" && ops.headline) ||
        "Approvals waiting in Code"
    } else if (ops.providerReady === false) {
      tone = "warning"
      label = "Code · needs provider"
      detail =
        (typeof ops.nextAction === "string" && ops.nextAction) ||
        (typeof ops.headline === "string" && ops.headline) ||
        "Connect a provider in Code"
    } else {
      tone = "warning"
      label = "Code · not ready"
      detail =
        (typeof ops.nextAction === "string" && ops.nextAction) ||
        (typeof ops.headline === "string" && ops.headline) ||
        "See Code status"
    }
  } else if (ops && !opsFresh) {
    tone = "muted"
    label = "Code stale"
    detail = "Last ops-bridge is older than 2 minutes"
  }

  return {
    stateDir,
    paths: {
      ops: opsBridgePath(env),
      companion: companionBridgePath(env),
      companionStatus: companionStatusPath(env),
    },
    ops,
    companion,
    companionStatus,
    opsFresh,
    companionFresh,
    tone,
    label,
    detail,
  }
}
