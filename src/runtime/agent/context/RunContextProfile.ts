export type RunContextDepth = 'hot' | 'warm' | 'cold';

export type RunContextProfile = {
  id: string;
  depth: RunContextDepth;
  includeHot: true;
  includeWarm: boolean;
  includeCold: boolean;
  reason: string;
  suggestedBy: string;
  gatesToolExposure: false;
};

export type RunContextProfileInput = RunContextDepth | Partial<RunContextProfile> | null | undefined;

const DEPTH_ORDER: RunContextDepth[] = ['hot', 'warm', 'cold'];

function normalizeDepth(value: unknown): RunContextDepth {
  return DEPTH_ORDER.includes(value as RunContextDepth) ? value as RunContextDepth : 'hot';
}

export function resolveRunContextProfile(input: RunContextProfileInput): RunContextProfile {
  const partial = typeof input === 'string' ? { depth: input } : input || {};
  const depth = normalizeDepth(partial.depth);

  return {
    id: String(partial.id || `${depth}-context`),
    depth,
    includeHot: true,
    includeWarm: Boolean(partial.includeWarm ?? (depth === 'warm' || depth === 'cold')),
    includeCold: Boolean(partial.includeCold ?? depth === 'cold'),
    reason: String(partial.reason || `Perfil ${depth} selecionado para montagem canonica de contexto.`),
    suggestedBy: String(partial.suggestedBy || 'caller'),
    gatesToolExposure: false,
  };
}
