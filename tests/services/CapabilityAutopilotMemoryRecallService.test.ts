import { CapabilityAutopilotMemoryRecallService } from '../../src/services/CapabilityAutopilotMemoryRecallService';
import type { CapabilityMemoryRecord } from '../../src/contracts/CapabilityAutopilotContract';

const FIXED_NOW = new Date('2026-04-26T03:00:00.000Z');
const RAW_INTENT = 'PHASE-ALPHA-RAW-INTENT-MUST-STAY-OUT';
const RAW_WORKSPACE = 'C:/private/PHASE-ALPHA-RAW-WORKSPACE-MUST-STAY-OUT';

const record: CapabilityMemoryRecord = {
  memoryId: 'memory-1',
  generatedAt: FIXED_NOW.toISOString(),
  capabilityId: 'executor-gemini-cli',
  capabilityLabel: 'Gemini CLI',
  workspaceHash: null,
  intentFingerprint: null,
  outcome: 'permission_required',
  stage: 'permission',
  failureKind: 'missing_auth',
  readinessStatus: 'missing',
  permissionCount: 1,
  fallbackCount: 1,
  signals: [
    {
      id: 'diagnosis',
      kind: 'diagnosis',
      summary: 'missing_auth: login required.',
      weight: 3,
    },
  ],
  lesson: 'Ask for explicit scoped approval before repair.',
  replayable: true,
  privacy: {
    rawIntentStored: false,
    rawWorkspaceStored: false,
    redacted: true,
  },
  source: {
    receiptId: 'receipt-1',
    repairPlanId: 'repair-1',
    validationGeneratedAt: null,
  },
};

function createService() {
  return new CapabilityAutopilotMemoryRecallService({
    now: () => FIXED_NOW,
  });
}

describe('CapabilityAutopilotMemoryRecallService', () => {
  it('matches memory by redacted workspace and intent fingerprints without leaking raw input', () => {
    const service = createService();
    const query = service.recall([], {
      capabilityId: 'executor-gemini-cli',
      workspace: RAW_WORKSPACE,
      rawIntentText: RAW_INTENT,
    }).query;
    const storedRecord = {
      ...record,
      workspaceHash: query.workspaceHash,
      intentFingerprint: query.intentFingerprint,
    };

    const result = service.recall([storedRecord], {
      capabilityId: 'executor-gemini-cli',
      workspace: RAW_WORKSPACE,
      rawIntentText: RAW_INTENT,
      failureKind: 'missing_auth',
    });
    const serialized = JSON.stringify(result);

    expect(result).toMatchObject({
      status: 'match_found',
      shouldPreloadHint: true,
      recommendedNextAction: 'ask_for_explicit_approval_with_scoped_permissions',
      query: {
        capabilityId: 'executor-gemini-cli',
        failureKind: 'missing_auth',
      },
      metadata: {
        autoExecute: false,
        rawIntentStored: false,
        rawWorkspaceStored: false,
      },
    });
    expect(result.bestMatch?.score).toBeGreaterThanOrEqual(60);
    expect(serialized).not.toContain(RAW_INTENT);
    expect(serialized).not.toContain(RAW_WORKSPACE);
  });

  it('does not recall non-replayable records unless explicitly allowed', () => {
    const service = createService();
    const failedRecord: CapabilityMemoryRecord = {
      ...record,
      memoryId: 'memory-failed',
      outcome: 'failed',
      replayable: false,
    };

    const hidden = service.recall([failedRecord], {
      capabilityId: 'executor-gemini-cli',
    });
    const included = service.recall([failedRecord], {
      capabilityId: 'executor-gemini-cli',
      includeNonReplayable: true,
    });

    expect(hidden.status).toBe('no_match');
    expect(included.status).toBe('match_found');
    expect(included.bestMatch?.recommendedNextAction).toBe('offer_visible_fallback_or_manual_operator_review');
    expect(included.shouldPreloadHint).toBe(false);
  });

  it('reports insufficient signal instead of guessing', () => {
    const service = createService();

    const result = service.recall([record], {});

    expect(result).toMatchObject({
      status: 'insufficient_signal',
      bestMatch: null,
      shouldPreloadHint: false,
      recommendedNextAction: null,
    });
  });
});
