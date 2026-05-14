import type { UniversalAgentRequest } from '../UniversalAgentRuntimeTypes.js';
import { resolveRunContextProfile, type RunContextProfile } from './RunContextProfile.js';

export type LightweightRunProfileClassifierInput = {
  request: Pick<UniversalAgentRequest, 'text' | 'workspace' | 'requestedTools' | 'metadata'>;
  hasWorkspaceProfile?: boolean;
  hasMemoryContext?: boolean;
  hasSkillOrMcpSnapshot?: boolean;
};

function textIncludesAny(text: string, needles: string[]): boolean {
  const normalized = text.toLowerCase();
  return needles.some((needle) => normalized.includes(needle));
}

export class LightweightRunProfileClassifier {
  public classify(input: LightweightRunProfileClassifierInput): RunContextProfile {
    const text = String(input.request.text || '');
    const requestedTools = Array.isArray(input.request.requestedTools) ? input.request.requestedTools : [];
    const metadata = input.request.metadata || {};
    const explicitDepth = typeof metadata.contextDepth === 'string' ? metadata.contextDepth : null;

    if (explicitDepth === 'hot' || explicitDepth === 'warm' || explicitDepth === 'cold') {
      return resolveRunContextProfile({
        depth: explicitDepth,
        id: `${explicitDepth}-context`,
        reason: 'Profundidade de contexto sugerida por metadata da requisicao.',
        suggestedBy: 'request-metadata',
      });
    }

    if (
      input.hasMemoryContext
      || input.hasSkillOrMcpSnapshot
      || requestedTools.some((toolId) => /memory|mnemos|mcp|skill/i.test(toolId))
      || textIncludesAny(text, ['memoria', 'memória', 'mnemos', 'skill', 'mcp'])
    ) {
      return resolveRunContextProfile({
        depth: 'cold',
        id: 'cold-context',
        reason: 'Pedido menciona memoria, skills, MCP ou traz snapshots frios disponiveis.',
        suggestedBy: 'lightweight-classifier',
      });
    }

    if (
      Boolean(input.request.workspace)
      || input.hasWorkspaceProfile
      || requestedTools.length > 0
      || textIncludesAny(text, ['workspace', 'repositorio', 'repositório', 'arquivo', 'codigo', 'código'])
    ) {
      return resolveRunContextProfile({
        depth: 'warm',
        id: 'warm-context',
        reason: 'Pedido precisa de contexto de workspace ou tools sem exigir memoria fria.',
        suggestedBy: 'lightweight-classifier',
      });
    }

    return resolveRunContextProfile({
      depth: 'hot',
      id: 'hot-context',
      reason: 'Pedido conversacional simples usa contexto minimo de sessao.',
      suggestedBy: 'lightweight-classifier',
    });
  }
}
