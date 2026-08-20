import type {
  ZavorthActionDefinition,
  ZavorthActionHandlerInput,
  ZavorthActionModule,
  ZavorthActionResult,
  ZavorthActionSchema,
} from '../ZavorthActionContracts.js';
import { UniversalReachSubsystemService, UniversalReachFabricService } from '../../../services/UniversalReachSubsystemService.js';

const SURFACE: ZavorthActionDefinition['surface'] = ['cli', 'zavorthControl', 'tui', 'api', 'channel', 'llm'];
const TEST_REFS = ['tests/services/UniversalReachFabricService.test.ts'];

const outputSchema: ZavorthActionSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    summary: { type: 'string' },
  },
};

function text(value: unknown, fallback = ''): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function result(input: {
  ok: boolean;
  actionId: string;
  operation: ZavorthActionResult['operation'];
  status: ZavorthActionResult['status'];
  summary: string;
  lines: string[];
  data?: Record<string, unknown>;
}): ZavorthActionResult {
  return input;
}

function block(input: ZavorthActionHandlerInput, summary: string, lines: string[] = []): ZavorthActionResult {
  return result({
    ok: false,
    actionId: input.actionId,
    operation: input.operation,
    status: 'blocked',
    summary,
    lines: lines.length ? lines : [summary],
  });
}

function action(
  capabilityId: string,
  input: Omit<ZavorthActionDefinition, 'capabilityId' | 'verificationStatus' | 'surface' | 'testRefs'>,
): ZavorthActionDefinition {
  return { ...input, capabilityId, verificationStatus: 'verified', surface: SURFACE, testRefs: TEST_REFS };
}

function service(root: string): UniversalReachFabricService {
  return new UniversalReachFabricService({ projectRoot: root });
}

function reachInventory(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const snap = service(input.root).buildSnapshot({ includeSynthesisDrafts: true });
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: snap.narrative.operatorSummary,
    lines: [
      `Status: ${snap.status}`,
      `Tier A/B/C: ${snap.summary.tierA}/${snap.summary.tierB}/${snap.summary.tierC}`,
      `Live-ready channels: ${snap.summary.liveReady}`,
      `Nodes ready: ${snap.summary.nodesReady}/${snap.summary.nodesTotal}`,
      snap.narrative.nextSafeAction,
    ],
    data: { snapshot: snap },
  });
}

function reachDoctor(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const channelId = text(input.args.channelId || input.args.id || input.args.channel);
  if (!channelId) return block(input, 'Missing channel id.', ['Provide args.channelId.']);
  const out = service(input.root).doctorChannel(channelId);
  if (!out.entry) return block(input, out.receipt.summary);
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: out.entry.configured ? 'ok' : 'preview',
    summary: out.receipt.summary,
    lines: [
      `Tier: ${out.entry.tier}`,
      `Configured: ${out.entry.configured}`,
      `Live-ready: ${out.entry.liveReady}`,
      `Missing: ${out.entry.missingEnvKeys.join(', ') || 'none'}`,
      out.doctor?.nextSafeAction || out.entry.setupHint,
    ],
    data: out as unknown as Record<string, unknown>,
  });
}

function reachSynthesize(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const channelId = text(input.args.channelId || input.args.id || input.args.name);
  if (!channelId) return block(input, 'Missing channel id to synthesize.', ['Provide args.channelId.']);
  const apply = input.operation === 'action.apply';
  if (apply && input.trustedOperatorConfirmation !== true) {
    return block(input, 'Synthesis materialize requires approval/consent.', ['Preview first, then apply with confirmation.']);
  }
  const out = service(input.root).synthesizeChannel({
    channelId,
    label: text(input.args.label || channelId),
    notes: text(input.args.notes || input.args.docs || ''),
    family: (text(input.args.family || 'synthesized') as any),
    apply,
  });
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: apply ? 'applied' : 'preview',
    summary: out.receipt.summary,
    lines: [
      `Channel: ${out.draft.channelId}`,
      `Family: ${out.draft.family}`,
      `Trust: ${out.draft.trustState}`,
      `Live-ready: false`,
      `Env: ${out.draft.requiredEnvKeys.join(', ') || 'none'}`,
      apply ? `Pack: ${out.draft.packDir}` : 'Re-run apply with approval to quarantine pack.',
    ],
    data: out as unknown as Record<string, unknown>,
  });
}

