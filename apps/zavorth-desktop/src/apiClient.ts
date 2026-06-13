import type { DesktopApiRequest, DesktopApiResult, RuntimeStatus } from './global';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  at?: string;
  title?: string;
};

export type ExperienceSnapshot = {
  sessionId?: string;
  responseProfile?: string;
  chat?: {
    messages?: ChatMessage[];
  };
  approvals?: {
    pending?: ApprovalItem[];
  };
  learning?: {
    candidates?: LearningItem[];
  };
  memory?: {
    items?: MemoryItem[];
    receipts?: MemoryItem[];
  };
  channels?: {
    routes?: ChannelItem[];
    readiness?: ChannelItem[];
  };
  runtime?: Record<string, unknown>;
  raw?: Record<string, unknown>;
};

export type AskResponse = {
  ok?: boolean;
  sessionId?: string;
  replies?: ChatMessage[];
  messages?: ChatMessage[];
  snapshot?: ExperienceSnapshot;
  receiptId?: string;
  error?: string;
};

export type ApprovalItem = {
  id?: string;
  approvalId?: string;
  title?: string;
  summary?: string;
  action?: string;
  risk?: string;
  status?: string;
  createdAt?: string;
};

export type LearningItem = {
  id?: string;
  candidateId?: string;
  title?: string;
  summary?: string;
  kind?: string;
  lane?: string;
  risk?: string;
  confidence?: number;
  status?: string;
  expiry?: string;
};

export type MemoryItem = {
  id?: string;
  title?: string;
  summary?: string;
  kind?: string;
  confidence?: number;
  expiry?: string;
  receiptId?: string;
};

export type ToolItem = {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  source?: string;
  status?: string;
  risk?: string;
};

export type ChannelItem = {
  id?: string;
  name?: string;
  channel?: string;
  configured?: boolean;
  liveReady?: boolean;
  outboxOnly?: boolean;
  defaultRouteAllowed?: boolean;
  status?: string;
  summary?: string;
};

export type MemoryEncryptionStatus = {
  generatedAt: string;
  dbPath: string;
  databaseExists: boolean;
  records: number;
  contentEncrypted: boolean;
  safeForDailyUse: boolean;
  atRestEncryptionMode: 'field' | 'field+file' | 'json-field';
  fullFileEncrypted: boolean;
  fullFileEncryptionStatus: 'off' | 'active' | 'unavailable' | 'required-unavailable' | 'unverified';
  fullFileEncryptionRequired: boolean;
  fullFileEncryptionKeyStorage: string;
  fullFileEncryptionDriverPackage: string | null;
  fullFileEncryptionProof?: {
    unkeyedOpenBlocked: boolean | null;
    reason: string;
  };
  guidance: string;
};

export type MemoryEncryptionMigrationReceipt = {
  generatedAt: string;
  action: 'preview' | 'apply' | 'rollback';
  status: 'preview' | 'blocked' | 'applied' | 'rolled-back' | 'failed';
  dbPath: string;
  backupPath: string | null;
  wouldBackup: boolean;
  wouldReplaceDatabase: boolean;
  recordsMigrated: number;
  fullFileEncrypted: boolean;
  reason: string;
};

export type DesktopPanelsData = {
  approvals: ApprovalItem[];
  learning: LearningItem[];
  tools: ToolItem[];
  nexusStatus: unknown;
  memoryEncryptionStatus: MemoryEncryptionStatus | null;
  runtimeCapabilities: RuntimeCapabilitiesSnapshot | null;
};

export type RuntimeStateActionInput = {
  type: string;
  approved?: boolean;
  previewOnly?: boolean;
  sessionId?: string | null;
  source?: string | null;
  connectedModelIds?: string[] | null;
  payload?: Record<string, unknown>;
};

