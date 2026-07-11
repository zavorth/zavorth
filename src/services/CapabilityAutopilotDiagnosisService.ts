import type {
  CapabilityDiagnosis,
  CapabilityDiagnosisNarrative,
  CapabilityFailureKind,
  CapabilityOperationalDescriptor,
  CapabilityReadinessSnapshot,
} from '../contracts/CapabilityAutopilotContract.js';
import type { IntegrationRequirement } from '../contracts/IntegrationHubContract.js';
import { CapabilityAutopilotReadinessService } from './CapabilityAutopilotReadinessService.js';

type CapabilityAutopilotReadinessLike = Pick<
  CapabilityAutopilotReadinessService,
  'buildReadinessSnapshot' | 'getOperationalDescriptor'
>;

export type CapabilityAutopilotDiagnosisRuntime = {
  now?: () => Date;
  readinessService?: CapabilityAutopilotReadinessLike;
};

type CapabilityFailureClassification = {
  failureKind: CapabilityFailureKind;
  rootCause: string;
  confidence: number;
  repairable: boolean;
  requiresUserInput: boolean;
};

export class CapabilityAutopilotDiagnosisService {
  private readonly now: () => Date;
  private readonly readinessService: CapabilityAutopilotReadinessLike;

  constructor(runtime: CapabilityAutopilotDiagnosisRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.readinessService = runtime.readinessService || new CapabilityAutopilotReadinessService();
  }

  public async diagnoseCapability(capabilityId: string): Promise<CapabilityDiagnosis> {
    const descriptor = this.readinessService.getOperationalDescriptor(capabilityId);
    const readiness = await this.readinessService.buildReadinessSnapshot(capabilityId);
    return this.diagnoseReadiness(readiness, descriptor);
  }

  public diagnoseReadiness(
    readiness: CapabilityReadinessSnapshot,
    descriptor: CapabilityOperationalDescriptor | null = null,
  ): CapabilityDiagnosis {
    const generatedAt = this.now().toISOString();
    const classification = this.classify(readiness, descriptor);
    const label = descriptor?.label || readiness.capabilityId;

    return {
      diagnosisId: this.buildDiagnosisId(readiness.capabilityId, generatedAt),
      capabilityId: readiness.capabilityId,
      generatedAt,
      failureKind: classification.failureKind,
      status: readiness.status,
      rootCause: classification.rootCause,
      confidence: classification.confidence,
      repairable: classification.repairable,
      requiresUserInput: classification.requiresUserInput,
      narratives: this.buildNarratives(label, readiness, classification),
      evidence: readiness.evidence,
      relatedExecution: null,
      metadata: {
        gate: 'capability-autopilot-diagnosis',
        readOnly: true,
        readinessStatus: readiness.status,
        blockingReason: readiness.blockingReason || null,
      },
    };
  }

