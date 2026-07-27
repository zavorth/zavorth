import type { UniversalAgentRequest } from '../UniversalAgentRuntimeTypes.js';
import { resolveRunContextProfile, type RunContextProfile } from './RunContextProfile.js';

export type LightweightRunProfileClassifierInput = {
  request: Pick<UniversalAgentRequest, 'text' | 'workspace' | 'requestedTools' | 'metadata'>;
  hasWorkspaceProfile?: boolean;
  hasMemoryContext?: boolean;
  hasSkillOrMcpSnapshot?: boolean;
};

export class LightweightRunProfileClassifier {
  public classify(input: LightweightRunProfileClassifierInput): RunContextProfile {
    const requestedTools = Array.isArray(input.request.requestedTools) ? input.request.requestedTools : [];
    const metadata = input.request.metadata || {};
    const explicitDepth = typeof metadata.contextDepth === 'string' ? metadata.contextDepth : null;

    if (explicitDepth === 'hot' || explicitDepth === 'warm' || explicitDepth === 'cold') {
      return resolveRunContextProfile({
        depth: explicitDepth,
        id: `${explicitDepth}-context`,
        reason: 'Context depth suggested by request metadata.',
        suggestedBy: 'request-metadata',
      });
    }

    if (
      input.hasMemoryContext
      || input.hasSkillOrMcpSnapshot
      || requestedTools.some((toolId) => {
        const normalizedToolId = String(toolId || '').toLowerCase();
        return ['memory', 'mnemos', 'mcp', 'skill'].some((needle) => normalizedToolId.includes(needle));
      })
    ) {
      return resolveRunContextProfile({
        depth: 'cold',
        id: 'cold-context',
        reason: 'Request metadata includes memory, skills, MCP, or available cold snapshots.',
        suggestedBy: 'lightweight-classifier',
      });
    }

    if (
      Boolean(input.request.workspace)
      || input.hasWorkspaceProfile
      || requestedTools.length > 0
    ) {
      return resolveRunContextProfile({
        depth: 'warm',
        id: 'warm-context',
        reason: 'Request metadata needs workspace or tool context without cold memory.',
        suggestedBy: 'lightweight-classifier',
      });
    }

    return resolveRunContextProfile({
      depth: 'hot',
      id: 'hot-context',
      reason: 'Simple conversational request uses minimal session context.',
      suggestedBy: 'lightweight-classifier',
    });
  }
}
