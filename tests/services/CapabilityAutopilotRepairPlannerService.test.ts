import { CapabilityAutopilotRepairPlannerService } from '../../src/services/CapabilityAutopilotRepairPlannerService';
import type {
  CapabilityDiagnosis,
  CapabilityOperationalDescriptor,
  CapabilityReadinessSnapshot,
  OriginalIntentEnvelope,
} from '../../src/contracts/CapabilityAutopilotContract';
import type { IntegrationRequirement } from '../../src/contracts/IntegrationHubContract';

const FIXED_NOW = new Date('2026-04-25T14:00:00.000Z');

const descriptor: CapabilityOperationalDescriptor = {
  capabilityId: 'executor-gemini-cli',
  label: 'Gemini CLI',
  type: 'executor',
  intent: 'code_execution',
  summary: 'Runs tasks through Gemini CLI.',
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
    available: false,
    source: 'registry',
  },
  policy: null,
  hooks: [],
  fallbackMode: 'ask_before_switch',
};

const geminiBinaryRequirement: IntegrationRequirement = {
  id: 'gemini_cli_binary',
  type: 'binary',
  label: 'Gemini CLI binary',
  description: 'Gemini command must be installed and visible on PATH.',
  required: true,
};

const resumeIntent: OriginalIntentEnvelope = {
  intentId: 'intent-1',
  createdAt: FIXED_NOW.toISOString(),
  surface: 'chat',
  audience: 'everyday_user',
  rawText: 'Zavorth, use o Gemini CLI e rode este prompt.',
  normalizedText: 'use gemini cli',
  requestedCapabilityId: 'executor-gemini-cli',
  requestedExecutorName: 'gemini_cli',
  workspace: 'C:/workspace',
};

function createDiagnosis(overrides: Partial<CapabilityDiagnosis> = {}): CapabilityDiagnosis {
  return {
    diagnosisId: 'diagnosis-1',
    capabilityId: 'executor-gemini-cli',
    generatedAt: FIXED_NOW.toISOString(),
    failureKind: 'missing_binary',
    status: 'missing',
    rootCause: 'Binario required missing: Gemini CLI binary.',
    confidence: 0.94,
    repairable: true,
    requiresUserInput: true,
    narratives: [],
    evidence: [],
    relatedExecution: null,
    metadata: {},
    ...overrides,
  };
}

function createReadiness(overrides: Partial<CapabilityReadinessSnapshot> = {}): CapabilityReadinessSnapshot {
  return {
    capabilityId: 'executor-gemini-cli',
    generatedAt: FIXED_NOW.toISOString(),
    status: 'missing',
    severity: 'error',
    ready: false,
    safeToRun: false,
    summary: 'Gemini CLI ainda not esta ready.',
    detail: 'Faltam requisitos requireds: Gemini CLI binary.',
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
    probe: null,
    executor: descriptor.executor,
    evidence: [],
    suggestedNextAction: {
      label: 'Planejar reparo de requisitos',
      reason: 'Falta binario.',
      repairable: true,
    },
    metadata: {},
    ...overrides,
  };
}

function createService() {
  return new CapabilityAutopilotRepairPlannerService({
    now: () => FIXED_NOW,
  });
}

describe('CapabilityAutopilotRepairPlannerService', () => {
  it('builds an approval-gated plan for a missing binary without executing repair', () => {
    const service = createService();

    const plan = service.planFromDiagnosis(createDiagnosis(), {
      descriptor,
      readiness: createReadiness(),
      resumeIntent,
    });

    expect(plan).toMatchObject({
      capabilityId: 'executor-gemini-cli',
      diagnosisId: 'diagnosis-1',
      status: 'approval_required',
      riskLevel: 7,
      trustLevelRequired: 'collaborator',
      resumeIntent: {
        intentId: 'intent-1',
      },
      metadata: {
        readOnly: true,
        stage: 'capability-autopilot-repair-planner',
      },
    });
    expect(plan.permissionRequirements).toEqual([
      expect.objectContaining({
        kind: 'install_binary',
        scope: 'host',
      }),
    ]);
    expect(plan.steps.map((step) => step.kind)).toEqual(
      expect.arrayContaining(['explain', 'ask_user', 'install_binary', 'validate', 'resume_original_intent']),
    );
    expect(plan.steps.every((step) => step.command === null)).toBe(true);
    expect(plan.validators.map((validator) => validator.kind)).toEqual(
      expect.arrayContaining(['manual', 'executor_smoke']),
    );
    expect(plan.fallbackOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          executorName: 'codex',
          requiresPermission: true,
        }),
        expect.objectContaining({
          id: 'fallback-manual-guidance',
          requiresPermission: false,
        }),
      ]),
    );
  });

  it('marks healthy readiness as validated and does not request permissions', () => {
    const service = createService();
    const diagnosis = createDiagnosis({
      failureKind: 'unknown',
      status: 'ready',
      rootCause: 'Noa failure operacional detectada no readiness atual.',
      confidence: 1,
      repairable: false,
      requiresUserInput: false,
    });

    const plan = service.planFromDiagnosis(diagnosis, {
      descriptor: {
        ...descriptor,
        executor: {
          ...descriptor.executor!,
          available: true,
        },
      },
      readiness: createReadiness({
        status: 'ready',
        severity: 'info',
        ready: true,
        safeToRun: true,
        missingRequirements: [],
        blockingReason: null,
        executor: {
          ...descriptor.executor!,
          available: true,
        },
      }),
    });

    expect(plan).toMatchObject({
      status: 'validated',
      riskLevel: 0,
      trustLevelRequired: 'protected',
      permissionRequirements: [],
      fallbackOptions: [],
    });
    expect(plan.steps.map((step) => step.kind)).toEqual(['explain', 'noop']);
  });

  it('keeps policy blocks as proposed plans without invisible fallback', () => {
    const service = createService();
    const plan = service.planFromDiagnosis(createDiagnosis({
      failureKind: 'policy_blocked',
      status: 'blocked',
      rootCause: 'Policy blocked the capability before execution.',
      confidence: 0.88,
      repairable: false,
      requiresUserInput: true,
    }), {
      descriptor,
      readiness: createReadiness({
        status: 'blocked',
        severity: 'warning',
        blockingReason: 'policy_blocked',
        missingRequirements: [],
      }),
    });

    expect(plan).toMatchObject({
      status: 'proposed',
      riskLevel: 2,
      trustLevelRequired: 'protected',
      permissionRequirements: [],
      fallbackOptions: [],
    });
    expect(plan.steps.map((step) => step.kind)).toEqual(['explain', 'ask_user']);
  });
});