export type RuntimeCapabilitiesSnapshot = {
  contractVersion?: string;
  capabilities?: {
    summary?: {
      available?: number;
      blocked?: number;
      configurable?: number;
      pending?: number;
    };
    available?: Array<{ id?: string; label?: string; domain?: string }>;
    blocked?: Array<{ id?: string; label?: string; reason?: string }>;
    configurable?: Array<{ id?: string; label?: string; reason?: string }>;
    pending?: Array<{ id?: string; label?: string; reason?: string }>;
  };
  permissions?: {
    domains?: Record<string, {
      label?: string;
      actions?: Record<string, {
        default?: string;
        requiresApproval?: boolean;
        scope?: string;
        reason?: string;
      }>;
    }>;
  };
  modelSpecs?: {
    selectedSpecId?: string;
    selectedEffort?: string;
    specs?: Array<{
      id?: string;
      label?: string;
      summary?: string;
      estimatedCost?: string;
      maxEffort?: string;
      preferredModelIds?: string[];
    }>;
  };
  providers?: {
    connected?: RuntimeProviderConnection[];
    configurable?: RuntimeProviderConnection[];
    blocked?: RuntimeProviderConnection[];
    all?: RuntimeProviderConnection[];
    selectableModelIds?: string[];
    selectedModelId?: string;
    routingReason?: string;
  };
  workspace?: {
    id?: string;
    label?: string;
    path?: string | null;
    isolation?: string;
    knowledgeSourceCount?: number;
    untrustedContextWrapping?: boolean;
  };
  workspaceKnowledge?: {
    workspaceId?: string;
    activeWorkspaceLabel?: string;
    isolation?: string;
    trustedWorkspaceIds?: string[];
    allowedPaths?: string[];
    ragSources?: Array<{
      id?: string;
      kind?: 'document' | 'web' | 'email' | 'memory' | string;
      label?: string;
      trusted?: boolean;
    }>;
    untrustedContextWrapping?: boolean;
  };
  personalOps?: {
    connectors?: Array<{
      id?: string;
      kind?: string;
      label?: string;
      status?: string;
      enabled?: boolean;
      readAllowed?: boolean;
      draftAllowed?: boolean;
      sendRequiresApproval?: boolean;
      writeRequiresApproval?: boolean;
      lastReceiptId?: string | null;
      operations?: Array<{
        id?: string;
        label?: string;
        requiresApproval?: boolean;
        enabled?: boolean;
      }>;
      profilePriority?: string;
    }>;
    policy?: {
      primaryProfile?: string;
      defaultOutsidePersonal?: string;
      liveAdaptersRequireCredentialRef?: boolean;
      mcpAllowedAsAdapter?: boolean;
    };
  };
  mcpTrust?: {
    servers?: Array<{
      id?: string;
      label?: string;
      origin?: string;
      trustState?: string;
      toolNames?: string[];
      risk?: string;
      networkAccess?: string;
      exposedToModel?: boolean;
      lastReceiptId?: string | null;
    }>;
  };
  skillHistory?: {
    entries?: Array<{
      id?: string;
      skillId?: string;
      skillName?: string;
      mode?: string;
      source?: string;
      receiptId?: string | null;
      at?: string;
    }>;
  };
  streamSession?: {
    status?: string;
    resumeToken?: string | null;
    resumable?: boolean;
  };
  jobs?: {
    status?: string;
    summary?: string;
    actionIds?: string[];
  };
  safety?: Record<string, unknown>;
};

export type RuntimeProviderConnection = {
  id?: string;
  label?: string;
  status?: string;
  targetHost?: string | null;
  localLoopback?: boolean;
  defaultRouteAllowed?: boolean;
  blockReason?: string | null;
  updatedAt?: string;
};

function bridge() {
  if (!window.zavorthDesktop) {
    throw new Error('Zavorth Desktop bridge is unavailable.');
  }
  return window.zavorthDesktop;
}

export async function apiRequest<T = unknown>(request: DesktopApiRequest): Promise<DesktopApiResult<T>> {
  return bridge().apiRequest<T>(request);
}

export async function connectGooglePersonalOps() {
  return bridge().connectGooglePersonalOps();
}

function requireOk<T>(result: DesktopApiResult<T>, fallback: string): T {
  if (!result.ok) {
    throw new Error(result.error || fallback);
  }
  return result.data as T;
}

export async function loadRuntimeStatus(): Promise<RuntimeStatus> {
  return bridge().getRuntimeStatus();
}

export async function startRuntime(): Promise<RuntimeStatus> {
  return bridge().startRuntime();
}

export async function repairAccess(): Promise<RuntimeStatus> {
  return bridge().repairAccess();
}

export async function loadHome(sessionId?: string, responseProfile?: string): Promise<ExperienceSnapshot> {
  const result = await apiRequest<ExperienceSnapshot>({
    method: 'GET',
    path: '/api/experience/home',
    query: {
      surface: 'web',
      sessionId,
      responseProfile,
    },
  });
  return requireOk(result, 'Could not load Zavorth home state.');
}

export async function sendExperienceMessage(input: {
  text: string;
  sessionId?: string;
  responseProfile?: string;
  effort?: string;
  profile?: string;
  model?: string;
  connectedModelIds?: string[];
  workspace?: {
    id: string;
    label: string;
    kind: string;
    path: string | null;
    confinement: string;
  };
}): Promise<AskResponse> {
  const result = await apiRequest<AskResponse>({
    method: 'POST',
    path: '/api/experience/ask',
    body: {
      text: input.text,
      sessionId: input.sessionId,
      surface: 'api',
      userId: 'desktop-user',
      responseProfile: input.responseProfile,
      model: input.model,
      metadata: {
        client: 'zavorth-desktop',
        effort: input.effort,
        model: input.model,
        connectedModelIds: input.connectedModelIds || [],
        profile: input.profile,
        workspace: input.workspace,
      },
    },
    timeoutMs: 60000,
  });
  return requireOk(result, 'Could not send message to Zavorth.');
}

