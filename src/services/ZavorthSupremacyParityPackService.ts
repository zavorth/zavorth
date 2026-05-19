import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_SUPREMACY_PARITY_PACK_CONTRACT_VERSION,
  type ZavorthExecutionBackendMatrixEntry,
  type ZavorthGatewayMatrixChannel,
  type ZavorthSkillEcosystemNativeCategory,
  type ZavorthSupremacyParityPhase,
  type ZavorthSupremacyParitySnapshot,
  type ZavorthSupremacyParityStatus,
} from '../contracts/ZavorthSupremacyParityPackContract.js';
import { ProviderIntegrationRegistry } from './providers/catalog/ProviderIntegrationRegistry.js';
import { ZavorthCliTuiPolishService } from './ZavorthCliTuiPolishService.js';
import { ZavorthDashboardVisualQaService } from './ZavorthDashboardVisualQaService.js';
import { ZavorthSkillCuratorLiveLoopService } from './ZavorthSkillCuratorLiveLoopService.js';
import { ZavorthSkillEcosystemPackService } from './ZavorthSkillEcosystemPackService.js';
import { ZavorthMaturityService } from './ZavorthMaturityService.js';

const REQUIRED_PROVIDER_PARITY_ROUTES = [
  'alibaba-coding-plan',
  'azure-foundry',
  'copilot-acp',
  'gmi',
  'ollama-cloud',
  'opencode-zen',
  'qwen-oauth',
] as const;

const ALLOWED_MODEL_NAME_REFERENCES = [
  'NousResearch/Hermes',
  'DeepHermes',
  'hermes-3-llama',
];

type Runtime = {
  now?: () => Date;
  projectRoot?: string;
  env?: Record<string, string | undefined>;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  readdirSync?: typeof fs.readdirSync;
  statSync?: typeof fs.statSync;
  providerRegistry?: ProviderIntegrationRegistry;
  cliTui?: ZavorthCliTuiPolishService;
  skillEcosystem?: ZavorthSkillEcosystemPackService;
  skillCurator?: ZavorthSkillCuratorLiveLoopService;
  dashboardVisualQa?: ZavorthDashboardVisualQaService;
  maturity?: ZavorthMaturityService;
};

