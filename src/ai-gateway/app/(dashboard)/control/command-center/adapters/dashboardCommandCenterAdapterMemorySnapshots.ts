import type {
  DashboardAgentTeamCompilerSnapshot,
  DashboardAskBeforeAssumptionPolicySnapshot,
  DashboardArtifactMemorySnapshot,
  DashboardCapabilityNegotiationSnapshot,
  DashboardCrossChannelContinuitySnapshot,
  DashboardMemoryWithReceiptsSnapshot,
  DashboardNaturalCapabilityDiscoverySnapshot,
  DashboardPersonalOpsAutopilotSnapshot,
  DashboardProviderArenaSnapshot,
  DashboardProviderMeshConsolidationSnapshot,
  DashboardRunArtifactReceiptReplaySnapshot,
  DashboardSafetyNarrativeSnapshot,
  DashboardSelfingDashboardSnapshot,
  DashboardSkillMcpQuarantineSnapshot,
  DashboardToolRehearsalSnapshot,
  DashboardUniversalIntentTrustEnforcementSnapshot,
  DashboardUniversalPreviewModeSnapshot,
} from "../contracts";
import {
  asCommandCenterTextArray as asTextArray,
  resolveCommandCenterAgentRunMetadata as resolveAgentRunMetadata,
} from "./dashboardCommandCenterRunObservability";
import {
  asArray,
  asNumber,
  asRecord,
  asText,
  formatTimestamp,
  normalizeMemoryLayer,
  normalizeToolRisk,
  type DashboardCommandCenterAdapterInput,
  type LooseRecord,
} from "./dashboardCommandCenterAdapterShared";


function normalizeMemoryReceiptConfidenceLabel(value: unknown): DashboardMemoryWithReceiptsSnapshot["receipts"][number]["confidenceLabel"] {
  const raw = asText(value).toLowerCase();
  if (raw === "high" || raw.includes("alta")) {
    return "high";
  }
  if (raw === "low" || raw.includes("baixa")) {
    return "low";
  }
  return "medium";
}

function mapMemoryReceipt(entry: LooseRecord, index: number): DashboardMemoryWithReceiptsSnapshot["receipts"][number] {
  const origin = asRecord(entry.origin) || {};
  const actions = asRecord(entry.actions) || {};
  return {
    id: asText(entry.id, `memory-receipt-${index + 1}`),
    memoryId: asText(entry.memoryId, asText(entry.id, `memory-${index + 1}`)),
    title: asText(entry.title, "Memoria usada"),
    layer: normalizeMemoryLayer(entry.layer),
    summary: asText(entry.summary, "Fonte de memoria disponivel."),
    source: asText(entry.source, "MemoryWithReceiptsService"),
    sourceType: asText(entry.sourceType, "unknown"),
    createdAt: formatTimestamp(entry.createdAt),
    confidence: asNumber(entry.confidence) ?? 0,
    confidenceLabel: normalizeMemoryReceiptConfidenceLabel(entry.confidenceLabel),
    observatoryReceiptId: asText(entry.observatoryReceiptId) || undefined,
    origin: {
      kind: asText(origin.kind, "unknown"),
      ref: asText(origin.ref) || null,
      artifactId: asText(origin.artifactId) || undefined,
      eventId: asText(origin.eventId) || undefined,
    },
    actions: {
      reviewCommand: asText(actions.reviewCommand, "zavorth memory receipts"),
      askSourceCommand: asText(actions.askSourceCommand, "zavorth memory source"),
      forgetCommand: asText(actions.forgetCommand, "zavorth memory forget <id>"),
      correctCommand: asText(actions.correctCommand, "zavorth memory correct <id> \"<novo valor>\""),
    },
  };
}

