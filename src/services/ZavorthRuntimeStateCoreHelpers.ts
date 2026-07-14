import fs from 'node:fs';
import path from 'node:path';
import {
  type ZavorthRuntimeStateBusActionInput,
  type ZavorthRuntimeStateBusState,
  type ZavorthRuntimeCapabilitiesProjection,
  type ZavorthRuntimeDynamicRoute,
  type ZavorthRuntimeMcpTrustServer,
  type ZavorthRuntimeModelSpec,
  type ZavorthRuntimePermissionsMatrix,
  type ZavorthRuntimePersonalConnector,
  type ZavorthRuntimeProviderConnection,
  type ZavorthRuntimeSkillHistoryEntry,
  type ZavorthRuntimeStreamSession,
  type ZavorthRuntimeWorkspaceKnowledge,
  type ZavorthRuntimeStateDomain,
  type ZavorthRuntimeStateDomainState,
  type ZavorthRuntimeStateReceipt,
  type ZavorthRuntimeStateReceiptStatus,
  type ZavorthRuntimeStateSkill,
  type ZavorthRuntimeStateStatus,
  type ZavorthRuntimeStateWorkspace,
  type ZavorthRuntimeWorkboardState,
  type ZavorthRuntimeWorkboardTask,
  type ZavorthRuntimeWorkboardTaskStatus,
} from '../contracts/ZavorthRuntimeStateBusContract.js';
import { logger } from '../logger.js';

type RuntimeRecord = Record<string, unknown>;

import * as normalizationHelpers from './ZavorthRuntimeStateNormalizationHelpers.js';

export function emailDomain(value: unknown): string | null {
  const email = normalizationHelpers.clean(value);
  const domain = email && email.includes('@') ? email.split('@').pop() : null;
  return domain ? normalizationHelpers.safeId(domain) : null;
}

export function domainForAction(input: ZavorthRuntimeStateBusActionInput): ZavorthRuntimeStateDomain {
  if (input.type === 'set-model') return 'model';
  if (input.type === 'set-effort') return 'effort';
  if (input.type === 'set-workspace') return 'workspace';
  if (input.type === 'select-model-spec' || input.type === 'route-model' || input.type === 'set-provider-connection') return 'model';
  if (input.type === 'set-workspace-knowledge') return 'context';
  if (input.type === 'register-personal-connector') return 'context';
  if (input.type === 'set-mcp-trust') return 'skills';
  if (input.type === 'recover-scheduled-jobs') return 'cron';
  if (input.type === 'resume-stream') return 'session';
  if (input.type === 'set-permission') return 'gateway';
  if (input.type === 'skill-lifecycle') return 'skills';
  if (input.type === 'workboard-sync') return 'agents';
  if (input.type === 'sync-command') return 'session';
  const domain = normalizationHelpers.normalizeDomain(normalizationHelpers.record(input.payload?.domain)?.domain);
  return domain || 'gateway';
}

export function domainState(domain: ZavorthRuntimeStateDomain, status: ZavorthRuntimeStateStatus, summary: string, updatedAt: string): ZavorthRuntimeStateDomainState {
  return { domain, status, summary, updatedAt, actionIds: [] };
}

export function coerceDomainState(value: unknown, fallback: ZavorthRuntimeStateDomainState): ZavorthRuntimeStateDomainState {
  const raw = normalizationHelpers.record(value) || {};
  return {
    domain: normalizationHelpers.normalizeDomain(raw.domain) || fallback.domain,
    status: normalizationHelpers.normalizeStatus(raw.status),
    summary: normalizationHelpers.clean(raw.summary) || fallback.summary,
    updatedAt: normalizationHelpers.clean(raw.updatedAt) || fallback.updatedAt,
    actionIds: Array.isArray(raw.actionIds) ? raw.actionIds.map((entry) => normalizationHelpers.safeId(entry)).filter(Boolean) : [],
  };
}

