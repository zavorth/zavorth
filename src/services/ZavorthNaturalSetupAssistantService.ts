import type { CapabilityHubItem, CapabilityHubItemKind } from '../contracts/CapabilityHubContract.js';
import {
  NATURAL_SETUP_ASSISTANT_CONTRACT_VERSION,
  type NaturalSetupAssistantInput,
  type NaturalSetupAssistantSnapshot,
  type NaturalSetupConversation,
  type NaturalSetupDetectedIntent,
  type NaturalSetupIntentAction,
  type NaturalSetupReadiness,
  type NaturalSetupReadinessCheck,
  type NaturalSetupSecretInput,
  type NaturalSetupSecretPlan,
} from '../contracts/NaturalSetupAssistantContract.js';
import {
  ZavorthCapabilityHubApiService,
  type CapabilityHubApiInspectResult,
  type CapabilityHubApiListInput,
} from './ZavorthCapabilityHubApiService.js';
import { ZavorthGovernanceRecipeApiService } from './ZavorthGovernanceRecipeApiService.js';
import { tService } from '../i18n/services.js';

import type { GovernanceRecipeExecutionReceipt, GovernanceRecipePlan } from '../contracts/GovernanceRecipeContract.js';

import type { GovernanceRecipePlanInput } from './ZavorthGovernanceRecipeService.js';
import type { ZavorthCapabilityHubRuntime } from './ZavorthCapabilityHubService.js';

type CapabilityHubApiLike = {
  list(input?: CapabilityHubApiListInput): CapabilityHubItem[];
  inspect(id: string): CapabilityHubApiInspectResult;
};

type GovernanceRecipeApiLike = {
  plan(input?: GovernanceRecipePlanInput): GovernanceRecipePlan | null;
  dryRun(input?: GovernanceRecipePlanInput): GovernanceRecipeExecutionReceipt | null;
};

export type ZavorthNaturalSetupAssistantRuntime = ZavorthCapabilityHubRuntime & {
  capabilityHubApiService?: CapabilityHubApiLike;
  governanceRecipeApiService?: GovernanceRecipeApiLike;
};

