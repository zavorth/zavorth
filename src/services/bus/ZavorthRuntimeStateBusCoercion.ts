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
  redact,
  redactRecord,
  safeResolve,
  safeRealPath,
  isPathInside,
  safeModelId,
  labelFromModelId,
  formatModelLabel,
  providerFromModelId,
  emailDomain,
  normalizeDomain,
  normalizeStatus,
  normalizeReceiptStatus,
  normalizePermissionDecision,
  normalizePermissionScope,
  normalizeModelSpecId,
  normalizeCost,
  normalizeRisk,
  normalizeKnowledgeKind,
  normalizeWorkspaceIsolation,
  normalizePersonalConnectorKind,
  normalizePersonalConnectorStatus,
  normalizeProviderConnectionStatus,
  normalizeMcpTrustState,
  normalizeStreamStatus,
  normalizeSkillHistoryMode,
  normalizeEffortLevel,
  normalizeWorkspaceKind,
  normalizeConfinement,
  normalizeSkillSource,
  normalizeSkillStatus,
  normalizeDomainOperation,
  uniqueStrings,
} from './ZavorthRuntimeStateBusUtils.js';
import { logger } from '../../logger.js';
import {
DEFAULT_MODEL_SPECS,
  buildDefaultPermissionsMatrix,
  buildDefaultPersonalConnectors,
} from './ZavorthRuntimeStateBusDefaults.js';

type RuntimeRecord = Record<string, unknown>;


export function coerceDomainState(value: unknown, fallback: ZavorthRuntimeStateDomainState): ZavorthRuntimeStateDomainState {
  const raw = record(value) || {};
  return {
    domain: normalizeDomain(raw.domain) || fallback.domain,
    status: normalizeStatus(raw.status),
    summary: clean(raw.summary) || fallback.summary,
    updatedAt: clean(raw.updatedAt) || fallback.updatedAt,
    actionIds: Array.isArray(raw.actionIds) ? raw.actionIds.map((entry) => safeId(entry)).filter(Boolean) : [],
  };
}

export function coerceReceipt(value: unknown): ZavorthRuntimeStateReceipt | null {
  const raw = record(value);
  if (!raw) return null;
  const id = safeId(raw.id);
  const domain = normalizeDomain(raw.domain);
  const action = clean(raw.action);
  const createdAt = clean(raw.createdAt);
  if (!id || !domain || !action || !createdAt) return null;
  return {
    id,
    createdAt,
    domain,
    action: action as ZavorthRuntimeStateReceipt['action'],
    status: normalizeReceiptStatus(raw.status),
    phase: raw.phase === 'preview' || raw.phase === 'approval' || raw.phase === 'execution' || raw.phase === 'learning'
      ? raw.phase
      : 'receipt',
    summary: clean(raw.summary) || 'Runtime state receipt.',
    preview: {
      mutation: clean(record(raw.preview)?.mutation) || 'runtime state update',
      requiresApproval: record(raw.preview)?.requiresApproval === true,
      reason: clean(record(raw.preview)?.reason) || 'runtime state lifecycle',
    },
    approval: {
      required: record(raw.approval)?.required === true,
      approved: record(raw.approval)?.approved === true,
      approvalId: clean(record(raw.approval)?.approvalId),
    },
    safety: {
      pathValidated: record(raw.safety)?.pathValidated === true,
      rawSecretsSerialized: false,
      receiptSpoofingPrevented: true,
      approvalBypassPrevented: true,
    },
    metadata: redactRecord(record(raw.metadata) || {}),
  };
}

export function coercePermissionsMatrix(value: unknown, fallback: ZavorthRuntimePermissionsMatrix): ZavorthRuntimePermissionsMatrix {
  const raw = record(value);
  if (!raw || Number(raw.version) !== 1 || !record(raw.domains)) {
    return fallback;
  }
  return fallback;
}

export function coerceDynamicRoute(value: unknown, fallback: ZavorthRuntimeDynamicRoute): ZavorthRuntimeDynamicRoute {
  const raw = record(value);
  if (!raw) return fallback;
  return {
    intent: safeId(raw.intent) || fallback.intent,
    providerId: safeId(raw.providerId) || fallback.providerId,
    modelId: safeModelId(raw.modelId) || fallback.modelId,
    specId: normalizeModelSpecId(raw.specId) || fallback.specId,
    reason: clean(raw.reason) || fallback.reason,
    fallbackModelIds: Array.isArray(raw.fallbackModelIds)
      ? raw.fallbackModelIds.map((entry) => safeModelId(entry)).filter((entry): entry is string => Boolean(entry))
      : fallback.fallbackModelIds,
    estimatedCost: normalizeCost(raw.estimatedCost),
    risk: normalizeRisk(raw.risk),
    selectedAt: clean(raw.selectedAt) || fallback.selectedAt,
  };
}

