import {
  GOVERNANCE_RECIPE_CONTRACT_VERSION,
  type GovernanceRecipeBudgetDecision,
  type GovernanceRecipeDefinition,
  type GovernanceRecipeExecutionReceipt,
  type GovernanceRecipePermissionDecision,
  type GovernanceRecipePlan,
  type GovernanceRecipePlanStep,
  type GovernanceRecipeRollbackPlan,
  type GovernanceRecipeSnapshot,
  type GovernanceRecipeStatus,
} from '../contracts/GovernanceRecipeContract.js';
import type {
  CapabilityHubItem,
  CapabilityHubItemKind,
  CapabilityHubRiskLevel,
} from '../contracts/CapabilityHubContract.js';
import {
  ZavorthCapabilityHubApiService,
  type CapabilityHubApiListInput,
} from './ZavorthCapabilityHubApiService.js';

import type { ZavorthCapabilityHubRuntime } from './ZavorthCapabilityHubService.js';

export type GovernanceRecipePlanInput = {
  recipeId?: string | null;
  targetItemId?: string | null;
  search?: string | null;
  dryRun?: boolean;
  approvalId?: string | null;
};

export type ZavorthGovernanceRecipeRuntime = ZavorthCapabilityHubRuntime & {
  now?: () => Date;
  definitions?: GovernanceRecipeDefinition[];
};

const DEFAULT_GOVERNANCE_RECIPES: GovernanceRecipeDefinition[] = [
  {
    id: 'safe-channel-activation',
    label: 'Ativaction segura de canal',
    summary: 'Configura um canal com readiness, allowlist, approval para envio e receipts por mensagem.',
    targetKinds: ['channel', 'integration'],
    tags: ['channel', 'setup', 'approval', 'receipt'],
    defaultScope: {
      filesystem: 'read_only',
      network: 'external_policy',
      secrets: 'required_refs_only',
      tools: 'approved_only',
    },
    defaultBudget: {
      maxUsd: 1,
      maxToolCalls: 8,
      maxRuntimeMinutes: 10,
    },
    approval: {
      requiredBeforeLive: true,
      requiredForWrites: true,
      requiredForExternalNetwork: true,
      ownerOnly: true,
    },
    sandbox: {
      required: false,
      tier: 'local-jail',
    },
    rollback: {
      strategy: 'disable_capability',
      runbook: [
        'Pause the channel runtime adapter.',
        'Revoke or rotate channel secrets if delivery was attempted.',
        'Keep receipts and failed deliveries for audit.',
      ],
    },
    receiptKinds: ['setup-plan', 'readiness-check', 'approval-decision', 'delivery-audit'],
  },
  {
    id: 'governed-skill-run',
    label: 'Execucao governada de skill',
    summary: 'Roda skill ou receita com policy de ferramentas, budget, sandbox e artifact-first receipts.',
    targetKinds: ['skill', 'recipe', 'runtime-capability'],
    tags: ['skill', 'recipe', 'sandbox', 'artifact'],
    defaultScope: {
      filesystem: 'workspace_write',
      network: 'allowlisted',
      secrets: 'required_refs_only',
      tools: 'approved_only',
    },
    defaultBudget: {
      maxUsd: 2,
      maxToolCalls: 12,
      maxRuntimeMinutes: 20,
    },
    approval: {
      requiredBeforeLive: true,
      requiredForWrites: true,
      requiredForExternalNetwork: true,
      ownerOnly: false,
    },
    sandbox: {
      required: true,
      tier: 'container',
    },
    rollback: {
      strategy: 'restore_previous_config',
      runbook: [
        'Record artifact diff before any write.',
        'Restore previous workspace state through the receipt rollback token.',
        'Keep failed execution evidence in the run ledger.',
      ],
    },
    receiptKinds: ['tool-policy', 'artifact-plan', 'execution-receipt', 'rollback-token'],
  },
  {
    id: 'provider-mcp-readiness',
    label: 'Readiness de provider e MCP',
    summary: 'Valida provider, MCP ou runtime externo sem vazar secrets e sem habilitar live por padrao.',
    targetKinds: ['provider', 'mcp', 'integration'],
    tags: ['provider', 'mcp', 'readiness', 'doctor'],
    defaultScope: {
      filesystem: 'read_only',
      network: 'allowlisted',
      secrets: 'required_refs_only',
      tools: 'read_only',
    },
    defaultBudget: {
      maxUsd: 0.5,
      maxToolCalls: 6,
      maxRuntimeMinutes: 5,
    },
    approval: {
      requiredBeforeLive: false,
      requiredForWrites: true,
      requiredForExternalNetwork: false,
      ownerOnly: false,
    },
    sandbox: {
      required: false,
      tier: 'local-jail',
    },
    rollback: {
      strategy: 'manual_runbook',
      runbook: [
        'Disable the provider or MCP manifest entry.',
        'Clear cached health status.',
        'Re-run the doctor before restoring live traffic.',
      ],
    },
    receiptKinds: ['readiness-check', 'doctor-output', 'secret-ref-audit'],
  },
];

