import type {
  RuntimeAccessLayeredMemorySnapshot,
  RuntimeAccessLearningSnapshot,
  RuntimeAccessPlatformSnapshot,
} from "./RuntimeAccessReadinessTypes.js";

export function buildRuntimeAccessLearningSnapshot(
  input: Partial<RuntimeAccessLearningSnapshot> | null | undefined,
): RuntimeAccessLearningSnapshot {
  return {
    available: Boolean(input),
    generatedAt:
      typeof input?.generatedAt === "string" ? input.generatedAt : null,
    summary: {
      total: Number(input?.summary?.total || 0),
      pending: Number(input?.summary?.pending || 0),
      approved: Number(input?.summary?.approved || 0),
      promoted: Number(input?.summary?.promoted || 0),
      quarantined: Number(input?.summary?.quarantined || 0),
      highConfidence: Number(input?.summary?.highConfidence || 0),
    },
    narrative: {
      headline: String(input?.narrative?.headline || "").trim(),
      operatorSummary: String(input?.narrative?.operatorSummary || "").trim(),
    },
  };
}

export function buildRuntimeAccessLayeredMemorySnapshot(
  input: Partial<RuntimeAccessLayeredMemorySnapshot> | null | undefined,
): RuntimeAccessLayeredMemorySnapshot {
  return {
    available: Boolean(input),
    generatedAt:
      typeof input?.generatedAt === "string" ? input.generatedAt : null,
    summary: {
      total: Number(input?.summary?.total || 0),
      episodic: Number(input?.summary?.episodic || 0),
      semantic: Number(input?.summary?.semantic || 0),
      procedural: Number(input?.summary?.procedural || 0),
    },
    budgets: {
      perLayer: Number(input?.budgets?.perLayer || 0),
      episodicUsage: Number(input?.budgets?.episodicUsage || 0),
      semanticUsage: Number(input?.budgets?.semanticUsage || 0),
      proceduralUsage: Number(input?.budgets?.proceduralUsage || 0),
    },
    narrative: {
      headline: String(input?.narrative?.headline || "").trim(),
      operatorSummary: String(input?.narrative?.operatorSummary || "").trim(),
    },
  };
}

export function buildRuntimeAccessPlatformSnapshot(
  input: Partial<RuntimeAccessPlatformSnapshot> | null | undefined,
): RuntimeAccessPlatformSnapshot {
  return {
    available: Boolean(input),
    generatedAt:
      typeof input?.generatedAt === "string" ? input.generatedAt : null,
    summary: {
      total: Number(input?.summary?.total || 0),
      plugins: Number(input?.summary?.plugins || 0),
      skills: Number(input?.summary?.skills || 0),
      mcps: Number(input?.summary?.mcps || 0),
      collections: Number(input?.summary?.collections || 0),
      recipes: Number(input?.summary?.recipes || 0),
      reviewPending: Number(input?.summary?.reviewPending || 0),
      quarantined: Number(input?.summary?.quarantined || 0),
      learnedLocal: Number(input?.summary?.learnedLocal || 0),
    },
    catalogSyncSummary: String(input?.catalogSyncSummary || "").trim() || null,
    narrative: {
      headline: String(input?.narrative?.headline || "").trim(),
      operatorSummary: String(input?.narrative?.operatorSummary || "").trim(),
    },
  };
}
