import { logger } from '../../logger.js';
import type {
ZavorthReplayLearningCard,
  ZavorthReplayLearningControlPlaneSnapshot,
  ZavorthReplayLearningPosture,
} from '../ZavorthReplayLearningControlPlaneService.js';

export async function safeAsync<T>(fn: () => T | Promise<T>, fallback: T): Promise<T> {
  try {
    const value = await fn();
    return (value === undefined ? fallback : value) as T;
  } catch (error: unknown) {logger.warn('[Replay Learning Control Plane] operation failed', error); return fallback; }
}

export function safeSync<T>(fn: () => T, fallback: T): T {
  try {
    const value = fn();
    return value === undefined ? fallback : value;
  } catch (error: unknown) {logger.warn('[Replay Learning Control Plane] operation failed', error); return fallback; }
}

export function normalizeReplayLearningLimit(limit: number | null | undefined): number {
  const numeric = Number(limit || 8);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 8;
  }
  return Math.max(1, Math.min(24, Math.floor(numeric)));
}

export function nullableText(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

export function text(value: unknown, fallback: string): string {
  return nullableText(value) || fallback;
}

export function isReplayLearningColdStart(
  summary: ZavorthReplayLearningControlPlaneSnapshot['summary'],
): boolean {
  return summary.timelineEvents === 0
    && summary.recentArtifacts === 0
    && summary.workflowRuns === 0
    && summary.lifecycleEvents === 0
    && summary.learningCandidates === 0
    && summary.pendingLearning === 0
    && summary.promotedLearning === 0
    && summary.memoryEntries === 0
    && summary.proceduralEntries === 0
    && !summary.compareReady
    && !summary.resumeReady
    && !summary.restoreReady
    && summary.memoryPressure === 'ok';
}

export function buildReplayLearningOperatorSummary(
  summary: ZavorthReplayLearningControlPlaneSnapshot['summary'],
): string {
  return [
    `Replay ${summary.resumeReady ? 'retomavel' : 'without alvo forte'} com ${summary.timelineEvents} evento(s).`,
    `${summary.reusableArtifacts}/${summary.recentArtifacts} artifact(s) reutilizavel(is).`,
    `Lifecycle canonical com ${summary.lifecycleEvents} evento(s), ${summary.lifecycleRuns} run(s) e ${summary.lifecycleAttention} alerta(s).`,
    `${summary.learningCandidates} candidate(s) de learning, ${summary.pendingLearning} pending(s) e ${summary.promotedLearning} promovido(s).`,
    `Memory with ${summary.memoryEntries} entry(s), ${summary.proceduralEntries} procedure(s) e pressure ${summary.memoryPressure}.`,
  ].join(' ');
}

export function resolveReplayLearningPosture(input: {
  summary: ZavorthReplayLearningControlPlaneSnapshot['summary'];
  actions: ZavorthReplayLearningControlPlaneSnapshot['actions'];
  cards: ZavorthReplayLearningCard[];
}): ZavorthReplayLearningPosture {
  if (isReplayLearningColdStart(input.summary)) {
    return 'healthy';
  }
  if (
    input.summary.memoryPressure === 'critical'
    || input.actions.some((entry) => entry.severity === 'critical')
    || input.cards.some((entry) => entry.posture === 'critical')
  ) {
    return 'critical';
  }
  if (
    input.summary.pendingLearning > 0
    || input.summary.resumableWorkflowRuns > 0
    || input.summary.memoryPressure === 'elevated'
    || input.actions.some((entry) => entry.severity === 'warn')
    || input.cards.some((entry) => entry.posture === 'attention')
  ) {
    return 'attention';
  }
  return 'healthy';
}
