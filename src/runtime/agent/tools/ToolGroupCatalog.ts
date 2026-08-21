import type { UniversalToolRiskLevel } from '../UniversalAgentRuntimeTypes.js';
import { globalCommandRegistry, initializeBuiltinCommands } from '../../../domain/commands/index.js';
import { CommandToToolAdapter } from '../../../domain/commands/CommandToToolAdapter.js';

export type RuntimeAgentToolGroup =
  | 'workspace'
  | 'memory'
  | 'network'
  | 'local_control'
  | 'selfmod'
  | 'general';

export type ToolGroupCatalogEntry = {
  id: string;
  group: RuntimeAgentToolGroup;
  risk: UniversalToolRiskLevel;
  requiresApproval: boolean;
  description: string;
  policyTags: string[];
};

const TOOL_GROUP_ENTRIES: ToolGroupCatalogEntry[] = [
  {
    id: 'agent_consensus_engine',
    group: 'general',
    risk: 'attention',
    requiresApproval: true,
    description: 'Multi-model consensus deliberation (fan-out reviewers + synthesizer) via LlmRuntimeService.',
    policyTags: [
      'capability:multi-model-consensus',
      'group:general',
      'risk:attention',
      'network',
      'approval-required',
    ],
  },
  {
    id: 'consensus_with_fallback',
    group: 'general',
    risk: 'attention',
    requiresApproval: true,
    description: 'Multi-model consensus with progressive per-reviewer fallback chain.',
    policyTags: [
      'capability:multi-model-consensus',
      'group:general',
      'risk:attention',
      'network',
      'approval-required',
    ],
  },
  {
    id: 'session_search',
    group: 'memory',
    risk: 'safe',
    requiresApproval: false,
    description: 'local session continuum search across prior turns (browse, discover, scroll) without provider calls.',
    policyTags: [
      'capability:session-continuum',
      'group:memory',
      'risk:safe',
      'local-only',
      'read-only',
    ],
  },
  {
    id: 'session_search_fts5',
    group: 'memory',
    risk: 'safe',
    requiresApproval: false,
    description: 'Alias for local full-text session search over the session continuum store.',
    policyTags: [
      'capability:session-continuum',
      'group:memory',
      'risk:safe',
      'local-only',
      'read-only',
      'alias:session_search',
    ],
  },
  {
    id: 'zavorth_session_search',
    group: 'memory',
    risk: 'safe',
    requiresApproval: false,
    description: 'Alias for local Zavorth session search over the shared continuum recall store.',
    policyTags: [
      'capability:session-continuum',
      'group:memory',
      'risk:safe',
      'local-only',
      'read-only',
      'alias:session_search',
    ],
  },
  {
    id: 'sessions.search',
    group: 'memory',
    risk: 'safe',
    requiresApproval: false,
    description: 'Alias for sessions.search over the session continuum store.',
    policyTags: [
      'capability:session-continuum',
      'group:memory',
      'risk:safe',
      'local-only',
      'read-only',
      'alias:session_search',
    ],
  },
  {
    id: 'zavorth_action',
    group: 'general',
    risk: 'safe',
    requiresApproval: false,
    description: 'Action Harness routes lookup, preview, apply, and receipts for Zavorth actions; mutations remain blocked at the gateway until approval.',
    policyTags: [
      'capability:action-harness',
      'group:general',
      'risk:safe',
      'first-class-action',
      'preview-first',
    ],
  },
  {
    id: 'echo_hands',
    group: 'local_control',
    risk: 'danger',
    requiresApproval: true,
    description: 'Echo Hands controls local OS, browser or IoT actions and must go through approval/trust.',
    policyTags: [
      'capability:echo',
      'group:local_control',
      'risk:danger',
      'approval-required',
    ],
  },
  {
    id: 'watchmode.control',
    group: 'local_control',
    risk: 'danger',
    requiresApproval: true,
    description: 'Watch Mode/Computer Use controls visual UI and requires allowlisted policy, scope, and approval.',
    policyTags: [
      'capability:watch-mode',
      'capability:computer-use',
      'group:local_control',
      'risk:danger',
      'approval-required',
      'policy-allowlist-required',
      'visual-action',
    ],
  },
  {
    id: 'selfmod.preview',
    group: 'selfmod',
    risk: 'attention',
    requiresApproval: false,
    description: 'Selfmod preview gera proposta auditavel without aplicar changes.',
    policyTags: [
      'capability:selfmod',
      'group:selfmod',
      'risk:attention',
      'preview-first',
    ],
  },
  {
    id: 'selfmod.apply',
    group: 'selfmod',
    risk: 'danger',
    requiresApproval: true,
    description: 'Selfmod apply applies an existing preview and requires approval/trust.',
    policyTags: [
      'capability:selfmod',
      'group:selfmod',
      'risk:danger',
      'approval-required',
      'preview-required',
    ],
  },
  {
    id: 'selfmod.rollback',
    group: 'selfmod',
    risk: 'danger',
    requiresApproval: true,
    description: 'Selfmod rollback reverts an existing changeset and requires approval/trust.',
    policyTags: [
      'capability:selfmod',
      'group:selfmod',
      'risk:danger',
      'approval-required',
      'rollback',
    ],
  },
];

function normalizeToolId(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export class ToolGroupCatalog {
  public list(): ToolGroupCatalogEntry[] {
    initializeBuiltinCommands();
    const builtinEntries = TOOL_GROUP_ENTRIES.map((entry) => ({ ...entry, policyTags: [...entry.policyTags] }));
    const commandEntries = globalCommandRegistry
      .listAll()
      .map((cmd) => CommandToToolAdapter.toToolGroupCatalogEntry(cmd));

    const merged = new Map<string, ToolGroupCatalogEntry>();
    for (const entry of builtinEntries) {
      merged.set(normalizeToolId(entry.id), entry);
    }
    for (const entry of commandEntries) {
      if (!merged.has(normalizeToolId(entry.id))) {
        merged.set(normalizeToolId(entry.id), entry);
      }
    }

    return Array.from(merged.values());
  }

  public listByGroup(group: RuntimeAgentToolGroup): ToolGroupCatalogEntry[] {
    return this.list().filter((entry) => entry.group === group);
  }

  public get(toolId: string): ToolGroupCatalogEntry | null {
    const normalized = normalizeToolId(toolId);
    if (!normalized) {
      return null;
    }

    initializeBuiltinCommands();
    const entry = TOOL_GROUP_ENTRIES.find((candidate) => normalizeToolId(candidate.id) === normalized);
    if (entry) {
      return { ...entry, policyTags: [...entry.policyTags] };
    }

    const command = globalCommandRegistry.getByToolName(normalized);
    if (command) {
      return CommandToToolAdapter.toToolGroupCatalogEntry(command);
    }

    return null;
  }
}

const defaultToolGroupCatalog = new ToolGroupCatalog();

export function resolveToolGroupCatalogEntry(toolId: string): ToolGroupCatalogEntry | null {
  return defaultToolGroupCatalog.get(toolId);
}

