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
    zavorthControlUrl: string;
    apiBaseUrl: string;
    controlUrl: string;
    legacyAppUrl: null;
    classicUrl: null;
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
    id: 'best' | 'local-control' | 'remote-control' | 'telegram' | 'discord' | 'cli';
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
    id: 'control' | 'telegram' | 'discord' | 'cli';
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
    const localControlUrl = this.buildSurfaceUrl(readiness.local.baseUrl, '/zavorthControl');
    const remoteControlUrl = readiness.remote.baseUrl
      ? this.buildSurfaceUrl(readiness.remote.baseUrl, '/zavorthControl')
      : null;
    const channelExperience = this.productChannelExperienceService.buildSnapshot({
      productMode,
      controlEntry: localControlUrl,
      controlReady: readiness.local.ready,
      telegramReady: Boolean(readiness.runtime.telegramWorker?.alive),
      discordReady: Boolean(readiness.runtime.discordBridge.enabled && readiness.runtime.discordBridge.started),
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
        || (readiness.remote.ready ? 'access remote oficial ready.'
          : 'access remote oficial ainda pede rollout guiado.'),
      ).trim(),
      appUrl: officialRemote?.remote?.appUrl || remoteControlUrl,
      command: officialRemoteCommand,
      nextSteps: Array.isArray(officialRemote?.nextSteps) ? officialRemote.nextSteps : [],
    });

    return {
      generatedAt: readiness.checkedAt,
      summary: readiness.summary,
      local: {
        ready: readiness.local.ready,
        baseUrl: readiness.local.baseUrl,
        appUrl: localControlUrl,
        zavorthControlUrl: localControlUrl,
        apiBaseUrl: `${readiness.local.baseUrl}/api/web`,
        controlUrl: localControlUrl,
        legacyAppUrl: null,
        classicUrl: null,
      },
      remote: {
        ready: readiness.remote.ready,
        baseUrl: readiness.remote.baseUrl,
        appUrl: remoteControlUrl,
        requiresHttps: remoteRequiresHttps,
        controlUrl: remoteControlUrl,
        legacyAppUrl: null,
        classicUrl: null,
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
          || (readiness.remote.ready ? 'access remote oficial ready.'
            : 'access remote oficial ainda pede rollout guiado.'),
        ).trim(),
        recommendedProvider: officialRemote?.rollout?.recommendedId || null,
        recommendedAction: officialRemote?.actions?.recommendedAction || null,
        appUrl: officialRemote?.remote?.appUrl || remoteControlUrl,
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
            || (readiness.local.ready ? 'Opens local zavorthControl. The Zavorth terminal remains available as a fast operation surface.'
              : readiness.remote.ready ? 'Opens the remote zavorthControl while the local host completes readiness.'
                : 'Use the official shortcut in one command to prepare the best surface.'),
          kind: recommendedPlan.primaryCommand ? 'command' : 'url',
          value: recommendedPlan.primaryCommand
            || recommendedPlan.openTarget
            || localControlUrl
            || remoteControlUrl
            || 'zavorth go',
          ready: !recommendedPlan.primaryCommand && Boolean(recommendedPlan.openTarget),
          primary: true,
        },
        {
          id: 'local-control',
          label: 'ZavorthControl',
          description: 'Opens the main zavorthControl gateway served by the local runtime.',
          kind: 'url',
          value: localControlUrl,
          ready: readiness.local.ready,
          primary: false,
        },
        {
          id: 'remote-control',
          label: 'Remote ZavorthControl',
          description: readiness.remote.ready ? 'Opens the remote zavorthControl already validated for this runtime.'
            : 'Close the official remote rollout first before opening remote zavorthControl.',
          kind: remoteControlUrl ? 'url' : 'command',
          value: remoteControlUrl || productGoCommand,
          ready: readiness.remote.ready,
          primary: false,
        },
        {
          id: 'telegram',
          label: 'Telegram',
          description: 'First recommended external channel to resume, approve, and trigger workflows.',
          kind: 'command',
          value: '/start',
          ready: Boolean(readiness.runtime.telegramWorker?.alive),
          primary: false,
        },
        {
          id: 'discord',
          label: 'Discord',
          description: readiness.runtime.discordBridge.started ? 'Remote entrypoint to chat, approve, and resume workflows in the official channel.'
            : 'Configure the official Discord channel before operating there.',
          kind: 'command',
          value: '/status',
          ready: Boolean(readiness.runtime.discordBridge.enabled && readiness.runtime.discordBridge.started),
          primary: false,
        },
        {
          id: 'cli',
          label: 'CLI',
          description: 'Fast entry for diagnostics, operation, and local automation.',
          kind: 'command',
          value: 'zavorth status',
          ready: true,
          primary: false,
        },
      ],
      journey: [
        {
          id: 'go',
          title: 'official shortcut in one command',
          description: readiness.local.ready ? `O shortcut oficial already deixaria o zavorthControl ready em ${localControlUrl}.`
            : 'Use a single command to install, trust the host, open the best surface, and validate the runtime.',
          command: readiness.local.ready ? null : 'zavorth go',
          status: readiness.local.ready ? 'ready' : 'action',
        },
        {
          id: 'install',
          title: 'Install and repair the environment',
          description: 'Closes dependencies, build, and safe repairs, installs the launcher, and opens the best ready surface.',
          command: readiness.local.ready ? null : productGoCommand,
          status: readiness.local.ready ? 'ready' : 'action',
        },
        {
          id: 'start',
          title: 'Subir o runtime supervised',
          description: readiness.local.ready ? `Runtime local ready em ${localControlUrl}.`
            : 'Opens the best official surface and waits for /zavorthControl to respond for real.',
          command: readiness.local.ready ? null : productGoCommand,
          status: readiness.local.ready ? 'ready' : 'action',
        },
        {
          id: 'trust',
          title: 'Release mutable execution on this host',
          description: readiness.runtime.hostAuthorized === false ? 'Authorize the host before writes, local execution, or persisted deliveries.'
            : 'The current host is already authorized for mutable executions.',
          command: readiness.runtime.hostAuthorized === false ? '/hostauth trust' : null,
          status: readiness.runtime.hostAuthorized === false ? 'action' : 'ready',
        },
        {
          id: 'remote',
          title: 'Connect a remote surface',
          description: readiness.remote.ready ? `ZavorthControl remote ready to use ${remoteControlUrl || 'the current public URL'}.`
            : 'Run the official shortcut in one command to validate remote access and open the best available zavorthControl.',
          command: readiness.remote.ready ? null : productGoCommand,
          status: readiness.remote.ready ? 'ready' : 'optional',
        },
        {
          id: 'channels',
          title: 'Close the web+telegram journey',
          description: channelExperience.recommendedJourney === 'web+telegram'
            ? 'ZavorthControl and Telegram already cover the main journey for this runtime. Other channels remain on demand.'
            : 'Start web-only in /zavorthControl. When you want an external channel, connect Telegram before the others.',
          command: 'npm run setup:channels',
          status: 'optional',
        },
      ],
      surfaces: [
        {
          id: 'control',
          label: 'ZavorthControl',
          surface: 'web',
          primary: true,
          ready: readiness.local.ready,
          entry: localControlUrl,
          remoteEntry: remoteControlUrl,
          description: 'Primary surface for chat, approvals, artifacts, diffs, and runtime.',
        },
        {
          id: 'telegram',
          label: 'Telegram',
          surface: 'telegram',
          primary: false,
          ready: Boolean(readiness.runtime.telegramWorker?.alive),
          entry: '/start',
          remoteEntry: null,
          description: 'First recommended external channel for resuming, approving, and triggering workflows.',
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
            ? 'Official channel to operate Zavorth in server or DM when the native gateway is ready.'
            : 'Official channel via bridge to resume, approve, and trigger workflows when the relay is healthy.',
        }] : []),
        ...(channelExperience.visibleSurfaces.includes('cli') ? [{
          id: 'cli' as const,
          label: 'CLI',
          surface: 'cli' as const,
          primary: false,
          ready: true,
          entry: 'zavorth status',
          remoteEntry: null,
          description: 'Fast surface for diagnostics, operation, and local automation.',
        }] : []),
      ],
      guides: {
        local: [
          'Use zavorth go as the shortest official path to install, start, and open Zavorth.',
          'Use npm run ops:journey para review a jornada oficial de installation e access.',
          'Start with the web-only journey in /zavorthControl and treat Telegram as the first recommended external channel.',
          '/app e /classic foram removidas; use /zavorthControl e Runtime API para produto, maintenance e observabilidade.',
          'Use npm run setup:channels para fechar a jornada web+Telegram before pensar em Discord, Slack ou WhatsApp.',
          'Use npm run channels:install -- --json to inspect the current panorama and recommended modes for each channel.',
          'For the complete path with launcher, local trust, and automatic opening, use zavorth go.',
          `Use zavorth go to start the runtime and open ${localControlUrl}.`,
          'On Windows, official Startup is optional and remains blocked by default; enable it only intentionally if automatic login is desired.',
          'Use zavorthControl as the primary surface to chat, approve, and operate Zavorth.',
          'Use the Zavorth terminal as a fast surface for diagnostics, automation, and local fallback.',
          readiness.runtime.discordBridge.enabled
            ? (discordRepair.status === 'attention'
              ? `${discordRepair.summary} ${discordRepair.nextStep || ''}`.trim()
              : 'If the official Discord channel is ready, use /status to validate the remote entrypoint before operating there.')
            : 'Configure the official Discord channel if an additional remote surface beyond Telegram and web is needed.',
          healthRenewal.status === 'renewal_recommended'
            ? `${healthRenewal.summary} Useful commands: ${healthRenewal.commands.slice(0, 3).join(' | ')}.`
            : 'Os checks leves de health do gateway are frescos.',
          readiness.runtime.hostAuthorized === false ? 'Authorize this host with /hostauth trust before running mutable actions.'
            : 'This host is already authorized for mutable executions.',
        ],
        remote: [
          'Use npm run ops:journey para review a sequencia oficial entre runtime local, trust e zavorthControl remote.',
          'Keep the remote flow web-first and add Telegram as the first recommended external channel.',
          'Use npm run setup:channels para preparar Telegram before abrir channels remotos secundarios no mesmo runtime.',
          'Use npm run channels:install -- --json to review modes, webhooks, and next steps without applying anything.',
          'Use zavorth go to apply the guided rollout, validate, and open the best available zavorthControl.',
          readiness.remote.baseUrl ? `Use ${readiness.remote.baseUrl} como URL public do runtime Zavorth.`
            : 'set ZAVORTH_PUBLIC_BASE_URL to expose the runtime through a public HTTPS URL; then run zavorth go to validate.',
          readiness.runtime.discordBridge.enabled
            ? (discordRepair.status === 'attention'
              ? `${discordRepair.summary} ${discordRepair.nextStep || ''}`.trim()
              : readiness.runtime.discordBridge.started ? 'If the official Discord channel is ready, use /status on the approved server to validate remote entry.'
              : 'For an additional Discord remote entrypoint, recover the official gateway/channel before operating there.')
            : 'For an additional remote entrypoint beyond the published app, also configure the official Discord channel.',
          healthRenewal.status === 'renewal_recommended'
            ? `${healthRenewal.summary} Useful commands: ${healthRenewal.commands.slice(0, 3).join(' | ')}.`
            : 'Os checks leves de health do gateway are frescos.',
          'To separate the stages, use npm run ops:remote:official to validate, open, and reconnect remote zavorthControl.',
          readiness.auth.enabled ? 'Ao conectar o zavorthControl remote, informe a URL public e o token web do runtime.'
            : 'Configure ZAVORTH_WEB_AUTH_TOKEN before connecting the remote shell.',
          'Use npm run ops:manifest para review o path oficial de access before abrir o zavorthControl remote.',
          remoteRequiresHttps ? 'Troque a URL public current por uma URL HTTPS before usar o zavorthControl remote.'
            : 'A URL public current already atende o requisito de HTTPS para o zavorthControl remote.',
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
      'Official Windows Startup is optional and blocked by default. Enable it intentionally only if automatic login is really desired.';
    const localControlUrl = this.buildSurfaceUrl(readiness.local.baseUrl, '/zavorthControl');
    const remoteControlUrl = readiness.remote.baseUrl
      ? this.buildSurfaceUrl(readiness.remote.baseUrl, '/zavorthControl')
      : null;
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
        primaryLabel: 'official shortcut in one command',
        primarySummary: 'Use the shortest official path to install, start the runtime, and open the best ready surface.',
        primaryCommand: 'zavorth go',
        openTarget: localControlUrl,
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
        primaryLabel: 'enable este host',
        primarySummary: 'Authorize this host before running mutable actions, local writes, or persisted deliveries.',
        primaryCommand: '/hostauth trust',
        openTarget: localControlUrl,
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
        primaryLabel: 'Fechar access remote oficial',
        primarySummary: officialRemote.summary,
        primaryCommand: officialRemote.command,
        openTarget: officialRemote.appUrl || remoteControlUrl || readiness.remote.baseUrl || null,
        launcherRecommendation: {
          command: launcherCommand,
          summary: launcherSummary,
        },
        remoteRecommendation,
      };
    }

    return {
      primaryAction: 'open-local',
      primaryLabel: 'Abrir ZavorthControl',
      primarySummary: `ZavorthControl ready em ${localControlUrl}.`,
      primaryCommand: null,
      openTarget: localControlUrl,
      launcherRecommendation: {
        command: launcherCommand,
        summary: launcherSummary,
      },
      remoteRecommendation,
    };
  }

  private buildSurfaceUrl(baseUrl: string, pathname: string): string {
    const normalizedBase = String(baseUrl || '').trim().replace(/\/+$/u, '');
    const normalizedPath = String(pathname || '/').trim().replace(/^\/?/u, '/');
    return `${normalizedBase}${normalizedPath}`;
  }
}
