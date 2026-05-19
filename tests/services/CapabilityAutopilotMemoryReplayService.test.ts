import { CapabilityAutopilotMemoryReplayService } from '../../src/services/CapabilityAutopilotMemoryReplayService';
import type {
  CapabilityDiagnosis,
  CapabilityReadinessSnapshot,
  CapabilityReceipt,
  CapabilityRepairPlan,
  CapabilityValidationResult,
  OriginalIntentEnvelope,
} from '../../src/contracts/CapabilityAutopilotContract';

const FIXED_NOW = new Date('2026-04-25T21:00:00.000Z');
const RAW_INTENT = 'Use Gemini CLI with super secret phrase STAGE64-RAW-INTENT.';
const RAW_WORKSPACE = 'C:/Users/example/private workspace STAGE64-RAW-WORKSPACE';

const resumeIntent: OriginalIntentEnvelope = {
  intentId: 'intent-64',
  createdAt: FIXED_NOW.toISOString(),
  surface: 'chat',
  audience: 'everyday_user',
  userId: 'maria',
  sessionId: 'session-64',
  taskId: 'task-64',
  rawText: RAW_INTENT,
  normalizedText: 'use gemini cli with secret',
  requestedCapabilityId: 'executor-gemini-cli',
  requestedExecutorName: 'gemini_cli',
  workspace: RAW_WORKSPACE,
};

const readiness: CapabilityReadinessSnapshot = {
  capabilityId: 'executor-gemini-cli',
  generatedAt: FIXED_NOW.toISOString(),
  status: 'missing',
  severity: 'critical',
  ready: false,
  safeToRun: false,
  summary: 'Gemini CLI authentication is missing.',
  detail: 'The provider CLI is installed but the auth session is not available.',
  checkedTargets: [],
  missingRequirements: [],
  blockingReason: 'missing_auth',
  probe: null,
  executor: null,
  evidence: [],
};

const diagnosis: CapabilityDiagnosis = {
  diagnosisId: 'diagnosis-64',
  capabilityId: 'executor-gemini-cli',
  generatedAt: FIXED_NOW.toISOString(),
  failureKind: 'missing_auth',
  status: 'missing',
  rootCause: 'Gemini CLI needs an approved auth session.',
  confidence: 0.9,
  repairable: true,
  requiresUserInput: true,
  narratives: [],
  evidence: [],
};

const repairPlan: CapabilityRepairPlan = {
  repairPlanId: 'repair-64',
  capabilityId: 'executor-gemini-cli',
  diagnosisId: 'diagnosis-64',
  createdAt: FIXED_NOW.toISOString(),
  status: 'approval_required',
  summary: 'Gemini CLI needs scoped approval before repair.',
  riskLevel: 5,
  trustLevelRequired: 'collaborator',
  permissionRequirements: [
    {
      id: 'auth-session',
      kind: 'authenticate',
      scope: 'session',
      reason: 'Authorize the provider CLI session.',
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
      label: 'Use Codex',
      executorName: 'codex',
      reason: 'Use a visible fallback executor.',
      requiresPermission: true,
      policyAllowed: null,
    },
  ],
  resumeIntent,
};

const permissionReceipt: CapabilityReceipt = {
  receiptId: 'receipt-64',
  generatedAt: FIXED_NOW.toISOString(),
  stage: 'permission',
  surface: 'chat',
  audience: 'everyday_user',
  capabilityId: 'executor-gemini-cli',
  capabilityLabel: 'Gemini CLI',
  headline: 'Gemini CLI needs permission.',
  userSummary: 'Gemini CLI needs approval before repair.',
  technicalSummary: 'stage=permission; failure=missing_auth; permissions=1',
  trustLevel: 'collaborator',
  readiness,
  diagnosis,
  repairPlan,
  validation: null,
  selectedFallback: null,
  resumeIntent,
  timeline: [],
};

const successValidation: CapabilityValidationResult = {
  capabilityId: 'executor-gemini-cli',
  generatedAt: FIXED_NOW.toISOString(),
  success: true,
  summary: 'Readiness is green.',
  results: [
    {
      validationStepId: 'readiness',
      status: 'passed',
      detail: 'ready=true; safeToRun=true',
    },
  ],
  readiness: {
    ...readiness,
    status: 'ready',
    severity: 'info',
    ready: true,
    safeToRun: true,
    summary: 'Gemini CLI is ready.',
    blockingReason: null,
  },
};

function createService() {
  return new CapabilityAutopilotMemoryReplayService({
    now: () => FIXED_NOW,
  });
}

describe('CapabilityAutopilotMemoryReplayService', () => {
  it('builds a redacted memory record without storing raw intent or workspace', () => {
    const service = createService();

    const record = service.buildMemoryRecord({
      receipt: permissionReceipt,
      rawIntentText: RAW_INTENT,
      workspace: RAW_WORKSPACE,
    });
    const serialized = JSON.stringify(record);

    expect(record.privacy).toEqual({
      rawIntentStored: false,
      rawWorkspaceStored: false,
      redacted: true,
    });
    expect(record.intentFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(record.workspaceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(serialized).not.toContain(RAW_INTENT);
    expect(serialized).not.toContain(RAW_WORKSPACE);
    expect(serialized).not.toContain('rawText');
    expect(serialized).not.toContain('normalizedText');
  });

  it('records permission-required outcome with readiness, diagnosis and permission signals', () => {
    const service = createService();

    const record = service.buildMemoryRecord({
      receipt: permissionReceipt,
    });

    expect(record).toMatchObject({
      outcome: 'permission_required',
      stage: 'permission',
      failureKind: 'missing_auth',
      readinessStatus: 'missing',
      permissionCount: 1,
      fallbackCount: 1,
      replayable: true,
      metadata: {
        stage: 'capability-autopilot-checkpoint-64',
      },
    });
    expect(record.signals.map((signal) => signal.kind)).toEqual(
      expect.arrayContaining(['readiness', 'diagnosis', 'permission', 'repair', 'fallback', 'surface']),
    );
  });

  it('builds a replay frame with a safe recommendation from memory', () => {
    const service = createService();
    const record = service.buildMemoryRecord({
      receipt: {
        ...permissionReceipt,
        stage: 'resume',
        validation: successValidation,
      },
    });

    const replay = service.buildReplayFrame(record);
    const summary = service.summarizeRecords([record]);

    expect(record.outcome).toBe('ready');
    expect(replay).toMatchObject({
      capabilityId: 'executor-gemini-cli',
      outcome: 'ready',
      replayable: true,
      recommendedNextAction: 'resume_original_intent_after_readiness_check',
      sourceMemoryId: record.memoryId,
    });
    expect(replay.safeSummary).not.toContain(RAW_INTENT);
    expect(summary).toMatchObject({
      totalRecords: 1,
      replayableCount: 1,
      lastRecommendedAction: 'resume_original_intent_after_readiness_check',
    });
    expect(summary.outcomeCounts.ready).toBe(1);
  });
});
