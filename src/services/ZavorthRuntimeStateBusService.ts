import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ZAVORTH_RUNTIME_STATE_BUS_CONTRACT_VERSION,
  type ZavorthRuntimeStateBusActionInput,
  type ZavorthRuntimeStateBusDispatchResult,
  type ZavorthRuntimeStateBusSnapshot,
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
import { ZavorthEffortControlService } from './ZavorthEffortControlService.js';
import { logger } from '../logger.js';

type RuntimeRecord = Record<string, unknown>;

const SENSITIVE_WORKSPACE_PATH_PATTERN =
  /(^|[\\/])(\.env(?:\.|$)|\.ssh|\.aws|\.gnupg|secrets?|credentials?|private[-_]?key|id_rsa|id_ed25519)([\\/]|$)/i;
const BROAD_WINDOWS_ROOT_PATTERN = /^[a-z]:[\\/]?$/i;
const SYSTEM_WORKSPACE_PATH_PATTERN =
  /(^[a-z]:[\\/](windows|program files|program files \(x86\)|programdata)([\\/]|$)|^[\\/]?(etc|bin|usr|var|root)([\\/]|$))/i;

type ZavorthRuntimeStateBusRuntime = {
  now?: () => Date;
  stateFilePath?: string | null;
  allowedWorkspaceRoots?: string[] | null;
  idFactory?: (prefix: string) => string;
  effortControl?: ZavorthEffortControlService;
};

type PersistedStore = {
  contractVersion: typeof ZAVORTH_RUNTIME_STATE_BUS_CONTRACT_VERSION;
  updatedAt: string;
  state: ZavorthRuntimeStateBusState;
  receipts: ZavorthRuntimeStateReceipt[];
  lastReplayAt: string | null;
};

const DEFAULT_CONNECTED_MODELS = ['zavorth:core', 'zavorth:governed'];

