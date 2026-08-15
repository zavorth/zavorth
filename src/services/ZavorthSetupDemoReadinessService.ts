import {
  ZAVORTH_SETUP_DEMO_READINESS_CONTRACT_VERSION,
  type ZavorthSetupDemoFixture,
  type ZavorthSetupDemoReadinessSnapshot,
  type ZavorthSetupDemoSmokeCheck,
  type ZavorthSetupDemoStep,
} from '../contracts/ZavorthSetupDemoReadinessContract.js';

export type ZavorthSetupDemoReadinessRuntime = {
  now?: () => Date;
};

const SETUP_STEPS: ZavorthSetupDemoStep[] = [
  {
    id: 'install-deps',
    label: 'Install local dependencies',
    command: 'npm install',
    estimatedMinutes: 3,
    writesFiles: true,
    requiresNetwork: true,
    outcome: 'node_modules ready for the local runtime and smoke checks.',
  },
  {
    id: 'preview-profile',
    label: 'Preview first-run profile',
    command: 'npm run setup -- --dry-run',
    estimatedMinutes: 1,
    writesFiles: false,
    requiresNetwork: false,
    outcome: 'operator sees the profile, policy and workspace writes before applying anything.',
  },
  {
    id: 'open-home',
    label: 'Open the product home',
    command: 'npm run go -- --dry-run --json',
    estimatedMinutes: 1,
    writesFiles: false,
    requiresNetwork: false,
    outcome: 'zavorth go resolves the safe local home without starting live external actions.',
  },
  {
    id: 'seed-demo',
    label: 'Load the deterministic demo seed',
    command: 'npm run zavorth:setup-demo:json',
    estimatedMinutes: 1,
    writesFiles: false,
    requiresNetwork: false,
    outcome: 'zavorthControl, GitHub review and Telegram assistant fixtures are visible.',
  },
  {
    id: 'run-smoke',
    label: 'Run the end-to-end smoke',
    command: 'npm run zavorth:setup-demo:check',
    estimatedMinutes: 2,
    writesFiles: false,
    requiresNetwork: false,
    outcome: 'Phase A/B/C/D smoke passes without GitHub or Telegram credentials.',
  },
];

const DEMO_FIXTURES: ZavorthSetupDemoFixture[] = [
  {
    id: 'product-home',
    label: 'Zavorth Home',
    entrypoint: '/zavorthControl or zavorth daily',
    seed: 'Inbox, Tasks, Approvals, Receipts and Connectors are the first screen.',
    externalIo: 'none',
    successSignal: 'Home exposes the five simple product areas and hides internal runtime names.',
  },
  {
    id: 'github-governed-review',
    label: 'GitHub Governed Review',
    entrypoint: 'zavorth review github --pr=7 --repo=zavorth/demo --post-comment --approval-id=approval-demo-gh',
    seed: 'gh repo/pr commands are mocked; PR comment is only posted when an approval id is present.',
    externalIo: 'approval-gated',
    successSignal: 'review returns score, findings, receipt and a captured approved PR comment body.',
  },
  {
    id: 'daily-assistant',
    label: 'Telegram Daily Assistant',
    entrypoint: 'telegram: "fix the file and run npm test" then "approve <approvalId>"',
    seed: 'Telegram messages run through ZavorthAgentGateway with the executor blocked until approval.',
    externalIo: 'mocked',
    successSignal: 'task waits for approval, approved resume executes once, and Telegram receives a receipt.',
  },
  {
    id: 'receipts',
    label: 'Receipts and replay',
    entrypoint: 'zavorth replay run <runId> --json',
    seed: 'Every demo action returns receipt metadata with run, approval and replay command.',
    externalIo: 'none',
    successSignal: 'receipts prove no external mutation happened before approval.',
  },
];