export class ZavorthGovernanceRecipeService {
  private readonly now: () => Date;
  private readonly definitions: GovernanceRecipeDefinition[];
  private readonly capabilityHub: ZavorthCapabilityHubApiService;

  constructor(runtime: ZavorthGovernanceRecipeRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.definitions = Array.isArray(runtime.definitions) && runtime.definitions.length > 0
      ? runtime.definitions.slice()
      : DEFAULT_GOVERNANCE_RECIPES.slice();
    this.capabilityHub = new ZavorthCapabilityHubApiService(runtime);
  }

  public listRecipes(): GovernanceRecipeDefinition[] {
    return this.definitions.map((recipe) => this.cloneRecipe(recipe));
  }

  public buildSnapshot(input: GovernanceRecipePlanInput = {}): GovernanceRecipeSnapshot {
    const targets = this.resolveTargets(input);
    const plans = targets
      .map((target) => this.buildPlan({
        ...input,
        targetItemId: target.id,
        recipeId: input.recipeId || this.resolveRecipeForTarget(target)?.id || null,
      }))
      .filter((plan): plan is GovernanceRecipePlan => Boolean(plan));

    return {
      contractVersion: GOVERNANCE_RECIPE_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      summary: {
        recipes: this.definitions.length,
        readyTargets: plans.filter((plan) => plan.status === 'ready').length,
        approvalGatedTargets: plans.filter((plan) => plan.permissions.approvalRequired).length,
        dryRunOnly: true,
      },
      recipes: this.listRecipes(),
      plans,
      narrative: {
        headline: `Governance Recipes cobre ${plans.length} target(s) do Capability Hub.`,
        operatorSummary: `${this.definitions.length} receita(s) canonica(s), ${plans.filter((plan) => plan.permissions.approvalRequired).length} plano(s) com approval e ${plans.filter((plan) => plan.rollback.available).length} rollback(s) definidos.`,
      },
    };
  }

  public buildPlan(input: GovernanceRecipePlanInput = {}): GovernanceRecipePlan | null {
    const target = this.resolveTarget(input.targetItemId || input.search);
    if (!target) {
      return null;
    }
    const recipe = this.resolveRecipe(input.recipeId) || this.resolveRecipeForTarget(target);
    if (!recipe) {
      return null;
    }
    const permissions = this.buildPermissionDecision(recipe, target, input.approvalId || null);
    const budget = this.buildBudgetDecision(recipe, target);
    const rollback = this.buildRollbackPlan(recipe, target);
    const receipts = this.buildReceipts(recipe, target);
    const status = this.resolvePlanStatus(target, permissions);
    const dryRunOnly = input.dryRun !== false || !permissions.liveExecutionAllowed;

    return {
      contractVersion: GOVERNANCE_RECIPE_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      recipeId: recipe.id,
      targetItemId: target.id,
      status,
      dryRunOnly,
      recipe: this.cloneRecipe(recipe),
      target,
      permissions,
      budget,
      sandbox: { ...recipe.sandbox },
      rollback,
      receipts,
      steps: this.buildSteps(target, permissions, budget, rollback, recipe),
      narrative: this.buildPlanNarrative(recipe, target, status, dryRunOnly),
    };
  }

