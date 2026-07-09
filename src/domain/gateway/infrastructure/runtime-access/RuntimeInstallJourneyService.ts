import fs from 'fs';
import path from 'path';
import {
  RuntimeBootstrapRepairService,
  type RuntimeBootstrapRepairReport,
} from '../../../../services/RuntimeBootstrapRepairService.js';
import {
  RuntimeAccessManifestService,
  type RuntimeAccessManifest,
} from './RuntimeAccessManifestService.js';
import { RuntimeStartupService, type RuntimeStartupResult } from '../../../../services/RuntimeStartupService.js';
import { config } from '../../../../config/index.js';


import {
  ChannelInstallScaffoldService,
  type ChannelInstallReport,
} from '../../../../services/ChannelInstallScaffoldService.js';

import { buildZavorthProductModeSnapshot, type ZavorthProductModeSnapshot } from '../../../../services/ProductModeService.js';
import { ProductChannelExperienceService } from '../../../../services/ProductChannelExperienceService.js';

export type RuntimeInstallJourneyPhase = {
  id: string;
  title: string;
  status: 'ready' | 'action' | 'failed' | 'skipped';
  summary: string;
  command: string | null;
  details: string[];
};

export type RuntimeInstallJourneyReport = {
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  bootstrapRepair: RuntimeBootstrapRepairReport;
  startup: RuntimeStartupResult | null;
  manifest: RuntimeAccessManifest;
  phases: RuntimeInstallJourneyPhase[];
  summary: string;
};

type RuntimeInstallJourneyOptions = {
  dryRun?: boolean;
  timeoutMs?: number;
  pollIntervalMs?: number;
  requireMutableAccess?: boolean;
};

type RuntimeInstallJourneyDeps = {
  repairService?: Pick<RuntimeBootstrapRepairService, 'repairLive'>;
  startupService?: Pick<RuntimeStartupService, 'startAndWait'>;
  manifestService?: Pick<RuntimeAccessManifestService, 'buildManifest' | 'buildManifestFromReadiness'>;
  existsSync?: typeof fs.existsSync;
  platform?: NodeJS.Platform;
  appDataDir?: string;
  now?: () => Date;
  channelInstallService?: Pick<ChannelInstallScaffoldService, 'buildReport'>;
  productChannelExperience?: Pick<ProductChannelExperienceService, 'buildSnapshot'>;
};

export class RuntimeInstallJourneyService {
  private readonly repairService: Pick<RuntimeBootstrapRepairService, 'repairLive'> | null;
  private readonly startupService: Pick<RuntimeStartupService, 'startAndWait'> | null;
  private readonly manifestService: Pick<RuntimeAccessManifestService, 'buildManifest' | 'buildManifestFromReadiness'> | null;
  private readonly existsSync: typeof fs.existsSync;
  private readonly platform: NodeJS.Platform;
  private readonly appDataDir: string;
  private readonly runtimeProfile: string;
  private readonly productMode: ZavorthProductModeSnapshot;
  private readonly now: () => Date;
  private readonly channelInstallService: Pick<ChannelInstallScaffoldService, 'buildReport'>;
  private readonly productChannelExperience: Pick<ProductChannelExperienceService, 'buildSnapshot'>;

  constructor(deps: RuntimeInstallJourneyDeps = {}) {
    this.repairService = deps.repairService || null;
    this.startupService = deps.startupService || null;
    this.manifestService = deps.manifestService || null;
    this.existsSync = deps.existsSync || fs.existsSync.bind(fs);
    this.platform = deps.platform || process.platform;
    this.appDataDir = String(deps.appDataDir || process.env.APPDATA || '').trim();
    this.runtimeProfile = String(config.zavorthProfile || 'core').trim().toLowerCase() || 'core';
    this.productMode = buildZavorthProductModeSnapshot(config.zavorthProductMode, this.runtimeProfile);
    this.now = deps.now || (() => new Date());
    this.channelInstallService = deps.channelInstallService || new ChannelInstallScaffoldService();
    this.productChannelExperience = deps.productChannelExperience || new ProductChannelExperienceService();
  }