export function buildMemoryWithReceipts(
  input: DashboardCommandCenterAdapterInput,
): DashboardMemoryWithReceiptsSnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.memoryWithReceipts)
    || asRecord(input.runtime?.memoryWithReceipts)
    || asRecord(input.state?.memoryWithReceipts)
    || asRecord(metadata?.memoryWithReceipts);
  if (!raw) {
    return null;
  }

  const identifiers = asRecord(raw.identifiers) || {};
  const summary = asRecord(raw.summary) || {};
  const audit = asRecord(raw.audit) || {};
  const surface = asRecord(raw.surface) || {};
  return {
    contractVersion: asText(raw.contractVersion, "unknown"),
    generatedAt: formatTimestamp(raw.generatedAt),
    identifiers: {
      runId: asText(identifiers.runId),
      traceId: asText(identifiers.traceId),
      requestId: asText(identifiers.requestId),
      sessionId: asText(identifiers.sessionId),
    },
    summary: {
      memoryCount: asNumber(summary.memoryCount) ?? 0,
      receiptCount: asNumber(summary.receiptCount) ?? 0,
      layers: asArray<unknown>(summary.layers).map(normalizeMemoryLayer),
      averageConfidence: asNumber(summary.averageConfidence) ?? null,
      lowConfidenceCount: asNumber(summary.lowConfidenceCount) ?? 0,
    },
    receipts: asArray<LooseRecord>(raw.receipts).map(mapMemoryReceipt).slice(0, 12),
    audit: {
      allMemoryHasReceipt: audit.allMemoryHasReceipt === true,
      canAnswerSourceQuestion: audit.canAnswerSourceQuestion === true,
      canForgetOrCorrect: audit.canForgetOrCorrect === true,
      runObservatoryLinked: audit.runObservatoryLinked === true,
      noMemoryInvented: audit.noMemoryInvented !== false,
    },
    surface: {
      cliCommand: asText(surface.cliCommand, "zavorth memory receipts --json"),
      commandCenterPath: asText(surface.commandCenterPath, "/control?sector=dreams"),
      sourceQuestionHint: asText(surface.sourceQuestionHint, "Pergunte de onde veio a memoria."),
    },
    nextSafeAction: asText(raw.nextSafeAction, "Manter receipts de memoria visiveis antes de responder."),
  };
}

function normalizeSelfingStatus(value: unknown): DashboardSelfingDashboardSnapshot["status"] {
  const raw = asText(value).toLowerCase();
  if (raw === "ready" || raw === "needs-review" || raw === "empty" || raw === "blocked") {
    return raw;
  }
  return "unknown";
}

function normalizeSelfingSection(value: unknown): DashboardSelfingDashboardSnapshot["cards"][number]["section"] {
  const raw = asText(value).toLowerCase();
  if (raw === "identity" || raw === "tone" || raw === "user" || raw === "environment" || raw === "memory" || raw === "permissions") {
    return raw;
  }
  return "identity";
}

function mapSelfingCard(entry: LooseRecord, index: number): DashboardSelfingDashboardSnapshot["cards"][number] {
  const actions = asRecord(entry.actions) || {};
  return {
    id: asText(entry.id, `selfing-card-${index + 1}`),
    section: normalizeSelfingSection(entry.section),
    title: asText(entry.title, "Card de identidade"),
    value: asText(entry.value, "Valor nao informado."),
    source: asText(entry.source, "SelfingDashboardService"),
    sourceRef: asText(entry.sourceRef) || null,
    confidence: asNumber(entry.confidence) ?? 0,
    editable: entry.editable === true,
    sensitive: entry.sensitive === true,
    previewRequired: entry.previewRequired === true,
    versioned: entry.versioned === true,
    actions: {
      reviewCommand: asText(actions.reviewCommand, "zavorth selfing review"),
      previewCommand: asText(actions.previewCommand, "zavorth selfing preview"),
      historyCommand: asText(actions.historyCommand, "zavorth selfing history"),
    },
  };
}

