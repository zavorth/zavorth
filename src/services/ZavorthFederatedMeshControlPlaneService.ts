import {
  ZavorthDistributedRuntimeControlPlaneService,
  type ZavorthDistributedRuntimeSnapshot,
  type AsyncSnapshotLike,
} from './ZavorthDistributedRuntimeControlPlaneService.js';
import { ZavorthMutationPlaneService } from './ZavorthMutationPlaneService.js';
import crypto from 'crypto';
import os from 'os';
import { config } from '../config/index.js';
import type {
  ZavorthMutationPlan,
  ZavorthMutationRiskLevel,
  ZavorthReadinessGate,
} from '../contracts/ZavorthMutationPlaneContract.js';
import type {
  NodeInvocationResult,
  NodeMeshCapabilityId,
  NodeMeshHostHints,
  NodeMeshNodeKind,
  NodeMeshRegistryEntry,
  NodeMeshTransport,
} from '../contracts/NodeMeshContract.js';


import { ZavorthNodeMeshService } from './ZavorthNodeMeshService.js';
import { NodeCapabilityService } from './NodeCapabilityService.js';
import { NodeInvokeService } from './NodeInvokeService.js';
import { NodePairingService } from './NodePairingService.js';
import { NodeRegistryService } from './NodeRegistryService.js';
import { TrustDecisionService, type TrustDecision } from './TrustDecisionService.js';
import { logger } from '../logger.js';

export type FederatedMeshProfile =
  | 'local'
  | 'lan'
  | 'private-tunnel'
  | 'official-remote'
  | 'mobile'
  | 'gpu-worker';

export type FederatedMeshTrust = 'trusted' | 'review' | 'blocked';
export type FederatedMeshNodeStatus = 'local' | 'paired' | 'online' | 'stale' | 'offline' | 'revoked';
export type FederatedMeshInfrastructureState = 'mesh_online' | 'offline' | 'dormant';
export type FederatedMeshRouteStatus =
  | 'routed'
  | 'queued'
  | 'waiting_approval'
  | 'fallback_local'
  | 'blocked'
  | 'dormant';

export type FederatedMeshCommandScope = 'read' | 'write' | 'execute' | 'observe' | 'notify';

export type FederatedMeshTransportHealth = {
  status: 'online' | 'stale' | 'offline' | 'revoked' | 'local';
  heartbeatAgeMs: number | null;
  leaseExpiresAt: string | null;
  latencyMs: number;
  costScore: number;
  batteryPercent: number | null;
  networkType: string | null;
};

export type FederatedMeshNodeView = {
  id: string;
  label: string;
  source: 'local' | 'node-mesh';
  profile: FederatedMeshProfile;
  trust: FederatedMeshTrust;
  status: FederatedMeshNodeStatus;
  paired: boolean;
  revoked: boolean;
  commandScopes: FederatedMeshCommandScope[];
  capabilityIds: NodeMeshCapabilityId[];
  approvedCapabilityIds: NodeMeshCapabilityId[];
  transport: NodeMeshTransport | 'local';
  transportHealth: FederatedMeshTransportHealth;
  hostHints: NodeMeshHostHints;
  operatorSummary: string;
  reasons: string[];
};

export type FederatedMeshRouteCandidate = {
  node: FederatedMeshNodeView;
  eligible: boolean;
  score: number;
  reasons: string[];
  blockers: string[];
};

export type FederatedMeshQueueControl = {
  idempotencyKey: string;
  retry: {
    maxAttempts: number;
    backoffMs: number;
  };
  cancelToken: string;
  cancellable: boolean;
};

export type FederatedMeshRouteDecision = {
  generatedAt: string;
  capabilityId: NodeMeshCapabilityId;
  action: string;
  mutable: boolean;
  status: FederatedMeshRouteStatus;
  selectedNode: FederatedMeshNodeView | null;
  candidates: FederatedMeshRouteCandidate[];
  reasons: string[];
  blockers: string[];
  queueControl: FederatedMeshQueueControl;
  mutationPlan: ZavorthMutationPlan | null;
  trustDecision: TrustDecision | null;
  invocationResult: NodeInvocationResult | null;
};

export type FederatedMeshSnapshot = {
  generatedAt: string;
  localNodeId: string;
  summary: {
    posture: 'healthy' | 'attention' | 'critical';
    implementationReady: true;
    infrastructureState: FederatedMeshInfrastructureState;
    heavyRuntimesStarted: false;
    totalNodes: number;
    remoteNodes: number;
    pairedNodes: number;
    onlineNodes: number;
    revokedNodes: number;
    staleNodes: number;
    dormantProfiles: number;
    capabilityCount: number;
    routeableCapabilities: number;
  };
  profiles: Array<{
    profile: FederatedMeshProfile;
    configured: boolean;
    online: number;
    dormant: boolean;
    summary: string;
  }>;
  nodes: FederatedMeshNodeView[];
  capabilityInventory: Array<{
    id: NodeMeshCapabilityId;
    label: string;
    risky: boolean;
    supportedNodes: string[];
    routeableNodes: string[];
  }>;
  transportHealth: Array<{
    profile: FederatedMeshProfile;
    status: FederatedMeshTransportHealth['status'] | 'dormant';
    online: number;
    configured: number;
    summary: string;
  }>;
  routePreview: FederatedMeshRouteDecision | null;
  distributedRuntime: {
    posture: string;
    implementationReady: true;
    infrastructureState: FederatedMeshInfrastructureState;
    offlineReason: string | null;
  };
  policy: {
    mutableRemoteRequiresApproval: true;
    localFallback: true;
    leasesRequired: true;
    revocationSupported: true;
    idempotentQueue: true;
    retryBackoff: true;
    cancellationTokens: true;
  };
  actions: Array<{
    id: string;
    label: string;
    severity: 'info' | 'warn' | 'critical';
    command: string;
    reason: string;
  }>;
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};

