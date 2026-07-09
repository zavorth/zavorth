import crypto from 'crypto';
import type {
  NodeMeshCapabilityId,
  NodeMeshDeviceProfileId,
  NodeMeshHostHints,
  NodeMeshNodeKind,
  NodeMeshPairingClaim,
  NodeMeshPairingDraft,
  NodeMeshRegistryEntry,
  NodeMeshTransport,
} from '../contracts/NodeMeshContract.js';
import { NodeCapabilityService } from './NodeCapabilityService.js';

import { NodeDeviceProfileService } from './NodeDeviceProfileService.js';
import { NodeRegistryService } from './NodeRegistryService.js';

type NodePairingRuntime = {
  now?: () => Date;
  registryService?: NodeRegistryService;
  capabilityService?: NodeCapabilityService;
  deviceProfileService?: NodeDeviceProfileService;
};

type CreatePairingDraftInput = {
  nodeId?: string | null;
  profileId?: NodeMeshDeviceProfileId | null;
  label?: string | null;
  kind?: NodeMeshNodeKind | null;
  transport?: NodeMeshTransport | null;
  capabilityIds?: NodeMeshCapabilityId[] | null;
  approvedCapabilityIds?: NodeMeshCapabilityId[] | null;
  requestedBy?: string | null;
  hostHints?: Partial<NodeMeshHostHints> | null;
  notes?: string[] | null;
};

export class NodePairingService {
  private readonly now: () => Date;
  private readonly registryService: NodeRegistryService;
  private readonly capabilityService: NodeCapabilityService;
  private readonly deviceProfileService: NodeDeviceProfileService;

  constructor(runtime: NodePairingRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.registryService = runtime.registryService || new NodeRegistryService();
    this.capabilityService = runtime.capabilityService || new NodeCapabilityService();
    this.deviceProfileService = runtime.deviceProfileService || new NodeDeviceProfileService();
  }

  public claimPairing(
    nodeId: string | null | undefined,
    input: {
      pairingCode?: string | null;
      capabilityIds?: NodeMeshCapabilityId[] | null;
      approvedCapabilityIds?: NodeMeshCapabilityId[] | null;
      hostHints?: Partial<NodeMeshHostHints> | null;
      operatorSummary?: string | null;
      heartbeatIntervalMs?: number | null;
    } = {},
  ): NodeMeshPairingClaim | null {
    const current = this.registryService.getNode(nodeId);
    if (!current || current.pairingStatus !== 'pending') {
      return null;
    }

    const storedPairingCode = this.registryService.getSecretValue(current.id, 'pairingCode');
    const providedPairingCode = String(input.pairingCode || '').trim();
    if (!storedPairingCode || !providedPairingCode || providedPairingCode !== storedPairingCode) {
      return null;
    }

    const claimedAt = this.now().toISOString();
    const sharedSecret = this.registryService.getSecretValue(current.id, 'sharedSecret');
    if (!sharedSecret) {
      return null;
    }
    const profile = this.deviceProfileService.describeProfile(current.profileId);
    const effectiveCapabilityIds = input.capabilityIds
      ? this.capabilityService.normalizeCapabilityIds(input.capabilityIds)
      : current.capabilityIds;
    const approvedCapabilityIds = input.approvedCapabilityIds !== undefined
      ? this.capabilityService.normalizeCapabilityIds(input.approvedCapabilityIds)
        .filter((capabilityId) => effectiveCapabilityIds.includes(capabilityId))
      : current.approvedCapabilityIds;

    const node = this.registryService.patchNode(current.id, {
      pairingStatus: 'paired',
      status: current.lastSeenAt ? 'online' : 'idle',
      paired: true,
      pairedAt: claimedAt,
      capabilityIds: effectiveCapabilityIds,
      approvedCapabilityIds,
      allowlistAudit: input.approvedCapabilityIds !== undefined
        ? {
            approvedAt: claimedAt,
            approvedBy: String(current.requestedBy || '').trim() || 'node-claim',
            reason: approvedCapabilityIds && approvedCapabilityIds.length > 0
              ? 'Allowlist confirmada durante o claim do node.'
              : 'Allowlist limpa durante o claim do node.',
            mode: approvedCapabilityIds && approvedCapabilityIds.length > 0 ? 'claim' : 'clear',
          }
        : undefined,
      hostHints: {
        ...current.hostHints,
        ...(input.hostHints || {}),
      },
      operatorSummary: String(
        input.operatorSummary
        || `${profile?.label || 'Node host'} claim confirmado. Aguardando heartbeat recorrente para receber invocacoes reais.`,
      ).trim(),
    });

    this.registryService.deleteSecret(current.id, 'pairingCode');
    if (!node) {
      return null;
    }

    return {
      claimedAt,
      node,
      sharedSecret,
      heartbeatIntervalMs: Math.max(5000, Number(input.heartbeatIntervalMs || 15000)),
      operatorSummary: node.operatorSummary || `${profile?.label || 'Node host'} claim confirmado.`,
      assignments: [],
      actionHint: `Guarde o shared secret no ${profile?.label || 'node host'} e publique heartbeat para receber invocacoes.`,
    };
  }