export function buildSelfingDashboard(
  input: DashboardCommandCenterAdapterInput,
): DashboardSelfingDashboardSnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.selfingDashboard)
    || asRecord(input.runtime?.selfingDashboard)
    || asRecord(input.state?.selfingDashboard)
    || asRecord(metadata?.selfingDashboard);
  if (!raw) {
    return null;
  }

  const identifiers = asRecord(raw.identifiers) || {};
  const identity = asRecord(raw.identity) || {};
  const summary = asRecord(raw.summary) || {};
  const policy = asRecord(raw.policy) || {};
  const surface = asRecord(raw.surface) || {};
  return {
    contractVersion: asText(raw.contractVersion, "unknown"),
    generatedAt: formatTimestamp(raw.generatedAt),
    identifiers: {
      runId: asText(identifiers.runId),
      traceId: asText(identifiers.traceId),
      requestId: asText(identifiers.requestId),
      sessionId: asText(identifiers.sessionId),
    },
    status: normalizeSelfingStatus(raw.status),
    identity: {
      agentName: asText(identity.agentName, "Zavorth"),
      userName: asText(identity.userName, "usuario"),
      workspaceName: asText(identity.workspaceName, "workspace"),
      tonePreference: asText(identity.tonePreference) || null,
      memoryMode: asText(identity.memoryMode) || null,
      safetyPosture: asText(identity.safetyPosture) || null,
      trustMode: asText(identity.trustMode, "protected"),
      providerLabel: asText(identity.providerLabel, "provider nao informado"),
      modelLabel: asText(identity.modelLabel, "modelo nao informado"),
    },
    summary: {
      cardCount: asNumber(summary.cardCount) ?? 0,
      identityFileCount: asNumber(summary.identityFileCount) ?? 0,
      editableCardCount: asNumber(summary.editableCardCount) ?? 0,
      sensitiveCardCount: asNumber(summary.sensitiveCardCount) ?? 0,
      memoryReceiptCount: asNumber(summary.memoryReceiptCount) ?? 0,
      lowConfidenceMemoryCount: asNumber(summary.lowConfidenceMemoryCount) ?? 0,
      knownToolCount: asNumber(summary.knownToolCount) ?? 0,
      pendingApprovalCount: asNumber(summary.pendingApprovalCount) ?? 0,
      updateSuggestionCount: asNumber(summary.updateSuggestionCount) ?? 0,
      versionedChangesRequired: summary.versionedChangesRequired === true,
    },
    cards: asArray<LooseRecord>(raw.cards).map(mapSelfingCard).slice(0, 16),
    suggestions: asArray<LooseRecord>(raw.suggestions).map((suggestion, index) => ({
      id: asText(suggestion.id, `selfing-suggestion-${index + 1}`),
      section: normalizeSelfingSection(suggestion.section),
      title: asText(suggestion.title, "Sugestao de selfing"),
      detail: asText(suggestion.detail, "Detalhe nao informado."),
      reason: asText(suggestion.reason, "Melhorar identidade/memoria revisavel."),
      sensitive: suggestion.sensitive === true,
      previewCommand: asText(suggestion.previewCommand, "zavorth selfing preview"),
    })).slice(0, 12),
    receipts: asArray<LooseRecord>(raw.receipts).map((receipt, index) => {
      const status = asText(receipt.status).toLowerCase();
      return {
        id: asText(receipt.id, `selfing-receipt-${index + 1}`),
        kind: asText(receipt.kind, "policy"),
        source: asText(receipt.source, "SelfingDashboardService"),
        detail: asText(receipt.detail, "Receipt de selfing."),
        status: (status === "needs-review" || status === "missing" ? status : "ready") as "missing" | "ready" | "needs-review",
      };
    }).slice(0, 16),
    policy: {
      readOnlySnapshot: policy.readOnlySnapshot === true,
      noIdentityChanged: policy.noIdentityChanged === true,
      noMemoryChanged: policy.noMemoryChanged === true,
      noConfigChanged: policy.noConfigChanged === true,
      changesRequirePreview: policy.changesRequirePreview === true,
      changesAreVersioned: policy.changesAreVersioned === true,
      sensitiveChangesRequireApproval: policy.sensitiveChangesRequireApproval === true,
      memoryCorrectionsUseReceipts: policy.memoryCorrectionsUseReceipts === true,
      secretsSerialized: policy.secretsSerialized === true,
    },
    surface: {
      cliCommand: asText(surface.cliCommand, "zavorth selfing --json"),
      commandCenterPath: asText(surface.commandCenterPath, "/control?sector=dreams"),
      previewHint: asText(surface.previewHint, "Edicoes sensiveis precisam de preview."),
      versioningHint: asText(surface.versioningHint, "Mudancas sao versionadas."),
    },
    nextSafeAction: asText(raw.nextSafeAction, "Revisar identidade e memoria sem executar mutacoes."),
  };
}

