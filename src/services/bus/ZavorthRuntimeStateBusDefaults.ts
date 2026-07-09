import type {
  ZavorthRuntimeStateBusActionInput,
  ZavorthRuntimeStateBusDispatchResult,
  ZavorthRuntimeStateBusSnapshot,
  ZavorthRuntimeStateBusState,
  ZavorthRuntimeCapabilitiesProjection,
  ZavorthRuntimeDynamicRoute,
  ZavorthRuntimeMcpTrustServer,
  ZavorthRuntimeModelSpec,
  ZavorthRuntimePermissionsMatrix,
  ZavorthRuntimePersonalConnector,
  ZavorthRuntimeProviderConnection,
  ZavorthRuntimeSkillHistoryEntry,
  ZavorthRuntimeStreamSession,
  ZavorthRuntimeWorkspaceKnowledge,
  ZavorthRuntimeStateDomain,
  ZavorthRuntimeStateDomainState,
  ZavorthRuntimeStateReceipt,
  ZavorthRuntimeStateReceiptStatus,
  ZavorthRuntimeStateSkill,
  ZavorthRuntimeStateStatus,
  ZavorthRuntimeStateWorkspace,
} from '../../contracts/ZavorthRuntimeStateBusContract.js';
import {
  clean,
  record,
  safeId,
  normalizeDomain,
  safeResolve,
} from './ZavorthRuntimeStateBusUtils.js';

export const DEFAULT_CONNECTED_MODELS = ['zavorth:core', 'zavorth:governed'];

export const DEFAULT_MODEL_SPECS: ZavorthRuntimeModelSpec[] = [
  {
    id: 'daily',
    label: 'Daily',
    summary: 'Default governed everyday route for normal desktop work.',
    allowedProviderIds: ['zavorth', 'openai', 'google', 'local'],
    preferredModelIds: ['zavorth:core', 'zavorth:governed'],
    fallbackModelIds: ['zavorth:governed'],
    maxEffort: 'standard',
    estimatedCost: 'medium',
    allowedSkillIds: ['zavorth-workspace-scope', 'provider-doctor'],
    allowedSubagentIds: [],
  },
  {
    id: 'coding',
    label: 'Coding',
    summary: 'Code review, implementation and test-heavy work with stronger reasoning.',
    allowedProviderIds: ['zavorth', 'openai', 'anthropic', 'local'],
    preferredModelIds: ['openai:gpt-5', 'zavorth:core'],
    fallbackModelIds: ['zavorth:core', 'zavorth:governed'],
    maxEffort: 'ultra-code',
    estimatedCost: 'high',
    allowedSkillIds: ['zavorth-workspace-scope', 'zavorth-model-routing', 'agent-orchestrator'],
    allowedSubagentIds: ['code-review', 'implementation'],
  },
  {
    id: 'research',
    label: 'Research',
    summary: 'Comparison, synthesis and evidence collection with explicit source handling.',
    allowedProviderIds: ['zavorth', 'openai', 'google', 'openrouter'],
    preferredModelIds: ['zavorth:core', 'openai:gpt-5'],
    fallbackModelIds: ['zavorth:governed'],
    maxEffort: 'high',
    estimatedCost: 'medium',
    allowedSkillIds: ['agent-orchestrator', 'zavorth-model-routing'],
    allowedSubagentIds: ['research'],
  },
  {
    id: 'local-private',
    label: 'Local private',
    summary: 'Local-first route for private work and offline-ready providers.',
    allowedProviderIds: ['zavorth', 'local', 'ollama', 'lm-studio', 'vllm'],
    preferredModelIds: ['zavorth:core', 'local:default'],
    fallbackModelIds: ['zavorth:governed'],
    maxEffort: 'high',
    estimatedCost: 'low',
    allowedSkillIds: ['zavorth-workspace-scope', 'provider-doctor'],
    allowedSubagentIds: [],
  },
  {
    id: 'budget',
    label: 'Budget',
    summary: 'Low-cost route for small everyday tasks.',
    allowedProviderIds: ['zavorth', 'google', 'deepseek', 'local'],
    preferredModelIds: ['zavorth:governed', 'zavorth:core'],
    fallbackModelIds: ['zavorth:core'],
    maxEffort: 'low',
    estimatedCost: 'low',
    allowedSkillIds: ['zavorth-workspace-scope'],
    allowedSubagentIds: [],
  },
];

export function domainState(
  domain: ZavorthRuntimeStateDomain,
  status: ZavorthRuntimeStateStatus,
  summary: string,
  updatedAt: string,
): ZavorthRuntimeStateDomainState {
  return { domain, status, summary, updatedAt, actionIds: [] };
}

export function summarizeRuntimeStatus(state: ZavorthRuntimeStateBusState): ZavorthRuntimeStateStatus {
  const statuses = [
    state.gateway.status,
    state.agents.status,
    state.cron.status,
    state.context.status,
    state.session.status,
    state.skills.status,
  ];
  if (statuses.includes('blocked')) return 'blocked';
  if (statuses.includes('attention')) return 'attention';
  if (statuses.includes('running')) return 'running';
  if (statuses.includes('offline')) return 'offline';
  return 'ready';
}

