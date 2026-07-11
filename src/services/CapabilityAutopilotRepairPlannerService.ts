import type {
  CapabilityDiagnosis,
  CapabilityFallbackOption,
  CapabilityFailureKind,
  CapabilityOperationalDescriptor,
  CapabilityPermissionRequirement,
  CapabilityReadinessSnapshot,
  CapabilityRepairPlan,
  CapabilityRepairPlanStatus,
  CapabilityRepairStep,
  CapabilityRepairStepKind,
  CapabilityTrustLevel,
  CapabilityValidationStep,
  OriginalIntentEnvelope,
} from '../contracts/CapabilityAutopilotContract.js';
import { CapabilityAutopilotDiagnosisService } from './CapabilityAutopilotDiagnosisService.js';

import { CapabilityAutopilotReadinessService } from './CapabilityAutopilotReadinessService.js';

type CapabilityAutopilotReadinessLike = Pick<
  CapabilityAutopilotReadinessService,
  'buildReadinessSnapshot' | 'getOperationalDescriptor'
>;
type CapabilityAutopilotDiagnosisLike = Pick<
  CapabilityAutopilotDiagnosisService,
  'diagnoseReadiness'
>;

export type CapabilityRepairPlanContext = {
  descriptor?: CapabilityOperationalDescriptor | null;
  readiness?: CapabilityReadinessSnapshot | null;
  resumeIntent?: OriginalIntentEnvelope | null;
};

export type CapabilityAutopilotRepairPlannerRuntime = {
  now?: () => Date;
  readinessService?: CapabilityAutopilotReadinessLike;
  diagnosisService?: CapabilityAutopilotDiagnosisLike;
};

type RepairPosture = {
  riskLevel: number;
  trustLevelRequired: CapabilityTrustLevel;
  status: CapabilityRepairPlanStatus;
};

type RepairPlanDraft = {
  permissionRequirements: CapabilityPermissionRequirement[];
  steps: CapabilityRepairStep[];
  validators: CapabilityValidationStep[];
  fallbackOptions: CapabilityFallbackOption[];
};

export class CapabilityAutopilotRepairPlannerService {
  private readonly now: () => Date;
  private readonly readinessService: CapabilityAutopilotReadinessLike;
  private readonly diagnosisService: CapabilityAutopilotDiagnosisLike;

  constructor(runtime: CapabilityAutopilotRepairPlannerRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.readinessService = runtime.readinessService || new CapabilityAutopilotReadinessService();
    this.diagnosisService = runtime.diagnosisService || new CapabilityAutopilotDiagnosisService({
      readinessService: this.readinessService,
    });
  }

  public async buildRepairPlan(
    capabilityId: string,
    resumeIntent: OriginalIntentEnvelope | null = null,
  ): Promise<CapabilityRepairPlan> {
    const descriptor = this.readinessService.getOperationalDescriptor(capabilityId);
    const readiness = await this.readinessService.buildReadinessSnapshot(capabilityId);
    const diagnosis = this.diagnosisService.diagnoseReadiness(readiness, descriptor);
    return this.planFromDiagnosis(diagnosis, { descriptor, readiness, resumeIntent });
  }

  public planFromDiagnosis(
    diagnosis: CapabilityDiagnosis,
    context: CapabilityRepairPlanContext = {},
  ): CapabilityRepairPlan {
    const descriptor = context.descriptor || null;
    const readiness = context.readiness || null;
    const generatedAt = this.now().toISOString();
    const posture = this.resolvePosture(diagnosis);
    const draft = this.buildDraft(diagnosis, descriptor, readiness, context.resumeIntent || null);

    return {
      repairPlanId: this.buildRepairPlanId(diagnosis.capabilityId, generatedAt),
      capabilityId: diagnosis.capabilityId,
      diagnosisId: diagnosis.diagnosisId,
      createdAt: generatedAt,
      status: posture.status,
      summary: this.buildSummary(diagnosis, descriptor, readiness),
      riskLevel: posture.riskLevel,
      trustLevelRequired: posture.trustLevelRequired,
      permissionRequirements: draft.permissionRequirements,
      steps: draft.steps,
      validators: draft.validators,
      fallbackOptions: draft.fallbackOptions,
      resumeIntent: context.resumeIntent || null,
      metadata: {
        gate: 'capability-autopilot-repair-planner',
        readOnly: true,
        failureKind: diagnosis.failureKind,
        readinessStatus: readiness?.status || diagnosis.status,
      },
    };
  }