function normalizeArtifactMemoryStatus(value: unknown): DashboardArtifactMemorySnapshot["status"] {
  const raw = asText(value).toLowerCase();
  if (raw === "ready" || raw === "needs-index" || raw === "empty" || raw === "blocked") {
    return raw;
  }
  return "unknown";
}

function normalizeArtifactMemoryCategory(value: unknown): DashboardArtifactMemorySnapshot["entries"][number]["category"] {
  const raw = asText(value).toLowerCase();
  if (
    raw === "plan"
    || raw === "diff"
    || raw === "report"
    || raw === "spec"
    || raw === "decision"
    || raw === "execution"
    || raw === "prompt"
    || raw === "release"
    || raw === "run-summary"
    || raw === "file"
    || raw === "log"
    || raw === "handoff"
    || raw === "unknown"
  ) {
    return raw;
  }
  return "unknown";
}

function normalizeArtifactMemoryImportance(value: unknown): DashboardArtifactMemorySnapshot["entries"][number]["importance"] {
  const raw = asText(value).toLowerCase();
  if (raw === "high" || raw === "medium" || raw === "low") {
    return raw;
  }
  return "low";
}

function mapArtifactMemoryEntry(entry: LooseRecord, index: number): DashboardArtifactMemorySnapshot["entries"][number] {
  const receipt = asRecord(entry.receipt) || {};
  const actions = asRecord(entry.actions) || {};
  return {
    id: asText(entry.id, `artifact-memory-entry-${index + 1}`),
    artifactId: asText(entry.artifactId, `artifact-${index + 1}`),
    memoryId: asText(entry.memoryId, `artifact-memory:${asText(entry.artifactId, `artifact-${index + 1}`)}`),
    title: asText(entry.title, "Artifact indexado"),
    kind: asText(entry.kind, "file"),
    category: normalizeArtifactMemoryCategory(entry.category),
    status: asText(entry.status, "ready"),
    createdAt: formatTimestamp(entry.createdAt),
    runId: asText(entry.runId),
    traceId: asText(entry.traceId),
    sessionId: asText(entry.sessionId),
    projectRef: asText(entry.projectRef) || null,
    taskRef: asText(entry.taskRef) || null,
    summary: asText(entry.summary, "Resumo nao informado."),
    searchableText: asText(entry.searchableText),
    tags: asTextArray(entry.tags) ?? [],
    importance: normalizeArtifactMemoryImportance(entry.importance),
    reusable: entry.reusable !== false,
    receipt: {
      observatoryReceiptId: asText(receipt.observatoryReceiptId) || null,
      memoryReceiptId: asText(receipt.memoryReceiptId) || null,
      source: asText(receipt.source, "artifact-ledger"),
    },
    actions: {
      openCommand: asText(actions.openCommand, "zavorth artifacts open <artifactId>"),
      rememberCommand: asText(actions.rememberCommand, "zavorth artifact-memory remember <artifactId>"),
      reuseCommand: asText(actions.reuseCommand, "zavorth artifact-memory reuse <artifactId>"),
      citeCommand: asText(actions.citeCommand, "zavorth artifact-memory cite <artifactId>"),
      forgetCommand: asText(actions.forgetCommand, "zavorth artifact-memory forget <memoryId>"),
    },
  };
}