function reachNodes(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const snap = service(input.root).buildSnapshot();
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `${snap.nodes.length} node(s); ${snap.summary.nodesReady} ready.`,
    lines: snap.nodes.length
      ? snap.nodes.map((n) => `${n.nodeId} [${n.status}] invoke=${n.canInvoke} — ${n.nextSafeAction}`)
      : ['No nodes yet. Create a pairing draft first.'],
    data: { nodes: snap.nodes, capabilities: snap.nodeCapabilities },
  });
}

function reachPair(input: ZavorthActionHandlerInput): ZavorthActionResult {
  if (input.operation === 'action.preview' || input.operation === 'action.status') {
    const nodeId = text(input.args.nodeId || input.args.id, 'desktop-companion');
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'preview',
      summary: `Preview pairing draft for ${nodeId}.`,
      lines: [
        `Node: ${nodeId}`,
        `Profile: ${text(input.args.profileId || input.args.profile, 'desktop-companion')}`,
        'Apply with approval to create pairing code and bootstrap commands.',
      ],
      data: { nodeId },
    });
  }
  if (input.trustedOperatorConfirmation !== true) {
    return block(input, 'Creating a pairing draft requires approval.', ['Preview first, then apply with confirmation.']);
  }
  const out = service(input.root).createNodePairingDraft({
    nodeId: text(input.args.nodeId || input.args.id) || undefined,
    profileId: text(input.args.profileId || input.args.profile) || undefined,
    label: text(input.args.label) || undefined,
    capabilityIds: Array.isArray(input.args.capabilityIds)
      ? (input.args.capabilityIds as unknown[]).map((v) => String(v))
      : undefined,
  });
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'applied',
    summary: out.receipt.summary,
    lines: [
      `Node: ${out.draft.nodeId}`,
      `Code: ${out.draft.pairingCode}`,
      `Capabilities: ${out.draft.capabilityIds.join(', ')}`,
      out.draft.bootstrapCommand,
      out.draft.companionCommand,
    ],
    data: out as unknown as Record<string, unknown>,
  });
}

function reachInvokePreview(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const nodeId = text(input.args.nodeId || input.args.node);
  const capabilityId = text(input.args.capabilityId || input.args.capability);
  if (!nodeId || !capabilityId) {
    return block(input, 'Missing nodeId or capabilityId.', ['Provide args.nodeId and args.capabilityId.']);
  }
  const out = service(input.root).previewNodeInvoke({
    nodeId,
    capabilityId,
    action: text(input.args.action, 'invoke'),
    payload: (input.args.payload && typeof input.args.payload === 'object')
      ? input.args.payload as Record<string, unknown>
      : undefined,
  });
  return result({
    ok: out.preview.allowed,
    actionId: input.actionId,
    operation: input.operation,
    status: out.preview.allowed ? 'preview' : 'blocked',
    summary: out.receipt.summary,
    lines: [
      `Allowed: ${out.preview.allowed}`,
      `Risk: ${out.preview.risk}`,
      `Approval: ${out.preview.requiresApproval}`,
      out.preview.reason,
    ],
    data: out as unknown as Record<string, unknown>,
  });
}