export function buildDefaultPermissionsMatrix(): ZavorthRuntimePermissionsMatrix {
  const rule = (
    decision: 'allow' | 'approval' | 'block' | 'configure',
    scope: ZavorthRuntimePermissionsMatrix['domains'][string]['actions'][string]['scope'],
    reason: string,
  ) => ({
    default: decision,
    requiresApproval: decision === 'approval',
    scope,
    reason,
  });
  return {
    version: 1,
    domains: {
      chat: {
        label: 'Chat',
        actions: {
          read: rule('allow', 'global', 'Chat history can be read by the local runtime.'),
          write: rule('allow', 'global', 'User-authored chat messages are normal runtime input.'),
        },
      },
      filesystem: {
        label: 'Filesystem',
        actions: {
          read: rule('approval', 'workspace', 'File reads must stay inside the selected workspace.'),
          write: rule('approval', 'workspace', 'File writes mutate workspace state.'),
          shell: rule('approval', 'workspace', 'Shell commands can mutate or exfiltrate data.'),
        },
      },
      network: {
        label: 'Network',
        actions: {
          fetch: rule('approval', 'provider', 'Network access is scoped by SSRF policy.'),
          private: rule('block', 'provider', 'Private networks are blocked unless explicitly configured.'),
        },
      },
      mcp: {
        label: 'MCP',
        actions: {
          expose: rule('approval', 'mcp', 'MCP tools require trust review before model exposure.'),
          execute: rule('approval', 'mcp', 'MCP tool execution is effectful.'),
        },
      },
      skills: {
        label: 'Skills',
        actions: {
          native: rule('allow', 'skill', 'Native skills are curated by the Zavorth repository.'),
          imported: rule('approval', 'skill', 'Imported skills remain quarantined until promoted.'),
        },
      },
      providers: {
        label: 'Providers',
        actions: {
          select: rule('allow', 'provider', 'Model selection is limited to connected providers.'),
          connect: rule('approval', 'provider', 'Provider setup changes routing trust.'),
          liveProbe: rule('approval', 'provider', 'Live probes make external calls.'),
        },
      },
      email: {
        label: 'Email',
        actions: {
          read: rule('approval', 'connector', 'Email content is personal context.'),
          draft: rule('approval', 'connector', 'Email drafts can affect external communication.'),
          send: rule('approval', 'connector', 'Sending email is an external side effect.'),
        },
      },
      calendar: {
        label: 'Calendar',
        actions: {
          read: rule('approval', 'connector', 'Calendar events are personal context.'),
          write: rule('approval', 'connector', 'Calendar writes are external side effects.'),
        },
      },
      tasks: {
        label: 'Tasks',
        actions: {
          read: rule('approval', 'connector', 'Task lists are personal context.'),
          write: rule('approval', 'connector', 'Task writes change personal workflow state.'),
        },
      },
      rag: {
        label: 'Knowledge',
        actions: {
          attach: rule('approval', 'workspace', 'Knowledge sources can alter context.'),
          ingest: rule('approval', 'workspace', 'Ingestion stores searchable workspace data.'),
        },
      },
      subagents: {
        label: 'Subagents',
        actions: {
          delegate: rule('approval', 'global', 'Delegation starts additional runtime work.'),
          promote: rule('approval', 'global', 'Promotions change future behavior.'),
        },
      },
    },
  };
}

export function buildDefaultPersonalConnectors(): ZavorthRuntimePersonalConnector[] {
  return [
    personalConnector('email:primary', 'email', 'Email'),
    personalConnector('calendar:primary', 'calendar', 'Calendar'),
    personalConnector('tasks:primary', 'task', 'Tasks'),
  ];
}

export function personalConnector(
  id: string,
  kind: ZavorthRuntimePersonalConnector['kind'],
  label: string,
): ZavorthRuntimePersonalConnector {
  return {
    id,
    kind,
    label,
    status: 'disabled',
    enabled: false,
    readAllowed: false,
    draftAllowed: false,
    sendRequiresApproval: true,
    writeRequiresApproval: true,
    lastReceiptId: null,
  };
}

export function buildCapabilitiesProjection(
  state: ZavorthRuntimeStateBusState,
  pendingApprovals: number,
): ZavorthRuntimeCapabilitiesProjection {
  const available = [
    { id: 'chat.ask', label: 'Ask Zavorth', domain: 'chat' },
    { id: 'workspace.scope', label: 'Workspace scope', domain: 'workspace' },
    { id: 'providers.select', label: 'Connected model selection', domain: 'providers' },
    { id: 'skills.native', label: 'Native skills', domain: 'skills' },
  ];
  const blocked = [
    ...state.mcpTrust.servers
      .filter((server) => server.exposedToModel === false)
      .map((server) => ({ id: server.id, label: server.label, reason: 'MCP server is not trusted yet.' })),
  ];
  const configurable = [
    ...state.personalOps.connectors
      .filter((connector) => connector.status === 'disabled' || connector.status === 'needs-setup')
      .map((connector) => ({ id: connector.id, label: connector.label, reason: 'Connector requires explicit setup.' })),
    ...state.dynamicRouting.providerConnections
      .filter((provider) => provider.status === 'needs-setup')
      .map((provider) => ({ id: provider.id, label: provider.label, reason: 'Provider requires connection details.' })),
  ];
  const pending = pendingApprovals > 0
    ? [{ id: 'approvals.pending', label: 'Pending approvals', reason: `${pendingApprovals} approval(s) waiting.` }]
    : [];
  return {
    summary: {
      available: available.length,
      blocked: blocked.length,
      configurable: configurable.length,
      pending: pending.length,
    },
    available,
    blocked,
    configurable,
    pending,
  };
}