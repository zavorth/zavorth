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
    this.llmProvider = String(options.llmProvider || config.llmProvider || 'gemini').trim().toLowerCase();
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
      issues.push('O arquivo .env ainda nao foi criado.');
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
        reason: skillSourcesMissing
          ? 'The skill-sources.json configuration file is missing.'
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
        reason: 'Sem .env o Zavorth nao consegue subir com configuracao minima confiavel.',
        blocking: true,
        autoFixCommand: null,
      });
    }

    if (!telegram?.configured || telegram.readiness !== 'ready') {
      actions.push({
        id: 'prepare-telegram',
        title: 'Preparar o Telegram como canal opcional',
        command: 'npm run setup:channels',
        reason: 'Telegram agora e opcional, mas continua sendo a entrada mais leve para retomar e aprovar fluxos quando voce quiser operar pelo chat.',
        blocking: false,
        autoFixCommand: null,
      });
    }

    if (preparedChannels.length === 0) {
      actions.push({
        id: 'prepare-operator-channels',
        title: 'Preparar canais opcionais',
        command: 'npm run setup:channels',
        reason: 'Depois do /zavorthControl e da CLI, voce pode ligar os canais que quiser no mesmo runtime: Telegram, Discord, Slack e WhatsApp.',
        blocking: false,
        autoFixCommand: null,
      });
    }

    if (partialChannels.length > 0) {
      actions.push({
        id: 'finish-channel-rollout',
        title: 'Fechar a configuracao dos canais escolhidos',
        command: 'npm run setup:channels',
        reason: `Ainda ha canais parcialmente configurados: ${partialChannels.map((entry) => entry.platform).join(', ')}.`,
        blocking: false,
        autoFixCommand: null,
      });
    }

    if (!input.llmCredentialReady) {
      actions.push({
        id: 'configure-llm',
        title: 'Configurar uma credencial de modelo',
        command: 'editar .env',
        reason: this.getProviderCredentialMessage(this.llmProvider),
        blocking: true,
        autoFixCommand: null,
      });
    }

    if (input.supervisedRuntime.installRequired) {
      actions.push({
        id: 'install-dependencies',
        title: 'Instalar dependencias',
        command: 'npm install',
        reason: 'As dependencias locais ainda nao estao sincronizadas com package.json/package-lock.json.',
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
        title: 'Gerar build do runtime',
        command: 'npm run build',
        reason: 'O build TypeScript esta ausente ou desatualizado.',
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
        title: 'Subir o Zavorth supervisionado',
        command: 'npm run dev:supervised',
        reason: firstBlockingStep?.description || 'O runtime local ainda nao esta pronto para uso continuo.',
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
        title: 'Planejar rollout Oracle + Cloudflare',
        command: 'npm run ops:oracle-cloudflare',
        reason:
          'Para expor o Zavorth com Gemini/Gemma em uma arquitetura remota mais robusta, falta fechar o rollout Oracle + Cloudflare.',
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
      return supervisedRuntime.accessReadiness.remote.ready
        ? 'Bootstrap fechado: Zavorth pronto para uso local e remoto.'
        : 'Bootstrap basico fechado: Zavorth pronto para uso local.';
    }

    const firstBlocking = actions.find((entry) => entry.blocking);
    return `Bootstrap ainda pendente: ${firstBlocking?.reason || 'Ainda existem ajustes operacionais a concluir.'}`;
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
        return 'Falta configurar GEMINI_API_KEY ou AISTUDIO_API_KEY para o provider atual.';
      case 'deepseek':
        return 'Falta configurar DEEPSEEK_API_KEY para o provider atual.';
      case 'openai':
        return 'Falta configurar OPENAI_API_KEY para o provider atual.';
      case 'minimax':
        return 'Falta configurar MINIMAX_API_KEY para o provider atual.';
      case 'openrouter':
        return 'Falta configurar OPENROUTER_API_KEY para o provider atual.';
      case 'opencode':
        return 'Falta configurar OPENCODE_API_KEY para o provider atual.';
      case 'qwen':
        return 'Falta configurar PUTER_AUTH_TOKEN ou outra credencial valida para o provider atual.';
      case 'AIGateway':
        return 'Falta configurar AIGateway_API_KEY ou uma credencial de modelo que o AIGateway possa usar.';
      default:
        return `Falta configurar uma credencial valida para o provider ${provider}.`;
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
