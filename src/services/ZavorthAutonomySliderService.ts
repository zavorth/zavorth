import {
  ZAVORTH_AUTONOMY_SLIDER_CONTRACT_VERSION,
  type ZavorthAutonomySliderChangeRisk,
  type ZavorthAutonomySliderContract,
  type ZavorthAutonomySliderLevel,
  type ZavorthAutonomySliderLevelCard,
} from '../contracts/ZavorthAutonomySliderContract.js';
import type { ZavorthExperienceAutonomyLevel } from '../contracts/ZavorthExperienceProfileContract.js';
import {
  ZavorthExperienceProfileService,
  type ZavorthExperienceProfileInput,
} from './ZavorthExperienceProfileService.js';
import {
  ZavorthTrustPanelService,
  type ZavorthTrustPanelInput,
} from './ZavorthTrustPanelService.js';

export type ZavorthAutonomySliderInput = {
  profile?: unknown;
  level?: unknown;
  intent?: unknown;
};

export type ZavorthAutonomySliderRuntime = {
  experienceProfiles?: Pick<ZavorthExperienceProfileService, 'buildContract'>;
  trustPanel?: Pick<ZavorthTrustPanelService, 'buildContract'>;
};

const LEVELS: ZavorthAutonomySliderLevelCard[] = [
  {
    id: 'conservative',
    label: 'Conservative',
    position: 0,
    plainSummary: 'Zavorth mostly reads, explains, drafts and asks before action.',
    canDoAlone: ['Answer questions', 'Read approved context', 'Summarize documents', 'Create safe previews'],
    asksFirst: ['Live provider probes', 'Any file write', 'Any message send', 'Any command execution'],
    alwaysBlocked: ['Raw secret exposure', 'Policy bypass', 'Silent destructive host changes'],
    bestFor: ['New users', 'Sensitive machines', 'Learning the product', 'Family/personal use'],
  },
  {
    id: 'balanced',
    label: 'Balanced',
    position: 1,
    plainSummary: 'Practical daily help with approval for meaningful impact.',
    canDoAlone: ['Readiness checks', 'Draft replies', 'Plan missions', 'Recommend providers and channels'],
    asksFirst: ['Workspace mutations', 'External sends', 'Paid/live provider use', 'Schedules'],
    alwaysBlocked: ['Raw secret logging', 'Untrusted skill execution', 'Approval replay'],
    bestFor: ['Daily personal use', 'Creators', 'Light development', 'Routine automation'],
  },
  {
    id: 'advanced',
    label: 'Advanced',
    position: 2,
    plainSummary: 'More runtime visibility and smoother technical workflows, without hidden sensitive execution.',
    canDoAlone: ['Deeper diagnostics', 'Subagent planning', 'Dry-run command plans', 'Detailed receipts and traces'],
    asksFirst: ['Shell execution', 'Network access', 'Device control', 'Dependency installation'],
    alwaysBlocked: ['Out-of-workspace destructive actions', 'Infinite subagent spawning', 'Secret exfiltration'],
    bestFor: ['Developers', 'Vibe coding', 'Power users', 'Local runtime operators'],
  },
  {
    id: 'business',
    label: 'Business',
    position: 3,
    plainSummary: 'Evidence-first operation with stricter scoped approvals and audit wording.',
    canDoAlone: ['Policy explanation', 'Audit summaries', 'Read-only operational reports', 'Receipt search'],
    asksFirst: ['Anything that changes business data', 'Account actions', 'External communication', 'Recurring automation'],
    alwaysBlocked: ['Unscoped approval', 'Non-audited sensitive action', 'Secret leakage'],
    bestFor: ['Teams', 'Compliance', 'Client work', 'Shared machines'],
  },
];

export class ZavorthAutonomySliderService {
  private readonly experienceProfiles: Pick<ZavorthExperienceProfileService, 'buildContract'>;
  private readonly trustPanel: Pick<ZavorthTrustPanelService, 'buildContract'>;

  constructor(runtime: ZavorthAutonomySliderRuntime = {}) {
    this.experienceProfiles = runtime.experienceProfiles || new ZavorthExperienceProfileService();
    this.trustPanel = runtime.trustPanel || new ZavorthTrustPanelService();
  }

