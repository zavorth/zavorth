import type {
  ZavorthActionDefinition,
  ZavorthActionHandlerInput,
  ZavorthActionModule,
  ZavorthActionResult,
  ZavorthActionSchema,
} from '../ZavorthActionContracts.js';
import { UniversalProductSubsystemService, UniversalProductFabricService } from '../../../services/UniversalProductSubsystemService.js';

const SURFACE: ZavorthActionDefinition['surface'] = ['cli', 'zavorthControl', 'tui', 'api', 'channel', 'llm'];
const TEST_REFS = ['tests/services/UniversalProductFabricService.test.ts'];

const outputSchema: ZavorthActionSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    summary: { type: 'string' },
  },
};

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

function action(
  capabilityId: string,
  input: Omit<ZavorthActionDefinition, 'capabilityId' | 'verificationStatus' | 'surface' | 'testRefs'>,
): ZavorthActionDefinition {
  return { ...input, capabilityId, verificationStatus: 'verified', surface: SURFACE, testRefs: TEST_REFS };
}

function service(root: string): UniversalProductFabricService {
  return new UniversalProductFabricService({ projectRoot: root });
}

async function productInventory(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const snap = await service(input.root).buildSnapshot({ runCertification: false });
  return result({
    ok: snap.status !== 'blocked',
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: snap.narrative.operatorSummary,
    lines: [
      snap.narrative.productThesis,
      `Status: ${snap.status}`,
      `First-run: ${Math.round(snap.firstRun.progress * 100)}%`,
      `Next: ${snap.narrative.nextSafeAction}`,
    ],
    data: { snapshot: snap },
  });
}

async function productCertify(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const snap = await service(input.root).certify();
  return result({
    ok: snap.certification.blocked === 0,
    actionId: input.actionId,
    operation: input.operation,
    status: snap.certification.blocked > 0 ? 'blocked' : 'ok',
    summary: `Certification ${snap.certification.status}: ${snap.certification.passed} passed, ${snap.certification.attention} attention, ${snap.certification.blocked} blocked.`,
    lines: snap.certification.checks.map((c) => `[${c.status}] ${c.fabric}/${c.id}: ${c.summary}`),
    data: { snapshot: snap },
  });
}

async function productDoctor(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const out = await service(input.root).doctor();
  return result({
    ok: out.status !== 'blocked',
    actionId: input.actionId,
    operation: input.operation,
    status: out.status === 'blocked' ? 'blocked' : 'ok',
    summary: `Product doctor status=${out.status}`,
    lines: out.lines,
    data: { snapshot: out.snapshot },
  });
}

function productCommands(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const group = String(input.args.group || '').trim() as any;
  const cmds = service(input.root).listPublicCommands(group || undefined);
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `${cmds.length} public command(s). Prefer zavorth CLI over monorepo npm scripts.`,
    lines: cmds.map((c) => `${c.command} — ${c.summary}`),
    data: { commands: cmds },
  });
}

export function createProductFabricActionModule(): ZavorthActionModule {
  return {
    id: 'product-fabric',
    manifestId: 'product-fabric',
    actions: [
      action('product-fabric', {
        id: 'product.inventory',
        title: 'Product readiness',
        description: 'First-run progress, public commands, and fabric readiness without live IO.',
        aliases: ['product status', 'am i ready', 'daily product readiness'],
        domains: ['product'],
        risk: 'safe',
        effects: ['read'],
        scope: 'product',
        receiptPolicy: 'none',
        requiresPreview: false,
        requiresApproval: false,
        inputSchema: { type: 'object', properties: {} },
        outputSchema,
        handler: productInventory,
      }),
      action('product-fabric', {
        id: 'product.certify',
        title: 'Hermetic product certification',
        description: 'Run hermetic certification matrix across capability, reach, power and product planes.',
        aliases: ['certify product', 'fabric certification', 'product qa'],
        domains: ['product', 'qa'],
        risk: 'safe',
        effects: ['read'],
        scope: 'product',
        receiptPolicy: 'none',
        requiresPreview: false,
        requiresApproval: false,
        inputSchema: { type: 'object', properties: {} },
        outputSchema,
        handler: productCertify,
      }),
      action('product-fabric', {
        id: 'product.doctor',
        title: 'Product doctor',
        description: 'Diagnose first-run path and fabric certification for daily use.',
        aliases: ['product doctor', 'why am i not ready'],
        domains: ['product'],
        risk: 'safe',
        effects: ['read'],
        scope: 'product',
        receiptPolicy: 'none',
        requiresPreview: false,
        requiresApproval: false,
        inputSchema: { type: 'object', properties: {} },
        outputSchema,
        handler: productDoctor,
      }),
      action('product-fabric', {
        id: 'product.commands',
        title: 'List public commands',
        description: 'List user-facing zavorth CLI commands preferred over monorepo npm scripts.',
        aliases: ['public commands', 'what commands should i use'],
        domains: ['product'],
        risk: 'safe',
        effects: ['read'],
        scope: 'product',
        receiptPolicy: 'none',
        requiresPreview: false,
        requiresApproval: false,
        inputSchema: { type: 'object', properties: { group: { type: 'string' } } },
        outputSchema,
        handler: productCommands,
      }),
    ],
  };
}
