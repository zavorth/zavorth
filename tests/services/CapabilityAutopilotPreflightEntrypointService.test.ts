import type {
  CapabilityMemoryRecord,
  CapabilityReadinessSnapshot,
  CapabilityReceipt,
} from '../../src/contracts/CapabilityAutopilotContract';
import { CapabilityAutopilotPreflightEntrypointService } from '../../src/services/CapabilityAutopilotPreflightEntrypointService';
import { CapabilityAutopilotPreflightSurfaceService } from '../../src/services/CapabilityAutopilotPreflightSurfaceService';
import type { CapabilityPreflightHintResult } from '../../src/services/CapabilityAutopilotPreflightHintService';

const FIXED_NOW = new Date('2026-04-26T03:00:00.000Z');

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

const receipt: CapabilityReceipt = {
  receiptId: 'receipt-1',
  generatedAt: FIXED_NOW.toISOString(),
  stage: 'permission',
  surface: 'cli',
  audience: 'everyday_user',
  capabilityId: 'executor-gemini-cli',
  capabilityLabel: 'Gemini CLI',
  headline: 'Gemini CLI precisa de permissao.',
  userSummary: 'Gemini CLI precisa de permissao antes de reparo.',
  technicalSummary: 'capability=executor-gemini-cli; stage=permission',
  trustLevel: 'protected',
  readiness,
  diagnosis: null,
  repairPlan: null,
  validation: null,
  selectedFallback: null,
  resumeIntent: null,
  timeline: [],
  metadata: {},
};

const memoryRecord: CapabilityMemoryRecord = {
  memoryId: 'memory-1',
  generatedAt: FIXED_NOW.toISOString(),
  capabilityId: 'executor-gemini-cli',
  capabilityLabel: 'Gemini CLI',
  workspaceHash: 'w'.repeat(64),
  intentFingerprint: 'i'.repeat(64),
  outcome: 'permission_required',
  stage: 'permission',
  failureKind: 'missing_auth',
  readinessStatus: 'missing',
  permissionCount: 1,
  fallbackCount: 0,
  signals: [],
  lesson: 'Gemini CLI needs explicit permission before repair; keep the original intent parked.',
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

function buildHint(record: CapabilityMemoryRecord): CapabilityPreflightHintResult {
  return {
    generatedAt: FIXED_NOW.toISOString(),
    capabilityId: 'executor-gemini-cli',
    status: 'hint_available',
    hintKind: 'permission',
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
          memoryId: record.memoryId,
          capabilityId: record.capabilityId,
          outcome: record.outcome,
          score: 110,
          replayable: true,
          lesson: record.lesson,
          recommendedNextAction: 'ask_for_explicit_approval_with_scoped_permissions',
          reasons: [],
          record,
        },
      ],
      bestMatch: {
        memoryId: record.memoryId,
        capabilityId: record.capabilityId,
        outcome: record.outcome,
        score: 110,
        replayable: true,
        lesson: record.lesson,
        recommendedNextAction: 'ask_for_explicit_approval_with_scoped_permissions',
        reasons: [],
        record,
      },
      shouldPreloadHint: true,
      recommendedNextAction: 'ask_for_explicit_approval_with_scoped_permissions',
      safeSummary: 'Memoria procedural encontrada. Nada deve ser executado automaticamente.',
      metadata: {
        autoExecute: false,
      },
    },
    headline: 'Ja vi um caso parecido que precisou de permissao.',
    userSummary: 'Posso preparar permissao contextual, mas nada sera executado automaticamente.',
    technicalSummary: 'preflightHint=hint_available; hintKind=permission; autoExecute=false',
    recommendedNextAction: 'ask_for_explicit_approval_with_scoped_permissions',
    shouldAskPermission: true,
    requiresExplicitUserChoice: true,
    shouldRunAutomatically: false,
    metadata: {
      autoExecute: false,
    },
  };
}

function createService(record: CapabilityMemoryRecord = memoryRecord) {
  const receiptService = {
    buildCapabilityReceipt: jest.fn(async () => receipt),
  };
  const memoryReplayService = {
    buildMemoryRecord: jest.fn(() => record),
  };
  const hintService = {
    buildPreflightHint: jest.fn(async () => buildHint(record)),
  };

  return {
    receiptService,
    memoryReplayService,
    hintService,
    service: new CapabilityAutopilotPreflightEntrypointService({
      now: () => FIXED_NOW,
      receiptService,
      memoryReplayService,
      hintService,
      surfaceService: new CapabilityAutopilotPreflightSurfaceService({
        now: () => FIXED_NOW,
      }),
    }),
  };
}