const SMOKE_CHECKS: ZavorthSetupDemoSmokeCheck[] = [
  {
    id: 'home-contract',
    label: 'Product home contract',
    covers: ['phase-a', 'phase-d'],
    command: 'npx jest tests/services/ZavorthSetupDemoReadinessService.test.ts --runInBand',
    requiresSecrets: false,
    requiresNetwork: false,
    expectedSignal: 'setup demo snapshot is ready and under the ten minute target.',
  },
  {
    id: 'script-gate',
    label: 'Script and contract gate',
    covers: ['phase-d'],
    command: 'node scripts/zavorth-setup-demo-check.mjs',
    requiresSecrets: false,
    requiresNetwork: false,
    expectedSignal: 'script output, package scripts and focused tests are present.',
  },
];

export class ZavorthSetupDemoReadinessService {
  private readonly now: () => Date;

  public constructor(runtime: ZavorthSetupDemoReadinessRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(): ZavorthSetupDemoReadinessSnapshot {
    const estimatedMinutes = SETUP_STEPS.reduce((total, step) => total + step.estimatedMinutes, 0);
    const blockers = [
      estimatedMinutes > 10 ? 'estimated setup exceeds ten minute target' : null,
      DEMO_FIXTURES.length < 4 ? 'demo seed does not cover all required surfaces' : null,
      SMOKE_CHECKS.some((check) => check.requiresSecrets || check.requiresNetwork) ? 'smoke checks depend on secrets or live network'
        : null,
    ].filter(Boolean);

    return {
      contractVersion: ZAVORTH_SETUP_DEMO_READINESS_CONTRACT_VERSION,
      schemaVersion: 1,
      phase: 'D',
      surface: 'setup-demo-readiness',
      generatedAt: this.now().toISOString(),
      status: blockers.length > 0 ? 'blocked' : 'ready',
      installOnboard: {
        targetMinutes: 10,
        estimatedMinutes,
        promise: 'A new operator can install, preview setup, open Home, load demo seed and run smoke in ten minutes.',
        steps: SETUP_STEPS,
      },
      demoSeed: {
        id: 'phase-d-local-demo-seed',
        description:
          'Offline-safe seed that proves the simple Home, GitHub Governed Review and Telegram Daily Assistant without requiring tokens.',
        fixtures: DEMO_FIXTURES,
      },
      smoke: {
        command: 'npm run zavorth:setup-demo:check',
        checks: SMOKE_CHECKS,
      },
      safety: {
        noRawSecretsSerialized: true,
        noLiveExternalIoInSeed: true,
        approvalsRequiredForWritesAndSends: true,
        receiptsRequiredForDemoActions: true,
        deterministicWithoutGitHubOrTelegramTokens: true,
      },
      invariants: [
        'The Phase D seed is a deterministic product demo, not a hidden live connector.',
        'GitHub comments, live agents, patches, sends and shell execution remain approval-gated.',
        'Smoke tests local external systems so onboarding is reliable without secrets.',
        'Every demo action must expose a user-visible receipt or replay command.',
        'Setup simplicity must not remove any governed runtime capability from prior phases.',
      ],
      nextSafeAction: blockers.length > 0
        ? blockers.join('; ')
        : 'Run npm run zavorth:setup-demo:check, then use npm run setup and npm run go for the real local path.',
    };
  }

  public renderText(snapshot: ZavorthSetupDemoReadinessSnapshot = this.buildSnapshot()): string {
    return [
      '[zavorth-setup-demo-readiness]',
      `status=${snapshot.status}`,
      `target=${snapshot.installOnboard.targetMinutes}min estimated=${snapshot.installOnboard.estimatedMinutes}min`,
      '',
      '[10-minute path]',
      ...snapshot.installOnboard.steps.map((step) =>
        `- ${step.label}: ${step.command} (${step.estimatedMinutes}min) -> ${step.outcome}`,
      ),
      '',
      '[demo seed]',
      ...snapshot.demoSeed.fixtures.map((fixture) =>
        `- ${fixture.label}: ${fixture.entrypoint} | io=${fixture.externalIo} | ${fixture.successSignal}`,
      ),
      '',
      '[smoke]',
      `- ${snapshot.smoke.command}`,
      ...snapshot.smoke.checks.map((check) =>
        `- ${check.label}: ${check.command} | ${check.expectedSignal}`,
      ),
      '',
      `[next] ${snapshot.nextSafeAction}`,
      '',
    ].join('\n');
  }
}
