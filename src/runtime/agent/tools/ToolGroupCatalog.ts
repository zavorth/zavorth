import type { UniversalToolRiskLevel } from '../UniversalAgentRuntimeTypes.js';

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
    id: 'echo_hands',
    group: 'local_control',
    risk: 'danger',
    requiresApproval: true,
    description: 'Echo Hands controla acoes locais de OS, browser ou IoT e deve passar por approval/trust.',
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
    description: 'Watch Mode/Computer Use controla UI visual e exige policy allowlisted, escopo e approval.',
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
    description: 'Selfmod preview gera proposta auditavel sem aplicar mudancas.',
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
    description: 'Selfmod apply aplica preview existente e exige approval/trust.',
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
    description: 'Selfmod rollback reverte changeset existente e exige approval/trust.',
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
    return TOOL_GROUP_ENTRIES.map((entry) => ({ ...entry, policyTags: [...entry.policyTags] }));
  }

  public listByGroup(group: RuntimeAgentToolGroup): ToolGroupCatalogEntry[] {
    return this.list().filter((entry) => entry.group === group);
  }

  public get(toolId: string): ToolGroupCatalogEntry | null {
    const normalized = normalizeToolId(toolId);
    if (!normalized) {
      return null;
    }

    const entry = TOOL_GROUP_ENTRIES.find((candidate) => normalizeToolId(candidate.id) === normalized);
    return entry ? { ...entry, policyTags: [...entry.policyTags] } : null;
  }
}

const defaultToolGroupCatalog = new ToolGroupCatalog();

export function resolveToolGroupCatalogEntry(toolId: string): ToolGroupCatalogEntry | null {
  return defaultToolGroupCatalog.get(toolId);
}
