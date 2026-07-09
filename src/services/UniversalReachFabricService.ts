import { asErrorLike } from '../utils/errorLike';
/**
 * Universal Reach Fabric Service
 *
 * Single inventory for channel tiers + node product surface.
 * Catalog ≠ live. Tier C never live without proof.
 */

import crypto from 'node:crypto';
import path from 'node:path';

import {
  UNIVERSAL_REACH_FABRIC_CONTRACT_VERSION,
  type ReachChannelEntry,
  type ReachChannelFamily,
  type ReachChannelReadiness,
  type ReachChannelTier,
  type ReachFabricReceipt,
  type ReachFabricSnapshot,
  type ReachNodeCapability,
  type ReachNodeEntry,
  type ReachNodeInvokePreview,
  type ReachNodePairingDraft,
  type ReachNodeStatus,
  type ReachReadinessProof,
} from '../contracts/UniversalReachFabricContract.js';
import {
  BUILTIN_PROTOCOL_PACKS,
  buildProtocolPackDoctor,
  type ProtocolPackDescriptor,
} from './reach/ProtocolPackBase.js';
import { ChannelSynthesisService, type ChannelSynthesisInput } from './reach/ChannelSynthesisService.js';
import { NodeRegistryService } from './NodeRegistryService.js';
import { NodeOnboardingService } from './NodeOnboardingService.js';
import { NodePairingService } from './NodePairingService.js';
import { NodeInvokeService } from './NodeInvokeService.js';
import { LiveNodeRegistryService, globalLiveNodeRegistry } from './LiveNodeRegistryService.js';
import { buildNodeCapabilitiesRegistry } from '../nodes/capabilities/NodeCapabilities.js';

export type ReachFabricBuildInput = {
  projectRoot?: string;
  env?: Record<string, string | undefined>;
  includeSynthesisDrafts?: boolean;
};

type Runtime = {
  projectRoot?: string;
  now?: () => Date;
  env?: Record<string, string | undefined>;
  synthesis?: ChannelSynthesisService;
  nodeRegistry?: Pick<NodeRegistryService, 'listNodes' | 'getNode'>;
  nodePairing?: Pick<NodePairingService, 'createPairingDraft' | 'buildBootstrapForNode'>;
  nodeInvoke?: Pick<NodeInvokeService, 'preview' | 'invoke' | 'listRecent'>;
  liveNodes?: LiveNodeRegistryService;
  onboarding?: NodeOnboardingService;
};

/** Tier A first-class surfaces — deep native paths in core */
const TIER_A: Array<{
  id: string;
  label: string;
  family: ReachChannelFamily;
  requiredEnvKeys: string[];
  features?: Partial<ReachChannelEntry['features']>;
}> = [
  { id: 'cli', label: 'CLI', family: 'local-surface', requiredEnvKeys: [] },
  { id: 'web', label: 'Zavorth Control / Web', family: 'local-surface', requiredEnvKeys: [] },
  { id: 'telegram', label: 'Telegram', family: 'bot-api', requiredEnvKeys: ['TELEGRAM_BOT_TOKEN'], features: { media: true, pairing: true } },
  { id: 'discord', label: 'Discord', family: 'bot-api', requiredEnvKeys: ['DISCORD_BOT_TOKEN'], features: { media: true } },
  { id: 'whatsapp', label: 'WhatsApp', family: 'bot-api', requiredEnvKeys: ['WHATSAPP_PROVIDER'], features: { media: true, pairing: true } },
  { id: 'slack', label: 'Slack', family: 'bot-api', requiredEnvKeys: ['SLACK_BOT_TOKEN'], features: { media: true } },
  { id: 'signal', label: 'Signal', family: 'local-bridge', requiredEnvKeys: ['SIGNAL_CLI_CONFIG' /* or bridge */], features: { pairing: true } },
  { id: 'imessage', label: 'iMessage bridge', family: 'local-bridge', requiredEnvKeys: [], features: { pairing: true } },
  { id: 'teams', label: 'Teams', family: 'graph-api', requiredEnvKeys: ['TEAMS_APP_ID'] },
  { id: 'email', label: 'Email', family: 'mail', requiredEnvKeys: ['SMTP_URL'] },
];