export function coerceProviderConnection(value: unknown): ZavorthRuntimeProviderConnection | null {
  const raw = record(value);
  const id = safeId(raw?.id);
  if (!raw || !id) return null;
  return {
    id,
    label: clean(raw.label) || id,
    status: normalizeProviderConnectionStatus(raw.status),
    targetHost: clean(raw.targetHost),
    localLoopback: raw.localLoopback === true,
    defaultRouteAllowed: raw.defaultRouteAllowed === true,
    blockReason: clean(raw.blockReason),
    updatedAt: clean(raw.updatedAt) || new Date(0).toISOString(),
  };
}

export function coerceWorkspaceKnowledge(value: unknown, fallback: ZavorthRuntimeWorkspaceKnowledge): ZavorthRuntimeWorkspaceKnowledge {
  const raw = record(value);
  if (!raw) return fallback;
  return {
    workspaceId: clean(raw.workspaceId) || fallback.workspaceId,
    activeWorkspaceLabel: clean(raw.activeWorkspaceLabel) || fallback.activeWorkspaceLabel,
    isolation: normalizeWorkspaceIsolation(raw.isolation, fallback.isolation),
    trustedWorkspaceIds: Array.isArray(raw.trustedWorkspaceIds)
      ? raw.trustedWorkspaceIds.map((entry) => safeId(entry)).filter(Boolean)
      : fallback.trustedWorkspaceIds,
    allowedPaths: Array.isArray(raw.allowedPaths)
      ? raw.allowedPaths.map((entry) => safeResolve(entry)).filter((entry): entry is string => Boolean(entry)).slice(0, 50)
      : fallback.allowedPaths,
    ragSources: Array.isArray(raw.ragSources)
      ? raw.ragSources
          .map((entry) => record(entry))
          .filter((entry): entry is RuntimeRecord => Boolean(entry))
          .map((entry) => ({
            id: safeId(entry.id) || 'source',
            kind: normalizeKnowledgeKind(entry.kind),
            label: clean(entry.label) || 'Knowledge source',
            trusted: entry.trusted === true,
          }))
      : fallback.ragSources,
    untrustedContextWrapping: true,
  };
}

export function coercePersonalConnector(value: unknown): ZavorthRuntimePersonalConnector | null {
  const raw = record(value);
  const id = safeId(raw?.id);
  if (!raw || !id) return null;
  const kind = normalizePersonalConnectorKind(raw.kind);
  return {
    id,
    kind,
    label: clean(raw.label) || id,
    provider: safeId(raw.provider) || null,
    accountEmailDomain: clean(raw.accountEmailDomain) || emailDomain(raw.accountEmail),
    status: normalizePersonalConnectorStatus(raw.status),
    enabled: raw.enabled === true,
    readAllowed: raw.readAllowed === true,
    draftAllowed: raw.draftAllowed === true,
    sendRequiresApproval: true,
    writeRequiresApproval: true,
    lastReceiptId: clean(raw.lastReceiptId),
  };
}

export function coerceMcpTrustServer(value: unknown): ZavorthRuntimeMcpTrustServer | null {
  const raw = record(value);
  const id = safeId(raw?.id);
  if (!raw || !id) return null;
  const trustState = normalizeMcpTrustState(raw.trustState);
  return {
    id,
    label: clean(raw.label) || id,
    origin: clean(raw.origin) || 'unknown',
    trustState,
    toolNames: Array.isArray(raw.toolNames) ? raw.toolNames.map((entry) => safeId(entry)).filter(Boolean) : [],
    risk: normalizeRisk(raw.risk),
    networkAccess: raw.networkAccess === 'loopback' || raw.networkAccess === 'restricted' ? raw.networkAccess : 'blocked',
    exposedToModel: trustState === 'trusted' && raw.exposedToModel === true,
    lastReceiptId: clean(raw.lastReceiptId),
  };
}

export function coerceSkillHistoryEntry(value: unknown): ZavorthRuntimeSkillHistoryEntry | null {
  const raw = record(value);
  const id = safeId(raw?.id);
  const skillId = safeId(raw?.skillId);
  if (!raw || !id || !skillId) return null;
  return {
    id,
    skillId,
    skillName: clean(raw.skillName) || skillId,
    mode: normalizeSkillHistoryMode(raw.mode),
    source: normalizeSkillSource(raw.source),
    receiptId: clean(raw.receiptId),
    at: clean(raw.at) || new Date(0).toISOString(),
  };
}

