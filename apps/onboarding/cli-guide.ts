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
  const shellUrl = String(input.installSummary?.shellUrl || `${baseUrl.replace(/\/+$/u, '')}/dashboard`).trim();
  const onboardingScript = String(input.installSummary?.onboardingScript || '').trim();
  const openShellScript = String(input.installSummary?.openShellScript || '').trim();
  const guideFile = String(input.installSummary?.guideFile || '').trim();
  const companionLauncher = String(input.installSummary?.companionLauncher || '').trim();

  if (input.profile === 'operator') {
    return {
      profile: 'operator',
      title: 'Zavorth Operator Guide',
      summary: 'Fluxo curto para operar o runtime com web-first, usar Telegram como primeiro canal externo quando fizer sentido e manter companions e outros canais realmente sob demanda.',
      estimatedMinutes: 4,
      nextAction: 'npm run ops:ready',
      steps: [
        'Confirme readiness e doctor do runtime.',
        'Cheque primeiro o modo de produto; ele traduz a experiencia em chat, assistant, builder ou operator.',
        'Mantenha o caminho oficial em web-only no /dashboard e adicione Telegram como primeiro canal externo se quiser operar fora da web.',
        'Mantenha core como base do host; suba ops para manutencao e full apenas quando a stack avancada for realmente necessaria.',
        'Rode o doctor de desktop e o doctor do workspace antes de culpar o Zavorth por RAM alta.',
        'Gere um pairing draft de desktop e suba o companion.',
        'Valide o Node Mesh e abra o cockpit oficial do operador.',
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
        'npm run cli:fast -- nodepair desktop MeuDesktop',
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
      summary: 'Fluxo minimo para operar por terminal sem perder a narrativa oficial do produto: web-only no /dashboard e Telegram como primeiro canal externo quando voce quiser sair do terminal.',
      estimatedMinutes: 3,
      nextAction: 'npm run cli -- status',
      steps: [
        'Confirme status e abra o REPL.',
        'Cheque o modo de produto atual antes de promover runtime ou surfaces tecnicas.',
        'Mesmo em headless, preserve /dashboard como superficie principal e trate Telegram como o primeiro canal externo recomendado.',
        'Mantenha core no uso diario e so promova ops/full quando a tarefa realmente pedir mais runtime.',
        'Consulte memoria procedural antes de repetir trabalho manual.',
        'Use doctor e regressao quando mudar algo importante.',
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
    summary: 'Fluxo curto para instalar, validar o runtime basico, manter o host em core e seguir na jornada oficial web-only, com Telegram como primeiro canal externo opcional.',
    estimatedMinutes: 4,
    nextAction: 'npm run cli:fast -- status --json',
    steps: [
      'Instale ou reidrate o workspace.',
      'Confirme primeiro o modo de produto; builder e o baseline natural do fluxo atual de desenvolvimento.',
      'Use o dashboard em /dashboard como face principal e conecte Telegram so quando quiser a primeira extensao externa do fluxo.',
      'Mantenha core como perfil recomendado; ops entra para manutencao e full fica reservado para uso deliberado.',
      'Suba o runtime oficial e valide o status rapido.',
      'Revise doctor de desktop e preset leve do workspace antes de abrir IDEs grandes.',
      'Rode smoke e regressao curta antes de uma rodada estrutural.',
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
    `Tempo estimado: ${guide.estimatedMinutes} minuto(s).`,
    `Proximo comando: ${guide.nextAction}`,
    '',
    'Primeiros passos:',
    ...guide.steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    'Atalhos principais:',
    ...guide.commands.map((command) => `- ${command}`),
    '',
    'Artefatos locais:',
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
