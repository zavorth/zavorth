import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { ParsedCommand } from '../../../../telegram/CommandParser.js';
import type { RuntimeDiagnosticsService } from '../../../../services/RuntimeDiagnosticsService.js';
import type { DiscordSurfacePolicyService } from '../../../../services/DiscordSurfacePolicyService.js';
import type { EngineeringCoreService } from '../../../../services/EngineeringCoreService.js';
import type { SurfaceTaskDispatcherLike } from '../../../../services/SurfaceRuntime.js';
import type { SharedSurfaceAccessCommandPack } from './SharedSurfaceAccessCommandPack.js';
import type { SharedSurfaceZavorthBridgeMobileCommandPack } from './SharedSurfaceZavorthBridgeMobileCommandPack.js';
import type { SharedSurfaceCapabilityCommandPack } from './SharedSurfaceCapabilityCommandPack.js';
import type { SharedSurfaceCodexRemoteCommandPack } from './SharedSurfaceCodexRemoteCommandPack.js';
import type { SharedSurfaceControlPlaneCommandPack } from './SharedSurfaceControlPlaneCommandPack.js';
import type { SharedSurfaceDesktopCommandPack } from './SharedSurfaceDesktopCommandPack.js';
import type { SharedSurfaceEcosystemCommandPack } from './SharedSurfaceEcosystemCommandPack.js';
import type { SharedSurfaceGatewayToolingCommandPack } from './SharedSurfaceGatewayToolingCommandPack.js';
import type { SharedSurfaceIntegrationCommandPack } from './SharedSurfaceIntegrationCommandPack.js';
import type { SharedSurfaceIntegrationHubCommandPack } from './SharedSurfaceIntegrationHubCommandPack.js';
import type { SharedSurfaceLearningCommandPack } from './SharedSurfaceLearningCommandPack.js';
import type { SharedSurfaceMemoryCommandPack } from './SharedSurfaceMemoryCommandPack.js';
import type { SharedSurfaceNaturalMeshCommandPack } from './SharedSurfaceNaturalMeshCommandPack.js';
import type { SharedSurfaceOperationsCommandPack } from './SharedSurfaceOperationsCommandPack.js';
import type { SharedSurfacePresentationCommandPack } from './SharedSurfacePresentationCommandPack.js';
import type { SharedSurfaceRuntimeMaintenanceCommandPack } from './SharedSurfaceRuntimeMaintenanceCommandPack.js';
import type { SharedSurfaceSessionCommandPack } from './SharedSurfaceSessionCommandPack.js';
import type { SharedSurfaceSessionNodeCommandPack } from './SharedSurfaceSessionNodeCommandPack.js';
import type { SharedSurfaceTaskControlCommandPack } from './SharedSurfaceTaskControlCommandPack.js';
import type { SharedSurfaceTaskVariationCommandPack } from './SharedSurfaceTaskVariationCommandPack.js';
import type { SharedSurfaceTenantGovernanceCommandPack } from './SharedSurfaceTenantGovernanceCommandPack.js';
import type { SharedSurfaceWatchModeCommandPack } from './SharedSurfaceWatchModeCommandPack.js';
import type { SharedSurfaceWorkflowGovernanceCommandPack } from './SharedSurfaceWorkflowGovernanceCommandPack.js';
import {
  parseSharedSurfaceNaturalLearningIntent,
  parseSharedSurfaceNaturalMemoryIntent,
} from './SharedSurfaceNaturalIntentSupport.js';
import { resolveNaturalOperationalStatusCommand } from './SharedSurfaceNaturalOperationalStatus.js';

export type SharedSurfacePreDispatchResult =
  | { kind: 'handled' }
  | { kind: 'resolved'; command: ParsedCommand };

