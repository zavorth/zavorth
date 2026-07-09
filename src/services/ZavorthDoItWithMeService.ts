import {
  ZAVORTH_DO_IT_WITH_ME_CONTRACT_VERSION,
  type ZavorthDoItWithMeContract,
  type ZavorthDoItWithMeMode,
  type ZavorthDoItWithMeStep,
} from '../contracts/ZavorthDoItWithMeContract.js';
import { ZavorthCapabilityStoreService } from './ZavorthCapabilityStoreService.js';

import { ZavorthGuidedMissionsService } from './ZavorthGuidedMissionsService.js';
import type { ZavorthCapabilityStoreCard } from '../contracts/ZavorthCapabilityStoreContract.js';
import type { ZavorthGuidedMissionCard } from '../contracts/ZavorthGuidedMissionsContract.js';

export type ZavorthDoItWithMeInput = {
  request?: unknown;
  capabilityId?: unknown;
  missionId?: unknown;
  category?: unknown;
  profile?: unknown;
};

export type ZavorthDoItWithMeRuntime = {
  capabilityStore?: ZavorthCapabilityStoreService;
  guidedMissions?: ZavorthGuidedMissionsService;
};

export class ZavorthDoItWithMeService {
  private readonly capabilityStore: ZavorthCapabilityStoreService;
  private readonly guidedMissions: ZavorthGuidedMissionsService;

  constructor(runtime: ZavorthDoItWithMeRuntime = {}) {
    this.capabilityStore = runtime.capabilityStore || new ZavorthCapabilityStoreService();
    this.guidedMissions = runtime.guidedMissions || new ZavorthGuidedMissionsService();
  }

  public buildContract(input: ZavorthDoItWithMeInput = {}): ZavorthDoItWithMeContract {
    const request = clean(input.request) || 'Help me do this safely.';
    const mode = resolveMode(request);
    const capabilityStore = this.capabilityStore.buildContract({
      query: request,
      category: input.category,
      selectedId: input.capabilityId,
    });
    const guidedMissions = this.guidedMissions.buildContract({
      profile: input.profile,
      intent: request,
      missionId: input.missionId,
    });
    const prefersCapability = mode === 'setup_capability' || mode === 'diagnose_readiness' || Boolean(input.capabilityId);
    const fallbackCapabilityStore = prefersCapability && capabilityStore.cards.length === 0 && input.category
      ? this.capabilityStore.buildContract({ category: input.category, selectedId: input.capabilityId })
      : capabilityStore;
    const capability = fallbackCapabilityStore.selected || fallbackCapabilityStore.featured[0] || fallbackCapabilityStore.cards[0] || null;
    const mission = guidedMissions.recommended || null;
    const useCapability = prefersCapability && Boolean(capability);
    const target = useCapability && capability
      ? {
          kind: 'capability' as const,
          id: capability.sourceCapabilityId,
          title: capability.title,
          readiness: capability.friendlyStatus,
          risk: capability.risk,
        }
      : mission
        ? {
            kind: 'mission' as const,
            id: mission.id,
            title: mission.title,
            readiness: 'preview-ready',
            risk: mission.defaultRisk,
          }
        : {
            kind: 'general' as const,
            id: 'general-help',
            title: 'Safe guided help',
            readiness: 'needs_manual_choice',
            risk: 'unknown',
          };
    const steps = useCapability && capability
      ? buildCapabilitySteps(capability, mode)
      : mission
        ? buildMissionSteps(mission)
        : buildGeneralSteps();

    return {
      contractVersion: ZAVORTH_DO_IT_WITH_ME_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'do-it-with-me',
      mode,
      request,
      target,
      headline: buildHeadline(target.title, mode),
      explanation: buildExplanation(target.title, mode),
      steps,
      questions: buildQuestions(capability, mission, mode),
      nextSafeAction: steps.find((step) => step.actor === 'user')?.instruction
        || steps.find((step) => step.canRunAutomatically)?.instruction
        || 'Choose a capability or mission to continue.',
      projections: {
        capability: useCapability ? capability : null,
        mission: useCapability ? null : mission,
        zavorthControlRoute: '/control',
        zavorthControlCanExecute: false,
      },
      safety: {
        projectionOnly: true,
        rawSecretsSerialized: false,
        asksBeforeSensitiveAction: true,
        liveActionRequiresPolicyBroker: true,
        userCanStopAnytime: true,
      },
      invariants: [
        'Do-It-With-Me mode guides the user; it does not bypass Capability Store, Mission contracts or Policy Broker.',
        'Physical steps stay explicit because the user may need to open another app, plug in a device or create a credential.',
        'Zavorth checks readiness when it can, but live network, write, send, tap, install or scheduler activation still requires approval.',
        'Secrets are described as SecretRefs and never requested as raw chat text.',
      ],
    };
  }

