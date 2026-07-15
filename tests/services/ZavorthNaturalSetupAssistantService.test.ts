import type { CapabilityHubItem } from '../../src/contracts/CapabilityHubContract';
import type {
  GovernanceRecipeDefinition,
  GovernanceRecipeExecutionReceipt,
  GovernanceRecipePlan,
} from '../../src/contracts/GovernanceRecipeContract';
import { NATURAL_SETUP_ASSISTANT_CONTRACT_VERSION } from '../../src/contracts/NaturalSetupAssistantContract';

import type { CapabilityHubApiListInput } from '../../src/services/ZavorthCapabilityHubApiService';
import type { GovernanceRecipePlanInput } from '../../src/services/ZavorthGovernanceRecipeService';
import { ZavorthNaturalSetupAssistantApiService } from '../../src/services/ZavorthNaturalSetupAssistantApiService';
import { ZavorthNaturalSetupAssistantService } from '../../src/services/ZavorthNaturalSetupAssistantService';

describe('ZavorthNaturalSetupAssistantService', () => {
  it('keeps free text neutral: no action/kind/capability from keywords, but redacts secrets', () => {
    const service = new ZavorthNaturalSetupAssistantService(buildRuntime());

    const snapshot = service.buildSnapshot({
      text: 'quero conectar slack com token xoxb-redact-fixture',
      actorLabel: 'operator',
    });

    expect(snapshot.contractVersion).toBe(NATURAL_SETUP_ASSISTANT_CONTRACT_VERSION);
    expect(snapshot.detectedIntent.action).toBe('unknown');
    expect(snapshot.detectedIntent.matchedAliases).toEqual([]);
    expect(snapshot.selectedCapability).toBeNull();
    expect(snapshot.governancePlan).toBeNull();
    expect(snapshot.readiness.status).toBe('needs_manual_choice');
    expect(snapshot.request.redactedText).toContain('[SECRET_REDACTED]');
    expect(snapshot.request.redactedText).not.toContain('xoxb-redact-fixture');
    expect(snapshot.secretPlan.rawSecretValuesSerialized).toBe(false);
    expect(snapshot.secretPlan.detectedSecretInputs[0]).toMatchObject({
      field: 'slack.botToken',
      source: 'text',
      acceptedForPersistence: false,
    });
    expect(JSON.stringify(snapshot)).not.toContain('xoxb-redact-fixture');
    expect(snapshot.safety).toMatchObject({
      previewOnly: true,
      liveActivation: false,
      secretsSerialized: false,
    });
  });

  it('uses structured preferredCapabilityId + action for a governed preview without serializing raw secrets', () => {
    const service = new ZavorthNaturalSetupAssistantService(buildRuntime());

    const snapshot = service.buildSnapshot({
      text: 'operator note with token xoxb-redact-fixture',
      actorLabel: 'operator',
      preferredCapabilityId: 'channel:slack',
      action: 'connect',
    });

    expect(snapshot.detectedIntent.action).toBe('connect');
    expect(snapshot.selectedCapability?.id).toBe('channel:slack');
    expect(snapshot.request.redactedText).toContain('[SECRET_REDACTED]');
    expect(snapshot.secretPlan.rawSecretValuesSerialized).toBe(false);
    expect(snapshot.safety).toMatchObject({
      previewOnly: true,
      liveActivation: false,
      secretsSerialized: false,
      approvalRequired: true,
    });
    expect(snapshot.governancePlan?.recipeId).toBe('safe-channel-activation');
    expect(snapshot.dryRunReceipt?.status).toBe('waiting_approval');
  });

  it('plans provider validation when structured fields select the capability', () => {
    const service = new ZavorthNaturalSetupAssistantService(buildRuntime());

    const snapshot = service.buildSnapshot({
      text: 'please check this later',
      preferredCapabilityId: 'provider:gemini',
      action: 'validate',
      kind: 'provider',
    });

    expect(snapshot.detectedIntent.action).toBe('validate');
    expect(snapshot.selectedCapability?.id).toBe('provider:gemini');
    expect(snapshot.governancePlan?.recipeId).toBe('provider-mcp-readiness');
    expect(snapshot.secretPlan.requiredRefs).toEqual([]);
    expect(snapshot.readiness.status).toBe('ready_for_preview');
    expect(snapshot.safety.liveActivation).toBe(false);
  });

  it('rejects preferredCapabilityId when structured kind does not match', () => {
    const service = new ZavorthNaturalSetupAssistantService(buildRuntime());

    const snapshot = service.buildSnapshot({
      text: '',
      preferredCapabilityId: 'channel:slack',
      kind: 'provider',
    });

    expect(snapshot.selectedCapability).toBeNull();
    expect(snapshot.readiness.status).toBe('needs_manual_choice');
  });

  it('renders a simple user-facing reply through the API facade with structured selection', () => {
    const api = new ZavorthNaturalSetupAssistantApiService(buildRuntime());

    const reply = api.renderReply({
      text: 'setup note',
      preferredCapabilityId: 'integration:github',
      action: 'configure',
    });

    expect(reply).toContain('GitHub');
    expect(reply).toContain('Next steps');
    expect(reply).toContain('live activation=false');
    expect(reply).not.toContain('MCP');
  });
});