export type SharedSurfaceCommandPreDispatchContext = {
  ctx: IMessageContext;
  rawText: string;
  parsed?: ParsedCommand | null;
  parse: (rawText: string) => ParsedCommand;
  discordSurfacePolicyService: Pick<
    DiscordSurfacePolicyService,
    'canUseOperationalCommand' | 'formatOperationalCommandDenied' | 'isOperationalCommand'
  >;
  presentationCommandPack: Pick<SharedSurfacePresentationCommandPack, 'parseRuntimeMaintenanceIntent'>;
  runtimeMaintenanceCommandPack: Pick<
    SharedSurfaceRuntimeMaintenanceCommandPack,
    'handleRuntimeMaintenanceIntent'
  >;
  zavorthBridgeMobileCommandPack: Pick<
    SharedSurfaceZavorthBridgeMobileCommandPack,
    'parseNaturalIntent' | 'handle'
  >;
  naturalMeshCommandPack: Pick<SharedSurfaceNaturalMeshCommandPack, 'maybeHandle'>;
  ecosystemCommandPack: Pick<SharedSurfaceEcosystemCommandPack, 'maybeHandleNaturalInvocation'>;
  memoryCommandPack: Pick<SharedSurfaceMemoryCommandPack, 'handleNaturalMemoryIntent'>;
  sessionCommandPack: Pick<SharedSurfaceSessionCommandPack, 'maybeHandleNaturalSession'>;
  workflowGovernanceCommandPack: Pick<
    SharedSurfaceWorkflowGovernanceCommandPack,
    'maybeHandleNaturalPermission' | 'maybeHandleExplicitSelfModification' | 'maybeHandleNaturalWorkflow'
  >;
  taskControlCommandPack: Pick<
    SharedSurfaceTaskControlCommandPack,
    'maybeHandleNaturalTaskApproval' | 'maybeHandleNaturalTaskControl' | 'maybeHandleNaturalRecentTaskFollowup'
  >;
  taskVariationCommandPack: Pick<SharedSurfaceTaskVariationCommandPack, 'maybeHandle'>;
  engineeringCoreService: Pick<EngineeringCoreService, 'maybeHandleSurfaceRequest'> | null;
  surfaceTaskDispatcher: SurfaceTaskDispatcherLike | null;
  learningCommandPack: Pick<SharedSurfaceLearningCommandPack, 'handleNaturalLearningIntent'>;
  codexRemoteCommandPack: Pick<SharedSurfaceCodexRemoteCommandPack, 'parseNaturalIntent'>;
};

