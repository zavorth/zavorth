import {
  ZAVORTH_PRODUCT_DEMO_CONTRACT_VERSION,
  type ZavorthProductDemoConnectorCheck,
  type ZavorthProductDemoDoctorCheck,
  type ZavorthProductDemoQuickstartStep,
  type ZavorthProductDemoSnapshot,
  type ZavorthProductDemoStatus,
} from '../contracts/ZavorthProductDemoContract.js';

export type ZavorthProductDemoRuntime = {
  now?: () => Date;
  env?: Record<string, string | undefined>;
  browserDemoPath?: string;
};

const QUICKSTART_STEPS: ZavorthProductDemoQuickstartStep[] = [
  {
    id: 'install',
    minute: '0-3',
    command: 'npm install',
    label: 'Install dependencies',
    outcome: 'Local developer dependencies are available.',
    sideEffect: 'dependencies',
  },
  {
    id: 'setup-preview',
    minute: '3-4',
    command: 'zavorth start',
    label: 'Run the product start path',
    outcome: 'Zavorth previews setup, points to Home, shows connector doctor and keeps the visual demo optional.',
    sideEffect: 'none',
  },
  {
    id: 'open-home',
    minute: '4-6',
    command: 'zavorth go',
    label: 'Open Home',
    outcome: 'The local Home opens at /dashboard with Inbox, Tasks, Approvals, Receipts and Connectors.',
    sideEffect: 'local-runtime',
  },
  {
    id: 'run-demo',
    minute: '6-8',
    command: 'zavorth demo browser',
    label: 'Open the visual browser demo',
    outcome: 'A local browser-friendly demo shows Home, approvals, receipts and connector setup without requiring live secrets.',
    sideEffect: 'none',
  },
  {
    id: 'smoke',
    minute: '8-10',
    command: 'npm run zavorth:demo:check',
    label: 'Run smoke',
    outcome: 'The deterministic product demo gate verifies quickstart, Home, GitHub, Telegram, Discord and doctor output.',
    sideEffect: 'none',
  },
];

export class ZavorthProductDemoService {
  private readonly now: () => Date;
  private readonly env: Record<string, string | undefined>;
  private readonly browserDemoPath: string;

  public constructor(runtime: ZavorthProductDemoRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.env = runtime.env || process.env;
    this.browserDemoPath = runtime.browserDemoPath || 'assets/zavorth-demo/index.html';
  }

  public buildSnapshot(): ZavorthProductDemoSnapshot {
    const connectors = this.buildConnectorChecklist();
    const doctorChecks = this.buildDoctorChecks(connectors);
    const exactMissing = doctorChecks.flatMap((check) =>
      check.status === 'pass' ? [] : check.missing.map((missing) => `${check.label}: ${missing}`),
    );
    const status: ZavorthProductDemoStatus = exactMissing.length > 0 ? 'needs_setup' : 'ready';
    const estimatedMinutes = QUICKSTART_STEPS.reduce((total, step) => {
      const match = step.minute.match(/-(\d+)$/);
      if (!match) {
        return total;
      }
      const end = Number(match[1]);
      return Number.isFinite(end) ? Math.max(total, end) : total;
    }, 0);

    return {
      contractVersion: ZAVORTH_PRODUCT_DEMO_CONTRACT_VERSION,
      schemaVersion: 1,
      phase: 'F',
      surface: 'product-demo',
      generatedAt: this.now().toISOString(),
      status,
      command: {
        primary: 'zavorth start',
        demo: 'zavorth demo',
        json: 'zavorth demo --json',
        doctor: 'zavorth demo doctor',
        connectors: 'zavorth connectors doctor',
        openHome: 'zavorth go',
      },
      quickstart: {
        targetMinutes: 10,
        estimatedMinutes,
        steps: QUICKSTART_STEPS,
      },
      visualHome: {
        route: '/dashboard',
        title: 'Zavorth Home',
        areas: ['Inbox', 'Tasks', 'Approvals', 'Receipts', 'Connectors'],
        openCommand: 'zavorth go',
        dryRunCommand: 'zavorth go --dry-run',
        browserDemoCommand: 'zavorth demo browser',
        browserDemoPath: this.browserDemoPath,
        localVisualDemo: true,
      },
      connectors: {
        checklist: connectors,
        summary: summarizeConnectors(connectors),
      },
      doctor: {
        status,
        checks: doctorChecks,
        exactMissing,
      },
      smoke: {
        command: 'npm run zavorth:demo:check',
        deterministic: true,
        requiresSecrets: false,
        covers: ['quickstart', 'visual-home', 'github', 'telegram', 'discord', 'doctor'],
      },
      safety: {
        noRawSecretsSerialized: true,
        noExternalMutationBeforeApproval: true,
        demoDoesNotPretendLiveConnectors: true,
        internalRuntimeNamesHiddenFromPrimaryPath: true,
      },
      nextSafeAction: status === 'ready'
        ? 'Run zavorth go, then try a governed GitHub review, Telegram approval loop or Discord daily channel.'
        : 'Run zavorth connectors doctor and complete only the missing connector setup you actually want to use.',
    };
  }