export function coerceReceipt(value: unknown): ZavorthRuntimeStateReceipt | null {
  const raw = normalizationHelpers.record(value);
  if (!raw) return null;
  const id = normalizationHelpers.safeId(raw.id);
  const domain = normalizationHelpers.normalizeDomain(raw.domain);
  const action = normalizationHelpers.clean(raw.action);
  const createdAt = normalizationHelpers.clean(raw.createdAt);
  if (!id || !domain || !action || !createdAt) return null;
  return {
    id,
    createdAt,
    domain,
    action: action as ZavorthRuntimeStateReceipt['action'],
    status: normalizationHelpers.normalizeReceiptStatus(raw.status),
    phase: raw.phase === 'preview' || raw.phase === 'approval' || raw.phase === 'execution' || raw.phase === 'learning' ? raw.phase : 'receipt',
    summary: normalizationHelpers.clean(raw.summary) || 'Runtime state receipt.',
    preview: {
      mutation: normalizationHelpers.clean(normalizationHelpers.record(raw.preview)?.mutation) || 'runtime state update',
      requiresApproval: normalizationHelpers.record(raw.preview)?.requiresApproval === true,
      reason: normalizationHelpers.clean(normalizationHelpers.record(raw.preview)?.reason) || 'runtime state lifecycle',
    },
    approval: {
      required: normalizationHelpers.record(raw.approval)?.required === true,
      approved: normalizationHelpers.record(raw.approval)?.approved === true,
      approvalId: normalizationHelpers.clean(normalizationHelpers.record(raw.approval)?.approvalId),
    },
    safety: {
      pathValidated: normalizationHelpers.record(raw.safety)?.pathValidated === true,
      rawSecretsSerialized: false,
      receiptSpoofingPrevented: true,
      approvalBypassPrevented: true,
    },
    metadata: normalizationHelpers.redactRecord(normalizationHelpers.record(raw.metadata) || {}),
  };
}

export function summarizeRuntimeStatus(state: ZavorthRuntimeStateBusState): ZavorthRuntimeStateStatus {
  const statuses = [state.gateway.status, state.agents.status, state.cron.status, state.context.status, state.session.status, state.skills.status];
  if (statuses.includes('blocked')) return 'blocked';
  if (statuses.includes('attention')) return 'attention';
  if (statuses.includes('running')) return 'running';
  if (statuses.includes('offline')) return 'offline';
  return 'ready';
}

