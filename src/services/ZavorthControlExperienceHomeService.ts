import {
  ZAVORTH_CONTROL_EXPERIENCE_HOME_CONTRACT_VERSION,
  type ZavorthControlExperienceHomeArea,
  type ZavorthControlExperienceHomeFirstStep,
  type ZavorthControlExperienceHomeMission,
  type ZavorthControlPermissionPanelItem,
  type ZavorthControlExperienceHomeQuestion,
  type ZavorthControlExperienceHomeSnapshot,
} from '../contracts/ZavorthControlExperienceHomeContract.js';

export type ZavorthControlExperienceHomeRuntime = {
  now?: () => Date;
};

const HOME_AREAS: ZavorthControlExperienceHomeArea[] = [
  {
    id: 'inbox',
    label: 'Inbox',
    summary: 'New requests, channel messages and things waiting for your attention.',
    href: '/control',
    icon: 'inbox',
    statusLabel: 'Start here',
    primaryAction: 'Ask or resume',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    summary: 'Active work, guided missions and safe next steps in one place.',
    href: '/zavorthControl/cli-tools',
    icon: 'checklist',
    statusLabel: 'Preview first',
    primaryAction: 'Pick a mission',
  },
  {
    id: 'approvals',
    label: 'Approvals',
    summary: 'Scoped yes/no decisions before sensitive sends, writes or commands.',
    href: '/control/logs',
    icon: 'rule',
    statusLabel: 'Gated',
    primaryAction: 'Review decisions',
  },
  {
    id: 'receipts',
    label: 'Receipts',
    summary: 'Plain proof of what Zavorth did, blocked or left waiting.',
    href: '/control/logs',
    icon: 'receipt_long',
    statusLabel: 'Evidence',
    primaryAction: 'Read proof',
  },
  {
    id: 'connectors',
    label: 'Connectors',
    summary: 'Providers, GitHub, Telegram and other channels without raw secret exposure.',
    href: '/control/providers',
    icon: 'hub',
    statusLabel: 'Setup',
    primaryAction: 'Connect safely',
  },
];

const MISSIONS: ZavorthControlExperienceHomeMission[] = [
  {
    id: 'organize-my-day',
    label: 'Organize my day',
    description: 'Turn scattered tasks into a simple plan and reminders.',
    prompt: 'Help me organize my day safely.',
    href: '/control',
    risk: 'low',
    approvalExpectation: 'Reads context and drafts suggestions before any external action.',
  },
  {
    id: 'review-a-repo',
    label: 'Review a repository',
    description: 'Read project structure, find risks and prepare a safe plan.',
    prompt: 'Review this repository and show me the risks first.',
    href: '/zavorthControl/cli-tools',
    risk: 'medium',
    approvalExpectation: 'Read-only first; patches or commands require approval.',
  },
  {
    id: 'connect-a-channel',
    label: 'Connect a channel',
    description: 'Set up Telegram, email or another surface with guided steps.',
    prompt: 'Help me connect a channel.',
    href: '/control/providers',
    risk: 'medium',
    approvalExpectation: 'Secrets stay as SecretRefs and live sends require policy.',
  },
  {
    id: 'check-readiness',
    label: 'Check what is ready',
    description: 'Ask which providers, channels and approvals need attention.',
    prompt: 'What is ready and what still needs setup?',
    href: '/control/health',
    risk: 'low',
    approvalExpectation: 'Read-only runtime projections; no live probes by default.',
  },
];