export async function preDispatchSharedSurfaceCommand(
  deps: SharedSurfaceCommandPreDispatchContext,
): Promise<SharedSurfacePreDispatchResult> {
  const { ctx, rawText, parsed } = deps;
  const isNaturalText = !parsed && !rawText.startsWith('/');

  const maintenanceIntent = deps.presentationCommandPack.parseRuntimeMaintenanceIntent(rawText);
  if (maintenanceIntent) {
    if (isDiscordOperationalCommandDenied(deps.discordSurfacePolicyService, ctx)) {
      await ctx.reply(deps.discordSurfacePolicyService.formatOperationalCommandDenied());
      return { kind: 'handled' };
    }
    await deps.runtimeMaintenanceCommandPack.handleRuntimeMaintenanceIntent(ctx, maintenanceIntent);
    return { kind: 'handled' };
  }

  const zavorthBridgeMobileIntent = deps.zavorthBridgeMobileCommandPack.parseNaturalIntent(rawText);
  if (zavorthBridgeMobileIntent) {
    await deps.zavorthBridgeMobileCommandPack.handle(ctx, zavorthBridgeMobileIntent);
    return { kind: 'handled' };
  }

  if (await deps.naturalMeshCommandPack.maybeHandle(ctx, rawText)) {
    return { kind: 'handled' };
  }

  const naturalOperationalStatusCommand = isNaturalText
    ? resolveNaturalOperationalStatusCommand(rawText)
    : null;
  if (naturalOperationalStatusCommand) {
    return { kind: 'resolved', command: deps.parse(naturalOperationalStatusCommand) };
  }

  const naturalMemoryIntent = isNaturalText
    ? parseSharedSurfaceNaturalMemoryIntent(rawText)
    : null;
  if (naturalMemoryIntent) {
    await deps.memoryCommandPack.handleNaturalMemoryIntent(ctx, naturalMemoryIntent);
    return { kind: 'handled' };
  }

  if (isNaturalText && await deps.sessionCommandPack.maybeHandleNaturalSession(ctx, rawText)) {
    return { kind: 'handled' };
  }

  if (isNaturalText && await deps.workflowGovernanceCommandPack.maybeHandleNaturalPermission(ctx, rawText)) {
    return { kind: 'handled' };
  }

  if (isNaturalText && await deps.taskControlCommandPack.maybeHandleNaturalTaskApproval(ctx, rawText)) {
    return { kind: 'handled' };
  }

  if (isNaturalText && await deps.taskVariationCommandPack.maybeHandle(ctx, rawText)) {
    return { kind: 'handled' };
  }

  if (isNaturalText && await deps.ecosystemCommandPack.maybeHandleNaturalInvocation(ctx, rawText)) {
    return { kind: 'handled' };
  }

  if (isNaturalText && await deps.taskControlCommandPack.maybeHandleNaturalTaskControl(ctx, rawText)) {
    return { kind: 'handled' };
  }

  if (isNaturalText && await deps.taskControlCommandPack.maybeHandleNaturalRecentTaskFollowup(ctx, rawText)) {
    return { kind: 'handled' };
  }

  if (isNaturalText && deps.engineeringCoreService) {
    const engineeringHandled = await deps.engineeringCoreService.maybeHandleSurfaceRequest(
      ctx,
      deps.surfaceTaskDispatcher,
    );
    if (engineeringHandled) {
      return { kind: 'handled' };
    }
  }

  if (isNaturalText && await deps.workflowGovernanceCommandPack.maybeHandleExplicitSelfModification(ctx, rawText)) {
    return { kind: 'handled' };
  }

  const naturalLearningIntent = isNaturalText
    ? parseSharedSurfaceNaturalLearningIntent(rawText)
    : null;
  if (naturalLearningIntent) {
    await deps.learningCommandPack.handleNaturalLearningIntent(ctx, naturalLearningIntent);
    return { kind: 'handled' };
  }

  if (isNaturalText && await deps.workflowGovernanceCommandPack.maybeHandleNaturalWorkflow(ctx, rawText)) {
    return { kind: 'handled' };
  }

  const codexRemoteNaturalCommand = isNaturalText
    ? deps.codexRemoteCommandPack.parseNaturalIntent(rawText)
    : null;
  const resolved = parsed || deps.parse(codexRemoteNaturalCommand || rawText);
  if (
    ctx.platform === 'discord' &&
    deps.discordSurfacePolicyService.isOperationalCommand(resolved.command_type) &&
    !deps.discordSurfacePolicyService.canUseOperationalCommand(String(ctx.userId || '').trim(), {
      isDirectMessage: !ctx.isGroup,
    })
  ) {
    await ctx.reply(deps.discordSurfacePolicyService.formatOperationalCommandDenied());
    return { kind: 'handled' };
  }

  return { kind: 'resolved', command: resolved };
}

