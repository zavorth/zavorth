import type { DesktopApiRequest, DesktopApiResult, RuntimeStatus } from './global';
import {
  normalizeSessionCreateInput,
  resolveCreatedSessionId,
  type DesktopSessionCreateInput,
  type DesktopSessionCreateResult,
} from './session/sessionHelpers';

export type { DesktopSessionCreateInput, DesktopSessionCreateResult };

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

/** Desktop surface-projection payload (from DesktopSurfaceProjector or local synthesis). */
export type ApprovalSurfaceProjection = {
  shortcuts?: Array<{ key: string; choice?: string | null; optionId?: string; label?: string }>;
  copyTargets?: Array<{ id: string; label: string; value: string }>;
  openReceipt?: { label?: string; href?: string; approvalId?: string } | null;
  surfaceActions?: unknown[];
  keyboardShortcuts?: boolean;
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
  surfaceProjection?: ApprovalSurfaceProjection | null;
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
  key?: string;
  title?: string;
  summary?: string;
  kind?: string;
  type?: string;
  content?: string;
  contentPreview?: string;
  editable?: boolean;
  confidence?: number;
  expiry?: string;
  receiptId?: string;
  metadata?: Record<string, unknown>;
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

export type ControlMemorySnapshot = {
  ok?: boolean;
  contractVersion?: string;
  query?: Record<string, unknown>;
  facts?: MemoryItem[];
  stats?: Record<string, unknown>;
};

export type ChannelSetupOption = {
  channelId?: string;
  label?: string;
  configured?: boolean;
  readiness?: string;
  summary?: string;
  setupMode?: string;
  recommendedMode?: string;
  missingEnvKeys?: string[];
  [key: string]: unknown;
};

export type ChannelSetupSnapshot = {
  ok?: boolean;
  contractVersion?: string;
  assistant?: {
    status?: string;
    selected?: Record<string, unknown> | null;
    options?: ChannelSetupOption[];
    naturalReply?: string;
    nextActions?: Array<Record<string, unknown>>;
  };
  channels?: unknown;
};

export type GatewayResilienceSnapshot = {
  ok?: boolean;
  policy?: Record<string, unknown>;
  providers?: Array<Record<string, unknown>>;
  budget?: Record<string, unknown>;
  receipts?: Array<Record<string, unknown>>;
  health?: Record<string, unknown>;
};

export type WorkspaceWriteApprovalItem = {
  operationId: string;
  operation_id?: string;
  id?: string;
  toolName: string;
  pathSuffix: string;
  path: string | null;
  createdAt: string;
  expiresAt: string;
  [key: string]: unknown;
};

export type TaskMandate = {
  mandateId: string;
  workspaceId: string;
  taskId?: string;
  description: string;
  targetDirectories: string[];
  allowedOperations: string[];
  allowedBinaries: string[];
  maxRiskLevel: string;
  allowPackageInstall: boolean;
  allowNetwork: boolean;
  expiresAt: string;
  createdAt: string;
  [key: string]: unknown;
};

export type HostCommandItem = {
  operationId: string;
  operation_id?: string;
  workspaceId: string;
  commandPreview: string;
  argsPreview: string;
  cwdSuffix: string;
  shell: boolean;
  riskLevel: string;
  reasonRedacted: string;
  createdAt: string;
  expiresAt: string;
  requiresStrongConfirmation: boolean;
  strongConfirmationPhrase: string | null;
  [key: string]: unknown;
};

export type PtyOutputChunk = {
  seq: number;
  chunk: string;
  [key: string]: unknown;
};

export type MutationReceipt = {
  receiptId?: string;
  status?: string;
  [key: string]: unknown;
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
  controlMemory: ControlMemorySnapshot | null;
  channelSetup: ChannelSetupSnapshot | null;
  gatewayResilience: GatewayResilienceSnapshot | null;
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

export async function createDesktopSession(
  input: DesktopSessionCreateInput = {},
): Promise<DesktopSessionCreateResult> {
  const { sessionId, label, surface, workspaceId } = normalizeSessionCreateInput(input);

  if (window.zavorthDesktop && 'createSession' in window.zavorthDesktop && typeof (window.zavorthDesktop as { createSession?: unknown }).createSession === 'function') {
    const result = await (window.zavorthDesktop as {
      createSession(input: DesktopSessionCreateInput): Promise<DesktopApiResult<DesktopSessionCreateResult>>;
    }).createSession({ sessionId, label, surface, workspaceId });
    if (result.ok && result.data?.sessionId) {
      return {
        sessionId: String(result.data.sessionId),
        label: result.data.label || label,
        surface: result.data.surface || surface,
      };
    }
  }

  const createResult = await apiRequest<DesktopSessionCreateResult | { data?: DesktopSessionCreateResult }>({
    method: 'POST',
    path: '/api/experience/sessions',
    body: { sessionId, label, surface, workspaceId },
    timeoutMs: 12000,
  });

  if (createResult.ok) {
    return {
      sessionId: resolveCreatedSessionId(createResult.data, sessionId),
      label,
      surface,
    };
  }

  // Lazy-create fallback: switch to a fresh id (runtime may create on first home/ask).
  const switchResult = await apiRequest({
    method: 'POST',
    path: '/api/experience/sessions/switch',
    body: { sessionId, label, surface },
    timeoutMs: 8000,
  });
  if (!switchResult.ok) {
    // Still return the local id so the UI can start a clean thread.
    return { sessionId, label, surface };
  }
  return { sessionId, label, surface };
}

export async function switchDesktopSession(sessionId: string): Promise<void> {
  const id = String(sessionId || '').trim();
  if (!id) {
    throw new Error('Session id is required.');
  }
  if (window.zavorthDesktop?.switchSession) {
    const result = await window.zavorthDesktop.switchSession(id);
    if (!result.ok) {
      throw new Error(result.error || 'Could not switch session.');
    }
    return;
  }
  const result = await apiRequest({
    method: 'POST',
    path: '/api/experience/sessions/switch',
    body: { sessionId: id },
    timeoutMs: 8000,
  });
  requireOk(result, 'Could not switch session.');
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
  profileConfig?: {
    id: string;
    name: string;
    systemPrompt: string;
    effort: string;
    costLimit: number;
  };
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
        profileConfig: input.profileConfig,
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
    query: { surface: 'desktop' },
  });
  const data = requireOk(result, 'Could not load approvals.');
  return data.approvals || data.pending || [];
}