  public renderText(contract: ZavorthDoItWithMeContract): string {
    return [
      '[zavorth-do-it-with-me]',
      `mode=${contract.mode} target=${contract.target.kind}:${contract.target.id}`,
      contract.headline,
      contract.explanation,
      '',
      '[steps]',
      ...contract.steps.map((step, index) =>
        `${index + 1}. ${step.actor}/${step.kind}: ${step.title} | ${step.instruction}`,
      ),
      contract.questions.length > 0 ? ['', '[questions]', ...contract.questions.map((question) => `- ${question}`)].join('\n') : '',
      '',
      `next=${contract.nextSafeAction}`,
      '',
    ].filter(Boolean).join('\n');
  }
}

function resolveMode(request: string): ZavorthDoItWithMeMode {
  const text = request.toLowerCase();
  if (/\b(test|check|doctor|verify|ready|readiness|diagnose)\b/.test(text)) {
    return 'diagnose_readiness';
  }
  if (/\b(connect|configure|setup|enable|activate|install|telegram|whatsapp|discord|provider|openai|gemini|ollama)\b/.test(text)) {
    return 'setup_capability';
  }
  if (/\b(safe|security|approval|receipt|risk|policy)\b/.test(text)) {
    return 'explain_safety';
  }
  return 'start_mission';
}

function buildCapabilitySteps(card: ZavorthCapabilityStoreCard, mode: ZavorthDoItWithMeMode): ZavorthDoItWithMeStep[] {
  const steps: ZavorthDoItWithMeStep[] = [
    {
      id: 'explain-capability',
      actor: 'zavorth',
      kind: 'explain',
      title: `Explain ${card.title}`,
      instruction: `${card.title} is currently ${card.friendlyStatus}. I will show what is ready, what is missing and what stays approval-gated.`,
      whyItMatters: 'The user should understand the capability before adding credentials or running live checks.',
      command: `zavorth capability-store --select ${card.sourceCapabilityId}`,
      canRunAutomatically: true,
      requiresApproval: false,
      mutatesState: false,
    },
  ];

  if (card.requirementsSummary.length > 0) {
    steps.push({
      id: 'collect-requirements',
      actor: 'user',
      kind: 'physical_action',
      title: 'Prepare requirements',
      instruction: `Prepare: ${card.requirementsSummary.join('; ')}. Do not paste raw secrets in chat; store them as SecretRefs.`,
      whyItMatters: 'Some setup work is physical or account-based and cannot be safely invented by the agent.',
      command: null,
      canRunAutomatically: false,
      requiresApproval: false,
      mutatesState: false,
    });
  }

  steps.push({
    id: 'secretref-boundary',
    actor: 'zavorth',
    kind: 'secretref',
    title: 'Protect credentials',
    instruction: 'I will refer to credentials as SecretRefs and never echo raw token values.',
    whyItMatters: 'Secrets should not enter prompts, logs, receipts or memory.',
    command: 'zavorth doctor --advanced',
    canRunAutomatically: true,
    requiresApproval: false,
    mutatesState: false,
  });

  steps.push({
    id: 'readiness-check',
    actor: 'zavorth',
    kind: 'safe_check',
    title: 'Check readiness',
    instruction: `Run a read-only readiness check for ${card.title}.`,
    whyItMatters: 'Readiness should be proven before the card claims it is available.',
    command: card.primaryAction.command,
    canRunAutomatically: true,
    requiresApproval: false,
    mutatesState: false,
  });

  if (card.approvalRequired || mode === 'setup_capability') {
    steps.push({
      id: 'approval-boundary',
      actor: 'policy-broker',
      kind: 'approval',
      title: 'Approval boundary',
      instruction: 'Before live use, sending, writing, testing an external endpoint or changing config, I will ask for scoped approval.',
      whyItMatters: 'Setup guidance is safe; live actions are still governed actions.',
      command: null,
      canRunAutomatically: false,
      requiresApproval: true,
      mutatesState: false,
    });
  }

  steps.push({
    id: 'receipt',
    actor: 'zavorth',
    kind: 'receipt',
    title: 'Issue receipt',
    instruction: 'After setup or readiness checks, I will summarize what was checked, what is missing and what remains blocked.',
    whyItMatters: 'The user gets evidence instead of trusting an invisible setup process.',
    command: 'zavorth receipts',
    canRunAutomatically: true,
    requiresApproval: false,
    mutatesState: false,
  });

  return steps;
}