  public async run(options: RuntimeInstallJourneyOptions = {}): Promise<RuntimeInstallJourneyReport> {
    const dryRun = options.dryRun === true;
    const startedAt = this.now().toISOString();
    const bootstrapRepair = await this.getRepairService().repairLive({ dryRun });

    let startup: RuntimeStartupResult | null = null;
    if (!dryRun) {
      startup = await this.getStartupService().startAndWait({
        timeoutMs: options.timeoutMs,
        pollIntervalMs: options.pollIntervalMs,
        requireMutableAccess: options.requireMutableAccess ?? false,
      });
    }

    const manifest = startup?.manifest
      || (this.getManifestService().buildManifestFromReadiness
        ? this.getManifestService().buildManifestFromReadiness(bootstrapRepair.final.supervisedRuntime.accessReadiness)
        : await this.getManifestService().buildManifest());
    const phases = this.buildPhases(bootstrapRepair, startup, manifest, dryRun);
    const finishedAt = this.now().toISOString();
    return {
      startedAt,
      finishedAt,
      dryRun,
      bootstrapRepair,
      startup,
      manifest,
      phases,
      summary: this.buildSummary(bootstrapRepair, startup, manifest, dryRun),
    };
  }

  private buildPhases(
    repair: RuntimeBootstrapRepairReport,
    startup: RuntimeStartupResult | null,
    manifest: RuntimeAccessManifest,
    dryRun: boolean,
  ): RuntimeInstallJourneyPhase[] {
    const blockingAction = repair.final.actions.find((entry) => entry.blocking);
    const failedRepair = repair.steps.find((entry) => entry.status === 'failed');
    const localReadiness = repair.final.supervisedRuntime.accessReadiness.local;
    const remoteReadiness = repair.final.supervisedRuntime.accessReadiness.remote;
    const localIssues = localReadiness.issues || [];
    const remoteIssues = remoteReadiness.issues || [];
    const officialRemote = manifest.officialRemote;
    const officialRemoteIssues = officialRemote?.issues || [];
    const officialRemoteNextSteps = officialRemote?.nextSteps || [];
    const officialRemoteCommand = officialRemote?.command || manifest.commands.remoteGo;
    const recommendedPlan = manifest.recommendedPlan;
    const launcherShortcutPath = this.resolveWindowsStartupShortcutPath();
    const launcherInstalled = Boolean(launcherShortcutPath && this.existsSync(launcherShortcutPath));
    const channelInstall = this.channelInstallService.buildReport();
    const preparedChannels = channelInstall.channels.filter((entry) => entry.configured || entry.readiness === 'ready');
    const partialChannels = channelInstall.channels.filter((entry) => entry.configured && entry.readiness !== 'ready');
    const telegramPlan = channelInstall.channels.find((entry) => entry.channelId === 'telegram') || null;
    const discordPlan = channelInstall.channels.find((entry) => entry.channelId === 'discord') || null;
    const channelExperience = this.productChannelExperience.buildSnapshot({
      productMode: this.productMode,
      controlEntry: manifest.local.appUrl,
      controlReady: manifest.local.ready,
      telegramReady: Boolean(telegramPlan && (telegramPlan.configured || telegramPlan.readiness === 'ready')),
      discordReady: Boolean(discordPlan && (discordPlan.configured || discordPlan.readiness === 'ready')),
      cliEntry: 'zavorth status',
      cliReady: true,
    });
    const nextStep = this.buildRecommendedNextStep({
      blockingAction,
      manifest,
      recommendedPlan,
      officialRemoteCommand,
      officialRemoteIssues,
      officialRemoteNextSteps,
      localIssues,
      remoteIssues,
    });

    return [
      {
        id: 'go',
        title: 'Atalho oficial em um comando',
        status: manifest.local.ready ? 'ready' : 'action',
        summary: manifest.local.ready
          ? `O atalho oficial ja deixaria o shell web do runtime pronto em ${manifest.local.appUrl}.`
          : 'Use um unico comando para instalar, confiar no host, abrir a melhor superficie e revisar o acesso.',
        command: manifest.local.ready ? null : manifest.commands.go,
        details: [
          `Shell web do runtime: ${manifest.local.appUrl}`,
          manifest.remote.appUrl
            ? `Shell web remoto: ${manifest.remote.appUrl}`
            : 'Shell web remoto ainda depende de URL publica HTTPS.',
        ],
      },
      {
        id: 'bootstrap',
        title: dryRun ? 'Plano de bootstrap' : 'Bootstrap e correcoes seguras',
        status: failedRepair
          ? 'failed'
          : (repair.final.actions.length === 0 ? 'ready' : (dryRun ? 'action' : 'ready')),
        summary: repair.summary,
        command: failedRepair || repair.final.actions.length > 0 ? 'npm run ops:bootstrap -- --repair' : null,
        details: repair.final.actions.slice(0, 3).map((entry) => `${entry.title}: ${entry.reason}`),
      },
      {
        id: 'startup',
        title: 'Subida do runtime',
        status: manifest.local.ready
          ? 'ready'
          : (dryRun ? 'action' : (startup?.ok ? 'ready' : 'failed')),
        summary: manifest.local.ready
          ? `Runtime local pronto em ${manifest.local.appUrl}.`
          : (dryRun
            ? 'Dry-run: use o comando oficial para subir o runtime supervisionado.'
            : (startup?.summary || 'O runtime ainda nao ficou pronto.')),
        command: manifest.local.ready ? null : manifest.commands.start,
        details: localIssues.slice(0, 3),
      },
      {
        id: 'gateway-ui',
        title: 'Gateway e ZavorthControl',
        status: manifest.local.ready ? 'ready' : 'action',
        summary: manifest.local.ready
          ? 'Gateway local e ZavorthControl session-first prontos no /zavorthControl, com WebSocket como plano principal.'
          : 'Suba o runtime para destravar o Gateway local, a ZavorthControl e o plano de controle em tempo real.',
        command: manifest.local.ready ? null : manifest.commands.go,
        details: [
          `Gateway local: ${manifest.local.apiBaseUrl || `${manifest.local.baseUrl}/api/web`}`,
          `ZavorthControl: ${manifest.local.appUrl}`,
          'O Gateway centraliza sessao, approvals, capabilities, artifacts, diffs e selfmod.',
        ],
      },
      {
        id: 'launcher',
        title: 'Startup opcional do Windows',
        status: this.platform !== 'win32'
          ? 'skipped'
          : (launcherInstalled ? 'ready' : 'skipped'),
        summary: this.platform !== 'win32'
          ? 'Startup automatico hoje so e suportado pelo instalador oficial do Windows.'
          : (launcherInstalled
            ? 'O Startup automatico esta ativo neste host. Use o comando oficial de remocao para desligar isso quando quiser.'
            : 'O Startup automatico segue desligado neste host. Esse e o comportamento recomendado para uso diario local.'),
        command: null,
        details: launcherShortcutPath
          ? launcherInstalled
            ? [launcherShortcutPath, `Desligar: ${manifest.commands.startupLauncherRemove}`]
            : [launcherShortcutPath, `Habilitar conscientemente: ${manifest.commands.startupLauncher}`]
          : [],
      },
      {
        id: 'local-access',
        title: 'Acesso local oficial',
        status: manifest.local.ready ? 'ready' : 'action',
        summary: manifest.local.ready
          ? `App local pronto em ${manifest.local.appUrl}.`
          : (localIssues[0] || 'O acesso local ainda nao ficou pronto.'),
        command: manifest.local.ready ? null : manifest.commands.access,
        details: [
          `Shell web do runtime: ${manifest.local.appUrl}`,
          `Painel legado: ${manifest.local.zavorthControlUrl}`,
          ...localIssues.slice(0, 2),
        ],
      },
      {
        id: 'product-mode',
        title: 'Modo de produto',
        status: 'ready',
        summary: `Modo atual: ${this.productMode.id}. ${this.productMode.summary}`,
        command: 'npm run mode:status',
        details: [
          `Label: ${this.productMode.label}.`,
          `Perfil base recomendado para este modo: ${this.productMode.defaultRuntimeProfile}.`,
          `Perfil ativo agora: ${this.productMode.runtimeProfile}.`,
          `Trocar modo: npm run mode:use -- <chat|assistant|builder|operator>`,
          'Os perfis core|ops|full continuam existindo por baixo, mas o onboarding novo conversa em linguagem de produto.',
        ],
      },
      {
        id: 'profiles-and-packs',
        title: 'Perfis e packs opcionais',
        status: 'ready',
        summary: `Perfil atual: ${this.runtimeProfile}. O modo ${this.productMode.id} usa ${this.productMode.defaultRuntimeProfile} como baseline. Use core no dia a dia, ops para manutencao e full so quando quiser toda a stack avancada ligada.`,
        command: 'npm run profile:status',
        details: [
          'Perfis oficiais: core, ops e full.',
          'Ver modo de produto: npm run mode:status',
          'Recomendacao diaria: core.',
          'Use ops para maintenance/daily report e full apenas por escolha explicita.',
          'Ver perfis: npm run profile:status',
          'Trocar conscientemente: npm run profile:use -- --profile=ops',
          'Skills base e catalogo: npm run skills:registry',
          'Browser stack opcional: npm run mcp:browser:doctor',
        ],
      },
      {
        id: 'companions-and-presets',
        title: 'Companions e presets leves',
        status: 'ready',
        summary: 'WSL, Docker Desktop e IDEs companheiras agora entram no onboarding oficial com doctor e preset leve supervisionado.',
        command: 'npm run ops:doctor:desktop',
        details: [
          'Doctor de recursos: npm run ops:doctor:desktop',
          'Workspace doctor: npm run ops:workspace:doctor',
          'Preset leve para ZavorthBridge/VS Code: npm run ops:workspace:optimize -- zavorthBridge',
          'Inspecionar companions: npm run ops:companions',
        ],
      },
      {
        id: 'channels',
        title: 'Jornadas de canal',
        status: partialChannels.length > 0
          ? 'action'
          : channelExperience.recommendedJourney === 'web+telegram'
            ? 'ready'
            : 'action',
        summary: partialChannels.length > 0
          ? `Jornada recomendada: ${channelExperience.recommendedJourney}. Ainda ha canais parciais: ${partialChannels.map((entry) => entry.label).join(', ')}.`
          : channelExperience.recommendedJourney === 'web+telegram'
            ? 'Jornada recomendada pronta: web+telegram. O /zavorthControl segue como centro e Telegram vira o primeiro canal externo.'
            : 'Jornada recomendada agora: web-only. Quando quiser um canal externo, comece pelo Telegram.',
        command: partialChannels.length > 0 || channelExperience.recommendedJourney !== 'web+telegram'
          ? manifest.commands.channels
          : null,
        details: [
          `Entrada principal do produto: ${manifest.local.appUrl}`,
          `Jornada recomendada: ${channelExperience.recommendedJourney}.`,
          telegramPlan
            ? `Telegram: ${telegramPlan.readiness} em ${telegramPlan.currentMode || telegramPlan.recommendedMode}.`
            : 'Telegram ainda nao foi preparado neste host.',
          'Telegram e o primeiro canal externo recomendado para retomar, aprovar e disparar workflows.',
          this.productMode.id === 'chat' || this.productMode.id === 'assistant'
            ? 'Discord, Slack e WhatsApp ficam escondidos por padrao nos modos basicos.'
            : 'Discord, Slack e WhatsApp seguem opcionais e entram so quando a tarefa realmente pedir.',
        ],
      },
      {
        id: 'remote-access',
        title: 'Acesso remoto oficial',
        status: manifest.remote.ready ? 'ready' : 'action',
        summary: manifest.remote.ready
          ? `Shell web remoto pronto em ${manifest.remote.appUrl || manifest.remote.baseUrl || 'URL publica atual'}.`
          : (officialRemote?.summary || remoteIssues[0] || 'O acesso remoto ainda nao ficou pronto.'),
        command: manifest.remote.ready ? null : officialRemoteCommand,
        details: [
          officialRemote?.appUrl
            ? `Shell web remoto: ${officialRemote.appUrl}`
            : (manifest.remote.appUrl
              ? `Shell web remoto previsto: ${manifest.remote.appUrl}`
              : 'Defina uma URL publica HTTPS para o runtime.'),
          ...officialRemoteNextSteps.slice(0, 2),
          ...officialRemoteIssues.slice(0, 2),
          ...remoteIssues.slice(0, 1),
        ],
      },
      {
        id: 'next-step',
        title: nextStep.title,
        status: nextStep.command ? 'action' : 'ready',
        summary: nextStep.summary,
        command: nextStep.command,
        details: nextStep.details,
      },
    ];
  }