type FederatedMeshRuntime = {
  now?: () => Date;
  localNodeId?: string | null;
  registryService?: NodeRegistryService;
  pairingService?: NodePairingService;
  invokeService?: NodeInvokeService;
  nodeMeshService?: Pick<ZavorthNodeMeshService, 'buildSnapshot'>;
  capabilityService?: NodeCapabilityService;
  distributedRuntimeService?: Pick<ZavorthDistributedRuntimeControlPlaneService, 'buildSnapshot'>;
  mutationPlaneService?: Pick<ZavorthMutationPlaneService, 'createPlan' | 'attachApproval'>;
  trustDecisionService?: Pick<TrustDecisionService, 'evaluate'>;
};

type PairNodeInput = {
  nodeId?: string | null;
  label?: string | null;
  profile?: FederatedMeshProfile | null;
  trust?: FederatedMeshTrust | null;
  capabilityIds?: NodeMeshCapabilityId[] | null;
  commandScopes?: FederatedMeshCommandScope[] | null;
  requestedBy?: string | null;
  sourceSurface?: string | null;
  hostHints?: Partial<NodeMeshHostHints> | null;
};

type HeartbeatInput = {
  nodeId: string;
  status?: 'online' | 'idle' | 'offline' | null;
  capabilityIds?: NodeMeshCapabilityId[] | null;
  latencyMs?: number | null;
  costScore?: number | null;
  batteryPercent?: number | null;
  networkType?: string | null;
  trust?: FederatedMeshTrust | null;
  commandScopes?: FederatedMeshCommandScope[] | null;
  hostHints?: Partial<NodeMeshHostHints> | null;
};

type RouteInput = {
  capabilityId: NodeMeshCapabilityId;
  action?: string | null;
  payload?: Record<string, unknown> | null;
  mutable?: boolean | null;
  persist?: boolean;
  requestedBy?: string | null;
  sourceSurface?: string | null;
  preferProfile?: FederatedMeshProfile | null;
  allowLocalFallback?: boolean;
};

const FEDERATED_PROFILES: FederatedMeshProfile[] = [
  'local',
  'lan',
  'private-tunnel',
  'official-remote',
  'mobile',
  'gpu-worker',
];

const PROFILE_DEFAULT_LATENCY: Record<FederatedMeshProfile, number> = {
  local: 1,
  lan: 15,
  'private-tunnel': 65,
  'official-remote': 110,
  mobile: 90,
  'gpu-worker': 35,
};

const PROFILE_DEFAULT_COST: Record<FederatedMeshProfile, number> = {
  local: 1,
  lan: 2,
  'private-tunnel': 4,
  'official-remote': 6,
  mobile: 5,
  'gpu-worker': 7,
};

export class ZavorthFederatedMeshControlPlaneService {
  private readonly now: () => Date;
  private readonly localNodeId: string;
  private readonly registryService: NodeRegistryService;
  private readonly pairingService: NodePairingService;
  private readonly invokeService: NodeInvokeService;
  private readonly nodeMeshService: Pick<ZavorthNodeMeshService, 'buildSnapshot'>;
  private readonly capabilityService: NodeCapabilityService;
  private readonly distributedRuntimeService: Pick<ZavorthDistributedRuntimeControlPlaneService, 'buildSnapshot'>;
  private readonly mutationPlaneService: Pick<ZavorthMutationPlaneService, 'createPlan' | 'attachApproval'>;
  private readonly trustDecisionService: Pick<TrustDecisionService, 'evaluate'>;

  constructor(runtime: FederatedMeshRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.localNodeId = this.normalizeNodeId(runtime.localNodeId || `local-${os.hostname() || 'host'}`);
    this.registryService = runtime.registryService || new NodeRegistryService({ now: this.now });
    this.pairingService = runtime.pairingService || new NodePairingService({
      now: this.now,
      registryService: this.registryService,
    });
    this.invokeService = runtime.invokeService || new NodeInvokeService({
      now: this.now,
      registryService: this.registryService,
    });
    this.nodeMeshService = runtime.nodeMeshService || new ZavorthNodeMeshService({
      now: this.now,
      registryService: this.registryService,
      invokeService: this.invokeService,
    });
    this.capabilityService = runtime.capabilityService || new NodeCapabilityService();
    this.distributedRuntimeService = runtime.distributedRuntimeService || new ZavorthDistributedRuntimeControlPlaneService({
      now: this.now,
      nodeMeshService: this.nodeMeshService,
    });
    this.mutationPlaneService = runtime.mutationPlaneService || new ZavorthMutationPlaneService();
    this.trustDecisionService = runtime.trustDecisionService || new TrustDecisionService();
  }

  public async buildSnapshot(input: {
    routeCapabilityId?: NodeMeshCapabilityId | null;
    selectedNodeId?: string | null;
  } = {}): Promise<FederatedMeshSnapshot> {
    const generatedAt = this.now().toISOString();
    const nodes = this.buildNodeViews();
    const remoteNodes = nodes.filter((entry) => entry.source === 'node-mesh');
    const onlineNodes = remoteNodes.filter((entry) => entry.status === 'online');
    const revokedNodes = remoteNodes.filter((entry) => entry.revoked);
    const staleNodes = remoteNodes.filter((entry) => entry.status === 'stale');
    const capabilityInventory = this.buildCapabilityInventory(nodes);
    const infrastructureState = this.resolveInfrastructureState(remoteNodes);
    const distributedRuntime = await this.safeDistributedRuntimeSnapshot();
    const routePreview = input.routeCapabilityId
      ? await this.routeCapability({
          capabilityId: input.routeCapabilityId,
          persist: false,
          requestedBy: 'snapshot-preview',
          sourceSurface: 'federated-mesh',
        })
      : null;
    const summary = {
      posture: this.resolvePosture(remoteNodes, infrastructureState),
      implementationReady: true as const,
      infrastructureState,
      heavyRuntimesStarted: false as const,
      totalNodes: nodes.length,
      remoteNodes: remoteNodes.length,
      pairedNodes: remoteNodes.filter((entry) => entry.paired).length,
      onlineNodes: onlineNodes.length,
      revokedNodes: revokedNodes.length,
      staleNodes: staleNodes.length,
      dormantProfiles: FEDERATED_PROFILES.filter((profile) =>
        profile !== 'local' && !remoteNodes.some((entry) => entry.profile === profile),
      ).length,
      capabilityCount: capabilityInventory.length,
      routeableCapabilities: capabilityInventory.filter((entry) => entry.routeableNodes.length > 0).length,
    };

    return {
      generatedAt,
      localNodeId: this.localNodeId,
      summary,
      profiles: this.buildProfileSummary(nodes),
      nodes,
      capabilityInventory,
      transportHealth: this.buildTransportHealth(nodes),
      routePreview,
      distributedRuntime: {
        posture: String(distributedRuntime?.summary?.posture || 'unknown'),
        implementationReady: true,
        infrastructureState,
        offlineReason: infrastructureState === 'mesh_online'
          ? null
          : this.describeOfflineReason(remoteNodes, infrastructureState),
      },
      policy: {
        mutableRemoteRequiresApproval: true,
        localFallback: true,
        leasesRequired: true,
        revocationSupported: true,
        idempotentQueue: true,
        retryBackoff: true,
        cancellationTokens: true,
      },
      actions: this.buildActions(remoteNodes, infrastructureState),
      narrative: {
        headline: 'Federated Node Mesh 2.0',
        operatorSummary: this.buildOperatorSummary(summary),
        nextAction: this.buildNextAction(remoteNodes, infrastructureState),
      },
    };
  }

