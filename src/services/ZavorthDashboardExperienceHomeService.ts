import {
  ZAVORTH_DASHBOARD_EXPERIENCE_HOME_CONTRACT_VERSION,
  type ZavorthDashboardExperienceHomeArea,
  type ZavorthDashboardExperienceHomeFirstStep,
  type ZavorthDashboardExperienceHomeMission,
  type ZavorthDashboardExperienceHomeQuestion,
  type ZavorthDashboardExperienceHomeSnapshot,
} from '../contracts/ZavorthDashboardExperienceHomeContract.js';

export type ZavorthDashboardExperienceHomeRuntime = {
  now?: () => Date;
};

const HOME_AREAS: ZavorthDashboardExperienceHomeArea[] = [
  {
    id: 'inbox',
    label: 'Inbox',
    summary: 'New requests, channel messages and things waiting for your attention.',
    href: '/dashboard',
    icon: 'inbox',
    statusLabel: 'Start here',
    primaryAction: 'Ask or resume',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    summary: 'Active work, guided missions and safe next steps in one place.',
    href: '/dashboard/cli-tools',
    icon: 'checklist',
    statusLabel: 'Preview first',
    primaryAction: 'Pick a mission',
  },
  {
    id: 'approvals',
    label: 'Approvals',
    summary: 'Scoped yes/no decisions before sensitive sends, writes or commands.',
    href: '/dashboard/logs',
    icon: 'rule',
    statusLabel: 'Gated',
    primaryAction: 'Review decisions',
  },
  {
    id: 'receipts',
    label: 'Receipts',
    summary: 'Plain proof of what Zavorth did, blocked or left waiting.',
    href: '/dashboard/logs',
    icon: 'receipt_long',
    statusLabel: 'Evidence',
    primaryAction: 'Read proof',
  },
  {
    id: 'connectors',
    label: 'Connectors',
    summary: 'Providers, GitHub, Telegram and other channels without raw secret exposure.',
    href: '/dashboard/providers',
    icon: 'hub',
    statusLabel: 'Setup',
    primaryAction: 'Connect safely',
  },
];

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

const GETTING_STARTED: ZavorthDashboardExperienceHomeFirstStep[] = [
  {
    id: 'setup',
    label: 'Preview setup',
    summary: 'See profile, workspace and safety defaults before anything is written.',
    command: 'zavorth setup --dry-run',
    href: '/dashboard/onboarding',
    optional: false,
  },
  {
    id: 'go',
    label: 'Open Home',
    summary: 'Return to this Inbox, Tasks, Approvals, Receipts and Connectors home.',
    command: 'zavorth go',
    href: '/dashboard',
    optional: false,
  },
  {
    id: 'demo',
    label: 'Try the demo',
    summary: 'Optional guided demo and local browser visual for first-time operators.',
    command: 'zavorth demo browser',
    href: '/dashboard?demo=guided',
    optional: true,
  },
  {
    id: 'connectors',
    label: 'Connect when ready',
    summary: 'Set up GitHub, Telegram or Discord only when you need live work.',
    command: 'zavorth connectors doctor',
    href: '/dashboard/providers',
    optional: true,
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
      simpleNavigation: {
        headline: 'Inbox, Tasks, Approvals, Receipts and Connectors are the product home.',
        areas: HOME_AREAS,
      },
      gettingStarted: {
        title: 'Primeiros passos',
        summary: 'Setup is the onboarding path, go is daily use, and demo is optional.',
        steps: GETTING_STARTED,
      },
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
        'The home page should feel simple first: Inbox, Tasks, Approvals, Receipts and Connectors before internal runtime names.',
        'Internal names and maintenance surfaces should stay behind advanced details unless the user asks for them.',
      ],
    };
  }

  public renderText(snapshot: ZavorthDashboardExperienceHomeSnapshot): string {
    return [
      '[zavorth-dashboard-experience-home]',
      snapshot.greeting,
      snapshot.promise,
      snapshot.simpleNavigation.headline,
      '',
      '[home]',
      ...snapshot.simpleNavigation.areas.map((area) =>
        `- ${area.label}: ${area.summary} | ${area.statusLabel} | ${area.primaryAction} | ${area.href}`,
      ),
      '',
      '[Primeiros passos]',
      ...snapshot.gettingStarted.steps.map((step) =>
        `- ${step.label}: ${step.command} | ${step.optional ? 'optional' : 'recommended'} | ${step.summary}`,
      ),
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