export async function loadApprovals(): Promise<ApprovalItem[]> {
  const result = await apiRequest<{ approvals?: ApprovalItem[]; pending?: ApprovalItem[] }>({
    method: 'GET',
    path: '/api/experience/approvals',
    query: { surface: 'web' },
  });
  const data = requireOk(result, 'Could not load approvals.');
  return data.approvals || data.pending || [];
}

export async function resolveApproval(
  approvalId: string,
  decision: 'approve' | 'reject',
): Promise<unknown> {
  const result = await apiRequest({
    method: 'POST',
    path: `/api/experience/approvals/${encodeURIComponent(approvalId)}/decision`,
    body: {
      decision,
      surface: 'web',
      userId: 'desktop-user',
    },
  });
  return requireOk(result, 'Could not resolve approval.');
}

export async function loadLearning(): Promise<LearningItem[]> {
  const result = await apiRequest<{ candidates?: LearningItem[]; learning?: { candidates?: LearningItem[] } }>({
    method: 'GET',
    path: '/api/experience/learning',
    query: { surface: 'web' },
  });
  const data = requireOk(result, 'Could not load learning candidates.');
  return data.candidates || data.learning?.candidates || [];
}

export async function resolveLearning(
  candidateId: string,
  decision: 'approve' | 'reject' | 'forget',
): Promise<unknown> {
  const result = await apiRequest({
    method: 'POST',
    path: `/api/experience/learning/${encodeURIComponent(candidateId)}/decision`,
    body: {
      decision,
      surface: 'web',
      userId: 'desktop-user',
    },
  });
  return requireOk(result, 'Could not resolve learning candidate.');
}

export async function loadTools(): Promise<ToolItem[]> {
  const result = await apiRequest<{ tools?: ToolItem[]; items?: ToolItem[] }>({
    method: 'GET',
    path: '/api/v2/echo/tools',
    query: { surface: 'web' },
  });
  if (!result.ok) {
    return [];
  }
  return result.data?.tools || result.data?.items || [];
}

export async function loadNexusStatus(): Promise<unknown> {
  const result = await apiRequest({
    method: 'GET',
    path: '/api/v2/nexus/status',
    query: { surface: 'web' },
  });
  return result.ok ? result.data : null;
}

export async function loadMemoryEncryptionStatus(): Promise<MemoryEncryptionStatus | null> {
  const result = await apiRequest<{ status?: MemoryEncryptionStatus }>({
    method: 'GET',
    path: '/api/experience/memory/encryption',
    query: { surface: 'web' },
  });
  if (!result.ok) {
    return null;
  }
  return result.data?.status || null;
}

export async function runMemoryEncryptionMigration(input: {
  action: 'preview' | 'apply' | 'rollback';
  backupPath?: string | null;
}): Promise<{
  receipt?: MemoryEncryptionMigrationReceipt;
  status?: MemoryEncryptionStatus;
}> {
  const result = await apiRequest<{
    receipt?: MemoryEncryptionMigrationReceipt;
    status?: MemoryEncryptionStatus;
  }>({
    method: 'POST',
    path: '/api/experience/memory/encryption',
    body: {
      action: input.action,
      mode: 'required',
      keyStore: 'auto',
      backupPath: input.backupPath || undefined,
      surface: 'web',
    },
    timeoutMs: 60000,
  });
  return requireOk(result, 'Could not update memory protection.');
}

export async function dispatchRuntimeStateAction(input: RuntimeStateActionInput): Promise<unknown> {
  const result = await apiRequest({
    method: 'POST',
    path: '/api/experience/runtime-state/action',
    body: {
      type: input.type,
      approved: input.approved,
      previewOnly: input.previewOnly,
      surface: 'api',
      userId: 'desktop-user',
      sessionId: input.sessionId || undefined,
      source: input.source || 'zavorth-desktop',
      connectedModelIds: input.connectedModelIds || undefined,
      payload: input.payload || {},
    },
    timeoutMs: 20000,
  });
  return requireOk(result, 'Could not update runtime state.');
}

export async function loadRuntimeCapabilities(): Promise<RuntimeCapabilitiesSnapshot> {
  const result = await apiRequest<RuntimeCapabilitiesSnapshot>({
    method: 'GET',
    path: '/api/runtime/capabilities',
    timeoutMs: 10000,
  });
  return requireOk(result, 'Could not load runtime capabilities.');
}

