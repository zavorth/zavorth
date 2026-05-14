import { CapabilityAutopilotSurfaceUxService } from '../../src/services/CapabilityAutopilotSurfaceUxService';
import type {
  CapabilityReceipt,
  CapabilityRepairPlan,
  OriginalIntentEnvelope,
} from '../../src/contracts/CapabilityAutopilotContract';

const FIXED_NOW = new Date('2026-04-25T20:00:00.000Z');

const resumeIntent: OriginalIntentEnvelope = {
  intentId: 'intent-1',
  createdAt: FIXED_NOW.toISOString(),
  surface: 'chat',
  audience: 'everyday_user',
  userId: 'maria',
  taskId: 'task-1',
  rawText: 'Zavorth, use o Gemini CLI.',
  normalizedText: 'use gemini cli',
  requestedCapabilityId: 'executor-gemini-cli',
  requestedExecutorName: 'gemini_cli',
  workspace: 'C:/workspace',
};

const repairPlan: CapabilityRepairPlan = {
  repairPlanId: 'repair-1',
  capabilityId: 'executor-gemini-cli',
  diagnosisId: 'diagnosis-1',
  createdAt: FIXED_NOW.toISOString(),
  status: 'approval_required',
  summary: 'Gemini CLI precisa de permissao.',
  riskLevel: 5,
  trustLevelRequired: 'collaborator',
  permissionRequirements: [
    {
      id: 'auth-session',
      kind: 'authenticate',
      scope: 'session',
      reason: 'Autorizar login.',
      requestedValue: 'gemini_cli',
      resolvedValue: 'gemini_cli',
      riskLevel: 5,
      trustLevelRequired: 'collaborator',
    },
  ],
  steps: [],
  validators: [],
  fallbackOptions: [
    {
      id: 'fallback-codex',
      label: 'Tentar Codex',
      executorName: 'codex',
      reason: 'Usar fallback visivel.',
      requiresPermission: true,
      policyAllowed: null,
    },
    {
      id: 'fallback-blocked',
      label: 'Fallback bloqueado',
      executorName: 'blocked',
      reason: 'Policy nao permite.',
      requiresPermission: true,
      policyAllowed: false,
    },
  ],
  resumeIntent,
};

const permissionReceipt: CapabilityReceipt = {
  receiptId: 'receipt-1',
  generatedAt: FIXED_NOW.toISOString(),
  stage: 'permission',
  surface: 'chat',
  audience: 'everyday_user',
  capabilityId: 'executor-gemini-cli',
  capabilityLabel: 'Gemini CLI',
  headline: 'Gemini CLI precisa da sua permissao antes de eu mexer nisso.',
  userSummary: 'Preciso de permissao antes de qualquer acao. Tambem tenho fallbacks visiveis.',
  technicalSummary: 'stage=permission; readiness=missing; permissions=1; fallbacks=2',
  trustLevel: 'collaborator',
  readiness: null,
  diagnosis: null,
  repairPlan,
  validation: null,
  selectedFallback: null,
  resumeIntent,
  timeline: [
    {
      at: FIXED_NOW.toISOString(),
      stage: 'preflight',
      status: 'blocked',
      summary: 'Readiness missing.',
    },
    {
      at: FIXED_NOW.toISOString(),
      stage: 'permission',
      status: 'pending',
      summary: 'Aguardando permissao.',
    },
  ],
  metadata: {
    readOnly: true,
  },
};

function createService() {
  return new CapabilityAutopilotSurfaceUxService({
    now: () => FIXED_NOW,
    receiptService: {
      buildCapabilityReceipt: async () => permissionReceipt,
    },
  });
}

describe('CapabilityAutopilotSurfaceUxService', () => {
  it('builds a CLI payload with explicit approval, validation and fallback actions', () => {
    const service = createService();

    const payload = service.buildPayload({
      receipt: permissionReceipt,
      surface: 'cli',
      audience: 'everyday_user',
    });

    expect(payload).toMatchObject({
      surface: 'cli',
      stage: 'permission',
      tone: 'attention',
      permissionSummary: '1 permissao(oes) pendente(s) com escopo explicito.',
      fallbackSummary: '2 fallback(s) disponivel(is), nenhum automatico.',
      metadata: {
        phase: 'capability-autopilot-phase-63',
        permissionCount: 1,
        fallbackCount: 2,
      },
    });
    expect(payload.actions.map((action) => action.kind)).toEqual(
      expect.arrayContaining([
        'view_details',
        'approve_permission',
        'reject_permission',
        'run_validation',
        'choose_fallback',
      ]),
    );
    expect(payload.actions.every((action) => action.requiresExplicitUserAction)).toBe(true);
    expect(payload.actions.find((action) => action.kind === 'approve_permission')?.command)
      .toContain('capability-autopilot:runner');
    expect(payload.actions.find((action) => action.kind === 'approve_permission')?.route)
      .toBeNull();
    expect(payload.actions.find((action) => action.kind === 'choose_fallback')?.route)
      .toBeNull();
  });

  it('builds API and web payloads from the same receipt without changing the decision', () => {
    const service = createService();

    const [api, web] = service.buildPayloads(permissionReceipt, ['api', 'web'], 'technical_operator');

    expect(api).toMatchObject({
      surface: 'api',
      audience: 'technical_operator',
      capabilityId: 'executor-gemini-cli',
      stage: 'permission',
      headline: 'executor-gemini-cli:permission',
      technicalBody: permissionReceipt.technicalSummary,
    });
    expect(web).toMatchObject({
      surface: 'web',
      audience: 'technical_operator',
      capabilityId: 'executor-gemini-cli',
      stage: 'permission',
      technicalBody: permissionReceipt.technicalSummary,
    });
    expect(api.actions.find((action) => action.kind === 'approve_permission')?.route)
      .toBe('/api/capabilities/executor-gemini-cli/autopilot/approve');
    expect(web.actions.find((action) => action.kind === 'approve_permission')?.route)
      .toBe('/capabilities/executor-gemini-cli/autopilot/approve');
  });

  it('keeps compact surfaces short and callback-driven', () => {
    const service = createService();

    const telegram = service.buildPayload({
      receipt: {
        ...permissionReceipt,
        userSummary: 'x'.repeat(900),
      },
      surface: 'telegram',
      audience: 'everyday_user',
    });

    expect(telegram.body.length).toBeLessThanOrEqual(420);
    expect(telegram.actions.find((action) => action.kind === 'approve_permission')?.callbackData)
      .toContain('capability_autopilot:executor-gemini-cli:receipt-1:approve');
    expect(telegram.timelineSummary).toHaveLength(2);
    expect(telegram.actions.find((action) => action.id === 'fallback-fallback-blocked')?.enabled)
      .toBe(false);
  });
});
