/** Checklist + actionable steps for bare-entry / runtime repair. */

export type RepairHintId = "no_provider" | "no_model" | "trust" | "mcp_failed"

export type RepairStepId = RepairHintId | "all_clear" | "dismiss"

export type RepairAction = "connect" | "model" | "mcp" | "dismiss" | "none"

export type RepairHintCopy = {
  noProvider: string
  noModel: string
  trust: string
  mcpFailed: string
  allClear: string
  footer: string
}

export type RepairChecklistCopy = RepairHintCopy & {
  providerOk: string
  modelOk: string
  mcpOk: string
  actionConnect: string
  actionModel: string
  actionMcp: string
  actionDismiss: string
  statusOk: string
  statusNeedsFix: string
}

export type RepairStep = {
  id: RepairStepId
  ok: boolean
  action: RepairAction
  label: string
  description?: string
}

/** Detect bare-entry readiness once providers/model/MCP are known. */
export type BareEntryState = "no_provider" | "no_model" | "needs_repair" | "ok"

export function detectBareEntryState(input: {
  providerCount: number
  hasModel: boolean
  mcpFailed: boolean
}): BareEntryState {
  if (input.providerCount === 0) return "no_provider"
  if (!input.hasModel) return "no_model"
  if (input.mcpFailed) return "needs_repair"
  return "ok"
}

/** Structured steps for the guided repair dialog (status + actions). */
export function buildRepairChecklist(input: {
  providerReady: boolean
  hasModel: boolean
  mcpFailed: boolean
  copy: RepairChecklistCopy
}): RepairStep[] {
  const steps: RepairStep[] = []

  if (!input.providerReady) {
    steps.push({
      id: "no_provider",
      ok: false,
      action: "connect",
      label: input.copy.noProvider,
      description: input.copy.actionConnect,
    })
  } else {
    steps.push({
      id: "no_provider",
      ok: true,
      action: "none",
      label: input.copy.providerOk,
      description: input.copy.statusOk,
    })
  }

  if (input.providerReady && !input.hasModel) {
    steps.push({
      id: "no_model",
      ok: false,
      action: "model",
      label: input.copy.noModel,
      description: input.copy.actionModel,
    })
  }

  if (input.providerReady && input.hasModel) {
    steps.push({
      id: "no_model",
      ok: true,
      action: "none",
      label: input.copy.modelOk,
      description: input.copy.statusOk,
    })
  }

  if (input.mcpFailed) {
    steps.push({
      id: "mcp_failed",
      ok: false,
      action: "mcp",
      label: input.copy.mcpFailed,
      description: input.copy.actionMcp,
    })
  } else {
    steps.push({
      id: "mcp_failed",
      ok: true,
      action: "none",
      label: input.copy.mcpOk,
      description: input.copy.statusOk,
    })
  }

  const needsFix = steps.some((s) => !s.ok)
  if (needsFix) {
    steps.push({
      id: "trust",
      ok: true,
      action: "none",
      label: input.copy.trust,
      description: input.copy.statusOk,
    })
  }

  if (!needsFix) {
    steps.push({
      id: "all_clear",
      ok: true,
      action: "dismiss",
      label: input.copy.allClear,
      description: input.copy.footer,
    })
    return steps
  }

  steps.push({
    id: "dismiss",
    ok: true,
    action: "dismiss",
    label: input.copy.actionDismiss,
    description: input.copy.footer,
  })
  return steps
}

/** Legacy string checklist for passive alerts. */
export function buildRepairSteps(input: {
  providerReady: boolean
  hasModel: boolean
  mcpFailed: boolean
  copy: RepairHintCopy
}): string[] {
  const steps: string[] = []

  if (!input.providerReady) steps.push(input.copy.noProvider)
  // Model only when a provider is linked but nothing is selected
  if (input.providerReady && !input.hasModel) steps.push(input.copy.noModel)
  if (input.mcpFailed) steps.push(input.copy.mcpFailed)

  // Trust is a common pre-TUI failure mode; surface as hygiene when anything is wrong
  if (steps.length > 0) {
    steps.push(input.copy.trust)
  } else {
    steps.push(input.copy.allClear)
  }

  steps.push(input.copy.footer)
  return steps
}

/** Format steps as a quiet bullet list for DialogAlert. */
export function formatRepairMessage(steps: string[]): string {
  return steps.map((s) => `· ${s}`).join("\n")
}

/** True when any MCP entry is not connected (failed / disabled / connecting stuck). */
export function mcpHasFailure(mcp: Record<string, { status: string }>): boolean {
  const entries = Object.values(mcp)
  if (entries.length === 0) return false
  return entries.some((m) => m.status !== "connected")
}
