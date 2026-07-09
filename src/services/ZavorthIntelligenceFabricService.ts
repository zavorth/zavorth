import {
  INTELLIGENCE_FABRIC_CONTRACT_VERSION,
  type IntelligenceCapabilityBuilderDraft,
  type IntelligenceCapabilityManifest,
  type IntelligenceContextPack,
  type IntelligenceExecutionProposal,
  type IntelligenceFabricClassification,
  type IntelligenceFabricInput,
  type IntelligenceFabricSnapshot,
  type IntelligenceModelRoutingDecision,
  type IntelligenceModelRoutingInput,
  type IntelligenceProposedAction,
  type IntelligenceRecommendedMode,
  type IntelligenceRiskLevel,
  type IntelligenceTaskComplexity,
  type IntelligenceTaskEval,
  type IntelligenceTaskKind,
  type IntelligenceVerifierFinding,
  type IntelligenceVerifierSnapshot,
} from '../contracts/native/IntelligenceFabricContract.js';
import type { CapabilityHubItem } from '../contracts/CapabilityHubContract.js';
import { UniversalIntentService } from '../runtime/uni/UniversalIntentService.js';
import type { UniversalIntentDecision } from '../runtime/uni/UniversalIntentContracts.js';
import { AiFirstRoutePlanContractService } from './AiFirstRoutePlanContractService.js';
import { IntelligenceRiskGateService } from './IntelligenceRiskGateService.js';
import {
  IntelligenceTrustModePolicyService,
  type IntelligenceTrustModePolicySnapshot,
} from './IntelligenceTrustModePolicyService.js';
import { ConversationalAgencyPresenter } from './ConversationalAgencyPresenter.js';
import { ZavorthCapabilityHubApiService } from './ZavorthCapabilityHubApiService.js';
import { ModelPickerService, type ModelPickerServiceResult } from './providers/catalog/ModelPickerService.js';
import { logger } from '../logger.js';

type FabricRuntime = {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
  aiFirstRoutePlan?: Pick<AiFirstRoutePlanContractService, 'normalize'> | null;
  universalIntent?: Pick<UniversalIntentService, 'decide'> | null;
  riskGate?: Pick<IntelligenceRiskGateService, 'evaluate'> | null;
  trustPolicy?: Pick<IntelligenceTrustModePolicyService, 'resolve'> | null;
  modelPicker?: Pick<ModelPickerService, 'buildPicker'> | null;
  capabilityHub?: Pick<ZavorthCapabilityHubApiService, 'list' | 'inspect'> | null;
  presenter?: Pick<ConversationalAgencyPresenter, 'present'> | null;
};

