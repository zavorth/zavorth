import type {
  LearningActionResultDTO,
  LearningCandidatesDTO,
  LearningMetricsDTO,
  LearningStatusDTO,
  MemoryMetricsDTO,
  MemoryProceduresDTO,
  MemorySearchResultsDTO,
  MemoryStatusDTO,
  SessionListDTO,
} from '../../../contracts/public/rest/dto.js';
import type { CanonicalPublicApiRuntime } from './types.js';
import type { CanonicalPublicApiSharedSupport } from './shared.js';

export async function readSessions(
  runtime: CanonicalPublicApiRuntime,
  support: CanonicalPublicApiSharedSupport,
  input: {
    userId?: string | null;
    sessionId?: string | null;
    chatId?: string | null;
    sourceUserId?: string | null;
    limit?: number;
  } = {},
): Promise<SessionListDTO> {
  const sessionPlane = runtime.getSessionPlane();
  if (!sessionPlane) {
    return {
      data: [],
      total: 0,
      hasMore: false,
    };
  }

  const userId = support.resolveUserId(input.userId);
  const snapshot = await sessionPlane.buildSnapshot({
    userId,
    platform: 'web',
    sessionId: support.normalizeValue(input.sessionId),
    chatId: support.normalizeValue(input.chatId),
    sourceUserId: support.normalizeValue(input.sourceUserId),
    limit: input.limit,
  });
  const data = snapshot.sessions.entries.map((entry) => support.serializeSession(entry, snapshot.generatedAt));

  return {
    data,
    total: snapshot.sessions.total,
    hasMore: snapshot.sessions.total > data.length,
  };
}

export function readLearningStatus(
  runtime: CanonicalPublicApiRuntime,
  support: CanonicalPublicApiSharedSupport,
  input: { workspace?: string | null } = {},
): LearningStatusDTO {
  const learningPlane = runtime.getLearningPlane();
  if (!learningPlane || typeof learningPlane.buildSnapshot !== 'function') {
    return {
      generatedAt: new Date().toISOString(),
      summary: {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        promoted: 0,
        published: 0,
        quarantined: 0,
        highConfidence: 0,
      },
    };
  }

  const snapshot = learningPlane.buildSnapshot({
    workspace: support.normalizeValue(input.workspace),
  });
  return {
    generatedAt: snapshot.generatedAt,
    summary: snapshot.summary,
  };
}

export function readLearningCandidates(
  runtime: CanonicalPublicApiRuntime,
  support: CanonicalPublicApiSharedSupport,
  input: { workspace?: string | null } = {},
): LearningCandidatesDTO {
  const learningPlane = runtime.getLearningPlane();
  if (!learningPlane || typeof learningPlane.buildSnapshot !== 'function') {
    return {
      generatedAt: new Date().toISOString(),
      summary: readLearningStatus(runtime, support, input).summary,
      data: [],
    };
  }

  const snapshot = learningPlane.buildSnapshot({
    workspace: support.normalizeValue(input.workspace),
  });
  return {
    generatedAt: snapshot.generatedAt,
    summary: snapshot.summary,
    data: snapshot.candidates,
  };
}

export function executeLearningAction(
  runtime: CanonicalPublicApiRuntime,
  support: CanonicalPublicApiSharedSupport,
  input: {
    candidateId?: string | null;
    actionId?: string | null;
  },
): LearningActionResultDTO {
  const learningPlane = runtime.getLearningPlane();
  if (!learningPlane || typeof learningPlane.executeAction !== 'function') {
    throw new Error('Learning plane indisponivel.');
  }
  const candidateId = support.normalizeValue(input.candidateId);
  const actionId = normalizeLearningActionId(input.actionId);
  if (!candidateId) {
    throw new Error('candidateId obrigatorio.');
  }
  if (!actionId) {
    throw new Error('actionId invalido para learning plane.');
  }

  const execution = learningPlane.executeAction({
    candidateId,
    actionId,
  });
  return {
    generatedAt: execution.generatedAt,
    candidateId: execution.candidateId,
    actionId: execution.actionId,
    status: execution.status,
    ok: execution.ok,
    summary: execution.summary,
    details: execution.details,
  };
}

