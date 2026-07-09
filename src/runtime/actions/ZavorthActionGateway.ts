import fsp from 'fs/promises';
import path from 'path';
import { config } from '../../config/index.js';
import { ZavorthMutationPlaneService } from '../../services/ZavorthMutationPlaneService.js';
import {
  type ZavorthActionDefinition,
  type ZavorthActionGatewayInput,
  type ZavorthActionLookupResult,
  type ZavorthActionOperation,
  type ZavorthActionResult,
  type ZavorthActionReceipt,
} from './ZavorthActionContracts.js';
import { ZavorthActionCatalog } from './ZavorthActionCatalog.js';

import type { GoalLoopLlmRuntime } from '../../services/GoalLoopService.js';
import type { GoalLoopAgentRunner } from '../../services/GoalLoopWorkerService.js';type Runtime = {
  root?: string;
  catalog?: ZavorthActionCatalog;
  llmRuntime?: GoalLoopLlmRuntime | null;
  goalLoopAgentRunner?: GoalLoopAgentRunner | null;
  mutationPlane?: Pick<ZavorthMutationPlaneService, 'createPlan' | 'readPlan'> | null;
  now?: () => Date;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function stateDir(root: string): string {
  return path.join(root, '.zavorth');
}

function receiptFile(root: string): string {
  return path.join(stateDir(root), 'receipts', 'actions.json');
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        /(token|secret|password|pass|api[_-]?key|credential)/iu.test(key) ? '***' : redactSecrets(entry),
      ]),
    );
  }
  return value;
}