  public pairNode(input: PairNodeInput = {}): {
    generatedAt: string;
    status: 'paired';
    node: FederatedMeshNodeView;
    pairingCode: string;
    bootstrapCommand: string | null;
    summary: string;
  } {
    const profile = this.normalizeProfile(input.profile || 'lan');
    const draft = this.pairingService.createPairingDraft({
      nodeId: input.nodeId,
      label: input.label || this.defaultLabel(profile),
      profileId: this.toNodeMeshProfileId(profile),
      kind: this.toNodeMeshKind(profile),
      transport: this.toNodeMeshTransport(profile),
      capabilityIds: input.capabilityIds || this.defaultCapabilities(profile),
      requestedBy: input.requestedBy || 'federated-mesh',
      hostHints: {
        ...(input.hostHints || {}),
        surface: profile,
      },
      notes: this.buildFederatedNotes({
        profile,
        trust: this.normalizeTrust(input.trust || 'review'),
        commandScopes: input.commandScopes || this.defaultCommandScopes(input.capabilityIds || this.defaultCapabilities(profile)),
      }),
    });
    const approved = this.pairingService.approvePairing(draft.entry.id, {
      pairingCode: draft.pairingCode,
      capabilityIds: draft.entry.capabilityIds,
      hostHints: {
        ...(input.hostHints || {}),
        surface: profile,
      },
      operatorSummary: `${profile} pareado no Federated Mesh. Aguardando heartbeat para receber workloads.`,
    });
    if (!approved) {
      throw new Error(`Nao foi possivel parear node federado ${draft.entry.id}.`);
    }
    this.registryService.patchNode(approved.id, {
      notes: this.mergeFederatedNotes(approved.notes, {
        profile,
        trust: this.normalizeTrust(input.trust || 'review'),
        commandScopes: input.commandScopes || this.defaultCommandScopes(approved.capabilityIds),
      }),
    });
    const node = this.buildNodeView(this.registryService.getNode(approved.id) || approved);
    return {
      generatedAt: this.now().toISOString(),
      status: 'paired',
      node,
      pairingCode: draft.pairingCode,
      bootstrapCommand: draft.bootstrap?.command || null,
      summary: `${node.label} pareado como ${node.profile}; heartbeat ainda define online/offline.`,
    };
  }

  public recordHeartbeat(input: HeartbeatInput): {
    generatedAt: string;
    status: 'accepted' | 'missing';
    node: FederatedMeshNodeView | null;
    summary: string;
  } {
    const heartbeat = this.registryService.recordHeartbeat(input.nodeId, {
      status: input.status || 'online',
      capabilityIds: input.capabilityIds || null,
      hostHints: {
        ...(input.hostHints || {}),
        networkType: input.networkType || input.hostHints?.networkType || null,
        batteryLevel: Number.isFinite(Number(input.batteryPercent))
          ? Number(input.batteryPercent)
          : input.hostHints?.batteryLevel,
        latencyMs: Number.isFinite(Number(input.latencyMs)) ? Number(input.latencyMs) : input.hostHints?.latencyMs,
        costScore: Number.isFinite(Number(input.costScore)) ? Number(input.costScore) : input.hostHints?.costScore,
      },
    });
    if (!heartbeat) {
      return {
        generatedAt: this.now().toISOString(),
        status: 'missing',
        node: null,
        summary: 'Heartbeat rejeitado: node nao encontrado no registry federado.',
      };
    }
    const patched = this.registryService.patchNode(heartbeat.id, {
      notes: this.mergeFederatedNotes(heartbeat.notes, {
        profile: this.resolveFederatedProfile(heartbeat),
        trust: this.normalizeTrust(input.trust || this.parseFederatedNote(heartbeat.notes, 'trust') || 'trusted'),
        commandScopes: input.commandScopes || this.parseScopes(heartbeat.notes) || this.defaultCommandScopes(heartbeat.capabilityIds),
      }),
    }) || heartbeat;
    const node = this.buildNodeView(patched);
    return {
      generatedAt: this.now().toISOString(),
      status: 'accepted',
      node,
      summary: `${node.label} publicou heartbeat; status federado agora e ${node.status}.`,
    };
  }

  public revokeNode(input: {
    nodeId: string;
    reason?: string | null;
  }): {
    generatedAt: string;
    status: 'revoked' | 'missing';
    node: FederatedMeshNodeView | null;
    summary: string;
  } {
    const revoked = this.pairingService.revokePairing(input.nodeId, input.reason || 'Revogado no Federated Mesh.');
    if (!revoked) {
      return {
        generatedAt: this.now().toISOString(),
        status: 'missing',
        node: null,
        summary: 'Node nao encontrado para revogacao.',
      };
    }
    const node = this.buildNodeView(revoked);
    return {
      generatedAt: this.now().toISOString(),
      status: 'revoked',
      node,
      summary: `${node.label} revogado; nao entra mais no route planner.`,
    };
  }