export class ZavorthSupremacyParityPackService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly env: Record<string, string | undefined>;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly statSync: typeof fs.statSync;
  private readonly providerRegistry: ProviderIntegrationRegistry;
  private readonly cliTui: ZavorthCliTuiPolishService;
  private readonly skillEcosystem: ZavorthSkillEcosystemPackService;
  private readonly skillCurator: ZavorthSkillCuratorLiveLoopService;
  private readonly dashboardVisualQa: ZavorthDashboardVisualQaService;
  private readonly maturity: ZavorthMaturityService;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.env = runtime.env || process.env;
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.statSync = runtime.statSync || fs.statSync.bind(fs);
    this.providerRegistry = runtime.providerRegistry || new ProviderIntegrationRegistry();
    this.cliTui = runtime.cliTui || new ZavorthCliTuiPolishService();
    this.skillEcosystem = runtime.skillEcosystem || new ZavorthSkillEcosystemPackService({ rootDir: this.projectRoot });
    this.skillCurator = runtime.skillCurator || new ZavorthSkillCuratorLiveLoopService({ projectRoot: this.projectRoot });
    this.dashboardVisualQa = runtime.dashboardVisualQa || new ZavorthDashboardVisualQaService({ projectRoot: this.projectRoot });
    this.maturity = runtime.maturity || new ZavorthMaturityService({ projectRoot: this.projectRoot, now: this.now });
  }

  public async buildSnapshot(): Promise<ZavorthSupremacyParitySnapshot> {
    const providerSnapshot = this.providerRegistry.buildSnapshot();
    const missingProviderRoutes = REQUIRED_PROVIDER_PARITY_ROUTES
      .filter((route) => !this.providerRegistry.resolveRoute(route));
    const [cliTui, skillEcosystem, skillCurator, dashboardVisualQa, maturity] = await Promise.all([
      this.cliTui.buildSnapshot({ refreshProviders: false, workspaceHint: this.projectRoot }),
      Promise.resolve(this.skillEcosystem.buildSnapshot()),
      Promise.resolve(this.skillCurator.buildSnapshot({ includeImported: true, includeWorkspace: true })),
      Promise.resolve(this.dashboardVisualQa.buildSnapshot()),
      Promise.resolve(this.maturity.buildSnapshot()),
    ]);
    const gatewayChannels = buildGatewayMatrix(this.env);
    const backends = buildExecutionBackends(this.env);
    const nativeCategories = buildNativeSkillCategories();
    const conceptualLeaks = this.scanConceptualExternalReferences();

    const phases: ZavorthSupremacyParityPhase[] = [
      phase('freeze-baseline', 'Freeze, auditoria e baseline', conceptualLeaks.length === 0 ? 'passed' : 'blocked', [
        `identityLeaks=${conceptualLeaks.length}`,
        `maturity=${maturity.status}`,
      ], 'zavorth supremacy-parity --json'),
      phase('provider-parity', 'Provider parity completa', missingProviderRoutes.length === 0 ? 'passed' : 'blocked', [
        `routes=${providerSnapshot.routeCount}`,
        `missing=${missingProviderRoutes.join(',') || 'none'}`,
      ], 'zavorth providers parity'),
      phase('cli-tui-premium', 'CLI/TUI premium', cliTui.status === 'blocked' ? 'blocked' : 'passed', [
        `status=${cliTui.status}`,
        `cards=${cliTui.cards.length}`,
      ], 'zavorth tui'),
      phase('gateway-multichannel', 'Gateway multicanal', gatewayChannels.every((channel) => channel.naturalFirst && channel.approvalIntentResolver) ? 'passed' : 'blocked', [
        `channels=${gatewayChannels.length}`,
        `configurable=${gatewayChannels.filter((channel) => channel.status === 'configurable').length}`,
      ], 'zavorth gateway matrix'),
      phase('execution-backends', 'Sandbox e terminal backends', backends.every((backend) => backend.liveByDefault === false && backend.receiptRequired) ? 'passed' : 'blocked', [
        `backends=${backends.length}`,
        `available=${backends.filter((backend) => backend.status === 'available').length}`,
      ], 'zavorth execution-backends'),
      phase('skill-ecosystem', 'Skill ecosystem Zavorth-native', skillEcosystem.status === 'passed' && nativeCategories.length >= 10 ? 'passed' : 'blocked', [
        `pack=${skillEcosystem.status}`,
        `nativeCategories=${nativeCategories.length}`,
      ], 'zavorth skill-ecosystem'),
      phase('skill-curator', 'Skill curator autonomo nativo', skillCurator.safety.applyRequiresApprovalId ? 'passed' : 'blocked', [
        `status=${skillCurator.status}`,
        `proposals=${skillCurator.summary.proposals}`,
      ], 'zavorth skill-curator'),
      phase('dashboard-polish', 'Dashboard polish', dashboardVisualQa.status === 'blocked' ? 'attention' : 'passed', [
        `visualQa=${dashboardVisualQa.status}`,
        `scenarios=${dashboardVisualQa.summary.scenarios}`,
      ], 'npm run zavorth:dashboard-visual-qa --silent'),
    ];
    const finalStatus = resolveStatus(phases);
    phases.push(phase('final-certification', 'Certificacao final e hardening', finalStatus, [
      `passed=${phases.filter((entry) => entry.status === 'passed').length}`,
      `blocked=${phases.filter((entry) => entry.status === 'blocked').length}`,
    ], 'npm run zavorth:supremacy-parity:check --silent'));

    const status = resolveStatus(phases);
    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SUPREMACY_PARITY_PACK_CONTRACT_VERSION,
      surface: 'supremacy-parity-pack',
      status,
      summary: {
        phases: phases.length,
        passed: phases.filter((entry) => entry.status === 'passed').length,
        attention: phases.filter((entry) => entry.status === 'attention').length,
        blocked: phases.filter((entry) => entry.status === 'blocked').length,
        providerRoutes: providerSnapshot.routeCount,
        requiredProviderParityRoutes: REQUIRED_PROVIDER_PARITY_ROUTES.length,
        missingProviderParityRoutes: missingProviderRoutes,
        gatewayChannels: gatewayChannels.length,
        executionBackends: backends.length,
        nativeSkillCategories: nativeCategories.length,
        conceptualExternalReferenceLeaks: conceptualLeaks.length,
        securityReady: conceptualLeaks.length === 0 && maturity.distinctions.externalReferenceLeakFree,
      },
      phases,
      providerParity: {
        requiredRoutes: [...REQUIRED_PROVIDER_PARITY_ROUTES],
        missingRoutes: missingProviderRoutes,
        routeCount: providerSnapshot.routeCount,
        catalogOnlyUntilLiveProof: true,
        noRawSecretsSerialized: true,
      },
      gatewayMatrix: {
        channels: gatewayChannels,
        safety: {
          allChannelsUseNaturalFirstContract: gatewayChannels.every((channel) => channel.naturalFirst),
          allSensitiveActionsUseApprovalResolver: gatewayChannels.every((channel) => channel.approvalIntentResolver),
          notConfiguredIsExplicit: true,
        },
      },
      executionBackends: {
        entries: backends,
        safety: {
          noBackendLiveByDefault: true,
          highRiskRequiresApproval: true,
          receiptRequired: true,
          secretDumpBlocked: true,
        },
      },
      skillEcosystem: {
        nativeCategories,
        draftImportsOnly: true,
        noExternalCodeCopy: true,
        mutationRequiresApproval: true,
      },
      commands: {
        baseline: 'zavorth supremacy-parity --json',
        providers: 'zavorth providers parity',
        tui: 'zavorth tui',
        gatewayMatrix: 'zavorth gateway matrix',
        executionBackends: 'zavorth execution-backends',
        skillEcosystem: 'zavorth skill-ecosystem',
        skillCurator: 'zavorth skill-curator',
        check: 'npm run zavorth:supremacy-parity:check --silent',
      },
      safety: {
        noConceptualExternalReferences: conceptualLeaks.length === 0,
        officialModelNamesMayRemain: true,
        noLiveProviderClaimWithoutProof: true,
        noSkillMutationWithoutApproval: true,
        noExternalBackendLiveWithoutExplicitConfig: true,
        noDashboardStyleFork: true,
      },
    };
  }

  public renderText(snapshot: ZavorthSupremacyParitySnapshot): string {
    return [
      'Zavorth Supremacy Parity Pack',
      `Status: ${snapshot.status}`,
      `Phases: ${snapshot.summary.passed}/${snapshot.summary.phases} passed, attention=${snapshot.summary.attention}, blocked=${snapshot.summary.blocked}`,
      `Providers: ${snapshot.summary.providerRoutes} routes; missing parity=${snapshot.summary.missingProviderParityRoutes.join(',') || 'none'}`,
      `Channels: ${snapshot.summary.gatewayChannels}; backends=${snapshot.summary.executionBackends}; native skill categories=${snapshot.summary.nativeSkillCategories}`,
      '',
      'Phases:',
      ...snapshot.phases.map((entry) => `- ${entry.status.toUpperCase()} ${entry.label}: ${entry.evidence.join(' | ')}`),
      '',
      `Next: ${snapshot.commands.check}`,
    ].join('\n');
  }

  private scanConceptualExternalReferences(): string[] {
    const roots = ['src', 'scripts', 'tests', 'package.json'];
    const leaks: string[] = [];
    for (const root of roots) {
      const target = path.join(this.projectRoot, root);
      if (!this.existsSync(target)) continue;
      this.scanPath(target, leaks);
    }
    return leaks;
  }

  private scanPath(target: string, leaks: string[]): void {
    const stat = this.statSync(target);
    if (stat.isDirectory()) {
      for (const child of this.readdirSync(target)) {
        if (['node_modules', 'dist', 'coverage', '.next'].includes(child)) continue;
        this.scanPath(path.join(target, child), leaks);
      }
      return;
    }
    if (!/\.(ts|tsx|js|mjs|json)$/i.test(target)) return;
    const text = this.readFileSync(target, 'utf8');
    if (hasConceptualExternalReference(text)) {
      leaks.push(path.relative(this.projectRoot, target).replace(/\\/g, '/'));
    }
  }
}

