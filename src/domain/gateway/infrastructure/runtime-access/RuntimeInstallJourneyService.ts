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
        title: 'official shortcut in one command',
        status: manifest.local.ready ? 'ready' : 'action',
        summary: manifest.local.ready ? `O shortcut oficial already deixaria o shell web do runtime ready em ${manifest.local.appUrl}.`
          : 'Use a single command to install, trust the host, open the best surface, and review access.',
        command: manifest.local.ready ? null : manifest.commands.go,
        details: [
          `Shell web do runtime: ${manifest.local.appUrl}`,
          manifest.remote.appUrl ? `Shell web remote: ${manifest.remote.appUrl}`
            : 'Shell web remote ainda depende de URL public HTTPS.',
        ],
      },
      {
        id: 'bootstrap',
        title: dryRun ? 'Bootstrap plan' : 'Bootstrap e correcoes seguras',
        status: failedRepair ? 'failed'
          : (repair.final.actions.length === 0 ? 'ready' : (dryRun ? 'action' : 'ready')),
        summary: repair.summary,
        command: failedRepair || repair.final.actions.length > 0 ? 'npm run ops:bootstrap -- --repair' : null,
        details: repair.final.actions.slice(0, 3).map((entry) => `${entry.title}: ${entry.reason}`),
      },
      {
        id: 'startup',
        title: 'Subida do runtime',
        status: manifest.local.ready ? 'ready'
          : (dryRun ? 'action' : (startup?.ok ? 'ready' : 'failed')),
        summary: manifest.local.ready ? `local runtime ready at ${manifest.local.appUrl}.`
          : (dryRun ? 'Dry-run: use the official command to start the supervised runtime.'
            : (startup?.summary || 'The runtime is not ready yet.')),
        command: manifest.local.ready ? null : manifest.commands.start,
        details: localIssues.slice(0, 3),
      },
      {
        id: 'gateway-ui',
        title: 'Gateway e ZavorthControl',
        status: manifest.local.ready ? 'ready' : 'action',
        summary: manifest.local.ready ? 'local Gateway and ZavorthControl session-first ready at /zavorthControl, with WebSocket as the main plane.'
          : 'Start the runtime to unlock the local Gateway, ZavorthControl and the real-time control plane.',
        command: manifest.local.ready ? null : manifest.commands.go,
        details: [
          `local Gateway: ${manifest.local.apiBaseUrl || `${manifest.local.baseUrl}/api/web`}`,
          `ZavorthControl: ${manifest.local.appUrl}`,
          'The Gateway centralizes session, approvals, capabilities, artifacts, diffs and selfmod.',
        ],
      },
      {
        id: 'launcher',
        title: 'Optional Windows Startup',
        status: this.platform !== 'win32'
          ? 'skipped'
          : (launcherInstalled ? 'ready' : 'skipped'),
        summary: this.platform !== 'win32'
          ? 'Auto-start is currently only supported by the official Windows installer.'
          : (launcherInstalled ? 'Auto-start is active on this host. Use the official removal command to disable it whenever you want.'
            : 'Auto-start remains disabled on this host. This is the recommended behavior for daily local use.'),
        command: null,
        details: launcherShortcutPath
          ? launcherInstalled
            ? [launcherShortcutPath, `Disable: ${manifest.commands.startupLauncherRemove}`]
            : [launcherShortcutPath, `Enable consciously: ${manifest.commands.startupLauncher}`]
          : [],
      },
      {
        id: 'local-access',
        title: 'Official local access',
        status: manifest.local.ready ? 'ready' : 'action',
        summary: manifest.local.ready ? `local app ready at ${manifest.local.appUrl}.`
          : (localIssues[0] || 'local access is not ready yet.'),
        command: manifest.local.ready ? null : manifest.commands.access,
        details: [
          `Runtime web shell: ${manifest.local.appUrl}`,
          `Legacy panel: ${manifest.local.zavorthControlUrl}`,
          ...localIssues.slice(0, 2),
        ],
      },
      {
        id: 'product-mode',
        title: 'Product mode',
        status: 'ready',
        summary: `Current mode: ${this.productMode.id}. ${this.productMode.summary}`,
        command: 'npm run mode:status',
        details: [
          `Label: ${this.productMode.label}.`,
          `Recommended base profile for this mode: ${this.productMode.defaultRuntimeProfile}.`,
          `Currently active profile: ${this.productMode.runtimeProfile}.`,
          `Switch mode: npm run mode:use -- <chat|assistant|builder|operator>`,
          'The core|ops|full profiles still exist underneath, but the new onboarding speaks in product language.',
        ],
      },
      {
        id: 'profiles-and-packs',
        title: 'Optional profiles and packs',
        status: 'ready',
        summary: `Current profile: ${this.runtimeProfile}. The ${this.productMode.id} mode uses ${this.productMode.defaultRuntimeProfile} as baseline. Use core for daily use, ops for maintenance, and full only when you want the entire advanced stack enabled.`,
        command: 'npm run profile:status',
        details: [
          'Official profiles: core, ops and full.',
          'View product mode: npm run mode:status',
          'Daily recommendation: core.',
          'Use ops for maintenance/daily report and full only by explicit choice.',
          'View profiles: npm run profile:status',
          'Switch consciously: npm run profile:use -- --profile=ops',
          'Base skills and catalog: npm run skills:registry',
          'Optional browser stack: npm run mcp:browser:doctor',
        ],
      },
      {
        id: 'companions-and-presets',
        title: 'Companions and lightweight presets',
        status: 'ready',
        summary: 'WSL, Docker Desktop and companion IDEs now enter the official onboarding with doctor and supervised lightweight preset.',
        command: 'npm run ops:doctor:desktop',
        details: [
          'Resource doctor: npm run ops:doctor:desktop',
          'Workspace doctor: npm run ops:workspace:doctor',
          'Lightweight preset for ZavorthBridge/VS Code: npm run ops:workspace:optimize -- zavorthBridge',
          'Inspect companions: npm run ops:companions',
        ],
      },
      {
        id: 'channels',
        title: 'Channel journeys',
        status: partialChannels.length > 0
          ? 'action'
          : channelExperience.recommendedJourney === 'web+telegram'
            ? 'ready'
            : 'action',
        summary: partialChannels.length > 0
          ? `Recommended journey: ${channelExperience.recommendedJourney}. There are still partial channels: ${partialChannels.map((entry) => entry.label).join(', ')}.`
          : channelExperience.recommendedJourney === 'web+telegram'
            ? 'Recommended journey ready: web+telegram. /zavorthControl remains the center and Telegram becomes the first external channel.'
            : 'Current recommended journey: web-only. When you want an external channel, start with Telegram.',
        command: partialChannels.length > 0 || channelExperience.recommendedJourney !== 'web+telegram'
          ? manifest.commands.channels
          : null,
        details: [
          `Main product entry: ${manifest.local.appUrl}`,
          `Recommended journey: ${channelExperience.recommendedJourney}.`,
          telegramPlan ? `Telegram: ${telegramPlan.readiness} em ${telegramPlan.currentMode || telegramPlan.recommendedMode}.`
            : 'Telegram has not been set up on this host yet.',
          'Telegram is the first recommended external channel to resume, approve and trigger workflows.',
          this.productMode.id === 'chat' || this.productMode.id === 'assistant'
            ? 'Discord, Slack and WhatsApp are hidden by default in basic modes.'
            : 'Discord, Slack and WhatsApp remain optional and only enter when the task actually requires it.',
        ],
      },
      {
        id: 'remote-access',
        title: 'Official remote access',
        status: manifest.remote.ready ? 'ready' : 'action',
        summary: manifest.remote.ready ? `Remote web shell ready at ${manifest.remote.appUrl || manifest.remote.baseUrl || 'current public URL'}.`
          : (officialRemote?.summary || remoteIssues[0] || 'Remote access is not ready yet.'),
        command: manifest.remote.ready ? null : officialRemoteCommand,
        details: [
          officialRemote?.appUrl ? `Remote web shell: ${officialRemote.appUrl}`
            : (manifest.remote.appUrl ? `Expected remote web shell: ${manifest.remote.appUrl}`
              : 'Set an HTTPS public URL for the runtime.'),
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
        title: 'next passo',
        status: 'action',
        summary: `${blockingAction.title}: ${blockingAction.reason}`,
        command: blockingAction.command,
        details: manifest.nextSteps.slice(0, 3).map((entry) => `${entry.title}: ${entry.description}`),
      };
    }

    if (manifest.local.ready && !manifest.remote.ready) {
      return {
        id: 'next-step',
        title: 'Fechar access remote oficial',
        status: 'action',
        summary:
          manifest.officialRemote?.summary
          || recommendedPlan?.remoteRecommendation.summary
          || remoteIssues[0]
          || 'Feche o access remote oficial para enable o shell remote outside da machine local.',
        command: officialRemoteCommand,
        details: [
          manifest.remote.appUrl ? `Shell web remote previsto: ${manifest.remote.appUrl}`
            : 'Still missing a public HTTPS URL for the runtime.',
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
      title: 'next passo',
      status: manifest.local.ready ? 'ready' : 'action',
      summary: manifest.summary || 'Continue o path oficial do Zavorth.',
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
        recommendedPlan.openTarget ? `Shell web remote: ${recommendedPlan.openTarget}`
          : (manifest.remote.appUrl ? `Shell web remote previsto: ${manifest.remote.appUrl}`
            : 'Still missing a public HTTPS URL for the runtime.'),
        ...(recommendedPlan.remoteRecommendation.nextSteps || officialRemoteNextSteps).slice(0, 2),
        ...officialRemoteIssues.slice(0, 2),
        ...remoteIssues.slice(0, 1),
      ];
    }

    if (recommendedPlan.primaryAction === 'trust') {
      return [
        `Shell web do runtime: ${manifest.local.appUrl}`,
        'after disso, o host current volta a poder run write local e entregas persistidas.',
        ...localIssues.slice(0, 1),
      ];
    }

    if (recommendedPlan.primaryAction === 'go') {
      return [
        `Official command: ${recommendedPlan.primaryCommand || manifest.commands.go}`,
        `Shell web do runtime: ${manifest.local.appUrl}`,
        recommendedPlan.remoteRecommendation.appUrl ? `Shell web remote: ${recommendedPlan.remoteRecommendation.appUrl}`
          : 'The remote web shell will still be validated by the same flow.',
      ];
    }

    if (recommendedPlan.primaryAction === 'open-local') {
      return [
        `Shell web do runtime: ${recommendedPlan.openTarget || manifest.local.appUrl}`,
        `Shell remote: ${recommendedPlan.remoteRecommendation.ready ? 'ready' : 'pending'}${recommendedPlan.remoteRecommendation.appUrl ? ` em ${recommendedPlan.remoteRecommendation.appUrl}` : ''}.`,
        `To review the remote rollout, use ${officialRemoteCommand}.`,
      ];
    }

    return manifest.nextSteps.slice(0, 3).map((entry) => `${entry.title}: ${entry.description}`);
  }

  private getRecommendedPlanTitle(
    action: NonNullable<RuntimeAccessManifest['recommendedPlan']>['primaryAction'],
  ): string {
    if (action === 'go') {
      return 'Seguir path oficial';
    }
    if (action === 'trust') {
      return 'enable este host';
    }
    if (action === 'remote') {
      return 'Fechar access remote oficial';
    }
    if (action === 'open-local') {
      return 'Abrir shell web do runtime';
    }
    return 'next passo';
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