async function readJsonArray(file: string): Promise<unknown[]> {
  try {
    const parsed = JSON.parse(await fsp.readFile(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error: unknown) {return [];
  }
}

async function appendJsonArray(file: string, value: unknown): Promise<void> {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const items = await readJsonArray(file);
  items.push(value);
  await fsp.writeFile(file, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
}

function idWithTime(prefix: string, now: Date): string {
  return `${prefix}-${now.toISOString().replace(/[-:.TZ]/gu, '').slice(0, 14)}`;
}

export class ZavorthActionGateway {
  private readonly root: string;
  private readonly catalog: ZavorthActionCatalog;
  private readonly mutationPlane: Pick<ZavorthMutationPlaneService, 'createPlan' | 'readPlan'> | null;
  private readonly now: () => Date;

  constructor(runtime: Runtime = {}) {
    this.root = path.resolve(runtime.root || config.projectRoot || process.cwd());
    this.catalog = runtime.catalog || new ZavorthActionCatalog({
      root: this.root,
      goalLoopLlmRuntime: runtime.llmRuntime || null,
      goalLoopAgentRunner: runtime.goalLoopAgentRunner || null,
    });
    this.mutationPlane = runtime.mutationPlane === null
      ? null
      : runtime.mutationPlane || new ZavorthMutationPlaneService({
        plansDir: path.join(stateDir(this.root), 'mutation-plans'),
      });
    this.now = runtime.now || (() => new Date());
  }

  public listActions(): ZavorthActionDefinition[] {
    return this.catalog.list();
  }

  public lookup(input: { query?: string | null; domain?: string | null; limit?: number }): ZavorthActionLookupResult[] {
    return this.catalog.lookup(input);
  }

  public async run(input: ZavorthActionGatewayInput): Promise<ZavorthActionResult> {
    if (input.operation === 'action.schema.lookup') {
      return this.lookupResult(input);
    }
    if (input.operation === 'action.receipts') {
      return this.receiptsResult(input);
    }

    const action = this.resolveAction(input);
    if (!action) {
      return this.notFound(input.operation, input.actionId || input.query || '');
    }

    if (input.operation === 'action.apply') {
      const approvalCheck = await this.checkApplyPermission(action, input);
      if (approvalCheck) {
        return approvalCheck;
      }
    }

    const result = await action.handler({
      actionId: action.id,
      operation: input.operation,
      args: input.args || this.inferArgsFromQuery(input.query),
      root: this.root,
      actorId: input.actorId || null,
      sourceSurface: input.sourceSurface || 'unknown',
      approvalId: input.approvalId || null,
      trustedOperatorConfirmation: input.trustedOperatorConfirmation === true,
    });

    if (result.receipt || input.operation === 'action.apply') {
      await this.recordReceipt(result.receipt || this.buildReceipt(action, input, result));
    }

    return result;
  }

  public async status(actionId: string, args: Record<string, unknown> = {}): Promise<ZavorthActionResult> {
    return this.run({ operation: 'action.status', actionId, args, sourceSurface: 'runtime' });
  }

  public async preview(actionId: string, args: Record<string, unknown> = {}): Promise<ZavorthActionResult> {
    return this.run({ operation: 'action.preview', actionId, args, sourceSurface: 'runtime' });
  }

  public async apply(actionId: string, args: Record<string, unknown> = {}, options: {
    approvalId?: string | null;
    trustedOperatorConfirmation?: boolean;
    actorId?: string | null;
    sourceSurface?: string | null;
  } = {}): Promise<ZavorthActionResult> {
    return this.run({
      operation: 'action.apply',
      actionId,
      args,
      approvalId: options.approvalId,
      trustedOperatorConfirmation: options.trustedOperatorConfirmation,
      actorId: options.actorId,
      sourceSurface: options.sourceSurface || 'runtime',
    });
  }

  private lookupResult(input: ZavorthActionGatewayInput): ZavorthActionResult {
    const matches = this.lookup({ query: input.query, domain: input.domain, limit: 8 });
    return {
      ok: true,
      actionId: 'action.schema.lookup',
      operation: 'action.schema.lookup',
      status: matches.length > 0 ? 'ok' : 'not_found',
      summary: matches.length > 0
        ? `Found ${matches.length} Zavorth action candidate(s).`
        : 'No Zavorth action matched that request.',
      lines: matches.length > 0
        ? matches.map((match) => `${match.actionId} | ${match.risk} | ${match.title}`)
        : ['No action matched. Ask a short clarification before inventing a command.'],
      data: { matches },
    };
  }

  private async receiptsResult(input: ZavorthActionGatewayInput): Promise<ZavorthActionResult> {
    const all = (await readJsonArray(receiptFile(this.root)))
      .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object' && !Array.isArray(entry)));
    const actionId = normalizeText(input.actionId);
    const receipts = actionId
      ? all.filter((entry) => normalizeText(entry.actionId) === actionId)
      : all;
    return {
      ok: true,
      actionId: 'action.receipts',
      operation: 'action.receipts',
      status: 'ok',
      summary: `${receipts.length} action receipt(s).`,
      lines: receipts.slice(-12).map((entry) => `${entry.id}: ${entry.actionId} ${entry.status}`),
      data: { receipts: receipts.slice(-50).map((entry) => redactSecrets(entry)) },
    };
  }

  private resolveAction(input: ZavorthActionGatewayInput): ZavorthActionDefinition | null {
    const explicit = normalizeText(input.actionId);
    if (explicit) return this.catalog.get(explicit);
    const [first] = this.lookup({ query: input.query, domain: input.domain, limit: 1 });
    return first ? this.catalog.get(first.actionId) : null;
  }

  private notFound(operation: ZavorthActionOperation, ref: unknown): ZavorthActionResult {
    return {
      ok: false,
      actionId: normalizeText(ref, '<unknown>'),
      operation,
      status: 'not_found',
      summary: 'Zavorth action not found.',
      lines: [
        `Unknown action: ${normalizeText(ref, '<missing>')}`,
        'Use action.schema.lookup first; do not invent commands.',
      ],
    };
  }

  private async checkApplyPermission(
    action: ZavorthActionDefinition,
    input: ZavorthActionGatewayInput,
  ): Promise<ZavorthActionResult | null> {
    if (!action.requiresApproval) {
      return null;
    }
    if (input.trustedOperatorConfirmation === true) {
      return null;
    }
    const approvalId = normalizeText(input.approvalId);
    if (approvalId) {
      if (this.isApprovedPlanIdForAction(approvalId, action)) {
        return null;
      }
      const blocked = this.invalidApproval(action, input, approvalId);
      await this.recordReceipt(this.buildReceipt(action, input, blocked));
      return blocked;
    }

    const plan = this.mutationPlane?.createPlan({
      domain: action.mutationDomain === 'selfmod' || action.mutationDomain === 'sandbox' || action.mutationDomain === 'capability'
        ? action.mutationDomain
        : 'capability',
      actionId: action.id,
      title: action.title,
      summary: `Action Harness requires approval before applying ${action.id}.`,
      requestedBy: input.actorId || 'operator',
      sourceSurface: input.sourceSurface || 'action-harness',
      riskLevel: action.mutationRisk || 'medium',
      approvalRequired: true,
      approvalReason: 'Zavorth Action Harness blocked apply until explicit approval or trusted operator confirmation.',
      validationPlan: ['Review action preview and target values before approval.'],
      rollbackPlan: ['Re-apply previous configuration value from receipt if needed.'],
      payload: {
        actionId: action.id,
        args: redactSecrets(input.args || this.inferArgsFromQuery(input.query)),
      },
    }) || null;

    const receipt = this.buildReceipt(action, input, {
      status: 'approval_required',
      summary: `Approval required for ${action.id}.`,
      data: {
        requestedArgs: redactSecrets(input.args || this.inferArgsFromQuery(input.query)),
        ...(plan ? { mutationPlanId: plan.id } : {}),
      },
    });
    receipt.status = 'approval_required';
    await this.recordReceipt(receipt);

    return {
      ok: false,
      actionId: action.id,
      operation: 'action.apply',
      status: 'approval_required',
      summary: `Approval required for ${action.id}.`,
      lines: [
        `Approval required: ${action.title}`,
        plan ? `Mutation plan: ${plan.id}` : 'Mutation plan service unavailable.',
        'Use an approval id or trusted operator command to apply.',
      ],
      data: {
        requiresApproval: true,
        ...(plan ? { mutationPlanId: plan.id, mutationPlanStatus: plan.status } : {}),
      },
      receipt,
    };
  }

  private isApprovedPlanIdForAction(approvalId: string, action: ZavorthActionDefinition): boolean {
    const plan = this.mutationPlane?.readPlan?.(approvalId) || null;
    return Boolean(
      plan
      && plan.actionId === action.id
      && (plan.status === 'approved' || plan.approval.status === 'approved'),
    );
  }

  private invalidApproval(
    action: ZavorthActionDefinition,
    input: ZavorthActionGatewayInput,
    approvalId: string,
  ): ZavorthActionResult {
    return {
      ok: false,
      actionId: action.id,
      operation: 'action.apply',
      status: 'blocked',
      summary: `Approval id is not valid for ${action.id}.`,
      lines: [
        `Invalid approval id: ${approvalId}`,
        `Action ${action.id} still requires an approved mutation plan or trusted operator confirmation.`,
      ],
      data: {
        approvalId,
        actionId: action.id,
        sourceSurface: input.sourceSurface || null,
      },
    };
  }

  private inferArgsFromQuery(query: unknown): Record<string, unknown> {
    const text = normalizeText(query);
    const normalized = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (/\b(governed|governado|estrito|strict|enterprise|corporativo)\b/u.test(normalized)) {
      return { mode: 'governed', query: text };
    }
    if (/\b(casual|rapido|pessoal|personal|domestico)\b/u.test(normalized)) {
      return { mode: 'casual', query: text };
    }
    return text ? { query: text } : {};
  }

  private buildReceipt(
    action: ZavorthActionDefinition,
    input: ZavorthActionGatewayInput,
    result: Pick<ZavorthActionResult, 'status' | 'summary' | 'data'>,
  ): ZavorthActionReceipt {
    const now = this.now();
    return {
      id: idWithTime('action-receipt', now),
      actionId: action.id,
      operation: input.operation,
      status: result.status === 'applied'
        ? 'applied'
        : result.status === 'approval_required'
          ? 'approval_required'
          : result.status === 'blocked'
            ? 'blocked'
            : 'previewed',
      createdAt: now.toISOString(),
      sourceSurface: input.sourceSurface || null,
      actorId: input.actorId || null,
      summary: result.summary,
      data: redactSecrets(result.data || {}) as Record<string, unknown>,
    };
  }

  private async recordReceipt(receipt: ZavorthActionReceipt): Promise<void> {
    await appendJsonArray(receiptFile(this.root), redactSecrets(receipt));
  }
}