export function buildArtifactMemory(
  input: DashboardCommandCenterAdapterInput,
): DashboardArtifactMemorySnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.artifactMemory)
    || asRecord(input.runtime?.artifactMemory)
    || asRecord(input.state?.artifactMemory)
    || asRecord(metadata?.artifactMemory);
  if (!raw) {
    return null;
  }

  const identifiers = asRecord(raw.identifiers) || {};
  const summary = asRecord(raw.summary) || {};
  const search = asRecord(raw.search) || {};
  const commands = asRecord(search.commands) || {};
  const policy = asRecord(raw.policy) || {};
  const surface = asRecord(raw.surface) || {};
  return {
    contractVersion: asText(raw.contractVersion, "unknown"),
    generatedAt: formatTimestamp(raw.generatedAt),
    identifiers: {
      runId: asText(identifiers.runId),
      traceId: asText(identifiers.traceId),
      requestId: asText(identifiers.requestId),
      sessionId: asText(identifiers.sessionId),
    },
    status: normalizeArtifactMemoryStatus(raw.status),
    summary: {
      artifactCount: asNumber(summary.artifactCount) ?? 0,
      memoryEntryCount: asNumber(summary.memoryEntryCount) ?? 0,
      reusableCount: asNumber(summary.reusableCount) ?? 0,
      readyArtifactCount: asNumber(summary.readyArtifactCount) ?? 0,
      runSummaryIndexed: summary.runSummaryIndexed === true,
      receiptCount: asNumber(summary.receiptCount) ?? 0,
      linkedMemoryReceiptCount: asNumber(summary.linkedMemoryReceiptCount) ?? 0,
      runObservatoryLinked: summary.runObservatoryLinked === true,
      searchReady: summary.searchReady === true,
      indexedCategories: asArray(summary.indexedCategories).map(normalizeArtifactMemoryCategory),
    },
    entries: asArray<LooseRecord>(raw.entries).map(mapArtifactMemoryEntry).slice(0, 16),
    search: {
      queryHints: (asTextArray(search.queryHints) ?? []).slice(0, 12),
      facets: asArray<LooseRecord>(search.facets).map((facet, index) => ({
        id: asText(facet.id, `artifact-memory-facet-${index + 1}`),
        label: asText(facet.label, "unknown"),
        count: asNumber(facet.count) ?? 0,
      })).slice(0, 12),
      commands: {
        searchCommand: asText(commands.searchCommand, "zavorth artifact-memory search \"<termo>\" --json"),
        latestCommand: asText(commands.latestCommand, "zavorth artifact-memory latest --json"),
        byRunCommand: asText(commands.byRunCommand, "zavorth artifact-memory run <runId> --json"),
      },
    },
    receipts: asArray<LooseRecord>(raw.receipts).map((receipt, index) => {
      const status = asText(receipt.status).toLowerCase();
      return {
        id: asText(receipt.id, `artifact-memory-receipt-${index + 1}`),
        kind: asText(receipt.kind, "policy"),
        source: asText(receipt.source, "ArtifactMemoryService"),
        artifactId: asText(receipt.artifactId) || undefined,
        detail: asText(receipt.detail, "Receipt de artifact memory."),
        status: (status === "needs-index" || status === "missing" ? status : "ready") as "missing" | "ready" | "needs-index",
        observatoryReceiptId: asText(receipt.observatoryReceiptId) || undefined,
      };
    }).slice(0, 20),
    policy: {
      noArtifactContentInvented: policy.noArtifactContentInvented === true,
      noFilesystemReadPerformed: policy.noFilesystemReadPerformed === true,
      noArtifactMutation: policy.noArtifactMutation === true,
      memoryWriteNotPerformed: policy.memoryWriteNotPerformed === true,
      promotionRequiresExplicitAction: policy.promotionRequiresExplicitAction === true,
      reusedArtifactMustCiteOrigin: policy.reusedArtifactMustCiteOrigin === true,
      secretsSerialized: policy.secretsSerialized === true,
    },
    surface: {
      cliCommand: asText(surface.cliCommand, "zavorth artifact-memory --json"),
      commandCenterPath: asText(surface.commandCenterPath, "/control?sector=dreams"),
      searchHint: asText(surface.searchHint, "Pesquise artifacts por tarefa, projeto, data ou categoria."),
      reuseHint: asText(surface.reuseHint, "Reuso exige citacao de origem."),
    },
    nextSafeAction: asText(raw.nextSafeAction, "Indexar artifacts e reutilizar apenas com origem citavel."),
  };
}