  private buildRecommendedNextStep(input: {
    blockingAction: RuntimeBootstrapRepairReport['final']['actions'][number] | undefined;
    manifest: RuntimeAccessManifest;
    recommendedPlan: RuntimeAccessManifest['recommendedPlan'] | undefined;
    officialRemoteCommand: string;
    officialRemoteIssues: string[];
    officialRemoteNextSteps: string[];
    localIssues: string[];
    remoteIssues: string[];
  }): RuntimeInstallJourneyPhase {
    const {
      blockingAction,
      manifest,
      recommendedPlan,
      officialRemoteCommand,
      officialRemoteIssues,
      officialRemoteNextSteps,
      localIssues,
      remoteIssues,
    } = input;

    if (blockingAction) {
      return {
        id: 'next-step',
        title: 'Proximo passo',
        status: 'action',
        summary: `${blockingAction.title}: ${blockingAction.reason}`,
        command: blockingAction.command,
        details: manifest.nextSteps.slice(0, 3).map((entry) => `${entry.title}: ${entry.description}`),
      };
    }

    if (manifest.local.ready && !manifest.remote.ready) {
      return {
        id: 'next-step',
        title: 'Fechar acesso remoto oficial',
        status: 'action',
        summary:
          manifest.officialRemote?.summary
          || recommendedPlan?.remoteRecommendation.summary
          || remoteIssues[0]
          || 'Feche o acesso remoto oficial para liberar o shell remoto fora da maquina local.',
        command: officialRemoteCommand,
        details: [
          manifest.remote.appUrl
            ? `Shell web remoto previsto: ${manifest.remote.appUrl}`
            : 'Ainda falta uma URL publica HTTPS para o runtime.',
          ...(recommendedPlan?.remoteRecommendation.nextSteps || officialRemoteNextSteps).slice(0, 2),
          ...officialRemoteIssues.slice(0, 2),
          ...remoteIssues.slice(0, 1),
        ],
      };
    }

    if (recommendedPlan) {
      const details = this.buildRecommendedPlanDetails(
        manifest,
        recommendedPlan,
        officialRemoteCommand,
        officialRemoteIssues,
        officialRemoteNextSteps,
        localIssues,
        remoteIssues,
      );
      return {
        id: 'next-step',
        title: this.getRecommendedPlanTitle(recommendedPlan.primaryAction),
        status: recommendedPlan.primaryCommand ? 'action' : 'ready',
        summary: recommendedPlan.primarySummary || manifest.summary,
        command: recommendedPlan.primaryCommand || null,
        details,
      };
    }

    return {
      id: 'next-step',
      title: 'Proximo passo',
      status: manifest.local.ready ? 'ready' : 'action',
      summary: manifest.summary || 'Continue o caminho oficial do Zavorth.',
      command: manifest.local.ready ? null : manifest.commands.go,
      details: manifest.nextSteps.slice(0, 3).map((entry) => `${entry.title}: ${entry.description}`),
    };
  }

