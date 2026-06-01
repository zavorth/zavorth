import type { IMessageContext } from '../contracts/IMessageBroker.js';
import {
  ZavorthChannelActionService,
  type BroadcastCapableGateway,
} from './ZavorthChannelActionService.js';
import type { ParsedCommand } from '../telegram/CommandParser.js';
import { isSharedSurfaceServiceCommandType } from './SharedSurfaceCommandContract.js';
import {
  dispatchSharedSurfaceBuiltinCommand,
  dispatchSharedSurfaceCommandPacks,
  preDispatchSharedSurfaceCommand,
} from '../domain/surface/presentation/shared-surface/SharedSurfaceCommandDispatch.js';
import {
  extractSharedSurfaceNaturalChannelId,
  formatSharedSurfaceNaturalChannelLabel,
  normalizeSharedSurfaceNaturalText,
} from '../domain/surface/presentation/shared-surface/SharedSurfaceNaturalIntentSupport.js';
import {
  buildSharedSurfaceCommandServiceComposition,
  type SharedSurfaceCommandServiceComposition,
  type SharedSurfaceCommandServiceDeps,
} from '../domain/surface/presentation/shared-surface/factory/SharedSurfaceCommandServiceFactory.js';
import { ZavorthSmartCommandSurfaceService } from './ZavorthSmartCommandSurfaceService.js';

export class SharedSurfaceCommandService {
  private readonly parser!: SharedSurfaceCommandServiceComposition['parser'];
  private channelActionService!: SharedSurfaceCommandServiceComposition['channelActionService'];
  private readonly channelMeshService!: SharedSurfaceCommandServiceComposition['channelMeshService'];
  private readonly discordSurfacePolicyService!: SharedSurfaceCommandServiceComposition['discordSurfacePolicyService'];
  private readonly engineeringCoreService!: SharedSurfaceCommandServiceComposition['engineeringCoreService'];
  private readonly surfaceTaskDispatcher!: SharedSurfaceCommandServiceComposition['surfaceTaskDispatcher'];
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
  private readonly naturalMeshCommandPack!: SharedSurfaceCommandServiceComposition['naturalMeshCommandPack'];
  private readonly operationsCommandPack!: SharedSurfaceCommandServiceComposition['operationsCommandPack'];
  private readonly runtimeMaintenanceCommandPack!: SharedSurfaceCommandServiceComposition['runtimeMaintenanceCommandPack'];
  private readonly watchModeCommandPack!: SharedSurfaceCommandServiceComposition['watchModeCommandPack'];
  private readonly sessionCommandPack!: SharedSurfaceCommandServiceComposition['sessionCommandPack'];
  private readonly sessionNodeCommandPack!: SharedSurfaceCommandServiceComposition['sessionNodeCommandPack'];
  private readonly taskControlCommandPack!: SharedSurfaceCommandServiceComposition['taskControlCommandPack'];
  private readonly taskVariationCommandPack!: SharedSurfaceCommandServiceComposition['taskVariationCommandPack'];
  private readonly workflowGovernanceCommandPack!: SharedSurfaceCommandServiceComposition['workflowGovernanceCommandPack'];
  private readonly presentationCommandPack!: SharedSurfaceCommandServiceComposition['presentationCommandPack'];
  private readonly smartCommandSurface = new ZavorthSmartCommandSurfaceService();

  constructor(private readonly deps: SharedSurfaceCommandServiceDeps) {
    Object.assign(
      this,
      buildSharedSurfaceCommandServiceComposition(deps, {
        normalizeNaturalText: normalizeSharedSurfaceNaturalText,
        extractNaturalChannelId: extractSharedSurfaceNaturalChannelId,
        formatNaturalChannelLabel: formatSharedSurfaceNaturalChannelLabel,
      }),
    );
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
      presentationCommandPack: this.presentationCommandPack,
      runtimeMaintenanceCommandPack: this.runtimeMaintenanceCommandPack,
      zavorthBridgeMobileCommandPack: this.zavorthBridgeMobileCommandPack,
      naturalMeshCommandPack: this.naturalMeshCommandPack,
      ecosystemCommandPack: this.ecosystemCommandPack,
      memoryCommandPack: this.memoryCommandPack,
      sessionCommandPack: this.sessionCommandPack,
      workflowGovernanceCommandPack: this.workflowGovernanceCommandPack,
      taskControlCommandPack: this.taskControlCommandPack,
      taskVariationCommandPack: this.taskVariationCommandPack,
      engineeringCoreService: this.engineeringCoreService,
      surfaceTaskDispatcher: this.surfaceTaskDispatcher || null,
      learningCommandPack: this.learningCommandPack,
      codexRemoteCommandPack: this.codexRemoteCommandPack,
    });
    if (preDispatch.kind === 'handled') {
      return true;
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
    })) {
      return true;
    }

    return dispatchSharedSurfaceBuiltinCommand({
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
    });
  }

  private extractNaturalMemoryQuery(rawText: string): string | null {
    const original = String(rawText || '').trim();
    const quoted = original.match(/["'“”‘’]([^"'“”‘’]+)["'“”‘’]/);
    if (quoted?.[1]) {
      return quoted[1].trim();
    }

    const normalized = normalizeSharedSurfaceNaturalText(rawText);
    const markers = [' por ', ' sobre ', ' de ', ' pra '];
    for (const marker of markers) {
      const index = normalized.indexOf(marker);
      if (index >= 0) {
        const query = normalized.slice(index + marker.length).trim();
        if (query) {
          return query;
        }
      }
    }

    return null;
  }

  private extractNaturalLearningCandidateId(normalized: string): string | null {
    const candidateMatch = normalized.match(/\b(candidate:[a-z0-9._:-]+)\b/i);
    if (candidateMatch?.[1]) {
      return candidateMatch[1];
    }

    const explicitMatch = normalized.match(/\b(?:candidato|candidate)\s+([a-z0-9][a-z0-9._:-]+)\b/i);
    if (explicitMatch?.[1]) {
      return explicitMatch[1];
    }

    return null;
  }

}

function hasSharedSurfaceFlag(rawText: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)--${escaped}(?:\\s|$)`, 'i').test(String(rawText || ''));
}

function extractSharedSurfaceInlineValue(rawText: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(rawText || '').match(new RegExp(`(?:^|\\s)--${escaped}\\s+([^\\s]+)`, 'i'));
  return match?.[1]?.trim() || null;
}

