import type { LearningMetricsDTO, MemoryMetricsDTO } from '../../../contracts/public/rest/dto.js';
import type { OpsHealthDTO, OpsQualityDTO, PlatformStatusDTO } from '../../../contracts/public/rest/platform-ops-dto.js';

export async function readOpsQuality(
  input: {
    mode?: 'fast' | 'live';
    userId?: string | null;
    sessionId?: string | null;
    chatId?: string | null;
    workspaceHint?: string | null;
  },
  deps: {
    readLearningMetrics: (query: { workspace?: string | null }) => LearningMetricsDTO;
    readMemoryMetrics: (query: {
      userId?: string | null;
      sessionId?: string | null;
      chatId?: string | null;
      workspaceHint?: string | null;
    }) => Promise<MemoryMetricsDTO>;
    readOpsHealth: (mode?: 'fast' | 'live') => OpsHealthDTO;
    readPlatformStatus: () => PlatformStatusDTO;
    normalizeValue: (value: unknown) => string;
  },
): Promise<OpsQualityDTO> {
  const learning = deps.readLearningMetrics({
    workspace: deps.normalizeValue(input.workspaceHint),
  });
  const memory = await deps.readMemoryMetrics({
    userId: input.userId,
    sessionId: input.sessionId,
    chatId: input.chatId,
    workspaceHint: input.workspaceHint,
  });
  const ops = deps.readOpsHealth(input.mode || 'fast');
  const platform = deps.readPlatformStatus();
  let score = 1;
  if (!ops.healthy) {
    score -= 0.35;
  }
  score -= Math.min(0.15, (platform.summary?.reviewPending || 0) * 0.02);
  score -= Math.min(0.15, (platform.summary?.quarantined || 0) * 0.04);
  if (memory.summary.pressure === 'elevated') {
    score -= 0.1;
  } else if (memory.summary.pressure === 'critical') {
    score -= 0.2;
  }
  if (learning.summary.totalCandidates > 0 && learning.summary.rejectedRate >= 0.4) {
    score -= 0.05;
  }
  score = Math.max(0, Math.min(1, Number(score.toFixed(3))));
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!ops.healthy) {
    blockers.push('Operations health is degraded; revalidate database/event bus before promoting new capabilities.');
  }
  if (memory.summary.pressure === 'critical') {
    blockers.push('Layered memory is under critical pressure; compact or rebalance layers before promoting/publishing.');
  } else if (memory.summary.pressure === 'elevated') {
    warnings.push('Layered memory is under elevated pressure; monitor budgets before expanding the learning loop.');
  }
  if ((platform.summary?.quarantined || 0) > 0 || learning.counts.quarantined > 0) {
    blockers.push('There are quarantined items in the platform/learning plane; review them before promoting or publishing.');
  }
  if ((platform.summary?.reviewPending || 0) > 0) {
    warnings.push('There are items waiting for review in the platform plane; keep the trust pipeline up to date.');
  }
  if (learning.counts.pending > 0) {
    warnings.push('There are pending learned candidates; approve or reject them before accumulating learning backlog.');
  }
  if (learning.summary.rejectedRate >= 0.4 && learning.summary.totalCandidates > 0) {
    warnings.push('The learning plane rejection rate is high; review synthesis and promotion criteria.');
  }

  const gateState: OpsQualityDTO['gate']['state'] =
    blockers.length > 0
      ? 'block'
      : warnings.length > 0 || score < 0.8
        ? 'warn'
        : 'pass';
  const allowsPromotion = blockers.length === 0;
  const allowsPublishing = blockers.length === 0
    && (platform.summary?.reviewPending || 0) === 0
    && learning.counts.pending === 0;
  const nextStep = blockers[0]
    || warnings[0]
    || (gateState === 'pass'
      ? 'Quality gate is green; you can safely promote learned capabilities.'
      : null);

  return {
    generatedAt: new Date().toISOString(),
    score,
    healthy: ops.healthy && memory.summary.pressure !== 'critical',
    gate: {
      state: gateState,
      allowsPromotion,
      allowsPublishing,
      blockers,
      warnings,
      nextStep,
    },
    summary: {
      recoveryState: ops.healthy && memory.summary.pressure !== 'critical' ? 'ready' : 'degraded',
      learningPending: learning.counts.pending,
      quarantinedItems: (platform.summary?.quarantined || 0) + learning.counts.quarantined,
      memoryPressure: memory.summary.pressure,
    },
    operations: {
      uptime: ops.uptime,
      components: ops.components,
    },
    learning: {
      totalCandidates: learning.summary.totalCandidates,
      acceptedRate: learning.summary.acceptedRate,
      rejectedRate: learning.summary.rejectedRate,
      promotedRate: learning.summary.promotedRate,
      averageScore: learning.summary.averageScore,
      pending: learning.counts.pending,
      quarantined: learning.counts.quarantined,
    },
    memory: {
      totalEntries: memory.summary.totalEntries,
      episodic: memory.summary.episodic,
      semantic: memory.summary.semantic,
      procedural: memory.summary.procedural,
      averageBudgetUsage: memory.summary.averageBudgetUsage,
      pressure: memory.summary.pressure,
    },
    platform: {
      total: platform.summary?.total || 0,
      trusted: platform.summary?.trusted || 0,
      reviewPending: platform.summary?.reviewPending || 0,
      quarantined: platform.summary?.quarantined || 0,
      learnedLocal: platform.summary?.learnedLocal || 0,
    },
  };
}
