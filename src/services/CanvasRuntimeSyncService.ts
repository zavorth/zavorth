import { getRuntimeEngineApiState } from './RuntimeEngineApiStateService.js';

import type {
  CanvasSessionSnapshot,
  ExecutionEngineId,
} from '../contracts/ExecutionEngineContract.js';

import type { ZavorthSpeculativeAutonomyResult } from './ZavorthSpeculativeAutonomyService.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

export type CanvasSpeculativeAutonomySyncService = {
  createFromSpeculativeAutonomyResult(
    result: ZavorthSpeculativeAutonomyResult,
    engineId?: ExecutionEngineId,
  ): Promise<CanvasSessionSnapshot>;
};

export type CanvasSpeculativeAutonomySyncSnapshot = {
  ok: boolean;
  engineId: ExecutionEngineId;
  sandboxRunId: string;
  sessionId: string | null;
  activeAttemptId: string | null;
  previewUrl: string | null;
  attemptCount: number;
  status: ZavorthSpeculativeAutonomyResult['status'] | 'sync-failed';
  error: string | null;
};

export function resolveCanvasSessionServiceForRuntime(): CanvasSpeculativeAutonomySyncService | null {
  if (process.env.ZAVORTH_CANVAS_AUTO_SYNC === 'false') {
    return null;
  }
  if (process.env.NODE_ENV === 'test' && process.env.ZAVORTH_CANVAS_AUTO_SYNC !== 'true') {
    return null;
  }
  return getRuntimeEngineApiState().canvasSessions;
}

export async function syncSpeculativeAutonomyToCanvas(input: {
  service: CanvasSpeculativeAutonomySyncService | null;
  result: ZavorthSpeculativeAutonomyResult | null;
  engineId?: ExecutionEngineId;
}): Promise<CanvasSpeculativeAutonomySyncSnapshot | null> {
  const result = input.result;
  if (!result || !input.service) return null;
  const engineId = input.engineId ?? 'shield';
  try {
    const session = await input.service.createFromSpeculativeAutonomyResult(result, engineId);
    return {
      ok: true,
      engineId,
      sandboxRunId: result.id,
      sessionId: session.sessionId,
      activeAttemptId: session.activeAttemptId,
      previewUrl: session.previewUrl,
      attemptCount: session.attempts.length,
      status: result.status,
      error: null,
    };
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[Canvas Runtime] creation failed', error);
    return {
      ok: false,
      engineId,
      sandboxRunId: result.id,
      sessionId: null,
      activeAttemptId: null,
      previewUrl: null,
      attemptCount: result.attempts.length,
      status: 'sync-failed',
      error: error instanceof Error ? err.message : String(error),
    };
  }
}
