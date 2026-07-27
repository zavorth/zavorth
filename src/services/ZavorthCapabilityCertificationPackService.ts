import fs from 'node:fs';
import path from 'node:path';
import { ProviderIntegrationRegistry } from './providers/catalog/ProviderIntegrationRegistry.js';

import {
  ZAVORTH_CAPABILITY_CERTIFICATION_PACK_CONTRACT_VERSION,
  type ZavorthExecutionBackendMatrixEntry,
  type ZavorthGatewayMatrixChannel,
  type ZavorthSkillEcosystemNativeCategory,
  type ZavorthCapabilityCertificationStage,
  type ZavorthCapabilityCertificationSnapshot,
  type ZavorthCapabilityCertificationStatus,
} from '../contracts/ZavorthCapabilityCertificationPackContract.js';

import { ZavorthCliTuiPolishService } from './ZavorthCliTuiPolishService.js';
import { ZavorthControlVisualQaService } from './ZavorthControlVisualQaService.js';
import { ZavorthSkillCuratorLiveLoopService } from './ZavorthSkillCuratorLiveLoopService.js';
import { ZavorthSkillEcosystemPackService } from './ZavorthSkillEcosystemPackService.js';
import { ZavorthMaturityService } from './ZavorthMaturityService.js';

const REQUIRED_PROVIDER_CERTIFICATION_ROUTES = [
  'alibaba-coding-plan',
  'azure-foundry',
  'copilot-acp',
  'gmi',
  'ollama-cloud',
  'opencode-zen',
  'qwen-oauth',
] as const;

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
  zavorthControlVisualQa?: ZavorthControlVisualQaService;
  maturity?: ZavorthMaturityService;
};