  private classify(
    readiness: CapabilityReadinessSnapshot,
    descriptor: CapabilityOperationalDescriptor | null,
  ): CapabilityFailureClassification {
    if (readiness.ready && readiness.status === 'ready') {
      return {
        failureKind: 'unknown',
        rootCause: 'Nenhuma falha operacional detectada no readiness atual.',
        confidence: 1,
        repairable: false,
        requiresUserInput: false,
      };
    }

    const missingBinary = this.findMissingRequirement(readiness, ['binary']);
    if (missingBinary) {
      return {
        failureKind: 'missing_binary',
        rootCause: `Binario obrigatorio ausente: ${missingBinary.label}.`,
        confidence: 0.94,
        repairable: true,
        requiresUserInput: true,
      };
    }

    const missingSecret = readiness.missingRequirements.find((entry) => entry.secret || entry.type === 'env');
    if (missingSecret) {
      return {
        failureKind: 'missing_secret',
        rootCause: `Credencial, secret ou variavel de ambiente ausente: ${missingSecret.label}.`,
        confidence: 0.9,
        repairable: true,
        requiresUserInput: true,
      };
    }

    const missingAuth = this.findMissingRequirement(readiness, ['account']);
    if (missingAuth || readiness.probe?.status === 'not_configured') {
      return {
        failureKind: 'missing_auth',
        rootCause: missingAuth
          ? `Conta ou autenticacao pendente: ${missingAuth.label}.`
          : readiness.probe?.summary || 'Integracao ainda nao configurada.',
        confidence: 0.86,
        repairable: true,
        requiresUserInput: true,
      };
    }

    const missingRuntime = this.findMissingRequirement(readiness, ['docker', 'browser']);
    if (missingRuntime) {
      return {
        failureKind: 'missing_runtime',
        rootCause: `Runtime auxiliar ausente ou indisponivel: ${missingRuntime.label}.`,
        confidence: 0.84,
        repairable: true,
        requiresUserInput: true,
      };
    }

    if (readiness.executor?.available === false) {
      return {
        failureKind: 'executor_unavailable',
        rootCause: `Executor ${readiness.executor.executorName} indisponivel neste host.`,
        confidence: 0.92,
        repairable: true,
        requiresUserInput: true,
      };
    }

    const blockingReason = String(readiness.blockingReason || '').toLowerCase();
    if (blockingReason.includes('policy')) {
      return {
        failureKind: 'policy_blocked',
        rootCause: readiness.detail || 'Policy bloqueou a capability antes da execucao.',
        confidence: 0.88,
        repairable: false,
        requiresUserInput: true,
      };
    }

    if (
      blockingReason.includes('approval') ||
      blockingReason.includes('permission') ||
      (blockingReason.startsWith('lifecycle:') && descriptor?.lifecycle?.approvalRequired)
    ) {
      return {
        failureKind: 'permission_required',
        rootCause: readiness.detail || 'A capability precisa de aprovacao antes de continuar.',
        confidence: 0.82,
        repairable: true,
        requiresUserInput: true,
      };
    }

    if (readiness.probe?.status === 'failed') {
      return {
        failureKind: 'probe_failed',
        rootCause: readiness.probe.detail || readiness.probe.summary,
        confidence: 0.87,
        repairable: true,
        requiresUserInput: false,
      };
    }

    if (readiness.status === 'degraded') {
      return {
        failureKind: 'remote_unhealthy',
        rootCause: readiness.detail || 'Capability degradada no readiness atual.',
        confidence: 0.68,
        repairable: true,
        requiresUserInput: false,
      };
    }

    if (readiness.status === 'blocked') {
      return {
        failureKind: 'permission_required',
        rootCause: readiness.detail || 'Capability bloqueada ate haver permissao ou mudanca de policy.',
        confidence: 0.72,
        repairable: true,
        requiresUserInput: true,
      };
    }

    return {
      failureKind: 'unknown',
      rootCause: readiness.detail || readiness.summary || 'Readiness ainda desconhecido.',
      confidence: readiness.status === 'unknown' ? 0.45 : 0.35,
      repairable: false,
      requiresUserInput: false,
    };
  }

  private buildNarratives(
    label: string,
    readiness: CapabilityReadinessSnapshot,
    classification: CapabilityFailureClassification,
  ): CapabilityDiagnosisNarrative[] {
    return [
      {
        audience: 'everyday_user',
        headline: this.buildEverydayHeadline(label, classification),
        explanation: this.buildEverydayExplanation(label, readiness, classification),
        technicalDetail: null,
      },
      {
        audience: 'technical_operator',
        headline: this.buildTechnicalHeadline(label, classification),
        explanation: this.buildTechnicalExplanation(readiness, classification),
        technicalDetail: this.buildTechnicalDetail(readiness, classification),
      },
    ];
  }

  private buildEverydayHeadline(
    label: string,
    classification: CapabilityFailureClassification,
  ): string {
    switch (classification.failureKind) {
      case 'missing_binary':
        return `${label} ainda nao esta instalado ou nao foi encontrado.`;
      case 'missing_secret':
      case 'missing_auth':
        return `${label} precisa de login ou chave antes de funcionar.`;
      case 'executor_unavailable':
        return `${label} nao esta disponivel neste computador agora.`;
      case 'policy_blocked':
      case 'permission_required':
        return `${label} precisa da sua permissao antes de continuar.`;
      case 'probe_failed':
      case 'remote_unhealthy':
        return `${label} respondeu com problema no ultimo teste.`;
      case 'unknown':
        return classification.repairable
          ? `${label} precisa de uma checagem antes de continuar.`
          : `${label} nao mostrou um problema claro ainda.`;
      default:
        return `${label} precisa de preparacao antes de rodar.`;
    }
  }

