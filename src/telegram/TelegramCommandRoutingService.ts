import { Context } from 'grammy';
import type { ParsedCommand } from './CommandParser.js';
import {
  GatewayMemoryCommandRouter,
  type GatewayMemoryCommandRouterDeps,
} from './bot-gateway/GatewayMemoryCommandRouter.js';
import {
  GatewayPermissionBroker,
  type GatewayPermissionBrokerDeps,
} from './bot-gateway/GatewayPermissionBroker.js';
import {
  GatewaySchedulerCommandRouter,
  type GatewaySchedulerCommandRouterDeps,
} from './bot-gateway/GatewaySchedulerCommandRouter.js';

type FunCommand = '/roll' | '/coinflip' | '/8ball' | '/joke' | '/roulette';
type GroupAdminCommand =
  | '/ban'
  | '/kick'
  | '/mute'
  | '/unmute'
  | '/warn'
  | '/warns'
  | '/clearwarns'
  | '/regras'
  | '/stats'
  | '/setwelcome'
  | '/setbye'
  | '/antispam'
  | '/filter';
type GroupSafeCommand =
  | '/start'
  | '/help'
  | '/menu'
  | '/zavorth'
  | '/settings'
  | '/capabilities'
  | '/skills'
  | '/integrations'
  | '/status'
  | '/readiness'
  | '/ready'
  | '/stayonline'
  | '/agentonboarding'
  | '/agentimport'
  | '/agentmigration'
  | '/externalagent'
  | '/mnemos'
  | '/fixes'
  | '/dashboard'
  | '/demo'
  | '/echo'
  | '/echoapprovals';
type ZavorthBridgeWindowAction = 'focus' | 'approve-visible-step' | 'paste-and-submit';
type ZavorthBridgeSessionAction = 'clean' | 'reset';

