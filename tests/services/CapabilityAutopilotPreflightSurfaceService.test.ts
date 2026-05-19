import { CapabilityAutopilotPreflightSurfaceService } from '../../src/services/CapabilityAutopilotPreflightSurfaceService';
import type { CapabilityPreflightHintResult } from '../../src/services/CapabilityAutopilotPreflightHintService';
import type {
  CapabilityMemoryRecord,
  CapabilityReadinessSnapshot,
} from '../../src/contracts/CapabilityAutopilotContract';

const FIXED_NOW = new Date('2026-04-26T02:00:00.000Z');

const readiness: CapabilityReadinessSnapshot = {
  capabilityId: 'executor-gemini-cli',
  generatedAt: FIXED_NOW.toISOString(),
  status: 'missing',
  severity: 'error',
  ready: false,
  safeToRun: false,
  summary: 'Gemini CLI ainda nao esta pronto.',
  detail: 'Autenticacao ausente.',
  checkedTargets: [],
  missingRequirements: [],
  blockingReason: 'missing_auth',
  probe: null,
  executor: null,
  evidence: [],
};

const memoryRecord: CapabilityMemoryRecord = {
  memoryId: 'memory-1',
  generatedAt: FIXED_NOW.toISOString(),
  capabilityId: 'executor-gemini-cli',
  capabilityLabel: 'Gemini CLI',
  workspaceHash: 'w'.repeat(64),
  intentFingerprint: 'i'.repeat(64),
  outcome: 'fallback_selected',
  stage: 'fallback',
  failureKind: 'missing_auth',
  readinessStatus: 'missing',
  permissionCount: 0,
  fallbackCount: 1,
  signals: [],
  lesson: 'Gemini CLI used an explicit fallback selected by the user.',
  replayable: true,
  privacy: {
    rawIntentStored: false,
    rawWorkspaceStored: false,
    redacted: true,
  },
  source: {
    receiptId: 'receipt-1',
    repairPlanId: 'repair-1',
  },
};

const fallbackHint: CapabilityPreflightHintResult = {
  generatedAt: FIXED_NOW.toISOString(),
  capabilityId: 'executor-gemini-cli',
  status: 'hint_available',
  hintKind: 'fallback',
  readiness,
  recall: {
    generatedAt: FIXED_NOW.toISOString(),
    status: 'match_found',
    query: {
      capabilityId: 'executor-gemini-cli',
      workspaceHash: 'w'.repeat(64),
      intentFingerprint: 'i'.repeat(64),
      failureKind: 'missing_auth',
    },
    matches: [
      {
        memoryId: 'memory-1',
        capabilityId: 'executor-gemini-cli',
        outcome: 'fallback_selected',
        score: 110,
        replayable: true,
        lesson: memoryRecord.lesson,
        recommendedNextAction: 'continue_selected_fallback_with_audit_receipt',
        reasons: [],
        record: memoryRecord,
      },
    ],
    bestMatch: {
      memoryId: 'memory-1',
      capabilityId: 'executor-gemini-cli',
      outcome: 'fallback_selected',
      score: 110,
      replayable: true,
      lesson: memoryRecord.lesson,
      recommendedNextAction: 'continue_selected_fallback_with_audit_receipt',
      reasons: [],
      record: memoryRecord,
    },
    shouldPreloadHint: true,
    recommendedNextAction: 'continue_selected_fallback_with_audit_receipt',
    safeSummary: 'Memoria procedural encontrada. Nada deve ser executado automaticamente.',
    metadata: {
      autoExecute: false,
    },
  },
  headline: 'Ja vi um caso parecido que usou fallback escolhido pelo usuario.',
  userSummary: 'Memoria procedural encontrada. Posso mostrar essa alternativa, mas nao vou trocar de executor sem voce escolher.',
  technicalSummary: 'preflightHint=hint_available; hintKind=fallback; autoExecute=false',
  recommendedNextAction: 'continue_selected_fallback_with_audit_receipt',
  shouldAskPermission: true,
  requiresExplicitUserChoice: true,
  shouldRunAutomatically: false,
  metadata: {
    autoExecute: false,
  },
};

const readyHint: CapabilityPreflightHintResult = {
  ...fallbackHint,
  status: 'hint_available',
  hintKind: 'ready',
  readiness: {
    ...readiness,
    status: 'ready',
    severity: 'info',
    ready: true,
    safeToRun: true,
    summary: 'Gemini CLI esta pronto.',
    blockingReason: null,
  },
  headline: 'Ja vi um caso parecido que terminou pronto para retomar.',
  userSummary: 'Vou tratar isso como dica de preflight, nao como ordem automatica.',
  technicalSummary: 'preflightHint=hint_available; hintKind=ready; autoExecute=false',
  recommendedNextAction: 'resume_original_intent_after_readiness_check',
  shouldAskPermission: false,
  requiresExplicitUserChoice: false,
};