  public async routeCapability(input: RouteInput): Promise<FederatedMeshRouteDecision> {
    const capabilityId = this.normalizeCapabilityId(input.capabilityId);
    const action = String(input.action || 'invoke').trim() || 'invoke';
    const descriptor = this.capabilityService.describeCapability(capabilityId);
    const mutable = input.mutable === true || (input.mutable !== false && descriptor.risky);
    const queueControl = this.buildQueueControl(input, capabilityId, action);
    const candidates = this.buildRouteCandidates({
      capabilityId,
      mutable,
      preferProfile: input.preferProfile || null,
    });
    const remoteEligible = candidates
      .filter((entry) => entry.node.source === 'node-mesh' && entry.eligible)
      .sort((left, right) => left.score - right.score);
    const localCandidate = candidates.find((entry) => entry.node.source === 'local') || null;
    const selected = remoteEligible[0] || (input.allowLocalFallback === false ? null : localCandidate);
    const generatedAt = this.now().toISOString();

    if (!selected) {
      return {
        generatedAt,
        capabilityId,
        action,
        mutable,
        status: candidates.some((entry) => entry.node.source === 'node-mesh') ? 'blocked' : 'dormant',
        selectedNode: null,
        candidates,
        reasons: ['Nenhum node elegivel para a capability solicitada e fallback local foi desabilitado.'],
        blockers: candidates.flatMap((entry) => entry.blockers),
        queueControl,
        mutationPlan: null,
        trustDecision: null,
        invocationResult: null,
      };
    }

    if (selected.node.source === 'local') {
      return {
        generatedAt,
        capabilityId,
        action,
        mutable,
        status: 'fallback_local',
        selectedNode: selected.node,
        candidates,
        reasons: [
          ...selected.reasons,
          remoteEligible.length === 0
            ? 'Nenhum node remoto online e confiavel cobre a capability; mantendo fallback local.'
            : 'Policy preferiu fallback local.',
        ],
        blockers: candidates.filter((entry) => entry.node.source === 'node-mesh').flatMap((entry) => entry.blockers),
        queueControl,
        mutationPlan: null,
        trustDecision: null,
        invocationResult: null,
      };
    }

    if (mutable) {
      const mutationPlan = this.createRemoteMutationPlan({
        node: selected.node,
        capabilityId,
        action,
        payload: input.payload || {},
        queueControl,
        requestedBy: input.requestedBy || null,
        sourceSurface: input.sourceSurface || null,
        riskLevel: descriptor.risky ? 'high' : 'medium',
      });
      const trustDecision = await this.trustDecisionService.evaluate({
        domain: 'federated-mesh',
        actionId: 'invoke-remote-capability',
        planId: mutationPlan.id,
        requestedBy: input.requestedBy || null,
        sourceSurface: input.sourceSurface || 'federated-mesh',
        riskLevel: mutationPlan.riskLevel,
        approvalRequired: true,
        capabilityId,
        reason: `Invocacao mutavel remota em ${selected.node.label} exige approval.`,
        payload: {
          nodeId: selected.node.id,
          profile: selected.node.profile,
          capabilityId,
          action,
        },
        resourceImpact: mutationPlan.resourceImpact,
        approvalScope: 'once',
      });
      const permissionId = trustDecision.permission?.permission_id || null;
      const attachedPlan = permissionId
        ? this.mutationPlaneService.attachApproval(mutationPlan.id, {
            permissionId,
            status: trustDecision.decision === 'requires_approval' ? 'pending' : 'approved',
            reason: trustDecision.reason,
          })
        : mutationPlan;
      return {
        generatedAt,
        capabilityId,
        action,
        mutable,
        status: 'waiting_approval',
        selectedNode: selected.node,
        candidates,
        reasons: [
          ...selected.reasons,
          'Invocacao mutavel remota foi convertida em MutationPlan antes de tocar a fila.',
        ],
        blockers: [],
        queueControl,
        mutationPlan: attachedPlan,
        trustDecision,
        invocationResult: null,
      };
    }

    const invocationResult = input.persist === true
      ? this.invokeService.invoke({
          nodeId: selected.node.id,
          capabilityId,
          action,
          payload: {
            ...(input.payload || {}),
            federatedMesh: {
              idempotencyKey: queueControl.idempotencyKey,
              retry: queueControl.retry,
              cancelToken: queueControl.cancelToken,
            },
          },
          requestedBy: input.requestedBy || 'federated-mesh',
          surface: input.sourceSurface || 'federated-mesh',
        })
      : null;

    return {
      generatedAt,
      capabilityId,
      action,
      mutable,
      status: invocationResult ? 'queued' : 'routed',
      selectedNode: selected.node,
      candidates,
      reasons: [
        ...selected.reasons,
        invocationResult
          ? 'Workload read-only enfileirado com idempotency key, retry/backoff e cancel token.'
          : 'Route planner escolheu o node, mas nao enfileirou porque persist=false.',
      ],
      blockers: [],
      queueControl,
      mutationPlan: null,
      trustDecision: null,
      invocationResult,
    };
  }

  private buildNodeViews(): FederatedMeshNodeView[] {
    return [
      this.buildLocalNodeView(),
      ...this.registryService.listNodes().map((entry) => this.buildNodeView(entry)),
    ];
  }

  private buildLocalNodeView(): FederatedMeshNodeView {
    const capabilityIds = this.defaultCapabilities('local');
    return {
      id: this.localNodeId,
      label: `Local host (${os.hostname() || 'host'})`,
      source: 'local',
      profile: 'local',
      trust: 'trusted',
      status: 'local',
      paired: true,
      revoked: false,
      commandScopes: ['read', 'write', 'execute', 'observe', 'notify'],
      capabilityIds,
      approvedCapabilityIds: capabilityIds,
      transport: 'local',
      transportHealth: {
        status: 'local',
        heartbeatAgeMs: 0,
        leaseExpiresAt: null,
        latencyMs: 1,
        costScore: 1,
        batteryPercent: null,
        networkType: 'loopback',
      },
      hostHints: {
        hostname: os.hostname() || 'local-host',
        platform: os.platform(),
        workspace: config.projectRoot,
        surface: 'local',
      },
      operatorSummary: 'Fallback local sempre disponivel sem iniciar runtime remoto pesado.',
      reasons: ['Node local sintetico para fallback quando a malha remota estiver offline.'],
    };
  }