export type TelegramCommandRoutingServiceDeps = {
  menuController: {
    renderHelpCard: (ctx: Context) => Promise<void>;
  };
  opsController: {
    handleStatus: (ctx: Context) => Promise<void>;
    handleReadiness: (ctx: Context) => Promise<void>;
    handleReadinessFixes: (ctx: Context) => Promise<void>;
    handleReadyToGo: (ctx: Context) => Promise<void>;
    handleStayOnline: (ctx: Context) => Promise<void>;
    handleExternalAgentOnboarding?: (ctx: Context, args: string) => Promise<void>;
    handleExternalAgentMigrationPack?: (ctx: Context, args: string) => Promise<void>;
    handleExternalAgentGateway?: (ctx: Context, args: string) => Promise<void>;
    handleCapabilities: (ctx: Context, args: string) => Promise<void>;
    handleProfile: (ctx: Context, args: string) => Promise<void>;
    handleEnable: (ctx: Context, args: string) => Promise<void>;
    handleDisable: (ctx: Context, args: string) => Promise<void>;
    handleIntegrations: (ctx: Context, args: string) => Promise<void>;
    handleDemo: (ctx: Context, args: string) => Promise<void>;
    handleDashboard: (ctx: Context) => Promise<void>;
    handleAccess: (ctx: Context, args: string) => Promise<void>;
    handleBootstrap: (ctx: Context) => Promise<void>;
    handleWslCommand: (ctx: Context, args: string) => Promise<void>;
    handleModels: (ctx: Context) => Promise<void>;
    handleAudit: (ctx: Context, args: string) => Promise<void>;
    handleOperationalMode: (ctx: Context, args: string) => Promise<void>;
    handleOperatorMode: (ctx: Context, args: string) => Promise<void>;
    handlePresentationMode: (ctx: Context, args: string) => Promise<void>;
    handleDailyReport: (ctx: Context, args: string) => Promise<void>;
    handleConnect: (ctx: Context, args: string) => Promise<void>;
    handleChanges: (ctx: Context) => Promise<void>;
    handleSelfUpdate: (ctx: Context, args: string) => Promise<void>;
    handleAutoRepair: (ctx: Context, args: string) => Promise<void>;
  };
  hubController: {
    handleStartCommand: (ctx: Context, args: string) => Promise<void>;
    handleSettingsCommand: (ctx: Context) => Promise<void>;
    handleMenuCommand: (ctx: Context) => Promise<void>;
  };
  skillCatalogController: {
    handleSkills: (ctx: Context, args: string) => Promise<void>;
  };
  securityController: {
    handleCleanup: (ctx: Context) => Promise<void>;
    handleClear: (ctx: Context) => Promise<void>;
    handleLock: (ctx: Context, args: string) => Promise<void>;
    handleUnlock: (ctx: Context, args: string) => Promise<void>;
    handleHostAuth: (ctx: Context, args: string) => Promise<void>;
  };
  providerController: {
    handleModel: (ctx: Context, args: string) => Promise<void>;
  };
  permissionController: GatewayPermissionBrokerDeps['permissionController'];
  echoApprovalController?: GatewayPermissionBrokerDeps['echoApprovalController'];
  permissionBroker?: GatewayPermissionBroker;
  schedulerController: GatewaySchedulerCommandRouterDeps['schedulerController'];
  schedulerCommandRouter?: GatewaySchedulerCommandRouter;
  funController: {
    handle: (ctx: Context, command: FunCommand, args: string) => Promise<void>;
  };
  groupAdminController: {
    handleBan: (ctx: Context, args: string) => Promise<void>;
    handleKick: (ctx: Context, args: string) => Promise<void>;
    handleMute: (ctx: Context, args: string) => Promise<void>;
    handleUnmute: (ctx: Context, args: string) => Promise<void>;
    handleWarn: (ctx: Context, args: string) => Promise<void>;
    handleWarns: (ctx: Context, args: string) => Promise<void>;
    handleClearWarns: (ctx: Context, args: string) => Promise<void>;
    handleRegras: (ctx: Context, args: string) => Promise<void>;
    handleStats: (ctx: Context) => Promise<void>;
    handleSetWelcome: (ctx: Context, args: string) => Promise<void>;
    handleSetBye: (ctx: Context, args: string) => Promise<void>;
    handleAntiSpam: (ctx: Context, args: string) => Promise<void>;
    handleFilter: (ctx: Context, args: string) => Promise<void>;
  };
  researchController: {
    handleResearch: (ctx: Context, args: string) => Promise<void>;
    handleDeepResearch: (ctx: Context, args: string) => Promise<void>;
  };
  knowledgeController: GatewayMemoryCommandRouterDeps['knowledgeController'];
  memoryCommandRouter?: GatewayMemoryCommandRouter;
  executionController: {
    handleUndo: (ctx: Context, args: string) => Promise<void>;
  };
  selfModificationController: {
    handleCommand: (ctx: Context, args: string) => Promise<void>;
  };
  zavorthBridgeController: {
    handleWindowAction: (ctx: Context, action: ZavorthBridgeWindowAction, args?: string) => Promise<void>;
    handleBridgeStatus: (ctx: Context) => Promise<void>;
    handleSessionAction: (ctx: Context, action: ZavorthBridgeSessionAction) => Promise<void>;
    handleModelCommand: (ctx: Context, args: string) => Promise<void>;
  };
  fileDeliveryController: {
    shouldHandleFreeForm: (text: string, userId: string) => boolean;
    handleFreeForm: (ctx: Context, text: string, userId: string) => Promise<void>;
  };
  swarmController?: {
    handleSwarm: (ctx: Context, args: string) => Promise<void>;
  } | null;
  mnemosMemoryUxController?: {
    handleMnemos: (ctx: Context, args: string, userId: string) => Promise<void>;
  } | null;
  naturalCapabilityRouter?: {
    dispatch: (ctx: Context, effectiveText: string, userId: string) => Promise<boolean>;
  } | null;
  // Certification matrix: Modo Echo
  echoPreferenceStore?: {
    isEchoModeActive: () => Promise<boolean>;
    setEchoMode: (active: boolean) => Promise<any>;
  };
};

