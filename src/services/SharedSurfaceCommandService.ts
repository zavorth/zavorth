import type { IMessageContext } from '../contracts/IMessageBroker.js';
import {
  ZavorthChannelActionService,
  type BroadcastCapableGateway,
} from './ZavorthChannelActionService.js';
import type { ParsedCommand } from '../channels/commands/ChannelCommandParser.js';
import { isSharedSurfaceServiceCommandType } from './SharedSurfaceCommandContract.js';
import {
  dispatchSharedSurfaceBuiltinCommand,
  dispatchSharedSurfaceCommandPacks,
  preDispatchSharedSurfaceCommand,
} from '../domain/surface/presentation/shared-surface/SharedSurfaceCommandDispatch.js';
import {
  buildSharedSurfaceCommandServiceComposition,
  type SharedSurfaceCommandServiceComposition,
  type SharedSurfaceCommandServiceDeps,
} from '../domain/surface/presentation/shared-surface/factory/SharedSurfaceCommandServiceFactory.js';
import { ZavorthSmartCommandSurfaceService } from './ZavorthSmartCommandSurfaceService.js';
import { SharedSurfaceSlashEnhancementCommandPack } from '../domain/surface/presentation/shared-surface/SharedSurfaceSlashEnhancementCommandPack.js';

export class SharedSurfaceCommandService {
  private readonly parser!: SharedSurfaceCommandServiceComposition['parser'];
  private channelActionService!: SharedSurfaceCommandServiceComposition['channelActionService'];
  private readonly channelMeshService!: SharedSurfaceCommandServiceComposition['channelMeshService'];
  private readonly discordSurfacePolicyService!: SharedSurfaceCommandServiceComposition['discordSurfacePolicyService'];
  private readonly accessCommandPack!: SharedSurfaceCommandServiceComposition['accessCommandPack'];
  private readonly zavorthBridgeMobileCommandPack!: SharedSurfaceCommandServiceComposition['zavorthBridgeMobileCommandPack'];
  private readonly capabilityCommandPack!: SharedSurfaceCommandServiceComposition['capabilityCommandPack'];
  private readonly codexRemoteCommandPack!: SharedSurfaceCommandServiceComposition['codexRemoteCommandPack'];
  private readonly tenantGovernanceCommandPack!: SharedSurfaceCommandServiceComposition['tenantGovernanceCommandPack'];
  private readonly controlPlaneCommandPack!: SharedSurfaceCommandServiceComposition['controlPlaneCommandPack'];
  private readonly desktopCommandPack!: SharedSurfaceCommandServiceComposition['desktopCommandPack'];
  private readonly ecosystemCommandPack!: SharedSurfaceCommandServiceComposition['ecosystemCommandPack'];
  private readonly gatewayToolingCommandPack!: SharedSurfaceCommandServiceComposition['gatewayToolingCommandPack'];
  private readonly integrationHubCommandPack!: SharedSurfaceCommandServiceComposition['integrationHubCommandPack'];
  private readonly integrationCommandPack!: SharedSurfaceCommandServiceComposition['integrationCommandPack'];
  private readonly learningCommandPack!: SharedSurfaceCommandServiceComposition['learningCommandPack'];
  private readonly memoryCommandPack!: SharedSurfaceCommandServiceComposition['memoryCommandPack'];
  private readonly operationsCommandPack!: SharedSurfaceCommandServiceComposition['operationsCommandPack'];
  private readonly opsCommandPack!: SharedSurfaceCommandServiceComposition['opsCommandPack'];
  private readonly runtimeMaintenanceCommandPack!: SharedSurfaceCommandServiceComposition['runtimeMaintenanceCommandPack'];
  private readonly watchModeCommandPack!: SharedSurfaceCommandServiceComposition['watchModeCommandPack'];
  private readonly sessionNodeCommandPack!: SharedSurfaceCommandServiceComposition['sessionNodeCommandPack'];
  private readonly taskControlCommandPack!: SharedSurfaceCommandServiceComposition['taskControlCommandPack'];
  private readonly workflowGovernanceCommandPack!: SharedSurfaceCommandServiceComposition['workflowGovernanceCommandPack'];
  private readonly presentationCommandPack!: SharedSurfaceCommandServiceComposition['presentationCommandPack'];
  private readonly smartCommandSurface = new ZavorthSmartCommandSurfaceService();
  private readonly slashEnhancementCommandPack = new SharedSurfaceSlashEnhancementCommandPack();