  public createPairingDraft(input: CreatePairingDraftInput = {}): NodeMeshPairingDraft {
    const generatedAt = this.now().toISOString();
    const profile = this.deviceProfileService.resolveProfile(input.profileId, input.kind);
    const nodeId = this.resolveNodeId(input.nodeId, input.label);
    const pairingCode = crypto.randomBytes(9).toString('base64url');
    const sharedSecret = crypto.randomBytes(18).toString('base64url');
    const hostHints = input.hostHints && typeof input.hostHints === 'object' ? input.hostHints : null;
    const capabilityIds = this.capabilityService.normalizeCapabilityIds(
      (input.capabilityIds && input.capabilityIds.length ? input.capabilityIds : profile.defaultCapabilityIds) || [],
    );
    const approvedCapabilityIds = this.capabilityService.normalizeCapabilityIds(input.approvedCapabilityIds || [])
      .filter((capabilityId) => capabilityIds.includes(capabilityId));
    const label = String(input.label || '').trim() || profile.label;
    const entry = this.registryService.upsertNode({
      id: nodeId,
      label,
      profileId: this.deviceProfileService.normalizeProfileId(profile.id),
      kind: input.kind || profile.kind,
      transport: input.transport || profile.transport,
      status: 'pairing',
      pairingStatus: 'pending',
      paired: false,
      createdAt: generatedAt,
      updatedAt: generatedAt,
      pairedAt: null,
      lastSeenAt: null,
      requestedBy: String(input.requestedBy || '').trim() || null,
      capabilityIds,
      approvedCapabilityIds,
      allowlistAudit: approvedCapabilityIds.length > 0
        ? {
            approvedAt: generatedAt,
            approvedBy: String(input.requestedBy || '').trim() || null,
            reason: 'Allowlist definida no pairing draft.',
            mode: 'draft',
          }
        : null,
      hostHints: {
        hostname: String(hostHints?.hostname || '').trim() || null,
        platform: String(hostHints?.platform || '').trim() || null,
        workspace: String(hostHints?.workspace || '').trim() || null,
        surface: String(hostHints?.surface || this.defaultSurfaceForProfile(profile)).trim() || null,
        arch: String(hostHints?.arch || '').trim() || null,
        osRelease: String(hostHints?.osRelease || '').trim() || null,
        nodeVersion: String(hostHints?.nodeVersion || '').trim() || null,
        deviceModel: String(hostHints?.deviceModel || '').trim() || null,
        appVersion: String(hostHints?.appVersion || '').trim() || null,
        networkType: String(hostHints?.networkType || '').trim() || null,
        batteryLevel: typeof hostHints?.batteryLevel === 'number' && Number.isFinite(hostHints.batteryLevel)
          ? hostHints.batteryLevel
          : null,
        batteryState: String(hostHints?.batteryState || '').trim() || null,
        locationLabel: String(hostHints?.locationLabel || '').trim() || null,
      },
      notes: (input.notes || []).map((entry) => String(entry || '').trim()).filter(Boolean),
      operatorSummary: `Pairing criado para ${profile.label}. Falta o companion consumir o codigo e concluir o pareamento.`,
    });

    this.registryService.storeSecret(entry.id, 'pairingCode', pairingCode);
    this.registryService.storeSecret(entry.id, 'sharedSecret', sharedSecret);

    return {
      generatedAt,
      entry,
      profile,
      pairingCode,
      actionHint: `Informe o codigo ${pairingCode} ao ${profile.label} para concluir o pareamento inicial.`,
      instructions: [
        `Registre o companion usando o perfil ${profile.label} e o mesmo nodeId exibido no gateway.`,
        `Suba o node host com o pairing code e as capabilities basicas do perfil (${capabilityIds.join(', ') || 'sem capabilities padrao'}).`,
        'Depois do primeiro heartbeat, o status muda de pairing para online/offline pareado.',
      ],
      bootstrap: this.buildBootstrapDraft({
        nodeId: entry.id,
        pairingCode,
        profile,
        label,
        capabilityIds,
        workspace: entry.hostHints.workspace || hostHints?.workspace || process.cwd(),
      }),
    };
  }

