import type {
  UniversalAgentRun,
  UniversalToolRiskLevel,
} from './UniversalAgentRuntimeTypes.js';

export const SAFETY_NARRATIVE_CONTRACT_VERSION = '2026-05-03.safety-narrative' as const;

export type SafetyNarrativeStatus =
  | 'clear'
  | 'explaining'
  | 'waiting-approval'
  | 'blocked'
  | 'failed';

export type SafetyNarrativeReasonKind =
  | 'approval-required'
  | 'preview-required'
  | 'workspace-policy'
  | 'trust-slider'
  | 'imported-capability-quarantine'
  | 'watch-mode-policy'
  | 'risk-review'
  | 'executor-failure'
  | 'preview-only'
  | 'unknown';

export type SafetyNarrativeReason = {
  id: string;
  kind: SafetyNarrativeReasonKind;
  title: string;
  detail: string;
  risk: UniversalToolRiskLevel;
  source: string;
  toolIds: string[];
  redactionApplied: boolean;
};

export type SafetyNarrativeAlternative = {
  id: string;
  label: string;
  detail: string;
  commandHint?: string;
  safe: true;
  requiresApproval: boolean;
};

export type SafetyNarrativeSnapshot = {
  contractVersion: typeof SAFETY_NARRATIVE_CONTRACT_VERSION;
  source: 'SafetyNarrativeService';
  generatedAt: string;
  status: SafetyNarrativeStatus;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  highRiskBlockPresent: boolean;
  summary: string;
  userMessage: string;
  reasons: SafetyNarrativeReason[];
  alternatives: SafetyNarrativeAlternative[];
  redaction: {
    pathRedactionApplied: boolean;
    secretRedactionApplied: boolean;
    sensitivePathCount: number;
    secretCount: number;
    rawSecretSerialized: false;
  };
  policy: {
    naturalLanguageDoesNotBypassPolicy: true;
    alternativesDoNotExecute: true;
    workspaceBoundaryRespected: true;
    approvalsRemainRequired: boolean;
    previewRemainsRequired: boolean;
    quarantineRemainsRequired: boolean;
  };
  receipts: Array<{
    id: string;
    kind: 'reason' | 'alternative' | 'redaction' | 'policy';
    detail: string;
  }>;
  surface: {
    cliCommand: string;
    commandCenterPath: string;
  };
  nextSafeAction: string;
};

export type SafetyNarrativeInput = {
  run: UniversalAgentRun;
  generatedAt?: string | null;
};

type Redactor = {
  sanitize: (value: unknown) => string;
  pathRedactionApplied: () => boolean;
  secretRedactionApplied: () => boolean;
  sensitivePathCount: () => number;
  secretCount: () => number;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((entry) => normalizeText(entry)).filter(Boolean)));
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function riskScore(risk: UniversalToolRiskLevel): number {
  if (risk === 'danger') {
    return 3;
  }
  if (risk === 'attention') {
    return 2;
  }
  if (risk === 'unknown') {
    return 1;
  }
  return 0;
}

function maxRisk(values: UniversalToolRiskLevel[]): UniversalToolRiskLevel {
  const score = Math.max(0, ...values.map(riskScore));
  if (score >= 3) {
    return 'danger';
  }
  if (score === 2) {
    return 'attention';
  }
  if (score === 1) {
    return 'unknown';
  }
  return 'safe';
}

function normalizeRisk(value: unknown): UniversalToolRiskLevel {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'safe' || raw === 'attention' || raw === 'danger' || raw === 'unknown') {
    return raw;
  }
  if (raw.includes('danger') || raw.includes('high')) {
    return 'danger';
  }
  if (raw.includes('attention') || raw.includes('warn') || raw.includes('medium')) {
    return 'attention';
  }
  if (raw.includes('safe') || raw.includes('low')) {
    return 'safe';
  }
  return 'unknown';
}