const DEFAULT_MODEL_SPECS: ZavorthRuntimeModelSpec[] = [
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

export class ZavorthRuntimeStateBusService {
  private readonly now: () => Date;
  private readonly stateFilePath: string;
  private readonly allowedWorkspaceRoots: string[];
  private readonly idFactory: (prefix: string) => string;
  private readonly effortControl: ZavorthEffortControlService;
  private sequence = 0;

  public constructor(runtime: ZavorthRuntimeStateBusRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.stateFilePath = path.resolve(
      runtime.stateFilePath || path.join(process.cwd(), 'data', 'runtime', 'zavorth-runtime-state-bus.json'),
    );
    this.allowedWorkspaceRoots = (runtime.allowedWorkspaceRoots || [])
      .map((root) => safeResolve(root))
      .filter((root): root is string => Boolean(root));
    this.idFactory = runtime.idFactory || ((prefix) => `${prefix}-${this.now().getTime().toString(36)}-${++this.sequence}`);
    this.effortControl = runtime.effortControl || new ZavorthEffortControlService({ now: this.now });
  }

  public buildSnapshot(): ZavorthRuntimeStateBusSnapshot {
    const store = this.readStore();
    return this.toSnapshot(store, store.restoredFromDisk);
  }

  public appendReceipt(receipt: ZavorthRuntimeStateReceipt): ZavorthRuntimeStateBusSnapshot {
    const store = this.readStore();
    store.receipts = [receipt, ...store.receipts].slice(0, 100);
    store.updatedAt = receipt.createdAt;
    if (!store.lastReplayAt || receipt.createdAt > store.lastReplayAt) {
      store.lastReplayAt = receipt.createdAt;
    }
    this.writeStore(store);
    return this.toSnapshot(store, true);
  }

  public dispatch(input: ZavorthRuntimeStateBusActionInput): ZavorthRuntimeStateBusDispatchResult {
    const store = this.readStore();
    const beforeSerialized = JSON.stringify(store.state);
    const source = clean(input.source) || clean(input.surface) || 'runtime';
    const domain = domainForAction(input);
    const preview = this.buildPreview(input, domain);
    const approved = input.approved === true || preview.requiresApproval === false;
    let status: ZavorthRuntimeStateReceiptStatus = input.previewOnly ? 'preview' : 'applied';
    let applied = false;
    let error: string | null = null;
    let pathValidated = preview.pathValidated;

    if (preview.blockedReason) {
      status = 'blocked';
      error = preview.blockedReason;
    } else if (preview.requiresApproval && !approved) {
      status = 'pending-approval';
      error = 'approval_required';
    } else if (!input.previewOnly) {
      const mutation = this.applyMutation(store.state, input, source);
      pathValidated = pathValidated || mutation.pathValidated;
      if (!mutation.ok) {
        status = 'blocked';
        error = mutation.error || 'runtime_state_mutation_blocked';
      } else {
        applied = JSON.stringify(store.state) !== beforeSerialized;
        status = applied ? 'applied' : 'noop';
      }
    }

    const receipt = this.buildReceipt({
      input,
      domain,
      status,
      applied,
      source,
      preview,
      approved: approved && status !== 'blocked',
      pathValidated,
      error,
    });
    store.receipts = [receipt, ...store.receipts].slice(0, 100);
    store.updatedAt = receipt.createdAt;
    if (!store.lastReplayAt || receipt.createdAt > store.lastReplayAt) {
      store.lastReplayAt = receipt.createdAt;
    }
    this.writeStore(store);
    return {
      ok: status !== 'blocked',
      applied,
      receipt,
      snapshot: this.toSnapshot(store, true),
      error,
    };
  }

  public syncExperienceCommand(input: {
    surface?: string | null;
    userId?: string | null;
    sessionId?: string | null;
    workspace?: string | null;
    text?: string | null;
    responseProfile?: string | null;
    metadata?: RuntimeRecord | null;
  }): ZavorthRuntimeStateBusSnapshot {
    const metadata = record(input.metadata) || {};
    const trustedDesktopBridge = false;
    const commandSource = clean(metadata.client) || clean(metadata.source) || input.surface || 'experience-core';
    const connectedModelIds = Array.isArray(metadata.connectedModelIds)
      ? metadata.connectedModelIds.map((value) => clean(value)).filter((value): value is string => Boolean(value))
      : null;

    this.dispatch({
      type: 'sync-command',
      surface: input.surface,
      userId: input.userId,
      sessionId: input.sessionId,
      source: commandSource,
      approved: true,
      text: input.text,
      connectedModelIds,
      payload: {
        metadata: {
          responseProfile: input.responseProfile || null,
          textPreview: redact(clean(input.text) || ''),
        },
      },
    });

    if (metadata.effort) {
      this.dispatch({
        type: 'set-effort',
        surface: input.surface,
        userId: input.userId,
        sessionId: input.sessionId,
        source: commandSource,
        approved: trustedDesktopBridge,
        text: input.text,
        payload: {
          effort: metadata.effort,
          metadata: {
            profile: metadata.profile || input.responseProfile || null,
          },
        },
      });
    }

    if (metadata.model) {
      this.dispatch({
        type: 'set-model',
        surface: input.surface,
        userId: input.userId,
        sessionId: input.sessionId,
        source: commandSource,
        approved: trustedDesktopBridge,
        connectedModelIds,
        payload: {
          model: metadata.model,
          metadata: {
            modelCatalogSource: connectedModelIds ? 'desktop-connected-models' : 'runtime-defaults',
          },
        },
      });
    }

    if (metadata.workspace || input.workspace) {
      this.dispatch({
        type: 'set-workspace',
        surface: input.surface,
        userId: input.userId,
        sessionId: input.sessionId,
        source: commandSource,
        approved: trustedDesktopBridge,
        payload: {
          workspace: metadata.workspace || input.workspace,
          metadata: {
            trustedDesktopBridge,
          },
        },
      });
    }

    return this.buildSnapshot();
  }

  private applyMutation(
    state: ZavorthRuntimeStateBusState,
    input: ZavorthRuntimeStateBusActionInput,
    source: string,
  ): { ok: boolean; pathValidated: boolean; error: string | null } {
    const now = this.now().toISOString();
    const payload = input.payload || {};
    if (input.type === 'sync-command') {
      state.session = {
        ...state.session,
        status: 'ready',
        summary: 'Session command accepted by the runtime state bus.',
        updatedAt: now,
        sessionId: clean(input.sessionId),
        userId: clean(input.userId),
        surface: clean(input.surface),
      };
      state.context = {
        ...state.context,
        status: 'ready',
        summary: 'Context projection refreshed from the latest command.',
        updatedAt: now,
      };
      return { ok: true, pathValidated: false, error: null };
    }

    if (input.type === 'set-effort') {
      const requestedLevel = normalizeEffortLevel(payload.effort);
      const effortSnapshot = this.effortControl.buildSnapshot({
        level: requestedLevel,
        request: input.text || null,
        profile: record(payload.metadata)?.profile || null,
      });
      state.effort = {
        level: effortSnapshot.effectiveLevel,
        snapshot: effortSnapshot,
        selectedAt: now,
      };
      state.gateway = {
        ...state.gateway,
        status: effortSnapshot.approval.required ? 'attention' : 'ready',
        summary: effortSnapshot.routing.routeReason,
        updatedAt: now,
      };
      return { ok: true, pathValidated: false, error: null };
    }

    if (input.type === 'set-model') {
      const model = this.readModel(payload.model, source);
      const connectedModelIds = normalizeConnectedModelIds(input.connectedModelIds, model.id);
      const connected = connectedModelIds.length
        ? connectedModelIds.includes(model.id)
        : DEFAULT_CONNECTED_MODELS.includes(model.id) || model.connected;
      if (!connected) {
        return { ok: false, pathValidated: false, error: `model_not_connected:${model.id}` };
      }
      state.model = {
        ...model,
        connected: true,
        connectedModelIds: connectedModelIds.length
          ? connectedModelIds
          : uniqueStrings([...DEFAULT_CONNECTED_MODELS, model.id]),
        selectedAt: now,
        source,
      };
      state.gateway = {
        ...state.gateway,
        status: 'ready',
        summary: `Model route selected: ${model.label}.`,
        updatedAt: now,
      };
      return { ok: true, pathValidated: false, error: null };
    }

    if (input.type === 'set-workspace') {
      const workspaceResult = this.readWorkspace(payload.workspace);
      if (!workspaceResult.ok || !workspaceResult.workspace) {
        return { ok: false, pathValidated: workspaceResult.pathValidated, error: workspaceResult.error };
      }
      state.workspace = workspaceResult.workspace;
      state.context = {
        ...state.context,
        status: 'ready',
        summary: workspaceResult.workspace.path
          ? `Workspace confined to ${workspaceResult.workspace.label}.`
          : 'Workspace is in chat/local mode with no folder scope.',
        updatedAt: now,
      };
      return { ok: true, pathValidated: workspaceResult.pathValidated, error: null };
    }

    if (input.type === 'set-permission') {
      const permission = readPermissionPatch(payload.permission);
      if (!permission) {
        return { ok: false, pathValidated: false, error: 'permission_payload_required' };
      }
      const domain = state.permissionsMatrix.domains[permission.domain];
      if (!domain) {
        return { ok: false, pathValidated: false, error: `permission_domain_unknown:${permission.domain}` };
      }
      domain.actions[permission.action] = {
        default: permission.decision,
        requiresApproval: permission.requiresApproval,
        scope: permission.scope,
        reason: permission.reason,
      };
      state.gateway = {
        ...state.gateway,
        status: permission.decision === 'block' ? 'attention' : 'ready',
        summary: `Permission ${permission.domain}.${permission.action} set to ${permission.decision}.`,
        updatedAt: now,
      };
      return { ok: true, pathValidated: false, error: null };
    }

    if (input.type === 'select-model-spec') {
      const specId = normalizeModelSpecId(record(payload.modelSpec)?.id || payload.modelSpec);
      const spec = state.modelSpec.specs.find((entry) => entry.id === specId);
      if (!spec) {
        return { ok: false, pathValidated: false, error: `model_spec_unknown:${specId || 'none'}` };
      }
      state.modelSpec = {
        ...state.modelSpec,
        selectedSpecId: spec.id,
        selectedAt: now,
      };
      state.dynamicRouting = {
        ...state.dynamicRouting,
        selected: {
          ...state.dynamicRouting.selected,
          specId: spec.id,
          reason: `Model spec selected: ${spec.label}.`,
          fallbackModelIds: [...spec.fallbackModelIds],
          estimatedCost: spec.estimatedCost,
          selectedAt: now,
        },
      };
      state.gateway = {
        ...state.gateway,
        status: 'ready',
        summary: `Model spec selected: ${spec.label}.`,
        updatedAt: now,
      };
      return { ok: true, pathValidated: false, error: null };
    }

    if (input.type === 'route-model') {
      const dynamicRouting = record(payload.dynamicRouting) || {};
      const requestedModelId = safeModelId(dynamicRouting.modelId || dynamicRouting.model || payload.model) || state.model.id;
      const connectedModelIds = normalizeConnectedModelIds(input.connectedModelIds, requestedModelId);
      const connected = connectedModelIds.length
        ? connectedModelIds.includes(requestedModelId)
        : state.model.connectedModelIds.includes(requestedModelId) || DEFAULT_CONNECTED_MODELS.includes(requestedModelId);
      if (!connected) {
        return { ok: false, pathValidated: false, error: `model_not_connected:${requestedModelId}` };
      }
      const specId = normalizeModelSpecId(dynamicRouting.specId) || state.modelSpec.selectedSpecId || 'daily';
      const route = this.readDynamicRoute(dynamicRouting, requestedModelId, specId, now);
      state.dynamicRouting = {
        ...state.dynamicRouting,
        selected: route,
      };
      state.model = {
        id: route.modelId,
        label: labelFromModelId(route.modelId),
        provider: providerFromModelId(route.modelId),
        connected: true,
        connectedModelIds: connectedModelIds.length ? connectedModelIds : state.model.connectedModelIds,
        selectedAt: now,
        source,
      };
      state.gateway = {
        ...state.gateway,
        status: 'ready',
        summary: route.reason,
        updatedAt: now,
      };
      return { ok: true, pathValidated: false, error: null };
    }

    if (input.type === 'set-provider-connection') {
      const provider = this.readProviderConnection(payload.providerConnection, now);
      if (!provider.ok || !provider.connection) {
        return { ok: false, pathValidated: false, error: provider.error };
      }
      state.dynamicRouting = {
        ...state.dynamicRouting,
        providerConnections: upsertProviderConnection(state.dynamicRouting.providerConnections, provider.connection),
      };
      state.gateway = {
        ...state.gateway,
        status: provider.connection.status === 'blocked' ? 'attention' : 'ready',
        summary: provider.connection.status === 'configured'
          ? `Provider connection configured: ${provider.connection.label}.`
          : `Provider connection needs setup: ${provider.connection.label}.`,
        updatedAt: now,
      };
      return { ok: true, pathValidated: false, error: null };
    }

    if (input.type === 'set-workspace-knowledge') {
      const knowledge = this.readWorkspaceKnowledge(payload.workspaceKnowledge, state.workspace);
      state.workspaceKnowledge = knowledge;
      state.context = {
        ...state.context,
        status: knowledge.ragSources.length > 0 ? 'ready' : state.context.status,
        summary: knowledge.ragSources.length > 0
          ? `${knowledge.ragSources.length} governed knowledge source(s) available in workspace.`
          : 'Workspace knowledge remains scoped and empty.',
        updatedAt: now,
      };
      return { ok: true, pathValidated: false, error: null };
    }

    if (input.type === 'register-personal-connector') {
      const connector = this.readPersonalConnector(payload.personalConnector, now);
      if (!connector) {
        return { ok: false, pathValidated: false, error: 'personal_connector_payload_required' };
      }
      state.personalOps = {
        connectors: upsertPersonalConnector(state.personalOps.connectors, connector),
      };
      state.context = {
        ...state.context,
        status: connector.status === 'configured' ? 'ready' : 'attention',
        summary: `${connector.label} is registered as a governed ${connector.kind} connector.`,
        updatedAt: now,
      };
      return { ok: true, pathValidated: false, error: null };
    }

    if (input.type === 'set-mcp-trust') {
      const server = this.readMcpTrustServer(payload.mcpTrust);
      if (!server) {
        return { ok: false, pathValidated: false, error: 'mcp_trust_payload_required' };
      }
      state.mcpTrust = {
        ...state.mcpTrust,
        servers: upsertMcpTrustServer(state.mcpTrust.servers, server),
      };
      state.skills = {
        ...state.skills,
        status: server.trustState === 'trusted' ? 'ready' : 'attention',
        summary: `MCP trust updated: ${server.label}.`,
        updatedAt: now,
      };
      return { ok: true, pathValidated: false, error: null };
    }

    if (input.type === 'recover-scheduled-jobs') {
      const recovery = record(payload.scheduledJobs) || {};
      const orphaned = Number(recovery.orphaned || recovery.orphanedCount || 0) || 0;
      const recoverable = Number(recovery.recoverable || recovery.recoverableCount || 0) || 0;
      state.cron = {
        ...state.cron,
        status: orphaned > 0 ? 'attention' : 'ready',
        summary: orphaned > 0
          ? `${orphaned} orphaned scheduled job(s) detected; ${recoverable} recoverable.`
          : 'Scheduled job recovery completed with no orphaned runs.',
        updatedAt: now,
        actionIds: uniqueStrings([...state.cron.actionIds, 'runtime.cron.recover']).slice(-10),
      };
      return { ok: true, pathValidated: false, error: null };
    }

    if (input.type === 'resume-stream') {
      state.streamSession = this.readStreamSession(payload.streamSession, now);
      state.session = {
        ...state.session,
        status: state.streamSession.status === 'streaming' ? 'running' : 'ready',
        summary: state.streamSession.status === 'resumable'
          ? 'Stream session can be resumed after desktop/runtime interruption.'
          : `Stream session ${state.streamSession.status}.`,
        updatedAt: now,
      };
      return { ok: true, pathValidated: false, error: null };
    }

    if (input.type === 'skill-lifecycle') {
      const skill = this.readSkill(payload.skill);
      if (!skill) return { ok: false, pathValidated: false, error: 'skill_payload_required' };
      state.skills = {
        ...state.skills,
        status: skill.status === 'blocked' || skill.status === 'quarantined' ? 'attention' : 'ready',
        summary: `Skill lifecycle updated: ${skill.name}.`,
        updatedAt: now,
        active: upsertSkill(state.skills.active, skill),
      };
      state.skillHistory = {
        entries: upsertSkillHistory(state.skillHistory.entries, {
          id: `${skill.id}:${now}`,
          skillId: skill.id,
          skillName: skill.name,
          mode: skillHistoryModeFor(skill.status),
          source: skill.source,
          receiptId: skill.lastReceiptId,
          at: now,
        }),
      };
      return { ok: true, pathValidated: false, error: null };
    }

    if (input.type === 'workboard-sync') {
      const next = applyWorkboardSync(state.workboard, payload, {
        sessionId: clean(input.sessionId) || 'desktop-main',
        source: source || 'zavorth-desktop-workboard',
        now,
        receiptId: this.idFactory('workboard-receipt'),
      });
      if (!next.ok || !next.workboard) {
        return { ok: false, pathValidated: false, error: next.error || 'workboard_sync_failed' };
      }
      state.workboard = next.workboard;
      state.agents = {
        ...state.agents,
        status: next.workboard.summary.blocked > 0 ? 'attention' : 'ready',
        summary: `Workboard synced: ${next.workboard.summary.queued} queued, ${next.workboard.summary.running} running, ${next.workboard.summary.completed} completed.`,
        updatedAt: now,
        actionIds: uniqueStrings([...state.agents.actionIds, 'runtime.workboard.sync']).slice(-10),
      };
      return { ok: true, pathValidated: false, error: null };
    }

    if (input.type === 'operate-domain') {
      const operation = normalizeDomainOperation(record(payload.domain)?.operation || record(payload.domain)?.action);
      const targetDomain = normalizeDomain(record(payload.domain)?.domain);
      if (!operation || !targetDomain) {
        return { ok: false, pathValidated: false, error: 'domain_operation_payload_required' };
      }
      if (targetDomain === 'model' || targetDomain === 'workspace' || targetDomain === 'effort') {
        return { ok: false, pathValidated: false, error: 'domain_operation_not_supported_for_selection_state' };
      }
      const current = state[targetDomain] as ZavorthRuntimeStateDomainState;
      (state as unknown as Record<string, unknown>)[targetDomain] = {
        ...current,
        status: statusForDomainOperation(operation),
        summary: summaryForDomainOperation(targetDomain, operation),
        updatedAt: now,
        actionIds: uniqueStrings([...current.actionIds, `runtime.${targetDomain}.${operation}`]).slice(-10),
      };
      return { ok: true, pathValidated: false, error: null };
    }

    if (input.type === 'surface-event' || input.type === 'domain-state') {
      const domainState = this.readDomainState(payload.domain);
      if (!domainState) return { ok: false, pathValidated: false, error: 'domain_payload_required' };
      (state as unknown as Record<string, unknown>)[domainState.domain] = {
        ...state[domainState.domain as keyof ZavorthRuntimeStateBusState],
        ...domainState,
        updatedAt: now,
      };
      return { ok: true, pathValidated: false, error: null };
    }

    return { ok: false, pathValidated: false, error: 'unsupported_runtime_state_action' };
  }

  private buildPreview(input: ZavorthRuntimeStateBusActionInput, domain: ZavorthRuntimeStateDomain): {
    mutation: string;
    requiresApproval: boolean;
    reason: string;
    blockedReason: string | null;
    pathValidated: boolean;
  } {
    if (input.type === 'set-workspace') {
      const workspace = this.readWorkspace(input.payload?.workspace);
      return {
        mutation: 'set workspace scope',
        requiresApproval: workspace.workspace?.kind === 'folder' && !this.isOperatorDesktopSelection(input),
        reason: workspace.workspace?.kind === 'folder'
          ? 'Folder confinement changes the execution boundary.'
          : 'Chat/local workspace scope is reversible.',
        blockedReason: workspace.ok ? null : workspace.error,
        pathValidated: workspace.pathValidated,
      };
    }
    if (input.type === 'set-model') {
      const model = this.readModel(input.payload?.model, clean(input.source) || 'runtime');
      const connectedModelIds = normalizeConnectedModelIds(input.connectedModelIds, model.id);
      const connected = connectedModelIds.length
        ? connectedModelIds.includes(model.id)
        : DEFAULT_CONNECTED_MODELS.includes(model.id) || model.connected;
      return {
        mutation: 'set model route',
        requiresApproval: false,
        reason: 'Model selection is limited to connected providers.',
        blockedReason: connected ? null : `model_not_connected:${model.id}`,
        pathValidated: false,
      };
    }
    if (input.type === 'set-effort') {
      const snapshot = this.effortControl.buildSnapshot({
        level: normalizeEffortLevel(input.payload?.effort),
        request: input.text || null,
      });
      return {
        mutation: 'set runtime effort',
        requiresApproval: snapshot.approval.required,
        reason: snapshot.routing.routeReason,
        blockedReason: null,
        pathValidated: false,
      };
    }
    if (input.type === 'operate-domain') {
      const rawDomain = record(input.payload?.domain);
      const operation = normalizeDomainOperation(rawDomain?.operation || rawDomain?.action);
      const targetDomain = normalizeDomain(rawDomain?.domain);
      const sensitive = operation === 'restart' || operation === 'close' || operation === 'approve' || operation === 'reject';
      return {
        mutation: targetDomain && operation
          ? `${operation} ${targetDomain}`
          : 'operate runtime domain',
        requiresApproval: sensitive,
        reason: sensitive
          ? 'This runtime operation changes lifecycle state and needs an operator receipt.'
          : 'This runtime operation is reversible and receipt-backed.',
        blockedReason: targetDomain && operation ? null : 'domain_operation_payload_required',
        pathValidated: false,
      };
    }
    if (input.type === 'set-permission') {
      const permission = readPermissionPatch(input.payload?.permission);
      const sensitive = permission?.decision === 'allow' && permission.requiresApproval === false;
      return {
        mutation: permission ? `set permission ${permission.domain}.${permission.action}` : 'set runtime permission',
        requiresApproval: sensitive,
        reason: sensitive
          ? 'Relaxing a permission requires an operator receipt.'
          : 'Permission changes are stored as runtime governance state.',
        blockedReason: permission ? null : 'permission_payload_required',
        pathValidated: false,
      };
    }
    if (input.type === 'set-provider-connection') {
      const provider = this.readProviderConnection(input.payload?.providerConnection, this.now().toISOString());
      return {
        mutation: 'set provider connection',
        requiresApproval: false,
        reason: 'Provider connection metadata is sanitized and does not execute hidden probes.',
        blockedReason: provider.ok ? null : provider.error,
        pathValidated: false,
      };
    }
    if (input.type === 'register-personal-connector') {
      return {
        mutation: 'register governed personal connector',
        requiresApproval: true,
        reason: 'Personal connectors can expose email, calendar or task data and start disabled.',
        blockedReason: this.readPersonalConnector(input.payload?.personalConnector, this.now().toISOString())
          ? null
          : 'personal_connector_payload_required',
        pathValidated: false,
      };
    }
    if (input.type === 'set-mcp-trust') {
      const server = this.readMcpTrustServer(input.payload?.mcpTrust);
      return {
        mutation: 'set MCP trust state',
        requiresApproval: server?.trustState === 'trusted',
        reason: 'MCP trust controls tool exposure and network risk.',
        blockedReason: server ? null : 'mcp_trust_payload_required',
        pathValidated: false,
      };
    }
    if (
      input.type === 'select-model-spec'
      || input.type === 'route-model'
      || input.type === 'set-workspace-knowledge'
      || input.type === 'recover-scheduled-jobs'
      || input.type === 'resume-stream'
      || input.type === 'workboard-sync'
    ) {
      return {
        mutation: input.type.replace(/-/g, ' '),
        requiresApproval: false,
        reason: input.type === 'workboard-sync'
          ? 'Desktop workboard mutations are local-first and mirrored as governed runtime tasks.'
          : 'Best-of runtime operation is receipt-backed and does not bypass governance.',
        blockedReason: null,
        pathValidated: false,
      };
    }
    return {
      mutation: `${domain} runtime state update`,
      requiresApproval: false,
      reason: 'Projection-only state sync or reversible lifecycle update.',
      blockedReason: null,
      pathValidated: false,
    };
  }

  private buildReceipt(input: {
    input: ZavorthRuntimeStateBusActionInput;
    domain: ZavorthRuntimeStateDomain;
    status: ZavorthRuntimeStateReceiptStatus;
    applied: boolean;
    source: string;
    preview: { mutation: string; requiresApproval: boolean; reason: string };
    approved: boolean;
    pathValidated: boolean;
    error: string | null;
  }): ZavorthRuntimeStateReceipt {
    const createdAt = this.now().toISOString();
    const approvalRequired = input.preview.requiresApproval;
    return {
      id: this.idFactory('runtime-receipt'),
      createdAt,
      domain: input.domain,
      action: input.input.type,
      status: input.status,
      phase: receiptPhaseFor(input.input, input.status),
      summary: input.error
        ? `Runtime state ${input.input.type} blocked: ${input.error}.`
        : input.applied
          ? `Runtime state ${input.input.type} applied.`
          : `Runtime state ${input.input.type} recorded as ${input.status}.`,
      preview: {
        mutation: input.preview.mutation,
        requiresApproval: approvalRequired,
        reason: input.preview.reason,
      },
      approval: {
        required: approvalRequired,
        approved: input.approved,
        approvalId: approvalRequired ? this.idFactory('runtime-approval') : null,
      },
      safety: {
        pathValidated: input.pathValidated,
        rawSecretsSerialized: false,
        receiptSpoofingPrevented: true,
        approvalBypassPrevented: true,
      },
      metadata: redactRecord({
        source: input.source,
        surface: input.input.surface || null,
        sessionId: input.input.sessionId || null,
        userId: input.input.userId || null,
        payload: input.input.payload || null,
      }),
    };
  }

  private toSnapshot(store: PersistedStore & { restoredFromDisk?: boolean }, restoredFromDisk: boolean): ZavorthRuntimeStateBusSnapshot {
    const lastReceipt = store.receipts[0] || null;
    const pendingApprovals = store.receipts.filter((receipt) => receipt.status === 'pending-approval').length;
    return {
      contractVersion: ZAVORTH_RUNTIME_STATE_BUS_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      restoredFromDisk,
      state: store.state,
      projections: {
        statusbar: {
          runtimeStatus: summarizeRuntimeStatus(store.state),
          modelLabel: store.state.model.label,
          effortLabel: store.state.effort.level,
          workspaceLabel: store.state.workspace.label,
          pendingApprovals,
        },
        commandBar: {
          selectedModelId: store.state.model.id,
          selectedEffort: store.state.effort.level,
          workspace: store.state.workspace,
          connectedModelIds: store.state.model.connectedModelIds.length > 0
            ? store.state.model.connectedModelIds
            : DEFAULT_CONNECTED_MODELS,
        },
        lifecycle: {
          everyImportantActionRequiresReceipt: true,
          defaultFlow: 'preview -> approval -> execution -> receipt -> learning',
          lastReceiptId: lastReceipt?.id || null,
        },
        safety: {
          uiProjectionOnly: true,
          runtimeOwnsState: true,
          importedSkillsQuarantined: store.state.skills.importedQuarantined,
          rawSecretsSerialized: false,
        },
        capabilities: buildCapabilitiesProjection(store.state, pendingApprovals),
        permissionsMatrix: store.state.permissionsMatrix,
        modelSpecs: {
          selectedSpecId: store.state.modelSpec.selectedSpecId,
          specs: store.state.modelSpec.specs,
        },
        dynamicRouting: {
          selected: store.state.dynamicRouting.selected,
          providerConnections: store.state.dynamicRouting.providerConnections,
        },
        workspaceKnowledge: store.state.workspaceKnowledge,
        personalOps: store.state.personalOps,
        mcpTrust: store.state.mcpTrust,
        skillHistory: store.state.skillHistory,
        streamSession: store.state.streamSession,
        workboard: store.state.workboard,
      },
      receipts: store.receipts.slice(0, 20),
      replay: {
        receiptCount: store.receipts.length,
        replayableReceiptIds: store.receipts.map((receipt) => receipt.id).slice(0, 100),
        lastReplayAt: store.lastReplayAt,
      },
    };
  }

  private readStore(): PersistedStore & { restoredFromDisk: boolean } {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.stateFilePath, 'utf8')) as Partial<PersistedStore>;
        if (parsed.contractVersion === ZAVORTH_RUNTIME_STATE_BUS_CONTRACT_VERSION && parsed.state) {
          return {
            contractVersion: ZAVORTH_RUNTIME_STATE_BUS_CONTRACT_VERSION,
            updatedAt: clean(parsed.updatedAt) || this.now().toISOString(),
            state: this.coerceState(parsed.state),
            receipts: Array.isArray(parsed.receipts)
              ? parsed.receipts.map((receipt) => coerceReceipt(receipt)).filter((receipt): receipt is ZavorthRuntimeStateReceipt => Boolean(receipt))
              : [],
            lastReplayAt: clean(parsed.lastReplayAt),
            restoredFromDisk: true,
          };
        }
      }
    } catch (error: any) {
      // Corrupt state falls back to a clean in-memory state; the next dispatch rewrites it.
      logger.warn('[Zavorth Runtime State Bus] parsing failed', error);
    }
    return {
      contractVersion: ZAVORTH_RUNTIME_STATE_BUS_CONTRACT_VERSION,
      updatedAt: this.now().toISOString(),
      state: this.defaultState(),
      receipts: [],
      lastReplayAt: null,
      restoredFromDisk: false,
    };
  }

  private writeStore(store: PersistedStore): void {
    fs.mkdirSync(path.dirname(this.stateFilePath), { recursive: true });
    fs.writeFileSync(this.stateFilePath, JSON.stringify({
      contractVersion: ZAVORTH_RUNTIME_STATE_BUS_CONTRACT_VERSION,
      updatedAt: store.updatedAt,
      state: store.state,
      receipts: store.receipts,
      lastReplayAt: store.lastReplayAt,
    }, null, 2), 'utf8');
  }

  private coerceState(value: unknown): ZavorthRuntimeStateBusState {
    const current = record(value) || {};
    const fallback = this.defaultState();
    const persistedModelId = clean(record(current.model)?.id) || fallback.model.id;
    const persistedConnectedModelIds = normalizeConnectedModelIds(
      record(current.model)?.connectedModelIds,
      persistedModelId,
    );
    return {
      gateway: coerceDomainState(current.gateway, fallback.gateway),
      agents: coerceDomainState(current.agents, fallback.agents),
      cron: coerceDomainState(current.cron, fallback.cron),
      context: coerceDomainState(current.context, fallback.context),
      session: {
        ...coerceDomainState(current.session, fallback.session),
        sessionId: clean(record(current.session)?.sessionId),
        userId: clean(record(current.session)?.userId),
        surface: clean(record(current.session)?.surface),
      },
      skills: {
        ...coerceDomainState(current.skills, fallback.skills),
        nativeCount: Number(record(current.skills)?.nativeCount || 0) || fallback.skills.nativeCount,
        importedQuarantined: record(current.skills)?.importedQuarantined !== false,
        active: Array.isArray(record(current.skills)?.active)
          ? (record(current.skills)?.active as unknown[]).map((skill) => this.readSkill(skill)).filter((skill): skill is ZavorthRuntimeStateSkill => Boolean(skill))
          : [],
      },
      model: {
        ...fallback.model,
        ...(record(current.model) || {}),
        id: persistedModelId,
        label: clean(record(current.model)?.label) || fallback.model.label,
        provider: clean(record(current.model)?.provider) || fallback.model.provider,
        connected: record(current.model)?.connected !== false,
        connectedModelIds: persistedConnectedModelIds.length > 0
          ? persistedConnectedModelIds
          : fallback.model.connectedModelIds,
        selectedAt: clean(record(current.model)?.selectedAt) || fallback.model.selectedAt,
        source: clean(record(current.model)?.source) || fallback.model.source,
      },
      workspace: this.readWorkspace(current.workspace).workspace || fallback.workspace,
      effort: fallback.effort.snapshot.contractVersion === record(record(current.effort)?.snapshot)?.contractVersion
        ? {
            level: clean(record(current.effort)?.level) || fallback.effort.level,
            snapshot: record(current.effort)?.snapshot as ZavorthRuntimeStateBusState['effort']['snapshot'],
            selectedAt: clean(record(current.effort)?.selectedAt) || fallback.effort.selectedAt,
          }
        : fallback.effort,
      permissionsMatrix: coercePermissionsMatrix(current.permissionsMatrix, fallback.permissionsMatrix),
      modelSpec: {
        selectedSpecId: normalizeModelSpecId(record(current.modelSpec)?.selectedSpecId) || fallback.modelSpec.selectedSpecId,
        selectedAt: clean(record(current.modelSpec)?.selectedAt) || fallback.modelSpec.selectedAt,
        specs: DEFAULT_MODEL_SPECS,
      },
      dynamicRouting: {
        selected: coerceDynamicRoute(record(current.dynamicRouting)?.selected, fallback.dynamicRouting.selected),
        providerConnections: Array.isArray(record(current.dynamicRouting)?.providerConnections)
          ? (record(current.dynamicRouting)?.providerConnections as unknown[])
              .map((entry) => coerceProviderConnection(entry))
              .filter((entry): entry is ZavorthRuntimeProviderConnection => Boolean(entry))
          : fallback.dynamicRouting.providerConnections,
      },
      workspaceKnowledge: coerceWorkspaceKnowledge(current.workspaceKnowledge, fallback.workspaceKnowledge),
      personalOps: {
        connectors: Array.isArray(record(current.personalOps)?.connectors)
          ? (record(current.personalOps)?.connectors as unknown[])
              .map((entry) => coercePersonalConnector(entry))
              .filter((entry): entry is ZavorthRuntimePersonalConnector => Boolean(entry))
          : fallback.personalOps.connectors,
      },
      mcpTrust: {
        ...fallback.mcpTrust,
        servers: Array.isArray(record(current.mcpTrust)?.servers)
          ? (record(current.mcpTrust)?.servers as unknown[])
              .map((entry) => coerceMcpTrustServer(entry))
              .filter((entry): entry is ZavorthRuntimeMcpTrustServer => Boolean(entry))
          : fallback.mcpTrust.servers,
      },
      skillHistory: {
        entries: Array.isArray(record(current.skillHistory)?.entries)
          ? (record(current.skillHistory)?.entries as unknown[])
              .map((entry) => coerceSkillHistoryEntry(entry))
              .filter((entry): entry is ZavorthRuntimeSkillHistoryEntry => Boolean(entry))
          : fallback.skillHistory.entries,
      },
      streamSession: coerceStreamSession(current.streamSession, fallback.streamSession),
      workboard: coerceWorkboardState(current.workboard, fallback.workboard),
    };
  }

  private defaultState(): ZavorthRuntimeStateBusState {
    const now = this.now().toISOString();
    const effortSnapshot = this.effortControl.buildSnapshot({ level: 'standard' });
    return {
      gateway: domainState('gateway', 'offline', 'Gateway state not attached yet.', now),
      agents: domainState('agents', 'ready', 'Agent plane ready for governed runs.', now),
      cron: domainState('cron', 'ready', 'Cron plane idle.', now),
      context: domainState('context', 'ready', 'Context plane ready.', now),
      session: {
        ...domainState('session', 'ready', 'Session plane ready.', now),
        sessionId: null,
        userId: null,
        surface: null,
      },
      skills: {
        ...domainState('skills', 'ready', 'Native skills enabled; imported skills remain quarantined.', now),
        nativeCount: 0,
        importedQuarantined: true,
        active: [],
      },
      model: {
        id: 'zavorth:core',
        label: 'Zavorth Core',
        provider: 'Zavorth',
        connected: true,
        connectedModelIds: DEFAULT_CONNECTED_MODELS,
        selectedAt: now,
        source: 'default',
      },
      workspace: {
        id: 'local',
        label: 'Local',
        kind: 'local',
        path: null,
        confinement: 'runtime-local',
        locked: true,
      },
      effort: {
        level: effortSnapshot.effectiveLevel,
        snapshot: effortSnapshot,
        selectedAt: now,
      },
      permissionsMatrix: buildDefaultPermissionsMatrix(),
      modelSpec: {
        selectedSpecId: 'daily',
        selectedAt: now,
        specs: DEFAULT_MODEL_SPECS,
      },
      dynamicRouting: {
        selected: {
          intent: 'daily',
          providerId: 'zavorth',
          modelId: 'zavorth:core',
          specId: 'daily',
          reason: 'Default daily governed runtime route.',
          fallbackModelIds: ['zavorth:governed'],
          estimatedCost: 'medium',
          risk: 'low',
          selectedAt: now,
        },
        providerConnections: [],
      },
      workspaceKnowledge: {
        workspaceId: 'local',
        activeWorkspaceLabel: 'Local',
        isolation: 'runtime-local',
        trustedWorkspaceIds: [],
        allowedPaths: [],
        ragSources: [],
        untrustedContextWrapping: true,
      },
      personalOps: {
        connectors: buildDefaultPersonalConnectors(),
      },
      mcpTrust: {
        servers: [],
        policy: {
          externalServersRequireTrust: true,
          quarantinedToolsHidden: true,
          privateNetworkBlockedByDefault: true,
        },
      },
      skillHistory: {
        entries: [],
      },
      streamSession: {
        sessionId: null,
        status: 'idle',
        resumeToken: null,
        updatedAt: now,
        resumable: true,
      },
      workboard: defaultWorkboardState(now),
    };
  }

  private readModel(value: unknown, source: string): ZavorthRuntimeStateBusState['model'] {
    const now = this.now().toISOString();
    if (typeof value === 'string') {
      return {
        id: safeModelId(value) || 'zavorth:core',
        label: labelFromModelId(value),
        provider: providerFromModelId(value),
        connected: DEFAULT_CONNECTED_MODELS.includes(value),
        connectedModelIds: uniqueStrings([...DEFAULT_CONNECTED_MODELS, safeModelId(value) || 'zavorth:core']),
        selectedAt: now,
        source,
      };
    }
    const raw = record(value) || {};
    const id = safeModelId(raw.id || raw.model || raw.value || 'zavorth:core') || 'zavorth:core';
    const connectedModelIds = normalizeConnectedModelIds(raw.connectedModelIds, id);
    return {
      id,
      label: clean(raw.label || raw.name) || labelFromModelId(id),
      provider: clean(raw.provider || raw.family) || providerFromModelId(id),
      connected: raw.connected !== false,
      connectedModelIds: connectedModelIds.length > 0
        ? connectedModelIds
        : uniqueStrings([...DEFAULT_CONNECTED_MODELS, id]),
      selectedAt: now,
      source,
    };
  }

  private readWorkspace(value: unknown): {
    ok: boolean;
    workspace: ZavorthRuntimeStateWorkspace | null;
    pathValidated: boolean;
    error: string | null;
  } {
    const raw = typeof value === 'string'
      ? { id: value, label: value, kind: value === 'chat' ? 'chat' : 'local', path: null }
      : record(value) || {};
    const kind = normalizeWorkspaceKind(raw.kind);
    const pathValue = clean(raw.path);
    const pathResult = this.validateWorkspacePath(pathValue, kind);
    if (!pathResult.ok) {
      return { ok: false, workspace: null, pathValidated: pathResult.pathValidated, error: pathResult.error };
    }
    const label = clean(raw.label || raw.shortLabel || pathResult.label) || (kind === 'chat' ? 'Chats' : 'Local');
    const confinement = normalizeConfinement(raw.confinement, kind);
    return {
      ok: true,
      pathValidated: pathResult.pathValidated,
      error: null,
      workspace: {
        id: clean(raw.id) || (pathResult.path ? `folder:${pathResult.path}` : kind),
        label,
        kind,
        path: pathResult.path,
        confinement,
        locked: raw.locked !== false,
      },
    };
  }

  private validateWorkspacePath(pathValue: string | null, kind: ZavorthRuntimeStateWorkspace['kind']): {
    ok: boolean;
    path: string | null;
    pathValidated: boolean;
    label: string | null;
    error: string | null;
  } {
    if (!pathValue) {
      return { ok: true, path: null, pathValidated: kind !== 'folder', label: null, error: null };
    }
    const resolved = safeResolve(pathValue);
    if (!resolved) {
      return { ok: false, path: null, pathValidated: false, label: null, error: 'workspace_path_invalid' };
    }
    const root = path.parse(resolved).root;
    if (resolved === root || BROAD_WINDOWS_ROOT_PATTERN.test(resolved)) {
      return { ok: false, path: null, pathValidated: true, label: null, error: 'workspace_path_too_broad' };
    }
    if (resolved.toLowerCase() === path.resolve(os.homedir()).toLowerCase()) {
      return { ok: false, path: null, pathValidated: true, label: null, error: 'workspace_path_too_broad' };
    }
    if (SYSTEM_WORKSPACE_PATH_PATTERN.test(resolved)) {
      return { ok: false, path: null, pathValidated: true, label: null, error: 'workspace_path_system_blocked' };
    }
    if (SENSITIVE_WORKSPACE_PATH_PATTERN.test(resolved)) {
      return { ok: false, path: null, pathValidated: true, label: null, error: 'workspace_path_sensitive_blocked' };
    }
    const realResolved = safeRealPath(resolved);
    if (this.allowedWorkspaceRoots.length > 0 && !this.allowedWorkspaceRoots.some((rootPath) => {
      const realRoot = safeRealPath(rootPath);
      return isPathInside(resolved, rootPath) && (!realResolved || !realRoot || isPathInside(realResolved, realRoot));
    })) {
      return { ok: false, path: null, pathValidated: true, label: null, error: 'workspace_path_outside_allowed_roots' };
    }
    return {
      ok: true,
      path: resolved,
      pathValidated: true,
      label: path.basename(resolved),
      error: null,
    };
  }

  private isOperatorDesktopSelection(input: ZavorthRuntimeStateBusActionInput): boolean {
    return clean(input.source) === 'zavorth-desktop-bridge';
  }

  private readDynamicRoute(
    value: RuntimeRecord,
    modelId: string,
    specId: string,
    selectedAt: string,
  ): ZavorthRuntimeDynamicRoute {
    const providerId = safeId(value.providerId || value.provider || providerFromModelId(modelId)) || 'zavorth';
    const intent = safeId(value.intent || specId || 'daily') || 'daily';
    const fallbackModelIds = Array.isArray(value.fallbackModelIds)
      ? value.fallbackModelIds.map((entry) => safeModelId(entry)).filter((entry): entry is string => Boolean(entry))
      : DEFAULT_MODEL_SPECS.find((spec) => spec.id === specId)?.fallbackModelIds || ['zavorth:governed'];
    return {
      intent,
      providerId,
      modelId,
      specId,
      reason: clean(value.reason) || `Dynamic route selected ${modelId} for ${intent}.`,
      fallbackModelIds: uniqueStrings(fallbackModelIds),
      estimatedCost: normalizeCost(value.estimatedCost),
      risk: normalizeRisk(value.risk),
      selectedAt,
    };
  }

  private readProviderConnection(value: unknown, updatedAt: string): {
    ok: boolean;
    connection: ZavorthRuntimeProviderConnection | null;
    error: string | null;
  } {
    const raw = record(value);
    if (!raw) return { ok: false, connection: null, error: 'provider_connection_payload_required' };
    const id = safeId(raw.providerId || raw.id);
    if (!id) return { ok: false, connection: null, error: 'provider_connection_id_required' };
    const targetUrl = clean(raw.targetUrl || raw.baseUrl || raw.url);
    const network = evaluateNetworkTarget(id, targetUrl);
    if (!network.ok) {
      return { ok: false, connection: null, error: 'network_target_blocked' };
    }
    const label = clean(raw.label || raw.name) || formatModelLabel(id.replace(/[-_]+/g, ' '));
    const catalogConfigured = raw.status === 'configured' || raw.defaultRouteAllowed === true || raw.liveReady === true;
    return {
      ok: true,
      error: null,
      connection: {
        id,
        label,
        status: targetUrl || catalogConfigured ? 'configured' : 'needs-setup',
        targetHost: network.targetHost,
        localLoopback: network.localLoopback,
        defaultRouteAllowed: targetUrl ? network.ok : catalogConfigured,
        blockReason: null,
        updatedAt,
      },
    };
  }

  private readWorkspaceKnowledge(
    value: unknown,
    workspace: ZavorthRuntimeStateWorkspace,
  ): ZavorthRuntimeWorkspaceKnowledge {
    const raw = record(value) || {};
    const sources = Array.isArray(raw.ragSources)
      ? raw.ragSources
          .map((entry) => record(entry))
          .filter((entry): entry is RuntimeRecord => Boolean(entry))
          .map((entry) => ({
            id: safeId(entry.id || entry.label) || 'source',
            kind: normalizeKnowledgeKind(entry.kind),
            label: clean(entry.label || entry.name) || 'Knowledge source',
            trusted: entry.trusted === true,
          }))
          .slice(0, 30)
      : [];
    return {
      workspaceId: clean(raw.workspaceId) || workspace.id,
      activeWorkspaceLabel: clean(raw.activeWorkspaceLabel || raw.label) || workspace.label,
      isolation: workspace.confinement === 'none' ? 'chat' : workspace.confinement,
      trustedWorkspaceIds: Array.isArray(raw.trustedWorkspaceIds)
        ? raw.trustedWorkspaceIds.map((entry) => safeId(entry)).filter(Boolean)
        : [],
      allowedPaths: Array.isArray(raw.allowedPaths)
        ? raw.allowedPaths.map((entry) => safeResolve(entry)).filter((entry): entry is string => Boolean(entry)).slice(0, 50)
        : [],
      ragSources: sources,
      untrustedContextWrapping: true,
    };
  }

  private readPersonalConnector(value: unknown, now: string): ZavorthRuntimePersonalConnector | null {
    const raw = record(value);
    if (!raw) return null;
    const kind = normalizePersonalConnectorKind(raw.kind);
    const id = safeId(raw.id || `${kind}:primary`);
    if (!id) return null;
    const configured = raw.configured === true || raw.status === 'configured';
    return {
      id,
      kind,
      label: clean(raw.label || raw.name) || formatModelLabel(id.replace(/[:_-]+/g, ' ')),
      provider: safeId(raw.provider) || null,
      accountEmailDomain: emailDomain(raw.accountEmail),
      status: configured ? 'configured' : normalizePersonalConnectorStatus(raw.status),
      enabled: raw.enabled === true && configured,
      readAllowed: configured,
      draftAllowed: configured,
      sendRequiresApproval: true,
      writeRequiresApproval: true,
      lastReceiptId: clean(raw.lastReceiptId) || `personal-connector:${id}:${now}`,
    };
  }

  private readMcpTrustServer(value: unknown): ZavorthRuntimeMcpTrustServer | null {
    const raw = record(value);
    if (!raw) return null;
    const id = safeId(raw.id || raw.label);
    if (!id) return null;
    const trustState = normalizeMcpTrustState(raw.trustState);
    const toolNames = Array.isArray(raw.toolNames)
      ? raw.toolNames.map((entry) => safeId(entry)).filter(Boolean)
      : [];
    return {
      id,
      label: clean(raw.label || raw.name) || formatModelLabel(id.replace(/[:_-]+/g, ' ')),
      origin: clean(raw.origin) || 'unknown',
      trustState,
      toolNames,
      risk: trustState === 'trusted' ? 'low' : trustState === 'review' ? 'medium' : 'high',
      networkAccess: trustState === 'trusted' ? 'restricted' : 'blocked',
      exposedToModel: trustState === 'trusted',
      lastReceiptId: clean(raw.lastReceiptId),
    };
  }

  private readStreamSession(value: unknown, now: string): ZavorthRuntimeStreamSession {
    const raw = record(value) || {};
    return {
      sessionId: clean(raw.sessionId),
      status: normalizeStreamStatus(raw.status),
      resumeToken: clean(raw.resumeToken),
      updatedAt: now,
      resumable: true,
    };
  }

  private readSkill(value: unknown): ZavorthRuntimeStateSkill | null {
    const raw = record(value);
    if (!raw) return null;
    const id = safeId(raw.id || raw.name);
    const name = clean(raw.name || raw.id);
    if (!id || !name) return null;
    const source = normalizeSkillSource(raw.source);
    return {
      id,
      name,
      source,
      status: normalizeSkillStatus(raw.status, source),
      lastReceiptId: clean(raw.lastReceiptId),
    };
  }

  private readDomainState(value: unknown): ZavorthRuntimeStateDomainState | null {
    const raw = record(value);
    const domain = normalizeDomain(raw?.domain);
    if (!raw || !domain) return null;
    return {
      domain,
      status: normalizeStatus(raw.status),
      summary: clean(raw.summary) || `${domain} state updated.`,
      updatedAt: this.now().toISOString(),
      actionIds: Array.isArray(raw.actionIds) ? raw.actionIds.map((entry) => safeId(entry)).filter(Boolean) : [],
    };
  }
}