  public buildContract(input: ZavorthAutonomySliderInput = {}): ZavorthAutonomySliderContract {
    const intent = clean(input.intent);
    const profileContract = this.experienceProfiles.buildContract({
      profile: input.profile,
      intent,
    } satisfies ZavorthExperienceProfileInput);
    const currentLevel = normalizeLevel(profileContract.selected.autonomy);
    const requestedLevel = resolveRequestedLevel(input.level, intent) || currentLevel;
    const requestedCard = getLevelCard(requestedLevel);
    const currentCard = getLevelCard(currentLevel);
    const trustPanel = this.trustPanel.buildContract({
      profile: profileContract.selected.profileId,
      query: intent,
    } satisfies ZavorthTrustPanelInput);
    const changeRisk = classifyChange(currentCard.position, requestedCard.position, requestedLevel);

    return {
      contractVersion: ZAVORTH_AUTONOMY_SLIDER_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'autonomy-slider',
      selectedProfile: profileContract.selected.profileId,
      currentLevel,
      requestedLevel,
      changeRisk,
      headline: buildHeadline(currentLevel, requestedLevel, changeRisk),
      slider: {
        min: 'conservative',
        max: 'business',
        selectedPosition: requestedCard.position,
        levels: LEVELS.map((level) => ({ ...level, canDoAlone: [...level.canDoAlone], asksFirst: [...level.asksFirst], alwaysBlocked: [...level.alwaysBlocked], bestFor: [...level.bestFor] })),
      },
      policyPreview: {
        canDoAlone: requestedCard.canDoAlone,
        asksFirst: requestedCard.asksFirst,
        alwaysBlocked: requestedCard.alwaysBlocked,
        approvalStyle: approvalStyle(requestedLevel),
        receiptStyle: receiptStyle(requestedLevel),
      },
      applyPlan: {
        canApplyAutomatically: false,
        requiresUserConfirmation: changeRisk !== 'same',
        requiresPolicyBroker: true,
        storesRawSecrets: false,
        reversible: true,
        commandPreview: `zavorth autonomy --level ${requestedLevel} --profile ${profileContract.selected.profileId}`,
      },
      trustPanel: {
        surface: trustPanel.surface,
        selectedProfile: trustPanel.selectedProfile,
        autonomy: trustPanel.autonomy,
        summary: trustPanel.summary,
        advanced: trustPanel.advanced,
        safety: trustPanel.safety,
      },
      naturalLanguageExamples: [
        'be more careful with this mission',
        'you can be a little more autonomous',
        'switch to business approvals',
        'use advanced mode for this repo',
        'keep everything conservative for now',
      ],
      invariants: [
        'The autonomy slider changes defaults and approval wording; it does not bypass Policy Broker.',
        'More autonomous never means raw secrets, destructive host changes or unscoped external actions are allowed.',
        'A stricter level can be applied as a safe preference, but live runtime changes still produce receipts.',
        'Business mode is not maximum freedom; it is maximum evidence and scoped governance.',
        'This contract is projection-first and safe for Dashboard, CLI, Satellite and channel rendering.',
      ],
    };
  }

  public renderText(contract: ZavorthAutonomySliderContract): string {
    return [
      '[zavorth-autonomy-slider]',
      `${contract.headline} | profile=${contract.selectedProfile}`,
      `current=${contract.currentLevel} requested=${contract.requestedLevel} risk=${contract.changeRisk}`,
      '',
      '[levels]',
      ...contract.slider.levels.map((level) =>
        `${level.position === contract.slider.selectedPosition ? '*' : '-'} ${level.id}: ${level.plainSummary}`,
      ),
      '',
      '[can do alone]',
      ...contract.policyPreview.canDoAlone.map((item) => `- ${item}`),
      '',
      '[asks first]',
      ...contract.policyPreview.asksFirst.map((item) => `- ${item}`),
      '',
      '[always blocked]',
      ...contract.policyPreview.alwaysBlocked.map((item) => `- ${item}`),
      '',
      '[apply plan]',
      `automatic=${contract.applyPlan.canApplyAutomatically} confirmation=${contract.applyPlan.requiresUserConfirmation} policy=${contract.applyPlan.requiresPolicyBroker}`,
      `preview: ${contract.applyPlan.commandPreview}`,
      '',
    ].join('\n');
  }
}

