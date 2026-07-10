import fs from 'fs';
import path from 'path';
import { config } from '../../src/config/index.js';

export type OnboardingProfile = 'dev' | 'operator' | 'headless';

export type OnboardingGuide = {
  profile: OnboardingProfile;
  title: string;
  summary: string;
  estimatedMinutes: number;
  nextAction: string;
  steps: string[];
  commands: string[];
  artifacts: string[];
};

type InstallSummarySnapshot = {
  profile?: string;
  workspace?: string;
  baseUrl?: string;
  shellUrl?: string;
  guideFile?: string;
  onboardingCommand?: string;
  onboardingScript?: string;
  openShellScript?: string;
  companionLauncher?: string;
};

function parseArgs(argv: string[]): { profile?: string; baseUrl?: string; json: boolean } {
  const result: { profile?: string; baseUrl?: string; json: boolean } = {
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const current = String(argv[index] || '').trim();
    if (current === '--profile') {
      result.profile = String(argv[index + 1] || '').trim();
      index += 1;
    } else if (current === '--base-url') {
      result.baseUrl = String(argv[index + 1] || '').trim();
      index += 1;
    } else if (current === '--json') {
      result.json = true;
    }
  }
  return result;
}

function readInstallSummary(): InstallSummarySnapshot {
  const summaryPath = path.resolve(process.cwd(), 'data', 'runtime', 'install-last.json');
  try {
    if (!fs.existsSync(summaryPath)) {
      return {};
    }
    return JSON.parse(String(fs.readFileSync(summaryPath, 'utf8') || '{}')) as InstallSummarySnapshot;
  } catch {
    return {};
  }
}

export function normalizeOnboardingProfile(
  value: string | null | undefined,
  fallback: OnboardingProfile = 'dev',
): OnboardingProfile {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'operator' || normalized === 'ops') {
    return 'operator';
  }
  if (normalized === 'headless' || normalized === 'repl' || normalized === 'terminal') {
    return 'headless';
  }
  if (normalized === 'dev' || normalized === 'developer') {
    return 'dev';
  }
  return fallback;
}