  private buildRecommendedPlanDetails(
    manifest: RuntimeAccessManifest,
    recommendedPlan: NonNullable<RuntimeAccessManifest['recommendedPlan']>,
    officialRemoteCommand: string,
    officialRemoteIssues: string[],
    officialRemoteNextSteps: string[],
    localIssues: string[],
    remoteIssues: string[],
  ): string[] {
    if (recommendedPlan.primaryAction === 'remote') {
      return [
        recommendedPlan.openTarget
          ? `Shell web remoto: ${recommendedPlan.openTarget}`
          : (manifest.remote.appUrl
            ? `Shell web remoto previsto: ${manifest.remote.appUrl}`
            : 'Ainda falta uma URL publica HTTPS para o runtime.'),
        ...(recommendedPlan.remoteRecommendation.nextSteps || officialRemoteNextSteps).slice(0, 2),
        ...officialRemoteIssues.slice(0, 2),
        ...remoteIssues.slice(0, 1),
      ];
    }

    if (recommendedPlan.primaryAction === 'trust') {
      return [
        `Shell web do runtime: ${manifest.local.appUrl}`,
        'Depois disso, o host atual volta a poder executar escrita local e entregas persistidas.',
        ...localIssues.slice(0, 1),
      ];
    }

    if (recommendedPlan.primaryAction === 'go') {
      return [
        `Comando oficial: ${recommendedPlan.primaryCommand || manifest.commands.go}`,
        `Shell web do runtime: ${manifest.local.appUrl}`,
        recommendedPlan.remoteRecommendation.appUrl
          ? `Shell web remoto: ${recommendedPlan.remoteRecommendation.appUrl}`
          : 'O shell web remoto ainda sera validado pelo mesmo fluxo.',
      ];
    }

    if (recommendedPlan.primaryAction === 'open-local') {
      return [
        `Shell web do runtime: ${recommendedPlan.openTarget || manifest.local.appUrl}`,
        `Shell remoto: ${recommendedPlan.remoteRecommendation.ready ? 'pronto' : 'pendente'}${recommendedPlan.remoteRecommendation.appUrl ? ` em ${recommendedPlan.remoteRecommendation.appUrl}` : ''}.`,
        `Se quiser revisar o rollout remoto, use ${officialRemoteCommand}.`,
      ];
    }

    return manifest.nextSteps.slice(0, 3).map((entry) => `${entry.title}: ${entry.description}`);
  }

