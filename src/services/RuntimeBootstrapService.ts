import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type { ModelPickerContract, SelectedModelProfile } from '../contracts/ModelPickerContract.js';
import type { PlatformCapability } from '../contracts/PlatformContract.js';
import { ModelPickerContractService } from '../domain/providers/index.js';
import { PlatformCapabilityService } from './PlatformCapabilityService.js';
import { logger } from '../logger.js';
import {
SupervisedRuntimeService,
  type SupervisedRuntimeInspection,
} from './SupervisedRuntimeService.js';

export type RuntimeBootstrapAction = {
  id: string;
  title: string;
  command: string;
  reason: string;
  blocking: boolean;
  autoFixCommand?: {
    command: string;
    args: string[];
    cwd?: string;
  } | null;
};

export type RuntimeBootstrapReport = {
  checkedAt: string;
  projectRoot: string;
  env: {
    envFilePresent: boolean;
    llmProvider: string;
    llmCredentialReady: boolean;
    issues: string[];
    modelPicker?: ModelPickerContract | null;
    selectedModel?: RuntimeBootstrapSelectedModel | null;
  };
  dependencies: {
    installRequired: boolean;
    buildRequired: boolean;
  };
  platforms: PlatformCapability[];
  supervisedRuntime: SupervisedRuntimeInspection;
  actions: RuntimeBootstrapAction[];
  summary: string;
};

export type RuntimeBootstrapSelectedModel = Pick<
  SelectedModelProfile,
  'source' | 'providerName' | 'providerLabel' | 'modelName' | 'modelLabel' | 'routeId' | 'readiness' | 'ready' | 'explanation'
>;

type SupervisedRuntimeLike = Pick<SupervisedRuntimeService, 'inspect'> & Partial<Pick<SupervisedRuntimeService, 'inspectLive'>>;
type PlatformCapabilityLike = Pick<PlatformCapabilityService, 'getCapabilities'>;
type ModelPickerContractLike = Pick<ModelPickerContractService, 'buildContract'>;

type RuntimeBootstrapOptions = {
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  envFilePath?: string;
  projectRoot?: string;
  supervisedRuntimeService?: SupervisedRuntimeLike;
  platformCapabilityService?: PlatformCapabilityLike;
  modelPickerContractService?: ModelPickerContractLike;
  llmProvider?: string;
  llmCredentialReady?: boolean;
};

export class RuntimeBootstrapService {
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly envFilePath: string;
  private readonly projectRoot: string;
  private readonly supervisedRuntimeService: SupervisedRuntimeLike;
  private readonly platformCapabilityService: PlatformCapabilityLike;
  private readonly modelPickerContractService: ModelPickerContractLike;
  private readonly llmProvider: string;
  private readonly llmCredentialReadyOverride: boolean | null;

  constructor(options: RuntimeBootstrapOptions = {}) {
    this.now = options.now || (() => new Date());
    this.existsSync = options.existsSync || fs.existsSync.bind(fs);
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.envFilePath = options.envFilePath || path.join(this.projectRoot, '.env');
    this.supervisedRuntimeService = options.supervisedRuntimeService || new SupervisedRuntimeService();
    this.platformCapabilityService = options.platformCapabilityService || new PlatformCapabilityService();
    this.modelPickerContractService = options.modelPickerContractService || new ModelPickerContractService();
    this.llmProvider = String(options.llmProvider || (config.llmProvider || '')).trim().toLowerCase();
    this.llmCredentialReadyOverride = typeof options.llmCredentialReady === 'boolean'
      ? options.llmCredentialReady
      : null;
  }

  public inspect(): RuntimeBootstrapReport {
    const supervisedRuntime = this.supervisedRuntimeService.inspect();
    return this.buildReport(supervisedRuntime);
  }

  public async inspectLive(): Promise<RuntimeBootstrapReport> {
    const supervisedRuntime = this.supervisedRuntimeService.inspectLive
      ? await this.supervisedRuntimeService.inspectLive()
      : this.supervisedRuntimeService.inspect();
    return this.buildReport(supervisedRuntime);
  }

  private buildReport(supervisedRuntime: SupervisedRuntimeInspection): RuntimeBootstrapReport {
    const platforms = this.platformCapabilityService.getCapabilities();
    const modelPicker = this.modelPickerContractService.buildContract({ includeAdvanced: true });
    const envFilePresent = this.existsSync(this.envFilePath);
    const llmCredentialReady = this.resolveLlmCredentialReady();
    const envIssues = this.buildEnvIssues(envFilePresent, platforms, llmCredentialReady);
    const actions = this.buildActions({
      envFilePresent,
      llmCredentialReady,
      platforms,
      supervisedRuntime,
    });

    return {
      checkedAt: this.now().toISOString(),
      projectRoot: this.projectRoot,
      env: {
        envFilePresent,
        llmProvider: this.llmProvider,
        llmCredentialReady,
        issues: envIssues,
        modelPicker,
        selectedModel: this.toBootstrapSelectedModel(modelPicker.selected),
      },
      dependencies: {
        installRequired: supervisedRuntime.installRequired,
        buildRequired: supervisedRuntime.buildRequired,
      },
      platforms,
      supervisedRuntime,
      actions,
      summary: this.buildSummary(envIssues, supervisedRuntime, actions),
    };
  }