  private buildEverydayExplanation(
    label: string,
    readiness: CapabilityReadinessSnapshot,
    classification: CapabilityFailureClassification,
  ): string {
    if (readiness.ready) {
      return `Tudo indica que ${label} esta pronto. Eu posso seguir sem pedir reparo.`;
    }

    const nextAction = readiness.suggestedNextAction?.label
      ? ` Proximo passo sugerido: ${readiness.suggestedNextAction.label}.`
      : '';

    switch (classification.failureKind) {
      case 'missing_binary':
        return `Eu entendi o que voce quer usar, mas a ferramenta local ainda nao apareceu no computador ou no PATH.${nextAction}`;
      case 'missing_secret':
      case 'missing_auth':
        return `A ferramenta existe como opcao, mas falta uma autorizacao, chave ou login para eu conseguir usar com seguranca.${nextAction}`;
      case 'permission_required':
        return `Eu posso preparar isso, mas antes preciso de uma permissao com escopo claro para nao mexer alem do combinado.${nextAction}`;
      case 'policy_blocked':
        return `A regra de seguranca atual bloqueou essa acao. Eu nao devo contornar isso sozinho.${nextAction}`;
      case 'executor_unavailable':
        return `O caminho escolhido para executar a tarefa nao esta pronto neste host. Posso explicar o que falta antes de tentar qualquer reparo.${nextAction}`;
      case 'probe_failed':
      case 'remote_unhealthy':
        return `O ultimo teste de saude dessa capability falhou. Melhor diagnosticar antes de continuar para evitar erro no meio da tarefa.${nextAction}`;
      default:
        return `${readiness.summary} ${readiness.detail}${nextAction}`.trim();
    }
  }

  private buildTechnicalHeadline(
    label: string,
    classification: CapabilityFailureClassification,
  ): string {
    return `${label}: ${classification.failureKind}`;
  }

  private buildTechnicalExplanation(
    readiness: CapabilityReadinessSnapshot,
    classification: CapabilityFailureClassification,
  ): string {
    return [
      `Readiness=${readiness.status}`,
      `confidence=${classification.confidence}`,
      `repairable=${classification.repairable}`,
      `requiresUserInput=${classification.requiresUserInput}`,
      readiness.blockingReason ? `blockingReason=${readiness.blockingReason}` : null,
    ].filter(Boolean).join('; ');
  }

  private buildTechnicalDetail(
    readiness: CapabilityReadinessSnapshot,
    classification: CapabilityFailureClassification,
  ): string {
    const missing = readiness.missingRequirements
      .map((entry) => `${entry.id}:${entry.type}`)
      .join(', ');
    const targets = readiness.checkedTargets
      .map((entry) => `${entry.kind}:${entry.status}:${entry.value || entry.label}`)
      .join(', ');

    return [
      `rootCause=${classification.rootCause}`,
      missing ? `missingRequirements=${missing}` : null,
      targets ? `checkedTargets=${targets}` : null,
      readiness.probe ? `probe=${readiness.probe.integrationId}:${readiness.probe.status}:${readiness.probe.transport}` : null,
      readiness.executor ? `executor=${readiness.executor.executorName}:${readiness.executor.available}` : null,
    ].filter(Boolean).join(' | ');
  }

  private findMissingRequirement(
    readiness: CapabilityReadinessSnapshot,
    types: IntegrationRequirement['type'][],
  ): IntegrationRequirement | null {
    return readiness.missingRequirements.find((entry) => types.includes(entry.type)) || null;
  }

  private buildDiagnosisId(capabilityId: string, generatedAt: string): string {
    const safeCapabilityId = String(capabilityId || 'unknown')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unknown';
    const safeTimestamp = generatedAt.replace(/[^0-9a-z]+/gi, '');
    return `${safeCapabilityId}-diagnosis-${safeTimestamp}`;
  }
}