export function coerceStreamSession(value: unknown, fallback: ZavorthRuntimeStreamSession): ZavorthRuntimeStreamSession {
  const raw = record(value);
  if (!raw) return fallback;
  return {
    sessionId: clean(raw.sessionId),
    status: normalizeStreamStatus(raw.status),
    resumeToken: clean(raw.resumeToken),
    updatedAt: clean(raw.updatedAt) || fallback.updatedAt,
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
  const raw = record(value);
  if (!raw) return null;
  const domain = safeId(raw.domain);
  const action = safeId(raw.action);
  if (!domain || !action) return null;
  const decision = normalizePermissionDecision(raw.decision || raw.default);
  return {
    domain,
    action,
    decision,
    requiresApproval: raw.requiresApproval === undefined ? decision === 'approval' : raw.requiresApproval === true,
    scope: normalizePermissionScope(raw.scope),
    reason: clean(raw.reason) || 'Operator configured runtime permission.',
  };
}

export function skillHistoryModeFor(status: ZavorthRuntimeStateSkill['status']): ZavorthRuntimeSkillHistoryEntry['mode'] {
  if (status === 'approved') return 'approved';
  if (status === 'executing') return 'executed';
  if (status === 'blocked' || status === 'quarantined') return 'blocked';
  if (status === 'preview') return 'manual';
  return 'auto-selected';
}

export function upsertProviderConnection(
  entries: ZavorthRuntimeProviderConnection[],
  entry: ZavorthRuntimeProviderConnection,
): ZavorthRuntimeProviderConnection[] {
  return [entry, ...entries.filter((candidate) => candidate.id !== entry.id)].slice(0, 30);
}

export function upsertPersonalConnector(
  entries: ZavorthRuntimePersonalConnector[],
  entry: ZavorthRuntimePersonalConnector,
): ZavorthRuntimePersonalConnector[] {
  return [entry, ...entries.filter((candidate) => candidate.id !== entry.id)].slice(0, 20);
}

export function upsertMcpTrustServer(
  entries: ZavorthRuntimeMcpTrustServer[],
  entry: ZavorthRuntimeMcpTrustServer,
): ZavorthRuntimeMcpTrustServer[] {
  return [entry, ...entries.filter((candidate) => candidate.id !== entry.id)].slice(0, 40);
}

export function upsertSkillHistory(
  entries: ZavorthRuntimeSkillHistoryEntry[],
  entry: ZavorthRuntimeSkillHistoryEntry,
): ZavorthRuntimeSkillHistoryEntry[] {
  return [entry, ...entries.filter((candidate) => candidate.id !== entry.id)].slice(0, 80);
}

export function evaluateNetworkTarget(providerId: string, targetUrl: string | null): {
  ok: boolean;
  targetHost: string | null;
  localLoopback: boolean;
} {
  if (!targetUrl) {
    return { ok: true, targetHost: null, localLoopback: false };
  }
  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname.toLowerCase();
    const localLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
    if (localLoopback) {
      return {
        ok: isLocalProviderId(providerId),
        targetHost: host,
        localLoopback: true,
      };
    }
    if (
      host === '169.254.169.254'
      || host.startsWith('10.')
      || host.startsWith('192.168.')
      || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
      || host.endsWith('.local')
    ) {
      return { ok: false, targetHost: host, localLoopback: false };
    }
    return { ok: true, targetHost: host, localLoopback: false };
  } catch (error: unknown) {logger.warn('[Zavorth Runtime State Bus Coercion] lifecycle operation failed', error);
    return { ok: false, targetHost: null, localLoopback: false };
  }
}

export function isLocalProviderId(providerId: string): boolean {
  return /^(ollama|lm-studio|lmstudio|vllm|local|aigateway|custom)/i.test(providerId);
}

export function statusForDomainOperation(operation: NonNullable<ReturnType<typeof normalizeDomainOperation>>): ZavorthRuntimeStateStatus {
  if (operation === 'pause') return 'paused';
  if (operation === 'restart') return 'running';
  if (operation === 'close') return 'offline';
  return 'ready';
}

export function summaryForDomainOperation(
  domain: ZavorthRuntimeStateDomain,
  operation: NonNullable<ReturnType<typeof normalizeDomainOperation>>,
): string {
  if (operation === 'open') return `${domain} surface opened through runtime state bus.`;
  if (operation === 'pause') return `${domain} plane paused with receipt.`;
  if (operation === 'restart') return `${domain} plane restart requested with receipt.`;
  if (operation === 'close') return `${domain} plane closed with receipt.`;
  if (operation === 'approve') return `${domain} lifecycle approval recorded.`;
  if (operation === 'reject') return `${domain} lifecycle rejection recorded.`;
  return `${domain} plane synchronized.`;
}

export function receiptPhaseFor(
  input: ZavorthRuntimeStateBusActionInput,
  status: ZavorthRuntimeStateReceiptStatus,
): ZavorthRuntimeStateReceipt['phase'] {
  const requestedPhase = clean(record(input.payload?.metadata)?.phase);
  if (
    requestedPhase === 'preview'
    || requestedPhase === 'approval'
    || requestedPhase === 'execution'
    || requestedPhase === 'receipt'
    || requestedPhase === 'learning'
  ) {
    return requestedPhase;
  }
  if (status === 'pending-approval') return 'approval';
  if (status === 'preview') return 'preview';
  return 'receipt';
}

export function upsertSkill(skills: ZavorthRuntimeStateSkill[], skill: ZavorthRuntimeStateSkill): ZavorthRuntimeStateSkill[] {
  const next = skills.filter((entry) => entry.id !== skill.id);
  next.unshift(skill);
  return next.slice(0, 30);
}

export function normalizeConnectedModelIds(value: unknown, selectedModelId?: string | null): string[] {
  const values = Array.isArray(value)
    ? value.map((entry) => safeModelId(entry)).filter((entry): entry is string => Boolean(entry))
    : [];
  if (selectedModelId && values.includes(selectedModelId)) {
    return uniqueStrings(values);
  }
  return uniqueStrings(values);
}