  private buildNodeView(entry: NodeMeshRegistryEntry): FederatedMeshNodeView {
    const profile = this.resolveFederatedProfile(entry);
    const trust = this.resolveTrust(entry);
    const commandScopes = this.parseScopes(entry.notes) || this.defaultCommandScopes(entry.capabilityIds);
    const revoked = entry.pairingStatus === 'revoked' || entry.status === 'blocked' || trust === 'blocked';
    const heartbeatAgeMs = this.computeHeartbeatAgeMs(entry);
    const transportStatus = this.resolveTransportStatus(entry, revoked, heartbeatAgeMs);
    const status = this.resolveNodeStatus(entry, revoked, transportStatus);
    const approvedCapabilityIds = Array.isArray(entry.approvedCapabilityIds) && entry.approvedCapabilityIds.length > 0
      ? entry.approvedCapabilityIds
      : entry.capabilityIds;

    return {
      id: entry.id,
      label: entry.label || entry.id,
      source: 'node-mesh',
      profile,
      trust,
      status,
      paired: entry.paired && entry.pairingStatus === 'paired',
      revoked,
      commandScopes,
      capabilityIds: entry.capabilityIds,
      approvedCapabilityIds,
      transport: entry.transport,
      transportHealth: {
        status: transportStatus,
        heartbeatAgeMs,
        leaseExpiresAt: this.computeLeaseExpiresAt(entry),
        latencyMs: this.numberOrDefault(entry.hostHints.latencyMs, PROFILE_DEFAULT_LATENCY[profile]),
        costScore: this.numberOrDefault(entry.hostHints.costScore, PROFILE_DEFAULT_COST[profile]),
        batteryPercent: Number.isFinite(Number(entry.hostHints.batteryLevel)) ? Number(entry.hostHints.batteryLevel) : null,
        networkType: entry.hostHints.networkType || null,
      },
      hostHints: entry.hostHints,
      operatorSummary: entry.operatorSummary || this.describeNodeStatus(status, profile),
      reasons: [
        `profile=${profile}`,
        `trust=${trust}`,
        `status=${status}`,
        `capabilities=${entry.capabilityIds.length}`,
      ],
    };
  }

  private buildRouteCandidates(input: {
    capabilityId: NodeMeshCapabilityId;
    mutable: boolean;
    preferProfile?: FederatedMeshProfile | null;
  }): FederatedMeshRouteCandidate[] {
    return this.buildNodeViews().map((node) => {
      const blockers: string[] = [];
      const reasons: string[] = [];
      if (!node.capabilityIds.includes(input.capabilityId)) {
        blockers.push(`Node nao declarou ${input.capabilityId}.`);
      } else {
        reasons.push(`Node declarou ${input.capabilityId}.`);
      }
      if (!node.approvedCapabilityIds.includes(input.capabilityId)) {
        blockers.push(`Allowlist do node nao aprovou ${input.capabilityId}.`);
      }
      if (node.revoked || node.trust === 'blocked') {
        blockers.push('Node revogado ou bloqueado pelo trust federado.');
      }
      if (node.source === 'node-mesh' && node.status !== 'online') {
        blockers.push(`Node remoto nao esta online (${node.status}).`);
      }
      if (input.mutable && node.source === 'node-mesh' && node.trust !== 'trusted') {
        blockers.push('Invocacao mutavel remota exige trust=trusted.');
      }
      if (input.mutable && !node.commandScopes.some((scope) => scope === 'write' || scope === 'execute')) {
        blockers.push('Escopo de comandos nao permite write/execute.');
      }
      const eligible = blockers.length === 0;
      const score = this.scoreNode(node, input.preferProfile || null, input.capabilityId);
      if (eligible) {
        reasons.push(`score=${score}`);
        reasons.push(`latencia=${node.transportHealth.latencyMs}ms`);
        reasons.push(`custo=${node.transportHealth.costScore}`);
      }
      return {
        node,
        eligible,
        score,
        reasons,
        blockers,
      };
    });
  }

  private scoreNode(
    node: FederatedMeshNodeView,
    preferProfile: FederatedMeshProfile | null,
    capabilityId: NodeMeshCapabilityId,
  ): number {
    let score = node.transportHealth.latencyMs + (node.transportHealth.costScore * 10);
    if (node.source === 'local') {
      score += 45;
    }
    if (node.profile === 'gpu-worker' && /gpu|model|embed|eval|system\.run/i.test(capabilityId)) {
      score -= 20;
    }
    if (node.profile === 'mobile') {
      const battery = node.transportHealth.batteryPercent;
      if (battery !== null && battery < 25) {
        score += 40;
      }
    }
    if (node.trust === 'review') {
      score += 20;
    }
    if (preferProfile && node.profile !== preferProfile) {
      score += 15;
    }
    return Math.max(0, Math.round(score));
  }