export class TelegramCommandRoutingService {
  private readonly permissionBroker: GatewayPermissionBroker;
  private readonly schedulerCommandRouter: GatewaySchedulerCommandRouter;
  private readonly memoryCommandRouter: GatewayMemoryCommandRouter;

  constructor(private readonly deps: TelegramCommandRoutingServiceDeps) {
    this.permissionBroker =
      deps.permissionBroker ||
      new GatewayPermissionBroker({
        permissionController: deps.permissionController,
        echoApprovalController: deps.echoApprovalController,
      });
    this.schedulerCommandRouter =
      deps.schedulerCommandRouter ||
      new GatewaySchedulerCommandRouter({
        schedulerController: deps.schedulerController,
      });
    this.memoryCommandRouter =
      deps.memoryCommandRouter ||
      new GatewayMemoryCommandRouter({
        knowledgeController: deps.knowledgeController,
      });
  }

  public async dispatchPrivateCommand(
    ctx: Context,
    parsed: ParsedCommand,
    effectiveText: string,
    userId: string,
  ): Promise<boolean> {
    if (
      parsed.command_type === '/task' &&
      !effectiveText.trim().startsWith('/') &&
      (await this.deps.naturalCapabilityRouter?.dispatch(ctx, parsed.command_args || effectiveText, userId))
    ) {
      return true;
    }

    switch (parsed.command_type) {
      case '/help':
        await this.deps.menuController.renderHelpCard(ctx);
        return true;
      case '/settings':
        await this.deps.hubController.handleSettingsCommand(ctx);
        return true;
      case '/zavorth':
        await this.deps.hubController.handleMenuCommand(ctx);
        return true;
      case '/capabilities':
        await this.deps.opsController.handleCapabilities(ctx, parsed.command_args);
        return true;
      case '/skills':
        await this.deps.skillCatalogController.handleSkills(ctx, parsed.command_args);
        return true;
      case '/status':
        await this.deps.opsController.handleStatus(ctx);
        return true;
      case '/readiness':
        await this.deps.opsController.handleReadiness(ctx);
        return true;
      case '/ready':
        await this.deps.opsController.handleReadyToGo(ctx);
        return true;
      case '/stayonline':
        await this.deps.opsController.handleStayOnline(ctx);
        return true;
      case '/agentonboarding':
        if (this.deps.opsController.handleExternalAgentOnboarding) {
          await this.deps.opsController.handleExternalAgentOnboarding(ctx, parsed.command_args);
          return true;
        }
        return false;
      case '/agentimport':
      case '/agentmigration':
        if (this.deps.opsController.handleExternalAgentMigrationPack) {
          await this.deps.opsController.handleExternalAgentMigrationPack(ctx, parsed.command_args);
          return true;
        }
        return false;
      case '/externalagent':
        if (this.deps.opsController.handleExternalAgentGateway) {
          await this.deps.opsController.handleExternalAgentGateway(ctx, parsed.command_args);
          return true;
        }
        return false;
      case '/mnemos':
        if (this.deps.mnemosMemoryUxController) {
          await this.deps.mnemosMemoryUxController.handleMnemos(ctx, parsed.command_args, userId);
          return true;
        }
        return false;
      case '/fixes':
        await this.deps.opsController.handleReadinessFixes(ctx);
        return true;
      case '/dashboard':
        await this.deps.opsController.handleDashboard(ctx);
        return true;
      case '/wsl':
        await this.deps.opsController.handleWslCommand(ctx, parsed.command_args);
        return true;
      case '/cleanup':
        await this.deps.securityController.handleCleanup(ctx);
        return true;
      case '/clear':
        await this.deps.securityController.handleClear(ctx);
        return true;
      case '/lock':
        await this.deps.securityController.handleLock(ctx, parsed.command_args);
        return true;
      case '/unlock':
        await this.deps.securityController.handleUnlock(ctx, parsed.command_args);
        return true;
      case '/hostauth':
        await this.deps.securityController.handleHostAuth(ctx, parsed.command_args);
        return true;
      case '/model':
        await this.deps.providerController.handleModel(ctx, parsed.command_args);
        return true;
      case '/profile':
        await this.deps.opsController.handleProfile(ctx, parsed.command_args);
        return true;
      case '/enable':
        await this.deps.opsController.handleEnable(ctx, parsed.command_args);
        return true;
      case '/disable':
        await this.deps.opsController.handleDisable(ctx, parsed.command_args);
        return true;
      case '/models':
        await this.deps.opsController.handleModels(ctx);
        return true;
      case '/audit':
        await this.deps.opsController.handleAudit(ctx, parsed.command_args);
        return true;
      case '/mode':
        await this.deps.opsController.handleOperationalMode(ctx, parsed.command_args);
        return true;
      case '/operator':
        await this.deps.opsController.handleOperatorMode(ctx, parsed.command_args);
        return true;
      case '/presentation':
        await this.deps.opsController.handlePresentationMode(ctx, parsed.command_args);
        return true;
      case '/demo':
        await this.deps.opsController.handleDemo(ctx, parsed.command_args);
        return true;
      case '/access':
        await this.deps.opsController.handleAccess(ctx, parsed.command_args);
        return true;
      case '/bootstrap':
        await this.deps.opsController.handleBootstrap(ctx);
        return true;
      case '/dailyreport':
        await this.deps.opsController.handleDailyReport(ctx, parsed.command_args);
        return true;
      case '/integrations':
        await this.deps.opsController.handleIntegrations(ctx, parsed.command_args);
        return true;
      case '/connect':
        await this.deps.opsController.handleConnect(ctx, parsed.command_args);
        return true;
      case '/changes':
        await this.deps.opsController.handleChanges(ctx);
        return true;
      case '/selfupdate':
        await this.deps.opsController.handleSelfUpdate(ctx, parsed.command_args);
        return true;
      case '/autorepair':
        await this.deps.opsController.handleAutoRepair(ctx, parsed.command_args);
        return true;
      case '/research':
        await this.deps.researchController.handleResearch(ctx, parsed.command_args);
        return true;
      case '/deepresearch':
        await this.deps.researchController.handleDeepResearch(ctx, parsed.command_args);
        return true;
      case '/undo':
        await this.deps.executionController.handleUndo(ctx, parsed.command_args);
        return true;
      case '/selfmod':
        await this.deps.selfModificationController.handleCommand(ctx, parsed.command_args);
        return true;
      case '/agfocus':
        await this.deps.zavorthBridgeController.handleWindowAction(ctx, 'focus');
        return true;
      case '/agaccept':
        await this.deps.zavorthBridgeController.handleWindowAction(ctx, 'approve-visible-step');
        return true;
      case '/agnudge':
        await this.deps.zavorthBridgeController.handleWindowAction(
          ctx,
          'paste-and-submit',
          parsed.command_args ||
            'Continue a tarefa atual do Zavorth e conclua a resposta.',
        );
        return true;
      case '/agbridge':
        await this.deps.zavorthBridgeController.handleBridgeStatus(ctx);
        return true;
      case '/agclean':
        await this.deps.zavorthBridgeController.handleSessionAction(ctx, 'clean');
        return true;
      case '/agreset':
        await this.deps.zavorthBridgeController.handleSessionAction(ctx, 'reset');
        return true;
      case '/agmodel':
        await this.deps.zavorthBridgeController.handleModelCommand(ctx, parsed.command_args);
        return true;
      case '/swarm':
        if (this.deps.swarmController) {
          await this.deps.swarmController.handleSwarm(ctx, parsed.command_args);
          return true;
        }
        return false;
      // Certification matrix: Modo Echo — resposta por voz
      case '/echo':
        await this.handleEchoCommand(ctx, parsed.command_args);
        return true;
    }

    if (await this.permissionBroker.dispatchPrivateCommand(ctx, parsed)) {
      return true;
    }

    if (await this.schedulerCommandRouter.dispatchPrivateCommand(ctx, parsed, userId)) {
      return true;
    }

    if (await this.memoryCommandRouter.dispatchPrivateCommand(ctx, parsed, userId)) {
      return true;
    }

    if (this.isFunCommand(parsed.command_type)) {
      await this.deps.funController.handle(ctx, parsed.command_type, parsed.command_args);
      return true;
    }

    if (
      ctx.chat?.type === 'private' &&
      parsed.command_type === '/task' &&
      this.deps.fileDeliveryController.shouldHandleFreeForm(
        parsed.command_args || effectiveText,
        userId,
      )
    ) {
      await this.deps.fileDeliveryController.handleFreeForm(
        ctx,
        parsed.command_args || effectiveText,
        userId,
      );
      return true;
    }

    return false;
  }