  public executeDryRun(input: GovernanceRecipePlanInput = {}): GovernanceRecipeExecutionReceipt | null {
    const plan = this.buildPlan({ ...input, dryRun: true });
    if (!plan) {
      return null;
    }
    return {
      contractVersion: GOVERNANCE_RECIPE_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      executionId: `govrec-${this.hash(`${plan.recipeId}:${plan.targetItemId}:${plan.generatedAt}`)}`,
      recipeId: plan.recipeId,
      targetItemId: plan.targetItemId,
      status: plan.status === 'blocked'
        ? 'blocked'
        : plan.permissions.approvalRequired && !input.approvalId
          ? 'waiting_approval'
          : 'dry_run_completed',
      dryRun: true,
      approvalId: input.approvalId || null,
      receiptIds: plan.receipts.map((receipt) => receipt.id),
      rollback: plan.rollback,
      summary: plan.status === 'blocked'
        ? 'Recipe blocked by target readiness or policy.'
        : 'Dry-run completed: permissions, budget, sandbox, receipts and rollback are planned.',
    };
  }

  public renderReport(input: GovernanceRecipePlanInput = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      'Zavorth Governance Recipes',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      `Recipes: ${snapshot.summary.recipes} | ready targets: ${snapshot.summary.readyTargets} | approval-gated: ${snapshot.summary.approvalGatedTargets}.`,
      'Execution: dry-run/receipt-first; live activation still requires explicit approval.',
      '',
      'Recipes:',
    ];

    for (const recipe of snapshot.recipes) {
      lines.push(`- ${recipe.id}: ${recipe.label} (${recipe.targetKinds.join(', ')})`);
    }

    if (snapshot.plans.length > 0) {
      lines.push('', 'Plans:');
      for (const plan of snapshot.plans.slice(0, 8)) {
        lines.push(`- ${plan.recipeId} -> ${plan.targetItemId}: ${plan.status}; approval=${plan.permissions.approvalRequired}; rollback=${plan.rollback.strategy}`);
      }
    }

