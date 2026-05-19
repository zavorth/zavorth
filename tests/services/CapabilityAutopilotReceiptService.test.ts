import { CapabilityAutopilotReceiptService } from '../../src/services/CapabilityAutopilotReceiptService';
import type {
  CapabilityDiagnosis,
  CapabilityOperationalDescriptor,
  CapabilityReadinessSnapshot,
  CapabilityRepairPlan,
  OriginalIntentEnvelope,
} from '../../src/contracts/CapabilityAutopilotContract';

const FIXED_NOW = new Date('2026-04-25T15:00:00.000Z');

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
  lifecycle: null,
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

const readiness: CapabilityReadinessSnapshot = {
  capabilityId: 'executor-gemini-cli',
  generatedAt: FIXED_NOW.toISOString(),
  status: 'missing',
  severity: 'error',
  ready: false,
  safeToRun: false,
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
  missingRequirements: [
    {
      id: 'gemini_cli_binary',
      type: 'binary',
      label: 'Gemini CLI binary',
      description: 'Comando gemini precisa estar instalado e visivel no PATH.',
      required: true,
    },
  ],
  blockingReason: 'Gemini CLI binary',
  probe: null,
  executor: descriptor.executor,
  evidence: [],
  suggestedNextAction: {
    label: 'Planejar reparo de requisitos',
    reason: 'Falta binario.',
    repairable: true,
  },
};

const diagnosis: CapabilityDiagnosis = {
  diagnosisId: 'diagnosis-1',
  capabilityId: 'executor-gemini-cli',
  generatedAt: FIXED_NOW.toISOString(),
  failureKind: 'missing_binary',
  status: 'missing',
  rootCause: 'Binario obrigatorio ausente: Gemini CLI binary.',
  confidence: 0.94,
  repairable: true,
  requiresUserInput: true,
  narratives: [
    {
      audience: 'everyday_user',
      headline: 'Gemini CLI ainda nao esta instalado ou nao foi encontrado.',
      explanation: 'Eu entendi o que voce quer usar, mas a ferramenta local ainda nao apareceu no computador ou no PATH.',
    },
    {
      audience: 'technical_operator',
      headline: 'Gemini CLI: missing_binary',
      explanation: 'Readiness=missing; confidence=0.94',
      technicalDetail: 'missingRequirements=gemini_cli_binary:binary',
    },
  ],
  evidence: [],
  relatedExecution: null,
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
};

const repairPlan: CapabilityRepairPlan = {
  repairPlanId: 'repair-1',
  capabilityId: 'executor-gemini-cli',
  diagnosisId: 'diagnosis-1',
  createdAt: FIXED_NOW.toISOString(),
  status: 'approval_required',
  summary: 'Gemini CLI: plano proposto para missing_binary.',
  riskLevel: 7,
  trustLevelRequired: 'collaborator',
  permissionRequirements: [
    {
      id: 'executor-gemini-cli-install_binary-host',
      kind: 'install_binary',
      scope: 'host',
      reason: 'Instalar ou localizar uma ferramenta local exige permissao no host.',
      requestedValue: 'gemini_cli',
      resolvedValue: 'gemini_cli',
      riskLevel: 7,
      trustLevelRequired: 'collaborator',
    },
  ],
  steps: [
    {
      id: 'explain-problem',
      kind: 'explain',
      title: 'Explicar o problema',
      summary: 'Binario obrigatorio ausente.',
      command: null,
      installStep: null,
      permissionIds: [],
      expectedOutcome: 'Usuario entende.',
    },
    {
      id: 'request-permission',
      kind: 'ask_user',
      title: 'Pedir permissao contextual',
      summary: 'install_binary (host, risco 7)',
      command: null,
      installStep: null,
      permissionIds: ['executor-gemini-cli-install_binary-host'],
      expectedOutcome: 'Permissao aprovada.',
    },
  ],
  validators: [
    {
      id: 'readiness-snapshot',
      title: 'Recalcular readiness',
      kind: 'manual',
      target: 'executor-gemini-cli',
      successCondition: 'ready=true',
      required: true,
    },
  ],
  fallbackOptions: [
    {
      id: 'fallback-codex',
      label: 'Tentar codex',
      executorName: 'codex',
      reason: 'Fallback visivel.',
      requiresPermission: true,
      policyAllowed: null,
    },
    {
      id: 'fallback-manual-guidance',
      label: 'Orientacao manual',
      reason: 'Explicar ao usuario como preparar.',
      requiresPermission: false,
      policyAllowed: true,
    },
  ],
  resumeIntent,
};