  private buildDraft(
    diagnosis: CapabilityDiagnosis,
    descriptor: CapabilityOperationalDescriptor | null,
    readiness: CapabilityReadinessSnapshot | null,
    resumeIntent: OriginalIntentEnvelope | null,
  ): RepairPlanDraft {
    const permissionRequirements = this.buildPermissionRequirements(diagnosis, descriptor, readiness);
    const steps = this.buildSteps(diagnosis, descriptor, readiness, permissionRequirements, resumeIntent);
    const validators = this.buildValidators(diagnosis, descriptor, readiness);
    const fallbackOptions = this.buildFallbackOptions(diagnosis, descriptor);

    return {
      permissionRequirements,
      steps,
      validators,
      fallbackOptions,
    };
  }

  private buildPermissionRequirements(
    diagnosis: CapabilityDiagnosis,
    descriptor: CapabilityOperationalDescriptor | null,
    readiness: CapabilityReadinessSnapshot | null,
  ): CapabilityPermissionRequirement[] {
    if (diagnosis.status === 'ready' || !diagnosis.repairable) {
      return [];
    }

    const target = descriptor?.executor?.executorName || descriptor?.integration?.integrationId || diagnosis.capabilityId;
    const base = {
      requestedValue: target,
      resolvedValue: target,
      metadata: {
        capabilityId: diagnosis.capabilityId,
        failureKind: diagnosis.failureKind,
        blockingReason: readiness?.blockingReason || null,
      },
    };

    switch (diagnosis.failureKind) {
      case 'missing_binary':
        return [{
          id: this.buildPermissionId(diagnosis.capabilityId, 'install_binary', 'host'),
          kind: 'install_binary',
          scope: 'host',
          reason: 'Instalar ou localizar uma ferramenta local exige permissao no host.',
          riskLevel: 7,
          trustLevelRequired: 'collaborator',
          ...base,
        }];
      case 'missing_secret':
      case 'missing_auth':
        return [{
          id: this.buildPermissionId(diagnosis.capabilityId, 'provide_secret', 'session'),
          kind: diagnosis.failureKind === 'missing_auth' ? 'authenticate' : 'provide_secret',
          scope: 'session',
          reason: 'Credenciais e login precisam ser fornecidos pelo usuario ou aprovados para a sessao.',
          riskLevel: 5,
          trustLevelRequired: 'collaborator',
          ...base,
        }];
      case 'missing_runtime':
        return [{
          id: this.buildPermissionId(diagnosis.capabilityId, 'prepare_runtime', 'host'),
          kind: 'prepare_runtime',
          scope: 'host',
          reason: 'Preparar Docker, browser, servico local ou runtime auxiliar muda o ambiente do host.',
          riskLevel: 8,
          trustLevelRequired: 'overlord',
          ...base,
        }];
      case 'executor_unavailable':
      case 'probe_failed':
      case 'remote_unhealthy':
        return [{
          id: this.buildPermissionId(diagnosis.capabilityId, 'run_diagnostics', 'session'),
          kind: 'run_diagnostics',
          scope: 'session',
          reason: 'Diagnosticar a capability pode executar doctor, probe ou smoke test controlado.',
          riskLevel: 4,
          trustLevelRequired: 'collaborator',
          ...base,
        }];
      case 'permission_required':
        return [{
          id: this.buildPermissionId(diagnosis.capabilityId, 'enable_capability', 'session'),
          kind: 'enable_capability',
          scope: 'session',
          reason: 'A capability precisa ser habilitada antes de executar.',
          riskLevel: 4,
          trustLevelRequired: 'collaborator',
          ...base,
        }];
      default:
        return [];
    }
  }

