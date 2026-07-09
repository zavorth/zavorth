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
} from './SelfingZavorthControlHelpers.js';

export const SELFING_ZAVORTH_CONTROL_CONTRACT_VERSION = '2026-05-03.selfing-zavorthControl' as const;

export type SelfingZavorthControlStatus = 'ready' | 'needs-review' | 'empty' | 'blocked';

export type SelfingZavorthControlSectionId =
  | 'identity'
  | 'tone'
  | 'user'
  | 'environment'
  | 'memory'
  | 'permissions';

export type SelfingZavorthControlCard = {
  id: string;
  section: SelfingZavorthControlSectionId;
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

export type SelfingZavorthControlSuggestion = {
  id: string;
  section: SelfingZavorthControlSectionId;
  title: string;
  detail: string;
  reason: string;
  sensitive: boolean;
  previewCommand: string;
};

export type SelfingZavorthControlReceipt = {
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

export type SelfingZavorthControlSnapshot = {
  contractVersion: typeof SELFING_ZAVORTH_CONTROL_CONTRACT_VERSION;
  source: 'SelfingZavorthControlService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: SelfingZavorthControlStatus;
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
  cards: SelfingZavorthControlCard[];
  suggestions: SelfingZavorthControlSuggestion[];
  receipts: SelfingZavorthControlReceipt[];
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

export type SelfingZavorthControlInput = {
  run: UniversalAgentRun;
  generatedAt?: string | null;
};


export class SelfingZavorthControlService {
  private readonly now: () => Date;

  constructor(options: { now?: () => Date } = {}) {
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(input: SelfingZavorthControlInput): SelfingZavorthControlSnapshot {
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
      contractVersion: SELFING_ZAVORTH_CONTROL_CONTRACT_VERSION,
      source: 'SelfingZavorthControlService',
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
        zavorthControlPath: '/control?sector=dreams',
        previewHint: 'Edicoes de identidade, tom, usuario ou memoria devem virar preview antes de gravar.',
        versioningHint: 'Mudancas passam por ConfigVersioningService ou contrato equivalente antes de substituir fontes vivas.',
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
  ): SelfingZavorthControlSnapshot['identity'] {
    const trustPosture = recordOrNull(metadata.trustPosture);
    const trustSlider = recordOrNull(metadata.trustSlider);
    return {
      agentName: normalizeText(workspaceProfile.agentDisplayName, normalizeText(metadata.agentDisplayName, 'Zavorth')),
      userName: normalizeText(workspaceProfile.userDisplayName, normalizeText(metadata.userDisplayName, run.userId)),
      workspaceName: normalizeText(
        workspaceProfile.workspaceName,
        normalizeText(canonicalContext?.workspace, normalizeText(run.workspace, 'workspace nao informado')),
      ),
      tonePreference: normalizeText(workspaceProfile.tonePreference, normalizeText(metadata.tonePreference)) || null,
      memoryMode: normalizeText(workspaceProfile.memoryMode, normalizeText(metadata.memoryMode)) || null,
      safetyPosture: normalizeText(workspaceProfile.safetyPosture, normalizeText(metadata.safetyPosture)) || null,
      trustMode: normalizeText(trustPosture?.trustMode, normalizeText(trustSlider?.level, 'protected')),
      providerLabel: normalizeText(run.modelProfile.providerLabel, 'provider nao informado'),
      modelLabel: normalizeText(run.modelProfile.modelLabel, 'modelo nao informado'),
    };
  }

  private buildIdentityFileCards(identityFiles: LooseRecord[]): SelfingZavorthControlCard[] {
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
    identity: SelfingZavorthControlSnapshot['identity'],
    workspaceProfile: LooseRecord,
  ): SelfingZavorthControlCard[] {
    const profilePath = normalizeText(workspaceProfile.firstRunProfilePath) || null;
    const entries: Array<[SelfingZavorthControlSectionId, string, string | null, boolean]> = [
      ['identity', 'Nome do agente', identity.agentName, true],
      ['user', 'Usuario conhecido', identity.userName, true],
      ['tone', 'Tom preferido', identity.tonePreference, false],
      ['memory', 'Modo de memoria', identity.memoryMode, true],
      ['permissions', 'Postura de seguranca', identity.safetyPosture, true],
    ];
    return entries
      .filter(([, , value]) => Boolean(normalizeText(value)))
      .map(([section, title, value, sensitive]) => {
        const cardId = `profile:${normalizeKey(title)}`;
        return {
          id: cardId,
          section,
          title,
          value: redactAndShorten(value, 'nao informado'),
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
  ): SelfingZavorthControlCard[] {
    const receipts = listRecords(memoryWithReceipts?.receipts);
    if (receipts.length > 0) {
      return receipts.slice(0, 8).map((receipt, index) => {
        const memoryId = normalizeText(receipt.memoryId, `memory-${index + 1}`);
        const actions = recordOrNull(receipt.actions) || {};
        const cardId = `memory:${normalizeKey(memoryId)}`;
        return {
          id: cardId,
          section: 'memory',
          title: normalizeText(receipt.title, 'Memoria com receipt'),
          value: redactAndShorten(receipt.summary, 'Memoria resumida pelo runtime.'),
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
            previewCommand: normalizeText(actions.correctCommand, `zavorth memory correct ${memoryId} "<novo valor>"`),
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
          value: redactAndShorten(signal.summary, 'Memoria recuperada.'),
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
      title: 'Contexto de memoria canonico',
      value: redactAndShorten(prompt, 'Contexto de memoria disponivel.'),
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
  ): SelfingZavorthControlCard[] {
    const skillMcpQuarantine = recordOrNull(metadata.skillMcpQuarantine);
    const quarantineSummary = recordOrNull(skillMcpQuarantine?.summary);
    const providerArena = recordOrNull(metadata.providerArena);
    const providerSummary = recordOrNull(providerArena?.summary);
    const cards: SelfingZavorthControlCard[] = [];
    cards.push(this.staticCard({
      section: 'environment',
      title: 'Workspace',
      value: normalizeText(workspaceProfile.workspaceName, normalizeText(run.workspace, 'workspace nao informado')),
      source: 'CanonicalSessionContext',
      sourceRef: normalizeText(run.workspace) || null,
      confidence: run.workspace ? 0.84 : 0.48,
    }));
    cards.push(this.staticCard({
      section: 'environment',
      title: 'Tools conhecidas',
      value: `${run.toolExposure.tools.length} tool(s); modo ${run.toolExposure.mode}; ${run.toolExposure.summary}`,
      source: 'ToolExposurePolicy',
      sourceRef: run.toolExposure.mode,
      confidence: 0.9,
    }));
    cards.push(this.staticCard({
      section: 'environment',
      title: 'Provider e modelo',
      value: `${run.modelProfile.providerLabel}/${run.modelProfile.modelLabel}`,
      source: 'ModelProfile',
      sourceRef: run.modelProfile.routeId || run.modelProfile.familyId || null,
      confidence: providerSummary?.hasProviderEvidence === true ? 0.9 : 0.7,
    }));
    if (skillMcpQuarantine) {
      cards.push(this.staticCard({
        section: 'environment',
        title: 'Skills/MCP',
        value: `${Number(quarantineSummary?.total || 0)} import(s); ${Number(quarantineSummary?.quarantined || 0)} em quarentena`,
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
  ): SelfingZavorthControlCard[] {
    const trustPosture = recordOrNull(metadata.trustPosture);
    const capabilityNegotiation = recordOrNull(metadata.capabilityNegotiation);
    const toolRehearsal = recordOrNull(metadata.toolRehearsal);
    const universalPreviewMode = recordOrNull(metadata.universalPreviewMode);
    const cards: SelfingZavorthControlCard[] = [];
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
        value: `${normalizeText(capabilityNegotiation.status, 'unknown')} - ${normalizeText(recordOrNull(capabilityNegotiation.scope)?.summary, 'escopo nao informado')}`,
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
        value: `${normalizeText(toolRehearsal.status, 'unknown')} - ${Number(summary.callCount || 0)} call(s) ensaiadas`,
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
        value: `${run.approvals.filter((approval) => approval.status === 'pending').length} pendente(s), ${run.approvals.length} total`,
        source: 'AgentRunService',
        sourceRef: run.id,
        confidence: 0.9,
      }));
    }
    return cards;
  }

  private staticCard(input: {
    section: SelfingZavorthControlSectionId;
    title: string;
    value: string;
    source: string;
    sourceRef: string | null;
    confidence: number;
  }): SelfingZavorthControlCard {
    const cardId = `${input.section}:${normalizeKey(input.title)}`;
    return {
      id: cardId,
      section: input.section,
      title: input.title,
      value: redactAndShorten(input.value, 'nao informado'),
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
    identity: SelfingZavorthControlSnapshot['identity'];
    identityFileCount: number;
    memoryWithReceipts: LooseRecord | null;
    workspaceProfile: LooseRecord;
  }): SelfingZavorthControlSuggestion[] {
    const suggestions: SelfingZavorthControlSuggestion[] = [];
    if (input.identityFileCount === 0) {
      suggestions.push({
        id: 'selfing:suggestion:identity-files',
        section: 'identity',
        title: 'Associar arquivos vivos de identidade',
        detail: 'SOUL.md, IDENTITY.md, USER.md, TOOLS.md ou MEMORY.md ainda nao aparecem no contexto canonico.',
        reason: 'Selfing ZavorthControl fica mais confiavel quando a identidade vem de fontes editaveis e versionadas.',
        sensitive: true,
        previewCommand: 'zavorth selfing preview identity-files',
      });
    }
    if (!input.identity.tonePreference) {
      suggestions.push({
        id: 'selfing:suggestion:tone',
        section: 'tone',
        title: 'Definir tom preferido',
        detail: 'Nenhuma preferencia de tom foi encontrada no perfil de workspace.',
        reason: 'O blueprint pede que tom e preferencias sejam revisaveis pelo usuario.',
        sensitive: false,
        previewCommand: 'zavorth selfing preview tone "<tom preferido>"',
      });
    }
    if (!input.identity.memoryMode) {
      suggestions.push({
        id: 'selfing:suggestion:memory-mode',
        section: 'memory',
        title: 'Definir modo de memoria',
        detail: 'O modo de memoria ainda nao esta explicito no perfil.',
        reason: 'Memoria com receipts precisa dizer como sera lembrada, corrigida ou esquecida.',
        sensitive: true,
        previewCommand: 'zavorth selfing preview memory-mode',
      });
    }
    const lowConfidenceCount = this.lowConfidenceMemoryCount(input.memoryWithReceipts, input.run.memorySignals);
    if (lowConfidenceCount > 0) {
      suggestions.push({
        id: 'selfing:suggestion:low-confidence-memory',
        section: 'memory',
        title: 'Revisar memorias de baixa confianca',
        detail: `${lowConfidenceCount} memoria(s) precisam de correcao, esquecimento ou confirmacao.`,
        reason: 'A feature Memory With Receipts exige origem e confianca antes de usar memoria em resposta.',
        sensitive: true,
        previewCommand: 'zavorth memory receipts --low-confidence',
      });
    }
    if (input.run.approvals.some((approval) => approval.status === 'pending')) {
      suggestions.push({
        id: 'selfing:suggestion:pending-approval',
        section: 'permissions',
        title: 'Resolver approval pendente',
        detail: 'Existe approval aguardando operador antes de qualquer mutacao sensivel.',
        reason: 'Selfing nao deve editar identidade enquanto o runtime ainda aguarda permissao.',
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
  }): SelfingZavorthControlReceipt[] {
    const receipts: SelfingZavorthControlReceipt[] = [];
    if (input.identityFiles.length > 0) {
      for (const file of input.identityFiles.slice(0, 8)) {
        const ref = sourceRefFromIdentityFile(file) || 'identity-file';
        receipts.push({
          id: `selfing:receipt:identity:${normalizeKey(ref)}`,
          kind: 'identity-file',
          source: 'WorkspaceIdentityContextAssembler',
          detail: `${titleFromIdentityFile(ref)} visivel para revisao.`,
          status: file.exists === false ? 'needs-review' : 'ready',
        });
      }
    } else {
      receipts.push({
        id: 'selfing:receipt:identity:missing',
        kind: 'identity-file',
        source: 'WorkspaceIdentityContextAssembler',
        detail: 'Nenhum arquivo vivo de identidade foi encontrado no contexto atual.',
        status: 'missing',
      });
    }
    receipts.push({
      id: 'selfing:receipt:workspace-profile',
      kind: 'workspace-profile',
      source: 'FirstRunWorkspaceBootstrapProfile',
      detail: normalizeText(input.workspaceProfile.workspaceName, normalizeText(input.run.workspace, 'workspace sem perfil nomeado')),
      status: Object.keys(input.workspaceProfile).length > 0 ? 'ready' : 'needs-review',
    });
    const memorySummary = recordOrNull(input.memoryWithReceipts?.summary);
    receipts.push({
      id: 'selfing:receipt:memory',
      kind: 'memory-receipt',
      source: 'MemoryWithReceiptsService',
      detail: `${Number(memorySummary?.receiptCount || input.run.memorySignals.length || 0)} receipt(s) de memoria disponiveis.`,
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
      detail: `${input.run.toolExposure.tools.length} tool(s) conhecidas; maior risco ${this.highestRisk(input.run)}.`,
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
      source: 'SelfingZavorthControlService',
      detail: 'Snapshot read-only; alteracoes precisam de preview, approval quando sensiveis e versionamento.',
      status: 'ready',
    });
    receipts.push({
      id: 'selfing:receipt:surface',
      kind: 'surface',
      source: '/control',
      detail: 'Selfing ZavorthControl projetado em /control?sector=dreams e CLI.',
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
    cards: SelfingZavorthControlCard[];
    suggestions: SelfingZavorthControlSuggestion[];
    pendingApprovalCount: number;
    lowConfidenceMemoryCount: number;
    metadata: LooseRecord;
    run: UniversalAgentRun;
  }): SelfingZavorthControlStatus {
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
    status: SelfingZavorthControlStatus,
    suggestions: SelfingZavorthControlSuggestion[],
    pendingApprovalCount: number,
  ): string {
    if (status === 'blocked') {
      return 'Resolver bloqueio de trust/safety antes de editar identidade ou memoria.';
    }
    if (pendingApprovalCount > 0) {
      return 'Resolver approvals pendentes antes de aplicar mudancas sensiveis no selfing.';
    }
    if (suggestions.length > 0) {
      return `Revisar ${suggestions.length} sugestao(oes) e transformar qualquer edicao em preview versionado.`;
    }
    if (status === 'empty') {
      return 'Continuar sem inventar identidade; anexar fontes vivas antes de permitir edicao.';
    }
    return 'Mostrar identidade, memoria e permissao ao usuario; edicoes seguem preview e versionamento.';
  }
}