    lines.push('', 'Next: use `npm run governance-recipes -- --plan <capability-id> --json` before any live activation.');
    return lines.join('\n');
  }

  private resolveTargets(input: GovernanceRecipePlanInput): CapabilityHubItem[] {
    if (input.targetItemId || input.search) {
      const target = this.resolveTarget(input.targetItemId || input.search);
      return target ? [target] : [];
    }
    const query: CapabilityHubApiListInput = {
      search: input.search || null,
    };
    return this.capabilityHub.list(query).slice(0, 24);
  }

  private resolveTarget(value: string | null | undefined): CapabilityHubItem | null {
    const normalized = this.normalize(value);
    if (!normalized) {
      return this.capabilityHub.list({}).find((item) => item.kind === 'recipe') || null;
    }
    const inspected = this.capabilityHub.inspect(normalized);
    if (inspected.item) {
      return inspected.item;
    }
    return this.capabilityHub.list({ search: normalized })[0] || null;
  }

  private resolveRecipe(id: string | null | undefined): GovernanceRecipeDefinition | null {
    const normalized = this.normalize(id);
    if (!normalized) {
      return null;
    }
    return this.definitions.find((recipe) => this.normalize(recipe.id) === normalized) || null;
  }

  private resolveRecipeForTarget(target: CapabilityHubItem): GovernanceRecipeDefinition | null {
    return this.definitions.find((recipe) => recipe.targetKinds.includes(target.kind)) || null;
  }

  private buildPermissionDecision(
    recipe: GovernanceRecipeDefinition,
    target: CapabilityHubItem,
    approvalId: string | null,
  ): GovernanceRecipePermissionDecision {
    const targetNeedsApproval = target.governance.requiresApproval
      || target.governance.risk === 'high'
      || target.governance.risk === 'blocked';
    const externalNetwork = target.governance.networkScope === 'external-policy';
    const approvalRequired = recipe.approval.requiredBeforeLive
      || targetNeedsApproval
      || (recipe.approval.requiredForExternalNetwork && externalNetwork)
      || (recipe.approval.requiredForWrites && recipe.defaultScope.filesystem === 'workspace_write');

    return {
      approvalRequired,
      approvalReason: approvalRequired
        ? this.approvalReason(recipe, target, externalNetwork)
        : 'Readiness/doctor flow can run without live approval.',
      allowedToolPolicy: recipe.defaultScope.tools,
      liveExecutionAllowed: !approvalRequired || Boolean(approvalId),
    };
  }

  private approvalReason(
    recipe: GovernanceRecipeDefinition,
    target: CapabilityHubItem,
    externalNetwork: boolean,
  ): string {
    if (target.governance.risk === 'blocked') {
      return 'Target is blocked by policy.';
    }
    if (target.governance.risk === 'high') {
      return 'High-risk target requires explicit owner approval.';
    }
    if (recipe.defaultScope.filesystem === 'workspace_write') {
      return 'Recipe may write workspace artifacts and needs explicit approval.';
    }
    if (externalNetwork) {
      return 'External network/provider/channel use requires approval before live activation.';
    }
    return 'Recipe requires approval before live execution.';
  }

  private buildBudgetDecision(
    recipe: GovernanceRecipeDefinition,
    target: CapabilityHubItem,
  ): GovernanceRecipeBudgetDecision {
    const risk = this.maxRisk(recipe, target);
    return {
      maxUsd: recipe.defaultBudget.maxUsd,
      maxToolCalls: recipe.defaultBudget.maxToolCalls,
      maxRuntimeMinutes: recipe.defaultBudget.maxRuntimeMinutes,
      estimatedRisk: risk,
      withinDefaultBudget: risk !== 'blocked',
    };
  }

  private buildRollbackPlan(
    recipe: GovernanceRecipeDefinition,
    target: CapabilityHubItem,
  ): GovernanceRecipeRollbackPlan {
    return {
      available: recipe.rollback.strategy !== 'none' && target.readiness !== 'blocked',
      strategy: recipe.rollback.strategy,
      runbook: recipe.rollback.runbook.slice(),
      requiresExplicitCommand: true,
    };
  }

  private buildReceipts(recipe: GovernanceRecipeDefinition, target: CapabilityHubItem) {
    return recipe.receiptKinds.map((kind) => ({
      id: `receipt:${recipe.id}:${target.id}:${kind}`,
      kind,
      summary: `${kind} receipt for ${target.label}.`,
      required: true,
    }));
  }

  private buildSteps(
    target: CapabilityHubItem,
    permissions: GovernanceRecipePermissionDecision,
    budget: GovernanceRecipeBudgetDecision,
    rollback: GovernanceRecipeRollbackPlan,
    recipe: GovernanceRecipeDefinition,
  ): GovernanceRecipePlanStep[] {
    const steps: GovernanceRecipePlanStep[] = [
      {
        id: 'readiness',
        label: 'Readiness checks',
        kind: 'readiness',
        status: target.readiness === 'ready' || target.readiness === 'partial' ? 'done' : 'next',
        summary: target.activation.readinessChecks.join(', ') || 'Capability Hub readiness check.',
      },
      {
        id: 'permissions',
        label: 'Permission policy',
        kind: 'permission',
        status: permissions.approvalRequired && !permissions.liveExecutionAllowed ? 'next' : 'done',
        summary: permissions.approvalReason,
      },
      {
        id: 'budget',
        label: 'Budget guard',
        kind: 'budget',
        status: budget.withinDefaultBudget ? 'done' : 'blocked',
        summary: `Max $${budget.maxUsd}, ${budget.maxToolCalls} tool calls, ${budget.maxRuntimeMinutes} minutes.`,
      },
      {
        id: 'sandbox',
        label: 'Sandbox policy',
        kind: 'sandbox',
        status: recipe.sandbox.required ? 'next' : 'done',
        summary: recipe.sandbox.required ? `Requires ${recipe.sandbox.tier}.` : 'No extra sandbox required by this recipe.',
      },
      {
        id: 'receipts',
        label: 'Artifact-first receipts',
        kind: 'receipt',
        status: 'pending',
        summary: `${recipe.receiptKinds.length} receipt kind(s) will be emitted.`,
      },
      {
        id: 'rollback',
        label: 'Rollback runbook',
        kind: 'rollback',
        status: rollback.available ? 'pending' : 'blocked',
        summary: rollback.available ? rollback.strategy : 'No rollback available for this target.',
      },
      {
        id: 'activation',
        label: 'Live activation',
        kind: 'activation',
        status: permissions.liveExecutionAllowed && target.activation.liveAllowed ? 'pending' : 'blocked',
        summary: permissions.liveExecutionAllowed
          ? 'Ready for a later live executor handoff.'
          : 'Waiting for approval before live handoff.',
      },
    ];

    return steps;
  }

  private resolvePlanStatus(
    target: CapabilityHubItem,
    permissions: GovernanceRecipePermissionDecision,
  ): GovernanceRecipeStatus {
    if (target.readiness === 'blocked' || target.governance.risk === 'blocked') {
      return 'blocked';
    }
    if (target.readiness === 'needs_configuration' || target.readiness === 'needs_probe' || target.readiness === 'planned') {
      return 'needs_setup';
    }
    if (permissions.approvalRequired && !permissions.liveExecutionAllowed) {
      return 'approval_required';
    }
    return 'ready';
  }

  private buildPlanNarrative(
    recipe: GovernanceRecipeDefinition,
    target: CapabilityHubItem,
    status: GovernanceRecipeStatus,
    dryRunOnly: boolean,
  ): GovernanceRecipePlan['narrative'] {
    return {
      headline: `${recipe.label} -> ${target.label}`,
      operatorSummary: `Status ${status}; dryRunOnly=${dryRunOnly}; target readiness=${target.readiness}; risk=${target.governance.risk}.`,
      nextAction: dryRunOnly
        ? 'Review the receipt plan and request explicit approval before live activation.'
        : 'Plan can be handed to a live executor with receipts and rollback enabled.',
    };
  }

  private maxRisk(
    recipe: GovernanceRecipeDefinition,
    target: CapabilityHubItem,
  ): CapabilityHubRiskLevel {
    const risks: CapabilityHubRiskLevel[] = [
      target.governance.risk,
      recipe.sandbox.tier === 'microvm' || recipe.sandbox.tier === 'container' ? 'medium' : 'low',
    ];
    const order: CapabilityHubRiskLevel[] = ['unknown', 'low', 'medium', 'high', 'blocked'];
    return risks.sort((left, right) => order.indexOf(right) - order.indexOf(left))[0] || 'unknown';
  }

  private cloneRecipe(recipe: GovernanceRecipeDefinition): GovernanceRecipeDefinition {
    return {
      ...recipe,
      targetKinds: recipe.targetKinds.slice(),
      tags: recipe.tags.slice(),
      defaultScope: { ...recipe.defaultScope },
      defaultBudget: { ...recipe.defaultBudget },
      approval: { ...recipe.approval },
      sandbox: { ...recipe.sandbox },
      rollback: {
        ...recipe.rollback,
        runbook: recipe.rollback.runbook.slice(),
      },
      receiptKinds: recipe.receiptKinds.slice(),
    };
  }

  private normalize(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private hash(value: string): string {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    }
    return Math.abs(hash).toString(36);
  }
}