  private toBootstrapSelectedModel(selected: SelectedModelProfile): RuntimeBootstrapSelectedModel {
    return {
      source: selected.source,
      providerName: selected.providerName,
      providerLabel: selected.providerLabel,
      modelName: selected.modelName,
      modelLabel: selected.modelLabel,
      routeId: selected.routeId,
      readiness: selected.readiness,
      ready: selected.ready,
      explanation: [...selected.explanation],
    };
  }

  private buildEnvIssues(
    envFilePresent: boolean,
    _platforms: PlatformCapability[],
    llmCredentialReady: boolean,
  ): string[] {
    const issues: string[] = [];

    if (!envFilePresent) {
      issues.push('The .env file has not been created yet.');
    }

    if (!llmCredentialReady) {
      issues.push(this.getProviderCredentialMessage(this.llmProvider));
    }

    return issues;
  }

  private buildActions(input: {
    envFilePresent: boolean;
    llmCredentialReady: boolean;
    platforms: PlatformCapability[];
    supervisedRuntime: SupervisedRuntimeInspection;
  }): RuntimeBootstrapAction[] {
    const actions: RuntimeBootstrapAction[] = [];
    const telegram = input.platforms.find((entry) => entry.platform === 'telegram');
    const optionalChannels = input.platforms.filter((entry) => ['telegram', 'discord', 'slack', 'whatsapp'].includes(entry.platform));
    const preparedChannels = optionalChannels.filter((entry) => entry.configured || entry.readiness === 'ready');
    const partialChannels = optionalChannels.filter((entry) => entry.configured && entry.readiness !== 'ready');
    const nodeMeshSmoke = input.supervisedRuntime.accessReadiness?.runtime?.nodeMeshSmoke;
    const channelProviderDoctor = input.supervisedRuntime.accessReadiness?.runtime?.channelProviderDoctor;
    const remoteTransportDoctor = input.supervisedRuntime.accessReadiness?.runtime?.remoteTransportDoctor;

    // Check for stuck process lock files
    const hostSupervisor = input.supervisedRuntime.hostSupervisor;
    const telegramWorker = input.supervisedRuntime.telegramWorker;
    const hostStuck = hostSupervisor && hostSupervisor.active && !hostSupervisor.alive;
    const workerStuck = telegramWorker && telegramWorker.active && !telegramWorker.alive;

    if (hostStuck || workerStuck) {
      const stuckNames = [];
      if (hostStuck) stuckNames.push('host supervisor');
      if (workerStuck) stuckNames.push('telegram worker');
      actions.push({
        id: 'clear-stuck-locks',
        title: 'Clear stuck supervisor/worker process locks',
        command: 'npx tsx scripts/ops-doctor-repair-helper.ts clear-locks',
        reason: `Process lock file(s) for ${stuckNames.join(' and ')} are present but the process is dead.`,
        blocking: false,
        autoFixCommand: {
          command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
          args: ['tsx', 'scripts/ops-doctor-repair-helper.ts', 'clear-locks'],
          cwd: this.projectRoot,
        },
      });
    }

    // Check for skill-sources.json configuration health
    const configFile = path.join(this.projectRoot, 'config', 'skill-sources.json');
    let skillSourcesValid = true;
    let skillSourcesMissing = false;
    let skillSourcesMissingDirs = false;
    const missingDirsList: string[] = [];

    if (!this.existsSync(configFile)) {
      skillSourcesValid = false;
      skillSourcesMissing = true;
    } else {
      try {
        const content = fs.readFileSync(configFile, 'utf8');
        const doc = JSON.parse(content);
        if (!doc || !Array.isArray(doc.sources)) {
          skillSourcesValid = false;
        } else {
          doc.sources.forEach((source: any) => {
            if (source.enabled && source.createIfMissing !== false && source.path) {
              const targetDir = path.isAbsolute(source.path)
                ? path.resolve(source.path)
                : path.resolve(this.projectRoot, source.path);
              if (!fs.existsSync(targetDir)) {
                skillSourcesMissingDirs = true;
                missingDirsList.push(source.path);
              }
            }
          });
        }
      } catch (error: unknown) {logger.warn('[Runtime] filesystem operation failed', error);
    skillSourcesValid = false;
  }
    }

    if (!skillSourcesValid) {
      actions.push({
        id: 'repair-skill-sources-config',
        title: 'Repair skill-sources.json configuration',
        command: 'npx tsx scripts/ops-doctor-repair-helper.ts repair-skill-sources',
        reason: skillSourcesMissing ? 'The skill-sources.json configuration file is missing.'
          : 'The skill-sources.json configuration file contains invalid JSON syntax.',
        blocking: false,
        autoFixCommand: {
          command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
          args: ['tsx', 'scripts/ops-doctor-repair-helper.ts', 'repair-skill-sources'],
          cwd: this.projectRoot,
        },
      });
    } else if (skillSourcesMissingDirs) {
      actions.push({
        id: 'create-missing-skill-source-dirs',
        title: 'Create missing skill source directories',
        command: 'npx tsx scripts/ops-doctor-repair-helper.ts repair-skill-sources',
        reason: `Missing enabled local skill source directories: ${missingDirsList.join(', ')}.`,
        blocking: false,
        autoFixCommand: {
          command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
          args: ['tsx', 'scripts/ops-doctor-repair-helper.ts', 'repair-skill-sources'],
          cwd: this.projectRoot,
        },
      });
    }

    if (!input.envFilePresent) {

      actions.push({
        id: 'setup-env',
        title: 'Criar o .env inicial',
        command: 'npm run setup',
        reason: 'Without .env, Zavorth cannot start with reliable minimum configuration.',
        blocking: true,
        autoFixCommand: null,
      });
    }

    if (!telegram?.configured || telegram.readiness !== 'ready') {
      actions.push({
        id: 'prepare-telegram',
        title: 'Preparar o Telegram como canal optional',
        command: 'npm run setup:channels',
        reason: 'Telegram is now optional, but remains the lightest entry point to resume and approve flows from chat.',
        blocking: false,
        autoFixCommand: null,
      });
    }

    if (preparedChannels.length === 0) {
      actions.push({
        id: 'prepare-operator-channels',
        title: 'Preparar channels optional',
        command: 'npm run setup:channels',
        reason: 'After /zavorthControl and the CLI, you can connect the channels you want in the same runtime: Telegram, Discord, Slack, and WhatsApp.',
        blocking: false,
        autoFixCommand: null,
      });
    }

    if (partialChannels.length > 0) {
      actions.push({
        id: 'finish-channel-rollout',
        title: 'Complete configuration for the selected channels',
        command: 'npm run setup:channels',
        reason: `There are still partially configured channels: ${partialChannels.map((entry) => entry.platform).join(', ')}.`,
        blocking: false,
        autoFixCommand: null,
      });
    }

    if (!input.llmCredentialReady) {
      actions.push({
        id: 'configure-llm',
        title: 'Configure a model credential',
        command: 'editar .env',
        reason: this.getProviderCredentialMessage(this.llmProvider),
        blocking: true,
        autoFixCommand: null,
      });
    }

    if (input.supervisedRuntime.installRequired) {
      actions.push({
        id: 'install-dependencies',
        title: 'Instalar dependencies',
        command: 'npm install',
        reason: 'local dependencies are not synchronized with package.json/package-lock.json yet.',
        blocking: true,
        autoFixCommand: {
          command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
          args: ['install'],
          cwd: this.projectRoot,
        },
      });
    }

    if (input.supervisedRuntime.buildRequired) {
      actions.push({
        id: 'build-runtime',
        title: 'Generate runtime build',
        command: 'npm run build',
        reason: 'O build TypeScript is missing ou desatualizado.',
        blocking: false,
        autoFixCommand: {
          command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
          args: ['run', 'build'],
          cwd: this.projectRoot,
        },
      });
    }

    if (!input.supervisedRuntime.accessReadiness.local.ready) {
      const firstBlockingStep = input.supervisedRuntime.accessReadiness.nextSteps.find((step) => step.blocking);
      actions.push({
        id: 'start-supervised-runtime',
        title: 'Subir o Zavorth supervised',
        command: 'npm run dev:supervised',
        reason: firstBlockingStep?.description || 'The local runtime is not ready for continuous use yet.',
        blocking: true,
        autoFixCommand: null,
      });
    }

    for (const step of input.supervisedRuntime.accessReadiness.nextSteps) {
      if (step.id === 'trust-host') {
        actions.push({
          id: 'trust-host',
          title: step.title,
          command: '/hostauth trust',
          reason: step.description,
          blocking: step.blocking,
          autoFixCommand: null,
        });
      }

      if (step.id === 'configure-public-base-url') {
        actions.push({
          id: 'configure-public-base-url',
          title: step.title,
          command: 'definir ZAVORTH_PUBLIC_BASE_URL',
          reason: step.description,
          blocking: step.blocking,
          autoFixCommand: null,
        });
      }

      if (step.id === 'configure-web-token' || step.id === 'dedicate-web-token') {
        actions.push({
          id: step.id,
          title: step.title,
          command: 'definir ZAVORTH_WEB_AUTH_TOKEN',
          reason: step.description,
          blocking: step.blocking,
          autoFixCommand: null,
        });
      }

      if (step.id === 'validate-node-mesh-smoke') {
        actions.push({
          id: 'validate-node-mesh-smoke',
          title: step.title,
          command: nodeMeshSmoke?.command || 'npm run test:nodes:smoke',
          reason: step.description,
          blocking: step.blocking,
          autoFixCommand:
            nodeMeshSmoke?.status === 'running'
              ? null
              : {
                  command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
                  args: ['run', 'test:nodes:smoke'],
                  cwd: this.projectRoot,
                },
        });
      }

      if (step.id === 'validate-channel-providers') {
        actions.push({
          id: 'validate-channel-providers',
          title: step.title,
          command: channelProviderDoctor?.command || 'npm run test:channels:smoke',
          reason: step.description,
          blocking: step.blocking,
          autoFixCommand: {
            command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
            args: ['run', 'test:channels:smoke'],
            cwd: this.projectRoot,
          },
        });
      }

      if (step.id === 'validate-remote-transports') {
        actions.push({
          id: 'validate-remote-transports',
          title: step.title,
          command: remoteTransportDoctor?.command || 'npm run test:transports:smoke',
          reason: step.description,
          blocking: false,
          autoFixCommand:
            remoteTransportDoctor?.status === 'running'
              ? null
              : {
                  command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
                  args: ['run', 'test:transports:smoke'],
                  cwd: this.projectRoot,
                },
        });
      }
    }

    if (this.llmProvider === 'gemini' && !input.supervisedRuntime.accessReadiness.remote.ready) {
      actions.push({
        id: 'oracle-cloudflare-rollout',
        title: 'Plan Oracle + Cloudflare rollout',
        command: 'npm run ops:oracle-cloudflare',
        reason:
          'To expose Zavorth with Gemini/Gemma in a more robust remote architecture, finish the Oracle + Cloudflare rollout.',
        blocking: false,
        autoFixCommand: null,
      });
    }

    return this.dedupeActions(actions);
  }