const NODE_CAPABILITY_CATALOG: ReachNodeCapability[] = [
  { id: 'files.read', family: 'files', label: 'Read files', risk: 'low', requiresApproval: false, description: 'Read within authorized roots.' },
  { id: 'files.write', family: 'files', label: 'Write files', risk: 'medium', requiresApproval: true, description: 'Write within authorized roots.' },
  { id: 'system.run', family: 'shell', label: 'Run command', risk: 'high', requiresApproval: true, description: 'Controlled shell on paired node.' },
  { id: 'camera.capture', family: 'camera', label: 'Camera capture', risk: 'high', requiresApproval: true, description: 'Capture from configured camera source.' },
  { id: 'screen.capture', family: 'screen', label: 'Screen capture', risk: 'high', requiresApproval: true, description: 'Passive screen capture.' },
  { id: 'location.read', family: 'location', label: 'Location', risk: 'medium', requiresApproval: true, description: 'Read configured location.' },
  { id: 'notifications.send', family: 'notify', label: 'Notify', risk: 'low', requiresApproval: false, description: 'Native host notification.' },
  { id: 'clipboard.read', family: 'clipboard', label: 'Clipboard read', risk: 'medium', requiresApproval: true, description: 'Read host clipboard.' },
  { id: 'clipboard.write', family: 'clipboard', label: 'Clipboard write', risk: 'medium', requiresApproval: true, description: 'Write host clipboard.' },
  { id: 'device.info', family: 'device', label: 'Device info', risk: 'low', requiresApproval: false, description: 'Identity and host signals.' },
  { id: 'browser.proxy', family: 'browser', label: 'Browser proxy', risk: 'medium', requiresApproval: true, description: 'Open or confirm browser endpoint.' },
  { id: 'node.maintenance', family: 'maintenance', label: 'Node maintenance', risk: 'medium', requiresApproval: true, description: 'Doctor/repair on node host.' },
];

