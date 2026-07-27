import path from "path"
import { Global } from "@/global"
import { Filesystem } from "@/util"
import { hostRuntimeOpsCheck } from "@/util/host-runtime"

export type OpsCheck = {
  id: string
  ok: boolean
  label: string
  detail?: string
}

export type OpsSnapshot = {
  ready: boolean
  checks: OpsCheck[]
  approvals: number
  sessions: number
  headline: string
  nextAction: string
}

/** Versioned file payload written next to companion-bridge.json under Global.Path.state. */
export type OpsBridgePayload = {
  version: 1
  updatedAt: number
  product: "zavorth-code"
  ready: boolean
  headline: string
  nextAction: string
  approvals: number
  sessions: number
  checks: OpsCheck[]
  providerReady: boolean
  modelLabel?: string
  mcpConnected?: number
  mcpTotal?: number
}

const BRIDGE_FILE = () => path.join(Global.Path.state, "ops-bridge.json")

export function opsBridgePath(): string {
  return BRIDGE_FILE()
}

export async function writeOpsBridge(payload: OpsBridgePayload): Promise<void> {
  await Filesystem.writeJson(BRIDGE_FILE(), payload)
}

/** Best-effort local debug reader. Returns undefined when missing or invalid. */
export async function readOpsBridge(): Promise<OpsBridgePayload | undefined> {
  try {
    const text = await Filesystem.readText(BRIDGE_FILE())
    const data = JSON.parse(text) as Partial<OpsBridgePayload>
    if (data.version !== 1) return undefined
    if (data.product !== "zavorth-code") return undefined
    if (typeof data.updatedAt !== "number") return undefined
    if (typeof data.ready !== "boolean") return undefined
    if (typeof data.headline !== "string") return undefined
    if (typeof data.nextAction !== "string") return undefined
    if (typeof data.approvals !== "number") return undefined
    if (typeof data.sessions !== "number") return undefined
    if (!Array.isArray(data.checks)) return undefined
    if (typeof data.providerReady !== "boolean") return undefined
    return data as OpsBridgePayload
  } catch {
    return undefined
  }
}

/** Build a versioned bridge payload from a live OpsSnapshot + provider/MCP fields. */
export function toOpsBridgePayload(input: {
  snapshot: OpsSnapshot
  providerReady: boolean
  modelLabel?: string
  mcpConnected?: number
  mcpTotal?: number
  updatedAt?: number
}): OpsBridgePayload {
  return {
    version: 1,
    updatedAt: input.updatedAt ?? Date.now(),
    product: "zavorth-code",
    ready: input.snapshot.ready,
    headline: input.snapshot.headline,
    nextAction: input.snapshot.nextAction,
    approvals: input.snapshot.approvals,
    sessions: input.snapshot.sessions,
    checks: input.snapshot.checks,
    providerReady: input.providerReady,
    modelLabel: input.modelLabel,
    mcpConnected: input.mcpConnected,
    mcpTotal: input.mcpTotal,
  }
}

export function latestRootSession(
  sessions: Array<{ parentID?: string | null; id: string; time?: { updated?: number }; title?: string }>,
): { id: string; title: string; updated?: number } | undefined {
  const roots = sessions
    .filter((s) => !s.parentID)
    .slice()
    .sort((a, b) => (b.time?.updated ?? 0) ? (a.time?.updated ?? 0))
  const top = roots[0]
  if (!top) return undefined
  return {
    id: top.id,
    title: top.title ?? top.id,
    updated: top.time?.updated,
  }
}

export function buildOpsSnapshot(input: {
  providerReady: boolean
  providerLabel?: string
  modelLabel?: string
  mcp: Record<string, { status: string }>
  lspCount: number
  permissionsBySession: Record<string, unknown[] | undefined>
  sessions: Array<{ parentID?: string | null; id?: string; title?: string; time?: { updated?: number } }>
  copy: {
    providerOk: string
    providerMissing: string
    mcpOk: string
    mcpPartial: string
    mcpNone: string
    lspOk: string
    lspNone: string
    approvalsOk: string
    approvalsPending: string
    sessionsOk: string
    sessionsNone: string
    readyYes: string
    readyNo: string
    nextConnect: string
    nextApprove: string
    nextChat: string
  }
}): OpsSnapshot {
  let approvals = 0
  for (const list of Object.values(input.permissionsBySession)) {
    if (list) approvals += list.length
  }

  const sessions = input.sessions.filter((s) => !s.parentID).length

  const mcpEntries = Object.values(input.mcp)
  const mcpTotal = mcpEntries.length
  const mcpConnected = mcpEntries.filter((m) => m.status === "connected").length
  const mcpAllConnected = mcpTotal > 0 && mcpConnected === mcpTotal

  const { providerReady } = input
  const ready = providerReady && approvals === 0

  const providerDetail =
    providerReady && (input.providerLabel || input.modelLabel)
      ? [input.providerLabel, input.modelLabel].filter(Boolean).join(" · ")
      : undefined

  let mcpCheck: OpsCheck
  if (mcpTotal === 0) {
    mcpCheck = { id: "mcp", ok: true, label: input.copy.mcpNone }
  } else if (mcpAllConnected) {
    mcpCheck = {
      id: "mcp",
      ok: true,
      label: input.copy.mcpOk,
      detail: `${mcpConnected}/${mcpTotal}`,
    }
  } else {
    mcpCheck = {
      id: "mcp",
      ok: false,
      label: input.copy.mcpPartial,
      detail: `${mcpConnected}/${mcpTotal}`,
    }
  }

  const checks: OpsCheck[] = [
    {
      id: "provider",
      ok: providerReady,
      label: providerReady ? input.copy.providerOk : input.copy.providerMissing,
      detail: providerDetail,
    },
    mcpCheck,
    {
      id: "lsp",
      ok: true,
      label: input.lspCount > 0 ? input.copy.lspOk : input.copy.lspNone,
      detail: input.lspCount > 0 ? String(input.lspCount) : undefined,
    },
    {
      id: "approvals",
      ok: approvals === 0,
      label: approvals === 0 ? input.copy.approvalsOk : input.copy.approvalsPending,
    },
    {
      id: "sessions",
      ok: sessions > 0,
      label: sessions > 0 ? input.copy.sessionsOk : input.copy.sessionsNone,
    },
  ]

  // Best-effort monorepo runtime row when hosted from monorepo entry.
  // Does not change ops-bridge schema version or required Control/Desktop fields.
  try {
    const mono = hostRuntimeOpsCheck()
    if (mono) checks.push(mono)
  } catch {
    // ignore — never break TUI ops snapshot
  }

  const headline = ready ? input.copy.readyYes : input.copy.readyNo

  let nextAction: string
  if (!providerReady) {
    nextAction = input.copy.nextConnect
  } else if (approvals > 0) {
    nextAction = input.copy.nextApprove
  } else {
    nextAction = input.copy.nextChat
  }

  return {
    ready,
    checks,
    approvals,
    sessions,
    headline,
    nextAction,
  }
}