  private createRemoteMutationPlan(input: {
    node: FederatedMeshNodeView;
    capabilityId: NodeMeshCapabilityId;
    action: string;
    payload: Record<string, unknown>;
    queueControl: FederatedMeshQueueControl;
    requestedBy: string | null;
    sourceSurface: string | null;
    riskLevel: ZavorthMutationRiskLevel;
  }): ZavorthMutationPlan {
    return this.mutationPlaneService.createPlan({
      domain: 'federated-mesh',
      actionId: 'invoke-remote-capability',
      title: `Invocar ${input.capabilityId} em ${input.node.label}`,
      summary: `Workload mutavel remoto para ${input.node.profile}/${input.node.id} com approval antes da fila.`,
      requestedBy: input.requestedBy,
      sourceSurface: input.sourceSurface || 'federated-mesh',
      riskLevel: input.riskLevel,
      approvalRequired: true,
      approvalReason: 'Invocacao mutavel em node remoto exige Trust Plane e audit local/remoto.',
      resourceImpact: {
        ramMb: input.node.profile === 'gpu-worker' ? 2048 : 512,
        diskMb: 256,
        processCount: 1,
        externalExposure: input.node.profile === 'local' ? 'none' : 'network',
        recurring: false,
        notes: [
          `node=${input.node.id}`,
          `profile=${input.node.profile}`,
          `capability=${input.capabilityId}`,
        ],
      },
      readinessGates: this.buildRemoteReadinessGates(input.node),
      validationPlan: [
        'Confirmar que node continua online antes de enfileirar.',
        'Confirmar idempotency key antes de retry.',
        'Registrar audit local e remoto no completion do node.',
      ],
      rollbackPlan: [
        'Usar cancel token antes do claim quando possivel.',
        'Se ja executado, exigir rollback especifico da capability remota.',
      ],
      retentionPolicy: {
        ttlMs: 24 * 60 * 60 * 1000,
        cleanupOnSuccess: true,
        cleanupOnBoot: true,
        notes: ['Fila remota nao deve sobreviver sem lease e audit.'],
      },
      payload: {
        nodeId: input.node.id,
        profile: input.node.profile,
        capabilityId: input.capabilityId,
        action: input.action,
        payload: input.payload,
        queueControl: input.queueControl,
        remoteAuditRequired: true,
      },
    });
  }

  private buildRemoteReadinessGates(node: FederatedMeshNodeView): ZavorthReadinessGate[] {
    const checkedAt = this.now().toISOString();
    return [
      {
        id: 'federated-node-online',
        status: node.status === 'online' ? 'passed' : 'blocked',
        canProceed: node.status === 'online',
        scope: node.id,
        reasons: [`status=${node.status}`],
        warnings: [],
        blockers: node.status === 'online' ? [] : ['Node precisa heartbeat online antes de mutacao remota.'],
        checkedAt,
      },
      {
        id: 'federated-node-trust',
        status: node.trust === 'trusted' ? 'passed' : 'blocked',
        canProceed: node.trust === 'trusted',
        scope: node.id,
        reasons: [`trust=${node.trust}`],
        warnings: node.trust === 'review' ? ['Node em review pode receber leitura, mas nao mutacao.'] : [],
        blockers: node.trust === 'trusted' ? [] : ['Mutacao remota exige trust=trusted.'],
        checkedAt,
      },
    ];
  }

  private buildCapabilityInventory(nodes: FederatedMeshNodeView[]): FederatedMeshSnapshot['capabilityInventory'] {
    const ids = Array.from(new Set(nodes.flatMap((entry) => entry.capabilityIds))).sort((left, right) =>
      left.localeCompare(right, 'en-US'),
    );
    return ids.map((id) => {
      const descriptor = this.capabilityService.describeCapability(id);
      return {
        id,
        label: descriptor.label,
        risky: descriptor.risky,
        supportedNodes: nodes.filter((entry) => entry.capabilityIds.includes(id)).map((entry) => entry.id),
        routeableNodes: nodes
          .filter((entry) =>
            entry.capabilityIds.includes(id)
            && entry.approvedCapabilityIds.includes(id)
            && !entry.revoked
            && (entry.source === 'local' || entry.status === 'online'))
          .map((entry) => entry.id),
      };
    });
  }

  private buildProfileSummary(nodes: FederatedMeshNodeView[]): FederatedMeshSnapshot['profiles'] {
    return FEDERATED_PROFILES.map((profile) => {
      const entries = nodes.filter((entry) => entry.profile === profile);
      const online = entries.filter((entry) => entry.status === 'online' || entry.status === 'local').length;
      return {
        profile,
        configured: entries.length > 0,
        online,
        dormant: profile !== 'local' && entries.length === 0,
        summary: entries.length > 0
          ? `${entries.length} node(s), ${online} online/local.`
          : 'Perfil dormente; nenhum runtime foi iniciado.',
      };
    });
  }

  private buildTransportHealth(nodes: FederatedMeshNodeView[]): FederatedMeshSnapshot['transportHealth'] {
    return FEDERATED_PROFILES.map((profile) => {
      const entries = nodes.filter((entry) => entry.profile === profile);
      const online = entries.filter((entry) => entry.status === 'online' || entry.status === 'local').length;
      const revoked = entries.filter((entry) => entry.revoked).length;
      const status = entries.length === 0
        ? 'dormant'
        : revoked === entries.length
          ? 'revoked'
          : online > 0
            ? (profile === 'local' ? 'local' : 'online')
            : 'offline';
      return {
        profile,
        status,
        online,
        configured: entries.length,
        summary: entries.length === 0
          ? 'Dormente sob demanda.'
          : `${online}/${entries.length} online/local; revogados ${revoked}.`,
      };
    });
  }

  private async safeDistributedRuntimeSnapshot(): Promise<ZavorthDistributedRuntimeSnapshot | null> {
    try {
      return await this.distributedRuntimeService.buildSnapshot();
    } catch (error: unknown) {logger.warn('[Zavorth Federated Mesh Control Plane] creation failed', error); return null; }
  }

  private buildActions(
    remoteNodes: FederatedMeshNodeView[],
    infrastructureState: FederatedMeshInfrastructureState,
  ): FederatedMeshSnapshot['actions'] {
    if (!remoteNodes.length) {
      return [{
        id: 'pair-first-federated-node',
        label: 'Parear primeiro node federado',
        severity: 'info',
        command: 'npm run ops:federated-mesh -- --pair --profile lan --node work-pc',
        reason: 'A implementacao esta pronta, mas a malha remota ainda esta dormente.',
      }];
    }
    if (infrastructureState === 'offline') {
      return [{
        id: 'restore-heartbeat',
        label: 'Restaurar heartbeat da malha',
        severity: 'warn',
        command: 'npm run ops:federated-mesh -- --heartbeat --node <nodeId>',
        reason: 'Ha node pareado, mas nenhum heartbeat online agora.',
      }];
    }
    const review = remoteNodes.find((entry) => entry.trust === 'review');
    if (review) {
      return [{
        id: 'promote-node-trust',
        label: `Revisar trust de ${review.label}`,
        severity: 'info',
        command: `npm run ops:federated-mesh -- --heartbeat --node ${review.id} --trust trusted`,
        reason: 'Node em review pode receber leitura, mas mutacoes remotas exigem trust=trusted.',
      }];
    }
    return [{
      id: 'route-capability',
      label: 'Testar route planner',
      severity: 'info',
      command: 'npm run ops:federated-mesh -- --route files.read',
      reason: 'Malha online; route planner ja pode explicar uma escolha por capability.',
    }];
  }