function normalizePersonalOpsStatus(value: unknown): DashboardPersonalOpsAutopilotSnapshot["status"] {
  const raw = asText(value).toLowerCase();
  if (raw === "idle" || raw === "suggesting" || raw === "waiting-approval" || raw === "blocked") {
    return raw;
  }
  return "unknown";
}

function normalizePersonalOpsCategory(value: unknown): DashboardPersonalOpsAutopilotSnapshot["suggestions"][number]["category"] {
  const raw = asText(value).toLowerCase();
  if (
    raw === "provider"
    || raw === "budget"
    || raw === "memory"
    || raw === "artifact-memory"
    || raw === "capability"
    || raw === "skill"
    || raw === "watch-mode"
    || raw === "node-mesh"
    || raw === "channel"
    || raw === "safety"
    || raw === "runtime"
    || raw === "automation"
  ) {
    return raw;
  }
  return "runtime";
}

function normalizePersonalOpsSeverity(value: unknown): DashboardPersonalOpsAutopilotSnapshot["suggestions"][number]["severity"] {
  const raw = asText(value).toLowerCase();
  if (raw === "danger" || raw === "warning" || raw === "info") {
    return raw;
  }
  return "info";
}

function mapPersonalOpsSuggestion(entry: LooseRecord, index: number): DashboardPersonalOpsAutopilotSnapshot["suggestions"][number] {
  const actions = asRecord(entry.actions) || {};
  return {
    id: asText(entry.id, `personal-ops-suggestion-${index + 1}`),
    category: normalizePersonalOpsCategory(entry.category),
    title: asText(entry.title, "Sugestao operacional"),
    cause: asText(entry.cause, "Causa nao informada."),
    impact: asText(entry.impact, "Impacto nao informado."),
    nextStep: asText(entry.nextStep, "Revisar em modo preview."),
    severity: normalizePersonalOpsSeverity(entry.severity),
    confidence: asNumber(entry.confidence) ?? 0,
    requiresApproval: entry.requiresApproval === true,
    previewAvailable: entry.previewAvailable !== false,
    mutableAction: entry.mutableAction === true,
    evidence: asArray<LooseRecord>(entry.evidence).map((evidence, evidenceIndex) => ({
      source: asText(evidence.source, "runtime"),
      ref: asText(evidence.ref) || null,
      detail: asText(evidence.detail, `evidencia ${evidenceIndex + 1}`),
      receiptId: asText(evidence.receiptId) || undefined,
    })).slice(0, 6),
    relatedArtifactIds: (asTextArray(entry.relatedArtifactIds) || []).slice(0, 8),
    relatedToolIds: (asTextArray(entry.relatedToolIds) || []).slice(0, 8),
    actions: {
      previewCommand: asText(actions.previewCommand, "zavorth personal-ops preview <id>"),
      approvalCommand: asText(actions.approvalCommand, "zavorth personal-ops review <id>"),
      runCommand: asText(actions.runCommand, "zavorth personal-ops inspect <id>"),
      dismissCommand: asText(actions.dismissCommand, "zavorth personal-ops dismiss <id>"),
    },
  };
}

