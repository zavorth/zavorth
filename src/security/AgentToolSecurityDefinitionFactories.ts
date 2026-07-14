import type { AgentToolSecurityDefinition } from './AgentSecurityPolicyEngine.js';
import { normalizeAgentToolSecurityDefinition } from './AgentSecurityPolicyEngine.js';

export function createMcpAgentToolSecurityDefinition(
  toolName: string,
  description = 'External MCP tool exposed to the local agent runtime.',
): AgentToolSecurityDefinition {
  return normalizeAgentToolSecurityDefinition({
    toolName,
    surface: 'mcp-tool',
    capabilities: ['mcp', 'network', 'external-send', 'untrusted-input'],
    defaultRisk: 'review',
    requiresConfirmation: true,
    description,
    source: 'inferred',
  });
}

export function createFallbackAgentToolSecurityDefinition(
  toolName: string,
  description = 'Registered tool without an explicit security definition.',
): AgentToolSecurityDefinition {
  return normalizeAgentToolSecurityDefinition({
    toolName,
    surface: 'unknown',
    capabilities: ['unknown'],
    defaultRisk: 'forbidden',
    requiresConfirmation: false,
    description,
    source: 'fallback',
  });
}