  public async dispatchGroupCommand(
    ctx: Context,
    command: string,
    args: string,
  ): Promise<boolean> {
    if (this.isFunCommand(command)) {
      await this.deps.funController.handle(ctx, command, args);
      return true;
    }

    if (this.isGroupAdminCommand(command)) {
      switch (command) {
        case '/ban':
          await this.deps.groupAdminController.handleBan(ctx, args);
          return true;
        case '/kick':
          await this.deps.groupAdminController.handleKick(ctx, args);
          return true;
        case '/mute':
          await this.deps.groupAdminController.handleMute(ctx, args);
          return true;
        case '/unmute':
          await this.deps.groupAdminController.handleUnmute(ctx, args);
          return true;
        case '/warn':
          await this.deps.groupAdminController.handleWarn(ctx, args);
          return true;
        case '/warns':
          await this.deps.groupAdminController.handleWarns(ctx, args);
          return true;
        case '/clearwarns':
          await this.deps.groupAdminController.handleClearWarns(ctx, args);
          return true;
        case '/regras':
          await this.deps.groupAdminController.handleRegras(ctx, args);
          return true;
        case '/stats':
          await this.deps.groupAdminController.handleStats(ctx);
          return true;
        case '/setwelcome':
          await this.deps.groupAdminController.handleSetWelcome(ctx, args);
          return true;
        case '/setbye':
          await this.deps.groupAdminController.handleSetBye(ctx, args);
          return true;
        case '/antispam':
          await this.deps.groupAdminController.handleAntiSpam(ctx, args);
          return true;
        case '/filter':
          await this.deps.groupAdminController.handleFilter(ctx, args);
          return true;
      }
    }

    if (this.isSafeGroupCommand(command)) {
      switch (command) {
        case '/start':
          await this.deps.hubController.handleStartCommand(ctx, args);
          return true;
        case '/help':
          await this.deps.menuController.renderHelpCard(ctx);
          return true;
        case '/menu':
        case '/zavorth':
          await this.deps.hubController.handleMenuCommand(ctx);
          return true;
        case '/settings':
          await this.deps.hubController.handleSettingsCommand(ctx);
          return true;
        case '/capabilities':
          await this.deps.opsController.handleCapabilities(ctx, args);
          return true;
        case '/skills':
          await this.deps.skillCatalogController.handleSkills(ctx, args);
          return true;
        case '/status':
          await this.deps.opsController.handleStatus(ctx);
          return true;
        case '/readiness':
          await this.deps.opsController.handleReadiness(ctx);
          return true;
        case '/ready':
          await this.deps.opsController.handleReadyToGo(ctx);
          return true;
        case '/stayonline':
          await this.deps.opsController.handleStayOnline(ctx);
          return true;
        case '/agentonboarding':
          if (this.deps.opsController.handleExternalAgentOnboarding) {
            await this.deps.opsController.handleExternalAgentOnboarding(ctx, args);
            return true;
          }
          return false;
        case '/agentimport':
        case '/agentmigration':
          if (this.deps.opsController.handleExternalAgentMigrationPack) {
            await this.deps.opsController.handleExternalAgentMigrationPack(ctx, args);
            return true;
          }
          return false;
        case '/externalagent':
          if (this.deps.opsController.handleExternalAgentGateway) {
            await this.deps.opsController.handleExternalAgentGateway(ctx, args);
            return true;
          }
          return false;
        case '/fixes':
          await this.deps.opsController.handleReadinessFixes(ctx);
          return true;
        case '/integrations':
          await this.deps.opsController.handleIntegrations(ctx, args);
          return true;
        case '/demo':
          await this.deps.opsController.handleDemo(ctx, args);
          return true;
        case '/echoapprovals':
          return this.permissionBroker.dispatchSafeGroupCommand(ctx, command, args);
        case '/echo':
          await this.handleEchoCommand(ctx, args);
          return true;
        case '/dashboard':
          await this.deps.opsController.handleDashboard(ctx);
          return true;
      }
    }

    return false;
  }