const noHint: CapabilityPreflightHintResult = {
  ...fallbackHint,
  status: 'no_hint',
  hintKind: 'none',
  recall: {
    ...fallbackHint.recall,
    status: 'no_match',
    matches: [],
    bestMatch: null,
    shouldPreloadHint: false,
    recommendedNextAction: null,
    safeSummary: 'Nenhuma memoria procedural segura encontrada para este contexto.',
  },
  headline: 'Vou seguir pelo diagnostico normal desta capability.',
  userSummary: 'Gemini CLI ainda nao esta pronto. Nenhuma memoria procedural segura encontrada para este contexto.',
  recommendedNextAction: null,
  shouldAskPermission: false,
  requiresExplicitUserChoice: false,
};

function createService() {
  return new CapabilityAutopilotPreflightSurfaceService({
    now: () => FIXED_NOW,
  });
}

describe('CapabilityAutopilotPreflightSurfaceService', () => {
  it('builds CLI fallback payload with explicit-only actions', () => {
    const service = createService();

    const payload = service.buildPayload({
      hint: fallbackHint,
      surface: 'cli',
      audience: 'everyday_user',
    });

    expect(payload).toMatchObject({
      surface: 'cli',
      status: 'hint_available',
      hintKind: 'fallback',
      tone: 'attention',
      shouldAskPermission: true,
      requiresExplicitUserChoice: true,
      shouldRunAutomatically: false,
      metadata: {
        stage: 'capability-autopilot-checkpoint-15',
        autoExecute: false,
      },
    });
    expect(payload.actions.map((action) => action.kind)).toEqual(
      expect.arrayContaining(['view_preflight', 'open_memory_hint', 'show_fallbacks']),
    );
    expect(payload.actions.every((action) => action.requiresExplicitUserAction)).toBe(true);
    expect(payload.actions.find((action) => action.kind === 'view_preflight')?.command)
      .toBe('npm run capability-autopilot -- --capability=executor-gemini-cli');
    expect(payload.actions.find((action) => action.kind === 'show_fallbacks')?.command)
      .toBeNull();
  });

  it('keeps API and web payloads aligned while using their own routes', () => {
    const service = createService();

    const [api, web] = service.buildPayloads(readyHint, ['api', 'web'], 'technical_operator');

    expect(api).toMatchObject({
      surface: 'api',
      audience: 'technical_operator',
      headline: 'executor-gemini-cli:preflight:hint_available:ready',
      technicalBody: readyHint.technicalSummary,
      status: 'hint_available',
      hintKind: 'ready',
    });
    expect(web).toMatchObject({
      surface: 'web',
      audience: 'technical_operator',
      headline: 'Ja vi um caso parecido que terminou pronto para retomar. (hint_available/ready)',
      technicalBody: readyHint.technicalSummary,
      status: 'hint_available',
      hintKind: 'ready',
    });
    expect(api.actions.find((action) => action.kind === 'run_validation')?.route)
      .toBe('/api/capabilities/executor-gemini-cli/autopilot/preflight/validate');
    expect(web.actions.find((action) => action.kind === 'resume_after_check')?.route)
      .toBe('/capabilities/executor-gemini-cli/autopilot/preflight/resume');
  });

  it('uses normal diagnosis actions when no memory hint is available', () => {
    const service = createService();

    const payload = service.buildPayload({
      hint: noHint,
      surface: 'chat',
      audience: 'everyday_user',
    });

    expect(payload).toMatchObject({
      status: 'no_hint',
      hintKind: 'none',
      tone: 'attention',
      recommendedNextAction: null,
      shouldRunAutomatically: false,
    });
    expect(payload.actions.map((action) => action.kind)).toEqual(['view_preflight', 'run_diagnosis']);
    expect(payload.actions.find((action) => action.kind === 'run_diagnosis')?.callbackData)
      .toBe('capability_autopilot_preflight:executor-gemini-cli:diagnosis');
  });

  it('keeps compact surfaces short and does not leak raw payload assumptions', () => {
    const service = createService();

    const payload = service.buildPayload({
      hint: {
        ...fallbackHint,
        userSummary: 'x'.repeat(1000),
      },
      surface: 'telegram',
      audience: 'everyday_user',
    });

    expect(payload.body.length).toBeLessThanOrEqual(420);
    expect(payload.actions.find((action) => action.kind === 'view_preflight')?.callbackData)
      .toBe('capability_autopilot_preflight:executor-gemini-cli:preflight');
    expect(JSON.stringify(payload)).not.toContain('DO-NOT-LEAK');
  });
});
