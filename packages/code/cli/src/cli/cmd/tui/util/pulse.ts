export type PulseSnapshot = {
  ready: boolean
  headline: string // short status line
  nextAction: string // one recommended action
  approvals: number
  sessions: number
  mcpConnected: number
  mcpTotal: number
  agents: number
  providerReady: boolean
  modelLabel: string
  workspace: string
  branch?: string
}

export function buildPulse(input: {
  sessions: Array<{ parentID?: string | null }>
  permissionsBySession: Record<string, unknown[] | undefined>
  mcp: Record<string, { status: string }>
  agentsCount: number
  providerReady: boolean
  modelLabel: string
  workspace: string
  branch?: string
  copy: {
    ready: string
    needsProvider: string
    needsApproval: string
    nextChat: string
    nextConnect: string
    nextApprove: string
    firstLight: string
  }
}): PulseSnapshot {
  let approvals = 0
  for (const list of Object.values(input.permissionsBySession)) {
    if (list) approvals += list.length
  }

  const sessions = input.sessions.filter((s) => !s.parentID).length

  const mcpEntries = Object.values(input.mcp)
  const mcpTotal = mcpEntries.length
  const mcpConnected = mcpEntries.filter((m) => m.status === "connected").length

  const { providerReady } = input
  const ready = providerReady && approvals === 0

  let headline: string
  if (!providerReady) {
    headline = input.copy.needsProvider
  } else if (approvals > 0) {
    headline = input.copy.needsApproval
  } else if (sessions === 0) {
    headline = input.copy.firstLight
  } else {
    headline = input.copy.ready
  }

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
    headline,
    nextAction,
    approvals,
    sessions,
    mcpConnected,
    mcpTotal,
    agents: input.agentsCount,
    providerReady,
    modelLabel: input.modelLabel,
    workspace: input.workspace,
    branch: input.branch,
  }
}