const QUESTIONS: ZavorthControlExperienceHomeQuestion[] = [
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

const PERMISSION_PANEL: ZavorthControlPermissionPanelItem[] = [
  {
    id: 'permissions',
    label: 'Permissoes',
    summary: 'Veja o que esta pendente, aprovado, rejeitado ou expirado antes de continuar.',
    icon: 'verified_user',
    href: '/control/logs',
    statusLabel: 'Scoped',
    actionLabel: 'Review',
    risk: 'low',
  },
  {
    id: 'auto-approvals',
    label: 'Auto-aprovacoes',
    summary: 'Permissoes persistentes ficam limitadas por escopo, prazo, risco e recibo.',
    icon: 'rule_settings',
    href: '/control/settings',
    statusLabel: 'Limited',
    actionLabel: 'Manage',
    risk: 'medium',
  },
  {
    id: 'extreme-mode',
    label: 'Modo extremo',
    summary: 'Break-glass exige confirmacao forte; ainda bloqueia catastrofes obvias.',
    icon: 'emergency_home',
    href: '/control/settings',
    statusLabel: 'Guarded',
    actionLabel: 'Inspect',
    risk: 'critical',
  },
  {
    id: 'revoke',
    label: 'Revogar',
    summary: 'Corte rapidamente permissoes persistentes, canais, providers ou sessoes sensiveis.',
    icon: 'lock_reset',
    href: '/control/settings',
    statusLabel: 'Fast off',
    actionLabel: 'Revoke',
    risk: 'medium',
  },
  {
    id: 'receipts',
    label: 'Receipts',
    summary: 'Toda decisao sensivel deve deixar prova legivel do escopo e do motivo.',
    icon: 'receipt_long',
    href: '/control/logs',
    statusLabel: 'Audit',
    actionLabel: 'Open proof',
    risk: 'low',
  },
];

const GETTING_STARTED: ZavorthControlExperienceHomeFirstStep[] = [
  {
    id: 'setup-checklist',
    label: 'Setup checklist',
    summary: 'Connect channels, providers and execution backend with clear proof before live use.',
    command: 'npm run zavorth:zavorthControl-setup-checklist',
    href: '/control/providers?setup=checklist',
    optional: false,
  },
  {
    id: 'setup',
    label: 'Preview setup',
    summary: 'See profile, workspace and safety defaults before anything is written.',
    command: 'zavorth setup --dry-run',
    href: '/control/onboarding',
    optional: false,
  },
  {
    id: 'go',
    label: 'Open Home',
    summary: 'Return to this Inbox, Tasks, Approvals, Receipts and Connectors home.',
    command: 'zavorth go',
    href: '/control',
    optional: false,
  },
  {
    id: 'demo',
    label: 'Try the demo',
    summary: 'Optional guided demo and local browser visual for first-time operators.',
    command: 'zavorth demo browser',
    href: '/control?demo=guided',
    optional: true,
  },
  {
    id: 'connectors',
    label: 'Connect when ready',
    summary: 'Set up GitHub, Telegram or Discord only when you need live work.',
    command: 'zavorth connectors doctor',
    href: '/control/providers',
    optional: true,
  },
];

export class ZavorthControlExperienceHomeService {
  private readonly now: () => Date;

  constructor(runtime: ZavorthControlExperienceHomeRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(): ZavorthControlExperienceHomeSnapshot {
    return {
      contractVersion: ZAVORTH_CONTROL_EXPERIENCE_HOME_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'zavorthControl-experience-home',
      generatedAt: this.now().toISOString(),
      route: '/control',
      greeting: 'Zavorth is ready.',
      promise: 'Ask naturally. Zavorth will show risk, ask when needed and leave receipts behind.',
      simpleNavigation: {
        headline: 'Chat, Overview, Channels, Approvals and Receipts are the product home.',
        areas: HOME_AREAS,
      },
      gettingStarted: {
        title: 'Primeiros passos',
        summary: 'Setup is the onboarding path, go is daily use, and demo is optional.',
        steps: GETTING_STARTED,
      },
      primaryMissions: MISSIONS,
      runtimeQuestions: QUESTIONS,
      permissionPanel: {
        title: 'Permissoes',
        summary: 'Controle approvals, auto-aprovacoes, modo extremo, revogacao e receipts sem transformar o zavorthControl em atalho de execucao.',
        items: PERMISSION_PANEL,
        defaultPosture: 'Projection-only: botoes abrem revisao, configuracao ou recibos; a acao sensivel continua no Trust Plane.',
      },
      quietReadiness: {
        title: 'Quiet readiness',
        bullets: [
          'Start with a mission or ask a runtime question.',
          'Read-only checks stay calm and fast.',
          'Writes, sends and risky actions stay behind scoped approval.',
        ],
        advancedRoute: '/control/health',
      },
      safety: {
        zavorthControlCanExecuteTargetAction: false,
        projectionOnly: true,
        policyBrokerRequiredForActions: true,
        rawSecretsSerialized: false,
      },
      invariants: [
        'ZavorthControl Home is an experience layer over governed runtime contracts, not an execution shortcut.',
        'Mission starters are prompts and routes; sensitive work still becomes preview, approval, execution and receipt.',
        'Runtime questions use read-only projections by default.',
        'The home page should feel simple first: Chat, Overview, Channels, Approvals and Receipts before internal runtime names.',
        'Internal names and maintenance surfaces should stay behind advanced details unless the user asks for them.',
      ],
    };
  }

  public renderText(snapshot: ZavorthControlExperienceHomeSnapshot): string {
    return [
      '[zavorth-control-experience-home]',
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
      '[permissions]',
      snapshot.permissionPanel.summary,
      ...snapshot.permissionPanel.items.map((item) =>
        `- ${item.label}: ${item.statusLabel} | risk=${item.risk} | ${item.actionLabel} | ${item.href}`,
      ),
      '',
    ].join('\n');
  }
}