function createService() {
  return new CapabilityAutopilotReceiptService({
    now: () => FIXED_NOW,
  });
}

describe('CapabilityAutopilotReceiptService', () => {
  it('builds an everyday-user receipt for an approval-gated repair plan', () => {
    const service = createService();

    const receipt = service.buildReceiptFromParts({
      descriptor,
      readiness,
      diagnosis,
      repairPlan,
      resumeIntent,
      surface: 'chat',
      audience: 'everyday_user',
    });

    expect(receipt).toMatchObject({
      capabilityId: 'executor-gemini-cli',
      capabilityLabel: 'Gemini CLI',
      stage: 'permission',
      surface: 'chat',
      audience: 'everyday_user',
      trustLevel: 'collaborator',
      selectedFallback: null,
      metadata: {
        readOnly: true,
        stage: 'capability-autopilot-checkpoint-5',
      },
    });
    expect(receipt.headline).toBe('Gemini CLI precisa da sua permissao antes de eu mexer nisso.');
    expect(receipt.userSummary).toContain('preciso de 1 permissao');
    expect(receipt.userSummary).toContain('nenhuma sera usada escondida');
    expect(receipt.userSummary).toContain('retomar exatamente o pedido original');
    expect(receipt.timeline.map((entry) => entry.stage)).toEqual([
      'intent',
      'preflight',
      'diagnosis',
      'permission',
    ]);
  });

  it('builds a technical-operator receipt with compact operational details', () => {
    const service = createService();

    const receipt = service.buildReceiptFromParts({
      descriptor,
      readiness,
      diagnosis,
      repairPlan,
      audience: 'technical_operator',
      surface: 'web',
    });

    expect(receipt.headline).toBe('Gemini CLI: stage=permission; readiness=missing; failure=missing_binary; plan=approval_required');
    expect(receipt.technicalSummary).toContain('readiness=missing; ready=false; safeToRun=false');
    expect(receipt.technicalSummary).toContain('diagnosis=missing_binary; confidence=0.94; repairable=true');
    expect(receipt.technicalSummary).toContain('repairPlan=approval_required; risk=7; trust=collaborator; permissions=1');
  });

  it('marks validated plans with resume intent as resume stage', () => {
    const service = createService();

    const receipt = service.buildReceiptFromParts({
      descriptor,
      readiness: {
        ...readiness,
        status: 'ready',
        ready: true,
        safeToRun: true,
        summary: 'Gemini CLI esta pronto.',
        detail: 'Nenhum bloqueio encontrado.',
        missingRequirements: [],
        blockingReason: null,
      },
      diagnosis: {
        ...diagnosis,
        failureKind: 'unknown',
        status: 'ready',
        rootCause: 'Nenhuma falha operacional detectada no readiness atual.',
        repairable: false,
        requiresUserInput: false,
        confidence: 1,
      },
      repairPlan: {
        ...repairPlan,
        status: 'validated',
        summary: 'Gemini CLI ja esta pronto; nenhum reparo necessario.',
        riskLevel: 0,
        trustLevelRequired: 'protected',
        permissionRequirements: [],
        fallbackOptions: [],
        resumeIntent,
      },
      resumeIntent,
    });

    expect(receipt).toMatchObject({
      stage: 'resume',
      trustLevel: 'protected',
    });
    expect(receipt.headline).toBe('Gemini CLI esta pronto; posso retomar o pedido original.');
    expect(receipt.userSummary).toContain('ja esta pronto');
  });
});