function buildMissionSteps(card: ZavorthGuidedMissionCard): ZavorthDoItWithMeStep[] {
  const steps: ZavorthDoItWithMeStep[] = [
    {
      id: 'explain-mission',
      actor: 'zavorth',
      kind: 'explain',
      title: `Explain ${card.title}`,
      instruction: `${card.summary} Risk starts as ${card.defaultRisk}.`,
      whyItMatters: 'The user should know what will happen before a mission begins.',
      command: `zavorth missions guide --mission ${card.id}`,
      canRunAutomatically: true,
      requiresApproval: false,
      mutatesState: false,
    },
    {
      id: 'safe-first-step',
      actor: 'zavorth',
      kind: 'preview',
      title: 'Start with preview',
      instruction: card.safeFirstStep,
      whyItMatters: 'Preview keeps the mission useful without jumping into mutation.',
      command: `zavorth missions start --template ${card.id} --preview`,
      canRunAutomatically: true,
      requiresApproval: false,
      mutatesState: false,
    },
    {
      id: 'approval-boundary',
      actor: 'policy-broker',
      kind: 'approval',
      title: 'Sensitive boundary',
      instruction: card.approvalSummary,
      whyItMatters: 'The user should know exactly when the agent will pause.',
      command: null,
      canRunAutomatically: false,
      requiresApproval: card.mutatesByDefault || card.defaultRisk !== 'low',
      mutatesState: false,
    },
  ];
  if (/\b(secretrefs?|token|credential|key)\b/i.test(card.approvalSummary)) {
    steps.splice(2, 0, {
      id: 'secretref-boundary',
      actor: 'zavorth',
      kind: 'secretref',
      title: 'Protect credentials',
      instruction: 'Use SecretRefs for tokens and credentials; do not paste raw secret values into chat.',
      whyItMatters: 'Secrets should not enter prompts, logs, receipts or memory.',
      command: 'zavorth doctor --advanced',
      canRunAutomatically: true,
      requiresApproval: false,
      mutatesState: false,
    });
  }
  steps.push({
      id: 'receipt',
      actor: 'zavorth',
      kind: 'receipt',
      title: 'Final receipt',
      instruction: `Produce artifacts: ${card.expectedArtifacts.join(', ')}.`,
      whyItMatters: 'The mission should leave a clear record of what happened.',
      command: 'zavorth receipts',
      canRunAutomatically: true,
      requiresApproval: false,
      mutatesState: false,
    });
  return steps;
}

function buildGeneralSteps(): ZavorthDoItWithMeStep[] {
  return [
    {
      id: 'choose-target',
      actor: 'user',
      kind: 'physical_action',
      title: 'Choose a target',
      instruction: 'Tell me which app, channel, provider, file, mission or device you want help with.',
      whyItMatters: 'A guided flow needs a real target.',
      command: 'zavorth missions guide',
      canRunAutomatically: false,
      requiresApproval: false,
      mutatesState: false,
    },
  ];
}

function buildQuestions(
  capability: ZavorthCapabilityStoreCard | null,
  mission: ZavorthGuidedMissionCard | null,
  mode: ZavorthDoItWithMeMode,
): string[] {
  if (capability && capability.friendlyStatus === 'needs_setup') {
    return [
      `Do you want to set up ${capability.title} now, or only see what is missing?`,
      'Where should approvals appear: zavorthControl, satellite, Telegram or CLI?',
    ];
  }
  if (capability && capability.friendlyStatus === 'needs_test') {
    return [`Should I run only a readiness probe for ${capability.title}, or explain the setup first?`];
  }
  if (mission && mission.defaultRisk !== 'low') {
    return [`Should this mission stay preview-only until you explicitly approve changes?`];
  }
  if (mode === 'explain_safety') {
    return ['Do you want the simple safety explanation or the advanced policy/receipt view?'];
  }
  return [];
}

function buildHeadline(title: string, mode: ZavorthDoItWithMeMode): string {
  if (mode === 'setup_capability') {
    return `I can help you set up ${title} safely.`;
  }
  if (mode === 'diagnose_readiness') {
    return `I can check whether ${title} is ready.`;
  }
  if (mode === 'explain_safety') {
    return `I can walk you through the safety boundary for ${title}.`;
  }
  return `I can guide this mission: ${title}.`;
}

function buildExplanation(title: string, mode: ZavorthDoItWithMeMode): string {
  if (mode === 'setup_capability') {
    return `I will separate what you need to do from what I can check automatically. I will not collect raw secrets, and live actions stay approval-gated.`;
  }
  if (mode === 'diagnose_readiness') {
    return `I will use read-only checks first and explain blockers without changing your machine or accounts.`;
  }
  if (mode === 'explain_safety') {
    return `I will show what is allowed, what needs approval, what is blocked and what receipt will be produced.`;
  }
  return `I will start with a safe preview for ${title}, then pause before any sensitive action.`;
}

function clean(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text ? text : null;
}
