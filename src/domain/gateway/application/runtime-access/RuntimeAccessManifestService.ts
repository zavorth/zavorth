import { RuntimeAccessReadinessService, type RuntimeAccessReadinessReport } from './RuntimeAccessReadinessService.js';
import { DiscordGatewayRepairFlowService } from '../../../../services/DiscordGatewayRepairFlowService.js';
import { GatewayHealthRenewalService } from '../../../../services/GatewayHealthRenewalService.js';
import { config } from '../../../../config/index.js';
import { buildZavorthProductModeSnapshot } from '../../../../services/ProductModeService.js';
import { ProductChannelExperienceService } from '../../../../services/ProductChannelExperienceService.js';
import { LegacySurfaceContainmentService } from '../../../../services/LegacySurfaceContainmentService.js';
import type { LegacySurfaceContainmentSnapshot } from '../../../../contracts/LegacySurfaceContract.js';
import {
  RuntimeOfficialRemoteAccessService,
  type RuntimeOfficialRemoteAccessReport,
} from './RuntimeOfficialRemoteAccessService.js';

export type RuntimeAccessManifest = {
  generatedAt: string;
  summary: string;
  local: {
    ready: boolean;
    baseUrl: string;
    appUrl: string;
    dashboardUrl: string;
    apiBaseUrl: string;
    controlUrl: string;
    legacyAppUrl: string;
    classicUrl: string;
  };
  remote: {
    ready: boolean;
    baseUrl: string | null;
    appUrl: string | null;
    requiresHttps: boolean;
    controlUrl: string | null;
    legacyAppUrl: string | null;
    classicUrl: string | null;
  };
  auth: {
    required: boolean;
    source: RuntimeAccessReadinessReport['auth']['source'];
    tokenFile: string;
    authorizedHost: boolean | null;
  };
  officialRemote: {
    ready: boolean;
    summary: string;
    recommendedProvider: RuntimeOfficialRemoteAccessReport['rollout']['recommendedId'];
    recommendedAction: RuntimeOfficialRemoteAccessReport['actions']['recommendedAction'];
    appUrl: string | null;
    baseUrl: string | null;
    issues: string[];
    nextSteps: string[];
    command: string;
  };
  commands: {
    go: string;
    install: string;
    launcher: string;
    startupLauncher: string;
    startupLauncherRemove: string;
    bootstrap: string;
    journey: string;
    channels: string;
    ready: string;
    start: string;
    access: string;
    remote: string;
    remoteGo: string;
    manifest: string;
    trust: string;
  };
  launchers: Array<{
    id: 'best' | 'local-control' | 'remote-control' | 'telegram' | 'discord' | 'classic' | 'cli';
    label: string;
    description: string;
    kind: 'url' | 'command';
    value: string;
    ready: boolean;
    primary: boolean;
  }>;
  journey: Array<{
    id: string;
    title: string;
    description: string;
    command: string | null;
    status: 'ready' | 'action' | 'optional';
  }>;
  surfaces: Array<{
    id: 'control' | 'telegram' | 'discord' | 'classic' | 'cli';
    label: string;
    surface: 'web' | 'telegram' | 'discord' | 'cli';
    primary: boolean;
    ready: boolean;
    entry: string;
    remoteEntry: string | null;
    description: string;
  }>;
  guides: {
    local: string[];
    remote: string[];
  };
  legacyContainment: LegacySurfaceContainmentSnapshot;
  warnings: string[];
  nextSteps: RuntimeAccessReadinessReport['nextSteps'];
  recommendedPlan?: {
    primaryAction: 'go' | 'trust' | 'remote' | 'open-local';
    primaryLabel: string;
    primarySummary: string;
    primaryCommand: string | null;
    openTarget: string | null;
    launcherRecommendation: {
      command: string;
      summary: string;
    };
    remoteRecommendation: {
      ready: boolean;
      command: string;
      appUrl: string | null;
      summary: string;
      nextSteps: string[];
    };
  };
};

export class RuntimeAccessManifestService {
  private readonly providedReadinessService: Pick<RuntimeAccessReadinessService, 'inspectLive'> | null;
  private readonly providedOfficialRemoteAccessService: Pick<RuntimeOfficialRemoteAccessService, 'inspect'> | null;
  private readonly discordGatewayRepairFlowService: DiscordGatewayRepairFlowService;
  private readonly gatewayHealthRenewalService: GatewayHealthRenewalService;
  private readonly productChannelExperienceService: ProductChannelExperienceService;
  private readonly legacySurfaceContainmentService: LegacySurfaceContainmentService;

