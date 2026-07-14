import { ZavorthEffortControlService } from './ZavorthEffortControlService.js';
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

import { logger } from '../logger.js';
import * as runtimeStateCoreHelpers from './ZavorthRuntimeStateCoreHelpers.js';
import * as runtimeStateNormalizationHelpers from './ZavorthRuntimeStateNormalizationHelpers.js';
import * as runtimeWorkboardHelpers from './ZavorthRuntimeWorkboardHelpers.js';

const runtimeStateHelpers = {
  ...runtimeStateCoreHelpers,
  ...runtimeStateNormalizationHelpers,
  ...runtimeWorkboardHelpers,
};

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
      .map((root) => runtimeStateHelpers.safeResolve(root))
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
    const source = runtimeStateHelpers.clean(input.source) || runtimeStateHelpers.clean(input.surface) || 'runtime';
    const domain = runtimeStateHelpers.domainForAction(input);
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
    const metadata = runtimeStateHelpers.record(input.metadata) || {};
    const trustedDesktopBridge = false;
    const commandSource = runtimeStateHelpers.clean(metadata.client) || runtimeStateHelpers.clean(metadata.source) || input.surface || 'experience-core';
    const connectedModelIds = Array.isArray(metadata.connectedModelIds)
      ? metadata.connectedModelIds.map((value) => runtimeStateHelpers.clean(value)).filter((value): value is string => Boolean(value))
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
          textPreview: runtimeStateHelpers.redact(runtimeStateHelpers.clean(input.text) || ''),
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
        sessionId: runtimeStateHelpers.clean(input.sessionId),
        userId: runtimeStateHelpers.clean(input.userId),
        surface: runtimeStateHelpers.clean(input.surface),
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
      const requestedLevel = runtimeStateHelpers.normalizeEffortLevel(payload.effort);
      const effortSnapshot = this.effortControl.buildSnapshot({
        level: requestedLevel,
        request: input.text || null,
        profile: runtimeStateHelpers.record(payload.metadata)?.profile || null,
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
      const connectedModelIds = runtimeStateHelpers.normalizeConnectedModelIds(input.connectedModelIds, model.id);
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
          : runtimeStateHelpers.uniqueStrings([...DEFAULT_CONNECTED_MODELS, model.id]),
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
      const permission = runtimeStateHelpers.readPermissionPatch(payload.permission);
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
      const specId = runtimeStateHelpers.normalizeModelSpecId(runtimeStateHelpers.record(payload.modelSpec)?.id || payload.modelSpec);
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
      const dynamicRouting = runtimeStateHelpers.record(payload.dynamicRouting) || {};
      const requestedModelId = runtimeStateHelpers.safeModelId(dynamicRouting.modelId || dynamicRouting.model || payload.model) || state.model.id;
      const connectedModelIds = runtimeStateHelpers.normalizeConnectedModelIds(input.connectedModelIds, requestedModelId);
      const connected = connectedModelIds.length
        ? connectedModelIds.includes(requestedModelId)
        : state.model.connectedModelIds.includes(requestedModelId) || DEFAULT_CONNECTED_MODELS.includes(requestedModelId);
      if (!connected) {
        return { ok: false, pathValidated: false, error: `model_not_connected:${requestedModelId}` };
      }
      const specId = runtimeStateHelpers.normalizeModelSpecId(dynamicRouting.specId) || state.modelSpec.selectedSpecId || 'daily';
      const route = this.readDynamicRoute(dynamicRouting, requestedModelId, specId, now);
      state.dynamicRouting = {
        ...state.dynamicRouting,
        selected: route,
      };
      state.model = {
        id: route.modelId,
        label: runtimeStateHelpers.labelFromModelId(route.modelId),
        provider: runtimeStateHelpers.providerFromModelId(route.modelId),
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
        providerConnections: runtimeStateHelpers.upsertProviderConnection(state.dynamicRouting.providerConnections, provider.connection),
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
        connectors: runtimeStateHelpers.upsertPersonalConnector(state.personalOps.connectors, connector),
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
        servers: runtimeStateHelpers.upsertMcpTrustServer(state.mcpTrust.servers, server),
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
      const recovery = runtimeStateHelpers.record(payload.scheduledJobs) || {};
      const orphaned = Number(recovery.orphaned || recovery.orphanedCount || 0) || 0;
      const recoverable = Number(recovery.recoverable || recovery.recoverableCount || 0) || 0;
      state.cron = {
        ...state.cron,
        status: orphaned > 0 ? 'attention' : 'ready',
        summary: orphaned > 0
          ? `${orphaned} orphaned scheduled job(s) detected; ${recoverable} recoverable.`
          : 'Scheduled job recovery completed with no orphaned runs.',
        updatedAt: now,
        actionIds: runtimeStateHelpers.uniqueStrings([...state.cron.actionIds, 'runtime.cron.recover']).slice(-10),
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
        active: runtimeStateHelpers.upsertSkill(state.skills.active, skill),
      };
      state.skillHistory = {
        entries: runtimeStateHelpers.upsertSkillHistory(state.skillHistory.entries, {
          id: `${skill.id}:${now}`,
          skillId: skill.id,
          skillName: skill.name,
          mode: runtimeStateHelpers.skillHistoryModeFor(skill.status),
          source: skill.source,
          receiptId: skill.lastReceiptId,
          at: now,
        }),
      };
      return { ok: true, pathValidated: false, error: null };
    }

    if (input.type === 'workboard-sync') {
      const next = runtimeStateHelpers.applyWorkboardSync(state.workboard, payload, {
        sessionId: runtimeStateHelpers.clean(input.sessionId) || 'desktop-main',
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
        actionIds: runtimeStateHelpers.uniqueStrings([...state.agents.actionIds, 'runtime.workboard.sync']).slice(-10),
      };
      return { ok: true, pathValidated: false, error: null };
    }

    if (input.type === 'operate-domain') {
      const operation = runtimeStateHelpers.normalizeDomainOperation(runtimeStateHelpers.record(payload.domain)?.operation || runtimeStateHelpers.record(payload.domain)?.action);
      const targetDomain = runtimeStateHelpers.normalizeDomain(runtimeStateHelpers.record(payload.domain)?.domain);
      if (!operation || !targetDomain) {
        return { ok: false, pathValidated: false, error: 'domain_operation_payload_required' };
      }
      if (targetDomain === 'model' || targetDomain === 'workspace' || targetDomain === 'effort') {
        return { ok: false, pathValidated: false, error: 'domain_operation_not_supported_for_selection_state' };
      }
      const current = state[targetDomain] as ZavorthRuntimeStateDomainState;
      (state as unknown as Record<string, unknown>)[targetDomain] = {
        ...current,
        status: runtimeStateHelpers.statusForDomainOperation(operation),
        summary: runtimeStateHelpers.summaryForDomainOperation(targetDomain, operation),
        updatedAt: now,
        actionIds: runtimeStateHelpers.uniqueStrings([...current.actionIds, `runtime.${targetDomain}.${operation}`]).slice(-10),
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
      const model = this.readModel(input.payload?.model, runtimeStateHelpers.clean(input.source) || 'runtime');
      const connectedModelIds = runtimeStateHelpers.normalizeConnectedModelIds(input.connectedModelIds, model.id);
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
        level: runtimeStateHelpers.normalizeEffortLevel(input.payload?.effort),
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
      const rawDomain = runtimeStateHelpers.record(input.payload?.domain);
      const operation = runtimeStateHelpers.normalizeDomainOperation(rawDomain?.operation || rawDomain?.action);
      const targetDomain = runtimeStateHelpers.normalizeDomain(rawDomain?.domain);
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
      const permission = runtimeStateHelpers.readPermissionPatch(input.payload?.permission);
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
      phase: runtimeStateHelpers.receiptPhaseFor(input.input, input.status),
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
      metadata: runtimeStateHelpers.redactRecord({
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
          runtimeStatus: runtimeStateHelpers.summarizeRuntimeStatus(store.state),
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
        capabilities: runtimeStateHelpers.buildCapabilitiesProjection(store.state, pendingApprovals),
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
            updatedAt: runtimeStateHelpers.clean(parsed.updatedAt) || this.now().toISOString(),
            state: this.coerceState(parsed.state),
            receipts: Array.isArray(parsed.receipts)
              ? parsed.receipts.map((receipt) => runtimeStateHelpers.coerceReceipt(receipt)).filter((receipt): receipt is ZavorthRuntimeStateReceipt => Boolean(receipt))
              : [],
            lastReplayAt: runtimeStateHelpers.clean(parsed.lastReplayAt),
            restoredFromDisk: true,
          };
        }
      }
    } catch (error: unknown) {
      // Corrupt state falls back to a runtimeStateHelpers.clean in-memory state; the next dispatch rewrites it.
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
    const current = runtimeStateHelpers.record(value) || {};
    const fallback = this.defaultState();
    const persistedModelId = runtimeStateHelpers.clean(runtimeStateHelpers.record(current.model)?.id) || fallback.model.id;
    const persistedConnectedModelIds = runtimeStateHelpers.normalizeConnectedModelIds(
      runtimeStateHelpers.record(current.model)?.connectedModelIds,
      persistedModelId,
    );
    return {
      gateway: runtimeStateHelpers.coerceDomainState(current.gateway, fallback.gateway),
      agents: runtimeStateHelpers.coerceDomainState(current.agents, fallback.agents),
      cron: runtimeStateHelpers.coerceDomainState(current.cron, fallback.cron),
      context: runtimeStateHelpers.coerceDomainState(current.context, fallback.context),
      session: {
        ...runtimeStateHelpers.coerceDomainState(current.session, fallback.session),
        sessionId: runtimeStateHelpers.clean(runtimeStateHelpers.record(current.session)?.sessionId),
        userId: runtimeStateHelpers.clean(runtimeStateHelpers.record(current.session)?.userId),
        surface: runtimeStateHelpers.clean(runtimeStateHelpers.record(current.session)?.surface),
      },
      skills: {
        ...runtimeStateHelpers.coerceDomainState(current.skills, fallback.skills),
        nativeCount: Number(runtimeStateHelpers.record(current.skills)?.nativeCount || 0) || fallback.skills.nativeCount,
        importedQuarantined: runtimeStateHelpers.record(current.skills)?.importedQuarantined !== false,
        active: Array.isArray(runtimeStateHelpers.record(current.skills)?.active)
          ? (runtimeStateHelpers.record(current.skills)?.active as unknown[]).map((skill) => this.readSkill(skill)).filter((skill): skill is ZavorthRuntimeStateSkill => Boolean(skill))
          : [],
      },
      model: {
        ...fallback.model,
        ...(runtimeStateHelpers.record(current.model) || {}),
        id: persistedModelId,
        label: runtimeStateHelpers.clean(runtimeStateHelpers.record(current.model)?.label) || fallback.model.label,
        provider: runtimeStateHelpers.clean(runtimeStateHelpers.record(current.model)?.provider) || fallback.model.provider,
        connected: runtimeStateHelpers.record(current.model)?.connected !== false,
        connectedModelIds: persistedConnectedModelIds.length > 0
          ? persistedConnectedModelIds
          : fallback.model.connectedModelIds,
        selectedAt: runtimeStateHelpers.clean(runtimeStateHelpers.record(current.model)?.selectedAt) || fallback.model.selectedAt,
        source: runtimeStateHelpers.clean(runtimeStateHelpers.record(current.model)?.source) || fallback.model.source,
      },
      workspace: this.readWorkspace(current.workspace).workspace || fallback.workspace,
      effort: fallback.effort.snapshot.contractVersion === runtimeStateHelpers.record(runtimeStateHelpers.record(current.effort)?.snapshot)?.contractVersion
        ? {
            level: runtimeStateHelpers.clean(runtimeStateHelpers.record(current.effort)?.level) || fallback.effort.level,
            snapshot: runtimeStateHelpers.record(current.effort)?.snapshot as ZavorthRuntimeStateBusState['effort']['snapshot'],
            selectedAt: runtimeStateHelpers.clean(runtimeStateHelpers.record(current.effort)?.selectedAt) || fallback.effort.selectedAt,
          }
        : fallback.effort,
      permissionsMatrix: runtimeStateHelpers.coercePermissionsMatrix(current.permissionsMatrix, fallback.permissionsMatrix),
      modelSpec: {
        selectedSpecId: runtimeStateHelpers.normalizeModelSpecId(runtimeStateHelpers.record(current.modelSpec)?.selectedSpecId) || fallback.modelSpec.selectedSpecId,
        selectedAt: runtimeStateHelpers.clean(runtimeStateHelpers.record(current.modelSpec)?.selectedAt) || fallback.modelSpec.selectedAt,
        specs: DEFAULT_MODEL_SPECS,
      },
      dynamicRouting: {
        selected: runtimeStateHelpers.coerceDynamicRoute(runtimeStateHelpers.record(current.dynamicRouting)?.selected, fallback.dynamicRouting.selected),
        providerConnections: Array.isArray(runtimeStateHelpers.record(current.dynamicRouting)?.providerConnections)
          ? (runtimeStateHelpers.record(current.dynamicRouting)?.providerConnections as unknown[])
              .map((entry) => runtimeStateHelpers.coerceProviderConnection(entry))
              .filter((entry): entry is ZavorthRuntimeProviderConnection => Boolean(entry))
          : fallback.dynamicRouting.providerConnections,
      },
      workspaceKnowledge: runtimeStateHelpers.coerceWorkspaceKnowledge(current.workspaceKnowledge, fallback.workspaceKnowledge),
      personalOps: {
        connectors: Array.isArray(runtimeStateHelpers.record(current.personalOps)?.connectors)
          ? (runtimeStateHelpers.record(current.personalOps)?.connectors as unknown[])
              .map((entry) => runtimeStateHelpers.coercePersonalConnector(entry))
              .filter((entry): entry is ZavorthRuntimePersonalConnector => Boolean(entry))
          : fallback.personalOps.connectors,
      },
      mcpTrust: {
        ...fallback.mcpTrust,
        servers: Array.isArray(runtimeStateHelpers.record(current.mcpTrust)?.servers)
          ? (runtimeStateHelpers.record(current.mcpTrust)?.servers as unknown[])
              .map((entry) => runtimeStateHelpers.coerceMcpTrustServer(entry))
              .filter((entry): entry is ZavorthRuntimeMcpTrustServer => Boolean(entry))
          : fallback.mcpTrust.servers,
      },
      skillHistory: {
        entries: Array.isArray(runtimeStateHelpers.record(current.skillHistory)?.entries)
          ? (runtimeStateHelpers.record(current.skillHistory)?.entries as unknown[])
              .map((entry) => runtimeStateHelpers.coerceSkillHistoryEntry(entry))
              .filter((entry): entry is ZavorthRuntimeSkillHistoryEntry => Boolean(entry))
          : fallback.skillHistory.entries,
      },
      streamSession: runtimeStateHelpers.coerceStreamSession(current.streamSession, fallback.streamSession),
      workboard: runtimeStateHelpers.coerceWorkboardState(current.workboard, fallback.workboard),
    };
  }

  private defaultState(): ZavorthRuntimeStateBusState {
    const now = this.now().toISOString();
    const effortSnapshot = this.effortControl.buildSnapshot({ level: 'standard' });
    return {
      gateway: runtimeStateHelpers.domainState('gateway', 'offline', 'Gateway state not attached yet.', now),
      agents: runtimeStateHelpers.domainState('agents', 'ready', 'Agent plane ready for governed runs.', now),
      cron: runtimeStateHelpers.domainState('cron', 'ready', 'Cron plane idle.', now),
      context: runtimeStateHelpers.domainState('context', 'ready', 'Context plane ready.', now),
      session: {
        ...runtimeStateHelpers.domainState('session', 'ready', 'Session plane ready.', now),
        sessionId: null,
        userId: null,
        surface: null,
      },
      skills: {
        ...runtimeStateHelpers.domainState('skills', 'ready', 'Native skills enabled; imported skills remain quarantined.', now),
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
      permissionsMatrix: runtimeStateHelpers.buildDefaultPermissionsMatrix(),
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
        connectors: runtimeStateHelpers.buildDefaultPersonalConnectors(),
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
      workboard: runtimeStateHelpers.defaultWorkboardState(now),
    };
  }

  private readModel(value: unknown, source: string): ZavorthRuntimeStateBusState['model'] {
    const now = this.now().toISOString();
    if (typeof value === 'string') {
      return {
        id: runtimeStateHelpers.safeModelId(value) || 'zavorth:core',
        label: runtimeStateHelpers.labelFromModelId(value),
        provider: runtimeStateHelpers.providerFromModelId(value),
        connected: DEFAULT_CONNECTED_MODELS.includes(value),
        connectedModelIds: runtimeStateHelpers.uniqueStrings([...DEFAULT_CONNECTED_MODELS, runtimeStateHelpers.safeModelId(value) || 'zavorth:core']),
        selectedAt: now,
        source,
      };
    }
    const raw = runtimeStateHelpers.record(value) || {};
    const id = runtimeStateHelpers.safeModelId(raw.id || raw.model || raw.value || 'zavorth:core') || 'zavorth:core';
    const connectedModelIds = runtimeStateHelpers.normalizeConnectedModelIds(raw.connectedModelIds, id);
    return {
      id,
      label: runtimeStateHelpers.clean(raw.label || raw.name) || runtimeStateHelpers.labelFromModelId(id),
      provider: runtimeStateHelpers.clean(raw.provider || raw.family) || runtimeStateHelpers.providerFromModelId(id),
      connected: raw.connected !== false,
      connectedModelIds: connectedModelIds.length > 0
        ? connectedModelIds
        : runtimeStateHelpers.uniqueStrings([...DEFAULT_CONNECTED_MODELS, id]),
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
      : runtimeStateHelpers.record(value) || {};
    const kind = runtimeStateHelpers.normalizeWorkspaceKind(raw.kind);
    const pathValue = runtimeStateHelpers.clean(raw.path);
    const pathResult = this.validateWorkspacePath(pathValue, kind);
    if (!pathResult.ok) {
      return { ok: false, workspace: null, pathValidated: pathResult.pathValidated, error: pathResult.error };
    }
    const label = runtimeStateHelpers.clean(raw.label || raw.shortLabel || pathResult.label) || (kind === 'chat' ? 'Chats' : 'Local');
    const confinement = runtimeStateHelpers.normalizeConfinement(raw.confinement, kind);
    return {
      ok: true,
      pathValidated: pathResult.pathValidated,
      error: null,
      workspace: {
        id: runtimeStateHelpers.clean(raw.id) || (pathResult.path ? `folder:${pathResult.path}` : kind),
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
    const resolved = runtimeStateHelpers.safeResolve(pathValue);
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
    const realResolved = runtimeStateHelpers.safeRealPath(resolved);
    if (this.allowedWorkspaceRoots.length > 0 && !this.allowedWorkspaceRoots.some((rootPath) => {
      const realRoot = runtimeStateHelpers.safeRealPath(rootPath);
      return runtimeStateHelpers.isPathInside(resolved, rootPath) && (!realResolved || !realRoot || runtimeStateHelpers.isPathInside(realResolved, realRoot));
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
    return runtimeStateHelpers.clean(input.source) === 'zavorth-desktop-bridge';
  }

  private readDynamicRoute(
    value: RuntimeRecord,
    modelId: string,
    specId: string,
    selectedAt: string,
  ): ZavorthRuntimeDynamicRoute {
    const providerId = runtimeStateHelpers.safeId(value.providerId || value.provider || runtimeStateHelpers.providerFromModelId(modelId)) || 'zavorth';
    const intent = runtimeStateHelpers.safeId(value.intent || specId || 'daily') || 'daily';
    const fallbackModelIds = Array.isArray(value.fallbackModelIds)
      ? value.fallbackModelIds.map((entry) => runtimeStateHelpers.safeModelId(entry)).filter((entry): entry is string => Boolean(entry))
      : DEFAULT_MODEL_SPECS.find((spec) => spec.id === specId)?.fallbackModelIds || ['zavorth:governed'];
    return {
      intent,
      providerId,
      modelId,
      specId,
      reason: runtimeStateHelpers.clean(value.reason) || `Dynamic route selected ${modelId} for ${intent}.`,
      fallbackModelIds: runtimeStateHelpers.uniqueStrings(fallbackModelIds),
      estimatedCost: runtimeStateHelpers.normalizeCost(value.estimatedCost),
      risk: runtimeStateHelpers.normalizeRisk(value.risk),
      selectedAt,
    };
  }

  private readProviderConnection(value: unknown, updatedAt: string): {
    ok: boolean;
    connection: ZavorthRuntimeProviderConnection | null;
    error: string | null;
  } {
    const raw = runtimeStateHelpers.record(value);
    if (!raw) return { ok: false, connection: null, error: 'provider_connection_payload_required' };
    const id = runtimeStateHelpers.safeId(raw.providerId || raw.id);
    if (!id) return { ok: false, connection: null, error: 'provider_connection_id_required' };
    const targetUrl = runtimeStateHelpers.clean(raw.targetUrl || raw.baseUrl || raw.url);
    const network = runtimeStateHelpers.evaluateNetworkTarget(id, targetUrl);
    if (!network.ok) {
      return { ok: false, connection: null, error: 'network_target_blocked' };
    }
    const label = runtimeStateHelpers.clean(raw.label || raw.name) || runtimeStateHelpers.formatModelLabel(id.replace(/[-_]+/g, ' '));
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
    const raw = runtimeStateHelpers.record(value) || {};
    const sources = Array.isArray(raw.ragSources)
      ? raw.ragSources
          .map((entry) => runtimeStateHelpers.record(entry))
          .filter((entry): entry is RuntimeRecord => Boolean(entry))
          .map((entry) => ({
            id: runtimeStateHelpers.safeId(entry.id || entry.label) || 'source',
            kind: runtimeStateHelpers.normalizeKnowledgeKind(entry.kind),
            label: runtimeStateHelpers.clean(entry.label || entry.name) || 'Knowledge source',
            trusted: entry.trusted === true,
          }))
          .slice(0, 30)
      : [];
    return {
      workspaceId: runtimeStateHelpers.clean(raw.workspaceId) || workspace.id,
      activeWorkspaceLabel: runtimeStateHelpers.clean(raw.activeWorkspaceLabel || raw.label) || workspace.label,
      isolation: workspace.confinement === 'none' ? 'chat' : workspace.confinement,
      trustedWorkspaceIds: Array.isArray(raw.trustedWorkspaceIds)
        ? raw.trustedWorkspaceIds.map((entry) => runtimeStateHelpers.safeId(entry)).filter(Boolean)
        : [],
      allowedPaths: Array.isArray(raw.allowedPaths)
        ? raw.allowedPaths.map((entry) => runtimeStateHelpers.safeResolve(entry)).filter((entry): entry is string => Boolean(entry)).slice(0, 50)
        : [],
      ragSources: sources,
      untrustedContextWrapping: true,
    };
  }

  private readPersonalConnector(value: unknown, now: string): ZavorthRuntimePersonalConnector | null {
    const raw = runtimeStateHelpers.record(value);
    if (!raw) return null;
    const kind = runtimeStateHelpers.normalizePersonalConnectorKind(raw.kind);
    const id = runtimeStateHelpers.safeId(raw.id || `${kind}:primary`);
    if (!id) return null;
    const configured = raw.configured === true || raw.status === 'configured';
    return {
      id,
      kind,
      label: runtimeStateHelpers.clean(raw.label || raw.name) || runtimeStateHelpers.formatModelLabel(id.replace(/[:_-]+/g, ' ')),
      provider: runtimeStateHelpers.safeId(raw.provider) || null,
      accountEmailDomain: runtimeStateHelpers.emailDomain(raw.accountEmail),
      status: configured ? 'configured' : runtimeStateHelpers.normalizePersonalConnectorStatus(raw.status),
      enabled: raw.enabled === true && configured,
      readAllowed: configured,
      draftAllowed: configured,
      sendRequiresApproval: true,
      writeRequiresApproval: true,
      lastReceiptId: runtimeStateHelpers.clean(raw.lastReceiptId) || `personal-connector:${id}:${now}`,
    };
  }

  private readMcpTrustServer(value: unknown): ZavorthRuntimeMcpTrustServer | null {
    const raw = runtimeStateHelpers.record(value);
    if (!raw) return null;
    const id = runtimeStateHelpers.safeId(raw.id || raw.label);
    if (!id) return null;
    const trustState = runtimeStateHelpers.normalizeMcpTrustState(raw.trustState);
    const toolNames = Array.isArray(raw.toolNames)
      ? raw.toolNames.map((entry) => runtimeStateHelpers.safeId(entry)).filter(Boolean)
      : [];
    return {
      id,
      label: runtimeStateHelpers.clean(raw.label || raw.name) || runtimeStateHelpers.formatModelLabel(id.replace(/[:_-]+/g, ' ')),
      origin: runtimeStateHelpers.clean(raw.origin) || 'unknown',
      trustState,
      toolNames,
      risk: trustState === 'trusted' ? 'low' : trustState === 'review' ? 'medium' : 'high',
      networkAccess: trustState === 'trusted' ? 'restricted' : 'blocked',
      exposedToModel: trustState === 'trusted',
      lastReceiptId: runtimeStateHelpers.clean(raw.lastReceiptId),
    };
  }

  private readStreamSession(value: unknown, now: string): ZavorthRuntimeStreamSession {
    const raw = runtimeStateHelpers.record(value) || {};
    return {
      sessionId: runtimeStateHelpers.clean(raw.sessionId),
      status: runtimeStateHelpers.normalizeStreamStatus(raw.status),
      resumeToken: runtimeStateHelpers.clean(raw.resumeToken),
      updatedAt: now,
      resumable: true,
    };
  }

  private readSkill(value: unknown): ZavorthRuntimeStateSkill | null {
    const raw = runtimeStateHelpers.record(value);
    if (!raw) return null;
    const id = runtimeStateHelpers.safeId(raw.id || raw.name);
    const name = runtimeStateHelpers.clean(raw.name || raw.id);
    if (!id || !name) return null;
    const source = runtimeStateHelpers.normalizeSkillSource(raw.source);
    return {
      id,
      name,
      source,
      status: runtimeStateHelpers.normalizeSkillStatus(raw.status, source),
      lastReceiptId: runtimeStateHelpers.clean(raw.lastReceiptId),
    };
  }

  private readDomainState(value: unknown): ZavorthRuntimeStateDomainState | null {
    const raw = runtimeStateHelpers.record(value);
    const domain = runtimeStateHelpers.normalizeDomain(raw?.domain);
    if (!raw || !domain) return null;
    return {
      domain,
      status: runtimeStateHelpers.normalizeStatus(raw.status),
      summary: runtimeStateHelpers.clean(raw.summary) || `${domain} state updated.`,
      updatedAt: this.now().toISOString(),
      actionIds: Array.isArray(raw.actionIds) ? raw.actionIds.map((entry) => runtimeStateHelpers.safeId(entry)).filter(Boolean) : [],
    };
  }
}
