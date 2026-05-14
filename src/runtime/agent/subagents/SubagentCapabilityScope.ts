export type SubagentScopeMode = 'blocked' | 'read_only' | 'tool_limited' | 'workspace_patch';

export interface SubagentCapabilityScope {
  id: string;
  roleId: string;
  mode: SubagentScopeMode;
  allowedTools: string[];
  allowedPaths: string[];
  deniedPaths: string[];
  requiresApproval: boolean;
  policyTags: string[];
  metadata: Record<string, unknown>;
}

export interface SubagentCapabilityScopeInput {
  id?: string | null;
  roleId: string;
  mode?: SubagentScopeMode | string | null;
  allowedTools?: readonly string[] | null;
  allowedPaths?: readonly string[] | null;
  deniedPaths?: readonly string[] | null;
  requiresApproval?: boolean | null;
  policyTags?: readonly string[] | null;
  metadata?: Record<string, unknown> | null;
}

const DEFAULT_DENIED_PATHS = ['.git', 'node_modules', 'dist', 'coverage'];

export function createSubagentCapabilityScope(
  input: SubagentCapabilityScopeInput,
): SubagentCapabilityScope {
  const roleId = normalizeText(input.roleId) || 'subagent';
  const mode = normalizeScopeMode(input.mode);
  const allowedTools = uniqueSorted(input.allowedTools);
  const allowedPaths = uniqueSorted(input.allowedPaths);
  const deniedPaths = uniqueSorted([...(input.deniedPaths ?? []), ...DEFAULT_DENIED_PATHS]);
  const requiresApproval = typeof input.requiresApproval === 'boolean' ? input.requiresApproval : true;

  return {
    id: normalizeText(input.id) || `subagent-scope:${roleId}`,
    roleId,
    mode,
    allowedTools,
    allowedPaths,
    deniedPaths,
    requiresApproval,
    policyTags: uniqueSorted([
      ...(input.policyTags ?? []),
      'subagent-scope',
      `subagent-scope:${mode}`,
      allowedTools.length > 0 ? 'subagent-tools:explicit' : 'subagent-tools:none',
      allowedPaths.length > 0 ? 'subagent-paths:explicit' : 'subagent-paths:none',
      requiresApproval ? 'subagent-approval:required' : 'subagent-approval:precleared',
    ]),
    metadata: input.metadata ? { ...input.metadata } : {},
  };
}

export function createBlockedSubagentCapabilityScope(roleId: string): SubagentCapabilityScope {
  return createSubagentCapabilityScope({ roleId, mode: 'blocked', requiresApproval: true });
}

function normalizeScopeMode(mode?: string | null): SubagentScopeMode {
  switch (normalizeText(mode)) {
    case 'read_only':
    case 'readonly':
    case 'read-only':
      return 'read_only';
    case 'tool_limited':
    case 'tool-limited':
    case 'tools':
      return 'tool_limited';
    case 'workspace_patch':
    case 'workspace-patch':
    case 'patch':
      return 'workspace_patch';
    case 'blocked':
    default:
      return 'blocked';
  }
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueSorted(values?: readonly string[] | null): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean))).sort();
}