  constructor(
    readinessService?: Pick<RuntimeAccessReadinessService, 'inspectLive'>,
    officialRemoteAccessService?: Pick<RuntimeOfficialRemoteAccessService, 'inspect'>,
  ) {
    this.providedReadinessService = readinessService || null;
    this.providedOfficialRemoteAccessService = officialRemoteAccessService || null;
    this.discordGatewayRepairFlowService = new DiscordGatewayRepairFlowService({
      capabilityLifecycleStateFile: config.capabilityLifecycleStateFile,
      discordRequiredOnBoot: config.discordRequiredOnBoot,
    });
    this.gatewayHealthRenewalService = new GatewayHealthRenewalService();
    this.productChannelExperienceService = new ProductChannelExperienceService();
    this.legacySurfaceContainmentService = new LegacySurfaceContainmentService();
  }

  public async buildManifest(): Promise<RuntimeAccessManifest> {
    const [readiness, officialRemote] = await Promise.all([
      this.getReadinessService().inspectLive(),
      this.getOfficialRemoteAccessService().inspect({
        dryRun: true,
        requireMutableAccess: false,
      }),
    ]);
    return this.buildManifestFromReadiness(readiness, officialRemote);
  }

  public buildManifestFromReadiness(
    readiness: RuntimeAccessReadinessReport,
    officialRemote: RuntimeOfficialRemoteAccessReport | null = null,
  ): RuntimeAccessManifest {
    const discordRepair = this.discordGatewayRepairFlowService.inspect(readiness.runtime.discordBridge);
    const healthRenewal = this.gatewayHealthRenewalService.inspect(readiness);
    const productMode = buildZavorthProductModeSnapshot(config.zavorthProductMode, config.zavorthProfile);
    const channelExperience = this.productChannelExperienceService.buildSnapshot({
      productMode,
      controlEntry: readiness.local.dashboardUrl || readiness.local.appUrl,
      controlReady: readiness.local.ready,
      telegramReady: Boolean(readiness.runtime.telegramWorker?.alive),
      discordReady: Boolean(readiness.runtime.discordBridge.enabled && readiness.runtime.discordBridge.started),
      classicEntry: `${readiness.local.baseUrl}/classic`,
      classicReady: false,
      cliEntry: 'zavorth status',
      cliReady: true,
    });
    const remoteRequiresHttps = Boolean(
      readiness.remote.baseUrl && !String(readiness.remote.baseUrl).toLowerCase().startsWith('https://'),
    );
    const legacyContainment = this.legacySurfaceContainmentService.buildSnapshot({
      localBaseUrl: readiness.local.baseUrl,
      remoteBaseUrl: readiness.remote.baseUrl,
      now: readiness.checkedAt,
    });
    const productGoCommand = 'zavorth go';
    const officialRemoteReady = officialRemote?.remote?.ready === true || readiness.remote.ready;
    const officialRemoteCommand = productGoCommand;
    const recommendedPlan = this.buildRecommendedPlan(readiness, {
      ready: officialRemoteReady,
      summary: String(
        officialRemote?.summary
        || (readiness.remote.ready
          ? 'Acesso remoto oficial pronto.'
          : 'Acesso remoto oficial ainda pede rollout guiado.'),
      ).trim(),
      appUrl: officialRemote?.remote?.appUrl || readiness.remote.appUrl || null,
      command: officialRemoteCommand,
      nextSteps: Array.isArray(officialRemote?.nextSteps) ? officialRemote.nextSteps : [],
    });

    return {
      generatedAt: readiness.checkedAt,
      summary: readiness.summary,
      local: {
        ready: readiness.local.ready,
        baseUrl: readiness.local.baseUrl,
        appUrl: readiness.local.appUrl,
        dashboardUrl: readiness.local.dashboardUrl,
        apiBaseUrl: `${readiness.local.baseUrl}/api/web`,
        controlUrl: legacyContainment.links.localDashboardUrl,
        legacyAppUrl: legacyContainment.links.localLegacyAppUrl,
        classicUrl: legacyContainment.links.localClassicUrl,
      },
      remote: {
        ready: readiness.remote.ready,
        baseUrl: readiness.remote.baseUrl,
        appUrl: readiness.remote.appUrl,
        requiresHttps: remoteRequiresHttps,
        controlUrl: legacyContainment.links.remoteDashboardUrl,
        legacyAppUrl: legacyContainment.links.remoteLegacyAppUrl,
        classicUrl: legacyContainment.links.remoteClassicUrl,
      },
      auth: {
        required: readiness.auth.enabled,
        source: readiness.auth.source,
        tokenFile: readiness.auth.tokenFile,
        authorizedHost: readiness.runtime.hostAuthorized,
      },
      officialRemote: {
        ready: officialRemoteReady,
        summary: String(
          officialRemote?.summary
          || (readiness.remote.ready
            ? 'Acesso remoto oficial pronto.'
            : 'Acesso remoto oficial ainda pede rollout guiado.'),
        ).trim(),
        recommendedProvider: officialRemote?.rollout?.recommendedId || null,
        recommendedAction: officialRemote?.actions?.recommendedAction || null,
        appUrl: officialRemote?.remote?.appUrl || readiness.remote.appUrl || null,
        baseUrl: officialRemote?.remote?.baseUrl || readiness.remote.baseUrl || null,
        issues: Array.isArray(officialRemote?.remote?.issues) ? officialRemote.remote.issues : [],
        nextSteps: Array.isArray(officialRemote?.nextSteps) ? officialRemote.nextSteps : [],
        command: officialRemoteCommand,
      },
      commands: {
        go: 'zavorth go',
        install: 'npm run ops:install -- --trust-local --launcher --open-best',
        launcher: 'npm run launcher:install',
        startupLauncher: 'npm run launcher:startup:install',
        startupLauncherRemove: 'npm run launcher:startup:remove',
        bootstrap: 'npm run ops:bootstrap -- --repair',
        journey: 'npm run ops:journey',
        channels: 'npm run setup:channels',
        ready: 'npm run ops:ready -- --trust-local',
        start: 'npm run ops:start',
        access: 'npm run ops:access',
        remote: 'npm run ops:remote:official',
        remoteGo: 'npm run ops:remote:go',
        manifest: 'npm run ops:manifest',
        trust: '/hostauth trust',
      },
      launchers: [
        {
          id: 'best',
          label: recommendedPlan.primaryLabel || 'Melhor entrada agora',
          description: recommendedPlan.primarySummary
            || (readiness.local.ready
              ? 'Abre o dashboard local. O terminal Zavorth continua disponivel como superficie rapida de operacao.'
              : readiness.remote.ready
                ? 'Abre o dashboard remoto enquanto o host local ainda fecha a prontidao.'
                : 'Use o atalho oficial em um comando para preparar a melhor superficie.'),
          kind: recommendedPlan.primaryCommand ? 'command' : 'url',
          value: recommendedPlan.primaryCommand
            || recommendedPlan.openTarget
            || readiness.local.appUrl
            || readiness.remote.appUrl
            || 'zavorth go',
          ready: !recommendedPlan.primaryCommand && Boolean(recommendedPlan.openTarget),
          primary: true,
        },
        {
          id: 'local-control',
          label: 'Dashboard',
          description: 'Abre o dashboard/gateway principal servido pelo runtime local.',
          kind: 'url',
          value: readiness.local.appUrl,
          ready: readiness.local.ready,
          primary: false,
        },
        {
          id: 'remote-control',
          label: 'Dashboard remoto',
          description: readiness.remote.ready
            ? 'Abre o dashboard remoto ja validado para este runtime.'
            : 'Feche primeiro o rollout remoto oficial para abrir o dashboard remoto.',
          kind: readiness.remote.appUrl ? 'url' : 'command',
          value: readiness.remote.appUrl || productGoCommand,
          ready: readiness.remote.ready,
          primary: false,
        },
        {
          id: 'telegram',
          label: 'Telegram',
          description: 'Primeiro canal externo recomendado para retomar, aprovar e disparar workflows.',
          kind: 'command',
          value: '/start',
          ready: Boolean(readiness.runtime.telegramWorker?.alive),
          primary: false,
        },
        {
          id: 'discord',
          label: 'Discord',
          description: readiness.runtime.discordBridge.started
            ? 'Entrada remota para conversar, aprovar e retomar workflows no canal oficial.'
            : 'Configure o canal oficial do Discord antes de operar por la.',
          kind: 'command',
          value: '/status',
          ready: Boolean(readiness.runtime.discordBridge.enabled && readiness.runtime.discordBridge.started),
          primary: false,
        },
        {
          id: 'cli',
          label: 'CLI',
          description: 'Entrada rapida para diagnostico, operacao e automacao local.',
          kind: 'command',
          value: 'zavorth status',
          ready: true,
          primary: false,
        },
      ],
      journey: [
        {
          id: 'go',
          title: 'Atalho oficial em um comando',
          description: readiness.local.ready
            ? `O atalho oficial ja deixaria o dashboard pronto em ${readiness.local.appUrl}.`
            : 'Use um unico comando para instalar, confiar no host, abrir a melhor superficie e validar o runtime.',
          command: readiness.local.ready ? null : 'zavorth go',
          status: readiness.local.ready ? 'ready' : 'action',
        },
        {
          id: 'install',
          title: 'Instalar e reparar o ambiente',
          description: 'Fecha dependencias, build e correcoes seguras, instala o launcher e abre a melhor superficie pronta.',
          command: readiness.local.ready ? null : productGoCommand,
          status: readiness.local.ready ? 'ready' : 'action',
        },
        {
          id: 'start',
          title: 'Subir o runtime supervisionado',
          description: readiness.local.ready
            ? `Runtime local pronto em ${readiness.local.appUrl}.`
            : 'Abre a melhor superficie oficial e espera o /dashboard responder de verdade.',
          command: readiness.local.ready ? null : productGoCommand,
          status: readiness.local.ready ? 'ready' : 'action',
        },
        {
          id: 'trust',
          title: 'Liberar execucao mutavel neste host',
          description: readiness.runtime.hostAuthorized === false
            ? 'Autorize o host antes de escrita, execucao local ou entregas persistidas.'
            : 'O host atual ja esta autorizado para execucoes mutaveis.',
          command: readiness.runtime.hostAuthorized === false ? '/hostauth trust' : null,
          status: readiness.runtime.hostAuthorized === false ? 'action' : 'ready',
        },
        {
          id: 'remote',
          title: 'Conectar uma superficie remota',
          description: readiness.remote.ready
            ? `Dashboard remoto pronto para usar ${readiness.remote.appUrl || 'a URL publica atual'}.`
            : 'Rode o atalho oficial em um comando para validar o remoto e abrir o melhor dashboard disponivel.',
          command: readiness.remote.ready ? null : productGoCommand,
          status: readiness.remote.ready ? 'ready' : 'optional',
        },
        {
          id: 'channels',
          title: 'Fechar a jornada web+telegram',
          description: channelExperience.recommendedJourney === 'web+telegram'
            ? 'Dashboard e Telegram ja cobrem a jornada principal deste runtime. Os outros canais seguem sob demanda.'
            : 'Comece pelo web-only no /dashboard. Quando quiser um canal externo, conecte Telegram antes dos demais.',
          command: 'npm run setup:channels',
          status: 'optional',
        },
      ],
      surfaces: [
        {
          id: 'control',
          label: 'Dashboard',
          surface: 'web',
          primary: true,
          ready: readiness.local.ready,
          entry: readiness.local.appUrl,
          remoteEntry: readiness.remote.appUrl,
          description: 'Surface principal para chat, approvals, artifacts, diffs e runtime.',
        },
        {
          id: 'telegram',
          label: 'Telegram',
          surface: 'telegram',
          primary: false,
          ready: Boolean(readiness.runtime.telegramWorker?.alive),
          entry: '/start',
          remoteEntry: null,
          description: 'Primeiro canal externo recomendado para retomar, aprovar e disparar workflows.',
        },
        ...(channelExperience.visibleSurfaces.includes('discord') ? [{
          id: 'discord' as const,
          label: 'Discord',
          surface: 'discord' as const,
          primary: false,
          ready: Boolean(readiness.runtime.discordBridge.enabled && readiness.runtime.discordBridge.started),
          entry: '/status',
          remoteEntry: null,
          description: readiness.runtime.discordBridge.mode === 'native'
            ? 'Canal oficial para operar o Zavorth em servidor ou DM quando o gateway nativo estiver pronto.'
            : 'Canal oficial via bridge para retomar, aprovar e disparar workflows quando o relay estiver saudavel.',
        }] : []),
        ...(channelExperience.visibleSurfaces.includes('cli') ? [{
          id: 'cli' as const,
          label: 'CLI',
          surface: 'cli' as const,
          primary: false,
          ready: true,
          entry: 'zavorth status',
          remoteEntry: null,
          description: 'Superficie rapida para diagnostico, operacao e automacao local.',
        }] : []),
      ],
      guides: {
        local: [
          'Use zavorth go como caminho oficial mais curto para instalar, subir e abrir o Zavorth.',
          'Use npm run ops:journey para revisar a jornada oficial de instalacao e acesso.',
          'Comece pela jornada web-only no /dashboard e trate Telegram como o primeiro canal externo recomendado.',
          'Use /app e /classic apenas com flag legada de manutencao; produto novo deve entrar no dashboard e na Runtime API.',
          'Use npm run setup:channels para fechar a jornada web+Telegram antes de pensar em Discord, Slack ou WhatsApp.',
          'Use npm run channels:install -- --json quando quiser inspecionar o panorama atual e os modos recomendados de cada canal.',
          'Se quiser o caminho completo com launcher, trust local e abertura automatica, use zavorth go.',
          `Use zavorth go para subir o runtime e abrir ${readiness.local.appUrl}.`,
          'No Windows, o Startup oficial e opcional e segue bloqueado por padrao; so habilite conscientemente se quiser login automatico.',
          'Use o dashboard como superficie principal para conversar, aprovar e operar o Zavorth.',
          'Use o terminal Zavorth como superficie rapida para diagnostico, automacao e fallback local.',
          readiness.runtime.discordBridge.enabled
            ? (discordRepair.status === 'attention'
              ? `${discordRepair.summary} ${discordRepair.nextStep || ''}`.trim()
              : 'Se o canal oficial do Discord estiver pronto, use /status para validar a entrada remota antes de operar por la.')
            : 'Configure o canal oficial do Discord se quiser uma superficie remota adicional alem de Telegram e web.',
          healthRenewal.status === 'renewal_recommended'
            ? `${healthRenewal.summary} Comandos uteis: ${healthRenewal.commands.slice(0, 3).join(' | ')}.`
            : 'Os checks leves de health do gateway estao frescos.',
          readiness.runtime.hostAuthorized === false
            ? 'Autorize este host com /hostauth trust antes de executar acoes mutaveis.'
            : 'Este host ja esta autorizado para execucoes mutaveis.',
        ],
        remote: [
          'Use npm run ops:journey para revisar a sequencia oficial entre runtime local, trust e dashboard remoto.',
          'Mantenha o fluxo remoto em web-first e adicione Telegram como primeiro canal externo recomendado.',
          'Use npm run setup:channels para preparar Telegram antes de abrir canais remotos secundarios no mesmo runtime.',
          'Use npm run channels:install -- --json para revisar modos, webhooks e proximos passos sem aplicar nada.',
          'Use zavorth go para aplicar o rollout guiado, validar e abrir o melhor dashboard disponivel.',
          readiness.remote.baseUrl
            ? `Use ${readiness.remote.baseUrl} como URL publica do runtime Zavorth.`
            : 'Defina ZAVORTH_PUBLIC_BASE_URL para expor o runtime por uma URL publica HTTPS; depois rode zavorth go para validar.',
          readiness.runtime.discordBridge.enabled
            ? (discordRepair.status === 'attention'
              ? `${discordRepair.summary} ${discordRepair.nextStep || ''}`.trim()
              : readiness.runtime.discordBridge.started
              ? 'Se o canal oficial do Discord estiver pronto, use /status no servidor autorizado para validar a entrada remota.'
              : 'Se quiser uma entrada remota adicional por Discord, recupere primeiro o gateway/canal oficial antes de operar por la.')
            : 'Se quiser uma entrada remota adicional alem do app publicado, configure tambem o canal oficial do Discord.',
          healthRenewal.status === 'renewal_recommended'
            ? `${healthRenewal.summary} Comandos uteis: ${healthRenewal.commands.slice(0, 3).join(' | ')}.`
            : 'Os checks leves de health do gateway estao frescos.',
          'Se quiser separar as etapas, use npm run ops:remote:official para validar, abrir e reconectar o dashboard remoto.',
          readiness.auth.enabled
            ? 'Ao conectar o dashboard remoto, informe a URL publica e o token web do runtime.'
            : 'Configure ZAVORTH_WEB_AUTH_TOKEN antes de conectar o shell remoto.',
          'Use npm run ops:manifest para revisar o caminho oficial de acesso antes de abrir o dashboard remoto.',
          remoteRequiresHttps
            ? 'Troque a URL publica atual por uma URL HTTPS antes de usar o dashboard remoto.'
            : 'A URL publica atual ja atende o requisito de HTTPS para o dashboard remoto.',
        ],
      },
      legacyContainment,
      warnings: [
        ...readiness.local.issues,
        ...readiness.remote.issues,
        ...(discordRepair.status === 'attention' ? [discordRepair.summary] : []),
        ...(healthRenewal.status === 'renewal_recommended' ? [healthRenewal.summary] : []),
      ],
      nextSteps: readiness.nextSteps,
      recommendedPlan,
    };
  }