export type SharedSurfaceCommandPackDispatchContext = {
  ctx: IMessageContext;
  command: ParsedCommand;
  controlPlaneCommandPack: Pick<SharedSurfaceControlPlaneCommandPack, 'maybeHandle'>;
  accessCommandPack: Pick<SharedSurfaceAccessCommandPack, 'maybeHandle'>;
  ecosystemCommandPack: Pick<SharedSurfaceEcosystemCommandPack, 'maybeHandle'>;
  integrationHubCommandPack: Pick<SharedSurfaceIntegrationHubCommandPack, 'maybeHandle'>;
  integrationCommandPack: Pick<SharedSurfaceIntegrationCommandPack, 'maybeHandle'>;
  learningCommandPack: Pick<SharedSurfaceLearningCommandPack, 'maybeHandle'>;
  memoryCommandPack: Pick<SharedSurfaceMemoryCommandPack, 'maybeHandle'>;
  operationsCommandPack: Pick<SharedSurfaceOperationsCommandPack, 'maybeHandle'>;
  runtimeMaintenanceCommandPack: Pick<SharedSurfaceRuntimeMaintenanceCommandPack, 'maybeHandle'>;
  watchModeCommandPack: Pick<SharedSurfaceWatchModeCommandPack, 'maybeHandle'>;
  sessionNodeCommandPack: Pick<SharedSurfaceSessionNodeCommandPack, 'maybeHandle'>;
  workflowGovernanceCommandPack: Pick<SharedSurfaceWorkflowGovernanceCommandPack, 'maybeHandleCommand'>;
};

export async function dispatchSharedSurfaceCommandPacks(
  deps: SharedSurfaceCommandPackDispatchContext,
): Promise<boolean> {
  const { ctx, command } = deps;
  const { command_type, command_args } = command;

  if (await deps.controlPlaneCommandPack.maybeHandle(ctx, command_type, command_args)) {
    return true;
  }
  if (await deps.accessCommandPack.maybeHandle(ctx, command_type, command_args)) {
    return true;
  }
  if (await deps.ecosystemCommandPack.maybeHandle(ctx, command_type, command_args)) {
    return true;
  }
  if (await deps.integrationHubCommandPack.maybeHandle(ctx, command_type, command_args)) {
    return true;
  }
  if (await deps.integrationCommandPack.maybeHandle(ctx, command_type, command_args)) {
    return true;
  }
  if (await deps.learningCommandPack.maybeHandle(ctx, command_type, command_args)) {
    return true;
  }
  if (await deps.memoryCommandPack.maybeHandle(ctx, command_type, command_args)) {
    return true;
  }
  if (await deps.operationsCommandPack.maybeHandle(ctx, command_type, command_args)) {
    return true;
  }
  if (await deps.runtimeMaintenanceCommandPack.maybeHandle(ctx, command_type, command_args)) {
    return true;
  }
  if (await deps.watchModeCommandPack.maybeHandle(ctx, command_type, command_args)) {
    return true;
  }
  if (await deps.sessionNodeCommandPack.maybeHandle(ctx, command_type, command_args)) {
    return true;
  }
  if (await deps.workflowGovernanceCommandPack.maybeHandleCommand(ctx, command_type, command_args)) {
    return true;
  }

  return false;
}

export type SharedSurfaceBuiltinDispatchContext = {
  ctx: IMessageContext;
  command: ParsedCommand;
  runtimeDiagnostics: Pick<RuntimeDiagnosticsService, 'writeSnapshot'>;
  presentationCommandPack: Pick<
    SharedSurfacePresentationCommandPack,
    'renderHelp' | 'handleCommandCatalog' | 'handleStatus' | 'formatSecurityMeshReply'
  >;
  desktopCommandPack: Pick<
    SharedSurfaceDesktopCommandPack,
    'handleDoctor' | 'handleProductMode' | 'handleCompanion' | 'handleWorkspace'
  >;
  gatewayToolingCommandPack: Pick<
    SharedSurfaceGatewayToolingCommandPack,
    'handleModels' | 'handleAIGateway' | 'handleGateway' | 'handleTools' | 'handleHooks'
  >;
  codexRemoteCommandPack: Pick<SharedSurfaceCodexRemoteCommandPack, 'handle'>;
  zavorthBridgeMobileCommandPack: Pick<SharedSurfaceZavorthBridgeMobileCommandPack, 'handle'>;
  tenantGovernanceCommandPack: Pick<
    SharedSurfaceTenantGovernanceCommandPack,
    'handleTeams' | 'handleTenants'
  >;
  capabilityCommandPack: Pick<
    SharedSurfaceCapabilityCommandPack,
    'buildCapabilitiesReply' | 'handleEnable' | 'handleDisable'
  >;
  taskControlCommandPack: Pick<
    SharedSurfaceTaskControlCommandPack,
    'handleTaskApprovalCommand' | 'handleTaskRejectionCommand' | 'handleTaskUndoCommand'
  >;
};

