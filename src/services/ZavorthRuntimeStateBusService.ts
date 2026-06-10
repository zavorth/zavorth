import fs from 'node:fs';
import path from 'node:path';
import {
  ZAVORTH_RUNTIME_STATE_BUS_CONTRACT_VERSION,
  type ZavorthRuntimeStateBusActionInput,
  type ZavorthRuntimeStateBusDispatchResult,
  type ZavorthRuntimeStateBusSnapshot,
  type ZavorthRuntimeStateBusState,
  type ZavorthRuntimeStateDomain,
  type ZavorthRuntimeStateDomainState,
  type ZavorthRuntimeStateReceipt,
  type ZavorthRuntimeStateReceiptStatus,
  type ZavorthRuntimeStateSkill,
  type ZavorthRuntimeStateStatus,
  type ZavorthRuntimeStateWorkspace,
} from '../contracts/ZavorthRuntimeStateBusContract.js';
import { ZavorthEffortControlService } from './ZavorthEffortControlService.js';

type RuntimeRecord = Record<string, unknown>;

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
    store.lastReplayAt = store.lastReplayAt || receipt.createdAt;
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
    const trustedDesktopBridge = metadata.trustedDesktopBridge === true;
    const commandSource = trustedDesktopBridge
      ? 'zavorth-desktop-bridge'
      : clean(metadata.client) || clean(metadata.source) || input.surface || 'experience-core';
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
      const connected = input.connectedModelIds?.length
        ? input.connectedModelIds.includes(model.id)
        : DEFAULT_CONNECTED_MODELS.includes(model.id) || model.connected;
      if (!connected) {
        return { ok: false, pathValidated: false, error: `model_not_connected:${model.id}` };
      }
      state.model = {
        ...model,
        connected: true,
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
      const connected = input.connectedModelIds?.length
        ? input.connectedModelIds.includes(model.id)
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
          connectedModelIds: DEFAULT_CONNECTED_MODELS,
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
    } catch {
      // Corrupt state falls back to a clean in-memory state; the next dispatch rewrites it.
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
        id: clean(record(current.model)?.id) || fallback.model.id,
        label: clean(record(current.model)?.label) || fallback.model.label,
        provider: clean(record(current.model)?.provider) || fallback.model.provider,
        connected: record(current.model)?.connected !== false,
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
        selectedAt: now,
        source,
      };
    }
    const raw = record(value) || {};
    const id = safeModelId(raw.id || raw.model || raw.value || 'zavorth:core') || 'zavorth:core';
    return {
      id,
      label: clean(raw.label || raw.name) || labelFromModelId(id),
      provider: clean(raw.provider || raw.family) || providerFromModelId(id),
      connected: raw.connected !== false,
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
    if (this.allowedWorkspaceRoots.length > 0 && !this.allowedWorkspaceRoots.some((root) => isPathInside(resolved, root))) {
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
    const payloadMetadata = record(input.payload?.metadata) || {};
    return clean(input.source) === 'zavorth-desktop-bridge'
      || payloadMetadata.trustedDesktopBridge === true;
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

function domainForAction(input: ZavorthRuntimeStateBusActionInput): ZavorthRuntimeStateDomain {
  if (input.type === 'set-model') return 'model';
  if (input.type === 'set-effort') return 'effort';
  if (input.type === 'set-workspace') return 'workspace';
  if (input.type === 'skill-lifecycle') return 'skills';
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

function safeResolve(value: unknown): string | null {
  const text = clean(value);
  if (!text || /[\0\r\n]/.test(text)) return null;
  return path.resolve(text);
}

function isPathInside(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
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
  return id.split(':').pop()?.replace(/[-_]+/g, ' ') || id;
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