export type ApprovalChoice = 'once' | 'session' | 'always' | 'deny' | 'approve' | 'reject';

export type DesktopVoicePreference = {
  version?: string;
  mode?: 'off' | 'dictation' | 'conversation';
  stt?: {
    provider?: string;
    model?: string | null;
    language?: string;
  };
  tts?: {
    enabled?: boolean;
    provider?: string;
    voiceId?: string | null;
  };
};

export type DesktopVoicePreferenceResponse = {
  preference?: DesktopVoicePreference;
  resolve?: { ok?: boolean; code?: string; message?: string; providers?: string[]; source?: string };
  describe?: string;
  path?: string;
};

export type DesktopVoiceMetricsSnapshot = {
  version?: string;
  total?: number;
  stt?: { ok?: number; fail?: number; avgLatencyMs?: number | null };
  tts?: { ok?: number; fail?: number; avgLatencyMs?: number | null };
  dictation?: { ok?: number; fail?: number };
  duplex?: { sessions?: number; turns?: number };
  recent?: Array<Record<string, unknown>>;
};

export async function loadVoicePreference(): Promise<DesktopVoicePreferenceResponse> {
  const result = await apiRequest<DesktopVoicePreferenceResponse>({
    method: 'GET',
    path: '/api/experience/voice/preference',
  });
  return requireOk(result, 'Could not load voice preference.');
}

export async function saveVoicePreference(
  body: Record<string, unknown>,
): Promise<DesktopVoicePreferenceResponse> {
  const result = await apiRequest<DesktopVoicePreferenceResponse>({
    method: 'PUT',
    path: '/api/experience/voice/preference',
    body,
  });
  return requireOk(result, 'Could not save voice preference.');
}

export async function loadVoiceMetrics(limit = 40): Promise<DesktopVoiceMetricsSnapshot> {
  const result = await apiRequest<DesktopVoiceMetricsSnapshot>({
    method: 'GET',
    path: '/api/experience/voice/metrics',
    query: { limit: String(limit) },
  });
  return requireOk(result, 'Could not load voice metrics.');
}