function normalizeLearningActionId(value: unknown):
  | 'approve'
  | 'reject'
  | 'promote'
  | 'forget'
  | 'promoteProcedure'
  | 'promoteSkill'
  | null {
  const normalized = String(value || '').trim().replace(/_/g, '-').toLowerCase();
  if (normalized === 'approve' || normalized === 'reject' || normalized === 'promote' || normalized === 'forget') {
    return normalized;
  }
  if (normalized === 'promote-procedure' || normalized === 'promoteprocedure') {
    return 'promoteProcedure';
  }
  if (normalized === 'promote-skill' || normalized === 'promoteskill') {
    return 'promoteSkill';
  }
  return null;
}

export function readLearningMetrics(
  runtime: CanonicalPublicApiRuntime,
  support: CanonicalPublicApiSharedSupport,
  input: { workspace?: string | null } = {},
): LearningMetricsDTO {
  const learningPlane = runtime.getLearningPlane();
  if (!learningPlane) {
    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalCandidates: 0,
        acceptedRate: 0,
        rejectedRate: 0,
        promotedRate: 0,
        averageScore: 0,
      },
      counts: {
        pending: 0,
        approved: 0,
        rejected: 0,
        promoted: 0,
        published: 0,
        quarantined: 0,
        highConfidence: 0,
      },
    };
  }

  if (typeof learningPlane.readMetrics === 'function') {
    const snapshot = learningPlane.readMetrics({
      workspace: support.normalizeValue(input.workspace),
    });
    const fallback = readLearningStatus(runtime, support, input).summary;
    return {
      generatedAt: snapshot.generatedAt,
      summary: snapshot.summary,
      counts: {
        pending: fallback.pending,
        approved: fallback.approved,
        rejected: fallback.rejected,
        promoted: fallback.promoted,
        published: fallback.published,
        quarantined: fallback.quarantined,
        highConfidence: fallback.highConfidence,
      },
    };
  }

  const snapshot = learningPlane.buildSnapshot?.({
    workspace: support.normalizeValue(input.workspace),
  });
  const total = snapshot?.summary.total || 1;
  const candidates = snapshot?.candidates || [];
  const averageScore = candidates.length
    ? Number((
      candidates.reduce((acc, candidate) => acc + Number(candidate.score || 0), 0)
      / candidates.length
    ).toFixed(3))
    : 0;

  return {
    generatedAt: snapshot?.generatedAt || new Date().toISOString(),
    summary: {
      totalCandidates: snapshot?.summary.total || 0,
      acceptedRate: Number((((snapshot?.summary.approved || 0) / total)).toFixed(3)),
      rejectedRate: Number((((snapshot?.summary.rejected || 0) / total)).toFixed(3)),
      promotedRate: Number((((snapshot?.summary.promoted || 0) / total)).toFixed(3)),
      averageScore,
    },
    counts: {
      pending: snapshot?.summary.pending || 0,
      approved: snapshot?.summary.approved || 0,
      rejected: snapshot?.summary.rejected || 0,
      promoted: snapshot?.summary.promoted || 0,
      published: snapshot?.summary.published || 0,
      quarantined: snapshot?.summary.quarantined || 0,
      highConfidence: snapshot?.summary.highConfidence || 0,
    },
  };
}

export async function readMemoryStatus(
  runtime: CanonicalPublicApiRuntime,
  support: CanonicalPublicApiSharedSupport,
  input: {
    userId?: string | null;
    sessionId?: string | null;
    chatId?: string | null;
    workspaceHint?: string | null;
  } = {},
): Promise<MemoryStatusDTO> {
  const layeredMemory = runtime.getLayeredMemory();
  if (!layeredMemory || typeof layeredMemory.buildStatus !== 'function') {
    return {
      generatedAt: new Date().toISOString(),
      summary: {
        total: 0,
        episodic: 0,
        semantic: 0,
        procedural: 0,
      },
      budgets: {
        perLayer: 0,
        episodicUsage: 0,
        semanticUsage: 0,
        proceduralUsage: 0,
      },
    };
  }

  return layeredMemory.buildStatus({
    userId: support.resolveUserId(input.userId),
    sessionId: support.normalizeValue(input.sessionId),
    chatId: support.normalizeValue(input.chatId),
    workspaceHint: support.normalizeValue(input.workspaceHint),
  });
}