export class UniversalReachFabricService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly env: Record<string, string | undefined>;
  private readonly synthesis: ChannelSynthesisService;
  private readonly nodeRegistry: Pick<NodeRegistryService, 'listNodes' | 'getNode'>;
  private readonly nodePairing: Pick<NodePairingService, 'createPairingDraft' | 'buildBootstrapForNode'> | null;
  private readonly nodeInvoke: Pick<NodeInvokeService, 'preview' | 'invoke' | 'listRecent'> | null;
  private readonly liveNodes: LiveNodeRegistryService;
  private readonly onboarding: NodeOnboardingService;

  constructor(runtime: Runtime = {}) {
    this.projectRoot = runtime.projectRoot || process.cwd();
    this.now = runtime.now || (() => new Date());
    this.env = runtime.env || process.env;
    this.synthesis = runtime.synthesis || new ChannelSynthesisService({ projectRoot: this.projectRoot });
    this.nodeRegistry = runtime.nodeRegistry || new NodeRegistryService();
    if (runtime.nodePairing === null) {
      this.nodePairing = null;
    } else if (runtime.nodePairing) {
      this.nodePairing = runtime.nodePairing;
    } else {
      try {
        this.nodePairing = new NodePairingService();
      } catch {
        this.nodePairing = null;
      }
    }
    if (runtime.nodeInvoke === null) {
      this.nodeInvoke = null;
    } else if (runtime.nodeInvoke) {
      this.nodeInvoke = runtime.nodeInvoke;
    } else {
      try {
        this.nodeInvoke = new NodeInvokeService();
      } catch {
        this.nodeInvoke = null;
      }
    }
    this.liveNodes = runtime.liveNodes || globalLiveNodeRegistry;
    this.onboarding = runtime.onboarding || new NodeOnboardingService();
  }

  public buildSnapshot(input: ReachFabricBuildInput = {}): ReachFabricSnapshot {
    const env = input.env || this.env;
    const channels = [
      ...this.buildTierA(env),
      ...this.buildTierB(env),
      ...this.buildTierC(),
    ];
    const nodes = this.buildNodes();
    const synthesisDrafts = input.includeSynthesisDrafts === false
      ? []
      : this.synthesis.listDrafts();
    const receipts: ReachFabricReceipt[] = [
      this.receipt('channel-inventory', 'pass', `Inventoried ${channels.length} channel surface(s).`, null),
    ];

    const summary = {
      channelsTotal: channels.length,
      tierA: channels.filter((c) => c.tier === 'A').length,
      tierB: channels.filter((c) => c.tier === 'B').length,
      tierC: channels.filter((c) => c.tier === 'C').length,
      liveReady: channels.filter((c) => c.liveReady).length,
      configuredOnly: channels.filter((c) => c.readiness === 'configured').length,
      catalogued: channels.filter((c) => c.readiness === 'catalogued').length,
      synthesized: channels.filter((c) => c.readiness === 'synthesized').length,
      nodesTotal: nodes.length,
      nodesReady: nodes.filter((n) => n.status === 'ready' || n.canInvoke).length,
      nodesNeedReapproval: nodes.filter((n) => n.needsCapabilityReapproval).length,
    };

    const status: ReachFabricSnapshot['status'] =
      summary.nodesNeedReapproval > 0 || summary.liveReady === 0
        ? 'attention'
        : 'ok';

    return {
      contractVersion: UNIVERSAL_REACH_FABRIC_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      status,
      channels,
      nodes,
      nodeCapabilities: NODE_CAPABILITY_CATALOG,
      synthesisDrafts,
      receipts,
      summary,
      policy: {
        catalogIsNotLive: true,
        tierCNeverLiveWithoutProof: true,
        secretRefsOnly: true,
        rawSecretsSerialized: false,
        brandAgnostic: true,
        nodeCapabilityReapprovalRequired: true,
        previewBeforeMutate: true,
      },
      narrative: {
        headline: 'Reach Fabric inventory',
        operatorSummary: `${summary.liveReady} live-ready / ${summary.channelsTotal} channels · ${summary.nodesReady} ready nodes / ${summary.nodesTotal} total · Tier A/B/C = ${summary.tierA}/${summary.tierB}/${summary.tierC}`,
        nextSafeAction: summary.liveReady === 0
          ? 'Configure a Tier A channel and run doctor + live proof, or synthesize a Tier C pack for review.'
          : summary.nodesTotal === 0
            ? 'Create a node pairing draft to extend reach to a companion device.'
            : 'Use live-ready channels as routes; keep Tier C packs quarantined until proof.',
      },
    };
  }

  public doctorChannel(channelId: string): {
    entry: ReachChannelEntry | null;
    doctor: ReturnType<typeof buildProtocolPackDoctor> | null;
    receipt: ReachFabricReceipt;
  } {
    const snap = this.buildSnapshot();
    const entry = snap.channels.find((c) => c.id === channelId) || null;
    if (!entry) {
      return {
        entry: null,
        doctor: null,
        receipt: this.receipt('deny', 'deny', `Unknown channel: ${channelId}`, channelId),
      };
    }
    const pack = BUILTIN_PROTOCOL_PACKS.find((p) => p.id === channelId)
      || this.asPackFromEntry(entry);
    const doctor = buildProtocolPackDoctor(pack, this.env);
    return {
      entry: {
        ...entry,
        configured: doctor.configured,
        proof: doctor.proof,
        // never elevate to live from doctor alone
        liveReady: entry.tier === 'A' && entry.liveReady ? entry.liveReady : false,
        missingEnvKeys: doctor.missingEnvKeys,
      },
      doctor,
      receipt: this.receipt(
        'channel-doctor',
        doctor.configured ? 'pass' : 'hold',
        `Doctor ${channelId}: configured=${doctor.configured}, liveReady remains proof-gated.`,
        channelId,
      ),
    };
  }

  public synthesizeChannel(input: ChannelSynthesisInput) {
    return this.synthesis.synthesize({
      ...input,
      projectRoot: this.projectRoot,
    });
  }

  public createNodePairingDraft(input: {
    nodeId?: string;
    profileId?: string;
    capabilityIds?: string[];
    label?: string;
  }): { draft: ReachNodePairingDraft; receipt: ReachFabricReceipt } {
    const nodeId = slug(input.nodeId || `desktop-${Date.now().toString(36)}`);
    const profileId = input.profileId || 'desktop-companion';
    const capabilityIds = input.capabilityIds?.length
      ? input.capabilityIds
      : ['device.info', 'files.read', 'notifications.send'];
    const pairingCode = crypto.randomBytes(4).toString('hex');
    const createdAt = this.now().toISOString();

    // Prefer native pairing service when available
    if (this.nodePairing && typeof this.nodePairing.createPairingDraft === 'function') {
      try {
        const native = this.nodePairing.createPairingDraft({
          nodeId,
          profileId: profileId as any,
          capabilityIds: capabilityIds as any,
          label: input.label || nodeId,
        });
        const code = String(
          (native as any)?.pairingCode
          || (native as any)?.code
          || (native as any)?.entry?.pairingCode
          || pairingCode,
        );
        const resolvedNodeId = String((native as any)?.entry?.id || (native as any)?.nodeId || nodeId);
        const draft = this.toPairingDraft(
          resolvedNodeId,
          String((native as any)?.entry?.profileId || profileId),
          capabilityIds,
          code,
          createdAt,
        );
        return {
          draft,
          receipt: this.receipt('node-pairing-draft', 'pass', `Pairing draft ready for ${resolvedNodeId}.`, resolvedNodeId),
        };
      } catch {
        // fall through to local draft
      }
    }

    const draft = this.toPairingDraft(nodeId, profileId, capabilityIds, pairingCode, createdAt);
    return {
      draft,
      receipt: this.receipt('node-pairing-draft', 'pass', `Local pairing draft for ${nodeId} (bootstrap via companion).`, nodeId),
    };
  }

  public previewNodeInvoke(input: {
    nodeId: string;
    capabilityId: string;
    action?: string;
    payload?: Record<string, unknown>;
  }): { preview: ReachNodeInvokePreview; receipt: ReachFabricReceipt } {
    const cap = NODE_CAPABILITY_CATALOG.find((c) => c.id === input.capabilityId);
    const risk = cap?.risk || 'medium';
    const requiresApproval = cap?.requiresApproval ?? true;
    let allowed = true;
    let reason = 'Preview only — not executed.';

    if (this.nodeInvoke) {
      try {
        const result = this.nodeInvoke.preview({
          nodeId: input.nodeId,
          capabilityId: input.capabilityId as any,
          action: (input.action || 'invoke') as any,
          payload: input.payload || null,
        } as any);
        allowed = Boolean(result && (result as any).ok !== false && (result as any).allowed !== false);
        reason = String((result as any)?.reason || (result as any)?.summary || reason);
      } catch (error: unknown) {
        const err = asErrorLike(error);
        allowed = false;
        reason = error instanceof Error ? error.message : String(error);
      }
    } else {
      const node = this.nodeRegistry.getNode?.(input.nodeId);
      if (!node) {
        allowed = false;
        reason = `Node ${input.nodeId} is not registered.`;
      }
    }

    const preview: ReachNodeInvokePreview = {
      nodeId: input.nodeId,
      capabilityId: input.capabilityId,
      action: input.action || 'invoke',
      allowed,
      reason,
      requiresApproval,
      risk,
    };

    return {
      preview,
      receipt: this.receipt(
        'node-invoke-preview',
        allowed ? 'preview' : 'deny',
        `Node invoke preview ${input.capabilityId} on ${input.nodeId}: ${allowed ? 'allowed' : 'blocked'}.`,
        input.nodeId,
      ),
    };
  }

  public listNodeCapabilities(): ReachNodeCapability[] {
    // Merge static catalog with host registry ids when present
    const hostIds = new Set(buildNodeCapabilitiesRegistry().map((h) => h.id));
    return NODE_CAPABILITY_CATALOG.map((cap) => ({
      ...cap,
      description: hostIds.has(cap.id as any)
        ? cap.description
        : `${cap.description} (declared; host support may vary)`,
    }));
  }

  private buildTierA(env: Record<string, string | undefined>): ReachChannelEntry[] {
    return TIER_A.map((def) => {
      const missing = def.requiredEnvKeys.filter((k) => !String(env[k] || '').trim());
      // local surfaces are live-ready without external credentials
      const isLocal = def.family === 'local-surface';
      const configured = isLocal || (def.requiredEnvKeys.length > 0 && missing.length === 0);
      // Tier A still requires live proof for external channels — configuration alone is not enough
      const liveReady = isLocal;
      const readiness: ReachChannelReadiness = isLocal
        ? 'live-ready'
        : configured
          ? 'configured'
          : 'needs-setup';
      const proof: ReachReadinessProof = isLocal
        ? 'health'
        : configured
          ? 'configuration'
          : 'none';
      return this.entry({
        id: def.id,
        label: def.label,
        tier: 'A',
        family: def.family,
        readiness,
        proof,
        configured,
        liveReady,
        defaultRouteAllowed: liveReady,
        defaultBlockReason: liveReady
          ? null
          : configured
            ? 'Configured but not live-proven in this installation.'
            : `Missing setup: ${missing.join(', ') || 'credentials'}`,
        doctorCommand: `zavorth reach doctor ${def.id}`,
        setupHint: isLocal
          ? `${def.label} is a local surface.`
          : `Configure ${def.requiredEnvKeys.join(', ') || 'credentials'}, then doctor + live proof.`,
        features: {
          inbound: true,
          outbound: true,
          pairing: Boolean(def.features?.pairing),
          allowlist: !isLocal,
          doctor: true,
          media: Boolean(def.features?.media),
        },
        requiredEnvKeys: def.requiredEnvKeys,
        missingEnvKeys: missing,
      });
    });
  }

  private buildTierB(env: Record<string, string | undefined>): ReachChannelEntry[] {
    return BUILTIN_PROTOCOL_PACKS.map((pack) => {
      const doctor = buildProtocolPackDoctor(pack, env);
      const readiness: ReachChannelReadiness = doctor.configured ? 'configured' : 'catalogued';
      return this.entry({
        id: pack.id,
        label: pack.label,
        tier: 'B',
        family: this.familyFromTransport(pack.transport),
        readiness,
        proof: doctor.proof,
        configured: doctor.configured,
        liveReady: false,
        defaultRouteAllowed: false,
        defaultBlockReason: doctor.configured
          ? 'Tier B protocol pack requires live proof before default route.'
          : 'Protocol pack catalogued; configure env and run doctor.',
        doctorCommand: `zavorth reach doctor ${pack.id}`,
        setupHint: pack.setupHint,
        features: pack.features,
        requiredEnvKeys: pack.requiredEnvKeys,
        missingEnvKeys: doctor.missingEnvKeys,
      });
    });
  }

  private buildTierC(): ReachChannelEntry[] {
    return this.synthesis.listDrafts().map((draft) => this.entry({
      id: draft.channelId,
      label: `${draft.label} (synthesized)`,
      tier: 'C',
      family: draft.family,
      readiness: 'synthesized',
      proof: 'synthesis',
      configured: false,
      liveReady: false,
      defaultRouteAllowed: false,
      defaultBlockReason: 'Synthesized packs are never live-ready until doctor + live proof.',
      doctorCommand: `zavorth reach doctor ${draft.channelId}`,
      setupHint: `Review pack at ${draft.packDir}, set env, doctor, then live proof.`,
      features: {
        inbound: true,
        outbound: true,
        pairing: false,
        allowlist: true,
        doctor: true,
        media: false,
      },
      requiredEnvKeys: draft.requiredEnvKeys,
      missingEnvKeys: draft.requiredEnvKeys,
    }));
  }

  private buildNodes(): ReachNodeEntry[] {
    let registered: any[] = [];
    try {
      registered = this.nodeRegistry.listNodes?.() || [];
    } catch {
      registered = [];
    }

    // Merge live sessions when available
    let live: any[] = [];
    try {
      const snap = (this.liveNodes as any).snapshot?.() || (this.liveNodes as any).list?.() || [];
      live = Array.isArray(snap) ? snap : snap?.sessions || snap?.nodes || [];
    } catch {
      live = [];
    }

    const byId = new Map<string, ReachNodeEntry>();
    for (const node of registered) {
      const entry = this.toNodeEntry(node);
      byId.set(entry.nodeId, entry);
    }
    for (const session of live) {
      const id = String(session.nodeId || session.id || '').trim();
      if (!id) continue;
      const existing = byId.get(id);
      if (existing) {
        existing.status = 'online';
        existing.lastSeenAt = session.lastSeenAt || session.updatedAt || existing.lastSeenAt;
        existing.canInvoke = existing.paired || existing.canInvoke;
      } else {
        byId.set(id, {
          nodeId: id,
          label: String(session.label || id),
          status: 'online',
          profileId: session.profileId || null,
          paired: true,
          declaredCapabilities: session.capabilityIds || [],
          approvedCapabilities: session.approvedCapabilityIds || session.capabilityIds || [],
          needsCapabilityReapproval: false,
          canInvoke: true,
          lastSeenAt: session.lastSeenAt || null,
          nextSafeAction: 'Node is live; invoke only approved capabilities.',
        });
      }
    }
    return [...byId.values()].sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  }

  private toNodeEntry(node: any): ReachNodeEntry {
    const nodeId = String(node.id || node.nodeId || 'node');
    const declared = asStringArray(node.capabilityIds);
    const approved = asStringArray(node.approvedCapabilityIds);
    const paired = Boolean(node.paired || node.pairingStatus === 'paired');
    const needsCapabilityReapproval = declared.some((id) => !approved.includes(id));
    const status = this.nodeStatus(node, paired, needsCapabilityReapproval);
    const canInvoke = Boolean(node.canInvoke) || (paired && status === 'ready' && !needsCapabilityReapproval);
    return {
      nodeId,
      label: String(node.label || nodeId),
      status,
      profileId: node.profileId || null,
      paired,
      declaredCapabilities: declared,
      approvedCapabilities: approved,
      needsCapabilityReapproval,
      canInvoke,
      lastSeenAt: node.lastSeenAt || null,
      nextSafeAction: needsCapabilityReapproval
        ? 'Approve new capabilities before invoke.'
        : !paired
          ? 'Complete pairing with companion bootstrap.'
          : canInvoke
            ? 'Node ready for governed invokes.'
            : 'Wait for heartbeat / approve capabilities.',
    };
  }

  private nodeStatus(node: any, paired: boolean, needsReapproval: boolean): ReachNodeStatus {
    if (node.status === 'blocked' || node.pairingStatus === 'revoked') return 'blocked';
    if (needsReapproval) return 'paired';
    if (node.status === 'online' || node.canInvoke) return node.canInvoke ? 'ready' : 'online';
    if (paired) return 'paired';
    if (node.pairingStatus === 'pending') return 'draft';
    if (node.status === 'offline') return 'offline';
    return paired ? 'paired' : 'empty';
  }

  private familyFromTransport(transport: ProtocolPackDescriptor['transport']): ReachChannelFamily {
    switch (transport) {
      case 'webhook': return 'webhook';
      case 'bot-http': return 'bot-api';
      case 'local-bridge': return 'local-bridge';
      case 'relay': return 'relay';
      case 'graph-api': return 'graph-api';
      case 'mail': return 'mail';
      default: return 'unknown';
    }
  }

  private asPackFromEntry(entry: ReachChannelEntry): ProtocolPackDescriptor {
    return {
      id: entry.id,
      label: entry.label,
      transport: entry.family === 'bot-api'
        ? 'bot-http'
        : entry.family === 'local-bridge'
          ? 'local-bridge'
          : entry.family === 'relay'
            ? 'relay'
            : entry.family === 'graph-api'
              ? 'graph-api'
              : entry.family === 'mail'
                ? 'mail'
                : 'webhook',
      webhookPath: `/api/webhooks/${entry.id}`,
      requiredEnvKeys: entry.requiredEnvKeys,
      optionalEnvKeys: [],
      features: entry.features,
      doctorSteps: [
        'Validate required environment keys',
        'Confirm allowlist is closed by default',
        'Verify transport health',
        'Never mark live-ready from catalog alone',
      ],
      setupHint: entry.setupHint,
    };
  }

  private entry(partial: ReachChannelEntry): ReachChannelEntry {
    return partial;
  }

  private toPairingDraft(
    nodeId: string,
    profileId: string,
    capabilityIds: string[],
    pairingCode: string,
    createdAt: string,
  ): ReachNodePairingDraft {
    const pass = `${nodeId}:${pairingCode}`;
    return {
      nodeId,
      pairingCode,
      profileId,
      capabilityIds,
      expiresAt: null,
      bootstrapCommand: `npm run nodes:host -- --passcode "${pass}" --base-url http://127.0.0.1:18789 --node-id "${nodeId}"`,
      companionCommand: `npm run companion:start -- --passcode "${pass}" --base-url http://127.0.0.1:18789 --node-id "${nodeId}"`,
      createdAt,
    };
  }

  private receipt(
    kind: ReachFabricReceipt['kind'],
    status: ReachFabricReceipt['status'],
    summary: string,
    subjectId: string | null,
  ): ReachFabricReceipt {
    return {
      id: `rcpt_${crypto.randomBytes(6).toString('hex')}`,
      kind,
      status,
      summary,
      subjectId,
      createdAt: this.now().toISOString(),
      rawSecretsSerialized: false,
    };
  }
}

function slug(value: string): string {
  return String(value || 'node')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'node';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v || '').trim()).filter(Boolean);
}

// silence unused onboarding import side — used for future expansion
void path;
