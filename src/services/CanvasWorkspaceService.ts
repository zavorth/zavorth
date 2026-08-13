import { ZavorthAutomationControlPlaneService } from './ZavorthAutomationControlPlaneService.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type {
  ZavorthMutationPlan,
  ZavorthMutationRiskLevel,
} from '../contracts/ZavorthMutationPlaneContract.js';

import { ZavorthFederatedMeshControlPlaneService } from './ZavorthFederatedMeshControlPlaneService.js';
import { ZavorthMutationPlaneService } from './ZavorthMutationPlaneService.js';
import { ZavorthRolloutReadinessControlPlaneService } from './ZavorthRolloutReadinessControlPlaneService.js';
import { ZavorthSkillEvolutionService } from './ZavorthSkillEvolutionService.js';
import { ZavorthWatchModeControlPlaneService } from './ZavorthWatchModeControlPlaneService.js';
import { logger } from '../logger.js';
import type {
  CanvasAttachment,
  CanvasAttachmentKind,
  CanvasEntity,
  CanvasEntityKind,
  CanvasEntityPosition,
  CanvasHistoryEvent,
  CanvasLock,
  CanvasSourceRef,
  CanvasWorkspaceDocument,
  CanvasWorkspaceSnapshot,
} from './canvas-workspace-helpers/CanvasWorkspaceTypes.js';

export type {
  CanvasAttachment,
  CanvasAttachmentKind,
  CanvasEntity,
  CanvasEntityKind,
  CanvasEntityPosition,
  CanvasHistoryEvent,
  CanvasLock,
  CanvasSourceRef,
  CanvasWorkspaceDocument,
  CanvasWorkspaceSnapshot,
};

type CanvasRecord = Record<string, unknown>;

type SnapshotLike = {
  buildSnapshot: unknown;
};