export async function searchMemory(
  runtime: CanonicalPublicApiRuntime,
  support: CanonicalPublicApiSharedSupport,
  input: {
    userId?: string | null;
    sessionId?: string | null;
    chatId?: string | null;
    workspaceHint?: string | null;
    query?: string | null;
    limit?: number;
  } = {},
): Promise<MemorySearchResultsDTO> {
  const layeredMemory = runtime.getLayeredMemory();
  if (!layeredMemory || typeof layeredMemory.search !== 'function') {
    return {
      generatedAt: new Date().toISOString(),
      query: '',
      total: 0,
      data: [],
    };
  }

  return layeredMemory.search({
    userId: support.resolveUserId(input.userId),
    sessionId: support.normalizeValue(input.sessionId),
    chatId: support.normalizeValue(input.chatId),
    workspaceHint: support.normalizeValue(input.workspaceHint),
    query: String(input.query || '').trim(),
    limit: input.limit,
  });
}

export async function readMemoryProcedures(
  runtime: CanonicalPublicApiRuntime,
  support: CanonicalPublicApiSharedSupport,
  input: {
    workspaceHint?: string | null;
  } = {},
): Promise<MemoryProceduresDTO> {
  const layeredMemory = runtime.getLayeredMemory();
  if (!layeredMemory || typeof layeredMemory.readProcedures !== 'function') {
    return {
      generatedAt: new Date().toISOString(),
      total: 0,
      data: [],
    };
  }

  return layeredMemory.readProcedures({
    workspaceHint: support.normalizeValue(input.workspaceHint),
  });
}

export async function readMemoryMetrics(
  runtime: CanonicalPublicApiRuntime,
  support: CanonicalPublicApiSharedSupport,
  input: {
    userId?: string | null;
    sessionId?: string | null;
    chatId?: string | null;
    workspaceHint?: string | null;
  } = {},
): Promise<MemoryMetricsDTO> {
  const layeredMemory = runtime.getLayeredMemory();
  if (!layeredMemory) {
    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalEntries: 0,
        episodic: 0,
        semantic: 0,
        procedural: 0,
        averageBudgetUsage: 0,
        pressure: 'ok',
      },
      budgets: {
        perLayer: 0,
        episodicUsage: 0,
        semanticUsage: 0,
        proceduralUsage: 0,
      },
      procedures: {
        total: 0,
        trustedLocal: 0,
        learnedDraft: 0,
        implicit: 0,
      },
    };
  }

  if (typeof layeredMemory.readMetrics === 'function') {
    return layeredMemory.readMetrics({
      userId: support.resolveUserId(input.userId),
      sessionId: support.normalizeValue(input.sessionId),
      chatId: support.normalizeValue(input.chatId),
      workspaceHint: support.normalizeValue(input.workspaceHint),
    });
  }

  const [status, procedures] = await Promise.all([
    layeredMemory.buildStatus?.({
      userId: support.resolveUserId(input.userId),
      sessionId: support.normalizeValue(input.sessionId),
      chatId: support.normalizeValue(input.chatId),
      workspaceHint: support.normalizeValue(input.workspaceHint),
    }) || Promise.resolve(null),
    layeredMemory.readProcedures?.({
      workspaceHint: support.normalizeValue(input.workspaceHint),
    }) || Promise.resolve(null),
  ]);
  const budgets = status?.budgets || {
    perLayer: 0,
    episodicUsage: 0,
    semanticUsage: 0,
    proceduralUsage: 0,
  };
  const averageBudgetUsage = Number((
    (Number(budgets.episodicUsage || 0) + Number(budgets.semanticUsage || 0) + Number(budgets.proceduralUsage || 0)) / 3
  ).toFixed(3));
  const maxUsage = Math.max(
    Number(budgets.episodicUsage || 0),
    Number(budgets.semanticUsage || 0),
    Number(budgets.proceduralUsage || 0),
  );

  return {
    generatedAt: status?.generatedAt || procedures?.generatedAt || new Date().toISOString(),
    summary: {
      totalEntries: status?.summary.total || 0,
      episodic: status?.summary.episodic || 0,
      semantic: status?.summary.semantic || 0,
      procedural: status?.summary.procedural || 0,
      averageBudgetUsage,
      pressure: maxUsage >= 0.85 ? 'critical' : maxUsage >= 0.6 ? 'elevated' : 'ok',
    },
    budgets,
    procedures: {
      total: procedures?.total || 0,
      trustedLocal: (procedures?.data || []).filter((entry: any) => entry.metadata?.lifecycle === 'trusted_local').length,
      learnedDraft: (procedures?.data || []).filter((entry: any) => entry.metadata?.lifecycle === 'learned_draft').length,
      implicit: (procedures?.data || []).filter((entry: any) => entry.metadata?.lifecycle === 'implicit').length,
    },
  };
}