describe('CapabilityAutopilotPreflightEntrypointService', () => {
  it('builds a canonical snapshot without leaking raw intent or workspace', async () => {
    const { service, receiptService, memoryReplayService, hintService } = createService();

    const snapshot = await service.buildSnapshot({
      capabilityId: 'executor-gemini-cli',
      surfaces: ['cli', 'web', 'chat', 'telegram', 'api'],
      expectedSurfaces: ['cli', 'web', 'chat', 'telegram', 'api'],
      audience: 'everyday_user',
      rawIntentText: 'RAW-INTENT-DO-NOT-LEAK',
      workspace: 'C:/private/RAW-WORKSPACE-DO-NOT-LEAK',
    });

    expect(snapshot).toMatchObject({
      phase: '68',
      surface: 'capability-autopilot-preflight-entrypoint',
      status: 'ready',
      capabilityId: 'executor-gemini-cli',
      summary: {
        ok: true,
        failed: 0,
      },
      metadata: {
        autoExecute: false,
      },
    });
    expect(snapshot.payloads.map((payload) => payload.surface)).toEqual(['cli', 'web', 'chat', 'telegram', 'api']);
    expect(snapshot.payloads.every((payload) => payload.shouldRunAutomatically === false)).toBe(true);
    expect(snapshot.payloads.every((payload) => payload.actions.every((action) => action.requiresExplicitUserAction))).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('RAW-INTENT-DO-NOT-LEAK');
    expect(JSON.stringify(snapshot)).not.toContain('RAW-WORKSPACE-DO-NOT-LEAK');
    expect(JSON.stringify(snapshot)).not.toContain('rawText');
    expect(JSON.stringify(snapshot)).not.toContain('normalizedText');
    expect(receiptService.buildCapabilityReceipt).toHaveBeenCalledWith(
      'executor-gemini-cli',
      expect.objectContaining({
        surface: 'cli',
        audience: 'everyday_user',
      }),
    );
    expect(memoryReplayService.buildMemoryRecord).toHaveBeenCalledWith(expect.objectContaining({
      receipt,
      rawIntentText: 'RAW-INTENT-DO-NOT-LEAK',
      workspace: 'C:/private/RAW-WORKSPACE-DO-NOT-LEAK',
    }));
    expect(hintService.buildPreflightHint).toHaveBeenCalledWith(expect.objectContaining({
      capabilityId: 'executor-gemini-cli',
      records: [memoryRecord],
      receipt,
    }));
  });

  it('fails coverage when the caller expects a surface that was not generated', async () => {
    const { service } = createService();

    const snapshot = await service.buildSnapshot({
      capabilityId: 'executor-gemini-cli',
      surfaces: ['cli'],
      expectedSurfaces: ['cli', 'web'],
      rawIntentText: 'raw',
      workspace: 'workspace',
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks.find((check) => check.id === 'capability-autopilot-preflight:coverage'))
      .toMatchObject({
        status: 'fail',
        evidence: expect.arrayContaining(['missing=web']),
      });
  });

  it('reports memory privacy failures instead of silently accepting unsafe records', async () => {
    const unsafeRecord: CapabilityMemoryRecord = {
      ...memoryRecord,
      privacy: {
        rawIntentStored: true as false,
        rawWorkspaceStored: false,
        redacted: true,
      },
    };
    const { service } = createService(unsafeRecord);

    const snapshot = await service.buildSnapshot({
      capabilityId: 'executor-gemini-cli',
      surfaces: ['cli'],
      expectedSurfaces: ['cli'],
      rawIntentText: 'raw',
      workspace: 'workspace',
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.checks.find((check) => check.id === 'capability-autopilot-preflight:memory-privacy'))
      .toMatchObject({
        status: 'fail',
      });
  });

  it('renders a compact operator report for the CLI gate', async () => {
    const { service } = createService();
    const snapshot = await service.buildSnapshot({
      capabilityId: 'executor-gemini-cli',
      surfaces: ['cli'],
      expectedSurfaces: ['cli'],
    });

    expect(service.renderReport(snapshot)).toContain('Fase 68 - Canonical Preflight Entrypoint');
    expect(service.renderReport(snapshot)).toContain('proxima fase recomendada: 69 - Preflight Action Handler Wiring');
  });
});