  private isFunCommand(commandType: string): commandType is FunCommand {
    return ['/roll', '/coinflip', '/8ball', '/joke', '/roulette'].includes(commandType);
  }

  private isGroupAdminCommand(commandType: string): commandType is GroupAdminCommand {
    return new Set([
      '/ban',
      '/kick',
      '/mute',
      '/unmute',
      '/warn',
      '/warns',
      '/clearwarns',
      '/regras',
      '/stats',
      '/setwelcome',
      '/setbye',
      '/antispam',
      '/filter',
    ]).has(commandType);
  }

  private isSafeGroupCommand(commandType: string): commandType is GroupSafeCommand {
    return new Set([
      '/start',
      '/help',
      '/menu',
      '/zavorth',
      '/settings',
      '/capabilities',
      '/skills',
      '/integrations',
      '/status',
      '/readiness',
      '/ready',
      '/stayonline',
      '/agentonboarding',
      '/agentimport',
      '/agentmigration',
      '/externalagent',
      '/fixes',
      '/dashboard',
      '/demo',
      '/echo',
      '/echoapprovals',
    ]).has(commandType);
  }

  // Certification matrix: Handler do Modo Echo
  private async handleEchoCommand(ctx: Context, args: string): Promise<void> {
    const store = this.deps.echoPreferenceStore;
    if (!store) {
      await ctx.reply('Modo Echo nao esta disponivel neste runtime.');
      return;
    }

    const subcommand = String(args || '').trim().toLowerCase();

    if (subcommand === 'on' || subcommand === 'ligar' || subcommand === 'ativar') {
      await store.setEchoMode(true);
      await ctx.reply(
        '🎙️ *Modo Echo ativado.*\n\n' +
        'A partir de agora, responderei com audio alem do texto.\n' +
        'Use `/echo off` para desativar.',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    if (subcommand === 'off' || subcommand === 'desligar' || subcommand === 'desativar') {
      await store.setEchoMode(false);
      await ctx.reply(
        '🔇 *Modo Echo desativado.*\n\nVoltei ao modo texto padrao.',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const isActive = await store.isEchoModeActive();
    const statusEmoji = isActive ? '🎙️' : '🔇';
    const statusText = isActive ? 'ATIVADO' : 'DESATIVADO';
    await ctx.reply(
      `${statusEmoji} *Modo Echo: ${statusText}*\n\n` +
      'Comandos:\n' +
      '- `/echo on` — ativa resposta por voz\n' +
      '- `/echo off` — desativa resposta por voz\n' +
      '- `/echo` — mostra o status atual',
      { parse_mode: 'Markdown' },
    );
  }
}