function createRedactor(): Redactor {
  let pathCount = 0;
  let secretCount = 0;
  const secretPattern = /\b(?:api[_-]?key|token|secret|password|authorization)\s*[:=]\s*["']?[^,\s"']+/gi;
  const bearerPattern = /\b(?:sk|pk|ghp|xoxb|xoxp)-[A-Za-z0-9_-]{10,}\b/g;
  const windowsPathPattern = /[A-Za-z]:\\(?:[^\\\s"'`<>|]+\\)*[^\\\s"'`<>|]+/g;
  const unixPathPattern = /\/(?:Users|home|var|tmp|mnt|workspace|repo|project|etc)\/[^\s"'`<>|]+/g;
  return {
    sanitize(value: unknown): string {
      let text = normalizeText(value);
      text = text.replace(secretPattern, () => {
        secretCount += 1;
        return '<redacted-secret>';
      });
      text = text.replace(bearerPattern, () => {
        secretCount += 1;
        return '<redacted-secret>';
      });
      text = text.replace(windowsPathPattern, () => {
        pathCount += 1;
        return '<workspace-path>';
      });
      text = text.replace(unixPathPattern, () => {
        pathCount += 1;
        return '<workspace-path>';
      });
      return text;
    },
    pathRedactionApplied: () => pathCount > 0,
    secretRedactionApplied: () => secretCount > 0,
    sensitivePathCount: () => pathCount,
    secretCount: () => secretCount,
  };
}

function reasonRedacted(redactor: Redactor, before: string, after: string): boolean {
  return before !== after || redactor.pathRedactionApplied() || redactor.secretRedactionApplied();
}

export class SafetyNarrativeService {
  private readonly now: () => Date;

  constructor(runtime: { now?: () => Date } = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: SafetyNarrativeInput): SafetyNarrativeSnapshot {
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const redactor = createRedactor();
    const reasons = this.buildReasons(input.run, redactor);
    const alternatives = this.buildAlternatives(input.run, reasons, redactor);
    const highestRisk = maxRisk(reasons.map((reason) => reason.risk));
    const highRiskBlockPresent = reasons.some((reason) => reason.risk === 'danger')
      || input.run.status === 'waiting_approval'
      || input.run.status === 'failed';
    const approvalsRemainRequired = input.run.approvals.some((approval) => approval.status === 'pending')
      || input.run.toolExposure.tools.some((tool) => tool.requiresApproval)
      || reasons.some((reason) => reason.kind === 'approval-required');
    const previewRemainsRequired = reasons.some((reason) => reason.kind === 'preview-required' || reason.kind === 'preview-only');
    const quarantineRemainsRequired = reasons.some((reason) => reason.kind === 'imported-capability-quarantine');
    const status = this.resolveStatus(input.run, reasons);
    const summary = this.buildSummary(status, highestRisk, reasons);
    const nextSafeAction = this.nextSafeAction({
      approvalsRemainRequired,
      previewRemainsRequired,
      quarantineRemainsRequired,
      status,
    });
    const userMessage = this.buildUserMessage({
      summary,
      reasons,
      alternatives,
      nextSafeAction,
    });

    return {
      contractVersion: SAFETY_NARRATIVE_CONTRACT_VERSION,
      source: 'SafetyNarrativeService',
      generatedAt,
      status,
      identifiers: {
        runId: input.run.id,
        traceId: input.run.traceId,
        requestId: input.run.requestId,
        sessionId: input.run.sessionId,
      },
      highRiskBlockPresent,
      summary,
      userMessage,
      reasons,
      alternatives,
      redaction: {
        pathRedactionApplied: redactor.pathRedactionApplied(),
        secretRedactionApplied: redactor.secretRedactionApplied(),
        sensitivePathCount: redactor.sensitivePathCount(),
        secretCount: redactor.secretCount(),
        rawSecretSerialized: false,
      },
      policy: {
        naturalLanguageDoesNotBypassPolicy: true,
        alternativesDoNotExecute: true,
        workspaceBoundaryRespected: true,
        approvalsRemainRequired,
        previewRemainsRequired,
        quarantineRemainsRequired,
      },
      receipts: this.buildReceipts({
        reasons,
        alternatives,
        redactor,
      }),
      surface: {
        cliCommand: 'zavorth safety "<pedido>" --json',
        commandCenterPath: '/control?sector=overview',
      },
      nextSafeAction,
    };
  }

  private buildReasons(run: UniversalAgentRun, redactor: Redactor): SafetyNarrativeReason[] {
    const reasons: SafetyNarrativeReason[] = [];
    const addReason = (reason: Omit<SafetyNarrativeReason, 'detail' | 'redactionApplied'> & { detail: string }) => {
      if (reasons.some((entry) => entry.id === reason.id)) {
        return;
      }
      const detail = redactor.sanitize(reason.detail);
      reasons.push({
        ...reason,
        detail,
        redactionApplied: reasonRedacted(redactor, reason.detail, detail),
      });
    };

    const approvalToolIds = run.toolExposure.tools
      .filter((tool) => tool.requiresApproval)
      .map((tool) => tool.id);
    for (const approval of run.approvals.filter((entry) => entry.status === 'pending')) {
      addReason({
        id: `safety:approval:${approval.id}`,
        kind: 'approval-required',
        title: 'Approval obrigatorio antes da execucao',
        detail: `Bloqueei porque ${approval.reason}`,
        risk: approval.risk,
        source: 'approval-gate',
        toolIds: approvalToolIds,
      });
    }

    const blockedTools = run.toolExposure.blockedTools || [];
    for (const blockedTool of blockedTools) {
      addReason({
        id: `safety:blocked-tool:${blockedTool.id}`,
        kind: 'imported-capability-quarantine',
        title: 'Tool bloqueada por policy ou quarentena',
        detail: `${blockedTool.label} ficou bloqueada por ${blockedTool.reason}.`,
        risk: 'danger',
        source: 'ToolExposurePolicy',
        toolIds: [blockedTool.id],
      });
    }

    const trustSlider = recordOrNull(run.metadata.trustSlider);
    if (trustSlider?.blocked === true) {
      addReason({
        id: 'safety:trust-slider',
        kind: 'trust-slider',
        title: 'Trust Slider bloqueou a execucao',
        detail: normalizeText(trustSlider.reason, 'Trust Slider bloqueou a execucao por escopo ou permissao.'),
        risk: 'danger',
        source: 'TrustSliderPolicyService',
        toolIds: approvalToolIds,
      });
    }

    const preview = recordOrNull(run.metadata.universalPreviewMode);
    const previewRisk = recordOrNull(preview?.risk);
    if (preview?.mode === 'preview-only') {
      addReason({
        id: 'safety:preview-only',
        kind: 'preview-only',
        title: 'Executor bloqueado pelo Universal Preview',
        detail: 'O pedido entrou em preview-only; nenhuma tool deve ser chamada nesse modo.',
        risk: normalizeRisk(previewRisk?.highestRisk),
        source: 'UniversalPreviewModeService',
        toolIds: normalizeList(previewRisk?.approvalRequiredToolIds),
      });
    }
    if (previewRisk?.previewRequired === true) {
      addReason({
        id: 'safety:preview-required',
        kind: 'preview-required',
        title: 'Preview especifico obrigatorio',
        detail: 'A acao exige preview especifico antes de apply ou rollback.',
        risk: normalizeRisk(previewRisk.highestRisk),
        source: 'UniversalPreviewModeService',
        toolIds: normalizeList(previewRisk.previewRequiredToolIds),
      });
    }

    const watchMode = recordOrNull(run.metadata.watchModeVisualProposal);
    if (watchMode?.blocked === true) {
      addReason({
        id: 'safety:watch-mode-policy',
        kind: 'watch-mode-policy',
        title: 'Watch Mode visual bloqueado',
        detail: normalizeText(watchMode.blockedReason, 'Watch Mode visual precisa de allowlist e targetWindow antes de approval.'),
        risk: 'danger',
        source: 'AgentRunService.watch-mode',
        toolIds: normalizeList([watchMode.toolId]),
      });
    }

    const failure = recordOrNull(run.metadata.failureSemantics);
    if (failure) {
      addReason({
        id: 'safety:executor-failure',
        kind: 'executor-failure',
        title: 'Falha estruturada preservou seguranca',
        detail: normalizeText(failure.message, run.summary),
        risk: 'attention',
        source: normalizeText(failure.source, 'FailureSemanticsRegistry'),
        toolIds: approvalToolIds,
      });
    }

    const lifecycleDefense = recordOrNull(run.metadata.lifecycleDefense);
    for (const [phase, rawReview] of Object.entries(lifecycleDefense || {})) {
      const review = recordOrNull(rawReview);
      if (!review || review.blocked !== true) {
        continue;
      }
      addReason({
        id: `safety:risk-review:${phase}`,
        kind: 'risk-review',
        title: 'Risk review bloqueou o executor',
        detail: normalizeText(review.summary, `Risk review ${phase} bloqueou execucao sensivel.`),
        risk: normalizeRisk(review.risk),
        source: 'AgentRunRiskHooks',
        toolIds: normalizeList(review.approvalRequiredToolIds ?? review.toolIds),
      });
    }

    if (reasons.length === 0 && run.toolExposure.tools.some((tool) => tool.requiresApproval || tool.risk === 'danger')) {
      addReason({
        id: 'safety:tool-exposure',
        kind: 'approval-required',
        title: 'Ferramenta sensivel detectada',
        detail: 'A policy de tools marcou uma acao como sensivel; approvals continuam obrigatorios antes do executor.',
        risk: maxRisk(run.toolExposure.tools.map((tool) => tool.risk)),
        source: 'ToolExposurePolicy',
        toolIds: approvalToolIds,
      });
    }

    return reasons;
  }

  private buildAlternatives(
    run: UniversalAgentRun,
    reasons: SafetyNarrativeReason[],
    redactor: Redactor,
  ): SafetyNarrativeAlternative[] {
    const alternatives: SafetyNarrativeAlternative[] = [];
    const addAlternative = (alternative: SafetyNarrativeAlternative) => {
      if (!alternatives.some((entry) => entry.id === alternative.id)) {
        alternatives.push({
          ...alternative,
          detail: redactor.sanitize(alternative.detail),
          commandHint: alternative.commandHint ? redactor.sanitize(alternative.commandHint) : undefined,
        });
      }
    };

    if (reasons.some((reason) => reason.kind === 'approval-required' || reason.kind === 'risk-review')) {
      addAlternative({
        id: 'safety:alternative:approval',
        label: 'Pedir approval governado',
        detail: 'Revise o plano e aprove somente as tools sensiveis realmente necessarias.',
        commandHint: 'zavorth approvals list',
        safe: true,
        requiresApproval: true,
      });
    }
    if (reasons.some((reason) => reason.kind === 'preview-required' || reason.kind === 'preview-only')) {
      addAlternative({
        id: 'safety:alternative:preview',
        label: 'Rodar preview antes do apply',
        detail: 'Use preview para ver plano, risco e impacto sem tocar arquivos nem executor.',
        commandHint: 'zavorth preview "<pedido>" --json',
        safe: true,
        requiresApproval: false,
      });
    }
    if (reasons.some((reason) => reason.kind === 'workspace-policy' || reason.kind === 'trust-slider')) {
      addAlternative({
        id: 'safety:alternative:workspace-patch',
        label: 'Reduzir para patch dentro do workspace',
        detail: 'Transforme a acao em diff/patch dentro do projeto em vez de escrever fora do limite permitido.',
        safe: true,
        requiresApproval: false,
      });
    }
    if (reasons.some((reason) => reason.kind === 'imported-capability-quarantine')) {
      addAlternative({
        id: 'safety:alternative:quarantine',
        label: 'Usar ferramenta segura ou revisar quarentena',
        detail: 'Escolha uma capability ja confiavel ou revise o trust report antes de liberar a tool importada.',
        safe: true,
        requiresApproval: true,
      });
    }
    if (reasons.some((reason) => reason.kind === 'watch-mode-policy')) {
      addAlternative({
        id: 'safety:alternative:watch-mode-scope',
        label: 'Declarar alvo visual e allowlist',
        detail: 'Informe targetWindow e policy allowlisted antes de pedir approval para Computer Use.',
        safe: true,
        requiresApproval: true,
      });
    }
    if (alternatives.length === 0) {
      addAlternative({
        id: 'safety:alternative:read-only',
        label: 'Continuar em modo leitura',
        detail: 'Responder, resumir ou planejar sem executar tools mutaveis.',
        safe: true,
        requiresApproval: false,
      });
    }
    if (run.status === 'failed') {
      addAlternative({
        id: 'safety:alternative:retry-small',
        label: 'Repetir com escopo menor',
        detail: 'Separe leitura, plano e execucao em passos menores para preservar auditabilidade.',
        safe: true,
        requiresApproval: false,
      });
    }
    return alternatives.slice(0, 6);
  }

  private resolveStatus(run: UniversalAgentRun, reasons: SafetyNarrativeReason[]): SafetyNarrativeStatus {
    if (run.status === 'waiting_approval') {
      return 'waiting-approval';
    }
    if (run.status === 'failed' && reasons.length > 0) {
      return reasons.some((reason) => reason.kind === 'executor-failure') ? 'failed' : 'blocked';
    }
    if (reasons.some((reason) => reason.kind === 'preview-only')) {
      return 'explaining';
    }
    return reasons.length > 0 ? 'explaining' : 'clear';
  }

  private buildSummary(
    status: SafetyNarrativeStatus,
    risk: UniversalToolRiskLevel,
    reasons: SafetyNarrativeReason[],
  ): string {
    if (status === 'clear') {
      return 'Nenhum bloqueio high-risk foi encontrado neste run.';
    }
    if (status === 'waiting-approval') {
      return `Safety Narrative: ${reasons.length} motivo(s) explicam o approval pendente com risco ${risk}.`;
    }
    if (status === 'blocked') {
      return `Safety Narrative: execucao bloqueada com ${reasons.length} motivo(s) legiveis.`;
    }
    if (status === 'failed') {
      return `Safety Narrative: falha estruturada explicada sem vazar segredos.`;
    }
    return `Safety Narrative: ${reasons.length} motivo(s) de seguranca documentado(s).`;
  }

  private buildUserMessage(input: {
    summary: string;
    reasons: SafetyNarrativeReason[];
    alternatives: SafetyNarrativeAlternative[];
    nextSafeAction: string;
  }): string {
    if (input.reasons.length === 0) {
      return [
        input.summary,
        `Proximo passo seguro: ${input.nextSafeAction}`,
      ].join('\n');
    }
    const primary = input.reasons[0];
    const lines = [
      `Bloqueei por seguranca: ${primary.title}.`,
      primary.detail,
      '',
      'Alternativas seguras:',
      ...input.alternatives.slice(0, 4).map((alternative) => `- ${alternative.label}: ${alternative.detail}`),
      '',
      `Proximo passo seguro: ${input.nextSafeAction}`,
      'Linguagem natural nao desativa approvals, preview, workspace policy ou quarentena.',
    ];
    return lines.join('\n');
  }

  private nextSafeAction(input: {
    approvalsRemainRequired: boolean;
    previewRemainsRequired: boolean;
    quarantineRemainsRequired: boolean;
    status: SafetyNarrativeStatus;
  }): string {
    if (input.quarantineRemainsRequired) {
      return 'Resolver quarentena ou escolher uma capability confiavel antes de executar.';
    }
    if (input.previewRemainsRequired) {
      return 'Gerar/revisar preview especifico antes de qualquer apply real.';
    }
    if (input.approvalsRemainRequired) {
      return 'Revisar o plano e aprovar explicitamente as tools sensiveis.';
    }
    if (input.status === 'failed') {
      return 'Repetir com escopo menor ou transformar em plano read-only.';
    }
    return 'Continuar pelo runtime governado normal.';
  }

  private buildReceipts(input: {
    reasons: SafetyNarrativeReason[];
    alternatives: SafetyNarrativeAlternative[];
    redactor: Redactor;
  }): SafetyNarrativeSnapshot['receipts'] {
    const receipts: SafetyNarrativeSnapshot['receipts'] = [
      ...input.reasons.slice(0, 8).map((reason) => ({
        id: `safety-narrative:reason:${reason.id}`,
        kind: 'reason' as const,
        detail: `${reason.kind}: ${reason.title}`,
      })),
      ...input.alternatives.slice(0, 4).map((alternative) => ({
        id: `safety-narrative:alternative:${alternative.id}`,
        kind: 'alternative' as const,
        detail: `${alternative.label}: safe=${String(alternative.safe)}`,
      })),
      {
        id: 'safety-narrative:policy',
        kind: 'policy' as const,
        detail: 'Narrativa nao executa tools e nao substitui approvals, preview ou workspace policy.',
      },
    ];
    if (input.redactor.pathRedactionApplied() || input.redactor.secretRedactionApplied()) {
      receipts.push({
        id: 'safety-narrative:redaction',
        kind: 'redaction',
        detail: 'Dados sensiveis foram redigidos antes de montar a narrativa.',
      });
    }
    return receipts;
  }
}