  private buildSummary(
    envIssues: string[],
    supervisedRuntime: SupervisedRuntimeInspection,
    actions: RuntimeBootstrapAction[],
  ): string {
    if (envIssues.length === 0 && !supervisedRuntime.installRequired && !supervisedRuntime.buildRequired && supervisedRuntime.accessReadiness.local.ready) {
      return supervisedRuntime.accessReadiness.remote.ready ? 'Bootstrap closed: Zavorth ready for usage local e remote.'
        : 'Bootstrap basico closed: Zavorth ready for usage local.';
    }

    const firstBlocking = actions.find((entry) => entry.blocking);
    return `Bootstrap still pending: ${firstBlocking?.reason || 'Operational adjustments still need completion.'}`;
  }

  private resolveLlmCredentialReady(): boolean {
    if (this.llmCredentialReadyOverride !== null) {
      return this.llmCredentialReadyOverride;
    }

    return Boolean(
      config.geminiApiKey
      || config.aiStudioApiKey
      || config.deepseekApiKey
      || config.openaiApiKey
      || (config.openaiApiKeys?.length > 0)
      || config.AIGatewayApiKey
      || config.groqApiKey
      || config.openRouterApiKey
      || config.openCodeApiKey
      || config.puterAuthToken
      || config.stitchApiKey
      || config.stitchAccessToken,
    );
  }

  private getProviderCredentialMessage(provider: string): string {
    switch (provider) {
      case 'gemini':
        return 'missing GEMINI_API_KEY or AISTUDIO_API_KEY for the current provider.';
      case 'deepseek':
        return 'missing DEEPSEEK_API_KEY for the current provider.';
      case 'openai':
        return 'missing OPENAI_API_KEY for the current provider.';
      case 'minimax':
        return 'missing MINIMAX_API_KEY for the current provider.';
      case 'openrouter':
        return 'missing OPENROUTER_API_KEY for the current provider.';
      case 'opencode':
        return 'missing OPENCODE_API_KEY for the current provider.';
      case 'qwen':
        return 'missing PUTER_AUTH_TOKEN or another valid credential for the current provider.';
      case 'AIGateway':
        return 'missing AIGateway_API_KEY or a model credential that AIGateway can use.';
      default:
        return `missing a valid credential for provider ${provider}.`;
    }
  }

  private dedupeActions(actions: RuntimeBootstrapAction[]): RuntimeBootstrapAction[] {
    const seen = new Set<string>();
    return actions.filter((action) => {
      const key = `${action.id}:${action.command}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}
