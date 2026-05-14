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
    blockers.push('Operations health degradado; revalide database/event bus antes de promover novas capacidades.');
  }
  if (memory.summary.pressure === 'critical') {
    blockers.push('Layered memory em pressao critica; compacte ou rebalanceie as camadas antes de promover/publish.');
  } else if (memory.summary.pressure === 'elevated') {
    warnings.push('Layered memory com pressao elevada; monitore budgets antes de ampliar o learning loop.');
  }
  if ((platform.summary?.quarantined || 0) > 0 || learning.counts.quarantined > 0) {
    blockers.push('Existem itens em quarentena no platform/learning plane; revise-os antes de promover ou publicar.');
  }
  if ((platform.summary?.reviewPending || 0) > 0) {
    warnings.push('Ha itens aguardando review no platform plane; mantenha o trust pipeline em dia.');
  }
  if (learning.counts.pending > 0) {
    warnings.push('Existem candidatos aprendidos pendentes; aprove ou rejeite antes de acumular backlog de aprendizado.');
  }
  if (learning.summary.rejectedRate >= 0.4 && learning.summary.totalCandidates > 0) {
    warnings.push('A taxa de rejeicao do learning plane esta alta; revise os criterios de sintese e promocao.');
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
      ? 'Quality gate verde; voce pode promover capacidades aprendidas com seguranca.'
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
