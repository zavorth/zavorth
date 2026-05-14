import type { AgentToolCapability } from './AgentSecurityPolicyEngine.js';
import { resolveDefaultAgentToolSecurityDefinition } from './AgentToolSecurityCatalog.js';
import { wrapUntrustedContent } from './UntrustedContent.js';

const UNTRUSTED_OUTPUT_CAPABILITIES = new Set<AgentToolCapability>([
  'browser',
  'configuration',
  'credential',
  'desktop',
  'destructive',
  'external-send',
  'filesystem',
  'mcp',
  'memory',
  'network',
  'plugin',
  'rag',
  'sandbox',
  'shell',
  'skill',
  'telegram',
  'untrusted-input',
  'webhook',
  'unknown',
]);

export type ToolOutputTrustInput = {
  toolName: string;
  capabilities?: AgentToolCapability[] | null;
};

export function shouldTreatToolOutputAsUntrusted(input: ToolOutputTrustInput | string): boolean {
  const toolName = typeof input === 'string' ? input : input.toolName;
  const capabilities = typeof input === 'string' || !input.capabilities
    ? resolveDefaultAgentToolSecurityDefinition(toolName).capabilities
    : input.capabilities;

  if (capabilities.length === 0) {
    return true;
  }

  return capabilities.some((capability) => UNTRUSTED_OUTPUT_CAPABILITIES.has(capability));
}

export function wrapToolOutputForLlm(
  toolName: string,
  output: unknown,
  attributes: Record<string, string | null | undefined> = {},
): string {
  const text = String(output ?? '');
  if (!shouldTreatToolOutputAsUntrusted(toolName)) {
    return text;
  }

  return wrapUntrustedContent('untrusted_tool_output', text, {
    source: 'tool_result',
    tool_name: toolName,
    ...attributes,
  });
}
