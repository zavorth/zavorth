import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { ParsedCommand } from '../../../../gateways/channels/telegram/CommandParser.js';
import type { RuntimeDiagnosticsService } from '../../../../services/RuntimeDiagnosticsService.js';
import type { DiscordSurfacePolicyService } from '../../../../services/DiscordSurfacePolicyService.js';
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
import type { SharedSurfaceOperationsCommandPack } from './SharedSurfaceOperationsCommandPack.js';
import type { SharedSurfacePresentationCommandPack } from './SharedSurfacePresentationCommandPack.js';
import type { SharedSurfaceRuntimeMaintenanceCommandPack } from './SharedSurfaceRuntimeMaintenanceCommandPack.js';
import type { SharedSurfaceSessionNodeCommandPack } from './SharedSurfaceSessionNodeCommandPack.js';
import type { SharedSurfaceTaskControlCommandPack } from './SharedSurfaceTaskControlCommandPack.js';
import type { SharedSurfaceTenantGovernanceCommandPack } from './SharedSurfaceTenantGovernanceCommandPack.js';
import type { SharedSurfaceWatchModeCommandPack } from './SharedSurfaceWatchModeCommandPack.js';
import type { SharedSurfaceWorkflowGovernanceCommandPack } from './SharedSurfaceWorkflowGovernanceCommandPack.js';
import type { SharedSurfaceSlashEnhancementCommandPack } from './SharedSurfaceSlashEnhancementCommandPack.js';
import { naturalizeSharedSurfaceArgs } from './NaturalSlashConvention.js';
import {
  isSurfaceAgentFirstEnabled,
  recordAgentFirstMetric,
  shouldPassNaturalTextToAgent,
} from './SurfaceAgentFirstMode.js';

export type SharedSurfacePreDispatchResult =
  | { kind: 'handled' }
  | { kind: 'resolved'; command: ParsedCommand }
  /** Free text falls through to the agent gateway (no intent-regex packs). */
  | { kind: 'pass_to_agent'; reason: string };

/**
 * Minimal pre-dispatch deps (agent-first + slash/parse only).
 * Free-text natural pack wiring was removed — not assembly-compat stubs.
 */
export type SharedSurfaceCommandPreDispatchContext = {
  ctx: IMessageContext;
  rawText: string;
  parsed?: ParsedCommand | null;
  parse: (rawText: string) => ParsedCommand;
  discordSurfacePolicyService: Pick<
    DiscordSurfacePolicyService,
    'canUseOperationalCommand' | 'formatOperationalCommandDenied' | 'isOperationalCommand'
  >;
};

/**
 * Pre-dispatch free text / slash routing.
 *
 * 1. Agent-first free text → pass_to_agent (no intent-regex).
 * 2. Slash → deterministic metric, then parse + Discord operational deny check.
 * 3. Non-agent free text (Discord without flag, or TELEGRAM_AGENT_FIRST=0) →
 *    parse(rawText) only — natural regex packs are never run.
 */
export async function preDispatchSharedSurfaceCommand(
  deps: SharedSurfaceCommandPreDispatchContext,
): Promise<SharedSurfacePreDispatchResult> {
  const { ctx, rawText, parsed } = deps;

  // 1) Free text → agent (Telegram default; optional surface-wide flag)
  if (
    shouldPassNaturalTextToAgent({
      platform: ctx.platform,
      rawText,
      hasParsedSlashCommand: Boolean(parsed?.command_type?.startsWith('/')),
    })
  ) {
    recordAgentFirstMetric('naturalSkippedForAgent');
    return {
      kind: 'pass_to_agent',
      reason:
        'agent-first free text (no intent-regex); use slash or callback_data for approve/reject/undo',
    };
  }

  // 2) Slash stays deterministic
  if (rawText.startsWith('/') || parsed?.command_type?.startsWith('/')) {
    recordAgentFirstMetric('slashDeterministic');
  }

  // Resolve command via parse only — free-text natural interceptors removed.
  // Natural packs are not invoked even when agent-first is disabled.
  const resolved = parsed || deps.parse(rawText);
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

/** Exported for tests / diagnostics. */
export { isSurfaceAgentFirstEnabled };

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
  slashEnhancementCommandPack?: Pick<SharedSurfaceSlashEnhancementCommandPack, 'maybeHandle'> | null;
};

export async function dispatchSharedSurfaceCommandPacks(
  deps: SharedSurfaceCommandPackDispatchContext,
): Promise<boolean> {
  const { ctx, command } = deps;
  const { command_type } = command;
  // Universal natural UX: rewrite free-text / empty args for ALL packs (existing + future).
  const command_args = naturalizeSharedSurfaceArgs(command_type, command.command_args).args;

  // Optional slash-command pack for tests without full wiring
  if (deps.slashEnhancementCommandPack
    && await deps.slashEnhancementCommandPack.maybeHandle(ctx, command_type, command_args)) {
    return true;
  }

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
  const { command_type } = command;
  const command_args = naturalizeSharedSurfaceArgs(command_type, command.command_args).args;

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