export async function steerActiveRun(input: {
  sessionId: string;
  message: string;
  action?: 'add' | 'cancel' | 'replace';
}): Promise<unknown> {
  const result = await apiRequest({
    method: 'POST',
    path: '/api/web/chat/steer',
    body: {
      sessionId: input.sessionId,
      message: input.message,
      action: input.action || 'add',
      metadata: {
        source: 'zavorth-desktop',
      },
    },
  });
  return requireOk(result, 'Could not steer the active run.');
}

export async function loadDesktopPanelsData(): Promise<DesktopPanelsData> {
  const [approvals, learning, tools, nexusStatus, memoryEncryptionStatus, runtimeCapabilities] = await Promise.all([
    loadApprovals().catch(() => []),
    loadLearning().catch(() => []),
    loadTools().catch(() => []),
    loadNexusStatus().catch(() => null),
    loadMemoryEncryptionStatus().catch(() => null),
    loadRuntimeCapabilities().catch(() => null),
  ]);
  return { approvals, learning, tools, nexusStatus, memoryEncryptionStatus, runtimeCapabilities };
}

export async function loadWorkspaceWriteApprovals(sessionId?: string): Promise<any[]> {
  const result = await apiRequest<{ data: any[] }>({
    method: 'GET',
    path: '/api/v2/workspace/approvals/pending',
    query: sessionId ? { sessionId } : {},
  });
  const data = requireOk(result, 'Could not load workspace write approvals.');
  return data.data || [];
}

export async function loadWorkspaceWriteApprovalPayload(
  operationId: string,
  sessionId?: string,
  workspacePath?: string,
): Promise<any> {
  const query: Record<string, string> = { operationId };
  if (sessionId) query.sessionId = sessionId;
  if (workspacePath) query.workspacePath = workspacePath;

  const result = await apiRequest<any>({
    method: 'GET',
    path: '/api/v2/workspace/approvals/payload',
    query,
  });
  return requireOk(result, 'Could not load workspace write approval payload.');
}

export async function resolveWorkspaceWriteApproval(
  operationId: string,
  decision: 'approve' | 'deny',
): Promise<void> {
  const result = await apiRequest<void>({
    method: 'POST',
    path: '/api/v2/workspace/approvals/resolve',
    body: {
      operationId,
      decision,
    },
  });
  requireOk(result, 'Could not resolve workspace write approval.');
}

export interface WorkspaceTrustStatus {
  ok: boolean;
  trusted: boolean;
  entry: {
    workspaceId: string;
    rootHash: string;
    rootSuffix: string;
    trusted: boolean;
    allowRiskUpTo: 'LOW' | 'MEDIUM';
    allowPackageInstall: boolean;
    allowNetwork: boolean;
  } | null;
}

export async function getWorkspaceTrustStatus(workspaceId: string): Promise<WorkspaceTrustStatus> {
  const result = await apiRequest<WorkspaceTrustStatus>({
    method: 'GET',
    path: '/api/v2/workspace/trust/status',
    query: { workspaceId },
  });
  return requireOk(result, 'Could not load workspace trust status.');
}

export async function resolveWorkspaceTrust(payload: {
  workspaceId: string;
  rootPath: string;
  trusted: boolean;
  allowRiskUpTo?: 'LOW' | 'MEDIUM';
  allowPackageInstall?: boolean;
  allowNetwork?: boolean;
}): Promise<any> {
  const result = await apiRequest<any>({
    method: 'POST',
    path: '/api/v2/workspace/trust/resolve',
    body: payload,
  });
  return requireOk(result, 'Could not resolve workspace trust.');
}

export async function loadProposedMandate(workspaceId: string): Promise<any> {
  const result = await apiRequest<any>({
    method: 'GET',
    path: '/api/v2/workspace/task-mandates/pending',
    query: { workspaceId },
  });
  return requireOk(result, 'Could not load proposed task mandate.').proposed;
}

export async function loadActiveMandate(workspaceId: string): Promise<any> {
  const result = await apiRequest<any>({
    method: 'GET',
    path: '/api/v2/workspace/task-mandates/active',
    query: { workspaceId },
  });
  return requireOk(result, 'Could not load active task mandate.').active;
}

export async function resolveProposedMandate(workspaceId: string, approved: boolean): Promise<any> {
  const result = await apiRequest<any>({
    method: 'POST',
    path: '/api/v2/workspace/task-mandates/resolve',
    body: { workspaceId, approved },
  });
  return requireOk(result, 'Could not resolve task mandate.');
}

export async function revokeActiveMandate(workspaceId: string): Promise<any> {
  const result = await apiRequest<any>({
    method: 'POST',
    path: '/api/v2/workspace/task-mandates/revoke',
    body: { workspaceId },
  });
  return requireOk(result, 'Could not revoke task mandate.');
}