function buildRuntime() {
  const items = [
    buildItem({
      id: 'channel:slack',
      kind: 'channel',
      label: 'Slack',
      tags: ['slack', 'channel', 'chat'],
      secretRefs: ['slack.botToken'],
      envKeys: ['SLACK_BOT_TOKEN'],
      requiresApproval: true,
      readiness: 'needs_configuration',
    }),
    buildItem({
      id: 'provider:gemini',
      kind: 'provider',
      label: 'Gemini',
      tags: ['gemini', 'provider', 'model'],
      secretRefs: [],
      envKeys: [],
      requiresApproval: false,
      readiness: 'ready',
    }),
    buildItem({
      id: 'integration:github',
      kind: 'integration',
      label: 'GitHub',
      tags: ['github', 'code', 'issues'],
      secretRefs: ['github.token'],
      envKeys: ['GITHUB_TOKEN'],
      requiresApproval: true,
      readiness: 'needs_configuration',
    }),
  ];

  return {
    now: () => new Date('2026-05-07T15:00:00.000Z'),
    capabilityHubApiService: {
      list: (input: CapabilityHubApiListInput = {}) => {
        const search = normalize(input.search || '');
        return items.filter((item) => {
          if (input.kind && item.kind !== input.kind) {
            return false;
          }
          if (!search) {
            return true;
          }
          return normalize(`${item.id} ${item.label} ${item.tags.join(' ')} ${item.searchText}`).includes(search);
        });
      },
      inspect: (id: string) => {
        const item = items.find((candidate) => candidate.id === id || candidate.id.endsWith(`:${id}`)) || null;
        return {
          found: Boolean(item),
          item,
          related: item ? items.filter((candidate) => candidate.id !== item.id) : [],
        };
      },
    },
    governanceRecipeApiService: {
      plan: (input: GovernanceRecipePlanInput = {}) => {
        const target = items.find((item) => item.id === input.targetItemId) || null;
        return target ? buildPlan(target, Boolean(input.approvalId)) : null;
      },
      dryRun: (input: GovernanceRecipePlanInput = {}) => {
        const target = items.find((item) => item.id === input.targetItemId) || null;
        return target ? buildReceipt(target, Boolean(input.approvalId)) : null;
      },
    },
  };
}

function buildItem(input: {
  id: string;
  kind: CapabilityHubItem['kind'];
  label: string;
  tags: string[];
  secretRefs: string[];
  envKeys: string[];
  requiresApproval: boolean;
  readiness: CapabilityHubItem['readiness'];
}): CapabilityHubItem {
  return {
    id: input.id,
    kind: input.kind,
    label: input.label,
    summary: `${input.label} governed capability.`,
    description: `${input.label} setup through the Capability Hub.`,
    tags: input.tags,
    readiness: input.readiness,
    source: 'zavorth-core',
    requirements: {
      secretRefs: input.secretRefs,
      envKeys: input.envKeys,
      accounts: [],
      binaries: [],
      manualSteps: [],
    },
    governance: {
      risk: input.requiresApproval ? 'medium' : 'low',
      requiresApproval: input.requiresApproval,
      budgetRequired: false,
      sandboxRequired: false,
      networkScope: input.kind === 'provider' ? 'external-policy' : 'external-policy',
      receiptRequired: true,
      auditTrailRequired: true,
    },
    activation: {
      defaultEnabled: false,
      liveAllowed: false,
      configured: input.readiness === 'ready',
      installed: true,
      setupGuided: true,
      readinessChecks: ['fixture-readiness'],
      commands: [],
    },
    provenance: {
      owner: 'zavorth-core',
      sourceService: 'test',
      sourceId: input.id,
      externalRuntimeDependency: false,
      canonicalRootOnly: true,
    },
    searchText: `${input.id} ${input.label} ${input.tags.join(' ')}`,
  };
}

