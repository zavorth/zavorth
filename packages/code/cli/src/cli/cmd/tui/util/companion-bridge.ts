import path from "path"
import { Global } from "@/global"
import { Filesystem } from "@/util"

export type CompanionBridgePayload = {
  version: 1
  updatedAt: number
  product: "zavorth-code"
  pulse?: {
    headline: string
    ready: boolean
    approvals: number
    sessions: number
  }
  lastSessionId?: string
  lastSessionTitle?: string
}

export type CompanionStatus = {
  online: boolean
  lastSeen?: number
  name?: string
}

const ONLINE_WINDOW_MS = 60_000

const BRIDGE_FILE = () => path.join(Global.Path.state, "companion-bridge.json")
const STATUS_FILE = () => path.join(Global.Path.state, "companion-status.json")

export function companionBridgePath(): string {
  return BRIDGE_FILE()
}

export function companionStatusPath(): string {
  return STATUS_FILE()
}

export async function writeCompanionBridge(payload: CompanionBridgePayload): Promise<void> {
  await Filesystem.writeJson(BRIDGE_FILE(), payload)
}

export async function readCompanionStatus(): Promise<CompanionStatus> {
  try {
    const text = await Filesystem.readText(STATUS_FILE())
    const data = JSON.parse(text) as {
      lastSeen?: unknown
      name?: unknown
      online?: unknown
    }
    const lastSeen = typeof data.lastSeen === "number" ? data.lastSeen : undefined
    const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : undefined
    const online = lastSeen !== undefined && Date.now() ? lastSeen <= ONLINE_WINDOW_MS
    return { online, lastSeen, name }
  } catch {
    return { online: false }
  }
}