export function buildDefaultPermissionsMatrix(): ZavorthRuntimePermissionsMatrix {
  const rule = (decision: 'allow' | 'approval' | 'block' | 'configure', scope: ZavorthRuntimePermissionsMatrix['domains'][string]['actions'][string]['scope'], reason: string) => ({
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
  return [personalConnector('email:primary', 'email', 'Email'), personalConnector('calendar:primary', 'calendar', 'Calendar'), personalConnector('tasks:primary', 'task', 'Tasks')];
}

export function personalConnector(id: string, kind: ZavorthRuntimePersonalConnector['kind'], label: string): ZavorthRuntimePersonalConnector {
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

export function buildCapabilitiesProjection(state: ZavorthRuntimeStateBusState, pendingApprovals: number): ZavorthRuntimeCapabilitiesProjection {
  const available = [
    { id: 'chat.ask', label: 'Ask Zavorth', domain: 'chat' },
    { id: 'workspace.scope', label: 'Workspace scope', domain: 'workspace' },
    { id: 'providers.select', label: 'Connected model selection', domain: 'providers' },
    { id: 'skills.native', label: 'Native skills', domain: 'skills' },
  ];
  const blocked = [...state.mcpTrust.servers.filter((server) => server.exposedToModel === false).map((server) => ({ id: server.id, label: server.label, reason: 'MCP server is not trusted yet.' }))];
  const configurable = [
    ...state.personalOps.connectors
      .filter((connector) => connector.status === 'disabled' || connector.status === 'needs-setup')
      .map((connector) => ({ id: connector.id, label: connector.label, reason: 'Connector requires explicit setup.' })),
    ...state.dynamicRouting.providerConnections.filter((provider) => provider.status === 'needs-setup').map((provider) => ({ id: provider.id, label: provider.label, reason: 'Provider requires connection details.' })),
  ];
  const pending = pendingApprovals > 0 ? [{ id: 'approvals.pending', label: 'Pending approvals', reason: `${pendingApprovals} approval(s) waiting.` }] : [];
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

export function coercePermissionsMatrix(value: unknown, fallback: ZavorthRuntimePermissionsMatrix): ZavorthRuntimePermissionsMatrix {
  const raw = normalizationHelpers.record(value);
  if (!raw || Number(raw.version) !== 1 || !normalizationHelpers.record(raw.domains)) {
    return fallback;
  }
  return fallback;
}

export function coerceDynamicRoute(value: unknown, fallback: ZavorthRuntimeDynamicRoute): ZavorthRuntimeDynamicRoute {
  const raw = normalizationHelpers.record(value);
  if (!raw) return fallback;
  return {
    intent: normalizationHelpers.safeId(raw.intent) || fallback.intent,
    providerId: normalizationHelpers.safeId(raw.providerId) || fallback.providerId,
    modelId: normalizationHelpers.safeModelId(raw.modelId) || fallback.modelId,
    specId: normalizationHelpers.normalizeModelSpecId(raw.specId) || fallback.specId,
    reason: normalizationHelpers.clean(raw.reason) || fallback.reason,
    fallbackModelIds: Array.isArray(raw.fallbackModelIds) ? raw.fallbackModelIds.map((entry) => normalizationHelpers.safeModelId(entry)).filter((entry): entry is string => Boolean(entry)) : fallback.fallbackModelIds,
    estimatedCost: normalizationHelpers.normalizeCost(raw.estimatedCost),
    risk: normalizationHelpers.normalizeRisk(raw.risk),
    selectedAt: normalizationHelpers.clean(raw.selectedAt) || fallback.selectedAt,
  };
}

export function coerceProviderConnection(value: unknown): ZavorthRuntimeProviderConnection | null {
  const raw = normalizationHelpers.record(value);
  const id = normalizationHelpers.safeId(raw?.id);
  if (!raw || !id) return null;
  return {
    id,
    label: normalizationHelpers.clean(raw.label) || id,
    status: normalizationHelpers.normalizeProviderConnectionStatus(raw.status),
    targetHost: normalizationHelpers.clean(raw.targetHost),
    localLoopback: raw.localLoopback === true,
    defaultRouteAllowed: raw.defaultRouteAllowed === true,
    blockReason: normalizationHelpers.clean(raw.blockReason),
    updatedAt: normalizationHelpers.clean(raw.updatedAt) || new Date(0).toISOString(),
  };
}

export function coerceWorkspaceKnowledge(value: unknown, fallback: ZavorthRuntimeWorkspaceKnowledge): ZavorthRuntimeWorkspaceKnowledge {
  const raw = normalizationHelpers.record(value);
  if (!raw) return fallback;
  return {
    workspaceId: normalizationHelpers.clean(raw.workspaceId) || fallback.workspaceId,
    activeWorkspaceLabel: normalizationHelpers.clean(raw.activeWorkspaceLabel) || fallback.activeWorkspaceLabel,
    isolation: normalizationHelpers.normalizeWorkspaceIsolation(raw.isolation, fallback.isolation),
    trustedWorkspaceIds: Array.isArray(raw.trustedWorkspaceIds) ? raw.trustedWorkspaceIds.map((entry) => normalizationHelpers.safeId(entry)).filter(Boolean) : fallback.trustedWorkspaceIds,
    allowedPaths: Array.isArray(raw.allowedPaths)
      ? raw.allowedPaths
          .map((entry) => normalizationHelpers.safeResolve(entry))
          .filter((entry): entry is string => Boolean(entry))
          .slice(0, 50)
      : fallback.allowedPaths,
    ragSources: Array.isArray(raw.ragSources)
      ? raw.ragSources
          .map((entry) => normalizationHelpers.record(entry))
          .filter((entry): entry is RuntimeRecord => Boolean(entry))
          .map((entry) => ({
            id: normalizationHelpers.safeId(entry.id) || 'source',
            kind: normalizationHelpers.normalizeKnowledgeKind(entry.kind),
            label: normalizationHelpers.clean(entry.label) || 'Knowledge source',
            trusted: entry.trusted === true,
          }))
      : fallback.ragSources,
    untrustedContextWrapping: true,
  };
}

export function coercePersonalConnector(value: unknown): ZavorthRuntimePersonalConnector | null {
  const raw = normalizationHelpers.record(value);
  const id = normalizationHelpers.safeId(raw?.id);
  if (!raw || !id) return null;
  const kind = normalizationHelpers.normalizePersonalConnectorKind(raw.kind);
  return {
    id,
    kind,
    label: normalizationHelpers.clean(raw.label) || id,
    provider: normalizationHelpers.safeId(raw.provider) || null,
    accountEmailDomain: normalizationHelpers.clean(raw.accountEmailDomain) || emailDomain(raw.accountEmail),
    status: normalizationHelpers.normalizePersonalConnectorStatus(raw.status),
    enabled: raw.enabled === true,
    readAllowed: raw.readAllowed === true,
    draftAllowed: raw.draftAllowed === true,
    sendRequiresApproval: true,
    writeRequiresApproval: true,
    lastReceiptId: normalizationHelpers.clean(raw.lastReceiptId),
  };
}

export function coerceMcpTrustServer(value: unknown): ZavorthRuntimeMcpTrustServer | null {
  const raw = normalizationHelpers.record(value);
  const id = normalizationHelpers.safeId(raw?.id);
  if (!raw || !id) return null;
  const trustState = normalizationHelpers.normalizeMcpTrustState(raw.trustState);
  return {
    id,
    label: normalizationHelpers.clean(raw.label) || id,
    origin: normalizationHelpers.clean(raw.origin) || 'unknown',
    trustState,
    toolNames: Array.isArray(raw.toolNames) ? raw.toolNames.map((entry) => normalizationHelpers.safeId(entry)).filter(Boolean) : [],
    risk: normalizationHelpers.normalizeRisk(raw.risk),
    networkAccess: raw.networkAccess === 'loopback' || raw.networkAccess === 'restricted' ? raw.networkAccess : 'blocked',
    exposedToModel: trustState === 'trusted' && raw.exposedToModel === true,
    lastReceiptId: normalizationHelpers.clean(raw.lastReceiptId),
  };
}

export function coerceSkillHistoryEntry(value: unknown): ZavorthRuntimeSkillHistoryEntry | null {
  const raw = normalizationHelpers.record(value);
  const id = normalizationHelpers.safeId(raw?.id);
  const skillId = normalizationHelpers.safeId(raw?.skillId);
  if (!raw || !id || !skillId) return null;
  return {
    id,
    skillId,
    skillName: normalizationHelpers.clean(raw.skillName) || skillId,
    mode: normalizationHelpers.normalizeSkillHistoryMode(raw.mode),
    source: normalizationHelpers.normalizeSkillSource(raw.source),
    receiptId: normalizationHelpers.clean(raw.receiptId),
    at: normalizationHelpers.clean(raw.at) || new Date(0).toISOString(),
  };
}

export function coerceStreamSession(value: unknown, fallback: ZavorthRuntimeStreamSession): ZavorthRuntimeStreamSession {
  const raw = normalizationHelpers.record(value);
  if (!raw) return fallback;
  return {
    sessionId: normalizationHelpers.clean(raw.sessionId),
    status: normalizationHelpers.normalizeStreamStatus(raw.status),
    resumeToken: normalizationHelpers.clean(raw.resumeToken),
    updatedAt: normalizationHelpers.clean(raw.updatedAt) || fallback.updatedAt,
    resumable: true,
  };
}

export function readPermissionPatch(value: unknown): {
  domain: string;
  action: string;
  decision: 'allow' | 'approval' | 'block' | 'configure';
  requiresApproval: boolean;
  scope: 'global' | 'workspace' | 'provider' | 'connector' | 'mcp' | 'skill';
  reason: string;
} | null {
  const raw = normalizationHelpers.record(value);
  if (!raw) return null;
  const domain = normalizationHelpers.safeId(raw.domain);
  const action = normalizationHelpers.safeId(raw.action);
  if (!domain || !action) return null;
  const decision = normalizePermissionDecision(raw.decision || raw.default);
  return {
    domain,
    action,
    decision,
    requiresApproval: raw.requiresApproval === undefined ? decision === 'approval' : raw.requiresApproval === true,
    scope: normalizePermissionScope(raw.scope),
    reason: normalizationHelpers.clean(raw.reason) || 'Operator configured runtime permission.',
  };
}

export function normalizePermissionDecision(value: unknown): 'allow' | 'approval' | 'block' | 'configure' {
  const normalized = normalizationHelpers.clean(value)?.toLowerCase();
  if (normalized === 'allow' || normalized === 'approval' || normalized === 'block' || normalized === 'configure') {
    return normalized;
  }
  return 'approval';
}

export function normalizePermissionScope(value: unknown): 'global' | 'workspace' | 'provider' | 'connector' | 'mcp' | 'skill' {
  const normalized = normalizationHelpers.clean(value)?.toLowerCase();
  if (normalized === 'global' || normalized === 'workspace' || normalized === 'provider' || normalized === 'connector' || normalized === 'mcp' || normalized === 'skill') {
    return normalized;
  }
  return 'global';
}
