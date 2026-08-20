import type {
  UniversalAgentRun,
  UniversalMemorySignal,
  UniversalToolRiskLevel,
} from './UniversalAgentRuntimeTypes.js';
import {
  normalizeText,
  normalizeKey,
  recordOrNull,
  listRecords,
  listStrings,
  clampConfidence,
  redactAndShorten,
  normalizeMemoryLayer,
  normalizeRisk,
  sourceRefFromIdentityFile,
  sectionFromIdentityFile,
  titleFromIdentityFile,
  cardActions,
  uniqueCards,
  type LooseRecord,
} from './AgentSelfConfigHelpers.js';

export const AGENT_SELF_CONFIG_CONTRACT_VERSION = '2026-05-03.agent-self-config' as const;
export const SELFING_ZAVORTH_CONTROL_CONTRACT_VERSION = AGENT_SELF_CONFIG_CONTRACT_VERSION;

export type AgentSelfConfigStatus = 'ready' | 'needs-review' | 'empty' | 'blocked';
export type SelfingZavorthControlStatus = AgentSelfConfigStatus;

export type AgentSelfConfigSectionId =
  | 'identity'
  | 'tone'
  | 'user'
  | 'environment'
  | 'memory'
  | 'permissions';
export type SelfingZavorthControlSectionId = AgentSelfConfigSectionId;

export type AgentSelfConfigCard = {
  id: string;
  section: AgentSelfConfigSectionId;
  title: string;
  value: string;
  source: string;
  sourceRef: string | null;
  confidence: number;
  editable: boolean;
  sensitive: boolean;
  previewRequired: boolean;
  versioned: boolean;
  actions: {
    reviewCommand: string;
    previewCommand: string;
    historyCommand: string;
  };
};
export type SelfingZavorthControlCard = AgentSelfConfigCard;

export type AgentSelfConfigSuggestion = {
  id: string;
  section: AgentSelfConfigSectionId;
  title: string;
  detail: string;
  reason: string;
  sensitive: boolean;
  previewCommand: string;
};
export type SelfingZavorthControlSuggestion = AgentSelfConfigSuggestion;

export type AgentSelfConfigReceipt = {
  id: string;
  kind:
    | 'identity-file'
    | 'workspace-profile'
    | 'memory-receipt'
    | 'trust'
    | 'tool-exposure'
    | 'provider'
    | 'policy'
    | 'surface';
  source: string;
  detail: string;
  status: 'ready' | 'needs-review' | 'missing';
};
export type SelfingZavorthControlReceipt = AgentSelfConfigReceipt;

export type AgentSelfConfigSnapshot = {
  contractVersion: typeof AGENT_SELF_CONFIG_CONTRACT_VERSION;
  source: 'AgentSelfConfigService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: AgentSelfConfigStatus;
  identity: {
    agentName: string;
    userName: string;
    workspaceName: string;
    tonePreference: string | null;
    memoryMode: string | null;
    safetyPosture: string | null;
    trustMode: string;
    providerLabel: string;
    modelLabel: string;
  };
  summary: {
    cardCount: number;
    identityFileCount: number;
    editableCardCount: number;
    sensitiveCardCount: number;
    memoryReceiptCount: number;
    lowConfidenceMemoryCount: number;
    knownToolCount: number;
    pendingApprovalCount: number;
    updateSuggestionCount: number;
    versionedChangesRequired: boolean;
  };
  cards: AgentSelfConfigCard[];
  suggestions: AgentSelfConfigSuggestion[];
  receipts: AgentSelfConfigReceipt[];
  policy: {
    readOnlySnapshot: true;
    noIdentityChanged: true;
    noMemoryChanged: true;
    noConfigChanged: true;
    changesRequirePreview: true;
    changesAreVersioned: true;
    sensitiveChangesRequireApproval: true;
    memoryCorrectionsUseReceipts: true;
    secretsSerialized: false;
  };
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
    previewHint: string;
    versioningHint: string;
  };
  nextSafeAction: string;
};
export type SelfingZavorthControlSnapshot = AgentSelfConfigSnapshot;