function buildPlan(target: CapabilityHubItem, approved: boolean): GovernanceRecipePlan {
  const recipe = buildRecipe(target);
  const approvalRequired = target.governance.requiresApproval || recipe.approval.requiredBeforeLive;
  return {
    contractVersion: 'zavorth-governance-recipes/v1',
    generatedAt: '2026-05-07T15:00:00.000Z',
    recipeId: recipe.id,
    targetItemId: target.id,
    status: approvalRequired && !approved ? 'approval_required' : 'ready',
    dryRunOnly: true,
    recipe,
    target,
    permissions: {
      approvalRequired,
      approvalReason: approvalRequired ? 'Approval required before live activation.' : 'Readiness only.',
      allowedToolPolicy: recipe.defaultScope.tools,
      liveExecutionAllowed: approved || !approvalRequired,
    },
    budget: {
      maxUsd: recipe.defaultBudget.maxUsd,
      maxToolCalls: recipe.defaultBudget.maxToolCalls,
      maxRuntimeMinutes: recipe.defaultBudget.maxRuntimeMinutes,
      estimatedRisk: target.governance.risk,
      withinDefaultBudget: true,
    },
    sandbox: recipe.sandbox,
    rollback: {
      available: true,
      strategy: recipe.rollback.strategy,
      runbook: recipe.rollback.runbook,
      requiresExplicitCommand: true,
    },
    receipts: [
      {
        id: `receipt:${recipe.id}:${target.id}:setup-plan`,
        kind: 'setup-plan',
        summary: 'Setup plan receipt.',
        required: true,
      },
    ],
    steps: [],
    narrative: {
      headline: 'Plan ready.',
      operatorSummary: 'Dry-run only.',
      nextAction: 'Review before live activation.',
    },
  };
}

function buildReceipt(target: CapabilityHubItem, approved: boolean): GovernanceRecipeExecutionReceipt {
  const plan = buildPlan(target, approved);
  return {
    contractVersion: 'zavorth-governance-recipes/v1',
    generatedAt: '2026-05-07T15:00:00.000Z',
    executionId: `dry-run:${target.id}`,
    recipeId: plan.recipeId,
    targetItemId: target.id,
    status: plan.permissions.approvalRequired && !approved ? 'waiting_approval' : 'dry_run_completed',
    dryRun: true,
    approvalId: approved ? 'approval-test' : null,
    receiptIds: plan.receipts.map((receipt) => receipt.id),
    rollback: plan.rollback,
    summary: 'Dry-run completed.',
  };
}

function buildRecipe(target: CapabilityHubItem): GovernanceRecipeDefinition {
  const isProvider = target.kind === 'provider';
  return {
    id: isProvider
      ? 'provider-mcp-readiness'
      : target.kind === 'channel'
        ? 'safe-channel-activation'
        : 'governed-skill-run',
    label: isProvider
      ? 'Provider and MCP readiness'
      : target.kind === 'channel'
        ? 'Safe channel activation'
        : 'Governed execution',
    summary: 'Fixture recipe.',
    targetKinds: [target.kind],
    tags: ['setup'],
    defaultScope: {
      filesystem: 'read_only',
      network: 'allowlisted',
      secrets: 'required_refs_only',
      tools: isProvider ? 'read_only' : 'approved_only',
    },
    defaultBudget: {
      maxUsd: isProvider ? 0.5 : 1,
      maxToolCalls: 6,
      maxRuntimeMinutes: 5,
    },
    approval: {
      requiredBeforeLive: !isProvider,
      requiredForWrites: true,
      requiredForExternalNetwork: !isProvider,
      ownerOnly: !isProvider,
    },
    sandbox: {
      required: false,
      tier: 'local-jail',
    },
    rollback: {
      strategy: 'disable_capability',
      runbook: ['Disable capability.'],
    },
    receiptKinds: ['setup-plan'],
  };
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9:._-]+/g, ' ')
    .trim();
}