  public regeneratePairingDraft(
    nodeId: string | null | undefined,
    input: Omit<CreatePairingDraftInput, 'nodeId'> = {},
  ): NodeMeshPairingDraft | null {
    const current = this.registryService.getNode(nodeId);
    if (!current || current.paired || current.pairingStatus === 'paired') {
      return null;
    }

    return this.createPairingDraft({
      nodeId: current.id,
      profileId: input.profileId ?? current.profileId ?? null,
      label: input.label ?? current.label ?? null,
      kind: input.kind ?? current.kind ?? null,
      transport: input.transport ?? current.transport ?? null,
      capabilityIds: input.capabilityIds ?? current.capabilityIds ?? null,
      approvedCapabilityIds: input.approvedCapabilityIds ?? current.approvedCapabilityIds ?? null,
      requestedBy: input.requestedBy ?? current.requestedBy ?? null,
      hostHints: input.hostHints ?? current.hostHints ?? null,
      notes: input.notes ?? current.notes ?? null,
    });
  }

  public approvePairing(
    nodeId: string | null | undefined,
    input: {
      pairingCode?: string | null;
      capabilityIds?: NodeMeshCapabilityId[] | null;
      approvedCapabilityIds?: NodeMeshCapabilityId[] | null;
      hostHints?: Partial<NodeMeshHostHints> | null;
      operatorSummary?: string | null;
    } = {},
  ): NodeMeshRegistryEntry | null {
    const current = this.registryService.getNode(nodeId);
    if (!current || current.pairingStatus !== 'pending') {
      return null;
    }

    const storedPairingCode = this.registryService.getSecretValue(current.id, 'pairingCode');
    if (storedPairingCode && String(input.pairingCode || '').trim() !== storedPairingCode) {
      return null;
    }
    const profile = this.deviceProfileService.describeProfile(current.profileId);
    const effectiveCapabilityIds = input.capabilityIds
      ? this.capabilityService.normalizeCapabilityIds(input.capabilityIds)
      : current.capabilityIds;
    const approvedCapabilityIds = input.approvedCapabilityIds !== undefined
      ? this.capabilityService.normalizeCapabilityIds(input.approvedCapabilityIds)
        .filter((capabilityId) => effectiveCapabilityIds.includes(capabilityId))
      : current.approvedCapabilityIds;

    return this.registryService.patchNode(current.id, {
      pairingStatus: 'paired',
      status: current.lastSeenAt ? 'online' : 'offline',
      paired: true,
      pairedAt: this.now().toISOString(),
      capabilityIds: effectiveCapabilityIds,
      approvedCapabilityIds,
      allowlistAudit: input.approvedCapabilityIds !== undefined
        ? {
            approvedAt: this.now().toISOString(),
            approvedBy: String(current.requestedBy || '').trim() || 'pairing-approval',
            reason: approvedCapabilityIds && approvedCapabilityIds.length > 0
              ? 'Allowlist confirmada durante a aprovacao do pairing.'
              : 'Allowlist limpa durante a aprovacao do pairing.',
            mode: approvedCapabilityIds && approvedCapabilityIds.length > 0 ? 'approve' : 'clear',
          }
        : undefined,
      hostHints: {
        ...current.hostHints,
        ...(input.hostHints || {}),
      },
      operatorSummary: String(
        input.operatorSummary
        || `${profile?.label || 'Node'} pareado. Falta apenas o transporte publicar heartbeat para entrar no fluxo remoto.`,
      ).trim(),
    });
  }

  public setApprovedCapabilities(
    nodeId: string | null | undefined,
    approvedCapabilityIds: NodeMeshCapabilityId[] | null | undefined,
    input: {
      approvedBy?: string | null;
      reason?: string | null;
      mode?: string | null;
    } = {},
  ): NodeMeshRegistryEntry | null {
    return this.registryService.setApprovedCapabilities(nodeId, approvedCapabilityIds || [], input);
  }

  public buildBootstrapForNode(nodeId: string | null | undefined): NodeMeshPairingDraft | null {
    const current = this.registryService.getNode(nodeId);
    if (!current || current.pairingStatus !== 'pending') {
      return null;
    }

    const pairingCode = this.registryService.getSecretValue(current.id, 'pairingCode');
    if (!pairingCode) {
      return null;
    }

    const generatedAt = this.now().toISOString();
    const profile = this.deviceProfileService.describeProfile(current.profileId);
    return {
      generatedAt,
      entry: current,
      profile,
      pairingCode,
      actionHint: `Use o bootstrap canonico de ${profile?.label || current.label || current.id} para concluir o primeiro claim.`,
      instructions: [
        `Execute o bootstrap do perfil ${profile?.label || current.label || current.id} com o pairing token atual.`,
        'Depois do primeiro claim o pairing code expira e o node passa a usar shared secret.',
        'Se o pairing draft expirar, gere um novo draft antes de continuar o bootstrap.',
      ],
      bootstrap: this.buildBootstrapDraft({
        nodeId: current.id,
        pairingCode,
        profile: profile || {
          id: current.profileId || 'headless-worker',
          kind: current.kind,
          label: current.label || current.id,
        },
        label: current.label,
        capabilityIds: current.capabilityIds,
        workspace: current.hostHints.workspace || process.cwd(),
      }),
    };
  }