  constructor(private readonly deps: SharedSurfaceCommandServiceDeps) {
    Object.assign(this, buildSharedSurfaceCommandServiceComposition(deps));
  }

  public attachChannelBroadcastGateways(
    gateways: Partial<Record<string, BroadcastCapableGateway | null | undefined>>,
  ): void {
    this.channelActionService = new ZavorthChannelActionService({
      channelMeshService: this.channelMeshService,
      broadcastGateways: gateways,
    });
    this.integrationCommandPack.setChannelActionService(this.channelActionService);
  }

  public parse(rawText: string): ParsedCommand {
    return this.parser.parse(rawText);
  }

  public isSupportedCommand(commandType: string): boolean {
    const normalized = String(commandType || '').trim().toLowerCase();
    return normalized === '/ping' || isSharedSurfaceServiceCommandType(normalized);
  }

  public async maybeHandle(ctx: IMessageContext, parsed?: ParsedCommand | null): Promise<boolean> {
    const rawText = String(ctx.rawText || '').trim();
    if (!rawText) {
      return false;
    }

    if (rawText.startsWith('/') && this.smartCommandSurface.canHandle(rawText)) {
      const snapshot = await this.smartCommandSurface.buildSnapshot({
        rawText,
        channel: ctx.platform,
        sessionId: ctx.chatId,
        apply: hasSharedSurfaceFlag(rawText, 'apply'),
        approvalId: extractSharedSurfaceInlineValue(rawText, 'approval-id'),
      });
      await ctx.reply(this.smartCommandSurface.renderText(snapshot));
      return true;
    }

    const preDispatch = await preDispatchSharedSurfaceCommand({
      ctx,
      rawText,
      parsed,
      parse: (value) => this.parse(value),
      discordSurfacePolicyService: this.discordSurfacePolicyService,
    });
    if (preDispatch.kind === 'handled') {
      return true;
    }

    // Agent-first: free text falls through to Telegram agent gateway.
    if (preDispatch.kind === 'pass_to_agent') {
      return false;
    }

    if (await dispatchSharedSurfaceCommandPacks({
      ctx,
      command: preDispatch.command,
      controlPlaneCommandPack: this.controlPlaneCommandPack,
      accessCommandPack: this.accessCommandPack,
      ecosystemCommandPack: this.ecosystemCommandPack,
      integrationHubCommandPack: this.integrationHubCommandPack,
      integrationCommandPack: this.integrationCommandPack,
      learningCommandPack: this.learningCommandPack,
      memoryCommandPack: this.memoryCommandPack,
      operationsCommandPack: this.operationsCommandPack,
      runtimeMaintenanceCommandPack: this.runtimeMaintenanceCommandPack,
      watchModeCommandPack: this.watchModeCommandPack,
      sessionNodeCommandPack: this.sessionNodeCommandPack,
      workflowGovernanceCommandPack: this.workflowGovernanceCommandPack,
      slashEnhancementCommandPack: this.slashEnhancementCommandPack,
    })) {
      return true;
    }

    if (await dispatchSharedSurfaceBuiltinCommand({
      ctx,
      command: preDispatch.command,
      runtimeDiagnostics: this.deps.runtimeDiagnostics,
      presentationCommandPack: this.presentationCommandPack,
      desktopCommandPack: this.desktopCommandPack,
      gatewayToolingCommandPack: this.gatewayToolingCommandPack,
      codexRemoteCommandPack: this.codexRemoteCommandPack,
      zavorthBridgeMobileCommandPack: this.zavorthBridgeMobileCommandPack,
      tenantGovernanceCommandPack: this.tenantGovernanceCommandPack,
      capabilityCommandPack: this.capabilityCommandPack,
      taskControlCommandPack: this.taskControlCommandPack,
    })) {
      return true;
    }

    return this.opsCommandPack.handle({
      context: ctx,
      parsedCommand: preDispatch.command,
    });
  }
}

function hasSharedSurfaceFlag(rawText: string, name: string): boolean {
  const escaped = name.replace(/[.*+...^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)--${escaped}(?:\\s|$)`, 'i').test(String(rawText || ''));
}

function extractSharedSurfaceInlineValue(rawText: string, name: string): string | null {
  const escaped = name.replace(/[.*+...^${}()|[\]\\]/g, '\\$&');
  const match = String(rawText || '').match(new RegExp(`(?:^|\\s)--${escaped}\\s+([^\\s]+)`, 'i'));
  return match?.[1]?.trim() || null;
}
