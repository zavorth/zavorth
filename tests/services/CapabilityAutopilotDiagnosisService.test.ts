import { CapabilityAutopilotDiagnosisService } from '../../src/services/CapabilityAutopilotDiagnosisService';
import type {
  CapabilityOperationalDescriptor,
  CapabilityReadinessSnapshot,
} from '../../src/contracts/CapabilityAutopilotContract';
import type { IntegrationRequirement } from '../../src/contracts/IntegrationHubContract';

const FIXED_NOW = new Date('2026-04-25T13:00:00.000Z');

const geminiBinaryRequirement: IntegrationRequirement = {
  id: 'gemini_cli_binary',
  type: 'binary',
  label: 'Gemini CLI binary',
  description: 'Comando gemini precisa estar instalado e visivel no PATH.',
  required: true,
};

const descriptor: CapabilityOperationalDescriptor = {
  capabilityId: 'executor-gemini-cli',
  label: 'Gemini CLI',
  type: 'executor',
  intent: 'code_execution',
  summary: 'Executa tarefas via Gemini CLI.',
  source: 'builtin',
  command: '/gemini',
  tags: ['gemini', 'cli'],
  capability: null,
  lifecycle: {
    manifestId: 'executor-gemini-cli',
    label: 'Gemini CLI',
    state: 'ready',
    activationMode: 'lazy',
    approvalRequired: true,
    approvalScope: 'session',
    fallbackBehavior: 'Perguntar antes de trocar executor.',
    provisioningRecipe: null,
  },
  integration: null,
  executor: {
    executorName: 'gemini_cli',
    requestedExecutorName: 'gemini_cli',
    available: null,
    source: 'registry',
  },
  policy: null,
  hooks: [],
  fallbackMode: 'ask_before_switch',
};

function createService() {
  return new CapabilityAutopilotDiagnosisService({
    now: () => FIXED_NOW,
  });
}

function createSnapshot(overrides: Partial<CapabilityReadinessSnapshot> = {}): CapabilityReadinessSnapshot {
  return {
    capabilityId: 'executor-gemini-cli',
    generatedAt: FIXED_NOW.toISOString(),
    status: 'unknown',
    severity: 'warning',
    ready: false,
    safeToRun: false,
    summary: 'Gemini CLI precisa de checagem.',
    detail: 'A disponibilidade do executor ainda nao foi medida.',
    checkedTargets: [],
    missingRequirements: [],
    blockingReason: 'executor_unknown',
    probe: null,
    executor: {
      executorName: 'gemini_cli',
      requestedExecutorName: 'gemini_cli',
      available: null,
      source: 'registry',
    },
    evidence: [
      {
        kind: 'capability_registry',
        source: 'test',
        summary: 'fixture evidence',
        status: 'unknown',
        timestamp: FIXED_NOW.toISOString(),
      },
    ],
    suggestedNextAction: {
      label: 'Executar probe/doctor antes de reparar',
      reason: 'Readiness desconhecido.',
      repairable: false,
    },
    metadata: {
      test: true,
    },
    ...overrides,
  };
}

describe('CapabilityAutopilotDiagnosisService', () => {
  it('classifies missing binary readiness with everyday and technical narratives', () => {
    const service = createService();
    const snapshot = createSnapshot({
      status: 'missing',
      severity: 'error',
      summary: 'Gemini CLI ainda nao esta pronto.',
      detail: 'Faltam requisitos obrigatorios: Gemini CLI binary.',
      checkedTargets: [
        {
          kind: 'binary',
          label: 'Gemini CLI binary',
          value: 'gemini',
          required: true,
          status: 'missing',
        },
      ],
      missingRequirements: [geminiBinaryRequirement],
      blockingReason: 'Gemini CLI binary',
    });

    const diagnosis = service.diagnoseReadiness(snapshot, descriptor);

    expect(diagnosis).toMatchObject({
      capabilityId: 'executor-gemini-cli',
      failureKind: 'missing_binary',
      status: 'missing',
      repairable: true,
      requiresUserInput: true,
      confidence: 0.94,
    });
    expect(diagnosis.narratives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          audience: 'everyday_user',
          headline: 'Gemini CLI ainda nao esta instalado ou nao foi encontrado.',
        }),
        expect.objectContaining({
          audience: 'technical_operator',
          headline: 'Gemini CLI: missing_binary',
        }),
      ]),
    );
    expect(diagnosis.narratives.find((entry) => entry.audience === 'technical_operator')?.technicalDetail)
      .toContain('gemini_cli_binary:binary');
  });

  it('keeps a healthy readiness as a non-repair diagnosis', () => {
    const service = createService();
    const snapshot = createSnapshot({
      status: 'ready',
      severity: 'info',
      ready: true,
      safeToRun: true,
      summary: 'Gemini CLI esta pronto.',
      detail: 'Nenhum bloqueio encontrado.',
      blockingReason: null,
      executor: {
        executorName: 'gemini_cli',
        requestedExecutorName: 'gemini_cli',
        available: true,
        source: 'registry',
      },
      suggestedNextAction: {
        label: 'Continuar execucao',
        reason: 'Capability pronta.',
        repairable: false,
      },
    });

    const diagnosis = service.diagnoseReadiness(snapshot, descriptor);

    expect(diagnosis).toMatchObject({
      failureKind: 'unknown',
      status: 'ready',
      confidence: 1,
      repairable: false,
      requiresUserInput: false,
    });
    expect(diagnosis.narratives.find((entry) => entry.audience === 'everyday_user')?.explanation)
      .toContain('esta pronto');
  });

  it('classifies failed probes explicitly', () => {
    const service = createService();
    const snapshot = createSnapshot({
      status: 'degraded',
      severity: 'error',
      summary: 'Gemini respondeu com falha no ultimo probe.',
      detail: 'gemini --version falhou.',
      blockingReason: 'probe_failed',
      probe: {
        generatedAt: FIXED_NOW.toISOString(),
        integrationId: 'gemini',
        label: 'Gemini',
        status: 'failed',
        transport: 'cli',
        summary: 'Probe falhou.',
        detail: 'gemini --version retornou erro.',
        checkedTarget: 'gemini --version',
        httpStatus: null,
        latencyMs: null,
      },
    });

    const diagnosis = service.diagnoseReadiness(snapshot, descriptor);

    expect(diagnosis).toMatchObject({
      failureKind: 'probe_failed',
      repairable: true,
      requiresUserInput: false,
    });
    expect(diagnosis.rootCause).toContain('gemini --version');
  });

  it('classifies approval-gated lifecycle blocks as permission required', () => {
    const service = createService();
    const snapshot = createSnapshot({
      status: 'blocked',
      severity: 'warning',
      summary: 'Gemini CLI precisa de preparacao antes de rodar.',
      detail: 'Lifecycle atual: dormant.',
      blockingReason: 'lifecycle:dormant',
    });

    const diagnosis = service.diagnoseReadiness(snapshot, {
      ...descriptor,
      lifecycle: descriptor.lifecycle
        ? {
            ...descriptor.lifecycle,
            state: 'dormant',
            approvalRequired: true,
          }
        : null,
    });

    expect(diagnosis).toMatchObject({
      failureKind: 'permission_required',
      repairable: true,
      requiresUserInput: true,
    });
  });
});
