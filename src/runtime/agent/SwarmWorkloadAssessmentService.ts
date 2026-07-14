/**
 * Swarm sizing from structured signals only (requested tool ids + metadata).
 * Free-text keywords never enable or size multi-agent work.
 */

export type SwarmWorkloadComplexityBand = 'simple' | 'moderate' | 'large' | 'massive';

export type SwarmWorkloadAssessmentInput = {
  text: string;
  requestedTools?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

export type SwarmWorkloadAssessment = {
  score: number;
  band: SwarmWorkloadComplexityBand;
  shouldUseSwarm: boolean;
  shouldUseScalePlane: boolean;
  explicitSwarmRequest: boolean;
  explicitAgentCount: number | null;
  recommendedAgents: number;
  recommendedMaxSteps: number;
  recommendedMaxConcurrency: number;
  reasons: string[];
};

const SWARM_TOOL_IDS = new Set([
  'swarm.run',
  'swarm.scale',
  'swarm.massive',
  'swarm.scale.live',
  'zavorth_delegate',
  'agent_manager',
  'agent_consensus_engine',
]);

export function assessSwarmWorkload(input: SwarmWorkloadAssessmentInput): SwarmWorkloadAssessment {
  const requestedTools = normalizeList(input.requestedTools);
  const metadata = input.metadata || {};
  const reasons: string[] = [];
  let score = 0;

  const toolSwarmRequest = requestedTools.some((tool) => SWARM_TOOL_IDS.has(tool));
  const metadataSwarm = metadata.swarmScale === true || metadata.massiveSwarm === true;
  const explicitSwarmRequest = toolSwarmRequest || metadataSwarm;

  if (toolSwarmRequest) {
    score += 4;
    reasons.push('requested swarm/team tools');
  }
  if (metadataSwarm) {
    score += 4;
    reasons.push('metadata requested swarm scale');
  }

  const explicitAgentCount = resolveExplicitAgentCount(metadata);
  if (explicitAgentCount !== null) {
    score += explicitAgentCount >= 20 ? 4 : 2;
    reasons.push(`metadata agent count: ${explicitAgentCount}`);
  }

  const band = resolveBand(score, explicitAgentCount);
  const recommendedAgents = resolveRecommendedAgents({
    band,
    score,
    explicitAgentCount,
  });
  const shouldUseSwarm = explicitSwarmRequest || (explicitAgentCount !== null && explicitAgentCount >= 2);
  const shouldUseScalePlane = Boolean(
    (explicitAgentCount !== null && explicitAgentCount >= 20)
    || requestedTools.some((tool) => ['swarm.scale', 'swarm.massive', 'swarm.scale.live'].includes(tool))
    || metadata.swarmScale === true
    || metadata.massiveSwarm === true,
  );

  return {
    score,
    band: shouldUseSwarm ? band : 'simple',
    shouldUseSwarm,
    shouldUseScalePlane: shouldUseSwarm && shouldUseScalePlane,
    explicitSwarmRequest,
    explicitAgentCount,
    recommendedAgents: shouldUseSwarm ? recommendedAgents : 1,
    recommendedMaxSteps: band === 'massive' || recommendedAgents >= 80 ? 4000 : Math.max(80, recommendedAgents * 4),
    recommendedMaxConcurrency: recommendedAgents <= 8
      ? Math.max(1, recommendedAgents)
      : recommendedAgents <= 80
        ? 16
        : 30,
    reasons: reasons.length > 0
      ? Array.from(new Set(reasons))
      : ['no structured multi-agent signal'],
  };
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean)));
}

function resolveExplicitAgentCount(metadata: Record<string, unknown>): number | null {
  return firstPositiveInteger(
    metadata.desiredAgents,
    metadata.agentCount,
    metadata.swarmAgents,
    metadata.swarmScaleAgents,
  );
}

function firstPositiveInteger(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return clamp(Math.trunc(parsed), 1, 4000);
    }
  }
  return null;
}

function resolveBand(score: number, explicitAgentCount: number | null): SwarmWorkloadComplexityBand {
  if ((explicitAgentCount || 0) >= 300 || score >= 14) return 'massive';
  if ((explicitAgentCount || 0) >= 20 || score >= 10) return 'large';
  if (score >= 6) return 'moderate';
  return 'simple';
}

function resolveRecommendedAgents(input: {
  band: SwarmWorkloadComplexityBand;
  score: number;
  explicitAgentCount: number | null;
}): number {
  if (input.explicitAgentCount !== null) {
    return clamp(input.explicitAgentCount, 1, 4000);
  }
  if (input.band === 'massive') return input.score >= 16 ? 160 : 80;
  if (input.band === 'large') return 40;
  if (input.band === 'moderate') return 8;
  return 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