  public revokePairing(nodeId: string | null | undefined, reason?: string | null): NodeMeshRegistryEntry | null {
    const current = this.registryService.getNode(nodeId);
    if (!current) {
      return null;
    }

    const revoked = this.registryService.patchNode(current.id, {
      pairingStatus: 'revoked',
      status: 'blocked',
      paired: false,
      operatorSummary: String(reason || 'Pareamento revogado ate nova autorizacao.').trim(),
      notes: [...current.notes, String(reason || 'Pareamento revogado.').trim()].filter(Boolean),
    });
    this.registryService.deleteSecret(current.id, 'pairingCode');
    this.registryService.deleteSecret(current.id, 'sharedSecret');
    return revoked;
  }

  public validateSharedSecret(
    nodeId: string | null | undefined,
    sharedSecret: string | null | undefined,
  ): boolean {
    const current = this.registryService.getNode(nodeId);
    if (!current || !current.paired || current.pairingStatus !== 'paired') {
      return false;
    }

    const expected = this.registryService.getSecretValue(current.id, 'sharedSecret');
    return Boolean(expected && String(sharedSecret || '').trim() === expected);
  }

  private resolveNodeId(nodeId: string | null | undefined, label: string | null | undefined): string {
    const normalizedId = String(nodeId || '').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
    if (normalizedId) {
      return normalizedId;
    }

    const labelSeed = String(label || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const prefix = labelSeed.replace(/^-+|-+$/g, '') || 'headless-node';
    return `${prefix}-${crypto.randomUUID().slice(0, 6)}`;
  }

  private defaultSurfaceForProfile(profile: { kind: NodeMeshNodeKind }): string {
    switch (profile.kind) {
      case 'desktop':
        return 'desktop';
      case 'mobile':
        return 'mobile';
      case 'browser':
        return 'browser';
      default:
        return 'node-host';
    }
  }

  private buildBootstrapDraft(input: {
    nodeId: string;
    pairingCode: string;
    profile: { id: string; kind: NodeMeshNodeKind; label: string };
    label: string;
    capabilityIds: NodeMeshCapabilityId[];
    workspace: string | null | undefined;
  }): NodeMeshPairingDraft['bootstrap'] {
    const baseUrl = String(process.env.ZAVORTH_NODE_MESH_BASE_URL || process.env.ZAVORTH_WEB_BASE_URL || 'http://127.0.0.1:33333').trim();
    const workspace = String(input.workspace || process.cwd()).trim() || process.cwd();
    const escapedWorkspace = JSON.stringify(workspace);
    const escapedLabel = JSON.stringify(input.label);
    const capabilities = input.capabilityIds.join(',') || 'system.run';
    const pairingToken = `${input.nodeId}:${input.pairingCode}`;

    if (input.profile.kind === 'desktop' || input.profile.kind === 'mobile' || input.profile.kind === 'browser') {
      const command = `npm run companion:start -- --passcode ${JSON.stringify(pairingToken)} --base-url ${baseUrl} --node-id ${input.nodeId} --workspace ${escapedWorkspace} --label ${escapedLabel} --surface ${this.defaultSurfaceForProfile(input.profile)} --capabilities ${capabilities}`;
      const fallbackCommand = `node apps/zavorth-companion/index.js ${JSON.stringify(pairingToken)}`;
      return {
        packageScript: 'companion:start',
        command,
        fallbackCommand,
        pairingToken,
        workspaceHint: workspace,
        notes: [
          `Use o perfil ${input.profile.label} no host do operator e mantenha a sessao local ativa para publicar heartbeat.`,
          'O companion persiste credenciais locais e passa a usar shared secret apos o primeiro claim.',
        ],
      };
    }

    const command = `npm run nodes:host -- --base-url ${baseUrl} --node-id ${input.nodeId} --pairing-code ${input.pairingCode} --workspace ${escapedWorkspace} --capabilities ${capabilities}`;
    return {
      packageScript: 'nodes:host',
      command,
      fallbackCommand: null,
      pairingToken,
      workspaceHint: workspace,
      notes: [
        'Use este bootstrap para hosts headless, sidecars e bridges sem UI dedicada.',
        'Depois do primeiro heartbeat o pairing code deixa de ser necessario e o host passa a usar shared secret.',
      ],
    };
  }
}