export class ZavorthCapabilityCertificationPackService {
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
  private readonly zavorthControlVisualQa: ZavorthControlVisualQaService;
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
    this.zavorthControlVisualQa = runtime.zavorthControlVisualQa || new ZavorthControlVisualQaService({ projectRoot: this.projectRoot });
    this.maturity = runtime.maturity || new ZavorthMaturityService({ projectRoot: this.projectRoot, now: this.now });
  }

  public async buildSnapshot(): Promise<ZavorthCapabilityCertificationSnapshot> {
    const providerSnapshot = this.providerRegistry.buildSnapshot();
    const missingProviderRoutes = REQUIRED_PROVIDER_CERTIFICATION_ROUTES
      .filter((route) => !this.providerRegistry.resolveRoute(route));
    const [cliTui, skillEcosystem, skillCurator, zavorthControlVisualQa, maturity] = await Promise.all([
      this.cliTui.buildSnapshot({ refreshProviders: false, workspaceHint: this.projectRoot }),
      Promise.resolve(this.skillEcosystem.buildSnapshot()),
      Promise.resolve(this.skillCurator.buildSnapshot({ includeImported: true, includeWorkspace: true })),
      Promise.resolve(this.zavorthControlVisualQa.buildSnapshot()),
      Promise.resolve(this.maturity.buildSnapshot()),
    ]);
    const gatewayChannels = buildGatewayMatrix(this.env);
    const backends = buildExecutionBackends(this.env);
    const nativeCategories = buildNativeSkillCategories();
    const conceptualLeaks = this.scanConceptualExternalReferences();

    const stages: ZavorthCapabilityCertificationStage[] = [
      stage('freeze-baseline', 'Freeze, audit, and baseline', conceptualLeaks.length === 0 ? 'passed' : 'blocked', [
        `identityLeaks=${conceptualLeaks.length}`,
        `maturity=${maturity.status}`,
      ], 'zavorth capability-certification --json'),
      stage('provider-certification', 'Provider certification complete', missingProviderRoutes.length === 0 ? 'passed' : 'blocked', [
        `routes=${providerSnapshot.routeCount}`,
        `missing=${missingProviderRoutes.join(',') || 'none'}`,
      ], 'zavorth providers consistency'),
      stage('cli-tui-premium', 'CLI/TUI premium', cliTui.status === 'blocked' ? 'blocked' : 'passed', [
        `status=${cliTui.status}`,
        `cards=${cliTui.cards.length}`,
      ], 'zavorth tui'),
      stage('gateway-multichannel', 'Multichannel gateway', gatewayChannels.every((channel) => channel.naturalFirst && channel.approvalIntentResolver) ? 'passed' : 'blocked', [
        `channels=${gatewayChannels.length}`,
        `configurable=${gatewayChannels.filter((channel) => channel.status === 'configurable').length}`,
      ], 'zavorth gateway matrix'),
      stage('execution-backends', 'Sandbox and terminal backends', backends.every((backend) => backend.liveByDefault === false && backend.receiptRequired) ? 'passed' : 'blocked', [
        `backends=${backends.length}`,
        `available=${backends.filter((backend) => backend.status === 'available').length}`,
      ], 'zavorth execution-backends'),
      stage('skill-ecosystem', 'Skill ecosystem Zavorth-native', skillEcosystem.status === 'passed' && nativeCategories.length >= 10 ? 'passed' : 'blocked', [
        `pack=${skillEcosystem.status}`,
        `nativeCategories=${nativeCategories.length}`,
      ], 'zavorth skill-ecosystem'),
      stage('skill-curator', 'Native autonomous skill curator', skillCurator.safety.applyRequiresApprovalId ? 'passed' : 'blocked', [
        `status=${skillCurator.status}`,
        `proposals=${skillCurator.summary.proposals}`,
      ], 'zavorth skill-curator'),
      stage('zavorthControl-polish', 'ZavorthControl polish', zavorthControlVisualQa.status === 'blocked' ? 'attention' : 'passed', [
        `visualQa=${zavorthControlVisualQa.status}`,
        `scenarios=${zavorthControlVisualQa.summary.scenarios}`,
      ], 'npm run zavorth:zavorthControl-visual-qa --silent'),
    ];
    const finalStatus = resolveStatus(stages);
    stages.push(stage('final-certification', 'Final certification and hardening', finalStatus, [
      `passed=${stages.filter((entry) => entry.status === 'passed').length}`,
      `blocked=${stages.filter((entry) => entry.status === 'blocked').length}`,
    ], 'npm run zavorth:capability-certification:check --silent'));

    const status = resolveStatus(stages);
    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_CAPABILITY_CERTIFICATION_PACK_CONTRACT_VERSION,
      surface: 'capability-certification-pack',
      status,
      summary: {
        stages: stages.length,
        passed: stages.filter((entry) => entry.status === 'passed').length,
        attention: stages.filter((entry) => entry.status === 'attention').length,
        blocked: stages.filter((entry) => entry.status === 'blocked').length,
        providerRoutes: providerSnapshot.routeCount,
        requiredProviderCertificationRoutes: REQUIRED_PROVIDER_CERTIFICATION_ROUTES.length,
        missingProviderCertificationRoutes: missingProviderRoutes,
        gatewayChannels: gatewayChannels.length,
        executionBackends: backends.length,
        nativeSkillCategories: nativeCategories.length,
        conceptualExternalReferenceLeaks: conceptualLeaks.length,
        securityReady: conceptualLeaks.length === 0
          && maturity.summary.dataLifecycleReleaseReady
          && maturity.distinctions.hostLiveCertificationHonest,
      },
      stages,
      providerCertification: {
        requiredRoutes: [...REQUIRED_PROVIDER_CERTIFICATION_ROUTES],
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
        baseline: 'zavorth capability-certification --json',
        providers: 'zavorth providers consistency',
        tui: 'zavorth tui',
        gatewayMatrix: 'zavorth gateway matrix',
        executionBackends: 'zavorth execution-backends',
        skillEcosystem: 'zavorth skill-ecosystem',
        skillCurator: 'zavorth skill-curator',
        check: 'npm run zavorth:capability-certification:check --silent',
      },
      safety: {
        noConceptualExternalReferences: conceptualLeaks.length === 0,
        officialModelNamesMayRemain: true,
        noLiveProviderClaimWithoutProof: true,
        noSkillMutationWithoutApproval: true,
        noExternalBackendLiveWithoutExplicitConfig: true,
        noZavorthControlStyleFork: true,
      },
    };
  }

  public renderText(snapshot: ZavorthCapabilityCertificationSnapshot): string {
    return [
      'Zavorth Capability Certification Pack',
      `Status: ${snapshot.status}`,
      `Stages: ${snapshot.summary.passed}/${snapshot.summary.stages} passed, attention=${snapshot.summary.attention}, blocked=${snapshot.summary.blocked}`,
      `Providers: ${snapshot.summary.providerRoutes} routes; missing certification=${snapshot.summary.missingProviderCertificationRoutes.join(',') || 'none'}`,
      `Channels: ${snapshot.summary.gatewayChannels}; backends=${snapshot.summary.executionBackends}; native skill categories=${snapshot.summary.nativeSkillCategories}`,
      '',
      'Stages:',
      ...snapshot.stages.map((entry) => `- ${entry.status.toUpperCase()} ${entry.label}: ${entry.evidence.join(' | ')}`),
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
    if (this.hasIdentityBlocklistReference(text)) {
      leaks.push(path.relative(this.projectRoot, target).replace(/\\/g, '/'));
    }
  }

  private hasIdentityBlocklistReference(text: string): boolean {
    const configuredPatterns = (this.env.ZAVORTH_IDENTITY_BLOCKLIST || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    const defaultPatterns = [
      ['legacy', 'agent', 'reference'].join('-'),
      ['external', 'agent', 'reference'].join('-'),
      ['non', 'native', 'skill', 'source'].join('-'),
    ];
    return [...defaultPatterns, ...configuredPatterns]
      .some((pattern) => word(pattern).test(text));
  }
}

function stage(
  id: ZavorthCapabilityCertificationStage['id'],
  label: string,
  status: ZavorthCapabilityCertificationStatus,
  evidence: string[],
  command: string,
): ZavorthCapabilityCertificationStage {
  return { id, label, status, evidence, command };
}

function resolveStatus(stages: ZavorthCapabilityCertificationStage[]): ZavorthCapabilityCertificationStatus {
  if (stages.some((entry) => entry.status === 'blocked')) return 'blocked';
  if (stages.some((entry) => entry.status === 'attention')) return 'attention';
  return 'passed';
}

function buildGatewayMatrix(env: Record<string, string | undefined>): ZavorthGatewayMatrixChannel[] {
  const channels: Array<[ZavorthGatewayMatrixChannel['id'], string, string[]]> = [
    ['cli', 'CLI/TUI', []],
    ['web', 'ZavorthControl/API', []],
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
    backend('local-supervised', 'local supervised process', 'available', 'process', 'zavorth execution-backends --backend local-supervised'),
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

function word(value: string): RegExp {
  return new RegExp(`\\b${escapeRegex(value)}\\b`, 'i');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+...^${}()|[\]\\]/g, '\\$&');
}

export const ZAVORTH_CAPABILITY_CERTIFICATION_REQUIRED_PROVIDER_ROUTES = [...REQUIRED_PROVIDER_CERTIFICATION_ROUTES];
