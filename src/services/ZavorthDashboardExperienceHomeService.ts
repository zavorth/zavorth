import {
  ZAVORTH_DASHBOARD_EXPERIENCE_HOME_CONTRACT_VERSION,
  type ZavorthDashboardExperienceHomeMission,
  type ZavorthDashboardExperienceHomeQuestion,
  type ZavorthDashboardExperienceHomeSnapshot,
} from '../contracts/ZavorthDashboardExperienceHomeContract.js';

export type ZavorthDashboardExperienceHomeRuntime = {
  now?: () => Date;
};

const MISSIONS: ZavorthDashboardExperienceHomeMission[] = [
  {
    id: 'organize-my-day',
    label: 'Organize my day',
    description: 'Turn scattered tasks into a simple plan and reminders.',
    prompt: 'Help me organize my day safely.',
    href: '/dashboard',
    risk: 'low',
    approvalExpectation: 'Reads context and drafts suggestions before any external action.',
  },
  {
    id: 'review-a-repo',
    label: 'Review a repository',
    description: 'Read project structure, find risks and prepare a safe plan.',
    prompt: 'Review this repository and show me the risks first.',
    href: '/dashboard/cli-tools',
    risk: 'medium',
    approvalExpectation: 'Read-only first; patches or commands require approval.',
  },
  {
    id: 'connect-a-channel',
    label: 'Connect a channel',
    description: 'Set up Telegram, email or another surface with guided steps.',
    prompt: 'Help me connect a channel.',
    href: '/dashboard/providers',
    risk: 'medium',
    approvalExpectation: 'Secrets stay as SecretRefs and live sends require policy.',
  },
  {
    id: 'check-readiness',
    label: 'Check what is ready',
    description: 'Ask which providers, channels and approvals need attention.',
    prompt: 'What is ready and what still needs setup?',
    href: '/dashboard/health',
    risk: 'low',
    approvalExpectation: 'Read-only runtime projections; no live probes by default.',
  },
];

const QUESTIONS: ZavorthDashboardExperienceHomeQuestion[] = [
  {
    id: 'providers-ready',
    label: 'Providers',
    question: 'Which providers are ready?',
    command: 'zavorth ask-runtime "which providers are ready?"',
  },
  {
    id: 'channels-ready',
    label: 'Channels',
    question: 'Which channels can I use now?',
    command: 'zavorth ask-runtime "which channels can I use now?"',
  },
  {
    id: 'pending-approvals',
    label: 'Approvals',
    question: 'Do I have pending approvals?',
    command: 'zavorth ask-runtime "do I have pending approvals?"',
  },
  {
    id: 'safety-boundary',
    label: 'Safety',
    question: 'What can Zavorth do without asking first?',
    command: 'zavorth ask-runtime "what can Zavorth do without asking first?"',
  },
];

export class ZavorthDashboardExperienceHomeService {
  private readonly now: () => Date;

  constructor(runtime: ZavorthDashboardExperienceHomeRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(): ZavorthDashboardExperienceHomeSnapshot {
    return {
      contractVersion: ZAVORTH_DASHBOARD_EXPERIENCE_HOME_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'dashboard-experience-home',
      generatedAt: this.now().toISOString(),
      route: '/dashboard',
      greeting: 'Hello, Operator.',
      promise: 'Ask naturally. Zavorth will show risk, ask when needed and leave receipts behind.',
      primaryMissions: MISSIONS,
      runtimeQuestions: QUESTIONS,
      quietReadiness: {
        title: 'Quiet readiness',
        bullets: [
          'Start with a mission or ask a runtime question.',
          'Read-only checks stay calm and fast.',
          'Writes, sends and risky actions stay behind scoped approval.',
        ],
        advancedRoute: '/dashboard/health',
      },
      safety: {
        dashboardCanExecuteTargetAction: false,
        projectionOnly: true,
        policyBrokerRequiredForActions: true,
        rawSecretsSerialized: false,
      },
      invariants: [
        'Dashboard Home is an experience layer over governed runtime contracts, not an execution shortcut.',
        'Mission starters are prompts and routes; sensitive work still becomes preview, approval, execution and receipt.',
        'Runtime questions use read-only projections by default.',
        'The home page should feel simple first and expose advanced depth only when the user asks.',
      ],
    };
  }

  public renderText(snapshot: ZavorthDashboardExperienceHomeSnapshot): string {
    return [
      '[zavorth-dashboard-experience-home]',
      snapshot.greeting,
      snapshot.promise,
      '',
      '[missions]',
      ...snapshot.primaryMissions.map((mission) =>
        `- ${mission.label}: ${mission.description} | risk=${mission.risk} | prompt="${mission.prompt}"`,
      ),
      '',
      '[ask runtime]',
      ...snapshot.runtimeQuestions.map((question) =>
        `- ${question.label}: ${question.question} | ${question.command}`,
      ),
      '',
    ].join('\n');
  }
}