  private buildSteps(
    diagnosis: CapabilityDiagnosis,
    descriptor: CapabilityOperationalDescriptor | null,
    readiness: CapabilityReadinessSnapshot | null,
    permissionRequirements: CapabilityPermissionRequirement[],
    resumeIntent: OriginalIntentEnvelope | null,
  ): CapabilityRepairStep[] {
    const permissionIds = permissionRequirements.map((entry) => entry.id);
    const steps: CapabilityRepairStep[] = [
      this.step('explain-problem', 'explain', 'Explicar o problema', diagnosis.rootCause, [], 'Usuario entende o bloqueio antes de qualquer acao.'),
    ];

    if (diagnosis.status === 'ready') {
      steps.push(this.step(
        'no-repair-needed',
        'noop',
        'Nenhum reparo necessario',
        'Readiness atual ja esta saudavel.',
        [],
        'A capability pode seguir para execucao normal.',
      ));
      if (resumeIntent) {
        steps.push(this.buildResumeStep(resumeIntent, []));
      }
      return steps;
    }

    if (!diagnosis.repairable) {
      steps.push(this.step(
        'ask-for-context',
        'ask_user',
        'Pedir contexto adicional',
        'A falha ainda nao tem reparo seguro suficiente para propor automacao.',
        [],
        'Usuario fornece contexto ou escolhe outra capability.',
      ));
      return steps;
    }

    steps.push(this.step(
      'request-permission',
      'ask_user',
      'Pedir permissao contextual',
      this.buildPermissionSummary(permissionRequirements),
      permissionIds,
      'Permissao aprovada com escopo explicito antes do reparo.',
    ));

    switch (diagnosis.failureKind) {
      case 'missing_binary':
        steps.push(this.step(
          'prepare-binary',
          'install_binary',
          'Preparar binario local',
          this.buildMissingBinarySummary(readiness),
          permissionIds,
          'Binario fica instalado ou visivel no PATH.',
        ));
        break;
      case 'missing_secret':
        steps.push(this.step(
          'collect-secret',
          'set_env',
          'Coletar secret ou env ausente',
          'Solicitar valor ao usuario ou orientar configuracao segura no storage existente.',
          permissionIds,
          'Credencial fica disponivel somente no escopo aprovado.',
        ));
        break;
      case 'missing_auth':
        steps.push(this.step(
          'authenticate',
          'authenticate',
          'Concluir autenticacao',
          'Guiar login, account setup ou troca de credencial sem capturar senha em texto claro.',
          permissionIds,
          'Autenticacao fica pronta para novo probe.',
        ));
        break;
      case 'missing_runtime':
        steps.push(this.step(
          'prepare-runtime',
          'start_service',
          'Preparar runtime auxiliar',
          'Preparar Docker, browser, sidecar ou servico necessario conforme policy.',
          permissionIds,
          'Runtime auxiliar fica pronto ou falha com evidencia.',
        ));
        break;
      case 'executor_unavailable':
        steps.push(this.step(
          'repair-executor',
          'run_command',
          'Diagnosticar executor',
          `Executar doctor/smoke controlado para ${descriptor?.executor?.executorName || diagnosis.capabilityId}.`,
          permissionIds,
          'Executor fica disponivel ou fallback e apresentado.',
        ));
        break;
      case 'probe_failed':
      case 'remote_unhealthy':
        steps.push(this.step(
          'rerun-health-check',
          'validate',
          'Reexecutar health check',
          'Rodar probe/doctor apropriado e guardar evidencia antes de retomar.',
          permissionIds,
          'Probe passa ou falha com causa mais especifica.',
        ));
        break;
      case 'permission_required':
        steps.push(this.step(
          'enable-capability',
          'ask_user',
          'Habilitar capability no escopo aprovado',
          'Aplicar enablement somente depois do approval contextual.',
          permissionIds,
          'Capability deixa de estar bloqueada por lifecycle/approval.',
        ));
        break;
      default:
        steps.push(this.step(
          'manual-repair',
          'manual',
          'Reparo manual supervisionado',
          'Sem receita automatica segura nesta etapa.',
          permissionIds,
          'Operador decide proximo caminho.',
        ));
    }

    steps.push(this.step(
      'validate-repair',
      'validate',
      'Validar reparo',
      'Recalcular readiness e confirmar que a capability ficou pronta.',
      [],
      'Readiness muda para ready antes de retomar.',
    ));

    if (resumeIntent) {
      steps.push(this.buildResumeStep(resumeIntent, []));
    }

    return steps;
  }

  private buildValidators(
    diagnosis: CapabilityDiagnosis,
    descriptor: CapabilityOperationalDescriptor | null,
    readiness: CapabilityReadinessSnapshot | null,
  ): CapabilityValidationStep[] {
    const validators: CapabilityValidationStep[] = [
      {
        id: 'readiness-snapshot',
        title: 'Recalcular readiness',
        kind: 'manual',
        target: diagnosis.capabilityId,
        successCondition: 'CapabilityReadinessSnapshot.ready deve ser true antes de retomar.',
        required: true,
      },
    ];

    if (readiness?.probe) {
      validators.push({
        id: 'integration-probe',
        title: 'Validar probe da integracao',
        kind: 'probe',
        target: readiness.probe.checkedTarget || readiness.probe.integrationId,
        successCondition: 'Probe deve retornar status ok.',
        required: true,
      });
    }

    if (descriptor?.executor?.executorName) {
      validators.push({
        id: 'executor-smoke',
        title: 'Validar executor',
        kind: 'executor_smoke',
        target: descriptor.executor.executorName,
        successCondition: 'Executor deve responder como disponivel antes da execucao real.',
        required: descriptor.type === 'executor',
      });
    }

    return validators;
  }