export function createReachFabricActionModule(): ZavorthActionModule {
  return {
    id: 'reach-fabric',
    manifestId: 'reach-fabric',
    actions: [
      action('reach-fabric', {
        id: 'reach.inventory',
        title: 'Reach inventory',
        description: 'List channel tiers and node mesh readiness. Catalog is never live.',
        aliases: ['reach status', 'channel tiers', 'node inventory', 'what channels are ready'],
        domains: ['channels', 'nodes'],
        risk: 'safe',
        effects: ['read'],
        scope: 'reach',
        receiptPolicy: 'none',
        requiresPreview: false,
        requiresApproval: false,
        inputSchema: { type: 'object', properties: {} },
        outputSchema,
        handler: reachInventory,
      }),
      action('reach-fabric', {
        id: 'reach.doctor',
        title: 'Channel doctor',
        description: 'Doctor a channel surface without claiming live readiness from catalog alone.',
        aliases: ['channel doctor', 'doctor channel'],
        domains: ['channels'],
        risk: 'safe',
        effects: ['read'],
        scope: 'reach',
        receiptPolicy: 'none',
        requiresPreview: false,
        requiresApproval: false,
        inputSchema: { type: 'object', properties: { channelId: { type: 'string' } }, required: ['channelId'] },
        outputSchema,
        handler: reachDoctor,
      }),
      action('reach-fabric', {
        id: 'reach.synthesize',
        title: 'Synthesize channel pack',
        description: 'Generate a Tier C protocol pack from a channel id and notes. Never live until proof.',
        aliases: ['synthesize channel', 'generate channel pack', 'create channel adapter'],
        domains: ['channels'],
        risk: 'attention',
        mutationDomain: 'capability',
        mutationRisk: 'medium',
        effects: ['write'],
        scope: 'reach',
        receiptPolicy: 'required',
        requiresPreview: true,
        requiresApproval: true,
        inputSchema: {
          type: 'object',
          properties: {
            channelId: { type: 'string' },
            label: { type: 'string' },
            notes: { type: 'string' },
            family: { type: 'string' },
          },
          required: ['channelId'],
        },
        outputSchema,
        handler: reachSynthesize,
      }),
      action('reach-fabric', {
        id: 'reach.nodes',
        title: 'List nodes',
        description: 'List paired/live nodes and capability reapproval state.',
        aliases: ['list nodes', 'node mesh status'],
        domains: ['nodes'],
        risk: 'safe',
        effects: ['read'],
        scope: 'reach',
        receiptPolicy: 'none',
        requiresPreview: false,
        requiresApproval: false,
        inputSchema: { type: 'object', properties: {} },
        outputSchema,
        handler: reachNodes,
      }),
      action('reach-fabric', {
        id: 'reach.pair',
        title: 'Create node pairing draft',
        description: 'Create a governed pairing draft and bootstrap commands for a companion node.',
        aliases: ['pair node', 'node pairing', 'create pairing'],
        domains: ['nodes'],
        risk: 'attention',
        mutationDomain: 'capability',
        mutationRisk: 'medium',
        effects: ['write'],
        scope: 'reach',
        receiptPolicy: 'required',
        requiresPreview: true,
        requiresApproval: true,
        inputSchema: {
          type: 'object',
          properties: {
            nodeId: { type: 'string' },
            profileId: { type: 'string' },
            label: { type: 'string' },
          },
        },
        outputSchema,
        handler: reachPair,
      }),
      action('reach-fabric', {
        id: 'reach.invoke.preview',
        title: 'Preview node invoke',
        description: 'Preview a governed node capability invoke without executing it.',
        aliases: ['preview node invoke', 'node invoke preview'],
        domains: ['nodes'],
        risk: 'safe',
        effects: ['read'],
        scope: 'reach',
        receiptPolicy: 'none',
        requiresPreview: false,
        requiresApproval: false,
        inputSchema: {
          type: 'object',
          properties: {
            nodeId: { type: 'string' },
            capabilityId: { type: 'string' },
            action: { type: 'string' },
          },
          required: ['nodeId', 'capabilityId'],
        },
        outputSchema,
        handler: reachInvokePreview,
      }),
    ],
  };
}