export function buildPersonalOpsAutopilot(
  input: DashboardCommandCenterAdapterInput,
): DashboardPersonalOpsAutopilotSnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.personalOpsAutopilot)
    || asRecord(input.runtime?.personalOpsAutopilot)
    || asRecord(input.state?.personalOpsAutopilot)
    || asRecord(metadata?.personalOpsAutopilot);
  if (!raw) {
    return null;
  }

  const identifiers = asRecord(raw.identifiers) || {};
  const summary = asRecord(raw.summary) || {};
  const policy = asRecord(raw.policy) || {};
  const surface = asRecord(raw.surface) || {};
  return {
    contractVersion: asText(raw.contractVersion, "unknown"),
    generatedAt: formatTimestamp(raw.generatedAt),
    identifiers: {
      runId: asText(identifiers.runId),
      traceId: asText(identifiers.traceId),
      requestId: asText(identifiers.requestId),
      sessionId: asText(identifiers.sessionId),
    },
    status: normalizePersonalOpsStatus(raw.status),
    summary: {
      suggestionCount: asNumber(summary.suggestionCount) ?? 0,
      attentionCount: asNumber(summary.attentionCount) ?? 0,
      approvalRequiredCount: asNumber(summary.approvalRequiredCount) ?? 0,
      previewAvailableCount: asNumber(summary.previewAvailableCount) ?? 0,
      mutableActionCount: asNumber(summary.mutableActionCount) ?? 0,
      providerIssueCount: asNumber(summary.providerIssueCount) ?? 0,
      budgetIssueCount: asNumber(summary.budgetIssueCount) ?? 0,
      artifactOpportunityCount: asNumber(summary.artifactOpportunityCount) ?? 0,
      naturalIntentObserved: summary.naturalIntentObserved === true,
      runObservatoryLinked: summary.runObservatoryLinked === true,
    },
    suggestions: asArray<LooseRecord>(raw.suggestions).map(mapPersonalOpsSuggestion).slice(0, 12),
    receipts: asArray<LooseRecord>(raw.receipts).map((receipt, index) => {
      const status = asText(receipt.status).toLowerCase();
      return {
        id: asText(receipt.id, `personal-ops-receipt-${index + 1}`),
        kind: asText(receipt.kind, "policy"),
        source: asText(receipt.source, "PersonalOpsAutopilotService"),
        detail: asText(receipt.detail, "Receipt de autopilot."),
        status: (status === "needs-review" || status === "missing" ? status : "ready") as "missing" | "ready" | "needs-review",
      };
    }).slice(0, 20),
    policy: {
      noMutableActionExecuted: policy.noMutableActionExecuted === true,
      noAutorepairStarted: policy.noAutorepairStarted === true,
      approvalsRequiredForMutation: policy.approvalsRequiredForMutation === true,
      previewBeforeAutorepair: policy.previewBeforeAutorepair === true,
      naturalLanguageDoesNotBypassPolicy: policy.naturalLanguageDoesNotBypassPolicy === true,
      usesReceiptsForSuggestions: policy.usesReceiptsForSuggestions === true,
      secretsSerialized: policy.secretsSerialized === true,
    },
    surface: {
      cliCommand: asText(surface.cliCommand, "zavorth personal-ops --json"),
      commandCenterPath: asText(surface.commandCenterPath, "/control?sector=overview"),
      previewHint: asText(surface.previewHint, "Use preview antes de reparar."),
      approvalHint: asText(surface.approvalHint, "Mutacoes exigem approval."),
    },
    nextSafeAction: asText(raw.nextSafeAction, "Revisar sugestoes operacionais em modo read-only."),
  };
}
