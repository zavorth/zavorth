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

type WeightedSignal = {
  id: string;
  pattern: RegExp;
  score: number;
  reason: string;
};

const SCOPE_SIGNALS: WeightedSignal[] = [
  {
    id: 'entire-workspace',
    pattern: /\b(todo|toda|todos|todas|inteiro|inteira|completo|completa)\b[\s\S]{0,80}\b(zavorth|projeto|repo|repositorio|repository|workspace|codigo|codebase|monorepo|base)\b/i,
    score: 4,
    reason: 'escopo cobre projeto/workspace inteiro',
  },
  {
    id: 'many-surfaces',
    pattern: /\b(dashboard|cli|terminal|api|runtime|provider|providers|canais|channels|memoria|memory|profile|profiles|swarm|sandbox)\b[\s\S]{0,160}\b(dashboard|cli|terminal|api|runtime|provider|providers|canais|channels|memoria|memory|profile|profiles|swarm|sandbox)\b/i,
    score: 3,
    reason: 'pedido cruza varias superficies do produto',
  },
  {
    id: 'large-collection',
    pattern: /\b(todos os arquivos|todas as pastas|muitos arquivos|muitos documentos|lista grande|matriz completa|todos os providers|todos os canais|todos os testes)\b/i,
    score: 4,
    reason: 'pedido envolve colecao grande de itens',
  },
];

const WORK_KIND_SIGNALS: WeightedSignal[] = [
  {
    id: 'deep-audit',
    pattern: /\b(auditoria|audite|audit|verificacao completa|verifique tudo|deep review|revisao profunda|analise profunda)\b/i,
    score: 4,
    reason: 'trabalho pede auditoria ou revisao profunda',
  },
  {
    id: 'architecture-or-security',
    pattern: /\b(arquitetura|architecture|ddd|seguranca|security|risco|riscos|vulnerabilidade|compliance|governanca)\b/i,
    score: 3,
    reason: 'trabalho exige revisao especializada e validacao cruzada',
  },
  {
    id: 'migration-or-refactor',
    pattern: /\b(refator|migrar|migracao|reestrutur|consolidar|modernizar|organizar arquitetura|limpeza arquitetural)\b/i,
    score: 3,
    reason: 'trabalho parece migracao/refatoracao ampla',
  },
  {
    id: 'compare-systems',
    pattern: /\b(compare|comparar|paridade|nivel|equivalente|lado a lado)\b[\s\S]{0,120}\b(zavorth|projeto|sistema|agente|runtime|plataforma)\b/i,
    score: 3,
    reason: 'comparacao ampla se beneficia de decomposicao paralela',
  },
];

const QUALITY_SIGNALS: WeightedSignal[] = [
  {
    id: 'multi-validation',
    pattern: /\b(testes?|e2e|qa|validar|valide|provar|prove|confirmar|garantir|regressao|regression|smoke)\b/i,
    score: 2,
    reason: 'pedido exige validacao e evidencia',
  },
  {
    id: 'long-form',
    pattern: /\b(profundo|profunda|completo|completa|exaustivo|exaustiva|detalhado|detalhada|end-to-end|ponta a ponta)\b/i,
    score: 2,
    reason: 'pedido pede profundidade alta',
  },
  {
    id: 'independent-review',
    pattern: /\b(revisores?|criticos?|validadores?|dupla checagem|cross[-\s]?check|conflitos?|contradicoes?)\b/i,
    score: 2,
    reason: 'pedido pede revisao independente ou deteccao de conflito',
  },
];

const EXPLICIT_SWARM_PATTERN = /\b(swarm|subagentes?|multiagente|multi-agente|equipe de agentes|time de agentes|agentes em paralelo|decomponha com agentes|workers?)\b/i;
const AGENT_COUNT_PATTERN = /\b(\d{1,4}(?:[.,]\d{3})?)\s*(?:subagentes?|agentes?|workers?)\b/i;

export function assessSwarmWorkload(input: SwarmWorkloadAssessmentInput): SwarmWorkloadAssessment {
  const text = normalizeSearchText(input.text);
  const requestedTools = normalizeList(input.requestedTools);
  const metadata = input.metadata || {};
  const reasons: string[] = [];
  let score = 0;

  for (const signal of [...SCOPE_SIGNALS, ...WORK_KIND_SIGNALS, ...QUALITY_SIGNALS]) {
    if (!signal.pattern.test(text)) continue;
    score += signal.score;
    reasons.push(signal.reason);
  }

  const explicitAgentCount = resolveExplicitAgentCount(text, metadata);
  const explicitSwarmRequest = EXPLICIT_SWARM_PATTERN.test(text)
    || requestedTools.some((tool) => ['swarm.run', 'swarm.scale', 'swarm.massive', 'swarm.scale.live'].includes(tool))
    || metadata.swarmScale === true
    || metadata.massiveSwarm === true;
  if (explicitSwarmRequest) {
    score += 4;
    reasons.push('usuario pediu decomposicao por agentes/subagentes');
  }
  if (explicitAgentCount !== null) {
    score += explicitAgentCount >= 20 ? 4 : 2;
    reasons.push(`usuario especificou ${explicitAgentCount} agente(s)`);
  }

  const band = resolveBand(score, explicitAgentCount);
  const recommendedAgents = resolveRecommendedAgents({
    band,
    score,
    explicitAgentCount,
  });
  const shouldUseSwarm = explicitSwarmRequest || score >= 8;
  const shouldUseScalePlane = Boolean(
    explicitAgentCount !== null && explicitAgentCount >= 20
    || score >= 10
    || requestedTools.some((tool) => ['swarm.scale', 'swarm.massive', 'swarm.scale.live'].includes(tool))
    || metadata.swarmScale === true
    || metadata.massiveSwarm === true,
  );

  return {
    score,
    band,
    shouldUseSwarm,
    shouldUseScalePlane,
    explicitSwarmRequest,
    explicitAgentCount,
    recommendedAgents,
    recommendedMaxSteps: band === 'massive' || recommendedAgents >= 80 ? 4000 : Math.max(80, recommendedAgents * 4),
    recommendedMaxConcurrency: recommendedAgents <= 8
      ? Math.max(1, recommendedAgents)
      : recommendedAgents <= 80
        ? 16
        : 30,
    reasons: reasons.length > 0 ? Array.from(new Set(reasons)) : ['pedido nao exige decomposicao paralela'],
  };
}

function normalizeSearchText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean)));
}

function resolveExplicitAgentCount(text: string, metadata: Record<string, unknown>): number | null {
  const metadataCount = firstPositiveInteger(
    metadata.desiredAgents,
    metadata.agentCount,
    metadata.swarmAgents,
    metadata.swarmScaleAgents,
  );
  if (metadataCount !== null) {
    return clamp(metadataCount, 1, 4000);
  }
  const match = text.match(AGENT_COUNT_PATTERN);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1].replace(/[.,]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? clamp(parsed, 1, 4000) : null;
}

function firstPositiveInteger(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.trunc(parsed);
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
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