export async function voiceDuplexAction(
  body: Record<string, unknown>,
): Promise<{ ok?: boolean; session?: Record<string, unknown>; sessions?: unknown[]; error?: string }> {
  const result = await apiRequest<{
    ok?: boolean;
    session?: Record<string, unknown>;
    sessions?: unknown[];
    error?: string;
  }>({
    method: 'POST',
    path: '/api/experience/voice/duplex',
    body,
  });
  return requireOk(result, 'Could not control voice duplex session.');
}

export type DesktopVoiceProbeResult = {
  version?: string;
  kind?: string;
  ok?: boolean;
  code?: string;
  message?: string;
  providers?: string[];
  provider?: string | null;
  voiceId?: string | null;
  sampleText?: string;
  clientSpeakRecommended?: boolean;
  stt?: DesktopVoiceProbeResult;
  tts?: DesktopVoiceProbeResult;
  mode?: string;
  describe?: string;
};

export async function testVoiceConfig(body: {
  action?: 'stt' | 'tts' | 'all';
  sampleText?: string;
}): Promise<{ ok?: boolean; result?: DesktopVoiceProbeResult }> {
  const result = await apiRequest<{ ok?: boolean; result?: DesktopVoiceProbeResult }>({
    method: 'POST',
    path: '/api/experience/voice/test',
    body,
  });
  return requireOk(result, 'Could not run voice configuration test.');
}