  private resolveInfrastructureState(remoteNodes: FederatedMeshNodeView[]): FederatedMeshInfrastructureState {
    if (remoteNodes.some((entry) => entry.status === 'online')) {
      return 'mesh_online';
    }
    if (remoteNodes.some((entry) => entry.paired && !entry.revoked)) {
      return 'offline';
    }
    return 'dormant';
  }

  private resolvePosture(
    remoteNodes: FederatedMeshNodeView[],
    state: FederatedMeshInfrastructureState,
  ): FederatedMeshSnapshot['summary']['posture'] {
    if (state === 'offline' || remoteNodes.some((entry) => entry.status === 'stale')) {
      return 'attention';
    }
    return 'healthy';
  }

  private buildOperatorSummary(summary: FederatedMeshSnapshot['summary']): string {
    return `Implementation pronta, infra ${summary.infrastructureState}, ${summary.onlineNodes}/${summary.remoteNodes} node(s) remoto(s) online, ${summary.revokedNodes} revogado(s), ${summary.routeableCapabilities}/${summary.capabilityCount} capability(ies) roteaveis.`;
  }

  private buildNextAction(
    remoteNodes: FederatedMeshNodeView[],
    state: FederatedMeshInfrastructureState,
  ): string {
    if (state === 'dormant') {
      return 'Pareie um node federado quando quiser usar PC, servidor, mobile ou worker GPU sem iniciar processos em background agora.';
    }
    if (state === 'offline') {
      return 'Ligue o node host/companion e publique heartbeat antes de enviar workloads remotos.';
    }
    const mutableBlocked = remoteNodes.find((entry) => entry.trust !== 'trusted');
    if (mutableBlocked) {
      return `Promova trust de ${mutableBlocked.label} depois de revisar escopos e capabilities.`;
    }
    return 'Use route planner para escolher node por capability e custo antes de enfileirar workloads.';
  }

  private describeOfflineReason(
    remoteNodes: FederatedMeshNodeView[],
    state: FederatedMeshInfrastructureState,
  ): string | null {
    if (state === 'dormant') {
      return 'Nenhum node remoto pareado. O core segue local e leve.';
    }
    if (state === 'offline') {
      return `${remoteNodes.filter((entry) => entry.paired && !entry.revoked).length} node(s) pareado(s), mas sem heartbeat online.`;
    }
    return null;
  }