const SECRET_PATTERNS = [
  /\b(?:token|secret|senha|password|api[_ -]?key|chave)\s*[:=]\s*[^\s,;]+/gi,
  /\b(?:\.env|id_rsa|credentials\.json|secrets?\.json)\b/gi,
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{12,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g,
];

export class ZavorthIntelligenceFabricService {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private readonly aiFirstRoutePlan: Pick<AiFirstRoutePlanContractService, 'normalize'>;
  private readonly universalIntent: Pick<UniversalIntentService, 'decide'>;
  private readonly riskGate: Pick<IntelligenceRiskGateService, 'evaluate'>;
  private readonly trustPolicy: Pick<IntelligenceTrustModePolicyService, 'resolve'>;
  private readonly modelPicker: Pick<ModelPickerService, 'buildPicker'>;
  private readonly capabilityHub: Pick<ZavorthCapabilityHubApiService, 'list' | 'inspect'>;
  private readonly presenter: Pick<ConversationalAgencyPresenter, 'present'>;
  private sequence = 0;

  constructor(runtime: FabricRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.idFactory = runtime.idFactory || ((prefix) => `${prefix}-${this.now().getTime().toString(36)}-${++this.sequence}`);
    this.aiFirstRoutePlan = runtime.aiFirstRoutePlan || new AiFirstRoutePlanContractService({
      now: this.now,
      idFactory: this.idFactory,
    });
    this.universalIntent = runtime.universalIntent || new UniversalIntentService({ now: this.now });
    this.riskGate = runtime.riskGate || new IntelligenceRiskGateService();
    this.trustPolicy = runtime.trustPolicy || new IntelligenceTrustModePolicyService();
    this.modelPicker = runtime.modelPicker || new ModelPickerService();
    this.capabilityHub = runtime.capabilityHub || new ZavorthCapabilityHubApiService();
    this.presenter = runtime.presenter || new ConversationalAgencyPresenter();
  }

  public buildShadowSnapshot(input: IntelligenceFabricInput): IntelligenceFabricSnapshot {
    const startedAt = this.now().getTime();
    const redactedText = redactText(input.text);
    const trust = this.resolveTrust(input);
    const trustMode = trust.requested;
    const legacyTrustMode = trust.legacy;
    const routePlan = this.aiFirstRoutePlan.normalize({
      userMessage: redactedText,
      surface: input.surface || 'conversation',
      language: 'en-US',
    }).normalized;
    const universal = this.universalIntent.decide({
      surface: input.surface || 'cli',
      text: redactedText,
      requestedTools: input.requestedTools || [],
      capabilityIds: input.capabilityIds || [],
      userRole: input.userRole || 'owner',
      trustMode: legacyTrustMode,
      ownerConfirmed: trustMode === 'local_owner' || trustMode === 'developer_fast',
      contextHints: {
        workspaceRoot: input.workspaceRoot || null,
      },
    });
    const classification = this.classify(redactedText, routePlan.intent.primary, universal);
    const contextPack = this.buildContextPack(input, classification);
    const executionProposal = this.buildExecutionProposal(redactedText, classification, input.workspaceRoot || null);
    const riskGate = this.riskGate.evaluate({ proposal: executionProposal, trustMode });
    const modelRouting = this.routeModel({
      input,
      classification,
      proposal: executionProposal,
    });
    const capabilityBuilder = this.buildCapabilityDraft(redactedText, classification);
    const verifier = this.verify({
      proposal: executionProposal,
      capabilityBuilder,
      riskGateRequiresApproval: riskGate.requiresApproval,
    });
    const taskEval = this.buildTaskEval({
      classification,
      modelRouting,
      verifier,
      latencyMs: Math.max(0, this.now().getTime() - startedAt),
    });

    return {
      contractVersion: INTELLIGENCE_FABRIC_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      mode: 'shadow',
      input: {
        surface: input.surface || 'conversation',
        redactedText,
        rawSecretsSerialized: false,
      },
      trust: {
        requested: trustMode,
        legacy: legacyTrustMode,
        defaulted: trust.defaulted,
        source: trust.source,
        ownerLocalDefault: trust.ownerLocalDefault,
        surfacePolicy: trust.surfacePolicy,
        reason: trust.reason,
      },
      classification,
      contextPack,
      modelRouting,
      executionProposal,
      riskGate,
      verifier,
      capabilityBuilder,
      taskEval,
      activation: {
        shadowOnly: true,
        promotedToDefault: false,
        liveActionApplied: false,
      },
      safety: {
        thinkingRequiresApproval: false,
        planningRequiresApproval: false,
        simulationRequiresApproval: false,
        dangerousActionsRequireGate: true,
        naturalLanguageDoesNotBypassPolicy: true,
      },
      receipts: [
        'fabric-shadow-only',
        'llm-thinking-before-risk-gate',
        'risk-gate-before-impact',
        'no-live-action-applied',
      ],
      reply: this.buildReply(classification, riskGate.overallDecision, capabilityBuilder, {
        contractVersion: INTELLIGENCE_FABRIC_CONTRACT_VERSION,
        generatedAt: this.now().toISOString(),
        mode: 'shadow',
        input: {
          surface: input.surface || 'conversation',
          redactedText,
          rawSecretsSerialized: false,
        },
        trust: {
          requested: trustMode,
          legacy: legacyTrustMode,
          defaulted: trust.defaulted,
          source: trust.source,
          ownerLocalDefault: trust.ownerLocalDefault,
          surfacePolicy: trust.surfacePolicy,
          reason: trust.reason,
        },
        classification,
        contextPack,
        modelRouting,
        executionProposal,
        riskGate,
        verifier,
        capabilityBuilder,
        taskEval,
        activation: {
          shadowOnly: true,
          promotedToDefault: false,
          liveActionApplied: false,
        },
        safety: {
          thinkingRequiresApproval: false,
          planningRequiresApproval: false,
          simulationRequiresApproval: false,
          dangerousActionsRequireGate: true,
          naturalLanguageDoesNotBypassPolicy: true,
        },
        receipts: [],
        reply: {
          headline: '',
          body: '',
          nextAction: '',
        },
      }),
    };
  }

  public renderMarkdown(input: IntelligenceFabricInput): string {
    const snapshot = this.buildShadowSnapshot(input);
    return [
      '# Zavorth Intelligence Fabric',
      '',
      `- mode: ${snapshot.mode}`,
      `- task: ${snapshot.classification.taskKind}`,
      `- complexity: ${snapshot.classification.complexity}`,
      `- risk: ${snapshot.classification.riskLevel}`,
      `- trust: ${snapshot.trust.requested} -> ${snapshot.trust.legacy}`,
      `- trustSource: ${snapshot.trust.source}`,
      `- recommended: ${snapshot.classification.recommendedMode}`,
      `- model: ${snapshot.modelRouting.selectedModelId || 'none'}`,
      `- riskGate: ${snapshot.riskGate.overallDecision}`,
      `- verifier: ${snapshot.verifier.status}`,
      `- capabilityBuilder: ${snapshot.capabilityBuilder.status}`,
      '',
      snapshot.reply.headline,
      snapshot.reply.body,
      snapshot.reply.nextAction,
    ].join('\n');
  }

  private resolveTrust(input: IntelligenceFabricInput): IntelligenceTrustModePolicySnapshot {
    return this.trustPolicy.resolve({
      requestedTrustMode: input.trustMode,
      surface: input.surface || 'conversation',
      userRole: input.userRole || null,
    });
  }

  private classify(
    text: string,
    routeIntent: string,
    universal: UniversalIntentDecision,
  ): IntelligenceFabricClassification {
    const normalized = normalize(text);
    const taskKind = inferTaskKind(normalized, routeIntent, universal.intent);
    const complexity = inferComplexity(normalized, taskKind);
    const riskLevel = inferRiskLevel(normalized, universal.risk, taskKind);
    const recommendedMode = inferRecommendedMode(normalized, taskKind, riskLevel);
    return {
      taskKind,
      complexity,
      riskLevel,
      recommendedMode,
      reasons: [
        `route-intent:${routeIntent}`,
        `universal-intent:${universal.intent}`,
        `universal-risk:${universal.risk}`,
        riskLevel <= 2 ? 'thinking-planning-simulation-are-free' : 'impact-requires-risk-gate',
      ],
      routeIntent,
      universalIntent: universal.intent,
      confidence: Math.max(0.5, Math.min(0.96, universal.confidence || 0.72)),
    };
  }

  private buildContextPack(
    input: IntelligenceFabricInput,
    classification: IntelligenceFabricClassification,
  ): IntelligenceContextPack {
    return {
      systemIdentity: 'Zavorth Intelligence Fabric coordinates AI-first reasoning without applying live impact.',
      userPreferences: 'AI-first, security as airbag, Portuguese operator UX, no external-root naming.',
      projectSummary: 'Zavorth is a governed local-first agent runtime with Capability Hub, Provider Mesh and Trust Plane.',
      relevantFiles: [
        { path: 'src/runtime/agent/AgentRunService.ts', reason: 'canonical runtime entrypoint', tokenEstimate: 1200 },
        { path: 'src/runtime/uni/UniversalIntentService.ts', reason: 'intent and trust baseline', tokenEstimate: 800 },
        { path: 'src/services/ZavorthCapabilityHubService.ts', reason: 'capability discovery baseline', tokenEstimate: 800 },
      ].filter((file) => classification.taskKind !== 'casual_chat' || file.path.includes('UniversalIntent')),
      recentDecisions: [
        'Capability Hub is canonical for channels, skills, MCPs and integrations.',
        'Natural language may plan setup but must not activate live without owner approval.',
      ],
      activeConstraints: [
        'Do not block reasoning, reading, planning, draft patching or safe simulation.',
        'Gate shell, network, install, secrets, deployment, external send and irreversible actions.',
        input.workspaceRoot ? `Workspace root: ${input.workspaceRoot}` : 'Workspace root not provided.',
      ],
      securityPolicy: 'Risk 0-2 allowed; Risk 3 reversible workspace writes depend on trust; Risk 4 sandbox/approval; Risk 5 explicit approval.',
      tokenBudget: classification.complexity === 'expert' ? 24000 : classification.complexity === 'hard' ? 16000 : 8000,
    };
  }

  private buildExecutionProposal(
    text: string,
    classification: IntelligenceFabricClassification,
    workspaceRoot: string | null,
  ): IntelligenceExecutionProposal {
    const normalized = normalize(text);
    const actions = inferActions(normalized, classification, workspaceRoot);
    const riskLevel = maxRisk(actions.map((action) => action.riskLevel));
    return {
      id: this.idFactory('proposal'),
      summary: summarizeProposal(classification, actions),
      mode: riskLevel <= 2 ? 'draft' : 'simulation',
      actions,
      riskLevel,
      requiresApproval: riskLevel >= 4 || actions.some((action) => action.touchesSecrets),
      requiresSandbox: riskLevel === 4,
      rollbackPlan: actions.some((action) => action.riskLevel >= 3)
        ? 'Use mutation receipts and restore touched workspace files from generated rollback artifacts.'
        : null,
      testsToRun: actions.some((action) => action.kind === 'edit' || action.kind === 'write')
        ? ['targeted unit tests', 'runtime:check']
        : [],
      liveActionApplied: false,
    };
  }

  private routeModel(input: {
    input: IntelligenceFabricInput;
    classification: IntelligenceFabricClassification;
    proposal: IntelligenceExecutionProposal;
  }): IntelligenceModelRoutingDecision {
    const routingInput: IntelligenceModelRoutingInput = {
      taskKind: input.classification.taskKind,
      complexity: input.classification.complexity,
      riskLevel: input.proposal.riskLevel,
      needsCode: ['coding', 'debugging', 'architecture', 'agent_building'].includes(input.classification.taskKind),
      needsLongContext: input.classification.complexity === 'hard' || input.classification.complexity === 'expert',
      needsVision: false,
      needsToolUse: input.proposal.actions.some((action) => action.kind !== 'answer'),
      needsSecurityReasoning: input.classification.taskKind === 'security_review' || input.proposal.riskLevel >= 4,
      userForcedModel: input.input.userForcedModel || null,
    };
    if (routingInput.userForcedModel) {
      return {
        source: 'manual-override',
        selectedModelId: routingInput.userForcedModel,
        selectedProviderId: null,
        selectedRouteId: null,
        ready: true,
        overrideUsed: true,
        fallbackAllowed: true,
        routingInput,
        explanation: ['User forced model override respected by the Fabric shadow route.'],
      };
    }
    const picker = safeBuildPicker(this.modelPicker);
    return {
      source: picker ? 'ModelPickerService' : 'fallback',
      selectedModelId: picker?.selected.modelId || null,
      selectedProviderId: picker?.selected.providerId || null,
      selectedRouteId: picker?.selected.routeId || null,
      ready: picker?.selected.ready === true,
      overrideUsed: false,
      fallbackAllowed: true,
      routingInput,
      explanation: [
        picker ? 'ModelPickerService used as canonical Provider Mesh source.' : 'ModelPicker unavailable; fallback route kept.',
        ...explainModelNeed(routingInput),
      ],
    };
  }

  private buildCapabilityDraft(
    text: string,
    classification: IntelligenceFabricClassification,
  ): IntelligenceCapabilityBuilderDraft {
    const requestedCapability = extractCapabilityTarget(text);
    if (!requestedCapability || !['capability_setup', 'agent_building'].includes(classification.taskKind)) {
      return this.capabilityDraft('not_needed', null, null, null, ['Request does not need a new capability.']);
    }
    const match = findCapability(this.capabilityHub, requestedCapability);
    if (match) {
      return this.capabilityDraft('existing_capability', requestedCapability, match.id, null, [
        'Capability exists in the Zavorth Capability Hub.',
        'Use setup/readiness/approval flow instead of building a new adapter.',
      ]);
    }
    const manifest: IntelligenceCapabilityManifest = {
      id: `capability.${slugify(requestedCapability)}`,
      name: requestedCapability,
      description: `Draft capability for ${requestedCapability}.`,
      kind: 'plugin',
      riskLevel: 3,
      requiredTools: ['capability.scaffold', 'capability.test'],
      requiredSecrets: [],
      allowedFileScopes: ['workspace:capabilities', 'workspace:tests'],
      networkAccess: 'allowlist',
      approvalRequiredFor: ['install', 'activate-live', 'network-access', 'secret-use'],
      tests: ['manifest validates', 'sandbox simulation passes', 'risk gate blocks live activation'],
      defaultEnabled: false,
      liveAllowedByDefault: false,
    };
    return this.capabilityDraft('draft_ready', requestedCapability, null, manifest, [
      'Unknown capability was converted into a disabled Zavorth-native draft.',
      'No package install, live activation or secret access was performed.',
    ]);
  }

  private capabilityDraft(
    status: IntelligenceCapabilityBuilderDraft['status'],
    requestedCapability: string | null,
    matchedCapabilityId: string | null,
    manifest: IntelligenceCapabilityManifest | null,
    notes: string[],
  ): IntelligenceCapabilityBuilderDraft {
    return {
      status,
      requestedCapability,
      matchedCapabilityId,
      manifest,
      activationBlockedUntilApproval: true,
      notes,
    };
  }

  private verify(input: {
    proposal: IntelligenceExecutionProposal;
    capabilityBuilder: IntelligenceCapabilityBuilderDraft;
    riskGateRequiresApproval: boolean;
  }): IntelligenceVerifierSnapshot {
    const findings: IntelligenceVerifierFinding[] = [];
    for (const action of input.proposal.actions) {
      if (action.touchesSecrets) {
        findings.push({ id: `${action.id}.secret`, severity: 'blocker', message: 'Action touches secrets and must not run without explicit approval.' });
      }
      if ((action.kind === 'exec' || action.kind === 'install') && !input.riskGateRequiresApproval) {
        findings.push({ id: `${action.id}.shell`, severity: 'blocker', message: 'Shell or install action must be gated.' });
      }
      if (action.riskLevel >= 3 && !action.reversible) {
        findings.push({ id: `${action.id}.rollback`, severity: 'warning', message: 'Impactful action should declare rollback.' });
      }
    }
    if (input.capabilityBuilder.status === 'draft_ready' && input.capabilityBuilder.manifest?.defaultEnabled !== false) {
      findings.push({ id: 'capability.default-enabled', severity: 'blocker', message: 'New capabilities must start disabled.' });
    }
    const blockers = findings.filter((finding) => finding.severity === 'blocker');
    return {
      status: blockers.length > 0 ? 'blocked' : findings.length > 0 ? 'warning' : 'passed',
      independentReviewRequired: input.proposal.riskLevel >= 4 || input.capabilityBuilder.status === 'draft_ready',
      findings,
    };
  }

  private buildTaskEval(input: {
    classification: IntelligenceFabricClassification;
    modelRouting: IntelligenceModelRoutingDecision;
    verifier: IntelligenceVerifierSnapshot;
    latencyMs: number;
  }): IntelligenceTaskEval {
    return {
      taskId: this.idFactory('task-eval'),
      taskKind: input.classification.taskKind,
      complexity: input.classification.complexity,
      riskLevel: input.classification.riskLevel,
      modelUsed: input.modelRouting.selectedModelId,
      success: input.verifier.status !== 'blocked',
      userCorrectionNeeded: false,
      testsPassed: null,
      securityIssuesFound: input.verifier.findings.some((finding) => finding.severity === 'blocker'),
      latencyMs: input.latencyMs,
      costEstimate: null,
      lessons: [
        'Fabric v1 records shadow evals only.',
        input.modelRouting.ready ? 'Model route was ready.' : 'Model route needs fallback or provider readiness.',
      ],
    };
  }

  private buildReply(
    classification: IntelligenceFabricClassification,
    riskDecision: string,
    capabilityBuilder: IntelligenceCapabilityBuilderDraft,
    snapshot?: IntelligenceFabricSnapshot,
  ): IntelligenceFabricSnapshot['reply'] {
    if (snapshot) {
      return this.presenter.present({ fabric: snapshot });
    }
    if (capabilityBuilder.status === 'draft_ready') {
      return {
        headline: 'Preparei uma capacidade nova como rascunho seguro.',
        body: 'Ela comeca desativada, com manifesto, testes e aprovacao obrigatoria antes de qualquer ativacao live.',
        nextAction: 'A proxima etapa e revisar o manifesto e simular no Capability Lab.',
      };
    }
    return {
      headline: 'Intelligence Fabric preparou a decisao em shadow mode.',
      body: `Tarefa ${classification.taskKind}, risco ${classification.riskLevel}, modo ${classification.recommendedMode}.`,
      nextAction: `Risk Gate: ${riskDecision}. Pensamento e planejamento seguem livres; impacto passa pelo gate.`,
    };
  }
}

function safeBuildPicker(modelPicker: Pick<ModelPickerService, 'buildPicker'>): ModelPickerServiceResult | null {
  try {
    return modelPicker.buildPicker({ includeAdvanced: true });
  } catch (error: any) { logger.warn('[Zavorth Intelligence Fabric] creation failed', error); return null; }
}

function redactText(text: string): string {
  return SECRET_PATTERNS.reduce((current, pattern) => current.replace(pattern, '[redacted-secret]'), String(text || '').trim());
}

function normalize(text: string): string {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function inferTaskKind(text: string, routeIntent: string, universalIntent: string): IntelligenceTaskKind {
  if (/\b(seguranca|security|vulnerab|prompt injection|owasp|red team)\b/.test(text)) return 'security_review';
  if (/\b(arquitetura|architecture|design|blueprint|sistema)\b/.test(text)) return 'architecture';
  if (/\b(debug|erro|falha|bug|stack trace|corrija|corrigir)\b/.test(text)) return 'debugging';
  if (/\b(codigo|code|patch|implemente|implementar|teste|jest|typescript)\b/.test(text)) return 'coding';
  if (/\b(shell|terminal|powershell|npm|pnpm|yarn|git|rode|rodar|execute)\b/.test(text)) return 'shell_operation';
  if (/\b(leia|ler|arquivo|file|pasta|diretorio)\b/.test(text)) return 'file_operation';
  if (/\b(configurar|conectar|integrar|canal|mcp|plugin|skill|capacidade|capability|usar voce atraves|usar voce pelo)\b/.test(text)) return 'capability_setup';
  if (/\b(pesquise|research|internet|web)\b/.test(text)) return 'research';
  if (routeIntent === 'automation' || universalIntent === 'automation') return 'agent_building';
  return text.length < 80 ? 'casual_chat' : 'unknown';
}

function inferComplexity(text: string, taskKind: IntelligenceTaskKind): IntelligenceTaskComplexity {
  if (taskKind === 'casual_chat') return 'trivial';
  if (/\b(expert|critico|empresa|enterprise|multiagente|microvm|arquitetura completa)\b/.test(text)) return 'expert';
  if (['architecture', 'security_review', 'agent_building'].includes(taskKind)) return 'hard';
  if (['coding', 'debugging', 'capability_setup'].includes(taskKind)) return 'medium';
  return 'simple';
}

function inferRiskLevel(
  text: string,
  universalRisk: string,
  taskKind: IntelligenceTaskKind,
): IntelligenceRiskLevel {
  if (/\[redacted-secret\]|redacted-secret|(^|[\s\\/])\.env\b|\bid_rsa\b|\bcredentials\.json\b|\b(deploy|publique|publicar|delete|deletar|apague|apagar|rm -rf|pagamento|payment)\b/.test(text)) return 5;
  if (/\b(npm install|pnpm add|yarn add|pip install|shell|terminal|powershell|curl|wget|rode|rodar|execute|network|internet)\b/.test(text)) return 4;
  if (/\b(aplique|aplicar|escreva|salve|editar arquivo|modifique arquivo)\b/.test(text)) return 3;
  if (/\b(patch|rascunho|simule|simular|plano|planeje|teste em memoria|scaffold)\b/.test(text)) return 2;
  if (taskKind === 'capability_setup' || taskKind === 'agent_building') return 2;
  if (/\b(leia|listar|analise|inspecione)\b/.test(text)) return 1;
  return universalRisk === 'danger' ? 4 : universalRisk === 'attention' ? 2 : 0;
}

function inferRecommendedMode(
  text: string,
  taskKind: IntelligenceTaskKind,
  riskLevel: IntelligenceRiskLevel,
): IntelligenceRecommendedMode {
  if (riskLevel >= 5) return 'ask_approval';
  if (riskLevel === 4) return 'execute_sandboxed';
  if (taskKind === 'capability_setup' && extractCapabilityTarget(text)) return 'capability_builder';
  if (riskLevel === 3) return 'simulate';
  if (riskLevel === 2) return 'draft_patch';
  if (riskLevel === 1) return 'plan_only';
  return 'direct_answer';
}

function inferActions(
  text: string,
  classification: IntelligenceFabricClassification,
  workspaceRoot: string | null,
): IntelligenceProposedAction[] {
  const id = (suffix: string) => `action-${suffix}`;
  if (classification.riskLevel >= 5) {
    return [action(id('explicit-approval'), 'secret_access', 'sensitive-resource', 'Access to secrets, deploy, destructive or external irreversible impact.', false, false, true, /\b(internet|deploy|publique|enviar)\b/.test(text), 5)];
  }
  if (classification.riskLevel === 4) {
    const kind = /\b(install|npm install|pnpm add|pip install)\b/.test(text) ? 'install' : 'exec';
    return [action(id('sandbox-required'), kind, workspaceRoot || 'workspace', 'Sandbox or approval required before shell, install or network impact.', false, Boolean(workspaceRoot), false, true, 4)];
  }
  if (classification.riskLevel === 3) {
    return [action(id('workspace-impact'), 'edit', workspaceRoot || 'workspace', 'Reversible workspace edit can proceed only when trust mode allows it.', true, true, false, false, 3)];
  }
  if (classification.taskKind === 'capability_setup' || classification.taskKind === 'agent_building') {
    return [action(id('capability-draft'), 'capability_draft', 'capability-manifest', 'Prepare a disabled capability manifest and tests in draft mode.', true, true, false, false, 2)];
  }
  if (classification.riskLevel === 2) {
    return [action(id('draft'), 'edit', 'in-memory-patch', 'Prepare patch or tests in memory without applying changes.', true, true, false, false, 2)];
  }
  if (classification.riskLevel === 1) {
    return [action(id('read'), 'read', workspaceRoot || 'workspace', 'Read or inspect allowed workspace context.', true, true, false, false, 1)];
  }
  return [action(id('answer'), 'answer', 'conversation', 'Answer directly without tools or side effects.', true, true, false, false, 0)];
}

function action(
  id: string,
  kind: IntelligenceProposedAction['kind'],
  target: string,
  description: string,
  reversible: boolean,
  insideWorkspace: boolean,
  touchesSecrets: boolean,
  usesNetwork: boolean,
  riskLevel: IntelligenceRiskLevel,
): IntelligenceProposedAction {
  return { id, kind, target, description, reversible, insideWorkspace, touchesSecrets, usesNetwork, riskLevel };
}

function summarizeProposal(
  classification: IntelligenceFabricClassification,
  actions: IntelligenceProposedAction[],
): string {
  return `${classification.recommendedMode} for ${classification.taskKind} with ${actions.length} proposed action(s).`;
}

function maxRisk(risks: IntelligenceRiskLevel[]): IntelligenceRiskLevel {
  return risks.reduce((max, risk) => (risk > max ? risk : max), 0 as IntelligenceRiskLevel);
}

function explainModelNeed(input: IntelligenceModelRoutingInput): string[] {
  const needs = [
    input.needsCode ? 'coding' : '',
    input.needsLongContext ? 'long-context' : '',
    input.needsToolUse ? 'tool-use' : '',
    input.needsSecurityReasoning ? 'security-reasoning' : '',
  ].filter(Boolean);
  return [`Routing needs: ${needs.length ? needs.join(', ') : 'fast-general'}.`];
}

function extractCapabilityTarget(text: string): string | null {
  const normalized = text.replace(/\[redacted-secret\]/g, '').trim();
  const patterns = [
    /\b(?:canal|channel|mcp|plugin|skill|capacidade|capability)\s+([a-z0-9_.:-][a-z0-9_.:\-\s]{1,48})/i,
    /\b(?:pelo|pela|via|atraves do|atraves da|atraves de)\s+([a-z0-9_.:-][a-z0-9_.:\-\s]{1,48})/i,
    /\b(?:configurar|conectar|integrar|instalar|usar)\s+(?:meu|minha|o|a|um|uma)?\s*([a-z0-9_.:-][a-z0-9_.:\-\s]{1,48})/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(normalized);
    const value = match?.[1]?.replace(/[?.!,;]+$/g, '').trim();
    if (value && !/\b(voce|zavorth|mim|para|atraves|pelo|pela)\b/i.test(value)) {
      return value;
    }
  }
  return null;
}

function findCapability(
  hub: Pick<ZavorthCapabilityHubApiService, 'list' | 'inspect'>,
  target: string,
): CapabilityHubItem | null {
  const direct = hub.inspect(target).item;
  if (direct) return direct;
  const matches = hub.list({ search: target });
  return matches[0] || null;
}

function slugify(value: string): string {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';
}