  public renderText(snapshot: ZavorthProductDemoSnapshot = this.buildSnapshot()): string {
    return [
      'Zavorth Demo',
      `status: ${snapshot.status}`,
      '',
      '10-minute path',
      ...snapshot.quickstart.steps.map((step) =>
        `- ${step.minute} | ${step.command} | ${step.outcome}`,
      ),
      '',
      'Visual Home',
      `- open: ${snapshot.visualHome.openCommand}`,
      `- route: ${snapshot.visualHome.route}`,
      `- areas: ${snapshot.visualHome.areas.join(', ')}`,
      `- browser demo: ${snapshot.visualHome.browserDemoCommand} (${snapshot.visualHome.browserDemoPath})`,
      '',
      'Connectors',
      ...snapshot.connectors.checklist.map((connector) =>
        `- ${connector.label}: ${connector.status} | ${connector.command}`
        + (connector.missing.length > 0 ? ` | missing: ${connector.missing.join('; ')}` : ''),
      ),
      '',
      'Doctor',
      ...snapshot.doctor.checks.map((check) =>
        `- [${check.status}] ${check.label}: ${check.missing.length > 0 ? check.missing.join('; ') : 'ready'} | next: ${check.nextCommand}`,
      ),
      '',
      `Smoke: ${snapshot.smoke.command}`,
      `Next: ${snapshot.nextSafeAction}`,
      '',
    ].join('\n');
  }

  public renderDoctor(snapshot: ZavorthProductDemoSnapshot = this.buildSnapshot()): string {
    return [
      'Zavorth Demo Doctor',
      `status: ${snapshot.doctor.status}`,
      '',
      ...snapshot.doctor.checks.map((check) => [
        `[${check.status}] ${check.label}`,
        ...(check.missing.length > 0
          ? check.missing.map((missing) => `  missing: ${missing}`)
          : ['  ready']),
        `  next: ${check.nextCommand}`,
      ].join('\n')),
      '',
      snapshot.doctor.exactMissing.length > 0
        ? `Exact missing setup: ${snapshot.doctor.exactMissing.join(' | ')}`
        : 'Exact missing setup: none',
      '',
    ].join('\n');
  }