export async function resolveApproval(
  approvalId: string,
  decision: ApprovalChoice,
): Promise<unknown> {
  const choice =
    decision === 'approve' ? 'once' : decision === 'reject' ? 'deny' : decision;
  const result = await apiRequest({
    method: 'POST',
    path: `/api/experience/approvals/${encodeURIComponent(approvalId)}/decision`,
    body: {
      decision: choice === 'deny' ? 'reject' : 'approve',
      choice,
      surface: 'desktop',
      userId: 'desktop-user',
      metadata: { choice, source: 'zavorth-desktop' },
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

export async function loadControlMemory(input: {
  query?: string;
  type?: string;
  semantic?: boolean;
  limit?: number;
} = {}): Promise<ControlMemorySnapshot | null> {
  const result = await apiRequest<ControlMemorySnapshot>({
    method: 'GET',
    path: '/api/web/zavorthControl/memory',
    query: {
      query: input.query || undefined,
      type: input.type || undefined,
      semantic: input.semantic ? 'true' : undefined,
      limit: String(input.limit || 50),
    },
  });
  return result.ok ? result.data || null : null;
}

export async function mutateControlMemory(input: {
  action: 'forget' | 'updatePreference' | 'exportMemory';
  id?: string;
  content?: string;
  query?: string;
  type?: string;
}): Promise<{ receipt?: MutationReceipt; result?: unknown; [key: string]: unknown }> {
  const result = await apiRequest<{ receipt?: MutationReceipt; result?: unknown; [key: string]: unknown }>({
    method: 'POST',
    path: '/api/web/zavorthControl/memory',
    body: input,
  });
  return requireOk(result, 'Could not update memory.');
}

export async function loadChannelSetup(input: {
  channelId?: string | null;
  mode?: string | null;
} = {}): Promise<ChannelSetupSnapshot | null> {
  const result = await apiRequest<ChannelSetupSnapshot>({
    method: 'GET',
    path: '/api/web/zavorthControl/channels/setup',
    query: {
      channelId: input.channelId || undefined,
      mode: input.mode || undefined,
    },
  });
  return result.ok ? result.data || null : null;
}

export async function mutateChannelSetup(input: {
  action: 'applyScaffold' | 'doctor' | 'testConnection';
  channelId?: string | null;
  mode?: string | null;
  extraEntries?: Array<{ key: string; value: string }>;
}): Promise<{ action?: string; receipt?: MutationReceipt; result?: { assistant?: ChannelSetupSnapshot['assistant'] }; [key: string]: unknown }> {
  const result = await apiRequest<{
    action?: string;
    receipt?: MutationReceipt;
    result?: { assistant?: ChannelSetupSnapshot['assistant'] };
    [key: string]: unknown;
  }>({
    method: 'POST',
    path: '/api/web/zavorthControl/channels/setup',
    body: input,
    timeoutMs: 60000,
  });
  return requireOk(result, 'Could not run channel setup.');
}

export async function loadGatewayResilience(): Promise<GatewayResilienceSnapshot | null> {
  const result = await apiRequest<GatewayResilienceSnapshot>({
    method: 'GET',
    path: '/api/gateway-control/resilience',
  });
  return result.ok ? result.data || null : null;
}

export async function mutateGatewayResilience(input: Record<string, unknown>): Promise<{
  resilience?: GatewayResilienceSnapshot;
  receipt?: MutationReceipt;
  status?: string;
  [key: string]: unknown;
}> {
  const result = await apiRequest<{
    resilience?: GatewayResilienceSnapshot;
    receipt?: MutationReceipt;
    status?: string;
    [key: string]: unknown;
  }>({
    method: 'POST',
    path: '/api/gateway-control/resilience',
    body: input,
    timeoutMs: 60000,
  });
  return requireOk(result, 'Could not update gateway resilience.');
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
  const [
    approvals,
    learning,
    tools,
    nexusStatus,
    controlMemory,
    channelSetup,
    gatewayResilience,
    memoryEncryptionStatus,
    runtimeCapabilities,
  ] = await Promise.all([
    loadApprovals().catch(() => []),
    loadLearning().catch(() => []),
    loadTools().catch(() => []),
    loadNexusStatus().catch(() => null),
    loadControlMemory().catch(() => null),
    loadChannelSetup().catch(() => null),
    loadGatewayResilience().catch(() => null),
    loadMemoryEncryptionStatus().catch(() => null),
    loadRuntimeCapabilities().catch(() => null),
  ]);
  return {
    approvals,
    learning,
    tools,
    nexusStatus,
    controlMemory,
    channelSetup,
    gatewayResilience,
    memoryEncryptionStatus,
    runtimeCapabilities,
  };
}

export async function loadWorkspaceWriteApprovals(sessionId?: string): Promise<WorkspaceWriteApprovalItem[]> {
  const result = await apiRequest<{ data?: WorkspaceWriteApprovalItem[] } | WorkspaceWriteApprovalItem[]>({
    method: 'GET',
    path: '/api/v2/workspace/approvals/pending',
    query: sessionId ? { sessionId } : {},
  });
  const data = requireOk(result, 'Could not load workspace write approvals.');
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.data) ? data.data : [];
}

export async function loadWorkspaceWriteApprovalPayload(
  operationId: string,
  sessionId?: string,
  workspacePath?: string,
): Promise<Record<string, unknown>> {
  const query: Record<string, string> = { operationId };
  if (sessionId) query.sessionId = sessionId;
  if (workspacePath) query.workspacePath = workspacePath;

  const result = await apiRequest<Record<string, unknown>>({
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
}): Promise<WorkspaceTrustStatus> {
  const result = await apiRequest<WorkspaceTrustStatus>({
    method: 'POST',
    path: '/api/v2/workspace/trust/resolve',
    body: payload,
  });
  return requireOk(result, 'Could not resolve workspace trust.');
}

export async function loadProposedMandate(workspaceId: string): Promise<TaskMandate | null> {
  const result = await apiRequest<{ proposed?: TaskMandate | null }>({
    method: 'GET',
    path: '/api/v2/workspace/task-mandates/pending',
    query: { workspaceId },
  });
  if (!result.ok) return null;
  const data = result.data;
  if (!data || typeof data !== 'object') return null;
  return data.proposed ?? null;
}

export async function loadActiveMandate(workspaceId: string): Promise<TaskMandate | null> {
  const result = await apiRequest<{ active?: TaskMandate | null }>({
    method: 'GET',
    path: '/api/v2/workspace/task-mandates/active',
    query: { workspaceId },
  });
  if (!result.ok) return null;
  const data = result.data;
  if (!data || typeof data !== 'object') return null;
  return data.active ?? null;
}

export async function resolveProposedMandate(workspaceId: string, approved: boolean): Promise<MutationReceipt | Record<string, unknown>> {
  const result = await apiRequest<MutationReceipt | Record<string, unknown>>({
    method: 'POST',
    path: '/api/v2/workspace/task-mandates/resolve',
    body: { workspaceId, approved },
  });
  return requireOk(result, 'Could not resolve task mandate.');
}

export async function revokeActiveMandate(workspaceId: string): Promise<MutationReceipt | Record<string, unknown>> {
  const result = await apiRequest<MutationReceipt | Record<string, unknown>>({
    method: 'POST',
    path: '/api/v2/workspace/task-mandates/revoke',
    body: { workspaceId },
  });
  return requireOk(result, 'Could not revoke task mandate.');
}

export async function getHostPowerStatus(workspaceId: string): Promise<{ enabled: boolean; timeLeftSeconds: number }> {
  const result = await apiRequest<{ enabled: boolean; timeLeftSeconds: number }>({
    method: 'GET',
    path: '/api/v2/workspace/host-power/status',
    query: { workspaceId },
  });
  return requireOk(result, 'Could not get host power mode status.');
}

export async function enableHostPower(workspaceId: string, durationMinutes: number): Promise<void> {
  const result = await apiRequest<Record<string, unknown>>({
    method: 'POST',
    path: '/api/v2/workspace/host-power/enable',
    body: { workspaceId, durationMinutes },
  });
  requireOk(result, 'Could not enable host power mode.');
}

export async function disableHostPower(workspaceId: string): Promise<void> {
  const result = await apiRequest<Record<string, unknown>>({
    method: 'POST',
    path: '/api/v2/workspace/host-power/disable',
    body: { workspaceId },
  });
  requireOk(result, 'Could not disable host power mode.');
}

export async function getPendingHostCommands(workspaceId: string): Promise<HostCommandItem[]> {
  const result = await apiRequest<{ data?: HostCommandItem[] } | HostCommandItem[]>({
    method: 'GET',
    path: '/api/v2/workspace/host-commands/pending',
    query: { workspaceId },
  });
  const data = requireOk(result, 'Could not get pending host commands.');
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.data) ? data.data : [];
}

export async function resolveHostCommand(
  operationId: string,
  decision: 'approve' | 'deny',
  strongConfirmationInput?: string,
): Promise<void> {
  const result = await apiRequest<Record<string, unknown>>({
    method: 'POST',
    path: '/api/v2/workspace/host-commands/resolve',
    body: {
      operationId,
      decision,
      strongConfirmationInput,
    },
  });
  requireOk(result, 'Could not resolve host command.');
}

export async function executeHostCommand(workspaceId: string, operationId: string): Promise<Record<string, unknown>> {
  const result = await apiRequest<Record<string, unknown>>({
    method: 'POST',
    path: '/api/v2/workspace/host-commands/execute',
    body: { workspaceId, operationId },
  });
  return requireOk(result, 'Could not execute host command.');
}

export async function getPtyOutput(workspaceId: string, sessionId: string, afterSeq: number): Promise<PtyOutputChunk[]> {
  const result = await apiRequest<{ data?: PtyOutputChunk[] } | PtyOutputChunk[]>({
    method: 'GET',
    path: '/api/v2/workspace/pty/output',
    query: { workspaceId, sessionId, afterSeq: afterSeq.toString() },
  });
  const data = requireOk(result, 'Could not get PTY output.');
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.data) ? data.data : [];
}

export async function sendPtyInput(workspaceId: string, sessionId: string, data: string): Promise<void> {
  await apiRequest<Record<string, unknown>>({
    method: 'POST',
    path: '/api/v2/workspace/pty/input',
    body: { workspaceId, sessionId, data },
  });
}

export type PluginOsActionBody = {
  action: 'enable' | 'disable' | 'trust' | 'uninstall' | 'inspect' | 'refresh' | 'recommend' | 'suggest' | 'catalog-apply' | 'metrics-persist' | 'telemetry-sample' | 'onboarding-plan' | 'onboarding-apply' | 'onboarding-undo' | 'preview-permissions' | 'prompt-preview' | 'receipts-timeline' | 'inject-prefs' | string;
  pluginId?: string;
  trust?: 'review' | 'trusted' | 'blocked' | string;
  approved?: boolean;
  intent?: string;
  query?: string;
  limit?: number;
  useLlm?: boolean;
  force?: boolean;
  profile?: string;
  optionalIds?: string[] | string;
  injectMode?: string;
  injectSamplePercent?: number;
};

export type PluginOsSuggestUi = {
  title?: string;
  body?: string;
  actions?: Array<{ id: string; label: string; pluginId?: string }>;
};

export type PluginOsSuggestResult = {
  ok?: boolean;
  intent?: string;
  message?: string;
  autoEnable?: boolean;
  primary?: {
    pluginId?: string;
    summary?: string;
    canEnable?: boolean;
    enableHint?: string;
    needsCredentials?: boolean;
    risks?: string[];
  } | null;
  suggestions?: Array<Record<string, unknown>>;
  ui?: PluginOsSuggestUi;
  text?: string;
};

export type PluginOsReceiptEntry = {
  id?: string;
  kind?: string;
  pluginId?: string | null;
  createdAt?: string;
  headline?: string;
  detail?: string;
};

export type PluginOsSnapshotResponse = {
  ok?: boolean;
  snapshot?: Record<string, unknown>;
  error?: string;
};

export type PluginOsActionResponse = {
  ok?: boolean;
  snapshot?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
};

/** Live Plugin OS control-plane snapshot (GET /api/plugin-os). Soft-fails on 404. */
export async function getPluginOsSnapshot(): Promise<DesktopApiResult<PluginOsSnapshotResponse>> {
  return apiRequest<PluginOsSnapshotResponse>({
    method: 'GET',
    path: '/api/plugin-os',
    timeoutMs: 15000,
  });
}

/** Live Plugin OS action (POST /api/plugin-os/actions). */
export async function postPluginOsAction(
  body: PluginOsActionBody,
): Promise<DesktopApiResult<PluginOsActionResponse>> {
  return apiRequest<PluginOsActionResponse>({
    method: 'POST',
    path: '/api/plugin-os/actions',
    body: {
      approved: true,
      ...body,
    },
    timeoutMs: 30000,
  });
}

/** Human receipts timeline (GET /api/plugin-os/receipts). Soft-fails on 404. */
export async function getPluginOsReceipts(limit = 20): Promise<DesktopApiResult<{
  ok?: boolean;
  timeline?: { entries?: PluginOsReceiptEntry[]; text?: string };
  error?: string;
}>> {
  return apiRequest({
    method: 'GET',
    path: `/api/plugin-os/receipts?limit=${encodeURIComponent(String(limit))}`,
    timeoutMs: 15000,
  });
}

// ── Skill registry ops (GET /api/skill-registry, POST /api/skill-registry/actions) ──

export type SkillRegistrySkillRow = {
  id?: string;
  name?: string;
  version?: string | null;
  description?: string | null;
  relativePath?: string;
  signed?: boolean;
  signatureMode?: string;
  riskLevel?: string;
  packageValid?: boolean;
  packageErrors?: string[];
  path?: string;
};

export type SkillRegistrySnapshot = {
  contractVersion?: string;
  generatedAt?: string;
  skillsDir?: string;
  skills?: SkillRegistrySkillRow[];
  trustedGitDomains?: string[];
  registryBaseUrl?: string | null;
  stats?: {
    total?: number;
    signed?: number;
    packageValid?: number;
    highRisk?: number;
  };
  env?: {
    hasSigningKey?: boolean;
    trustedDomainsExtra?: boolean;
    registryUrlSet?: boolean;
  };
  docs?: string[];
};

export type SkillRegistrySnapshotResponse = {
  ok?: boolean;
  snapshot?: SkillRegistrySnapshot;
  error?: string;
};

export type SkillRegistryActionBody = {
  action: string;
  skillId?: string;
  skillDir?: string;
  repoUrl?: string;
  outPath?: string;
  signingKey?: string;
  operatorConfirm?: boolean;
  baseUrl?: string;
};

export type SkillRegistryActionResponse = {
  ok?: boolean;
  snapshot?: SkillRegistrySnapshot;
  result?: {
    ok?: boolean;
    action?: string;
    message?: string;
    error?: string;
    skillId?: string | null;
    planPath?: string;
    indexPath?: string;
    count?: number;
    plan?: Record<string, unknown>;
    trustedGitDomains?: string[];
  };
  error?: string;
};

/** Skill registry ops snapshot (GET /api/skill-registry). Soft-fails on 404. */
export async function getSkillRegistrySnapshot(): Promise<DesktopApiResult<SkillRegistrySnapshotResponse>> {
  return apiRequest<SkillRegistrySnapshotResponse>({
    method: 'GET',
    path: '/api/skill-registry',
    timeoutMs: 15000,
  });
}

/** Skill registry ops action (POST /api/skill-registry/actions). */
export async function postSkillRegistryAction(
  body: SkillRegistryActionBody,
): Promise<DesktopApiResult<SkillRegistryActionResponse>> {
  return apiRequest<SkillRegistryActionResponse>({
    method: 'POST',
    path: '/api/skill-registry/actions',
    body: {
      ...body,
    },
    timeoutMs: 30000,
  });
}