  private buildQueueControl(input: RouteInput, capabilityId: string, action: string): FederatedMeshQueueControl {
    const seed = JSON.stringify({
      capabilityId,
      action,
      payload: input.payload || {},
      requestedBy: input.requestedBy || null,
      sourceSurface: input.sourceSurface || null,
    });
    const hash = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16);
    return {
      idempotencyKey: `fmesh:${hash}`,
      retry: {
        maxAttempts: 3,
        backoffMs: 1500,
      },
      cancelToken: `cancel:${crypto.randomUUID()}`,
      cancellable: true,
    };
  }

  private resolveFederatedProfile(entry: NodeMeshRegistryEntry): FederatedMeshProfile {
    const fromNote = this.parseFederatedNote(entry.notes, 'profile');
    if (this.isFederatedProfile(fromNote)) {
      return fromNote;
    }
    const surface = String(entry.hostHints.surface || '').trim().toLowerCase();
    if (this.isFederatedProfile(surface)) {
      return surface;
    }
    if (entry.kind === 'mobile') {
      return 'mobile';
    }
    if (/gpu|cuda|model/i.test(`${entry.label} ${entry.hostHints.deviceModel || ''}`)) {
      return 'gpu-worker';
    }
    if (entry.transport === 'remote') {
      return 'official-remote';
    }
    if (entry.transport === 'sidecar') {
      return 'private-tunnel';
    }
    return 'lan';
  }

  private resolveTrust(entry: NodeMeshRegistryEntry): FederatedMeshTrust {
    const trust = this.parseFederatedNote(entry.notes, 'trust');
    if (trust === 'trusted' || trust === 'review' || trust === 'blocked') {
      return trust;
    }
    if (entry.pairingStatus === 'revoked' || entry.status === 'blocked') {
      return 'blocked';
    }
    return entry.paired && entry.status === 'online' ? 'trusted' : 'review';
  }

  private resolveTransportStatus(
    entry: NodeMeshRegistryEntry,
    revoked: boolean,
    heartbeatAgeMs: number | null,
  ): FederatedMeshTransportHealth['status'] {
    if (revoked) {
      return 'revoked';
    }
    if (entry.status === 'online') {
      return 'online';
    }
    if (entry.paired && heartbeatAgeMs !== null && heartbeatAgeMs > 5 * 60 * 1000) {
      return 'stale';
    }
    return 'offline';
  }

  private resolveNodeStatus(
    entry: NodeMeshRegistryEntry,
    revoked: boolean,
    transportStatus: FederatedMeshTransportHealth['status'],
  ): FederatedMeshNodeStatus {
    if (revoked) {
      return 'revoked';
    }
    if (transportStatus === 'online') {
      return 'online';
    }
    if (transportStatus === 'stale') {
      return 'stale';
    }
    return entry.paired ? 'offline' : 'paired';
  }

  private computeHeartbeatAgeMs(entry: NodeMeshRegistryEntry): number | null {
    if (!entry.lastSeenAt) {
      return null;
    }
    const timestamp = Date.parse(entry.lastSeenAt);
    if (!Number.isFinite(timestamp)) {
      return null;
    }
    return Math.max(0, this.now().getTime() - timestamp);
  }

  private computeLeaseExpiresAt(entry: NodeMeshRegistryEntry): string | null {
    if (!entry.lastSeenAt) {
      return null;
    }
    const timestamp = Date.parse(entry.lastSeenAt);
    if (!Number.isFinite(timestamp)) {
      return null;
    }
    return new Date(timestamp + 45_000).toISOString();
  }

  private describeNodeStatus(status: FederatedMeshNodeStatus, profile: FederatedMeshProfile): string {
    if (status === 'online') {
      return `${profile} online e elegivel para rota.`;
    }
    if (status === 'revoked') {
      return `${profile} revogado no Federated Mesh.`;
    }
    return `${profile} pareado, mas sem heartbeat online agora.`;
  }

  private normalizeProfile(value: unknown): FederatedMeshProfile {
    const normalized = String(value || '').trim().toLowerCase();
    return this.isFederatedProfile(normalized) ? normalized : 'lan';
  }

  private isFederatedProfile(value: unknown): value is FederatedMeshProfile {
    return FEDERATED_PROFILES.includes(String(value || '').trim().toLowerCase() as FederatedMeshProfile);
  }

  private normalizeTrust(value: unknown): FederatedMeshTrust {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'trusted' || normalized === 'blocked' || normalized === 'review') {
      return normalized;
    }
    return 'review';
  }

  private normalizeCapabilityId(value: unknown): NodeMeshCapabilityId {
    return String(value || '').trim() || 'device.info';
  }

  private normalizeNodeId(value: unknown): string {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-') || 'local-host';
  }

  private defaultLabel(profile: FederatedMeshProfile): string {
    switch (profile) {
      case 'mobile':
        return 'Mobile companion';
      case 'gpu-worker':
        return 'GPU worker';
      case 'official-remote':
        return 'Official remote node';
      case 'private-tunnel':
        return 'Private tunnel node';
      case 'lan':
        return 'LAN node';
      case 'local':
      default:
        return 'Local node';
    }
  }

  private defaultCapabilities(profile: FederatedMeshProfile): NodeMeshCapabilityId[] {
    if (profile === 'mobile') {
      return ['device.info', 'notifications.send', 'camera.capture', 'location.read'];
    }
    if (profile === 'gpu-worker') {
      return ['device.info', 'system.run', 'files.read', 'files.write'];
    }
    if (profile === 'local') {
      return ['device.info', 'system.run', 'files.read', 'files.write', 'files.watch', 'browser.proxy', 'screen.capture', 'notifications.send'];
    }
    return ['device.info', 'system.run', 'files.read', 'files.write', 'files.watch', 'browser.proxy'];
  }

  private defaultCommandScopes(capabilityIds: NodeMeshCapabilityId[]): FederatedMeshCommandScope[] {
    const scopes = new Set<FederatedMeshCommandScope>(['read']);
    if (capabilityIds.some((entry) => /write/i.test(entry))) {
      scopes.add('write');
    }
    if (capabilityIds.some((entry) => /run|system|maintenance/i.test(entry))) {
      scopes.add('execute');
    }
    if (capabilityIds.some((entry) => /watch|screen|camera|browser/i.test(entry))) {
      scopes.add('observe');
    }
    if (capabilityIds.some((entry) => /notification/i.test(entry))) {
      scopes.add('notify');
    }
    return Array.from(scopes);
  }

  private toNodeMeshProfileId(profile: FederatedMeshProfile): string {
    if (profile === 'mobile') {
      return 'mobile-companion';
    }
    if (profile === 'official-remote') {
      return 'desktop-companion';
    }
    if (profile === 'private-tunnel') {
      return 'browser-companion';
    }
    return 'headless-worker';
  }

  private toNodeMeshKind(profile: FederatedMeshProfile): NodeMeshNodeKind {
    if (profile === 'mobile') {
      return 'mobile';
    }
    if (profile === 'official-remote') {
      return 'desktop';
    }
    if (profile === 'private-tunnel') {
      return 'browser';
    }
    return 'headless';
  }

  private toNodeMeshTransport(profile: FederatedMeshProfile): NodeMeshTransport {
    if (profile === 'local') {
      return 'local';
    }
    if (profile === 'private-tunnel') {
      return 'sidecar';
    }
    if (profile === 'official-remote' || profile === 'mobile') {
      return 'remote';
    }
    return 'bridge';
  }

  private buildFederatedNotes(input: {
    profile: FederatedMeshProfile;
    trust: FederatedMeshTrust;
    commandScopes: FederatedMeshCommandScope[];
  }): string[] {
    return [
      `federated.profile=${input.profile}`,
      `federated.trust=${input.trust}`,
      `federated.scopes=${input.commandScopes.join(',')}`,
    ];
  }

  private mergeFederatedNotes(
    existing: string[],
    input: {
      profile: FederatedMeshProfile;
      trust: FederatedMeshTrust;
      commandScopes: FederatedMeshCommandScope[];
    },
  ): string[] {
    const preserved = (existing || []).filter((entry) => !String(entry || '').startsWith('federated.'));
    return [...preserved, ...this.buildFederatedNotes(input)].slice(0, 12);
  }

  private parseFederatedNote(notes: string[], key: string): string | null {
    const prefix = `federated.${key}=`;
    const note = (notes || []).find((entry) => String(entry || '').startsWith(prefix));
    return note ? String(note).slice(prefix.length).trim() || null : null;
  }

  private parseScopes(notes: string[]): FederatedMeshCommandScope[] | null {
    const raw = this.parseFederatedNote(notes, 'scopes');
    if (!raw) {
      return null;
    }
    const scopes = raw.split(',')
      .map((entry) => entry.trim())
      .filter((entry): entry is FederatedMeshCommandScope =>
        entry === 'read' || entry === 'write' || entry === 'execute' || entry === 'observe' || entry === 'notify',
      );
    return scopes.length > 0 ? scopes : null;
  }

  private numberOrDefault(value: unknown, fallback: number): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, numeric) : fallback;
  }
}
