import type {
  ZavorthActionDefinition,
  ZavorthActionHandlerInput,
  ZavorthActionModule,
  ZavorthActionResult,
  ZavorthActionSchema,
} from '../ZavorthActionContracts.js';
import { UniversalPowerFabricService } from '../../../services/UniversalPowerFabricService.js';

import type { PowerBackendId } from '../../../contracts/UniversalPowerFabricContract.js';

const SURFACE: ZavorthActionDefinition['surface'] = ['cli', 'zavorthControl', 'tui', 'api', 'channel', 'llm'];
const TEST_REFS = ['tests/services/UniversalPowerFabricService.test.ts'];

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

function service(root: string): UniversalPowerFabricService {
  return new UniversalPowerFabricService({ projectRoot: root });
}

function powerInventory(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const snap = service(input.root).buildSnapshot();
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: snap.narrative.operatorSummary,
    lines: [
      `Status: ${snap.status}`,
      `Elastic profile: ${snap.elasticProfile}`,
      `Trusted Operator: ${snap.trustedOperator.enabled}`,
      `Yellow candidates: ${snap.summary.yellowCandidates}`,
      snap.narrative.nextSafeAction,
    ],
    data: { snapshot: snap },
  });
}

function powerBackendPlan(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const backend = text(input.args.backend, 'local') as PowerBackendId;
  const command = text(input.args.command) || undefined;
  const out = service(input.root).planBackend({ backend, command });
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'preview',
    summary: out.receipt.summary,
    lines: [
      `Backend: ${out.snapshot.selectedBackend}`,
      `Mode: ${out.snapshot.plan.mode}`,
      out.snapshot.plan.reason,
      'Live remains gated by approval + live flag + env.',
    ],
    data: out as unknown as Record<string, unknown>,
  });
}

function powerTrustedMode(input: ZavorthActionHandlerInput): ZavorthActionResult {
  if (input.operation === 'action.preview' || input.operation === 'action.status') {
    const state = service(input.root).buildSnapshot().trustedOperator;
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'preview',
      summary: `Trusted Operator Mode is ${state.enabled ? 'ON' : 'OFF'}.`,
      lines: [
        `Red lane intact: ${state.redLaneIntact}`,
        `Receipts always: ${state.receiptsAlways}`,
        'Apply with confirmation to toggle.',
      ],
      data: { state },
    });
  }
  if (input.trustedOperatorConfirmation !== true) {
    return block(input, 'Toggling Trusted Operator Mode requires approval.', ['Preview first, then apply with confirmation.']);
  }
  const enabled = text(input.args.enabled || input.args.mode, 'on');
  const on = enabled === 'on' || enabled === 'true' || enabled === 'enable' || enabled === '1';
  const out = service(input.root).setTrustedOperator({
    enabled: on,
    updatedBy: text(input.actorId, 'action-harness'),
    note: text(input.args.note) || null,
  });
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'applied',
    summary: out.receipt.summary,
    lines: [`Enabled: ${out.state.enabled}`, `Red lane intact: ${out.state.redLaneIntact}`],
    data: out as unknown as Record<string, unknown>,
  });
}

async function powerLearnObserve(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const observation = text(input.args.observation || input.args.text || input.args.message);
  if (!observation) return block(input, 'Missing observation text.', ['Provide args.observation.']);
  const out = await service(input.root).observeLearning({ observation });
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: out.receipt.summary,
    lines: out.staged.length
      ? out.staged.map((c) => `staged ${c.kind}: ${c.id} — ${c.title}`)
      : ['No yellow candidates staged from this observation.'],
    data: { staged: out.staged, receipt: out.receipt },
  });
}

function powerLearnPromote(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const candidateId = text(input.args.candidateId || input.args.id);
  if (!candidateId) return block(input, 'Missing candidate id.', ['Provide args.candidateId.']);
  if (input.operation === 'action.preview' || input.operation === 'action.status') {
    const out = service(input.root).promoteLearning({ candidateId, consent: false, previewOnly: true });
    return result({
      ok: out.receipt.status !== 'deny',
      actionId: input.actionId,
      operation: input.operation,
      status: 'preview',
      summary: out.receipt.summary,
      lines: [out.candidate ? `${out.candidate.kind}: ${out.candidate.title}` : 'not found'],
      data: out as unknown as Record<string, unknown>,
    });
  }
  if (input.trustedOperatorConfirmation !== true) {
    return block(input, 'Promotion requires explicit approval/consent.', ['Preview first, then apply with confirmation.']);
  }
  const out = service(input.root).promoteLearning({ candidateId, consent: true });
  return result({
    ok: out.receipt.status !== 'deny',
    actionId: input.actionId,
    operation: input.operation,
    status: out.receipt.status === 'deny' ? 'blocked' : 'applied',
    summary: out.receipt.summary,
    lines: out.materialPath ? [`Material: ${out.materialPath}`] : [],
    data: out as unknown as Record<string, unknown>,
  });
}

function powerHarnessRegister(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const label = text(input.args.label || input.args.name);
  if (!label) return block(input, 'Missing harness label.', ['Provide args.label.']);
  if (input.operation === 'action.preview' || input.operation === 'action.status') {
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'preview',
      summary: `Preview register harness ${label}.`,
      lines: ['Read-only default; mutations need separate approval.', 'Apply with confirmation to register.'],
      data: { label },
    });
  }
  if (input.trustedOperatorConfirmation !== true) {
    return block(input, 'Registering a harness requires approval.', ['Preview first, then apply with confirmation.']);
  }
  const out = service(input.root).registerHarness({
    label,
    id: text(input.args.id) || undefined,
    commandOrEndpoint: text(input.args.command || input.args.endpoint) || null,
    notes: text(input.args.notes) ? [text(input.args.notes)] : undefined,
  });
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'applied',
    summary: out.receipt.summary,
    lines: [`Status: ${out.adapter.status}`, `Kind: ${out.adapter.kind}`],
    data: out as unknown as Record<string, unknown>,
  });
}