/** Secret redaction only — never free-text feature activation. */
const SECRET_PATTERNS: RegExp[] = [
  /\b(?:xox[baprs]-[A-Za-z0-9-]{8})\b/g,
  /\b(?:sk-[A-Za-z0-9_-]{12})\b/g,
  /\b(?:gh[pousr]_[A-Za-z0-9_]{12})\b/g,
  /\b(?:AIza[0-9A-Za-z_-]{12})\b/g,
  /\b(?:[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{16})\b/g,
  /\b(?:token|api[_ -]?key|secret|senha|password|chave)\s*[:=]\s*([^\s,;]+)/gi,
];

const STRUCTURED_ACTIONS = new Set<NaturalSetupIntentAction>([
  'connect',
  'configure',
  'validate',
  'inspect',
  'unknown',
]);

export class ZavorthNaturalSetupAssistantService {
  private readonly now: () => Date;
  private readonly capabilityHub: CapabilityHubApiLike;
  private readonly governanceRecipes: GovernanceRecipeApiLike;

  constructor(runtime: ZavorthNaturalSetupAssistantRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.capabilityHub = runtime.capabilityHubApiService || new ZavorthCapabilityHubApiService(runtime);
    this.governanceRecipes = runtime.governanceRecipeApiService || new ZavorthGovernanceRecipeApiService(runtime);
  }

  public buildSnapshot(input: NaturalSetupAssistantInput): NaturalSetupAssistantSnapshot {
    const text = String(input.text || '').trim();
    const secretInputs = this.detectSecretInputs(text, input.providedSecrets || {});
    const redactedText = this.redactText(text, secretInputs);
    // Free text never keyword-selects action/kind — only structured fields do.
    const detectedIntent = this.detectIntent(input);
    const selectedCapability = this.resolveCapability(input);
    const planInput = selectedCapability
      ? {
          targetItemId: selectedCapability.id,
          search: selectedCapability.label,
          dryRun: true,
          approvalId: input.approvalId || null,
        }
      : {};
    const governancePlan = selectedCapability ? this.governanceRecipes.plan(planInput) : null;
    const dryRunReceipt = selectedCapability ? this.governanceRecipes.dryRun(planInput) : null;
    const secretPlan = this.buildSecretPlan(selectedCapability, secretInputs, input.persistSecrets === true);
    const readiness = this.buildReadiness(selectedCapability, governancePlan, secretPlan);
    const conversation = this.buildConversation(
      selectedCapability,
      detectedIntent,
      governancePlan,
      secretPlan,
      readiness,
    );

    return {
      contractVersion: NATURAL_SETUP_ASSISTANT_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      request: {
        inputText: redactedText,
        redactedText,
        actorLabel: input.actorLabel || null,
      },
      detectedIntent,
      selectedCapability,
      governancePlan,
      dryRunReceipt,
      secretPlan,
      readiness,
      conversation,
      safety: {
        previewOnly: true,
        liveActivation: false,
        secretsSerialized: false,
        approvalRequired: Boolean(governancePlan?.permissions.approvalRequired),
        ownerApprovalRequired: Boolean(governancePlan?.recipe.approval.ownerOnly),
        jargonHidden: true,
      },
    };
  }

  public renderReply(input: NaturalSetupAssistantInput): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [snapshot.conversation.headline, '', snapshot.conversation.explanation];

    if (snapshot.conversation.simpleSteps.length > 0) {
      lines.push('', 'Next steps:');
      for (const step of snapshot.conversation.simpleSteps) {
        lines.push(`- ${step}`);
      }
    }

    if (snapshot.conversation.questions.length > 0) {
      lines.push('', 'I need to confirm:');
      for (const question of snapshot.conversation.questions) {
        lines.push(`- ${question}`);
      }
    }

    lines.push(
      '',
      `Safety: preview=${snapshot.safety.previewOnly}; live activation=${snapshot.safety.liveActivation}; secrets serialized=${snapshot.safety.secretsSerialized}.`,
    );
    return lines.join('\n');
  }

  /**
   * Intent is model/UI-owned. Free-text keywords never set action or kind.
   * Only structured input.action (and optional kind/packId metadata) apply.
   */
  private detectIntent(input: NaturalSetupAssistantInput): NaturalSetupDetectedIntent {
    const structuredAction = this.normalizeStructuredAction(input.action);
    const hasStructuredTarget = Boolean(input.preferredCapabilityId || input.kind || input.packId);

    if (structuredAction && structuredAction !== 'unknown') {
      return {
        action: structuredAction,
        confidence: 0.95,
        targetText: input.preferredCapabilityId || input.packId || null,
        matchedAliases: [structuredAction],
      };
    }

    return {
      action: 'unknown',
      confidence: hasStructuredTarget ? 0.55 : 0.2,
      targetText: input.preferredCapabilityId || input.packId || null,
      matchedAliases: [],
    };
  }

  /**
   * Capability choice is structured only (preferredCapabilityId).
   * Free-text hub search and kind aliases were removed (agent-first).
   */
  private resolveCapability(input: NaturalSetupAssistantInput): CapabilityHubItem | null {
    if (input.preferredCapabilityId) {
      const inspected = this.capabilityHub.inspect(input.preferredCapabilityId);
      if (inspected.item) {
        const kindFilter = this.normalizeStructuredKind(input.kind);
        if (kindFilter && inspected.item.kind !== kindFilter) {
          return null;
        }
        return inspected.item;
      }
    }

    // Structured kind alone never auto-picks the first hub item (ambiguous activation).
    return null;
  }

  private buildSecretPlan(
    selectedCapability: CapabilityHubItem | null,
    detectedSecretInputs: NaturalSetupSecretInput[],
    persistSecrets: boolean,
  ): NaturalSetupSecretPlan {
    const requiredRefs = selectedCapability
      ? selectedCapability.requirements.secretRefs.filter((value, index, all) => value && all.indexOf(value) === index)
      : [];
    const providedRefs = detectedSecretInputs
      .map((entry) => entry.secretRef)
      .filter((value): value is string => Boolean(value));
    const missingRefs = requiredRefs.filter((ref) => !providedRefs.includes(ref));

    return {
      requiredRefs,
      missingRefs,
      providedRefs,
      detectedSecretInputs,
      rawSecretValuesSerialized: false,
      persistenceMode: persistSecrets ? 'explicit-only' : 'disabled',
    };
  }

  private buildReadiness(
    selectedCapability: CapabilityHubItem | null,
    governancePlan: GovernanceRecipePlan | null,
    secretPlan: NaturalSetupSecretPlan,
  ): NaturalSetupReadiness {
    if (!selectedCapability) {
      return {
        status: 'needs_manual_choice',
        checks: [
          {
            id: 'capability',
            status: 'missing',
            summary: tService('setup.cannot_identify_capability'),
          },
        ],
        blockers: [tService('setup.choose_capability')],
        nextSafeAction: tService('setup.describe_want_to_prepare'),
      };
    }

    const checks: NaturalSetupReadinessCheck[] = [
      {
        id: 'capability',
        status: 'passed',
        summary: tService('setup.capability_found', { label: selectedCapability.label }),
      },
      {
        id: 'secrets',
        status: secretPlan.missingRefs.length > 0 ? 'next' : 'passed',
        summary:
          secretPlan.missingRefs.length > 0
            ? tService('setup.missing_secrets', { count: String(secretPlan.missingRefs.length) })
            : tService('setup.no_raw_secrets'),
      },
      {
        id: 'governance',
        status: governancePlan ? 'passed' : 'blocked',
        summary: governancePlan
          ? tService('setup.governance_plan_generated', { recipeId: governancePlan.recipeId })
          : tService('setup.no_governance_recipe'),
      },
      {
        id: 'approval',
        status: governancePlan?.permissions.approvalRequired ? 'next' : 'passed',
        summary: governancePlan?.permissions.approvalRequired
          ? tService('setup.real_activation_needs_approval')
          : tService('setup.readiness_can_continue'),
      },
    ];
    const blockers = checks
      .filter((check) => check.status === 'blocked' || check.status === 'missing')
      .map((check) => check.summary);
    const status =
      blockers.length > 0 ? 'blocked' : secretPlan.missingRefs.length > 0 ? 'needs_secret_input' : 'ready_for_preview';

    return {
      status,
      checks,
      blockers,
      nextSafeAction: this.nextSafeAction(selectedCapability, governancePlan, secretPlan),
    };
  }

  private buildConversation(
    selectedCapability: CapabilityHubItem | null,
    detectedIntent: NaturalSetupDetectedIntent,
    governancePlan: GovernanceRecipePlan | null,
    secretPlan: NaturalSetupSecretPlan,
    readiness: NaturalSetupReadiness,
  ): NaturalSetupConversation {
    if (!selectedCapability) {
      return {
        headline: 'I can help, but I need to know which resource you want to prepare.',
        explanation:
          'I turn normal requests into a safe plan for configuration, validation, and approval. Free text alone does not pick a capability — use a structured capability id, slash, or UI selection.',
        questions: ['Which app, channel, model, tool, or skill do you want to use...'],
        simpleSteps: [
          'Choose the resource (structured id, slash, or UI).',
          'I show what is missing.',
          'Nothing live is activated without approval.',
        ],
      };
    }

    const actionText = this.actionToHumanText(detectedIntent.action);
    const questions = secretPlan.missingRefs.map((ref) => `Provide ${this.humanizeRef(ref)} via a secure input.`);
    if (governancePlan?.permissions.approvalRequired) {
      questions.push('Confirm approval when you want to leave preview for real use.');
    }

    return {
      headline: `I prepared a plan to ${actionText} ${selectedCapability.label}.`,
      explanation: `${selectedCapability.summary} I hid technical details and kept everything in preview with receipts and an approval policy.`,
      questions,
      simpleSteps: [
        `Validate readiness for ${selectedCapability.label}.`,
        secretPlan.missingRefs.length > 0
          ? 'Collect credentials on a secure channel, storing references only.'
          : 'Confirm no secret is pending for the preview.',
        governancePlan ? `Apply the safe recipe "${governancePlan.recipe.label}" in dry-run.`
          : 'Choose a governance recipe before any execution.',
        readiness.nextSafeAction,
      ],
    };
  }

  private nextSafeAction(
    selectedCapability: CapabilityHubItem,
    governancePlan: GovernanceRecipePlan | null,
    secretPlan: NaturalSetupSecretPlan,
  ): string {
    if (secretPlan.missingRefs.length > 0) {
      return `Open secure collection for ${this.humanizeRef(secretPlan.missingRefs[0])}.`;
    }
    if (governancePlan?.permissions.approvalRequired) {
      return 'Show the plan to the owner and request explicit approval before live activation.';
    }
    if (selectedCapability.readiness !== 'ready') {
      return 'Run doctor/readiness check without live activation.';
    }
    return 'Continue in dry-run or request approval for real activation.';
  }

  private detectSecretInputs(
    text: string,
    providedSecrets: Record<string, string | null | undefined>,
  ): NaturalSetupSecretInput[] {
    const detected: NaturalSetupSecretInput[] = [];
    for (const pattern of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      let match = pattern.exec(text);
      while (match) {
        const value = match[1] || match[0];
        detected.push({
          field: this.guessSecretField(value),
          valuePreview: this.previewSecret(value),
          source: 'text',
          secretRef: this.guessSecretField(value),
          acceptedForPersistence: false,
        });
        match = pattern.exec(text);
      }
    }

    for (const [field, value] of Object.entries(providedSecrets)) {
      if (!value) {
        continue;
      }
      detected.push({
        field,
        valuePreview: this.previewSecret(value),
        source: 'providedSecrets',
        secretRef: field,
        acceptedForPersistence: false,
      });
    }
    return this.uniqueSecretInputs(detected);
  }

  private redactText(text: string, secretInputs: NaturalSetupSecretInput[]): string {
    let redacted = text;
    for (const input of secretInputs) {
      const escapedPreview = input.valuePreview.replace(/\*/g, '');
      if (escapedPreview.length < 4) {
        continue;
      }
    }
    for (const pattern of SECRET_PATTERNS) {
      redacted = redacted.replace(pattern, (match, group) => {
        if (typeof group === 'string' && group.length > 0) {
          return match.replace(group, '[SECRET_REDACTED]');
        }
        return '[SECRET_REDACTED]';
      });
    }
    return redacted;
  }

  private guessSecretField(value: string): string {
    if (/^xox/i.test(value)) {
      return 'slack.botToken';
    }
    if (/^gh[pousr]_/i.test(value)) {
      return 'github.token';
    }
    if (/^AIza/.test(value)) {
      return 'gemini.apiKey';
    }
    if (/^sk-/i.test(value)) {
      return 'apiKey';
    }
    return 'secret';
  }

  private previewSecret(value: string): string {
    const cleaned = String(value || '').trim();
    if (cleaned.length <= 8) {
      return `${cleaned.slice(0, 1)}***`;
    }
    return `${cleaned.slice(0, 4)}...${cleaned.slice(-4)}`;
  }

  private uniqueSecretInputs(inputs: NaturalSetupSecretInput[]): NaturalSetupSecretInput[] {
    const seen = new Set<string>();
    return inputs.filter((entry) => {
      const key = `${entry.field}:${entry.valuePreview}:${entry.source}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private actionToHumanText(action: NaturalSetupIntentAction): string {
    if (action === 'connect') {
      return 'connect';
    }
    if (action === 'configure') {
      return 'configure';
    }
    if (action === 'validate') {
      return 'validate';
    }
    if (action === 'inspect') {
      return 'inspect';
    }
    return 'prepare';
  }

  private humanizeRef(ref: string): string {
    return ref
      .replace(/[_-]/g, ' ')
      .replace(/\./g, ' ')
      .replace(/\btoken\b/gi, 'token')
      .replace(/\bapi key\b/gi, 'API key');
  }

  private normalizeStructuredAction(value: unknown): NaturalSetupIntentAction | null {
    const action = String(value || '')
      .trim()
      .toLowerCase() as NaturalSetupIntentAction;
    if (!action || !STRUCTURED_ACTIONS.has(action)) {
      return null;
    }
    return action;
  }

  private normalizeStructuredKind(value: unknown): CapabilityHubItemKind | null {
    const kind = String(value || '')
      .trim()
      .toLowerCase();
    if (!kind) {
      return null;
    }
    const allowed: CapabilityHubItemKind[] = [
      'runtime-capability',
      'channel',
      'provider',
      'mcp',
      'integration',
      'skill',
      'recipe',
    ];
    return (allowed as string[]).includes(kind) ? (kind as CapabilityHubItemKind) : null;
  }
}
