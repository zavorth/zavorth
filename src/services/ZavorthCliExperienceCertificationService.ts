import {
  ZAVORTH_CLI_EXPERIENCE_CONSISTENCY_CONTRACT_VERSION,
  type ZavorthCliExperienceCertificationCommand,
  type ZavorthCliExperienceCertificationSnapshot,
} from '../contracts/ZavorthCliExperienceCertificationContract.js';
import { ZavorthDashboardExperienceHomeService } from './ZavorthDashboardExperienceHomeService.js';

export type ZavorthCliExperienceCertificationRuntime = {
  now?: () => Date;
  dashboardHome?: ZavorthDashboardExperienceHomeService;
};

export class ZavorthCliExperienceCertificationService {
  private readonly now: () => Date;
  private readonly dashboardHome: ZavorthDashboardExperienceHomeService;

  constructor(runtime: ZavorthCliExperienceCertificationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.dashboardHome = runtime.dashboardHome || new ZavorthDashboardExperienceHomeService({ now: this.now });
  }

  public buildSnapshot(): ZavorthCliExperienceCertificationSnapshot {
    const home = this.dashboardHome.buildSnapshot();
    const homeAreaCommands: ZavorthCliExperienceCertificationCommand[] = home.simpleNavigation.areas.map((area) => ({
      id: `home-${area.id}`,
      label: area.label,
      command: commandForHomeArea(area.id),
      description: area.summary,
      kind: 'home_area',
      risk: 'read_only',
      mirrorsDashboardHome: true,
      cliCanExecuteTargetAction: false,
    }));
    const guidedCommands: ZavorthCliExperienceCertificationCommand[] = home.primaryMissions.map((mission) => ({
      id: `mission-${mission.id}`,
      label: mission.label,
      command: `zavorth guided-missions --intent "${mission.prompt}"`,
      description: mission.description,
      kind: 'guided_mission',
      risk: mission.risk === 'low' ? 'read_only' : 'approval_gated',
      mirrorsDashboardHome: true,
      cliCanExecuteTargetAction: false,
    }));
    const questionCommands: ZavorthCliExperienceCertificationCommand[] = home.runtimeQuestions.map((question) => ({
      id: `question-${question.id}`,
      label: question.label,
      command: question.command,
      description: question.question,
      kind: 'runtime_question',
      risk: 'read_only',
      mirrorsDashboardHome: true,
      cliCanExecuteTargetAction: false,
    }));
    const utilityCommands: ZavorthCliExperienceCertificationCommand[] = [
      {
        id: 'trust-panel',
        label: 'Trust panel',
        command: 'zavorth trust-panel',
        description: 'See what Zavorth may do alone, what needs approval and what is blocked.',
        kind: 'trust',
        risk: 'read_only',
        mirrorsDashboardHome: false,
        cliCanExecuteTargetAction: false,
      },
      {
        id: 'visual-receipts',
        label: 'Visual receipts',
        command: 'zavorth visual-receipts',
        description: 'Read a plain-language receipt for recent work and blocked actions.',
        kind: 'receipt',
        risk: 'read_only',
        mirrorsDashboardHome: false,
        cliCanExecuteTargetAction: false,
      },
      {
        id: 'satellite-approvals',
        label: 'Satellite approvals',
        command: 'zavorth satellite-approvals',
        description: 'Preview the mobile approval companion without granting execution authority.',
        kind: 'satellite',
        risk: 'read_only',
        mirrorsDashboardHome: false,
        cliCanExecuteTargetAction: false,
      },
      {
        id: 'dashboard',
        label: 'Open dashboard',
        command: 'zavorth dashboard',
        description: 'Open the main /dashboard gateway for daily use.',
        kind: 'dashboard',
        risk: 'read_only',
        mirrorsDashboardHome: true,
        cliCanExecuteTargetAction: false,
      },
    ];

    return {
      contractVersion: ZAVORTH_CLI_EXPERIENCE_CONSISTENCY_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'cli-experience-consistency',
      generatedAt: this.now().toISOString(),
      entryCommands: ['zavorth daily', 'zavorth cli-home', 'zavorth start-here'],
      headline: 'Start simple. Stay governed.',
      promise: 'The CLI mirrors the Dashboard Home: Inbox, Tasks, Approvals, Receipts, Connectors and safe next steps first.',
      commands: [...homeAreaCommands, ...guidedCommands, ...questionCommands, ...utilityCommands],
      recommendedFlow: [
        'Run zavorth go when you want Home, or zavorth daily when you are not sure where to start.',
        'Choose Inbox, Tasks, Approvals, Receipts or Connectors.',
        'Pick a guided mission or ask a runtime question.',
        'Use trust-panel or visual-receipts when you need confidence before continuing.',
        'Open /dashboard only when a visual flow is more comfortable.',
      ],
      safety: {
        cliCanExecuteTargetAction: false,
        projectionOnly: true,
        policyBrokerRequiredForActions: true,
        rawSecretsSerialized: false,
      },
      invariants: [
        'CLI Experience Consistency is a navigation and projection layer, not a privileged executor.',
        'Commands that imply mutation still become governed missions, previews, approvals and receipts.',
        'The CLI must not expose raw secrets or treat catalog entries as live readiness.',
        'The CLI and Dashboard Home should point to the same daily-use concepts: Inbox, Tasks, Approvals, Receipts and Connectors.',
      ],
    };
  }

  public renderText(snapshot: ZavorthCliExperienceCertificationSnapshot): string {
    const commandLines = snapshot.commands.map((command) =>
      `- ${command.label}: ${command.command} | ${command.risk} | ${command.description}`,
    );
    return [
      '[zavorth-cli-experience]',
      snapshot.headline,
      snapshot.promise,
      '',
      '[entrypoints]',
      ...snapshot.entryCommands.map((command) => `- ${command}`),
      '',
      '[commands]',
      ...commandLines,
      '',
      '[flow]',
      ...snapshot.recommendedFlow.map((step) => `- ${step}`),
      '',
    ].join('\n');
  }
}

function commandForHomeArea(areaId: string): string {
  switch (areaId) {
    case 'tasks':
      return 'zavorth missions';
    case 'approvals':
      return 'zavorth gateway approvals';
    case 'receipts':
      return 'zavorth receipts';
    case 'connectors':
      return 'zavorth providers';
    case 'inbox':
    default:
      return 'zavorth go';
  }
}