function powerContext(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const out = service(input.root).contextSnapshot({
    visibleToolCount: Number(input.args.visibleToolCount || input.args.tools || 0) || undefined,
    skillBytesInPrompt: Number(input.args.skillBytesInPrompt || input.args.skillBytes || 0) || undefined,
  });
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: out.receipt.summary,
    lines: out.snapshot.recommendations,
    data: { snapshot: out.snapshot },
  });
}

export function createPowerFabricActionModule(): ZavorthActionModule {
  return {
    id: 'power-fabric',
    manifestId: 'power-fabric',
    actions: [
      action('power-fabric', {
        id: 'power.inventory',
        title: 'Power inventory',
        description: 'Elastic backends, trusted operator, learning candidates, harnesses and context budget.',
        aliases: ['power status', 'execution power', 'trusted operator status'],
        domains: ['execution', 'learning'],
        risk: 'safe',
        effects: ['read'],
        scope: 'power',
        receiptPolicy: 'none',
        requiresPreview: false,
        requiresApproval: false,
        inputSchema: { type: 'object', properties: {} },
        outputSchema,
        handler: powerInventory,
      }),
      action('power-fabric', {
        id: 'power.backend.plan',
        title: 'Plan execution backend',
        description: 'Preview a governed terminal/backend plan without live execution.',
        aliases: ['plan backend', 'plan modal', 'plan daytona', 'execution plan'],
        domains: ['execution'],
        risk: 'safe',
        effects: ['read'],
        scope: 'power',
        receiptPolicy: 'none',
        requiresPreview: false,
        requiresApproval: false,
        inputSchema: {
          type: 'object',
          properties: {
            backend: { type: 'string' },
            command: { type: 'string' },
          },
        },
        outputSchema,
        handler: powerBackendPlan,
      }),
      action('power-fabric', {
        id: 'power.trusted.toggle',
        title: 'Toggle Trusted Operator Mode',
        description: 'Reduce green-lane friction for single-user local use. Red lane and receipts stay intact.',
        aliases: ['enable trusted operator', 'disable trusted operator', 'trusted mode'],
        domains: ['security', 'approvals'],
        risk: 'attention',
        mutationDomain: 'capability',
        mutationRisk: 'medium',
        effects: ['write'],
        scope: 'power',
        receiptPolicy: 'required',
        requiresPreview: true,
        requiresApproval: true,
        inputSchema: {
          type: 'object',
          properties: {
            enabled: { type: 'string' },
            mode: { type: 'string' },
            note: { type: 'string' },
          },
        },
        outputSchema,
        handler: powerTrustedMode,
      }),
      action('power-fabric', {
        id: 'power.learn.observe',
        title: 'Observe for learning',
        description: 'Ingest an observation: green prefs may auto-persist; yellow skills/procedures stage for promote.',
        aliases: ['learn this', 'remember preference', 'stage skill from workflow'],
        domains: ['learning'],
        risk: 'safe',
        effects: ['write'],
        scope: 'power',
        receiptPolicy: 'none',
        requiresPreview: false,
        requiresApproval: false,
        inputSchema: {
          type: 'object',
          properties: { observation: { type: 'string' }, text: { type: 'string' } },
        },
        outputSchema,
        handler: powerLearnObserve,
      }),
      action('power-fabric', {
        id: 'power.learn.promote',
        title: 'Promote yellow learning candidate',
        description: 'Promote a staged shadow skill or procedure with explicit consent.',
        aliases: ['promote skill', 'promote procedure', 'accept yellow digest'],
        domains: ['learning'],
        risk: 'attention',
        mutationDomain: 'capability',
        mutationRisk: 'medium',
        effects: ['write'],
        scope: 'power',
        receiptPolicy: 'required',
        requiresPreview: true,
        requiresApproval: true,
        inputSchema: {
          type: 'object',
          properties: { candidateId: { type: 'string' }, id: { type: 'string' } },
        },
        outputSchema,
        handler: powerLearnPromote,
      }),
      action('power-fabric', {
        id: 'power.harness.register',
        title: 'Register external harness',
        description: 'Register a generic external executor adapter (CLI/ACP/HTTP/stdio). Read-only default.',
        aliases: ['register harness', 'add external executor'],
        domains: ['execution', 'interop'],
        risk: 'attention',
        mutationDomain: 'capability',
        mutationRisk: 'medium',
        effects: ['write'],
        scope: 'power',
        receiptPolicy: 'required',
        requiresPreview: true,
        requiresApproval: true,
        inputSchema: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            command: { type: 'string' },
            endpoint: { type: 'string' },
          },
        },
        outputSchema,
        handler: powerHarnessRegister,
      }),
      action('power-fabric', {
        id: 'power.context',
        title: 'Context discipline',
        description: 'Inspect tool/skill prompt budgets and progressive disclosure recommendations.',
        aliases: ['context budget', 'tool budget', 'prompt cache discipline'],
        domains: ['execution'],
        risk: 'safe',
        effects: ['read'],
        scope: 'power',
        receiptPolicy: 'none',
        requiresPreview: false,
        requiresApproval: false,
        inputSchema: {
          type: 'object',
          properties: {
            visibleToolCount: { type: 'number' },
            skillBytesInPrompt: { type: 'number' },
          },
        },
        outputSchema,
        handler: powerContext,
      }),
    ],
  };
}