export async function dispatchSharedSurfaceBuiltinCommand(
  deps: SharedSurfaceBuiltinDispatchContext,
): Promise<boolean> {
  const { ctx, command } = deps;
  const { command_type, command_args } = command;

  switch (command_type) {
    case '/ping':
      await ctx.reply(`Zavorth respondendo via ${ctx.platform}. Pong.`);
      return true;
    case '/help':
      await ctx.reply(deps.presentationCommandPack.renderHelp(ctx));
      return true;
    case '/commands':
      await deps.presentationCommandPack.handleCommandCatalog(ctx, command_args);
      return true;
    case '/status':
      await deps.presentationCommandPack.handleStatus(ctx, deps.runtimeDiagnostics.writeSnapshot());
      return true;
    case '/doctor':
      await deps.desktopCommandPack.handleDoctor(ctx, command_args);
      return true;
    case '/mode':
      await deps.desktopCommandPack.handleProductMode(ctx, command_args);
      return true;
    case '/companion':
      await deps.desktopCommandPack.handleCompanion(ctx, command_args);
      return true;
    case '/workspace':
      await deps.desktopCommandPack.handleWorkspace(ctx, command_args);
      return true;
    case '/models':
      await deps.gatewayToolingCommandPack.handleModels(ctx);
      return true;
    case '/codexremote':
      await deps.codexRemoteCommandPack.handle(ctx, command_args);
      return true;
    case '/agmobile':
      await deps.zavorthBridgeMobileCommandPack.handle(
        ctx,
        String(command_args || '').trim().toLowerCase() || 'status',
      );
      return true;
    case '/AIGateway':
      await deps.gatewayToolingCommandPack.handleAIGateway(ctx, command_args);
      return true;
    case '/teams':
      await deps.tenantGovernanceCommandPack.handleTeams(ctx, command_args);
      return true;
    case '/tenants':
      await deps.tenantGovernanceCommandPack.handleTenants(ctx, command_args);
      return true;
    case '/capabilities':
      await ctx.reply(deps.capabilityCommandPack.buildCapabilitiesReply());
      return true;
    case '/enable':
      await deps.capabilityCommandPack.handleEnable(ctx, command_args);
      return true;
    case '/disable':
      await deps.capabilityCommandPack.handleDisable(ctx, command_args);
      return true;
    case '/gateway':
      await deps.gatewayToolingCommandPack.handleGateway(ctx);
      return true;
    case '/tools':
      await deps.gatewayToolingCommandPack.handleTools(ctx, command_args);
      return true;
    case '/hooks':
      await deps.gatewayToolingCommandPack.handleHooks(ctx, command_args);
      return true;
    case '/runtime':
      await ctx.reply(deps.presentationCommandPack.formatSecurityMeshReply());
      return true;
    case '/approve':
      await deps.taskControlCommandPack.handleTaskApprovalCommand(ctx, command_args);
      return true;
    case '/reject':
      await deps.taskControlCommandPack.handleTaskRejectionCommand(ctx, command_args);
      return true;
    case '/undo':
      await deps.taskControlCommandPack.handleTaskUndoCommand(ctx, command_args);
      return true;
    default:
      return false;
  }
}

function isDiscordOperationalCommandDenied(
  policyService: Pick<
    DiscordSurfacePolicyService,
    'canUseOperationalCommand' | 'formatOperationalCommandDenied'
  >,
  ctx: IMessageContext,
): boolean {
  return (
    ctx.platform === 'discord' &&
    !policyService.canUseOperationalCommand(String(ctx.userId || '').trim(), {
      isDirectMessage: !ctx.isGroup,
    })
  );
}