  private getRecommendedPlanTitle(
    action: NonNullable<RuntimeAccessManifest['recommendedPlan']>['primaryAction'],
  ): string {
    if (action === 'go') {
      return 'Seguir caminho oficial';
    }
    if (action === 'trust') {
      return 'Liberar este host';
    }
    if (action === 'remote') {
      return 'Fechar acesso remoto oficial';
    }
    if (action === 'open-local') {
      return 'Abrir shell web do runtime';
    }
    return 'Proximo passo';
  }

  private buildSummary(
    repair: RuntimeBootstrapRepairReport,
    startup: RuntimeStartupResult | null,
    manifest: RuntimeAccessManifest,
    dryRun: boolean,
  ): string {
    if (dryRun) {
      return manifest.summary || repair.summary;
    }

    if (!startup) {
      return manifest.summary || repair.summary;
    }

    if (!startup.ok) {
      return startup.summary;
    }

    return manifest.summary || startup.manifest.summary;
  }

  private resolveWindowsStartupShortcutPath(): string | null {
    if (this.platform !== 'win32') {
      return null;
    }

    if (!this.appDataDir) {
      return null;
    }

    return path.join(
      this.appDataDir,
      'Microsoft',
      'Windows',
      'Start Menu',
      'Programs',
      'Startup',
      'Zavorth Supervisionado.lnk',
    );
  }

  private getRepairService(): Pick<RuntimeBootstrapRepairService, 'repairLive'> {
    return this.repairService || new RuntimeBootstrapRepairService();
  }

  private getStartupService(): Pick<RuntimeStartupService, 'startAndWait'> {
    return this.startupService || new RuntimeStartupService();
  }

  private getManifestService(): Pick<RuntimeAccessManifestService, 'buildManifest' | 'buildManifestFromReadiness'> {
    return this.manifestService || new RuntimeAccessManifestService();
  }
}