function normalizeLevel(value: ZavorthExperienceAutonomyLevel): ZavorthAutonomySliderLevel {
  if (value === 'conservative' || value === 'balanced' || value === 'advanced' || value === 'business') {
    return value;
  }
  return 'balanced';
}

function resolveRequestedLevel(value: unknown, intent: string | null): ZavorthAutonomySliderLevel | null {
  const explicit = parseLevel(value);
  if (explicit) {
    return explicit;
  }
  const text = normalize(`${intent || ''} ${value || ''}`);
  if (!text) {
    return null;
  }
  if (/business|company|enterprise|audit|compliance|governed/.test(text)) {
    return 'business';
  }
  if (/advanced|power|technical|developer|repo|coding|more autonomous|less friction/.test(text)) {
    return 'advanced';
  }
  if (/careful|safe|conservative|ask before|strict|read only|read-only/.test(text)) {
    return 'conservative';
  }
  if (/balanced|normal|daily|practical|default/.test(text)) {
    return 'balanced';
  }
  return null;
}

function parseLevel(value: unknown): ZavorthAutonomySliderLevel | null {
  const text = normalize(value);
  if (!text) {
    return null;
  }
  if (text === 'conservative' || text === 'safe' || text === 'strict') {
    return 'conservative';
  }
  if (text === 'balanced' || text === 'normal' || text === 'default') {
    return 'balanced';
  }
  if (text === 'advanced' || text === 'power' || text === 'technical') {
    return 'advanced';
  }
  if (text === 'business' || text === 'governed' || text === 'enterprise') {
    return 'business';
  }
  return null;
}

function getLevelCard(level: ZavorthAutonomySliderLevel): ZavorthAutonomySliderLevelCard {
  return LEVELS.find((card) => card.id === level) || LEVELS[1];
}

function classifyChange(
  currentPosition: ZavorthAutonomySliderLevelCard['position'],
  requestedPosition: ZavorthAutonomySliderLevelCard['position'],
  requestedLevel: ZavorthAutonomySliderLevel,
): ZavorthAutonomySliderChangeRisk {
  if (requestedLevel === 'business') {
    return currentPosition === requestedPosition ? 'same' : 'governed_business';
  }
  if (currentPosition === requestedPosition) {
    return 'same';
  }
  return requestedPosition < currentPosition ? 'stricter' : 'more_autonomous';
}

function buildHeadline(
  currentLevel: ZavorthAutonomySliderLevel,
  requestedLevel: ZavorthAutonomySliderLevel,
  changeRisk: ZavorthAutonomySliderChangeRisk,
): string {
  if (changeRisk === 'same') {
    return `Autonomy stays ${requestedLevel}.`;
  }
  if (changeRisk === 'stricter') {
    return `Autonomy would become stricter: ${currentLevel} -> ${requestedLevel}.`;
  }
  if (changeRisk === 'governed_business') {
    return `Autonomy would switch to business governance: ${currentLevel} -> ${requestedLevel}.`;
  }
  return `Autonomy would become more capable: ${currentLevel} -> ${requestedLevel}, with Policy Broker still in charge.`;
}

function approvalStyle(level: ZavorthAutonomySliderLevel): string {
  if (level === 'business') {
    return 'Precise approval cards with actor, action, arguments, TTL, policy rule, rollback and receipt id.';
  }
  if (level === 'advanced') {
    return 'Technical approval cards with diff, command preview, sandbox state and affected resources.';
  }
  if (level === 'conservative') {
    return 'Short approvals for almost every external or mutating action.';
  }
  return 'Simple approvals for meaningful impact: edit, send, shell, live network, schedule or device control.';
}

function receiptStyle(level: ZavorthAutonomySliderLevel): string {
  if (level === 'business') {
    return 'Audit-first receipts with policy evidence, user decision, denial reason and exportable summary.';
  }
  if (level === 'advanced') {
    return 'Detailed receipts with tools, budgets, sandbox, subagents, artifacts and rollback notes.';
  }
  if (level === 'conservative') {
    return 'Plain receipts focused on what was checked and what was not changed.';
  }
  return 'Human-readable receipts summarizing what happened, what was blocked and what can be undone.';
}

function normalize(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function clean(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text ? text : null;
}