  private buildFallbackOptions(
    diagnosis: CapabilityDiagnosis,
    descriptor: CapabilityOperationalDescriptor | null,
  ): CapabilityFallbackOption[] {
    if (diagnosis.status === 'ready' || diagnosis.failureKind === 'policy_blocked') {
      return [];
    }

    const currentExecutor = descriptor?.executor?.executorName || null;
    const candidates = ['local', 'codex', 'external_executor', 'gemini_cli']
      .filter((executorName) => executorName !== currentExecutor);

    return [
      ...candidates.map((executorName) => ({
        id: `fallback-${executorName}`,
        label: `Tentar ${executorName}`,
        executorName,
        capabilityId: null,
        reason: `Fallback visivel caso ${descriptor?.label || diagnosis.capabilityId} nao possa ser reparado agora.`,
        requiresPermission: true,
        policyAllowed: null,
      })),
      {
        id: 'fallback-manual-guidance',
        label: 'Orientacao manual',
        executorName: null,
        capabilityId: null,
        reason: 'Explicar ao usuario como preparar a ferramenta sem automacao.',
        requiresPermission: false,
        policyAllowed: true,
      },
    ];
  }

  private resolvePosture(diagnosis: CapabilityDiagnosis): RepairPosture {
    if (diagnosis.status === 'ready') {
      return {
        riskLevel: 0,
        trustLevelRequired: 'protected',
        status: 'validated',
      };
    }

    if (!diagnosis.repairable) {
      return {
        riskLevel: 2,
        trustLevelRequired: 'protected',
        status: 'proposed',
      };
    }

    switch (diagnosis.failureKind) {
      case 'missing_runtime':
        return { riskLevel: 8, trustLevelRequired: 'overlord', status: 'approval_required' };
      case 'missing_binary':
        return { riskLevel: 7, trustLevelRequired: 'collaborator', status: 'approval_required' };
      case 'missing_secret':
      case 'missing_auth':
        return { riskLevel: 5, trustLevelRequired: 'collaborator', status: 'approval_required' };
      case 'policy_blocked':
        return { riskLevel: 9, trustLevelRequired: 'overlord', status: 'proposed' };
      case 'permission_required':
      case 'executor_unavailable':
      case 'probe_failed':
      case 'remote_unhealthy':
        return { riskLevel: 4, trustLevelRequired: 'collaborator', status: 'approval_required' };
      default:
        return { riskLevel: 3, trustLevelRequired: 'protected', status: 'proposed' };
    }
  }

  private buildSummary(
    diagnosis: CapabilityDiagnosis,
    descriptor: CapabilityOperationalDescriptor | null,
    readiness: CapabilityReadinessSnapshot | null,
  ): string {
    const label = descriptor?.label || diagnosis.capabilityId;
    if (diagnosis.status === 'ready') {
      return `${label} ja esta pronto; nenhum reparo necessario.`;
    }
    const next = readiness?.suggestedNextAction?.label
      ? ` Proximo passo sugerido: ${readiness.suggestedNextAction.label}.`
      : '';
    return `${label}: plano proposto para ${diagnosis.failureKind}. ${diagnosis.rootCause}.${next}`.trim();
  }

  private buildPermissionSummary(requirements: CapabilityPermissionRequirement[]): string {
    if (requirements.length === 0) {
      return 'Nenhuma permissao adicional foi detectada.';
    }

    return requirements
      .map((entry) => `${entry.kind} (${entry.scope}, risco ${entry.riskLevel})`)
      .join('; ');
  }

  private buildMissingBinarySummary(readiness: CapabilityReadinessSnapshot | null): string {
    const missingBinary = readiness?.missingRequirements.find((entry) => entry.type === 'binary');
    if (!missingBinary) {
      return 'Preparar o binario ausente conforme doctor/manifest da capability.';
    }
    return `${missingBinary.label}: ${missingBinary.description}`;
  }

  private buildResumeStep(
    resumeIntent: OriginalIntentEnvelope,
    permissionIds: string[],
  ): CapabilityRepairStep {
    return this.step(
      'resume-original-intent',
      'resume_original_intent',
      'Retomar pedido original',
      `Retomar: ${resumeIntent.rawText || resumeIntent.normalizedText}`,
      permissionIds,
      'Pedido original volta ao fluxo depois da validacao.',
    );
  }

  private step(
    id: string,
    kind: CapabilityRepairStepKind,
    title: string,
    summary: string,
    permissionIds: string[],
    expectedOutcome: string,
  ): CapabilityRepairStep {
    return {
      id,
      kind,
      title,
      summary,
      command: null,
      installStep: null,
      permissionIds,
      expectedOutcome,
      rollbackHint: null,
      optional: false,
    };
  }

  private buildPermissionId(capabilityId: string, kind: string, scope: string): string {
    return `${this.slug(capabilityId)}-${this.slug(kind)}-${this.slug(scope)}`;
  }

  private buildRepairPlanId(capabilityId: string, generatedAt: string): string {
    return `${this.slug(capabilityId)}-repair-${generatedAt.replace(/[^0-9a-z]+/gi, '')}`;
  }

  private slug(value: string): string {
    return String(value || 'unknown')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unknown';
  }
}
