import fs from 'fs';
import path from 'path';
import type {
  ZavorthSubagentDynamicConfigSettings,
  ZavorthSubagentRuntimeLimits,
  ZavorthSubagentRuntimeObservabilityEvent,
  ZavorthSubagentRuntimePairedDevicesProjection,
  ZavorthSubagentRuntimeRun,
  ZavorthSubagentRuntimeSession,
} from '../contracts/runtime/ZavorthSubagentRuntimeContract.js';
import type { ZavorthSubagentAutoInvocationTelemetry } from '../contracts/runtime/ZavorthSubagentAutoInvocationContract.js';
import { compareSubagentRunsByActivity, compareSubagentSessionsByActivity, isLatestSubagentReference } from '../services/ZavorthSubagentRuntimeStateSelectors.js';
import { logger } from '../logger.js';
import type { ZavorthSubagentRuntimeCommandInput } from './ZavorthSubagentRuntimeService.js';
import { DEFAULT_DYNAMIC_CONFIG, DEFAULT_LIMITS, coerceDynamicConfigProjection, emptyState, normalizeNullable, normalizeRoleMode, positiveInteger, type StoredState } from './ZavorthSubagentRuntimeHelpers.js';

export class ZavorthSubagentRuntimeStateService {
  public constructor(
    private readonly now: () => Date,
    private readonly stateFilePath: string,
    private readonly existsSyncImpl: typeof fs.existsSync,
    private readonly mkdirSyncImpl: typeof fs.mkdirSync,
    private readonly readFileSyncImpl: typeof fs.readFileSync,
    private readonly writeFileSyncImpl: typeof fs.writeFileSync,
  ) {}

  public findSession(state: StoredState, reference: string | null | undefined): ZavorthSubagentRuntimeSession | null {
    const normalized = normalizeNullable(reference);
    if (!normalized || isLatestSubagentReference(normalized)) {
      return [...state.sessions].sort(compareSubagentSessionsByActivity)[0] || null;
    }
    const exact = state.sessions.find((entry) => entry.sessionId === normalized);
    if (exact) {
      return exact;
    }
    const bySuffix = state.sessions.find((entry) => entry.sessionId.endsWith(normalized) || entry.sessionId.includes(normalized));
    if (bySuffix) {
      return bySuffix;
    }
    const run = this.findRun(state, normalized);
    return run ? state.sessions.find((entry) => entry.sessionId === run.sessionId) || null : null;
  }

  public findRun(state: StoredState, reference: string | null | undefined): ZavorthSubagentRuntimeRun | null {
    const normalized = normalizeNullable(reference);
    if (!normalized || isLatestSubagentReference(normalized)) {
      return [...state.runs].sort(compareSubagentRunsByActivity)[0] || null;
    }
    return (
      state.runs.find(
        (entry) => entry.runId === normalized || entry.runId.endsWith(normalized) || entry.runId.includes(normalized) || entry.sessionId === normalized || entry.sessionId.endsWith(normalized) || entry.sessionId.includes(normalized),
      ) || null
    );
  }

  public readState(): StoredState {
    try {
      if (!this.existsSyncImpl(this.stateFilePath)) {
        return emptyState();
      }
      const parsed = JSON.parse(this.readFileSyncImpl(this.stateFilePath, 'utf8')) as Partial<StoredState>;
      return {
        sessions: Array.isArray(parsed.sessions)
          ? (parsed.sessions.map((session) => ({
              ...session,
              roleMode: normalizeRoleMode((session as Partial<ZavorthSubagentRuntimeSession>).roleMode, DEFAULT_DYNAMIC_CONFIG.defaultRoleMode),
            })) as ZavorthSubagentRuntimeSession[])
          : [],
        runs: Array.isArray(parsed.runs)
          ? (parsed.runs.map((run) => ({
              ...run,
              roleMode: normalizeRoleMode((run as Partial<ZavorthSubagentRuntimeRun>).roleMode, DEFAULT_DYNAMIC_CONFIG.defaultRoleMode),
            })) as ZavorthSubagentRuntimeRun[])
          : [],
        timeline: Array.isArray(parsed.timeline) ? parsed.timeline : [],
        receipts: Array.isArray(parsed.receipts) ? parsed.receipts : [],
        autoInvocationDecisions: Array.isArray((parsed as Partial<StoredState>).autoInvocationDecisions) ? ((parsed as Partial<StoredState>).autoInvocationDecisions as ZavorthSubagentAutoInvocationTelemetry[]) : [],
        dynamicConfig: coerceDynamicConfigProjection((parsed as Partial<StoredState>).dynamicConfig),
        pairedDevices: Array.isArray((parsed as Partial<StoredState>).pairedDevices) ? ((parsed as Partial<StoredState>).pairedDevices as ZavorthSubagentRuntimePairedDevicesProjection['devices']) : [],
        observabilityEvents: Array.isArray((parsed as Partial<StoredState>).observabilityEvents) ? ((parsed as Partial<StoredState>).observabilityEvents as ZavorthSubagentRuntimeObservabilityEvent[]) : [],
        batchRuns: positiveInteger((parsed as Partial<StoredState>).batchRuns, 0),
      };
    } catch (error: unknown) {
      logger.warn('[Zavorth Subagent Runtime] parsing failed', error);
      return emptyState();
    }
  }

  public persistIfNeeded(state: StoredState, input: ZavorthSubagentRuntimeCommandInput): void {
    if (input.persistState === false) {
      return;
    }
    this.mkdirSyncImpl(path.dirname(this.stateFilePath), { recursive: true });
    this.writeFileSyncImpl(
      this.stateFilePath,
      JSON.stringify(
        {
          version: 1,
          updatedAt: this.now().toISOString(),
          sessions: state.sessions.slice(-100),
          runs: state.runs.slice(-200),
          timeline: state.timeline.slice(-500),
          receipts: state.receipts.slice(-500),
          autoInvocationDecisions: state.autoInvocationDecisions.slice(-100),
          dynamicConfig: state.dynamicConfig,
          pairedDevices: state.pairedDevices.slice(0, 50),
          observabilityEvents: state.observabilityEvents.slice(-500),
          batchRuns: state.batchRuns,
        },
        null,
        2,
      ),
      'utf8',
    );
  }

  public resolveLimits(input: ZavorthSubagentRuntimeCommandInput, settings: ZavorthSubagentDynamicConfigSettings = DEFAULT_DYNAMIC_CONFIG): ZavorthSubagentRuntimeLimits {
    return {
      ...DEFAULT_LIMITS,
      maxWallClockMs: positiveInteger(input.childTimeoutMs, settings.childTimeoutMs),
      maxToolCalls: positiveInteger(input.maxToolCalls, DEFAULT_LIMITS.maxToolCalls),
      maxSpawnDepth: positiveInteger(input.maxSpawnDepth, settings.maxSpawnDepth),
      maxChildren: positiveInteger(input.maxChildren || input.maxConcurrentChildren, settings.maxConcurrentChildren),
    };
  }

  public resolveDepth(state: StoredState, parentRunId: string | null | undefined): number {
    let depth = 0;
    let cursor = normalizeNullable(parentRunId);
    while (cursor) {
      depth += 1;
      const parent = state.runs.find((run) => run.runId === cursor);
      cursor = parent?.parentRunId || null;
      if (depth > 20) {
        return depth;
      }
    }
    return depth;
  }
}