export type AgentSelfConfigInput = {
  run: UniversalAgentRun;
  generatedAt?: string | null;
};
export type SelfingZavorthControlInput = AgentSelfConfigInput;

export class AgentSelfConfigService {
  private readonly now: () => Date;

  constructor(options: { now?: () => Date } = {}) {
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(input: AgentSelfConfigInput): AgentSelfConfigSnapshot {
    const { run } = input;
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const metadata = run.metadata || {};
    const canonicalContext = recordOrNull(metadata.canonicalContext);
    const warm = recordOrNull(canonicalContext?.warm);
    const cold = recordOrNull(canonicalContext?.cold);
    const workspaceProfile = this.resolveWorkspaceProfile(metadata, canonicalContext, warm);
    const identityFiles = this.resolveIdentityFiles(metadata, warm, workspaceProfile);
    const memoryWithReceipts = recordOrNull(metadata.memoryWithReceipts);
    const identity = this.buildIdentity(run, metadata, canonicalContext, workspaceProfile);

    const cards = uniqueCards([
      ...this.buildIdentityFileCards(identityFiles),
      ...this.buildProfileCards(identity, workspaceProfile),
      ...this.buildMemoryCards(run, memoryWithReceipts, cold),
      ...this.buildEnvironmentCards(run, metadata, workspaceProfile),
      ...this.buildPermissionCards(run, metadata),
    ]);

    const suggestions = this.buildSuggestions({
      run,
      identity,
      identityFileCount: identityFiles.length,
      memoryWithReceipts,
      workspaceProfile,
    });

    const receipts = this.buildReceipts({
      run,
      metadata,
      canonicalContext,
      identityFiles,
      workspaceProfile,
      memoryWithReceipts,
    });

    const lowConfidenceMemoryCount = this.lowConfidenceMemoryCount(memoryWithReceipts, run.memorySignals);
    const pendingApprovalCount = run.approvals.filter((approval) => approval.status === 'pending').length;
    const status = this.resolveStatus({
      cards,
      suggestions,
      pendingApprovalCount,
      lowConfidenceMemoryCount,
      metadata,
      run,
    });

    return {
      contractVersion: AGENT_SELF_CONFIG_CONTRACT_VERSION,
      source: 'AgentSelfConfigService',
      generatedAt,
      identifiers: {
        runId: run.id,
        traceId: run.traceId,
        requestId: run.requestId,
        sessionId: run.sessionId,
      },
      status,
      identity,
      summary: {
        cardCount: cards.length,
        identityFileCount: identityFiles.length,
        editableCardCount: cards.filter((card) => card.editable).length,
        sensitiveCardCount: cards.filter((card) => card.sensitive).length,
        memoryReceiptCount: this.memoryReceiptCount(memoryWithReceipts, run.memorySignals),
        lowConfidenceMemoryCount,
        knownToolCount: run.toolExposure.tools.length,
        pendingApprovalCount,
        updateSuggestionCount: suggestions.length,
        versionedChangesRequired: cards.some((card) => card.sensitive || card.versioned) || suggestions.length > 0,
      },
      cards,
      suggestions,
      receipts,
      policy: {
        readOnlySnapshot: true,
        noIdentityChanged: true,
        noMemoryChanged: true,
        noConfigChanged: true,
        changesRequirePreview: true,
        changesAreVersioned: true,
        sensitiveChangesRequireApproval: true,
        memoryCorrectionsUseReceipts: true,
        secretsSerialized: false,
      },
      surface: {
        cliCommand: `zavorth selfing run ${run.id} --json`,
        zavorthControlPath: '/control?sector=identity',
        previewHint: 'Identity, tone, user, or memory edits must become previews before writing.',
        versioningHint: 'Changes go through ConfigVersioningService before replacing live sources.',
      },
      nextSafeAction: this.nextSafeAction(status, suggestions, pendingApprovalCount),
    };
  }

  private resolveWorkspaceProfile(
    metadata: LooseRecord,
    canonicalContext: LooseRecord | null,
    warm: LooseRecord | null,
  ): LooseRecord {
    return recordOrNull(metadata.workspaceProfile)
      || recordOrNull(warm?.workspaceProfile)
      || recordOrNull(canonicalContext?.workspaceProfile)
      || {};
  }

  private resolveIdentityFiles(
    metadata: LooseRecord,
    warm: LooseRecord | null,
    workspaceProfile: LooseRecord,
  ): LooseRecord[] {
    const files = [
      ...listRecords(warm?.identityFiles),
      ...listRecords(metadata.identityFiles),
      ...listRecords(workspaceProfile.identityFiles),
    ];
    const byRef = new Map<string, LooseRecord>();
    for (const file of files) {
      const ref = sourceRefFromIdentityFile(file);
      if (ref) {
        byRef.set(ref, file);
      }
    }
    return Array.from(byRef.values());
  }

  private buildIdentity(
    run: UniversalAgentRun,
    metadata: LooseRecord,
    canonicalContext: LooseRecord | null,
    workspaceProfile: LooseRecord,
  ): AgentSelfConfigSnapshot['identity'] {
    const trustPosture = recordOrNull(metadata.trustPosture);
    const trustSlider = recordOrNull(metadata.trustSlider);
    return {
      agentName: normalizeText(workspaceProfile.agentDisplayName, normalizeText(metadata.agentDisplayName, 'Zavorth')),
      userName: normalizeText(workspaceProfile.userDisplayName, normalizeText(metadata.userDisplayName, run.userId)),
      workspaceName: normalizeText(
        workspaceProfile.workspaceName,
        normalizeText(canonicalContext?.workspace, normalizeText(run.workspace, 'Workspace not specified')),
      ),
      tonePreference: normalizeText(workspaceProfile.tonePreference, normalizeText(metadata.tonePreference)) || null,
      memoryMode: normalizeText(workspaceProfile.memoryMode, normalizeText(metadata.memoryMode)) || null,
      safetyPosture: normalizeText(workspaceProfile.safetyPosture, normalizeText(metadata.safetyPosture)) || null,
      trustMode: normalizeText(trustPosture?.trustMode, normalizeText(trustSlider?.level, 'protected')),
      providerLabel: normalizeText(run.modelProfile.providerLabel, 'Provider not specified'),
      modelLabel: normalizeText(run.modelProfile.modelLabel, 'Model not specified'),
    };
  }

  private buildIdentityFileCards(identityFiles: LooseRecord[]): AgentSelfConfigCard[] {
    return identityFiles.map((file, index) => {
      const path = sourceRefFromIdentityFile(file) || `identity-file-${index + 1}`;
      const section = sectionFromIdentityFile(path);
      const sensitive = section === 'user' || section === 'memory' || section === 'identity';
      const cardId = `identity-file:${normalizeKey(path, `file-${index + 1}`)}`;
      return {
        id: cardId,
        section,
        title: titleFromIdentityFile(path),
        value: redactAndShorten(file.summary || file.content, path),
        source: 'WorkspaceIdentityContextAssembler',
        sourceRef: path,
        confidence: file.exists === false ? 0.2 : 0.82,
        editable: true,
        sensitive,
        previewRequired: true,
        versioned: true,
        actions: cardActions(section, cardId),
      };
    });
  }

  private buildProfileCards(
    identity: AgentSelfConfigSnapshot['identity'],
    workspaceProfile: LooseRecord,
  ): AgentSelfConfigCard[] {
    const profilePath = normalizeText(workspaceProfile.firstRunProfilePath) || null;
    const entries: Array<[AgentSelfConfigSectionId, string, string | null, boolean]> = [
      ['identity', 'Agent name', identity.agentName, true],
      ['user', 'Known user', identity.userName, true],
      ['tone', 'Preferred tone', identity.tonePreference, false],
      ['memory', 'Memory mode', identity.memoryMode, true],
      ['permissions', 'Security posture', identity.safetyPosture, true],
    ];
    return entries
      .filter(([, , value]) => Boolean(normalizeText(value)))
      .map(([section, title, value, sensitive]) => {
        const cardId = `profile:${normalizeKey(title)}`;
        return {
          id: cardId,
          section,
          title,
          value: redactAndShorten(value, 'Not specified'),
          source: 'FirstRunWorkspaceBootstrapProfile',
          sourceRef: profilePath,
          confidence: profilePath ? 0.86 : 0.68,
          editable: true,
          sensitive,
          previewRequired: true,
          versioned: true,
          actions: cardActions(section, cardId),
        };
      });
  }

  private buildMemoryCards(
    run: UniversalAgentRun,
    memoryWithReceipts: LooseRecord | null,
    cold: LooseRecord | null,
  ): AgentSelfConfigCard[] {
    const receipts = listRecords(memoryWithReceipts?.receipts);
    if (receipts.length > 0) {
      return receipts.slice(0, 8).map((receipt, index) => {
        const memoryId = normalizeText(receipt.memoryId, `memory-${index + 1}`);
        const actions = recordOrNull(receipt.actions) || {};
        const cardId = `memory:${normalizeKey(memoryId)}`;
        return {
          id: cardId,
          section: 'memory',
          title: normalizeText(receipt.title, 'Memory with receipt'),
          value: redactAndShorten(receipt.summary, 'Memory summarized by runtime.'),
          source: normalizeText(receipt.source, 'MemoryWithReceiptsService'),
          sourceRef: normalizeText(receipt.observatoryReceiptId)
            || normalizeText(recordOrNull(receipt.origin)?.ref)
            || null,
          confidence: clampConfidence(receipt.confidence, 0.62),
          editable: true,
          sensitive: true,
          previewRequired: true,
          versioned: true,
          actions: {
            reviewCommand: normalizeText(actions.askSourceCommand, `zavorth memory source ${memoryId}`),
            previewCommand: normalizeText(actions.correctCommand, `zavorth memory correct ${memoryId} "<new value>"`),
            historyCommand: normalizeText(actions.reviewCommand, `zavorth memory receipts run ${run.id}`),
          },
        };
      });
    }
    const prompt = normalizeText(cold?.memoryPrompt)
      || normalizeText(run.metadata.memoryPrompt)
      || normalizeText(recordOrNull(run.metadata.canonicalContext)?.memoryPrompt);
    if (!prompt) {
      return run.memorySignals.slice(0, 8).map((signal) => {
        const cardId = `memory-signal:${normalizeKey(signal.id)}`;
        return {
          id: cardId,
          section: 'memory',
          title: signal.title,
          value: redactAndShorten(signal.summary, 'Recovered memory.'),
          source: 'UniversalMemorySignal',
          sourceRef: signal.id,
          confidence: clampConfidence(signal.confidence, 0.58),
          editable: true,
          sensitive: true,
          previewRequired: true,
          versioned: true,
          actions: cardActions('memory', cardId),
        };
      });
    }
    const cardId = `memory-context:${normalizeKey(run.id)}`;
    return [{
      id: cardId,
      section: 'memory',
      title: 'Canonical memory context',
      value: redactAndShorten(prompt, 'Memory context available.'),
      source: 'CanonicalSessionContext',
      sourceRef: run.id,
      confidence: 0.64,
      editable: true,
      sensitive: true,
      previewRequired: true,
      versioned: true,
      actions: cardActions('memory', cardId),
    }];
  }

  private buildEnvironmentCards(
    run: UniversalAgentRun,
    metadata: LooseRecord,
    workspaceProfile: LooseRecord,
  ): AgentSelfConfigCard[] {
    const skillMcpQuarantine = recordOrNull(metadata.skillMcpQuarantine);
    const quarantineSummary = recordOrNull(skillMcpQuarantine?.summary);
    const providerArena = recordOrNull(metadata.providerArena);
    const providerSummary = recordOrNull(providerArena?.summary);
    const cards: AgentSelfConfigCard[] = [];
    cards.push(this.staticCard({
      section: 'environment',
      title: 'Workspace',
      value: normalizeText(workspaceProfile.workspaceName, normalizeText(run.workspace, 'Workspace not specified')),
      source: 'CanonicalSessionContext',
      sourceRef: normalizeText(run.workspace) || null,
      confidence: run.workspace ? 0.84 : 0.48,
    }));
    cards.push(this.staticCard({
      section: 'environment',
      title: 'Known tools',
      value: `${run.toolExposure.tools.length} tool(s); mode ${run.toolExposure.mode}; ${run.toolExposure.summary}`,
      source: 'ToolExposurePolicy',
      sourceRef: run.toolExposure.mode,
      confidence: 0.9,
    }));
    cards.push(this.staticCard({
      section: 'environment',
      title: 'Provider and model',
      value: `${run.modelProfile.providerLabel}/${run.modelProfile.modelLabel}`,
      source: 'ModelProfile',
      sourceRef: run.modelProfile.routeId || run.modelProfile.familyId || null,
      confidence: providerSummary?.hasProviderEvidence === true ? 0.9 : 0.7,
    }));
    if (skillMcpQuarantine) {
      cards.push(this.staticCard({
        section: 'environment',
        title: 'Skills/MCP',
        value: `${Number(quarantineSummary?.total || 0)} import(s); ${Number(quarantineSummary?.quarantined || 0)} in quarantine`,
        source: 'SkillMcpQuarantineService',
        sourceRef: normalizeText(skillMcpQuarantine.contractVersion) || null,
        confidence: 0.86,
      }));
    }
    return cards;
  }

  private buildPermissionCards(
    run: UniversalAgentRun,
    metadata: LooseRecord,
  ): AgentSelfConfigCard[] {
    const trustPosture = recordOrNull(metadata.trustPosture);
    const capabilityNegotiation = recordOrNull(metadata.capabilityNegotiation);
    const toolRehearsal = recordOrNull(metadata.toolRehearsal);
    const universalPreviewMode = recordOrNull(metadata.universalPreviewMode);
    const cards: AgentSelfConfigCard[] = [];
    cards.push(this.staticCard({
      section: 'permissions',
      title: 'Trust mode',
      value: normalizeText(trustPosture?.trustMode, 'protected'),
      source: 'TrustSliderPolicyService',
      sourceRef: normalizeText(trustPosture?.permissionBoundary) || null,
      confidence: trustPosture ? 0.86 : 0.55,
    }));
    if (capabilityNegotiation) {
      cards.push(this.staticCard({
        section: 'permissions',
        title: 'Capability Negotiation',
        value: `${normalizeText(capabilityNegotiation.status, 'unknown')} - ${normalizeText(recordOrNull(capabilityNegotiation.scope)?.summary, 'Scope not specified')}`,
        source: 'CapabilityNegotiationService',
        sourceRef: normalizeText(recordOrNull(capabilityNegotiation.scope)?.id) || null,
        confidence: 0.88,
      }));
    }
    if (toolRehearsal) {
      const summary = recordOrNull(toolRehearsal.summary) || {};
      cards.push(this.staticCard({
        section: 'permissions',
        title: 'Tool Rehearsal',
        value: `${normalizeText(toolRehearsal.status, 'unknown')} - ${Number(summary.callCount || 0)} call(s) rehearsed`,
        source: 'ToolRehearsalService',
        sourceRef: normalizeText(toolRehearsal.contractVersion) || null,
        confidence: 0.88,
      }));
    }
    if (universalPreviewMode) {
      cards.push(this.staticCard({
        section: 'permissions',
        title: 'Universal Preview',
        value: `${normalizeText(universalPreviewMode.mode, 'runtime-preview')} - ${normalizeText(recordOrNull(universalPreviewMode.risk)?.highestRisk, 'unknown')}`,
        source: 'UniversalPreviewModeService',
        sourceRef: normalizeText(universalPreviewMode.contractVersion) || null,
        confidence: 0.86,
      }));
    }
    if (run.approvals.length > 0) {
      cards.push(this.staticCard({
        section: 'permissions',
        title: 'Approvals',
        value: `${run.approvals.filter((approval) => approval.status === 'pending').length} pending, ${run.approvals.length} total`,
        source: 'AgentRunService',
        sourceRef: run.id,
        confidence: 0.9,
      }));
    }
    return cards;
  }

  private staticCard(input: {
    section: AgentSelfConfigSectionId;
    title: string;
    value: string;
    source: string;
    sourceRef: string | null;
    confidence: number;
  }): AgentSelfConfigCard {
    const cardId = `${input.section}:${normalizeKey(input.title)}`;
    return {
      id: cardId,
      section: input.section,
      title: input.title,
      value: redactAndShorten(input.value, 'Not specified'),
      source: input.source,
      sourceRef: input.sourceRef,
      confidence: clampConfidence(input.confidence, 0.7),
      editable: false,
      sensitive: false,
      previewRequired: false,
      versioned: false,
      actions: cardActions(input.section, cardId),
    };
  }

  private buildSuggestions(input: {
    run: UniversalAgentRun;
    identity: AgentSelfConfigSnapshot['identity'];
    identityFileCount: number;
    memoryWithReceipts: LooseRecord | null;
    workspaceProfile: LooseRecord;
  }): AgentSelfConfigSuggestion[] {
    const suggestions: AgentSelfConfigSuggestion[] = [];
    if (input.identityFileCount === 0) {
      suggestions.push({
        id: 'selfing:suggestion:identity-files',
        section: 'identity',
        title: 'Link live identity files',
        detail: 'SOUL.md, IDENTITY.md, USER.md, TOOLS.md, or MEMORY.md not found in canonical context.',
        reason: 'Agent self-configuration is more reliable when identity stems from editable, versioned sources.',
        sensitive: true,
        previewCommand: 'zavorth selfing preview identity-files',
      });
    }
    if (!input.identity.tonePreference) {
      suggestions.push({
        id: 'selfing:suggestion:tone',
        section: 'tone',
        title: 'Set preferred tone',
        detail: 'No tone preference was found in the workspace profile.',
        reason: 'The blueprint requires tone and preferences to be reviewable by the user.',
        sensitive: false,
        previewCommand: 'zavorth selfing preview tone "<preferred tone>"',
      });
    }
    if (!input.identity.memoryMode) {
      suggestions.push({
        id: 'selfing:suggestion:memory-mode',
        section: 'memory',
        title: 'Set memory mode',
        detail: 'Memory mode is not explicit in the profile yet.',
        reason: 'Memory with receipts must state how it will be remembered, corrected, or forgotten.',
        sensitive: true,
        previewCommand: 'zavorth selfing preview memory-mode',
      });
    }
    const lowConfidenceCount = this.lowConfidenceMemoryCount(input.memoryWithReceipts, input.run.memorySignals);
    if (lowConfidenceCount > 0) {
      suggestions.push({
        id: 'selfing:suggestion:low-confidence-memory',
        section: 'memory',
        title: 'Review low confidence memories',
        detail: `${lowConfidenceCount} memory item(s) need correction, forgetting, or confirmation.`,
        reason: 'Memory With Receipts requires origin and confidence before using memory in an answer.',
        sensitive: true,
        previewCommand: 'zavorth memory receipts --low-confidence',
      });
    }
    if (input.run.approvals.some((approval) => approval.status === 'pending')) {
      suggestions.push({
        id: 'selfing:suggestion:pending-approval',
        section: 'permissions',
        title: 'Resolve pending approval',
        detail: 'An approval is waiting for the operator before any sensitive mutation.',
        reason: 'Self-configuration must not edit identity while runtime still waits for permission.',
        sensitive: true,
        previewCommand: `zavorth approvals run ${input.run.id}`,
      });
    }
    return suggestions;
  }

  private buildReceipts(input: {
    run: UniversalAgentRun;
    metadata: LooseRecord;
    canonicalContext: LooseRecord | null;
    identityFiles: LooseRecord[];
    workspaceProfile: LooseRecord;
    memoryWithReceipts: LooseRecord | null;
  }): AgentSelfConfigReceipt[] {
    const receipts: AgentSelfConfigReceipt[] = [];
    if (input.identityFiles.length > 0) {
      for (const file of input.identityFiles.slice(0, 8)) {
        const ref = sourceRefFromIdentityFile(file) || 'identity-file';
        receipts.push({
          id: `selfing:receipt:identity:${normalizeKey(ref)}`,
          kind: 'identity-file',
          source: 'WorkspaceIdentityContextAssembler',
          detail: `${titleFromIdentityFile(ref)} visible for review.`,
          status: file.exists === false ? 'needs-review' : 'ready',
        });
      }
    } else {
      receipts.push({
        id: 'selfing:receipt:identity:missing',
        kind: 'identity-file',
        source: 'WorkspaceIdentityContextAssembler',
        detail: 'No live identity file was found in current context.',
        status: 'missing',
      });
    }
    receipts.push({
      id: 'selfing:receipt:workspace-profile',
      kind: 'workspace-profile',
      source: 'FirstRunWorkspaceBootstrapProfile',
      detail: normalizeText(input.workspaceProfile.workspaceName, normalizeText(input.run.workspace, 'Workspace without named profile')),
      status: Object.keys(input.workspaceProfile).length > 0 ? 'ready' : 'needs-review',
    });
    const memorySummary = recordOrNull(input.memoryWithReceipts?.summary);
    receipts.push({
      id: 'selfing:receipt:memory',
      kind: 'memory-receipt',
      source: 'MemoryWithReceiptsService',
      detail: `${Number(memorySummary?.receiptCount || input.run.memorySignals.length || 0)} memory receipt(s) available.`,
      status: input.memoryWithReceipts ? 'ready' : input.run.memorySignals.length > 0 ? 'needs-review' : 'missing',
    });
    receipts.push({
      id: 'selfing:receipt:trust',
      kind: 'trust',
      source: 'TrustSliderPolicyService',
      detail: normalizeText(recordOrNull(input.metadata.trustPosture)?.trustMode, 'protected'),
      status: recordOrNull(input.metadata.trustPosture)?.blocked === true ? 'needs-review' : 'ready',
    });
    receipts.push({
      id: 'selfing:receipt:tool-exposure',
      kind: 'tool-exposure',
      source: 'ToolExposurePolicy',
      detail: `${input.run.toolExposure.tools.length} known tool(s); highest risk ${this.highestRisk(input.run)}.`,
      status: input.run.toolExposure.tools.length > 0 ? 'ready' : 'needs-review',
    });
    receipts.push({
      id: 'selfing:receipt:provider',
      kind: 'provider',
      source: 'ModelProfile',
      detail: `${input.run.modelProfile.providerLabel}/${input.run.modelProfile.modelLabel}`,
      status: normalizeText(input.run.modelProfile.providerLabel) ? 'ready' : 'needs-review',
    });
    receipts.push({
      id: 'selfing:receipt:policy',
      kind: 'policy',
      source: 'AgentSelfConfigService',
      detail: 'Read-only snapshot; changes need preview, approval when sensitive, and versioning.',
      status: 'ready',
    });
    receipts.push({
      id: 'selfing:receipt:surface',
      kind: 'surface',
      source: '/control',
      detail: 'Agent self-configuration projected at /control and CLI.',
      status: 'ready',
    });
    return receipts;
  }

  private memoryReceiptCount(memoryWithReceipts: LooseRecord | null, memorySignals: UniversalMemorySignal[]): number {
    const summary = recordOrNull(memoryWithReceipts?.summary);
    return Number(summary?.receiptCount || listRecords(memoryWithReceipts?.receipts).length || memorySignals.length || 0);
  }

  private lowConfidenceMemoryCount(
    memoryWithReceipts: LooseRecord | null,
    memorySignals: UniversalMemorySignal[],
  ): number {
    const summary = recordOrNull(memoryWithReceipts?.summary);
    const summarized = Number(summary?.lowConfidenceCount);
    if (Number.isFinite(summarized) && summarized > 0) {
      return summarized;
    }
    const receipts = listRecords(memoryWithReceipts?.receipts);
    if (receipts.length > 0) {
      return receipts.filter((receipt) => (
        normalizeText(receipt.confidenceLabel).toLowerCase() === 'low'
        || clampConfidence(receipt.confidence, 0.7) < 0.5
      )).length;
    }
    return memorySignals.filter((signal) => clampConfidence(signal.confidence, 0.7) < 0.5).length;
  }

  private highestRisk(run: UniversalAgentRun): UniversalToolRiskLevel {
    let highest: UniversalToolRiskLevel = 'safe';
    const scores: Record<UniversalToolRiskLevel, number> = {
      safe: 0,
      unknown: 1,
      attention: 2,
      danger: 3,
    };
    for (const tool of run.toolExposure.tools) {
      const risk = normalizeRisk(tool.risk);
      if (scores[risk] > scores[highest]) {
        highest = risk;
      }
    }
    return highest;
  }

  private resolveStatus(input: {
    cards: AgentSelfConfigCard[];
    suggestions: AgentSelfConfigSuggestion[];
    pendingApprovalCount: number;
    lowConfidenceMemoryCount: number;
    metadata: LooseRecord;
    run: UniversalAgentRun;
  }): AgentSelfConfigStatus {
    const trustPosture = recordOrNull(input.metadata.trustPosture);
    const safetyNarrative = recordOrNull(input.metadata.safetyNarrative);
    const safetyStatus = normalizeText(safetyNarrative?.status).toLowerCase();
    if (trustPosture?.blocked === true || safetyStatus === 'blocked' || safetyStatus === 'failed' || input.run.status === 'failed') {
      return 'blocked';
    }
    if (input.cards.length === 0) {
      return 'empty';
    }
    if (input.suggestions.length > 0 || input.pendingApprovalCount > 0 || input.lowConfidenceMemoryCount > 0) {
      return 'needs-review';
    }
    return 'ready';
  }

  private nextSafeAction(
    status: AgentSelfConfigStatus,
    suggestions: AgentSelfConfigSuggestion[],
    pendingApprovalCount: number,
  ): string {
    if (status === 'blocked') {
      return 'Resolve trust/safety blocker before editing identity or memory.';
    }
    if (pendingApprovalCount > 0) {
      return 'Resolve pending approvals before applying sensitive self-config changes.';
    }
    if (suggestions.length > 0) {
      return `Review ${suggestions.length} suggestion(s) and turn any edit into a versioned preview.`;
    }
    if (status === 'empty') {
      return 'Continue without inventing identity; attach live sources before allowing edits.';
    }
    return 'Show identity, memory, and permissions to user; edits follow preview and versioning.';
  }
}

export { AgentSelfConfigService as SelfingZavorthControlService };
