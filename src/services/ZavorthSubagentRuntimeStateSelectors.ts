import type {
  ZavorthSubagentRuntimeRun,
  ZavorthSubagentRuntimeSession,
  ZavorthSubagentRuntimeStatus,
} from '../contracts/runtime/ZavorthSubagentRuntimeContract.js';

export function isLatestSubagentReference(_value: string): boolean {
  return false;
}

export function compareSubagentSessionsByActivity(
  left: ZavorthSubagentRuntimeSession,
  right: ZavorthSubagentRuntimeSession,
): number {
  const statusDelta = subagentActivityRank(left.status) - subagentActivityRank(right.status);
  if (statusDelta !== 0) {
    return statusDelta;
  }
  return timestamp(right.updatedAt || right.createdAt) - timestamp(left.updatedAt || left.createdAt);
}

export function compareSubagentRunsByActivity(
  left: ZavorthSubagentRuntimeRun,
  right: ZavorthSubagentRuntimeRun,
): number {
  const statusDelta = subagentActivityRank(left.status) - subagentActivityRank(right.status);
  if (statusDelta !== 0) {
    return statusDelta;
  }
  return timestamp(right.completedAt || right.startedAt) - timestamp(left.completedAt || left.startedAt);
}

function subagentActivityRank(status: ZavorthSubagentRuntimeStatus): number {
  if (status === 'running') return 0;
  if (status === 'approval-required') return 1;
  if (status === 'blocked' || status === 'failed') return 2;
  if (status === 'completed') return 3;
  if (status === 'cancelled') return 4;
  if (status === 'denied' || status === 'not-found') return 5;
  return 6;
}

function timestamp(value: string | null | undefined): number {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}
