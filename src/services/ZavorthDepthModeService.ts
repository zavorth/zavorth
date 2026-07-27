import {
  ZAVORTH_DEPTH_MODE_VERSION,
  type ZavorthDepthModeBudgets,
  type ZavorthDepthModeId,
  type ZavorthDepthModeInput,
  type ZavorthDepthModeSnapshot,
  type ZavorthMissionEffect,
  type ZavorthMissionPattern,
} from '../contracts/ZavorthDepthModeContract.js';
import { redactSensitiveText } from './ZavorthNativeAutonomyShared.js';

type ZavorthDepthModeDeps = {
  now?: () => Date;
};

type ModeDefinition = {
  label: string;
  patterns: ZavorthMissionPattern[];
  budgets: ZavorthDepthModeBudgets;
  headline: string;
};

const MODE_DEFINITIONS: Record<ZavorthDepthModeId, ModeDefinition> = {
  normal: {
    label: 'Normal',
    patterns: ['classify-and-act'],
    budgets: {
      maxAgents: 2,
      maxDepth: 1,
      maxTokens: 40_000,
      maxCostUsd: 1,
      maxDurationMinutes: 20,
      checkpointEveryMinutes: 10,
      isolatedWorktreeRequired: false,
    },
    headline: 'Short plan with light review.',
  },
  deep: {
    label: 'Deep',
    patterns: ['classify-and-act', 'fanout-and-synthesize', 'generate-and-filter'],
    budgets: {
      maxAgents: 5,
      maxDepth: 2,
      maxTokens: 120_000,
      maxCostUsd: 4,
      maxDurationMinutes: 45,
      checkpointEveryMinutes: 10,
      isolatedWorktreeRequired: false,
    },
    headline: 'Deep investigation with synthesis.',
  },
  mission: {
    label: 'Mission',
    patterns: ['classify-and-act', 'fanout-and-synthesize', 'generate-and-filter', 'loop-until-done'],
    budgets: {
      maxAgents: 10,
      maxDepth: 3,
      maxTokens: 280_000,
      maxCostUsd: 10,
      maxDurationMinutes: 120,
      checkpointEveryMinutes: 12,
      isolatedWorktreeRequired: true,
    },
    headline: 'Missao longa com checkpoints e resumed.',
  },
  adversarial: {
    label: 'Adversarial',
    patterns: ['classify-and-act', 'fanout-and-synthesize', 'adversarial-verification', 'generate-and-filter', 'tournament'],
    budgets: {
      maxAgents: 14,
      maxDepth: 4,
      maxTokens: 420_000,
      maxCostUsd: 18,
      maxDurationMinutes: 180,
      checkpointEveryMinutes: 10,
      isolatedWorktreeRequired: true,
    },
    headline: 'Missao com verificadores independentes e julgamento final.',
  },
};

const MUTATING_EFFECTS = new Set<ZavorthMissionEffect>(['write', 'shell', 'provider-change']);
const EXTERNAL_IO_EFFECTS = new Set<ZavorthMissionEffect>(['shell', 'network', 'external-send']);

export class ZavorthDepthModeService {
  private readonly now: () => Date;

  public constructor(deps: ZavorthDepthModeDeps = {}) {
    this.now = deps.now || (() => new Date());
  }

  public resolve(input: ZavorthDepthModeInput): ZavorthDepthModeSnapshot {
    const mode = this.normalizeMode(input.mode);
    const definition = MODE_DEFINITIONS[mode];
    const effects = new Set(input.requestedEffects || []);
    const mutationApprovalRequired = Array.from(effects).some((effect) => MUTATING_EFFECTS.has(effect));
    const externalIoApprovalRequired = Array.from(effects).some((effect) => EXTERNAL_IO_EFFECTS.has(effect));
    const highCostApprovalRequired = definition.budgets.maxCostUsd > 8 || definition.budgets.maxAgents > 8;
    const userFacingRisk = mutationApprovalRequired || externalIoApprovalRequired || highCostApprovalRequired ? 'approval'
      : mode === 'normal'
        ? 'quiet'
        : 'review';

    return {
      version: ZAVORTH_DEPTH_MODE_VERSION,
      generatedAt: this.now().toISOString(),
      mode,
      label: definition.label,
      objectivePreview: redactSensitiveText(input.objective).slice(0, 240),
      patterns: [...definition.patterns],
      budgets: { ...definition.budgets },
      approvals: {
        previewRequired: true,
        mutationApprovalRequired,
        externalIoApprovalRequired,
        highCostApprovalRequired,
      },
      reviewCopy: {
        headline: definition.headline,
        userFacingRisk,
        nextAction: userFacingRisk === 'approval'
          ? 'Review the mission preview before running workers.'
          : 'Start from the preview and keep receipts on.',
      },
      safety: {
        noDepthModeBypassesPolicy: true,
        budgetsHardCapped: true,
        rawSecretsSerialized: false,
      },
    };
  }

  public getHardCaps(mode: ZavorthDepthModeId): ZavorthDepthModeBudgets {
    return { ...MODE_DEFINITIONS[mode].budgets };
  }

  private normalizeMode(mode: ZavorthDepthModeInput['mode']): ZavorthDepthModeId {
    if (mode && Object.prototype.hasOwnProperty.call(MODE_DEFINITIONS, mode)) {
      return mode;
    }
    return 'normal';
  }
}