export function buildOnboardingGuide(input: {
  profile: OnboardingProfile;
  baseUrl: string;
  installSummary?: InstallSummarySnapshot;
}): OnboardingGuide {
  const baseUrl =
    (String(input.baseUrl || '').trim() || 'http://127.0.0.1:33333').replace('://0.0.0.0:', '://127.0.0.1:');
  const shellUrl = String(input.installSummary?.shellUrl || `${baseUrl.replace(/\/+$/u, '')}/zavorthControl`).trim();
  const onboardingScript = String(input.installSummary?.onboardingScript || '').trim();
  const openShellScript = String(input.installSummary?.openShellScript || '').trim();
  const guideFile = String(input.installSummary?.guideFile || '').trim();
  const companionLauncher = String(input.installSummary?.companionLauncher || '').trim();

  if (input.profile === 'operator') {
    return {
      profile: 'operator',
      title: 'Zavorth Operator Guide',
      summary: 'Short flow for operating the runtime with a web-first path, using Telegram as the first external channel when it makes sense, and keeping companions and other channels truly on demand.',
      estimatedMinutes: 4,
      nextAction: 'npm run ops:ready',
      steps: [
        'Confirm runtime readiness and doctor status.',
        'Check the product mode first; it maps the experience to chat, assistant, builder, or operator.',
        'Keep the official path web-only in /zavorthControl and add Telegram as the first external channel if you want to operate outside the web surface.',
        'Keep core as the host baseline; promote to ops for maintenance and full only when the advanced stack is truly required.',
        'Run the desktop doctor and workspace doctor before blaming Zavorth for high RAM usage.',
        'Generate a desktop pairing draft and start the companion.',
        'Validate the Node Mesh and open the official operator cockpit.',
      ],
      commands: [
        'npm run ops:ready',
        'npm run mode:status',
        'npm run profile:status',
        'npm run ops:doctor:desktop',
        'npm run ops:workspace:doctor',
        'npm run ops:workspace:optimize -- zavorthBridge',
        'npm run channels:install -- --channel telegram --mode native --apply',
        'npm run cli:fast -- doctor --json',
        'npm run cli:fast -- nodepair desktop MyDesktop',
        'npm run companion:start -- --passcode "<nodeId:pairingCode>" --base-url ' + baseUrl,
        'npm run cli:fast -- nodes doctor --json',
        'npm run test:nodes:smoke',
        'start ' + shellUrl,
      ],
      artifacts: [
        guideFile || '.zavorth/onboarding-guide.txt',
        onboardingScript || '.zavorth/run-onboarding.ps1',
        openShellScript || '.zavorth/open-web-shell.ps1',
        companionLauncher || '.zavorth/companion-start.ps1',
      ],
    };
  }

  if (input.profile === 'headless') {
    return {
      profile: 'headless',
      title: 'Zavorth Headless Guide',
      summary: 'Minimal flow for terminal operation without losing the official product path: web-only in /zavorthControl and Telegram as the first external channel when you want to leave the terminal.',
      estimatedMinutes: 3,
      nextAction: 'npm run cli -- status',
      steps: [
        'Confirm status and open the REPL.',
        'Check the current product mode before promoting runtime or technical surfaces.',
        'Even in headless mode, keep /zavorthControl as the primary surface and treat Telegram as the recommended first external channel.',
        'Keep core for daily use and promote to ops/full only when the task truly needs more runtime.',
        'Consult procedural memory before repeating manual work.',
        'Use doctor and regression checks when changing something important.',
      ],
      commands: [
        'npm run cli -- status',
        'npm run mode:status',
        'npm run profile:status',
        'npm run ops:doctor:desktop:json',
        'npm run ops:companions:json',
        'npm run channels:install -- --channel telegram --mode native --apply',
        'npm run cli:repl',
        'npm run cli:fast -- memory procedures',
        'npm run cli:fast -- doctor --json',
        'npm run qa:regression',
      ],
      artifacts: [
        guideFile || '.zavorth/onboarding-guide.txt',
        onboardingScript || '.zavorth/run-onboarding.ps1',
      ],
    };
  }

  return {
    profile: 'dev',
    title: 'Zavorth Developer Guide',
    summary: 'Short flow to install, validate the basic runtime, keep the host in core, and follow the official web-only journey with Telegram as an optional first external channel.',
    estimatedMinutes: 4,
    nextAction: 'npm run cli:fast -- status --json',
    steps: [
      'Install or rehydrate the workspace.',
      'Confirm the product mode first; builder is the natural baseline for the current development flow.',
      'Use the control surface at /zavorthControl as the primary face and connect Telegram only when you want the first external extension of the flow.',
      'Keep core as the recommended profile; ops is for maintenance and full is reserved for deliberate use.',
      'Start the official runtime and validate quick status.',
      'Review the desktop doctor and lightweight workspace preset before opening large IDEs.',
      'Run smoke and short regression checks before a structural pass.',
    ],
    commands: [
      'npm install',
      'npm run setup',
      'npm run mode:status',
      'npm run profile:status',
      'npm run ops:doctor:desktop',
      'npm run ops:workspace:doctor',
      'npm run ops:workspace:optimize -- zavorthBridge',
      'npm run channels:install -- --channel telegram --mode native --apply',
      'npm run ops:go',
      'npm run cli -- status',
      'npm run test:smoke',
      'npm run qa:regression',
      'start ' + shellUrl,
    ],
    artifacts: [
      guideFile || '.zavorth/onboarding-guide.txt',
      onboardingScript || '.zavorth/run-onboarding.ps1',
      openShellScript || '.zavorth/open-web-shell.ps1',
    ],
  };
}

export function renderOnboardingGuide(guide: OnboardingGuide): string {
  const lines = [
    '',
    '==========================================',
    `  ${guide.title}`,
    '==========================================',
    '',
    guide.summary,
    '',
    `Estimated time: ${guide.estimatedMinutes} minuto(s).`,
    `Next command: ${guide.nextAction}`,
    '',
    'First steps:',
    ...guide.steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    'Primary shortcuts:',
    ...guide.commands.map((command) => `- ${command}`),
    '',
    'Local artifacts:',
    ...guide.artifacts.map((artifact) => `- ${artifact}`),
    '',
  ];
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const installSummary = readInstallSummary();
  const profile = normalizeOnboardingProfile(args.profile || installSummary.profile, 'dev');
  const baseUrl = String(
    args.baseUrl || installSummary.baseUrl || `http://${config.zavorthWebHost}:${config.zavorthWebPort}`,
  )
    .trim()
    .replace('://0.0.0.0:', '://127.0.0.1:');
  const guide = buildOnboardingGuide({
    profile,
    baseUrl,
    installSummary,
  });
  if (args.json) {
    process.stdout.write(`${JSON.stringify(guide, null, 2)}\n`);
    return;
  }
  process.stdout.write(renderOnboardingGuide(guide));
}

if (require.main === module) {
  main();
}