type CanvasWorkspaceRuntime = {
  now?: () => Date;
  workspaceRoot?: string | null;
  stateFile?: string;
  automationService?: SnapshotLike | null;
  watchModeService?: SnapshotLike | null;
  evalControlPlaneService?: SnapshotLike | null;
  rolloutReadinessService?: SnapshotLike | null;
  federatedMeshService?: SnapshotLike | null;
  skillEvolutionService?: SnapshotLike | null;
  mutationPlaneService?: Pick<ZavorthMutationPlaneService, 'createPlan' | 'listPlans' | 'approvePlan'> | null;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

type CanvasProjectionSources = {
  automation: CanvasRecord | null;
  watch: CanvasRecord | null;
  evals: CanvasRecord | null;
  rollout: CanvasRecord | null;
  federatedMesh: CanvasRecord | null;
  skillEvolution: CanvasRecord | null;
  mutationPlans: ZavorthMutationPlan[];
};

type CanvasPlanResult = {
  generatedAt: string;
  status: 'planned' | 'blocked';
  ok: boolean;
  summary: string;
  mutationPlan: ZavorthMutationPlan | null;
  entity: CanvasEntity | null;
  snapshot: CanvasWorkspaceSnapshot;
};

export class CanvasWorkspaceService {
  private readonly now: () => Date;
  private readonly workspaceRoot: string;
  private readonly stateFile: string;
  private readonly automationService: SnapshotLike | null;
  private readonly watchModeService: SnapshotLike | null;
  private readonly evalControlPlaneService: SnapshotLike | null;
  private readonly rolloutReadinessService: SnapshotLike | null;
  private readonly federatedMeshService: SnapshotLike | null;
  private readonly skillEvolutionService: SnapshotLike | null;
  private readonly mutationPlaneService: Pick<ZavorthMutationPlaneService, 'createPlan' | 'listPlans' | 'approvePlan'>;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;

  constructor(runtime: CanvasWorkspaceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceRoot = String(runtime.workspaceRoot || config.projectRoot || process.cwd()).trim();
    this.stateFile = runtime.stateFile || path.join(this.workspaceRoot, 'data', 'runtime', 'workspace-canvas', 'canvas.json');
    this.automationService = runtime.automationService === null
      ? null
      : runtime.automationService || new ZavorthAutomationControlPlaneService({ now: this.now, workspaceRoot: this.workspaceRoot });
    this.watchModeService = runtime.watchModeService === null
      ? null
      : runtime.watchModeService || new ZavorthWatchModeControlPlaneService({ now: this.now, workspaceRoot: this.workspaceRoot });
    this.evalControlPlaneService = runtime.evalControlPlaneService || null;
    this.rolloutReadinessService = runtime.rolloutReadinessService === null
      ? null
      : runtime.rolloutReadinessService || new ZavorthRolloutReadinessControlPlaneService({ now: this.now, workspaceRoot: this.workspaceRoot });
    this.federatedMeshService = runtime.federatedMeshService === null
      ? null
      : runtime.federatedMeshService || new ZavorthFederatedMeshControlPlaneService({ now: this.now });
    this.skillEvolutionService = runtime.skillEvolutionService === null
      ? null
      : runtime.skillEvolutionService || new ZavorthSkillEvolutionService({ now: this.now, projectRoot: this.workspaceRoot });
    this.mutationPlaneService = runtime.mutationPlaneService || new ZavorthMutationPlaneService();
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public async buildSnapshot(input: {
    limit?: number;
    includeSources?: boolean;
  } = {}): Promise<CanvasWorkspaceSnapshot> {
    const limit = Math.max(4, Math.min(Number(input.limit || 8), 24));
    const document = this.pruneExpiredLocks(this.readDocument());
    const sources = await this.readSources(limit);
    const baseEntities = this.projectEntities(sources, document, limit);
    const diagrams = this.buildDiagrams(sources);
    const diagramEntities = diagrams.map((entry, index) => this.entity({
      id: entry.id,
      kind: 'diagram',
      title: entry.title,
      summary: `Diagrama ${entry.kind} derivado de contratos reais.`,
      status: 'idle',
      sourceRef: entry.sourceRefs[0] || this.sourceRef('canvas', entry.id, 'diagram', 'npm run ops:canvas'),
      position: this.positionFor(index, 2, document),
      metadata: {
        mermaid: entry.mermaid,
        sourceRefs: entry.sourceRefs,
      },
      mutable: false,
      document,
    }));
    const entities = [...baseEntities, ...diagramEntities].map((entry) => ({
      ...entry,
      attachments: document.attachments.filter((attachment) => attachment.entityId === entry.id),
    }));
    const sourceHealth = this.buildSourceHealth(sources);
    const pendingApprovals = sources.mutationPlans.filter((entry) => entry.status === 'waiting_approval').length;
    const summary = {
      posture: this.resolvePosture(sourceHealth, pendingApprovals),
      entities: entities.length,
      compactPersisted: true as const,
      heavyRuntimesStarted: false as const,
      locks: document.locks.length,
      expiredLocks: this.readDocument().locks.length - document.locks.length,
      attachments: document.attachments.length,
      pendingAttachments: document.attachments.filter((entry) => entry.status === 'waiting_approval').length,
      approvals: sources.mutationPlans.length,
      pendingApprovals,
      diagrams: diagrams.length,
      fallbackAvailable: true as const,
    };

    return {
      generatedAt: this.now().toISOString(),
      workspaceRoot: this.workspaceRoot,
      summary,
      policy: {
        projectionOnly: true,
        canonicalSource: 'control-planes',
        mutableActionsCreateMutationPlan: true,
        watchModeStartsAutomatically: false,
        nodesStartAutomatically: false,
        automationsStartAutomatically: false,
        cliFallbackCommands: [
          'npm run ops:canvas',
          'npm run ops:automations',
          'npm run ops:watch-mode',
          'npm run ops:federated-mesh',
          'npm run ops:evals',
        ],
      },
      entities,
      locks: document.locks,
      history: document.history.slice(0, limit),
      diagrams,
      sourceHealth,
      narrative: {
        headline: 'Workspace canvas: infinite workspace canvas',
        operatorSummary: `${entities.length} projected entity/entities, ${summary.pendingApprovals} pending approval(s), ${summary.locks} active lock(s), ${summary.attachments} attachment(s), without starting Watch Mode, nodes, or automations.`,
        nextAction: pendingApprovals > 0
          ? 'Open the approval entity in the canvas and approve through the Mutation Plane when appropriate.'
          : 'Use the canvas as a spatial map; any mutable change must become a MutationPlan.',
      },
    };
  }

  public async planCanvasAction(input: {
    entityId: string;
    actionId: string;
    title?: string | null;
    summary?: string | null;
    payload?: Record<string, unknown> | null;
    requestedBy?: string | null;
    sourceSurface?: string | null;
    approvalRequired?: boolean;
    riskLevel?: ZavorthMutationRiskLevel;
  }): Promise<CanvasPlanResult> {
    const snapshot = await this.buildSnapshot();
    const entity = snapshot.entities.find((entry) => entry.id === this.normalizeEntityId(input.entityId)) || null;
    if (!entity) {
      return {
        generatedAt: this.now().toISOString(),
        status: 'blocked',
        ok: false,
        summary: 'Canvas entity not found.',
        mutationPlan: null,
        entity: null,
        snapshot,
      };
    }
    const plan = this.createCanvasPlan({
      entity,
      actionId: input.actionId,
      title: input.title || `Canvas: ${input.actionId}`,
      summary: input.summary || `Mutable action ${input.actionId} on ${entity.title}.`,
      payload: input.payload || {},
      requestedBy: input.requestedBy || null,
      sourceSurface: input.sourceSurface || 'workspace-canvas',
      approvalRequired: input.approvalRequired !== false,
      riskLevel: input.riskLevel || 'medium',
    });
    this.appendHistory({
      actor: input.requestedBy || null,
      entityId: entity.id,
      event: `canvas.${this.normalizeActionId(input.actionId)}`,
      summary: `MutationPlan ${plan.id} created for ${entity.title}.`,
      mutationPlanId: plan.id,
    });
    return {
      generatedAt: this.now().toISOString(),
      status: 'planned',
      ok: true,
      summary: `MutationPlan created for ${entity.title}.`,
      mutationPlan: plan,
      entity,
      snapshot: await this.buildSnapshot(),
    };
  }

  public async saveLayout(input: {
    entityId: string;
    position: Partial<CanvasEntityPosition>;
    requestedBy?: string | null;
  }): Promise<CanvasPlanResult> {
    const entityId = this.normalizeEntityId(input.entityId);
    const snapshot = await this.buildSnapshot();
    const entity = snapshot.entities.find((entry) => entry.id === entityId) || null;
    if (!entity) {
      return {
        generatedAt: this.now().toISOString(),
        status: 'blocked',
        ok: false,
        summary: 'Canvas entity not found for layout.',
        mutationPlan: null,
        entity: null,
        snapshot,
      };
    }
    const document = this.readDocument();
    document.layout.entityOverrides[entityId] = {
      ...(document.layout.entityOverrides[entityId] || {}),
      ...this.normalizePartialPosition(input.position),
    };
    const plan = this.createCanvasPlan({
      entity,
      actionId: 'save-layout',
      title: `Move ${entity.title} on canvas`,
      summary: 'Persist compact canvas layout without changing the canonical source.',
      payload: {
        entityId,
        position: document.layout.entityOverrides[entityId],
      },
      requestedBy: input.requestedBy || null,
      sourceSurface: 'workspace-canvas',
      approvalRequired: false,
      riskLevel: 'low',
    });
    this.appendHistoryToDocument(document, {
      actor: input.requestedBy || null,
      entityId,
      event: 'canvas.save-layout',
      summary: `Layout updated for ${entity.title}.`,
      mutationPlanId: plan.id,
    });
    this.writeDocument(document);
    return {
      generatedAt: this.now().toISOString(),
      status: 'planned',
      ok: true,
      summary: 'Layout persisted in compact recoverable state.',
      mutationPlan: plan,
      entity,
      snapshot: await this.buildSnapshot(),
    };
  }

  public async acquireLock(input: {
    entityId: string;
    owner: string;
    ttlMs?: number | null;
  }): Promise<CanvasPlanResult & { lock: CanvasLock | null }> {
    const entityId = this.normalizeEntityId(input.entityId);
    const owner = String(input.owner || '').trim() || 'operator';
    const document = this.pruneExpiredLocks(this.readDocument());
    const existing = document.locks.find((entry) => entry.entityId === entityId && entry.owner !== owner);
    const snapshot = await this.buildSnapshot();
    const entity = snapshot.entities.find((entry) => entry.id === entityId) || null;
    if (!entity || existing) {
      return {
        generatedAt: this.now().toISOString(),
        status: 'blocked',
        ok: false,
        summary: existing ? `Entity is already locked by ${existing.owner}.` : 'Canvas entity not found for lock.',
        mutationPlan: null,
        entity,
        snapshot,
        lock: existing || null,
      };
    }
    const plan = this.createCanvasPlan({
      entity,
      actionId: 'acquire-lock',
      title: `Lock leve em ${entity.title}`,
      summary: 'Lightweight collaborative lock for spatial canvas editing.',
      payload: { entityId, owner },
      requestedBy: owner,
      sourceSurface: 'workspace-canvas',
      approvalRequired: false,
      riskLevel: 'low',
    });
    const acquiredAt = this.now().toISOString();
    const ttlMs = Math.max(30_000, Math.min(Number(input.ttlMs || 5 * 60 * 1000), 60 * 60 * 1000));
    const lock = {
      entityId,
      owner,
      acquiredAt,
      expiresAt: new Date(this.now().getTime() + ttlMs).toISOString(),
      mutationPlanId: plan.id,
    };
    document.locks = [...document.locks.filter((entry) => !(entry.entityId === entityId && entry.owner === owner)), lock];
    this.appendHistoryToDocument(document, {
      actor: owner,
      entityId,
      event: 'canvas.lock-acquired',
      summary: `Lock adquirido por ${owner}.`,
      mutationPlanId: plan.id,
    });
    this.writeDocument(document);
    return {
      generatedAt: this.now().toISOString(),
      status: 'planned',
      ok: true,
      summary: `Lock adquirido por ${owner}.`,
      mutationPlan: plan,
      entity,
      snapshot: await this.buildSnapshot(),
      lock,
    };
  }

  public async releaseLock(input: {
    entityId: string;
    owner: string;
  }): Promise<CanvasPlanResult> {
    const entityId = this.normalizeEntityId(input.entityId);
    const owner = String(input.owner || '').trim() || 'operator';
    const document = this.pruneExpiredLocks(this.readDocument());
    const snapshot = await this.buildSnapshot();
    const entity = snapshot.entities.find((entry) => entry.id === entityId) || null;
    if (!entity) {
      return {
        generatedAt: this.now().toISOString(),
        status: 'blocked',
        ok: false,
        summary: 'Canvas entity not found for release lock.',
        mutationPlan: null,
        entity: null,
        snapshot,
      };
    }
    const plan = this.createCanvasPlan({
      entity,
      actionId: 'release-lock',
      title: `enable lock em ${entity.title}`,
      summary: 'enable lock colaboractive leve.',
      payload: { entityId, owner },
      requestedBy: owner,
      sourceSurface: 'workspace-canvas',
      approvalRequired: false,
      riskLevel: 'low',
    });
    document.locks = document.locks.filter((entry) => !(entry.entityId === entityId && entry.owner === owner));
    this.appendHistoryToDocument(document, {
      actor: owner,
      entityId,
      event: 'canvas.lock-released',
      summary: `Lock liberado por ${owner}.`,
      mutationPlanId: plan.id,
    });
    this.writeDocument(document);
    return {
      generatedAt: this.now().toISOString(),
      status: 'planned',
      ok: true,
      summary: `Lock liberado por ${owner}.`,
      mutationPlan: plan,
      entity,
      snapshot: await this.buildSnapshot(),
    };
  }

  public async attachSource(input: {
    entityId: string;
    kind: CanvasAttachmentKind;
    ref: string;
    title?: string | null;
    requestedBy?: string | null;
  }): Promise<CanvasPlanResult & { attachment: CanvasAttachment | null }> {
    const entityId = this.normalizeEntityId(input.entityId);
    const snapshot = await this.buildSnapshot();
    const entity = snapshot.entities.find((entry) => entry.id === entityId) || null;
    if (!entity) {
      return {
        generatedAt: this.now().toISOString(),
        status: 'blocked',
        ok: false,
        summary: 'Canvas entity not found for attachment.',
        mutationPlan: null,
        entity: null,
        snapshot,
        attachment: null,
      };
    }
    const plan = this.createCanvasPlan({
      entity,
      actionId: 'attach-source',
      title: `Anexar ${input.kind} a ${entity.title}`,
      summary: 'Anexo sensitive de Watch Mode/artifact/replay fica pending de approval.',
      payload: {
        entityId,
        kind: input.kind,
        ref: input.ref,
      },
      requestedBy: input.requestedBy || null,
      sourceSurface: 'workspace-canvas',
      approvalRequired: true,
      riskLevel: input.kind === 'screenshot' || input.kind === 'replay' ? 'medium' : 'low',
    });
    const document = this.readDocument();
    const attachment: CanvasAttachment = {
      id: `canvas-attachment-${crypto.randomUUID().slice(0, 10)}`,
      entityId,
      kind: input.kind,
      ref: String(input.ref || '').trim(),
      title: String(input.title || input.ref || input.kind).trim(),
      status: 'waiting_approval',
      mutationPlanId: plan.id,
      createdAt: this.now().toISOString(),
      createdBy: String(input.requestedBy || '').trim() || null,
    };
    document.attachments = [attachment, ...document.attachments.filter((entry) => entry.id !== attachment.id)].slice(0, 80);
    this.appendHistoryToDocument(document, {
      actor: input.requestedBy || null,
      entityId,
      event: 'canvas.attach-source',
      summary: `Anexo ${attachment.kind} pending de approval em ${entity.title}.`,
      mutationPlanId: plan.id,
    });
    this.writeDocument(document);
    return {
      generatedAt: this.now().toISOString(),
      status: 'planned',
      ok: true,
      summary: 'Anexo created como pending de approval.',
      mutationPlan: plan,
      entity,
      snapshot: await this.buildSnapshot(),
      attachment,
    };
  }

  public async approvePlan(input: {
    planId: string;
    approvedBy?: string | null;
  }): Promise<{
    generatedAt: string;
    ok: boolean;
    status: 'approved' | 'missing';
    plan: ZavorthMutationPlan | null;
    snapshot: CanvasWorkspaceSnapshot;
  }> {
    try {
      const plan = this.mutationPlaneService.approvePlan(input.planId, {
        approvedBy: input.approvedBy || 'canvas-operator',
        scope: 'once',
      });
      const document = this.readDocument();
      document.attachments = document.attachments.map((entry) =>
        entry.mutationPlanId === plan.id ? { ...entry, status: 'approved' } : entry,
      );
      this.appendHistoryToDocument(document, {
        actor: input.approvedBy || null,
        entityId: null,
        event: 'canvas.plan-approved',
        summary: `Plan ${plan.id} approved by canvas.`,
        mutationPlanId: plan.id,
      });
      this.writeDocument(document);
      return {
        generatedAt: this.now().toISOString(),
        ok: true,
        status: 'approved',
        plan,
        snapshot: await this.buildSnapshot(),
      };
    } catch (error: unknown) {logger.warn('[Canvas Workspace] creation failed', error);
    return {
        generatedAt: this.now().toISOString(),
        ok: false,
        status: 'missing',
        plan: null,
        snapshot: await this.buildSnapshot(),
      };
  }
  }

  private async readSources(limit: number): Promise<CanvasProjectionSources> {
    const [automation, watch, evals, rollout, federatedMesh, skillEvolution] = await Promise.all([
      this.safeSnapshot(this.automationService, { limit }),
      this.safeSnapshot(this.watchModeService, { limit }),
      this.safeSnapshot(this.evalControlPlaneService, { sourceSurface: 'workspace-canvas' }),
      this.safeSnapshot(this.rolloutReadinessService, { scope: 'local' }),
      this.safeSnapshot(this.federatedMeshService, { limit }),
      this.safeSnapshot(this.skillEvolutionService, { limit }),
    ]);
    return {
      automation,
      watch,
      evals,
      rollout,
      federatedMesh,
      skillEvolution,
      mutationPlans: this.safeMutationPlans(limit),
    };
  }

  private projectEntities(
    sources: CanvasProjectionSources,
    document: CanvasWorkspaceDocument,
    limit: number,
  ): CanvasEntity[] {
    const entities: CanvasEntity[] = [
      this.entity({
        id: 'canvas-chat',
        kind: 'chat',
        title: 'Session e chat',
        summary: 'Entrada conversacional preservada como fallback total do canvas.',
        status: 'idle',
        sourceRef: this.sourceRef('gateway', 'chat', 'session', 'npm run chat:fast'),
        position: this.positionFor(0, 0, document),
        metadata: { fallback: true },
        mutable: false,
        document,
      }),
      this.entity({
        id: 'canvas-files',
        kind: 'file',
        title: 'Workspace files',
        summary: 'Files remain the canonical source on the filesystem; canvas only stores reference and layout.',
        status: 'idle',
        sourceRef: this.sourceRef('workspace', this.workspaceRoot, 'filesystem', 'npm run ops:repo:doctor'),
        position: this.positionFor(1, 0, document),
        metadata: { workspaceRoot: this.workspaceRoot },
        mutable: false,
        document,
      }),
      this.entity({
        id: 'canvas-diffs',
        kind: 'diff',
        title: 'Diffs e patches',
        summary: 'Diffs point to the real Git workspace; nothing is duplicated in the canvas.',
        status: 'idle',
        sourceRef: this.sourceRef('git', 'working-tree', 'diff', 'git diff --stat'),
        position: this.positionFor(2, 0, document),
        metadata: { projection: 'git-diff' },
        mutable: false,
        document,
      }),
    ];

    entities.push(...this.projectAutomations(sources.automation, document, limit));
    entities.push(...this.projectNodes(sources.federatedMesh, document, limit));
    entities.push(...this.projectWatchArtifacts(sources.watch, document, limit));
    entities.push(...this.projectApprovals(sources.mutationPlans, document, limit));
    entities.push(this.projectEval(sources.evals, document));
    entities.push(this.projectRollout(sources.rollout, document));
    entities.push(this.projectSkillEvolution(sources.skillEvolution, document));

    return entities;
  }

  private projectAutomations(source: CanvasRecord | null, document: CanvasWorkspaceDocument, limit: number): CanvasEntity[] {
    const summary = asCanvasRecord(source?.summary) || {};
    const tasks = Array.isArray(source?.tasks) ? source.tasks.map(asCanvasRecord).filter(isCanvasRecord).slice(0, limit) : [];
    const entities = [
      this.entity({
        id: 'canvas-automations',
        kind: 'automation',
        title: 'Automations',
        summary: `${Number(summary.activeTasks || 0)} ativa(s), ${Number(summary.pausedTasks || 0)} pausada(s), scheduler core ${summary.coreSchedulerDormant ? 'dormant' : 'available'}.`,
        status: this.statusFromPosture(summary.posture),
        sourceRef: this.sourceRef('automation', null, 'control-plane', 'npm run ops:automations'),
        position: this.positionFor(0, 1, document),
        metadata: { summary },
        mutable: true,
        document,
      }),
    ];
    for (const [index, task] of tasks.entries()) {
      entities.push(this.entity({
        id: `canvas-automation-${this.normalizeEntityId(task.id || task.shortId || String(index))}`,
        kind: 'automation',
        title: String(task.prompt || task.id || 'Automation'),
        summary: `${task.schedule || 'schedule n/d'} | ${task.status || 'idle'}`,
        status: this.statusFromText(task.status),
        sourceRef: this.sourceRef('automation', stringOrNull(task.id), 'scheduled-task', 'npm run ops:automations'),
        position: this.positionFor(index + 1, 1, document),
        metadata: task,
        mutable: true,
        document,
      }));
    }
    return entities;
  }

  private projectNodes(source: CanvasRecord | null, document: CanvasWorkspaceDocument, limit: number): CanvasEntity[] {
    const summary = asCanvasRecord(source?.summary) || {};
    const nodes = Array.isArray(source?.nodes) ? source.nodes.map(asCanvasRecord).filter(isCanvasRecord).slice(0, limit) : [];
    const entities = [
      this.entity({
        id: 'canvas-federated-mesh',
        kind: 'node',
        title: 'Federated Mesh',
        summary: `${Number(summary.onlineNodes || 0)}/${Number(summary.remoteNodes || 0)} node(s) remote(s) online; infra ${summary.infrastructureState || 'unknown'}.`,
        status: this.statusFromPosture(summary.posture),
        sourceRef: this.sourceRef('federated-mesh', null, 'control-plane', 'npm run ops:federated-mesh'),
        position: this.positionFor(0, 2, document),
        metadata: { summary },
        mutable: false,
        document,
      }),
    ];
    for (const [index, node] of nodes.entries()) {
      entities.push(this.entity({
        id: `canvas-node-${this.normalizeEntityId(node.id || String(index))}`,
        kind: 'node',
        title: String(node.label || node.id || 'Node'),
        summary: `${node.profile || 'profile'} | ${node.status || 'unknown'} | ${Array.isArray(node.capabilityIds) ? node.capabilityIds.length : 0} capability(ies).`,
        status: this.statusFromText(node.status),
        sourceRef: this.sourceRef('federated-mesh', stringOrNull(node.id), 'node', 'npm run ops:federated-mesh'),
        position: this.positionFor(index + 1, 2, document),
        metadata: {
          profile: node.profile,
          trust: node.trust,
          capabilities: Array.isArray(node.capabilityIds) ? node.capabilityIds.slice(0, 12) : [],
        },
        mutable: false,
        document,
      }));
    }
    return entities;
  }

  private projectWatchArtifacts(source: CanvasRecord | null, document: CanvasWorkspaceDocument, limit: number): CanvasEntity[] {
    const summary = asCanvasRecord(source?.summary) || {};
    const watchMode = asCanvasRecord(source?.watchMode) || {};
    const runs = Array.isArray(watchMode.runs) ? watchMode.runs.slice(0, limit) : [];
    const artifacts = runs
      .flatMap((run) => {
        const record = asCanvasRecord(run);
        return Array.isArray(record?.artifacts) ? record.artifacts.map(asCanvasRecord).filter(isCanvasRecord) : [];
      })
      .slice(0, limit);
    const entities = [
      this.entity({
        id: 'canvas-watch-mode',
        kind: 'artifact',
        title: 'Watch Mode artifacts',
        summary: `${Number(summary.totalRuns || 0)} run(s), ${Number(summary.artifactEntries || 0)} artifact(s), status ${summary.activeStatus || 'idle'}.`,
        status: this.statusFromPosture(summary.posture),
        sourceRef: this.sourceRef('watch-mode', null, 'control-plane', 'npm run ops:watch-mode'),
        position: this.positionFor(0, 3, document),
        metadata: {
          activeStatus: summary.activeStatus,
          pendingApprovals: summary.pendingApprovals,
          note: 'Canvas does not start Watch Mode; it only projects persisted snapshots.',
        },
        mutable: true,
        document,
      }),
    ];
    for (const [index, artifact] of artifacts.entries()) {
      entities.push(this.entity({
        id: `canvas-artifact-${this.normalizeEntityId(artifact.id || artifact.ref || String(index))}`,
        kind: 'artifact',
        title: String(artifact.title || artifact.kind || artifact.id || 'Artifact'),
        summary: String(artifact.summary || artifact.ref || 'Artifact anexavel ao canvas.'),
        status: 'idle',
        sourceRef: this.sourceRef('watch-mode', stringOrNull(artifact.id || artifact.ref), 'artifact', 'npm run ops:watch-mode'),
        position: this.positionFor(index + 1, 3, document),
        metadata: artifact,
        mutable: true,
        document,
      }));
    }
    return entities;
  }

  private projectApprovals(
    plans: ZavorthMutationPlan[],
    document: CanvasWorkspaceDocument,
    limit: number,
  ): CanvasEntity[] {
    if (plans.length === 0) {
      return [
        this.entity({
          id: 'canvas-approvals',
          kind: 'approval',
          title: 'Approvals',
          summary: 'No recent pending MutationPlan is on the canvas.',
          status: 'idle',
          sourceRef: this.sourceRef('mutation-plane', null, 'plans', 'npm run ops:trust-plane'),
          position: this.positionFor(0, 4, document),
          metadata: { plans: 0 },
          mutable: true,
          document,
        }),
      ];
    }
    return plans.slice(0, limit).map((plan, index) => this.entity({
      id: `canvas-approval-${this.normalizeEntityId(plan.id)}`,
      kind: 'approval',
      title: plan.title || plan.actionId,
      summary: `${plan.domain}/${plan.actionId} | ${plan.status} | risk ${plan.riskLevel}`,
      status: plan.status === 'waiting_approval' ? 'waiting_approval' : this.statusFromText(plan.status),
      sourceRef: this.sourceRef('mutation-plane', plan.id, 'mutation-plan', 'npm run ops:trust-plane'),
      position: this.positionFor(index, 4, document),
      metadata: {
        planId: plan.id,
        domain: plan.domain,
        actionId: plan.actionId,
        approval: plan.approval,
        readinessGates: plan.readinessGates?.map((gate) => ({
          id: gate.id,
          status: gate.status,
          canProceed: gate.canProceed,
        })) || [],
      },
      mutable: true,
      document,
    }));
  }

  private projectEval(source: CanvasRecord | null, document: CanvasWorkspaceDocument): CanvasEntity {
    const summary = asCanvasRecord(source?.summary) || {};
    const gate = asCanvasRecord(source?.regressionGate);
    return this.entity({
      id: 'canvas-evals',
      kind: 'eval',
      title: 'Eval and observability',
      summary: gate ? `Gate ${gate.status}; ${Number(summary.regressions || 0)} regression(s), ${Number(summary.scorecards || 0)} scorecard(s).`
        : 'Eval plane not loaded in this snapshot; CLI fallback still available.',
      status: this.statusFromPosture(summary.posture || gate?.status),
      sourceRef: this.sourceRef('eval', null, 'control-plane', 'npm run ops:evals'),
      position: this.positionFor(0, 5, document),
      metadata: { summary, regressionGate: gate },
      mutable: false,
      document,
    });
  }

  private projectRollout(source: CanvasRecord | null, document: CanvasWorkspaceDocument): CanvasEntity {
    const summary = asCanvasRecord(source?.summary) || {};
    return this.entity({
      id: 'canvas-rollout-readiness',
      kind: 'task',
      title: 'Rollout readiness',
      summary: `Gate ${summary.gateStatus || 'unknown'}; scope ${summary.scope || 'local'}; canProceed=${summary.canProceed === true ? 'yes' : 'no'}.`,
      status: this.statusFromPosture(summary.posture || summary.gateStatus),
      sourceRef: this.sourceRef('rollout', null, 'readiness-gate', 'npm run ops:rollout-readiness'),
      position: this.positionFor(1, 5, document),
      metadata: {
        summary,
        gate: source?.gate || null,
      },
      mutable: false,
      document,
    });
  }

  private projectSkillEvolution(source: CanvasRecord | null, document: CanvasWorkspaceDocument): CanvasEntity {
    const summary = asCanvasRecord(source?.summary) || {};
    return this.entity({
      id: 'canvas-skill-evolution',
      kind: 'task',
      title: 'Auto-Skill Evolution',
      summary: `${Number(summary.total || 0)} record(s), ${Number(summary.waitingApproval || 0)} waiting for approval, heavy=${summary.heavyRuntimesStarted ? 'yes' : 'no'}.`,
      status: this.statusFromPosture(summary.posture),
      sourceRef: this.sourceRef('skill-evolution', null, 'control-plane', 'npm run ops:skill-evolution'),
      position: this.positionFor(2, 5, document),
      metadata: {
        summary,
        records: Array.isArray(source?.records) ? source.records.slice(0, 8).map((entry) => asCanvasRecord(entry)).filter(isCanvasRecord).map((entry) => ({
          id: entry.id,
          skillName: entry.skillName,
          status: entry.status,
        })) : [],
      },
      mutable: true,
      document,
    });
  }

  private buildDiagrams(sources: CanvasProjectionSources): CanvasWorkspaceSnapshot['diagrams'] {
    return [
      {
        id: 'canvas-diagram-automation-flow',
        title: 'Automation approval flow',
        kind: 'flowchart',
        mermaid: [
          'flowchart LR',
          '  "Intent" --> "MutationPlan"',
          '  "MutationPlan" --> "Approval"',
          '  "Approval" --> "Scheduler"',
          '  "Scheduler" --> "Outbox"',
          '  "Outbox" --> "Audit"',
        ].join('\n'),
        sourceRefs: [
          this.sourceRef('automation', null, 'control-plane', 'npm run ops:automations'),
          this.sourceRef('mutation-plane', null, 'plans', 'npm run ops:trust-plane'),
        ],
      },
      {
        id: 'canvas-diagram-federated-mesh',
        title: 'Federated mesh route flow',
        kind: 'flowchart',
        mermaid: [
          'flowchart LR',
          '  "Capability" --> "Route Planner"',
          '  "Route Planner" --> "Trust Plane"',
          '  "Trust Plane" --> "Node Queue"',
          '  "Node Queue" --> "Heartbeat"',
          '  "Heartbeat" --> "Audit"',
        ].join('\n'),
        sourceRefs: [
          this.sourceRef('federated-mesh', stringOrNull(sources.federatedMesh?.localNodeId), 'route-planner', 'npm run ops:federated-mesh'),
        ],
      },
    ];
  }

  private buildSourceHealth(sources: CanvasProjectionSources): CanvasWorkspaceSnapshot['sourceHealth'] {
    return [
      this.health('automation', asCanvasRecord(sources.automation?.summary)?.posture, 'Automations control plane', 'npm run ops:automations'),
      this.health('watch-mode', asCanvasRecord(sources.watch?.summary)?.posture, 'Watch Mode projection; does not start capture.', 'npm run ops:watch-mode'),
      this.health('federated-mesh', asCanvasRecord(sources.federatedMesh?.summary)?.posture, 'Federated Mesh projection.', 'npm run ops:federated-mesh'),
      this.health('eval', asCanvasRecord(sources.evals?.summary)?.posture, sources.evals ? 'Eval control plane loaded.' : 'Eval control plane unavailable in this snapshot.', 'npm run ops:evals'),
      this.health('rollout', asCanvasRecord(sources.rollout?.summary)?.posture, 'Rollout readiness projection.', 'npm run ops:rollout-readiness'),
      this.health('skill-evolution', asCanvasRecord(sources.skillEvolution?.summary)?.posture, 'Auto-Skill Evolution projection.', 'npm run ops:skill-evolution'),
    ];
  }

  private health(
    plane: string,
    posture: unknown,
    summary: string,
    command: string,
  ): CanvasWorkspaceSnapshot['sourceHealth'][number] {
    const normalized = String(posture || '').trim();
    return {
      plane,
      status: normalized === 'healthy' || normalized === 'attention' || normalized === 'critical'
        ? normalized
        : 'unavailable',
      summary,
      command,
    };
  }

  private entity(input: {
    id: string;
    kind: CanvasEntityKind;
    title: string;
    summary: string;
    status: CanvasEntity['status'];
    position: CanvasEntityPosition;
    sourceRef: CanvasSourceRef;
    metadata: Record<string, unknown>;
    mutable: boolean;
    document: CanvasWorkspaceDocument;
  }): CanvasEntity {
    const normalizedId = this.normalizeEntityId(input.id);
    const override = input.document.layout.entityOverrides[normalizedId] || {};
    return {
      id: normalizedId,
      kind: input.kind,
      title: input.title,
      summary: input.summary,
      status: input.status,
      position: {
        ...input.position,
        ...this.normalizePartialPosition(override),
      },
      compact: override.collapsed === true,
      mutable: input.mutable,
      sourceRef: input.sourceRef,
      metadata: input.metadata,
      attachments: [],
      actions: this.buildEntityActions(input.kind, normalizedId, input.mutable),
    };
  }

  private buildEntityActions(
    kind: CanvasEntityKind,
    entityId: string,
    mutable: boolean,
  ): CanvasEntity['actions'] {
    const actions: CanvasEntity['actions'] = [
      {
        id: 'inspect-source',
        label: 'Inspect source',
        command: null,
        mutationRequired: false,
      },
      {
        id: 'lock',
        label: 'Lock leve',
        command: `npm run ops:canvas -- --lock --entity ${entityId}`,
        mutationRequired: true,
      },
    ];
    if (kind === 'approval') {
      actions.push({
        id: 'approve',
        label: 'Approve plan',
        command: `npm run ops:canvas -- --approve <planId>`,
        mutationRequired: true,
      });
    }
    if (mutable) {
      actions.push({
        id: 'attach',
        label: 'Anexar artifact/replay',
        command: `npm run ops:canvas -- --attach --entity ${entityId} --kind artifact --ref <ref>`,
        mutationRequired: true,
      });
    }
    return actions;
  }

  private createCanvasPlan(input: {
    entity: CanvasEntity;
    actionId: string;
    title: string;
    summary: string;
    payload: Record<string, unknown>;
    requestedBy: string | null;
    sourceSurface: string;
    approvalRequired: boolean;
    riskLevel: ZavorthMutationRiskLevel;
  }): ZavorthMutationPlan {
    return this.mutationPlaneService.createPlan({
      domain: 'workspace-canvas',
      actionId: this.normalizeActionId(input.actionId),
      title: input.title,
      summary: input.summary,
      requestedBy: input.requestedBy,
      sourceSurface: input.sourceSurface,
      riskLevel: input.riskLevel,
      approvalRequired: input.approvalRequired,
      approvalReason: input.approvalRequired ? 'Mutable action on Workspace Canvas requires approval/audit before changing sensitive sources.'
        : 'local projection state mutation logged for audit.',
      resourceImpact: {
        ramMb: 0,
        diskMb: 1,
        processCount: 0,
        externalExposure: 'none',
        recurring: false,
        notes: [
          'Canvas is projection-only.',
          `entity=${input.entity.id}`,
          `kind=${input.entity.kind}`,
        ],
      },
      readinessGates: [
        {
          id: 'canvas-projection-only',
          status: 'passed',
          canProceed: true,
          scope: input.entity.id,
          reasons: ['Canvas state does not replace the canonical source.'],
          warnings: [],
          blockers: [],
          checkedAt: this.now().toISOString(),
        },
      ],
      validationPlan: [
        'Confirm real sourceRef before applying mutation.',
        'Keep CLI/chat fallback when canvas is unavailable.',
      ],
      rollbackPlan: [
        'Revert projection state only when the mutation touches layout/lock/attachment.',
        'For canonical sources, follow the original MutationPlan rollback.',
      ],
      retentionPolicy: {
        ttlMs: 24 * 60 * 60 * 1000,
        cleanupOnSuccess: true,
        cleanupOnBoot: true,
        notes: ['Canvas actions sao compactas e auditaveis.'],
      },
      payload: {
        entityId: input.entity.id,
        entityKind: input.entity.kind,
        sourceRef: input.entity.sourceRef,
        ...input.payload,
      },
    });
  }

  private sourceRef(
    plane: string,
    id: string | null,
    kind: string,
    command: string,
    sourcePath: string | null = null,
  ): CanvasSourceRef {
    return {
      plane,
      id,
      kind,
      path: sourcePath,
      command,
      live: false,
    };
  }

  private positionFor(index: number, row: number, document: CanvasWorkspaceDocument): CanvasEntityPosition {
    const column = index % 4;
    const lane = Math.floor(index / 4);
    return {
      x: 80 + (column * 340),
      y: 80 + ((row + lane) * 220),
      width: 300,
      height: 160,
      ...this.normalizePartialPosition(document.layout.entityOverrides[`pos-${row}-${index}`] || {}),
    };
  }

  private resolvePosture(
    health: CanvasWorkspaceSnapshot['sourceHealth'],
    pendingApprovals: number,
  ): CanvasWorkspaceSnapshot['summary']['posture'] {
    if (health.some((entry) => entry.status === 'critical')) {
      return 'critical';
    }
    if (pendingApprovals > 0 || health.some((entry) => entry.status === 'attention' || entry.status === 'unavailable')) {
      return 'attention';
    }
    return 'healthy';
  }

  private statusFromPosture(value: unknown): CanvasEntity['status'] {
    const normalized = String(value || '').trim();
    if (normalized === 'healthy' || normalized === 'attention' || normalized === 'critical') {
      return normalized;
    }
    if (normalized === 'failed' || normalized === 'blocked') {
      return 'blocked';
    }
    if (normalized === 'warning') {
      return 'attention';
    }
    return 'idle';
  }

  private statusFromText(value: unknown): CanvasEntity['status'] {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized.includes('critical') || normalized.includes('failed')) {
      return 'critical';
    }
    if (normalized.includes('blocked') || normalized.includes('revoked')) {
      return 'blocked';
    }
    if (normalized.includes('waiting')) {
      return 'waiting_approval';
    }
    if (normalized.includes('attention') || normalized.includes('offline') || normalized.includes('stale')) {
      return 'attention';
    }
    if (normalized.includes('online') || normalized.includes('healthy') || normalized.includes('approved')) {
      return 'healthy';
    }
    return 'idle';
  }

  private async safeSnapshot(service: SnapshotLike | null, input: unknown): Promise<CanvasRecord | null> {
    if (!service) {
      return null;
    }
    try {
      if (typeof service.buildSnapshot !== 'function') {
        return null;
      }
      return asCanvasRecord(await (service.buildSnapshot as (input?: unknown) => unknown | Promise<unknown>)(input));
    } catch (error: unknown) {logger.warn('[Canvas Workspace] creation failed', error); return null; }
  }

  private safeMutationPlans(limit: number): ZavorthMutationPlan[] {
    try {
      return this.mutationPlaneService.listPlans({ limit, includeExpired: false });
    } catch (error: unknown) {logger.warn('[Canvas Workspace] creation failed', error); return []; }
  }

  private readDocument(): CanvasWorkspaceDocument {
    try {
      if (!this.existsSync(this.stateFile)) {
        return this.emptyDocument();
      }
      const parsed = JSON.parse(this.readFileSync(this.stateFile, 'utf8')) as Partial<CanvasWorkspaceDocument>;
      return this.normalizeDocument(parsed);
    } catch (error: unknown) {logger.warn('[Canvas Workspace] JSON parse failed', error);
    return this.emptyDocument();
  }
  }

  private writeDocument(document: CanvasWorkspaceDocument): void {
    const normalized = this.normalizeDocument({
      ...document,
      updatedAt: this.now().toISOString(),
    });
    this.mkdirSync(path.dirname(this.stateFile), { recursive: true });
    this.writeFileSync(this.stateFile, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  }

  private emptyDocument(): CanvasWorkspaceDocument {
    return {
      version: 1,
      updatedAt: null,
      layout: {
        viewport: {
          x: 0,
          y: 0,
          zoom: 1,
        },
        entityOverrides: {},
      },
      locks: [],
      attachments: [],
      history: [],
    };
  }

  private normalizeDocument(input: Partial<CanvasWorkspaceDocument> | null | undefined): CanvasWorkspaceDocument {
    const fallback = this.emptyDocument();
    return {
      version: 1,
      updatedAt: typeof input?.updatedAt === 'string' ? input.updatedAt : null,
      layout: {
        viewport: {
          x: this.number(input?.layout?.viewport?.x, fallback.layout.viewport.x),
          y: this.number(input?.layout?.viewport?.y, fallback.layout.viewport.y),
          zoom: Math.max(0.1, Math.min(this.number(input?.layout?.viewport?.zoom, fallback.layout.viewport.zoom), 4)),
        },
        entityOverrides: input?.layout?.entityOverrides && typeof input.layout.entityOverrides === 'object'
          ? Object.fromEntries(Object.entries(input.layout.entityOverrides).map(([key, value]) => [
              this.normalizeEntityId(key),
              {
                ...this.normalizePartialPosition(value || {}),
                ...(value?.collapsed === true ? { collapsed: true } : {}),
              },
            ]))
          : {},
      },
      locks: Array.isArray(input?.locks) ? input.locks.map((entry) => this.normalizeLock(entry)).filter(Boolean) as CanvasLock[] : [],
      attachments: Array.isArray(input?.attachments) ? input.attachments.map((entry) => this.normalizeAttachment(entry)).filter(Boolean) as CanvasAttachment[] : [],
      history: Array.isArray(input?.history) ? input.history.map((entry) => this.normalizeHistory(entry)).filter(Boolean).slice(0, 120) as CanvasHistoryEvent[] : [],
    };
  }

  private pruneExpiredLocks(document: CanvasWorkspaceDocument): CanvasWorkspaceDocument {
    const nowMs = this.now().getTime();
    const locks = document.locks.filter((entry) => {
      const expiresAt = Date.parse(entry.expiresAt);
      return Number.isFinite(expiresAt) && expiresAt > nowMs;
    });
    if (locks.length !== document.locks.length) {
      this.writeDocument({ ...document, locks });
    }
    return { ...document, locks };
  }

  private appendHistory(input: Omit<CanvasHistoryEvent, 'id' | 'at'>): void {
    const document = this.readDocument();
    this.appendHistoryToDocument(document, input);
    this.writeDocument(document);
  }

  private appendHistoryToDocument(
    document: CanvasWorkspaceDocument,
    input: Omit<CanvasHistoryEvent, 'id' | 'at'>,
  ): void {
    document.history = [
      {
        id: `canvas-history-${crypto.randomUUID().slice(0, 10)}`,
        at: this.now().toISOString(),
        actor: String(input.actor || '').trim() || null,
        entityId: input.entityId ? this.normalizeEntityId(input.entityId) : null,
        event: String(input.event || 'canvas.event').trim(),
        summary: String(input.summary || '').trim(),
        mutationPlanId: String(input.mutationPlanId || '').trim() || null,
      },
      ...document.history,
    ].slice(0, 120);
  }

  private normalizeLock(input: Partial<CanvasLock> | null | undefined): CanvasLock | null {
    const entityId = this.normalizeEntityId(input?.entityId);
    const owner = String(input?.owner || '').trim();
    const acquiredAt = String(input?.acquiredAt || '').trim();
    const expiresAt = String(input?.expiresAt || '').trim();
    if (!entityId || !owner || !expiresAt) {
      return null;
    }
    return {
      entityId,
      owner,
      acquiredAt: acquiredAt || this.now().toISOString(),
      expiresAt,
      mutationPlanId: String(input?.mutationPlanId || '').trim() || null,
    };
  }

  private normalizeAttachment(input: Partial<CanvasAttachment> | null | undefined): CanvasAttachment | null {
    const entityId = this.normalizeEntityId(input?.entityId);
    const ref = String(input?.ref || '').trim();
    if (!entityId || !ref) {
      return null;
    }
    const kind = this.normalizeAttachmentKind(input?.kind);
    const id = String(input?.id || `canvas-attachment-${crypto.createHash('sha1').update(`${entityId}:${ref}`).digest('hex').slice(0, 10)}`).trim();
    const status = input?.status === 'approved' || input?.status === 'revoked' ? input.status : 'waiting_approval';
    return {
      id,
      entityId,
      kind,
      ref,
      title: String(input?.title || ref).trim(),
      status,
      mutationPlanId: String(input?.mutationPlanId || '').trim() || null,
      createdAt: String(input?.createdAt || this.now().toISOString()).trim(),
      createdBy: String(input?.createdBy || '').trim() || null,
    };
  }

  private normalizeHistory(input: Partial<CanvasHistoryEvent> | null | undefined): CanvasHistoryEvent | null {
    const event = String(input?.event || '').trim();
    if (!event) {
      return null;
    }
    return {
      id: String(input?.id || `canvas-history-${crypto.randomUUID().slice(0, 10)}`).trim(),
      at: String(input?.at || this.now().toISOString()).trim(),
      actor: String(input?.actor || '').trim() || null,
      entityId: input?.entityId ? this.normalizeEntityId(input.entityId) : null,
      event,
      summary: String(input?.summary || event).trim(),
      mutationPlanId: String(input?.mutationPlanId || '').trim() || null,
    };
  }

  private normalizeAttachmentKind(value: unknown): CanvasAttachmentKind {
    const normalized = String(value || '').trim();
    if (
      normalized === 'screenshot'
      || normalized === 'replay'
      || normalized === 'artifact'
      || normalized === 'diff'
      || normalized === 'file'
    ) {
      return normalized;
    }
    return 'artifact';
  }

  private normalizePartialPosition(value: unknown): Partial<CanvasEntityPosition> {
    const input = value && typeof value === 'object' ? value as Partial<CanvasEntityPosition> : {};
    const output: Partial<CanvasEntityPosition> = {};
    if (Number.isFinite(Number(input.x))) output.x = Number(input.x);
    if (Number.isFinite(Number(input.y))) output.y = Number(input.y);
    if (Number.isFinite(Number(input.width))) output.width = Math.max(120, Number(input.width));
    if (Number.isFinite(Number(input.height))) output.height = Math.max(80, Number(input.height));
    return output;
  }

  private normalizeEntityId(value: unknown): string {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_.:-]+/g, '-') || 'canvas-entity';
  }

  private normalizeActionId(value: unknown): string {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_.:-]+/g, '-') || 'canvas-action';
  }

  private number(value: unknown, fallback: number): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }
}

function asCanvasRecord(value: unknown): CanvasRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as CanvasRecord : null;
}

function isCanvasRecord(value: CanvasRecord | null): value is CanvasRecord {
  return value !== null;
}

function stringOrNull(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}