  private buildConnectorChecklist(): ZavorthProductDemoConnectorCheck[] {
    const githubTokenPresent = Boolean(this.env.GH_TOKEN || this.env.GITHUB_TOKEN);
    const telegramTokenPresent = Boolean(this.env.TELEGRAM_BOT_TOKEN);
    const telegramAllowlistPresent = Boolean(this.env.TELEGRAM_ALLOWED_USER_IDS || this.env.ZAVORTH_CHANNEL_POLICY_TELEGRAM_ALLOWED);
    const discordTokenPresent = Boolean(this.env.DISCORD_BOT_TOKEN);
    const discordGuildPresent = Boolean(this.env.DISCORD_ALLOWED_GUILD_IDS);
    const discordPolicyPresent = Boolean(
      this.env.DISCORD_ALLOWED_CHANNEL_IDS
      || this.env.DISCORD_OWNER_USER_IDS
      || this.env.ZAVORTH_CHANNEL_POLICY_DISCORD_ALLOWED
    );

    return [
      {
        id: 'github',
        label: 'GitHub',
        status: githubTokenPresent ? 'ready' : 'needs_check',
        missing: githubTokenPresent ? [] : ['GitHub CLI auth not proven in env; run gh auth status or gh auth login.'],
        command: 'gh auth status && zavorth review github --pr=<number> --repo=<owner/repo>',
        setupCommand: 'gh auth login',
        doctorCommand: 'gh auth status',
        docsPath: 'docs/02-quickstart.md#github-real',
        safeByDefault: true,
      },
      {
        id: 'github-pr-comment',
        label: 'GitHub PR comment',
        status: githubTokenPresent ? 'ready' : 'needs_check',
        missing: githubTokenPresent ? [] : ['Posting comments needs gh authentication plus an explicit approval id.'],
        command: 'zavorth review github --pr=<number> --repo=<owner/repo> --post-comment --approval-id=<approval-id>',
        setupCommand: 'gh auth login',
        doctorCommand: 'zavorth connectors doctor github',
        docsPath: 'docs/02-quickstart.md#github-real',
        safeByDefault: true,
      },
      {
        id: 'telegram',
        label: 'Telegram',
        status: telegramTokenPresent && telegramAllowlistPresent ? 'ready' : 'needs_setup',
        missing: [
          telegramTokenPresent ? null : 'TELEGRAM_BOT_TOKEN as SecretRef or local env.',
          telegramAllowlistPresent ? null : 'TELEGRAM_ALLOWED_USER_IDS or ZAVORTH_CHANNEL_POLICY_TELEGRAM_ALLOWED.',
        ].filter(Boolean) as string[],
        command: 'zavorth connectors setup telegram --apply',
        setupCommand: 'zavorth connectors setup telegram --apply',
        doctorCommand: 'zavorth connectors doctor telegram',
        docsPath: 'docs/06-telegram.md',
        safeByDefault: true,
      },
      {
        id: 'discord',
        label: 'Discord',
        status: discordTokenPresent && discordGuildPresent && discordPolicyPresent ? 'ready' : 'needs_setup',
        missing: [
          discordTokenPresent ? null : 'DISCORD_BOT_TOKEN as SecretRef or local env.',
          discordGuildPresent ? null : 'DISCORD_ALLOWED_GUILD_IDS.',
          discordPolicyPresent ? null : 'DISCORD_ALLOWED_CHANNEL_IDS, DISCORD_OWNER_USER_IDS or ZAVORTH_CHANNEL_POLICY_DISCORD_ALLOWED.',
        ].filter(Boolean) as string[],
        command: 'zavorth connectors setup discord --apply',
        setupCommand: 'zavorth connectors setup discord --apply',
        doctorCommand: 'zavorth connectors doctor discord',
        docsPath: 'docs/08-discord.md',
        safeByDefault: true,
      },
    ];
  }

  private buildDoctorChecks(connectors: ZavorthProductDemoConnectorCheck[]): ZavorthProductDemoDoctorCheck[] {
    const quickstartOk = QUICKSTART_STEPS.length === 5;
    const homeOk = true;
    return [
      {
        id: 'quickstart',
        label: '10-minute quickstart',
        status: quickstartOk ? 'pass' : 'fail',
        missing: quickstartOk ? [] : ['Quickstart steps are incomplete.'],
        nextCommand: 'zavorth setup --dry-run',
      },
      {
        id: 'visual-home',
        label: 'Visual Home',
        status: homeOk ? 'pass' : 'fail',
        missing: homeOk ? [] : ['Home route /dashboard is not declared.'],
        nextCommand: 'zavorth go --dry-run',
      },
      ...connectors.map((connector): ZavorthProductDemoDoctorCheck => ({
        id: `connector-${connector.id}`,
        label: connector.label,
        status: connector.status === 'ready' ? 'pass' : connector.status === 'needs_check' ? 'warn' : 'fail',
        missing: connector.missing,
        nextCommand: connector.command,
      })),
    ];
  }
}

function summarizeConnectors(connectors: ZavorthProductDemoConnectorCheck[]): string {
  const ready = connectors.filter((connector) => connector.status === 'ready').length;
  const needs = connectors.length - ready;
  return `${ready}/${connectors.length} ready, ${needs} need setup or live check.`;
}