function emailDomain(value: unknown): string | null {
  const email = clean(value);
  const domain = email && email.includes('@') ? email.split('@').pop() : null;
  return domain ? safeId(domain) : null;
}

function domainForAction(input: ZavorthRuntimeStateBusActionInput): ZavorthRuntimeStateDomain {
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
  const domain = normalizeDomain(record(input.payload?.domain)?.domain);
  return domain || 'gateway';
}

function domainState(
  domain: ZavorthRuntimeStateDomain,
  status: ZavorthRuntimeStateStatus,
  summary: string,
  updatedAt: string,
): ZavorthRuntimeStateDomainState {
  return { domain, status, summary, updatedAt, actionIds: [] };
}

function coerceDomainState(value: unknown, fallback: ZavorthRuntimeStateDomainState): ZavorthRuntimeStateDomainState {
  const raw = record(value) || {};
  return {
    domain: normalizeDomain(raw.domain) || fallback.domain,
    status: normalizeStatus(raw.status),
    summary: clean(raw.summary) || fallback.summary,
    updatedAt: clean(raw.updatedAt) || fallback.updatedAt,
    actionIds: Array.isArray(raw.actionIds) ? raw.actionIds.map((entry) => safeId(entry)).filter(Boolean) : [],
  };
}

function coerceReceipt(value: unknown): ZavorthRuntimeStateReceipt | null {
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

function summarizeRuntimeStatus(state: ZavorthRuntimeStateBusState): ZavorthRuntimeStateStatus {
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

function buildDefaultPermissionsMatrix(): ZavorthRuntimePermissionsMatrix {
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

function buildDefaultPersonalConnectors(): ZavorthRuntimePersonalConnector[] {
  return [
    personalConnector('email:primary', 'email', 'Email'),
    personalConnector('calendar:primary', 'calendar', 'Calendar'),
    personalConnector('tasks:primary', 'task', 'Tasks'),
  ];
}

function personalConnector(
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

function buildCapabilitiesProjection(
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

function coercePermissionsMatrix(value: unknown, fallback: ZavorthRuntimePermissionsMatrix): ZavorthRuntimePermissionsMatrix {
  const raw = record(value);
  if (!raw || Number(raw.version) !== 1 || !record(raw.domains)) {
    return fallback;
  }
  return fallback;
}

function coerceDynamicRoute(value: unknown, fallback: ZavorthRuntimeDynamicRoute): ZavorthRuntimeDynamicRoute {
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

function coerceProviderConnection(value: unknown): ZavorthRuntimeProviderConnection | null {
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

function coerceWorkspaceKnowledge(value: unknown, fallback: ZavorthRuntimeWorkspaceKnowledge): ZavorthRuntimeWorkspaceKnowledge {
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

function coercePersonalConnector(value: unknown): ZavorthRuntimePersonalConnector | null {
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

function coerceMcpTrustServer(value: unknown): ZavorthRuntimeMcpTrustServer | null {
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

function coerceSkillHistoryEntry(value: unknown): ZavorthRuntimeSkillHistoryEntry | null {
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

function coerceStreamSession(value: unknown, fallback: ZavorthRuntimeStreamSession): ZavorthRuntimeStreamSession {
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

function readPermissionPatch(value: unknown): {
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

function normalizePermissionDecision(value: unknown): 'allow' | 'approval' | 'block' | 'configure' {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'allow' || normalized === 'approval' || normalized === 'block' || normalized === 'configure') {
    return normalized;
  }
  return 'approval';
}

function normalizePermissionScope(value: unknown): 'global' | 'workspace' | 'provider' | 'connector' | 'mcp' | 'skill' {
  const normalized = clean(value)?.toLowerCase();
  if (
    normalized === 'global'
    || normalized === 'workspace'
    || normalized === 'provider'
    || normalized === 'connector'
    || normalized === 'mcp'
    || normalized === 'skill'
  ) {
    return normalized;
  }
  return 'global';
}

function normalizeModelSpecId(value: unknown): ZavorthRuntimeModelSpec['id'] | null {
  const normalized = safeId(value);
  if (
    normalized === 'daily'
    || normalized === 'coding'
    || normalized === 'research'
    || normalized === 'local-private'
    || normalized === 'budget'
  ) {
    return normalized;
  }
  return null;
}

function normalizeCost(value: unknown): 'low' | 'medium' | 'high' {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
    return normalized;
  }
  return 'medium';
}

function normalizeRisk(value: unknown): 'low' | 'medium' | 'high' {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
    return normalized;
  }
  return 'medium';
}

function normalizeKnowledgeKind(value: unknown): 'document' | 'web' | 'email' | 'memory' {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'document' || normalized === 'web' || normalized === 'email' || normalized === 'memory') {
    return normalized;
  }
  return 'document';
}

function normalizeWorkspaceIsolation(
  value: unknown,
  fallback: ZavorthRuntimeWorkspaceKnowledge['isolation'],
): ZavorthRuntimeWorkspaceKnowledge['isolation'] {
  const normalized = clean(value)?.toLowerCase();
  if (
    normalized === 'chat'
    || normalized === 'runtime-local'
    || normalized === 'folder'
    || normalized === 'project'
    || normalized === 'zavorth-local'
  ) {
    return normalized;
  }
  return fallback;
}

function normalizePersonalConnectorKind(value: unknown): ZavorthRuntimePersonalConnector['kind'] {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'calendar' || normalized === 'task') return normalized;
  return 'email';
}

function normalizePersonalConnectorStatus(value: unknown): ZavorthRuntimePersonalConnector['status'] {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'configured' || normalized === 'needs-setup' || normalized === 'blocked') return normalized;
  return 'disabled';
}

function normalizeProviderConnectionStatus(value: unknown): ZavorthRuntimeProviderConnection['status'] {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'configured' || normalized === 'needs-setup' || normalized === 'blocked') return normalized;
  return 'needs-setup';
}

function normalizeMcpTrustState(value: unknown): ZavorthRuntimeMcpTrustServer['trustState'] {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'trusted' || normalized === 'review') return normalized;
  return 'blocked';
}

function normalizeStreamStatus(value: unknown): ZavorthRuntimeStreamSession['status'] {
  const normalized = clean(value)?.toLowerCase();
  if (
    normalized === 'idle'
    || normalized === 'streaming'
    || normalized === 'resumable'
    || normalized === 'completed'
    || normalized === 'failed'
  ) {
    return normalized;
  }
  return 'idle';
}

function normalizeSkillHistoryMode(value: unknown): ZavorthRuntimeSkillHistoryEntry['mode'] {
  const normalized = clean(value)?.toLowerCase();
  if (
    normalized === 'manual'
    || normalized === 'always-applied'
    || normalized === 'auto-selected'
    || normalized === 'blocked'
    || normalized === 'approved'
    || normalized === 'executed'
  ) {
    return normalized;
  }
  return 'auto-selected';
}

function skillHistoryModeFor(status: ZavorthRuntimeStateSkill['status']): ZavorthRuntimeSkillHistoryEntry['mode'] {
  if (status === 'approved') return 'approved';
  if (status === 'executing') return 'executed';
  if (status === 'blocked' || status === 'quarantined') return 'blocked';
  if (status === 'preview') return 'manual';
  return 'auto-selected';
}

function upsertProviderConnection(
  entries: ZavorthRuntimeProviderConnection[],
  entry: ZavorthRuntimeProviderConnection,
): ZavorthRuntimeProviderConnection[] {
  return [entry, ...entries.filter((candidate) => candidate.id !== entry.id)].slice(0, 30);
}

function upsertPersonalConnector(
  entries: ZavorthRuntimePersonalConnector[],
  entry: ZavorthRuntimePersonalConnector,
): ZavorthRuntimePersonalConnector[] {
  return [entry, ...entries.filter((candidate) => candidate.id !== entry.id)].slice(0, 20);
}

function upsertMcpTrustServer(
  entries: ZavorthRuntimeMcpTrustServer[],
  entry: ZavorthRuntimeMcpTrustServer,
): ZavorthRuntimeMcpTrustServer[] {
  return [entry, ...entries.filter((candidate) => candidate.id !== entry.id)].slice(0, 40);
}

function upsertSkillHistory(
  entries: ZavorthRuntimeSkillHistoryEntry[],
  entry: ZavorthRuntimeSkillHistoryEntry,
): ZavorthRuntimeSkillHistoryEntry[] {
  return [entry, ...entries.filter((candidate) => candidate.id !== entry.id)].slice(0, 80);
}

function evaluateNetworkTarget(providerId: string, targetUrl: string | null): {
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
  } catch (error: any) {
    logger.warn('[Zavorth Runtime State Bus] lifecycle operation failed', error);
    return { ok: false, targetHost: null, localLoopback: false };
  }
}

function isLocalProviderId(providerId: string): boolean {
  return /^(ollama|lm-studio|lmstudio|vllm|local|aigateway|custom)/i.test(providerId);
}

function normalizeEffortLevel(value: unknown): string {
  const normalized = clean(value)?.toLowerCase().replace(/_/g, '-');
  if (normalized === 'medium') return 'standard';
  if (normalized === 'ultra' || normalized === 'altissimo' || normalized === 'altissima') return 'ultra-code';
  return normalized || 'standard';
}

function normalizeWorkspaceKind(value: unknown): ZavorthRuntimeStateWorkspace['kind'] {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'chat' || normalized === 'folder' || normalized === 'project' || normalized === 'zavorth') {
    return normalized;
  }
  return 'local';
}

function normalizeConfinement(value: unknown, kind: ZavorthRuntimeStateWorkspace['kind']): ZavorthRuntimeStateWorkspace['confinement'] {
  const normalized = clean(value)?.toLowerCase();
  if (
    normalized === 'none'
    || normalized === 'runtime-local'
    || normalized === 'folder'
    || normalized === 'project'
    || normalized === 'zavorth-local'
  ) {
    return normalized;
  }
  if (kind === 'folder') return 'folder';
  if (kind === 'project') return 'project';
  if (kind === 'zavorth') return 'zavorth-local';
  if (kind === 'chat') return 'none';
  return 'runtime-local';
}

function normalizeDomain(value: unknown): ZavorthRuntimeStateDomain | null {
  const normalized = clean(value)?.toLowerCase();
  if (
    normalized === 'gateway'
    || normalized === 'agents'
    || normalized === 'cron'
    || normalized === 'context'
    || normalized === 'session'
    || normalized === 'skills'
    || normalized === 'model'
    || normalized === 'workspace'
    || normalized === 'effort'
  ) {
    return normalized;
  }
  return null;
}

function normalizeStatus(value: unknown): ZavorthRuntimeStateStatus {
  const normalized = clean(value)?.toLowerCase();
  if (
    normalized === 'offline'
    || normalized === 'ready'
    || normalized === 'running'
    || normalized === 'paused'
    || normalized === 'attention'
    || normalized === 'blocked'
  ) {
    return normalized;
  }
  return 'ready';
}

function normalizeReceiptStatus(value: unknown): ZavorthRuntimeStateReceiptStatus {
  const normalized = clean(value)?.toLowerCase();
  if (
    normalized === 'preview'
    || normalized === 'pending-approval'
    || normalized === 'applied'
    || normalized === 'blocked'
    || normalized === 'failed'
    || normalized === 'noop'
  ) {
    return normalized;
  }
  return 'applied';
}

function normalizeSkillSource(value: unknown): ZavorthRuntimeStateSkill['source'] {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'native' || normalized === 'imported' || normalized === 'preview' || normalized === 'review') {
    return normalized;
  }
  return 'unknown';
}

function normalizeSkillStatus(value: unknown, source: ZavorthRuntimeStateSkill['source']): ZavorthRuntimeStateSkill['status'] {
  const normalized = clean(value)?.toLowerCase();
  if (
    normalized === 'available'
    || normalized === 'preview'
    || normalized === 'approved'
    || normalized === 'executing'
    || normalized === 'blocked'
    || normalized === 'quarantined'
  ) {
    return normalized;
  }
  return source === 'imported' ? 'quarantined' : 'available';
}

function normalizeDomainOperation(value: unknown): 'open' | 'pause' | 'restart' | 'close' | 'sync' | 'approve' | 'reject' | null {
  const normalized = clean(value)?.toLowerCase();
  if (
    normalized === 'open'
    || normalized === 'pause'
    || normalized === 'restart'
    || normalized === 'close'
    || normalized === 'sync'
    || normalized === 'approve'
    || normalized === 'reject'
  ) {
    return normalized;
  }
  return null;
}

function statusForDomainOperation(operation: NonNullable<ReturnType<typeof normalizeDomainOperation>>): ZavorthRuntimeStateStatus {
  if (operation === 'pause') return 'paused';
  if (operation === 'restart') return 'running';
  if (operation === 'close') return 'offline';
  return 'ready';
}

function summaryForDomainOperation(
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

function receiptPhaseFor(
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

function upsertSkill(skills: ZavorthRuntimeStateSkill[], skill: ZavorthRuntimeStateSkill): ZavorthRuntimeStateSkill[] {
  const next = skills.filter((entry) => entry.id !== skill.id);
  next.unshift(skill);
  return next.slice(0, 30);
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function normalizeConnectedModelIds(value: unknown, selectedModelId?: string | null): string[] {
  const values = Array.isArray(value)
    ? value.map((entry) => safeModelId(entry)).filter((entry): entry is string => Boolean(entry))
    : [];
  if (selectedModelId && values.includes(selectedModelId)) {
    return uniqueStrings(values);
  }
  return uniqueStrings(values);
}

function safeResolve(value: unknown): string | null {
  const text = clean(value);
  if (!text || /[\0\r\n]/.test(text)) return null;
  return path.resolve(text);
}

function safeRealPath(value: string): string | null {
  try {
    return fs.realpathSync.native(value);
  } catch (error: any) {
    try {
      return fs.realpathSync(value);
    } catch (error: any) { logger.warn('[Zavorth Runtime State Bus] operation failed', error); return null; }
  }
}

function isPathInside(candidate: string, root: string): boolean {
  const relative = path.relative(path.resolve(root).toLowerCase(), path.resolve(candidate).toLowerCase());
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function safeModelId(value: unknown): string | null {
  const text = clean(value);
  if (!text) return null;
  return text.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-').replace(/^-+|-+$/g, '');
}

function labelFromModelId(value: unknown): string {
  const id = clean(value) || 'zavorth:core';
  if (id === 'zavorth:core') return 'Zavorth Core';
  if (id === 'zavorth:governed') return 'Governed Runtime';
  return formatModelLabel(id.split(':').pop()?.replace(/[-_]+/g, ' ') || id);
}

function formatModelLabel(value: string): string {
  const normalized = value.trim();
  if (/^gpt\b/i.test(normalized)) {
    return normalized.replace(/^gpt\b/i, 'GPT').replace(/\s+/g, '-');
  }
  return normalized.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function providerFromModelId(value: unknown): string {
  const id = clean(value) || 'zavorth:core';
  const provider = id.includes(':') ? id.split(':')[0] : 'runtime';
  if (provider === 'zavorth') return 'Zavorth';
  if (provider === 'openai') return 'OpenAI';
  if (provider === 'anthropic') return 'Anthropic';
  if (provider === 'google') return 'Google';
  if (provider === 'local') return 'Local';
  return provider;
}

function safeId(value: unknown): string {
  const text = clean(value);
  if (!text) return '';
  return text.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-').replace(/^-+|-+$/g, '');
}

function record(value: unknown): RuntimeRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RuntimeRecord : null;
}

function clean(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function redactRecord(value: RuntimeRecord): RuntimeRecord {
  return JSON.parse(redact(JSON.stringify(value))) as RuntimeRecord;
}

function redact(value: string): string {
  return value
    .replace(/\b(sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{8,}|AIza[A-Za-z0-9_-]{12,})\b/g, '[redacted-secret]')
    .replace(/"((?:token|secret|password|api[_-]?key))"\s*:\s*"[^"]*"/gi, '"$1":"[redacted]"')
    .replace(/\b(token|secret|password|api[_-]?key)\s*[:=]\s*[^,\s"}]+/gi, '$1=[redacted]');
}

function defaultWorkboardState(now: string): ZavorthRuntimeWorkboardState {
  return {
    updatedAt: now,
    source: null,
    selectedTaskId: null,
    selectedTask: null,
    sessions: [],
    tasks: [],
    workers: [],
    receipts: [],
    boards: [],
    summary: {
      sessions: 0,
      queued: 0,
      running: 0,
      completed: 0,
      blocked: 0,
    },
    safety: {
      sqliteDurable: true,
      mutationRequiresApproval: true,
      retryBounded: true,
      spawnDepthBounded: true,
    },
  };
}

function coerceWorkboardState(value: unknown, fallback: ZavorthRuntimeWorkboardState): ZavorthRuntimeWorkboardState {
  const raw = record(value);
  if (!raw) return fallback;
  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks.map((entry) => coerceWorkboardTask(entry)).filter((entry): entry is ZavorthRuntimeWorkboardTask => Boolean(entry))
    : fallback.tasks;
  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions.map((entry) => {
      const item = record(entry) || {};
      const sessionId = clean(item.sessionId) || clean(item.id);
      if (!sessionId) return null;
      return {
        sessionId,
        objective: clean(item.objective) || 'Desktop workboard session',
        status: clean(item.status) || 'running',
        maxDepth: Math.max(1, Number(item.maxDepth || 3) || 3),
        maxChildren: Math.max(1, Number(item.maxChildren || 8) || 8),
      };
    }).filter((entry): entry is ZavorthRuntimeWorkboardState['sessions'][number] => Boolean(entry))
    : fallback.sessions;
  return {
    updatedAt: clean(raw.updatedAt) || fallback.updatedAt,
    source: clean(raw.source),
    selectedTaskId: clean(raw.selectedTaskId),
    selectedTask: coerceWorkboardTask(raw.selectedTask),
    sessions,
    tasks,
    workers: Array.isArray(raw.workers)
      ? raw.workers.map((entry) => {
        const item = record(entry) || {};
        const workerId = clean(item.workerId) || clean(item.id);
        if (!workerId) return null;
        const status = clean(item.status);
        return {
          workerId,
          status: status === 'busy' || status === 'expired' ? status : 'idle',
          currentTaskId: clean(item.currentTaskId),
        };
      }).filter((entry): entry is ZavorthRuntimeWorkboardState['workers'][number] => Boolean(entry))
      : fallback.workers,
    receipts: Array.isArray(raw.receipts)
      ? raw.receipts.map((entry) => {
        const item = record(entry) || {};
        const receiptId = clean(item.receiptId) || clean(item.id);
        if (!receiptId) return null;
        return {
          receiptId,
          action: clean(item.action) || 'workboard-sync',
          taskId: clean(item.taskId),
          workerId: clean(item.workerId),
          status: clean(item.status) || 'applied',
        };
      }).filter((entry): entry is ZavorthRuntimeWorkboardState['receipts'][number] => Boolean(entry)).slice(0, 40)
      : fallback.receipts,
    boards: Array.isArray(raw.boards)
      ? raw.boards.map((entry) => {
        const item = record(entry) || {};
        const id = clean(item.id);
        const name = clean(item.name);
        if (!id || !name) return null;
        return {
          id,
          name,
          description: clean(item.description),
          columns: Array.isArray(item.columns)
            ? item.columns.map((column, order) => {
              const col = record(column) || {};
              const columnId = clean(col.id);
              const columnName = clean(col.name);
              if (!columnId || !columnName) return null;
              return {
                id: columnId,
                name: columnName,
                order: Number(col.order ?? order) || order,
                color: clean(col.color) || undefined,
              };
            }).filter((column): column is ZavorthRuntimeWorkboardState['boards'][number]['columns'][number] => Boolean(column))
            : [],
        };
      }).filter((entry): entry is ZavorthRuntimeWorkboardState['boards'][number] => Boolean(entry))
      : fallback.boards,
    summary: summarizeWorkboardTasks(tasks, sessions.length),
    safety: {
      sqliteDurable: true,
      mutationRequiresApproval: true,
      retryBounded: true,
      spawnDepthBounded: true,
    },
  };
}

function coerceWorkboardTask(value: unknown): ZavorthRuntimeWorkboardTask | null {
  const raw = record(value);
  if (!raw) return null;
  const taskId = clean(raw.taskId) || clean(raw.id);
  const title = clean(raw.title) || clean(raw.name);
  if (!taskId || !title) return null;
  return {
    taskId,
    sessionId: clean(raw.sessionId) || 'desktop-main',
    parentTaskId: clean(raw.parentTaskId),
    title,
    status: normalizeWorkboardTaskStatus(raw.status),
    risk: clean(raw.risk),
    claimedBy: clean(raw.claimedBy),
    heartbeatAt: clean(raw.heartbeatAt),
    blockedReason: clean(raw.blockedReason),
    summary: clean(raw.summary) || clean(raw.description),
    createdAt: clean(raw.createdAt),
    updatedAt: clean(raw.updatedAt),
  };
}

function normalizeWorkboardTaskStatus(value: unknown): ZavorthRuntimeWorkboardTaskStatus {
  const status = String(value || '').trim().toLowerCase();
  if (status.includes('block')) return 'blocked';
  if (status.includes('fail')) return 'failed';
  if (status.includes('cancel')) return 'cancelled';
  if (status.includes('complete') || status.includes('done')) return 'completed';
  if (status.includes('claim') || status.includes('review')) return 'claimed';
  if (status.includes('run') || status.includes('doing') || status.includes('progress')) return 'running';
  return 'queued';
}

function summarizeWorkboardTasks(tasks: ZavorthRuntimeWorkboardTask[], sessions: number): ZavorthRuntimeWorkboardState['summary'] {
  return {
    sessions,
    queued: tasks.filter((task) => task.status === 'queued').length,
    running: tasks.filter((task) => task.status === 'running' || task.status === 'claimed').length,
    completed: tasks.filter((task) => task.status === 'completed').length,
    blocked: tasks.filter((task) => task.status === 'blocked' || task.status === 'failed').length,
  };
}

function applyWorkboardSync(
  current: ZavorthRuntimeWorkboardState,
  payload: RuntimeRecord,
  meta: { sessionId: string; source: string; now: string; receiptId: string },
): { ok: boolean; workboard?: ZavorthRuntimeWorkboardState; error?: string } {
  const operation = clean(payload.operation) || 'sync-board';
  if (!['upsert-card', 'delete-card', 'sync-board'].includes(operation)) {
    return { ok: false, error: `workboard_operation_unsupported:${operation}` };
  }

  const boardRaw = record(payload.board);
  const boardId = clean(boardRaw?.id) || 'desktop-board';
  const boardName = clean(boardRaw?.name) || 'Desktop Workboard';
  const boardDescription = clean(boardRaw?.description);
  const boardColumns = Array.isArray(boardRaw?.columns)
    ? boardRaw!.columns.map((column, order) => {
      const col = record(column) || {};
      const id = clean(col.id);
      const name = clean(col.name);
      if (!id || !name) return null;
      return {
        id,
        name,
        order: Number(col.order ?? order) || order,
        color: clean(col.color) || undefined,
      };
    }).filter((column): column is ZavorthRuntimeWorkboardState['boards'][number]['columns'][number] => Boolean(column))
    : (current.boards.find((board) => board.id === boardId)?.columns || []);

  let tasks = [...current.tasks];
  const card = coerceWorkboardTask(payload.card);

  if (operation === 'upsert-card') {
    if (!card) return { ok: false, error: 'workboard_card_required' };
    const nextCard: ZavorthRuntimeWorkboardTask = {
      ...card,
      sessionId: card.sessionId || meta.sessionId,
      updatedAt: meta.now,
      createdAt: card.createdAt || meta.now,
    };
    const existingIndex = tasks.findIndex((task) => task.taskId === nextCard.taskId);
    if (existingIndex >= 0) {
      tasks[existingIndex] = { ...tasks[existingIndex], ...nextCard };
    } else {
      tasks.push(nextCard);
    }
  } else if (operation === 'delete-card') {
    const taskId = card?.taskId || clean(record(payload.card)?.taskId) || clean(record(payload.card)?.id);
    if (!taskId) return { ok: false, error: 'workboard_card_id_required' };
    tasks = tasks.filter((task) => task.taskId !== taskId);
  } else if (operation === 'sync-board' && card) {
    // Full board sync may still include an optional focus card.
    const nextCard: ZavorthRuntimeWorkboardTask = {
      ...card,
      sessionId: card.sessionId || meta.sessionId,
      updatedAt: meta.now,
      createdAt: card.createdAt || meta.now,
    };
    const existingIndex = tasks.findIndex((task) => task.taskId === nextCard.taskId);
    if (existingIndex >= 0) {
      tasks[existingIndex] = { ...tasks[existingIndex], ...nextCard };
    } else {
      tasks.push(nextCard);
    }
  }

  const sessions = (() => {
    const existing = current.sessions.find((session) => session.sessionId === meta.sessionId);
    const nextSession = {
      sessionId: meta.sessionId,
      objective: boardName,
      status: 'running',
      maxDepth: existing?.maxDepth || 3,
      maxChildren: existing?.maxChildren || 8,
    };
    return [nextSession, ...current.sessions.filter((session) => session.sessionId !== meta.sessionId)].slice(0, 12);
  })();

  const boards = [
    {
      id: boardId,
      name: boardName,
      description: boardDescription,
      columns: boardColumns,
    },
    ...current.boards.filter((board) => board.id !== boardId),
  ].slice(0, 12);

  const selectedTaskId = card?.taskId || current.selectedTaskId;
  const selectedTask = selectedTaskId
    ? tasks.find((task) => task.taskId === selectedTaskId) || null
    : null;

  const receipts = [
    {
      receiptId: meta.receiptId,
      action: `workboard-${operation}`,
      taskId: card?.taskId || null,
      workerId: null,
      status: 'applied',
    },
    ...current.receipts,
  ].slice(0, 40);

  const workboard: ZavorthRuntimeWorkboardState = {
    updatedAt: meta.now,
    source: meta.source,
    selectedTaskId,
    selectedTask,
    sessions,
    tasks: tasks.slice(0, 200),
    workers: current.workers,
    receipts,
    boards,
    summary: summarizeWorkboardTasks(tasks, sessions.length),
    safety: {
      sqliteDurable: true,
      mutationRequiresApproval: true,
      retryBounded: true,
      spawnDepthBounded: true,
    },
  };

  return { ok: true, workboard };
}