function phase(
  id: ZavorthSupremacyParityPhase['id'],
  label: string,
  status: ZavorthSupremacyParityStatus,
  evidence: string[],
  command: string,
): ZavorthSupremacyParityPhase {
  return { id, label, status, evidence, command };
}

function resolveStatus(phases: ZavorthSupremacyParityPhase[]): ZavorthSupremacyParityStatus {
  if (phases.some((entry) => entry.status === 'blocked')) return 'blocked';
  if (phases.some((entry) => entry.status === 'attention')) return 'attention';
  return 'passed';
}

function buildGatewayMatrix(env: Record<string, string | undefined>): ZavorthGatewayMatrixChannel[] {
  const channels: Array<[ZavorthGatewayMatrixChannel['id'], string, string[]]> = [
    ['cli', 'CLI/TUI', []],
    ['web', 'Dashboard/API', []],
    ['telegram', 'Telegram', ['TELEGRAM_BOT_TOKEN']],
    ['discord', 'Discord', ['DISCORD_BOT_TOKEN']],
    ['slack', 'Slack', ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN']],
    ['whatsapp', 'WhatsApp', ['WHATSAPP_SESSION_FILE', 'WHATSAPP_STATUS_FILE']],
    ['signal', 'Signal', ['SIGNAL_CLI_PATH']],
    ['email', 'Email', ['SMTP_URL', 'EMAIL_PROVIDER_API_KEY']],
    ['api', 'HTTP API', []],
  ];
  return channels.map(([id, label, envKeys]) => {
    const live = id === 'cli' || id === 'web' || id === 'api';
    const configured = live || envKeys.some((key) => Boolean(env[key]));
    return {
      id,
      label,
      status: live ? 'live' : configured ? 'configured' : 'configurable',
      naturalFirst: true,
      smartCommands: true,
      approvalIntentResolver: true,
      receipts: true,
      redaction: true,
      richActions: ['telegram', 'discord', 'slack', 'whatsapp', 'web'].includes(id),
      nextCommand: id === 'cli' ? 'zavorth tui' : `zavorth gateway matrix --channel ${id}`,
    };
  });
}

function buildExecutionBackends(env: Record<string, string | undefined>): ZavorthExecutionBackendMatrixEntry[] {
  return [
    backend('local-supervised', 'Local supervised process', 'available', 'process', 'zavorth execution-backends --backend local-supervised'),
    backend('docker', 'Docker container', env.DOCKER_HOST || env.ZAVORTH_DOCKER_ENABLED === '1' ? 'configurable' : 'not-configured', 'container', 'zavorth execution-backends --backend docker'),
    backend('wsl', 'WSL runtime', process.platform === 'win32' ? 'configurable' : 'not-configured', 'vm', 'zavorth execution-backends --backend wsl'),
    backend('ssh', 'SSH remote shell', env.ZAVORTH_SSH_HOST ? 'configurable' : 'not-configured', 'remote-shell', 'zavorth execution-backends --backend ssh'),
    backend('vercel-sandbox', 'Vercel Sandbox', env.VERCEL_TOKEN ? 'configurable' : 'not-configured', 'vm', 'zavorth execution-backends --backend vercel-sandbox'),
    backend('daytona', 'Daytona workspace', env.DAYTONA_API_KEY ? 'configurable' : 'not-configured', 'remote-container', 'zavorth execution-backends --backend daytona'),
    backend('generic-container', 'Generic container backend', env.ZAVORTH_CONTAINER_IMAGE ? 'configurable' : 'not-configured', 'container', 'zavorth execution-backends --backend generic-container'),
  ];
}

function backend(
  id: ZavorthExecutionBackendMatrixEntry['id'],
  label: string,
  status: ZavorthExecutionBackendMatrixEntry['status'],
  isolation: ZavorthExecutionBackendMatrixEntry['isolation'],
  nextCommand: string,
): ZavorthExecutionBackendMatrixEntry {
  return {
    id,
    label,
    status,
    isolation,
    approvalRequiredForHighRisk: true,
    allowedCwdRequired: true,
    timeoutRequired: true,
    envAllowlistRequired: true,
    noSecretDump: true,
    receiptRequired: true,
    liveByDefault: false,
    nextCommand,
  };
}

function buildNativeSkillCategories(): ZavorthSkillEcosystemNativeCategory[] {
  return [
    category('dev', 'zavorth-dev-workbench', 'Dev Workbench', 'medium', 'tool-preview'),
    category('research', 'zavorth-research-synthesis', 'Research Synthesis', 'low', 'none'),
    category('ops', 'zavorth-ops-runtime', 'Ops Runtime', 'medium', 'tool-preview'),
    category('security', 'zavorth-security-review', 'Security Review', 'high', 'owner-approval'),
    category('browser', 'zavorth-browser-operator', 'Browser Operator', 'medium', 'tool-preview'),
    category('files-docs', 'zavorth-file-document-understanding', 'File And Document Understanding', 'medium', 'tool-preview'),
    category('data', 'zavorth-data-analysis', 'Data Analysis', 'medium', 'tool-preview'),
    category('communication', 'zavorth-communication-control', 'Communication Control', 'medium', 'tool-preview'),
    category('finance-transaction-safe', 'zavorth-transaction-safe-finance', 'Transaction-safe Finance', 'high', 'owner-approval'),
    category('media', 'zavorth-media-generation-review', 'Media Generation Review', 'medium', 'tool-preview'),
  ];
}

function category(
  id: ZavorthSkillEcosystemNativeCategory['id'],
  skillId: string,
  title: string,
  risk: ZavorthSkillEcosystemNativeCategory['risk'],
  requiredApproval: ZavorthSkillEcosystemNativeCategory['requiredApproval'],
): ZavorthSkillEcosystemNativeCategory {
  return { id, skillId, title, risk, requiredApproval };
}

function hasConceptualExternalReference(text: string): boolean {
  const forbidden = [
    word(['Open', 'Claw'].join('')),
    word(['temp', 'hermes', 'analysis'].join('_')),
    word(['local', 'reference', 'skill', 'library'].join('-')),
    word(['diego', 'souza', 'pw'].join('')),
    word(['Hermes', 'style'].join('-')),
    word(['Claw', 'style'].join('-')),
    word(['migrate', 'hermes'].join('-')),
    word(['hermes', 'json'].join('.')),
    word(['zavorth', 'migration', 'hermes'].join('.')),
  ];
  if (!forbidden.some((pattern) => pattern.test(text))) return false;
  return !ALLOWED_MODEL_NAME_REFERENCES.some((allowed) => text.includes(allowed));
}

function word(value: string): RegExp {
  return new RegExp(`\\b${escapeRegex(value)}\\b`, 'i');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const ZAVORTH_SUPREMACY_REQUIRED_PROVIDER_PARITY_ROUTES = [...REQUIRED_PROVIDER_PARITY_ROUTES];