  private getReadinessService(): Pick<RuntimeAccessReadinessService, 'inspectLive'> {
    return this.providedReadinessService || new RuntimeAccessReadinessService();
  }

  private getOfficialRemoteAccessService(): Pick<RuntimeOfficialRemoteAccessService, 'inspect'> {
    return this.providedOfficialRemoteAccessService || new RuntimeOfficialRemoteAccessService();
  }

  private buildRecommendedPlan(
    readiness: RuntimeAccessReadinessReport,
    officialRemote: {
      ready: boolean;
      summary: string;
      appUrl: string | null;
      command: string;
      nextSteps: string[];
    },
  ): NonNullable<RuntimeAccessManifest['recommendedPlan']> {
    const launcherCommand = 'npm run launcher:startup:install';
    const launcherSummary =
      'Startup oficial do Windows e opcional e bloqueado por padrao. So habilite conscientemente se voce realmente quiser login automatico.';
    const remoteRecommendation = {
      ready: officialRemote.ready,
      command: officialRemote.command,
      appUrl: officialRemote.appUrl,
      summary: officialRemote.summary,
      nextSteps: officialRemote.nextSteps,
    };

    if (!readiness.local.ready) {
      return {
        primaryAction: 'go',
        primaryLabel: 'Atalho oficial em um comando',
        primarySummary: 'Use o caminho oficial mais curto para instalar, subir o runtime e abrir a melhor superficie pronta.',
        primaryCommand: 'zavorth go',
        openTarget: readiness.local.appUrl,
        launcherRecommendation: {
          command: launcherCommand,
          summary: launcherSummary,
        },
        remoteRecommendation,
      };
    }

    if (readiness.runtime.hostAuthorized === false) {
      return {
        primaryAction: 'trust',
        primaryLabel: 'Liberar este host',
        primarySummary: 'Autorize este host antes de executar acoes mutaveis, escrita local ou entregas persistidas.',
        primaryCommand: '/hostauth trust',
        openTarget: readiness.local.appUrl,
        launcherRecommendation: {
          command: launcherCommand,
          summary: launcherSummary,
        },
        remoteRecommendation,
      };
    }

    if (!officialRemote.ready) {
      return {
        primaryAction: 'remote',
        primaryLabel: 'Fechar acesso remoto oficial',
        primarySummary: officialRemote.summary,
        primaryCommand: officialRemote.command,
        openTarget: officialRemote.appUrl || readiness.remote.appUrl || readiness.remote.baseUrl || null,
        launcherRecommendation: {
          command: launcherCommand,
          summary: launcherSummary,
        },
        remoteRecommendation,
      };
    }

    return {
      primaryAction: 'open-local',
      primaryLabel: 'Abrir dashboard',
      primarySummary: `Dashboard pronto em ${readiness.local.appUrl}.`,
      primaryCommand: null,
      openTarget: readiness.local.appUrl,
      launcherRecommendation: {
        command: launcherCommand,
        summary: launcherSummary,
      },
      remoteRecommendation,
    };
  }
}
