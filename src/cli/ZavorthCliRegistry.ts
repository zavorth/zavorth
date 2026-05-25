import * as fs from 'fs';
import * as path from 'path';
import { globalSpinner } from './presentation/TerminalSpinner.js';
import readline from 'readline/promises';
import type { Interface as ReadlineInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { InlineKeyboard } from 'grammy';
import type { NodeMeshActivitySnapshot, NodeMeshNodeKind } from '../contracts/NodeMeshContract.js';
import { config } from '../config/index.js';
import type { IMessageContext } from '../contracts/IMessageBroker.js';
import type { Task } from '../contracts/TaskContract.js';
import { Database } from '../storage/Database.js';
import { LogRepository } from '../storage/LogRepository.js';
import { TaskRepository } from '../storage/TaskRepository.js';
import { TaskManager } from '../orchestrator/TaskManager.js';
import { PermissionService } from '../services/PermissionService.js';
import { SelfModificationCommandService } from '../services/SelfModificationCommandService.js';
import { RuntimeDiagnosticsService } from '../services/RuntimeDiagnosticsService.js';
import {
  RuntimeAccessReadinessService,
  type RuntimeAccessReadinessReport,
} from '../runtime/access/RuntimeAccessReadinessService.js';
import {
  RuntimeBootstrapService,
  type RuntimeBootstrapReport,
} from '../runtime/access/RuntimeBootstrapService.js';
import {
  RuntimeBootstrapRepairService,
  type RuntimeBootstrapRepairReport,
} from '../runtime/access/RuntimeBootstrapRepairService.js';
import { ZavorthMemoryPlaneService } from '../services/ZavorthMemoryPlaneService.js';
import { ZavorthLayeredMemoryService } from '../services/ZavorthLayeredMemoryService.js';
import {
  ZavorthLearningPlaneService,
  type LearningPlaneActionExecution,
  type LearningPlaneSnapshot,
} from '../services/ZavorthLearningPlaneService.js';
import {
  ZavorthPlatformRegistryService,
  type ZavorthPlatformRegistrySnapshot,
  type ZavorthPlatformRegistryStatusSummarySnapshot,
  type ZavorthPlatformRegistrySummarySnapshot,
} from '../services/ZavorthPlatformRegistryService.js';
import { ZavorthPlatformCatalogSyncService } from '../services/ZavorthPlatformCatalogSyncService.js';
import {
  ZavorthPlatformActionService,
  type ZavorthPlatformActionExecution,
} from '../services/ZavorthPlatformActionService.js';
import {
  ZavorthPackagePublisher,
  type PublishResult as ZavorthPlatformPublishResult,
} from '../platform/publish/ZavorthPackagePublisher.js';
import { ZavorthHookPlaneService, type ZavorthHookPlaneSnapshot } from '../services/ZavorthHookPlaneService.js';
import { ZavorthPluginActionService } from '../services/ZavorthPluginActionService.js';
import { ZavorthPluginRegistryService } from '../services/ZavorthPluginRegistryService.js';
import { ZavorthToolSurfaceService } from '../services/ZavorthToolSurfaceService.js';
import type { ZavorthToolSurfaceSnapshot } from '../services/ZavorthToolSurfaceService.js';
import { ZavorthSessionPlaneService } from '../services/ZavorthSessionPlaneService.js';
import type {
  ZavorthSessionPlaneSnapshot,
  ZavorthSessionPlaneStatusSummarySnapshot,
} from '../services/ZavorthSessionPlaneService.js';
import { ZavorthNodeMeshService } from '../services/ZavorthNodeMeshService.js';
import { NodeCapabilityService } from '../services/NodeCapabilityService.js';
import { NodeDeviceProfileService } from '../services/NodeDeviceProfileService.js';
import { NodeInvocationStoreService } from '../services/NodeInvocationStoreService.js';
import { NodeInvokeService } from '../services/NodeInvokeService.js';
import { NodePairingService } from '../services/NodePairingService.js';
import {
  AIGatewayProxyService,
  type AIGatewayProxyStatus,
} from '../services/AIGatewayProxyService.js';
import { ZavorthGatewayLauncherService } from '../services/ZavorthGatewayLauncherService.js';
import { ZavorthSessionToolsService } from '../runtime/sessions/ZavorthSessionToolsService.js';
import type { DomainRegistrySnapshot, DomainRegistrySummarySnapshot } from '../domain/DomainRegistry.js';
import { NodeRegistryService } from '../services/NodeRegistryService.js';
import { ZavorthGatewayService, type ZavorthGatewaySnapshot } from '../services/ZavorthGatewayService.js';
import { GatewayChannelRegistryService } from '../services/GatewayChannelRegistryService.js';
import {
  DiscordRuntimeChannelAdapter,
  EmailRuntimeChannelAdapter,
  IMessageRuntimeChannelAdapter,
  SignalRuntimeChannelAdapter,
  SlackRuntimeChannelAdapter,
  TeamsRuntimeChannelAdapter,
  WhatsAppRuntimeChannelAdapter,
} from '../services/GatewayRuntimeChannelAdapters.js';
import { GatewaySessionReadModelService } from '../runtime/sessions/GatewaySessionReadModelService.js';
import { GatewaySessionService } from '../runtime/sessions/GatewaySessionService.js';
import {
  GatewaySessionStoreService,
  type GatewaySessionSpawnSnapshot,
} from '../runtime/sessions/GatewaySessionStoreService.js';
import {
  GatewaySessionToolsService,
  type GatewaySessionSendResult,
} from '../runtime/sessions/GatewaySessionToolsService.js';
import { MemoryService } from '../services/MemoryService.js';
import {
  AutoRepairService,
  type AutoRepairReport,
  type AutoRepairRunResult,
} from '../services/AutoRepairService.js';
import {
  OperationsActionService,
  type OperationsActionExecution,
} from '../services/OperationsActionService.js';
import {
  OperationsCockpitService,
  type OperationsCockpitSnapshot,
} from '../services/OperationsCockpitService.js';
import { OperationsHealthService } from '../observability/OperationsHealthService.js';
import {
  OperatorBriefService,
  type OperatorBriefSnapshot,
} from '../observability/OperatorBriefService.js';
import {
  GatewayCompatibilityDoctorService,
  type AIGatewayCompatibilityDoctorReport,
} from '../services/GatewayCompatibilityDoctorService.js';
import {
  GatewayUpstreamSyncService,
  type AIGatewayUpstreamSyncReport,
} from '../services/GatewayUpstreamSyncService.js';
import { CanonicalPublicApiService } from '../api/public/CanonicalPublicApiService.js';
import {
  createInternalSurfaceCommandApi,
  type SurfaceCommandBoundary,
} from '../api/internal/InternalSurfaceApiCompat.js';
import type { OpsQualityDTO } from '../contracts/public/rest/platform-ops-dto.js';
import type { SurfaceTaskDispatcherLike } from '../services/SurfaceRuntime.js';
import { SurfaceTaskDispatchService } from '../services/SurfaceTaskDispatchService.js';
import {
  SupervisedRuntimeService,
  type SupervisedRuntimeInspection,
  type SupervisedReloadRequestResult,
} from '../services/SupervisedRuntimeService.js';
import { RuntimeCompositionService } from '../services/RuntimeCompositionService.js';
import { WorkspaceExtensionRegistryService } from '../services/WorkspaceExtensionRegistryService.js';
import { WorkspaceOperationalMemoryService } from '../runtime/context/WorkspaceOperationalMemoryService.js';
import { TrustedBoundary } from '../security/TrustedBoundary.js';
import { ExecutionGateway } from '../execution/ExecutionGateway.js';
import { LocalExecutor } from '../execution/LocalExecutor.js';
import { CodexExecutor } from '../execution/CodexExecutor.js';
import { StitchExecutor } from '../execution/StitchExecutor.js';
import { AiStudioExecutor } from '../execution/AiStudioExecutor.js';
import { HostIdentityService } from '../services/HostIdentityService.js';
import { BridgeManager } from '../orchestrator/BridgeManager.js';
import { VideoHandler } from '../telegram/VideoHandler.js';
import { TelegramConversationController } from '../telegram/controllers/TelegramConversationController.js';
import { TelegramExecutionController } from '../telegram/controllers/TelegramExecutionController.js';
import { TelegramPermissionController } from '../telegram/controllers/TelegramPermissionController.js';
import { TelegramPipelineController } from '../telegram/controllers/TelegramPipelineController.js';
import { TelegramTaskOrchestrationController } from '../telegram/controllers/TelegramTaskOrchestrationController.js';
import { CommandParser } from '../telegram/CommandParser.js';
import { AuditLogger } from '../monitoring/AuditLogger.js';
import { MultiAgentPipeline } from '../runtime/workflows/MultiAgentPipeline.js';
import { OperatorModeService } from '../services/OperatorModeService.js';
import { PresentationModeService } from '../services/PresentationModeService.js';
import { WorkspaceProfileService } from '../services/WorkspaceProfileService.js';
import { extractTaskPayload, getDefaultWorkspace, persistTask } from '../telegram/TelegramTaskSupport.js';
import {
  formatAutoRepairRunResult as renderAutoRepairRunResult,
  formatRuntimeAccessReadinessReport as renderRuntimeAccessReadinessReport,
  formatRuntimeBootstrapRepairReport as renderRuntimeBootstrapRepairReport,
  formatRuntimeBootstrapReport as renderRuntimeBootstrapReport,
  formatSupervisedReloadResult as renderSupervisedReloadResult,
} from './ZavorthCliOpsFormatting.js';
import {
  type CliContextSnapshot,
  type CliDomainsSnapshot,
  type CliHelpSnapshot,
  type CliStatusSnapshot,
  formatGatewaySnapshot,
  formatLearningActionExecution,
  formatLearningMetricsSnapshot,
  formatLearningSnapshot,
  formatLayeredMemoryProcedures,
  formatLayeredMemorySearch,
  formatLayeredMemoryStatus,
  formatMemoryPlaneSnapshot,
  formatPlatformSnapshot,
  formatPlatformSyncResult,
} from './ZavorthCliSurfaceHelpers.js';
import {
  applyInlineCliFlags,
  canonicalizeCliCommandInput,
  createCliReplConversationFlags,
  createCliReplSwitchConversationFlags,
  createDefaultSessionId,
  defaultWriter,
  executeCliLegacyUnifiedConversation,
  executeCliUniversalAgentRuntime,
  executeCliUniversalApprovalDecision,
  executeCliWorkflowQueueCommand,
  executeCliTaskDispatch,
  extractCommandArgs,
  formatCliNewConversationMessage,
  formatCliReplPrompt,
  formatCliSessionPlaneOutput,
  formatCliSharedSurfaceProductOutput,
  formatCliSwitchedConversationMessage,
  isCliIo,
  isCliNativeReadCommand,
  isCliReplNewConversationCommand,
  loadCliReplHistory,
  normalizeCliCommandName,
  normalizeCliInput,
  parseCliReplSwitchConversationTarget,
  persistCliReplHistory,
  requiresCliTaskRuntime,
  requiresNodeDoctorRuntime,
  resolveCliRuntimeProfile,
  withFilteredCliStartupLogs,
} from './ZavorthCliFlowHelpers.js';
import {
  buildCliContextSnapshot,
  buildCliDomainsSnapshot,
  buildCliHelpSnapshot,
  buildCliNodeMeshDoctorSnapshot,
  buildCliOperationsDoctorSnapshot,
  buildCliRuntimeAccessProbeInput,
  buildCliStatusSnapshot,
  formatAIGatewayDoctorReport,
  formatAIGatewayGatewayStatus,
  formatAIGatewaySyncReport,
  formatCliContextSnapshot,
  formatCliDomainsSnapshot,
  formatCliHelp,
  formatCliOperationsDoctorSnapshot,
  formatCliOpsQualitySnapshot,
  formatCliStatusSnapshot,
  formatHookPlaneSnapshot,
  formatNodeCapabilities,
  formatNodeInvokeResult,
  formatNodeMeshActivity,
  formatNodeMeshDoctorSnapshot,
  formatNodeMeshSnapshot,
  formatNodePairingDraft,
  formatNodeProfiles,
  formatOperationsActionDefinitions,
  formatOperationsActionExecution,
  formatOperationsCockpitSnapshot,
  formatOperatorBriefSnapshot,
  formatPlatformActionExecution,
  formatPlatformPublishResult,
  formatSessionSendResult,
  formatSessionSpawnResult,
  formatToolSurfaceSnapshot,
  parseCliNodeInvokeArgs,
  parseCliNodePairArgs,
  readCliBriefSnapshot,
  readCliCockpitSnapshot,
  readCliOpsQualitySnapshot,
  resolveCliHelpTopic,
  resolveNodeIntent,
  withCliConsoleSuppressed,
} from './ZavorthCliNativeRenderers.js';
import { formatLayeredMemoryMetrics } from './ZavorthCliRenderers.js';
import { formatCliChatAssistantMessage } from './ZavorthCliChatRenderers.js';
import {
  formatExperienceCommandResult,
  formatExperienceDiffs,
  formatExperienceHome,
  formatExperienceHud,
  formatExperienceLearning,
  formatExperiencePulse,
} from './ZavorthCliExperienceRenderer.js';
import { formatZavorthSelfHealingProjection } from './ZavorthCliSelfHealingRenderer.js';
import { ZavorthSelfHealingUxService } from '../services/ZavorthSelfHealingUxService.js';
import {
  DashboardAccessService,
  parseDashboardAccessAction,
  type DashboardAccessDoctorSnapshot,
  type DashboardAccessSnapshot,
} from '../services/DashboardAccessService.js';
import { ZavorthProductDemoService } from '../services/ZavorthProductDemoService.js';
import { ZavorthConnectorExperienceService } from '../services/ZavorthConnectorExperienceService.js';
import { ZavorthSmartCommandSurfaceService } from '../services/ZavorthSmartCommandSurfaceService.js';
import {
  formatCliChatReplyEventCard,
  formatCliRecoverableErrorEventCard,
  formatCliSuccessEventCard,
} from './ZavorthCliEventCards.js';
import {
  buildCliRuntimeFromOverrides as buildCliRuntimeFromOverridesImpl,
  buildSessionPlaneInput,
  parseZavorthCliArgs as parseZavorthCliArgsImpl,
  parseZavorthCliFlags as parseZavorthCliFlagsImpl,
  parseCliSessionSendArgs,
  resolveCliExecutionInput,
  resolveOperationsIntent,
  resolvePlatformIntent,
  resolveSessionTargetRef,
} from './ZavorthCliCommandHelpers.js';
import { handleZavorthCliRegistryNodesCommand } from './ZavorthCliRegistryNodes.js';
import { handleZavorthCliRegistryOpsCommand } from './ZavorthCliRegistryOps.js';
import { handleZavorthCliRegistryPlatformCommand } from './ZavorthCliRegistryPlatform.js';
import { handleZavorthCliRegistrySessionsCommand } from './ZavorthCliRegistrySessions.js';
import { handleZavorthCliRegistryTasksCommand } from './ZavorthCliRegistryTasks.js';
import { handleZavorthCliRegistrySupervisorCommand } from './ZavorthCliRegistrySupervisor.js';
import { handleZavorthCliRegistryHealCommand } from './ZavorthCliRegistryHeal.js';
import { handleZavorthCliRegistryReleaseCommand } from './ZavorthCliRegistryRelease.js';
import { handleZavorthCliRegistryWorkspaceCommand } from './ZavorthCliRegistryWorkspace.js';
import { handleZavorthUpdateCommand } from './update/ZavorthUpdateCommand.js';
import { handleZavorthCompletionsCommand } from './completions/ZavorthCompletionsCommand.js';
import { handleZavorthInspectCommand } from './inspect/ZavorthInspectCommand.js';
import { handleZavorthManagedConfigCommand } from './managed-config/ZavorthManagedConfigCommand.js';
import { handleZavorthLocalTaskCommand } from './local-task/ZavorthLocalTaskCommand.js';
import type {
  ZavorthCliFlags,
  ZavorthCliRuntime,
  CliExecutionResult,
  CliWriter,
} from './ZavorthCliContract.js';

export type {
  ZavorthCliDeps,
  ZavorthCliFlags,
  ZavorthCliIo,
  ZavorthCliRuntime,
  ZavorthCliServiceOverrides,
  CliExecutionResult,
  CliReadlineFactory,
  CliRuntimeProfile,
  CliWriter,
} from './ZavorthCliContract.js';

export const parseZavorthCliFlags = parseZavorthCliFlagsImpl;
export const parseZavorthCliArgs = parseZavorthCliArgsImpl;
export const buildCliRuntimeFromOverrides = buildCliRuntimeFromOverridesImpl;

export async function executeZavorthCliCommand(params: {
  rawInput: string;
  flags: ZavorthCliFlags;
  resolveRuntime: () => Promise<ZavorthCliRuntime>;
  writer: CliWriter;
}): Promise<CliExecutionResult> {
  const { rawInput, flags, writer } = params;
  const inline = applyInlineCliFlags(rawInput, flags);
  const effectiveFlags = inline.flags;
  const resolvedInput = resolveCliExecutionInput(inline.input);
  const commandName = String(resolvedInput.commandName || '').trim().toLowerCase() || null;

  const isSlow = commandName && (
    commandName === 'status' ||
    commandName === 'doctor' ||
    commandName === 'inspect' ||
    commandName === 'setup' ||
    commandName === 'run' ||
    commandName === 'task' ||
    commandName === 'workflows' ||
    commandName === 'discover' ||
    commandName === 'quarantine' ||
    commandName === 'arena' ||
    commandName === 'negotiate' ||
    commandName === 'rehearse' ||
    commandName === 'selfing' ||
    commandName === 'artifact-memory' ||
    commandName === 'personal-ops' ||
    commandName === 'agent-team-compiler' ||
    commandName === 'blueprint-completion' ||
    commandName === 'pre-canary' ||
    commandName === 'release' ||
    commandName === 'site-docs-demo' ||
    commandName === 'feedback-product-loop' ||
    commandName === 'pilot-loop' ||
    commandName === 'integration-showcase'
  );

  const showSpinner = isSlow && !effectiveFlags.json && process.stdout.isTTY;
  let spinnerActive = false;

  if (showSpinner) {
    globalSpinner.start(`Running '${commandName}'...`);
    spinnerActive = true;
  }

  const wrappedWriter: CliWriter = {
    line: (text: string) => {
      if (spinnerActive) {
        globalSpinner.stop();
        spinnerActive = false;
      }
      writer.line(text);
    },
    error: (text: string) => {
      if (spinnerActive) {
        globalSpinner.stop();
        spinnerActive = false;
      }
      writer.error(text);
    },
  };

  try {
    const result = await executeZavorthCliCommandInner({
      ...params,
      writer: wrappedWriter,
    });
    if (spinnerActive) {
      globalSpinner.succeed(`Finished '${commandName}'`);
      spinnerActive = false;
    }
    return result;
  } catch (error: any) {
    if (spinnerActive) {
      globalSpinner.fail(`Failed to run '${commandName}'`);
      spinnerActive = false;
    }
    const projection = new ZavorthSelfHealingUxService().buildProjection({
      attempted: commandName ? `Run '${commandName}'` : 'Run Zavorth',
      commandName,
      commandText: rawInput,
      error,
      debug: effectiveFlags.json || process.argv.includes('--debug') || process.argv.includes('--verbose') || process.env.ZAVORTH_DEBUG === '1',
    });
    const body = effectiveFlags.json
      ? JSON.stringify(projection, null, 2)
      : formatZavorthSelfHealingProjection(projection);
    wrappedWriter.line(body);
    return {
      ok: false,
      handled: true,
      output: [body],
      error: error?.message || 'Zavorth command failed.',
    };
  }
}

async function executeZavorthCliCommandInner(params: {
  rawInput: string;
  flags: ZavorthCliFlags;
  resolveRuntime: () => Promise<ZavorthCliRuntime>;
  writer: CliWriter;
}): Promise<CliExecutionResult> {
  const { rawInput, flags, resolveRuntime, writer } = params;
  const inline = applyInlineCliFlags(rawInput, flags);
  const effectiveFlags = inline.flags;
  const resolvedInput = resolveCliExecutionInput(inline.input);
  const normalized = resolvedInput.surfaceText;
  const commandName = String(resolvedInput.commandName || '').trim().toLowerCase() || null;
  const args = resolvedInput.args;

  if (!normalized) {
    const runtime = await resolveRuntime();
    const snapshot = runtime.experienceCoreService?.buildHome({
      surface: effectiveFlags.platform,
      userId: effectiveFlags.userId,
      sessionId: effectiveFlags.sessionId,
      workspace: effectiveFlags.workspaceHint || null,
    });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot || { ok: false, error: 'Experience Core indisponivel.' }, null, 2)
      : snapshot
        ? formatExperienceHome(snapshot)
        : 'Experience Core indisponivel neste runtime.';
    writer.line(body);
    return { ok: Boolean(snapshot), handled: true, output: [body], error: snapshot ? null : 'Experience Core unavailable.' };
  }

  if (commandName === 'context') {
    const snapshot = buildCliContextSnapshot(effectiveFlags);
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatCliContextSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'help') {
    const helpTopic = resolveCliHelpTopic(args);
    const body = effectiveFlags.json
      ? JSON.stringify(buildCliHelpSnapshot(helpTopic), null, 2)
      : formatCliHelp(helpTopic);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'home' || commandName === 'experience') {
    const runtime = await resolveRuntime();
    const snapshot = runtime.experienceCoreService?.buildHome({
      surface: effectiveFlags.platform,
      userId: effectiveFlags.userId,
      sessionId: effectiveFlags.sessionId,
      workspace: effectiveFlags.workspaceHint || null,
    });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot || { ok: false, error: 'Experience Core indisponivel.' }, null, 2)
      : snapshot
        ? formatExperienceHome(snapshot)
        : 'Experience Core indisponivel neste runtime.';
    writer.line(body);
    return { ok: Boolean(snapshot), handled: true, output: [body], error: snapshot ? null : 'Experience Core unavailable.' };
  }

  if (commandName === 'pulse') {
    const runtime = await resolveRuntime();
    const responseProfile = parseExperienceResponseProfile(args || normalized);
    if (responseProfile && runtime.experienceCoreService) {
      await runtime.experienceCoreService.executeCommand({
        contractVersion: 'ExperienceCommand/v1',
        text: `use estilo ${responseProfile}`,
        intent: 'ask',
        surface: effectiveFlags.platform,
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
        workspace: effectiveFlags.workspaceHint || null,
        responseProfile,
      });
    }
    const snapshot = runtime.experienceCoreService?.buildHome({
      surface: effectiveFlags.platform,
      userId: effectiveFlags.userId,
      sessionId: effectiveFlags.sessionId,
      workspace: effectiveFlags.workspaceHint || null,
      responseProfile,
    });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot?.daily?.pulse || { ok: false, error: 'Zavorth Pulse indisponivel.' }, null, 2)
      : snapshot
        ? formatExperiencePulse(snapshot)
        : 'Zavorth Pulse indisponivel neste runtime.';
    writer.line(body);
    return { ok: Boolean(snapshot), handled: true, output: [body], error: snapshot ? null : 'Zavorth Pulse unavailable.' };
  }

  if (commandName === 'hud') {
    const runtime = await resolveRuntime();
    const snapshot = runtime.experienceCoreService?.buildHome({
      surface: effectiveFlags.platform,
      userId: effectiveFlags.userId,
      sessionId: effectiveFlags.sessionId,
      workspace: effectiveFlags.workspaceHint || null,
      responseProfile: parseExperienceResponseProfile(args || normalized),
    });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot || { ok: false, error: 'Experience Core indisponivel.' }, null, 2)
      : snapshot
        ? formatExperienceHud(snapshot)
        : 'Experience Core indisponivel neste runtime.';
    writer.line(body);
    return { ok: Boolean(snapshot), handled: true, output: [body], error: snapshot ? null : 'Experience Core unavailable.' };
  }

  if (commandName === 'diff') {
    const runtime = await resolveRuntime();
    if (runtime.experienceCoreService) {
      const diffDecision = parseExperienceDiffCliArgs(args);
      if (diffDecision) {
        const result = await runtime.experienceCoreService.executeCommand({
          contractVersion: 'ExperienceCommand/v1',
          text: `diff ${args}`.trim(),
          intent: 'run',
          surface: effectiveFlags.platform,
          userId: effectiveFlags.userId,
          sessionId: effectiveFlags.sessionId,
          workspace: effectiveFlags.workspaceHint || null,
          diffDecision,
        });
        const body = effectiveFlags.json
          ? JSON.stringify(result, null, 2)
          : formatExperienceCommandResult(result);
        writer.line(body);
        return { ok: result.ok, handled: true, output: [body], error: result.error };
      }
      const snapshot = runtime.experienceCoreService.buildHome({
        surface: effectiveFlags.platform,
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
        workspace: effectiveFlags.workspaceHint || null,
      });
      const body = effectiveFlags.json
        ? JSON.stringify(snapshot.diffReviews || [], null, 2)
        : formatExperienceDiffs(snapshot);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
  }

  if (commandName === 'ask' || commandName === 'run') {
    const runtime = await resolveRuntime();
    if (runtime.experienceCoreService) {
      const requestText = args || (commandName === 'run' ? normalized : '');
      const responseProfile = parseExperienceResponseProfile(requestText);
      const result = await runtime.experienceCoreService.executeCommand({
        contractVersion: 'ExperienceCommand/v1',
        text: requestText,
        intent: commandName === 'run' ? 'run' : 'ask',
        surface: effectiveFlags.platform,
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
        workspace: effectiveFlags.workspaceHint || null,
        trustMode: 'protected',
        responseProfile,
        metadata: {
          cliCommandName: commandName,
          repl: effectiveFlags.repl,
          headless: effectiveFlags.headless,
          approvalMode: effectiveFlags.approvalMode || undefined,
          responseProfile: responseProfile || undefined,
        },
      });
      const body = effectiveFlags.json
        ? JSON.stringify(result, null, 2)
        : formatExperienceCommandResult(result);
      writer.line(body);
      return { ok: result.ok, handled: true, output: [body], error: result.error };
    }
  }

  if (commandName === 'learn' || commandName === 'learning') {
    const runtime = await resolveRuntime();
    if (runtime.experienceCoreService) {
      const learning = parseExperienceLearningCliArgs(args);
      if (!learning) {
        const snapshot = runtime.experienceCoreService.buildHome({
          surface: effectiveFlags.platform,
          userId: effectiveFlags.userId,
          sessionId: effectiveFlags.sessionId,
          workspace: effectiveFlags.workspaceHint || null,
        });
        const body = effectiveFlags.json
          ? JSON.stringify(snapshot.learning, null, 2)
          : formatExperienceLearning(snapshot);
        writer.line(body);
        return { ok: true, handled: true, output: [body], error: null };
      }
      const result = await runtime.experienceCoreService.executeCommand({
        contractVersion: 'ExperienceCommand/v1',
        text: `learn ${args}`.trim(),
        intent: 'learn',
        surface: effectiveFlags.platform,
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
        workspace: effectiveFlags.workspaceHint || null,
        learning,
      });
      const body = effectiveFlags.json
        ? JSON.stringify(result, null, 2)
        : formatExperienceCommandResult(result);
      writer.line(body);
      return { ok: result.ok, handled: true, output: [body], error: result.error };
    }
  }

  const smartCommandSurface = new ZavorthSmartCommandSurfaceService();
  if (normalized.trim().startsWith('/') && smartCommandSurface.canHandle(normalized)) {
    const snapshot = await smartCommandSurface.buildSnapshot({
      rawText: normalized,
      channel: effectiveFlags.platform,
      sessionId: effectiveFlags.sessionId,
      apply: /\s--apply\b/i.test(` ${normalized}`),
      approvalId: extractInlineValue(normalized, 'approval-id'),
    });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : smartCommandSurface.renderText(snapshot);
    writer.line(body);
    return {
      ok: snapshot.status !== 'blocked' && snapshot.status !== 'not-handled',
      handled: true,
      output: [body],
      error: snapshot.status === 'blocked' || snapshot.status === 'not-handled' ? snapshot.reply.body : null,
    };
  }

  if (commandName === 'dashboard' || commandName === 'control' || commandName === 'dashboard') {
    const access = new DashboardAccessService();
    const action = parseDashboardAccessAction(args);
    const snapshot = action === 'doctor'
      ? access.doctor()
      : action === 'repair'
        ? access.repair()
        : action === 'generate-token'
          ? access.generateToken()
          : await access.run(action);
    const body = effectiveFlags.json
      ? JSON.stringify(formatDashboardAccessJson(snapshot), null, 2)
      : formatDashboardAccessCli(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'start' || commandName === 'quickstart') {
    const service = new ZavorthProductDemoService();
    const snapshot = service.buildSnapshot();
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : [
          'Zavorth Start',
          'One command path: setup preview, Home, optional browser demo and connector doctor.',
          '',
          service.renderText(snapshot),
        ].join('\n');
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'demo') {
    const service = new ZavorthProductDemoService();
    const snapshot = service.buildSnapshot();
    const wantsDoctor = /\b(?:doctor|check|status)\b/i.test(args);
    const wantsBrowser = /\b(?:browser|visual)\b/i.test(args);
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : wantsBrowser
        ? [
            'Zavorth Browser Demo',
            `file: ${snapshot.visualHome.browserDemoPath}`,
            `open: ${snapshot.visualHome.browserDemoCommand}`,
            'This demo is local-only and does not require connector secrets.',
          ].join('\n')
      : wantsDoctor
        ? service.renderDoctor(snapshot)
        : service.renderText(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'connectors' || commandName === 'connector') {
    const service = new ZavorthConnectorExperienceService();
    const parsed = parseConnectorCliArgs(args);
    if (parsed.action === 'setup') {
      if (!parsed.channelId) {
        const error = 'Use: zavorth connectors setup <telegram|discord|github> [--apply]';
        writer.error(error);
        return { ok: false, handled: true, output: [], error };
      }
      const result = parsed.apply
        ? await service.applySetup({ ...parsed, channelId: parsed.channelId })
        : service.buildSetup({ ...parsed, channelId: parsed.channelId });
      const body = effectiveFlags.json ? JSON.stringify(result, null, 2) : service.renderSetup(result);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
    const result = await service.runDoctor({
      selectedId: parsed.channelId,
      localOnly: parsed.localOnly,
    });
    const body = effectiveFlags.json ? JSON.stringify(result, null, 2) : service.renderDoctor(result);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  const dailyUseProjection = formatDailyUseCliProjection(commandName, args);
  if (dailyUseProjection) {
    const body = effectiveFlags.json
      ? JSON.stringify(dailyUseProjection.json, null, 2)
      : dailyUseProjection.text;
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  const updateResult = await handleZavorthUpdateCommand({
    commandName,
    args,
    flags: effectiveFlags,
    writer,
  });
  if (updateResult) {
    return updateResult;
  }

  const completionsResult = await handleZavorthCompletionsCommand({
    commandName,
    args,
    flags: effectiveFlags,
    writer,
  });
  if (completionsResult) {
    return completionsResult;
  }

  const inspectResult = await handleZavorthInspectCommand({
    commandName,
    args,
    flags: effectiveFlags,
    writer,
    resolveRuntime,
  });
  if (inspectResult) {
    return inspectResult;
  }

  const managedConfigResult = await handleZavorthManagedConfigCommand({
    commandName,
    args,
    flags: effectiveFlags,
    writer,
  });
  if (managedConfigResult) {
    return managedConfigResult;
  }

  const localTaskResult = await handleZavorthLocalTaskCommand({
    commandName,
    args,
    flags: effectiveFlags,
    writer,
  });
  if (localTaskResult) {
    return localTaskResult;
  }

  if (normalized === 'quit' || normalized === 'exit') {
    return {
      ok: true,
      handled: true,
      output: ['Closing Zavorth chat.'],
      error: null,
    };
  }

  const runtime = await resolveRuntime();
  const sharedParams = { runtime, effectiveFlags, commandName, normalized, args, writer };

  const opsResult = await handleZavorthCliRegistryOpsCommand(sharedParams);
  if (opsResult) {
    return opsResult;
  }

  const workspaceResult = await handleZavorthCliRegistryWorkspaceCommand(sharedParams);
  if (workspaceResult) {
    return workspaceResult;
  }

  const sessionsResult = await handleZavorthCliRegistrySessionsCommand(sharedParams);
  if (sessionsResult) {
    return sessionsResult;
  }

  const nodesResult = await handleZavorthCliRegistryNodesCommand(sharedParams);
  if (nodesResult) {
    return nodesResult;
  }

  const platformResult = await handleZavorthCliRegistryPlatformCommand(sharedParams);
  if (platformResult) {
    return platformResult;
  }

  const tasksResult = await handleZavorthCliRegistryTasksCommand(sharedParams);
  if (tasksResult) {
    return tasksResult;
  }

  const supervisorResult = await handleZavorthCliRegistrySupervisorCommand(sharedParams);
  if (supervisorResult) {
    return supervisorResult;
  }

  const healResult = await handleZavorthCliRegistryHealCommand(sharedParams);
  if (healResult) {
    return healResult;
  }

  const releaseResult = await handleZavorthCliRegistryReleaseCommand(sharedParams);
  if (releaseResult) {
    return releaseResult;
  }

  if (commandName === 'workflows') {
    const workflowQueueResult = await executeCliWorkflowQueueCommand(
      runtime,
      args,
      effectiveFlags,
      writer,
    );
    if (workflowQueueResult) {
      return workflowQueueResult;
    }
  }

  if (commandName === 'approve' || commandName === 'reject') {
    const universalApprovalResult = await executeCliUniversalApprovalDecision(
      runtime,
      args,
      commandName,
      effectiveFlags,
      writer,
    );
    if (universalApprovalResult) {
      return universalApprovalResult;
    }
  }

  const replies: string[] = [];
  const ctx: IMessageContext = {
    platform: effectiveFlags.platform,
    userId: effectiveFlags.userId,
    chatId: effectiveFlags.chatId,
    isGroup: false,
    rawText: normalized,
    transport: normalized.startsWith('/') ? 'slash_command' : 'text',
    reply: async (text: string) => {
      replies.push(text);
    },
    editMessage: async () => undefined,
  };

  const surfaceApi = createInternalSurfaceCommandApi(runtime.commandService);
  const result = surfaceApi
    ? await surfaceApi.handleCommand({
      context: ctx,
      request: {
        surface: effectiveFlags.platform,
        requestedBy: effectiveFlags.userId,
        chatId: effectiveFlags.chatId,
        threadId: effectiveFlags.sessionId,
        correlation: {
          sessionId: effectiveFlags.sessionId,
        },
        metadata: {
          cliCommandName: commandName,
          repl: effectiveFlags.repl,
          json: effectiveFlags.json,
        },
      },
    })
    : null;

  if (!result || result.status === 'not_handled') {
    if (runtime.experienceCoreService && (commandName === 'task' || !normalized.startsWith('/'))) {
      const experienceResult = await runtime.experienceCoreService.executeCommand({
        contractVersion: 'ExperienceCommand/v1',
        text: commandName === 'task' ? args : normalized,
        intent: commandName === 'task' ? 'run' : 'ask',
        surface: effectiveFlags.platform,
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
        workspace: effectiveFlags.workspaceHint || null,
        trustMode: 'protected',
        metadata: {
          cliCommandName: commandName,
          repl: effectiveFlags.repl,
          fallback: 'natural-command-router',
        },
      });
      const body = effectiveFlags.json
        ? JSON.stringify(experienceResult, null, 2)
        : formatExperienceCommandResult(experienceResult);
      writer.line(body);
      return {
        ok: experienceResult.ok,
        handled: true,
        output: [body],
        error: experienceResult.error,
      };
    }
    if (runtime.agentGateway && (commandName === 'task' || !normalized.startsWith('/'))) {
      return executeCliUniversalAgentRuntime(runtime, normalized, effectiveFlags, writer);
    }
    const legacyUnifiedGateway = runtime.legacyUnifiedGateway || null;
    if (legacyUnifiedGateway && (commandName === 'task' || !normalized.startsWith('/'))) {
      return executeCliLegacyUnifiedConversation(legacyUnifiedGateway, normalized, effectiveFlags, writer);
    }
    if (runtime.surfaceTaskDispatcher && (commandName === 'task' || !normalized.startsWith('/'))) {
      return executeCliTaskDispatch(runtime.surfaceTaskDispatcher, normalized, effectiveFlags, writer);
    }
    const error = 'Unsupported CLI command.';
    const projection = new ZavorthSelfHealingUxService().buildProjection({
      attempted: commandName ? `Understand '${commandName}'` : 'Understand command',
      commandName,
      commandText: normalized,
      error: new Error(`${error} If this was a message, I can treat it as natural language instead.`),
      debug: effectiveFlags.json || process.argv.includes('--debug') || process.argv.includes('--verbose') || process.env.ZAVORTH_DEBUG === '1',
    });
    const body = effectiveFlags.json
      ? JSON.stringify(projection, null, 2)
      : formatZavorthSelfHealingProjection(projection);
    writer.line(body);
    return {
      ok: false,
      handled: true,
      output: [body],
      error,
    };
  }

  if (!result.ok) {
    const error = result.summary || result.error?.message || 'Surface command failed.';
    const projection = new ZavorthSelfHealingUxService().buildProjection({
      attempted: commandName ? `Run '${commandName}'` : 'Run surface command',
      commandName,
      commandText: normalized,
      error,
      debug: effectiveFlags.json || process.argv.includes('--debug') || process.argv.includes('--verbose') || process.env.ZAVORTH_DEBUG === '1',
    });
    const body = effectiveFlags.json
      ? JSON.stringify(projection, null, 2)
      : formatZavorthSelfHealingProjection(projection);
    writer.line(body);
    return {
      ok: false,
      handled: true,
      output: [body],
      error,
    };
  }

  const outputReplies = result.messages.length > 0 ? result.messages : replies;
  if (outputReplies.length === 0) {
    const body = effectiveFlags.repl
      ? formatCliSuccessEventCard({
        title: 'Pronto',
        body: 'Comando tratado sem resposta textual.',
      })
      : 'Comando tratado sem resposta textual.';
    writer.line(body);
    return {
      ok: true,
      handled: true,
      output: [body],
      error: null,
    };
  }

  const productBody = formatCliSharedSurfaceProductOutput(
    normalized,
    outputReplies,
    !effectiveFlags.repl,
    effectiveFlags.repl,
  );
  if (productBody) {
    writer.line(productBody);
    return {
      ok: true,
      handled: true,
      output: [productBody],
      error: null,
    };
  }

  const renderedReplies = effectiveFlags.repl
    ? outputReplies.map((reply) =>
      formatCliChatReplyEventCard(reply)
      || formatCliChatAssistantMessage({
        title: 'Zavorth',
        body: reply,
      }))
    : outputReplies;

  for (const reply of renderedReplies) {
    writer.line(reply);
  }

  return {
    ok: true,
    handled: true,
    output: renderedReplies,
    error: null,
  };
}

function parseExperienceLearningCliArgs(args: string): {
  candidateId?: string | null;
  decision: 'approve' | 'reject' | 'promote' | 'revoke' | 'reset' | 'export';
} | null {
  const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
  const action = String(tokens[0] || '').trim().toLowerCase();
  if (!action) return null;
  if (action === 'list' || action === 'status' || action === 'review') return null;
  if (action === 'approve' || action === 'reject' || action === 'promote' || action === 'revoke') {
    return {
      decision: action,
      candidateId: tokens[1] || null,
    };
  }
  if (action === 'reset' || action === 'export') {
    return {
      decision: action,
      candidateId: null,
    };
  }
  return null;
}

function parseExperienceResponseProfile(args: string): 'short' | 'dev' | 'executive' | 'mentor' | null {
  const text = String(args || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/\b(estilo|perfil|resposta)\s+(curto|objetivo|short)\b/.test(text) || /\b(use|usar)\s+(curto|objetivo|short)\b/.test(text)) {
    return 'short';
  }
  if (/\b(estilo|perfil|resposta)\s+(dev|developer|tecnico|technical)\b/.test(text) || /\b(include|inclua).*(arquivos|testes|evidencias)\b/.test(text)) {
    return 'dev';
  }
  if (/\b(estilo|perfil|resposta)\s+(executivo|executive|manager)\b/.test(text) || /\b(resuma|resumo).*(impacto|decisao)\b/.test(text)) {
    return 'executive';
  }
  if (/\b(estilo|perfil|resposta)\s+(mentor|didatico|teacher)\b/.test(text) || /\b(explique|ensine).*(enquanto|passo)\b/.test(text)) {
    return 'mentor';
  }
  return null;
}

function parseExperienceDiffCliArgs(args: string): {
  reviewId: string;
  targetId: string;
  decision: 'approve-plan' | 'approve-file' | 'approve-hunk' | 'reject-hunk' | 'retry-without-hunk';
} | null {
  const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
  const action = String(tokens[0] || '').trim().toLowerCase();
  if (!action || action === 'list' || action === 'status' || action === 'review' || action === 'show') return null;
  const firstId = tokens[1] || 'current';
  const secondId = tokens[2] || firstId;
  if (action === 'approve' || action === 'approve-plan') {
    return { reviewId: firstId, targetId: firstId, decision: 'approve-plan' };
  }
  if (action === 'approve-file') {
    return { reviewId: firstId, targetId: secondId, decision: 'approve-file' };
  }
  if (action === 'approve-hunk') {
    return { reviewId: firstId, targetId: secondId, decision: 'approve-hunk' };
  }
  if (action === 'reject-hunk' || action === 'reject') {
    return { reviewId: firstId, targetId: secondId, decision: 'reject-hunk' };
  }
  if (action === 'retry' || action === 'retry-without-hunk') {
    return { reviewId: firstId, targetId: secondId, decision: 'retry-without-hunk' };
  }
  return null;
}

function formatDashboardAccessJson(
  snapshot: DashboardAccessSnapshot | DashboardAccessDoctorSnapshot,
): Record<string, unknown> {
  if (isDashboardDoctorSnapshot(snapshot)) {
    return snapshot;
  }

  const base: Record<string, unknown> = {
    ok: true,
    action: snapshot.action,
    opened: snapshot.opened,
    publicUrl: snapshot.publicUrl,
    tokenSource: snapshot.tokenSource,
    tokenFile: snapshot.tokenFile,
  };
  if (snapshot.action === 'url') {
    base.url = snapshot.url;
  }
  if (snapshot.action === 'token') {
    base.token = snapshot.token;
  }
  return base;
}

function parseConnectorCliArgs(args: string): {
  action: 'doctor' | 'setup';
  channelId: string | null;
  mode: string | null;
  apply: boolean;
  localOnly: boolean;
  allowedUserIds: string[];
  allowedGuildIds: string[];
  allowedChannelIds: string[];
  ownerUserIds: string[];
  allowDms: boolean | null;
} {
  const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
  const first = String(tokens[0] || '').trim().toLowerCase();
  const action = first === 'setup' ? 'setup' : 'doctor';
  const positional = String(tokens[1] || '').trim();
  const channelId = first === 'setup' || first === 'doctor'
    ? positional && !positional.startsWith('--') ? positional : null
    : first || null;
  return {
    action,
    channelId,
    mode: readConnectorFlag(tokens, 'mode'),
    apply: tokens.includes('--apply'),
    localOnly: tokens.includes('--local-only'),
    allowedUserIds: readConnectorMany(tokens, ['allowed-user', 'allowed-users', 'user']),
    allowedGuildIds: readConnectorMany(tokens, ['guild', 'guilds', 'allowed-guild', 'allowed-guilds']),
    allowedChannelIds: readConnectorMany(tokens, ['channel', 'channels', 'allowed-channel', 'allowed-channels']),
    ownerUserIds: readConnectorMany(tokens, ['owner', 'owners', 'owner-user', 'owner-users']),
    allowDms: tokens.includes('--allow-dms')
      ? true
      : tokens.includes('--no-dms')
        ? false
        : null,
  };
}

function readConnectorFlag(tokens: string[], name: string): string | null {
  const inlinePrefix = `--${name}=`;
  const inline = tokens.find((token) => token.startsWith(inlinePrefix));
  if (inline) {
    return inline.slice(inlinePrefix.length).trim() || null;
  }
  const index = tokens.indexOf(`--${name}`);
  return index >= 0 ? String(tokens[index + 1] || '').trim() || null : null;
}

function readConnectorMany(tokens: string[], names: string[]): string[] {
  const values: string[] = [];
  for (const name of names) {
    const inlinePrefix = `--${name}=`;
    for (const token of tokens) {
      if (token.startsWith(inlinePrefix)) {
        values.push(token.slice(inlinePrefix.length));
      }
    }
    for (let index = 0; index < tokens.length; index += 1) {
      if (tokens[index] === `--${name}` && tokens[index + 1]) {
        values.push(tokens[index + 1]);
      }
    }
  }
  return values;
}

function extractInlineValue(raw: string, name: string): string | null {
  const tokens = String(raw || '').trim().split(/\s+/).filter(Boolean);
  const inlinePrefix = `--${name}=`;
  const inline = tokens.find((token) => token.startsWith(inlinePrefix));
  if (inline) return inline.slice(inlinePrefix.length).trim() || null;
  const index = tokens.indexOf(`--${name}`);
  return index >= 0 ? String(tokens[index + 1] || '').trim() || null : null;
}

function formatDailyUseCliProjection(
  commandName: string | null,
  args: string,
): { text: string; json: Record<string, unknown> } | null {
  const command = String(commandName || '').trim().toLowerCase();
  const normalizedArgs = String(args || '').trim();
  const firstArg = normalizedArgs.split(/\s+/)[0]?.toLowerCase() || '';
  if ((command === 'channels' || command === 'channel') && firstArg === 'parity') {
    return null;
  }
  const tables: Record<string, { title: string; summary: string; rows: Array<[string, string, string]>; notes: string[] }> = {
    onboard: {
      title: 'Zavorth Onboarding',
      summary: 'Guided first-run path for daily local use.',
      rows: [
        ['1', 'zavorth setup', 'Create the local profile, workspace defaults and safe runtime files.'],
        ['2', 'zavorth doctor --simple', 'Check provider, sandbox, workspace and dashboard readiness.'],
        ['3', 'zavorth go', 'Start or resume the main /dashboard gateway.'],
      ],
      notes: [
        'Personal mode keeps daily use simple. Governed mode exposes policy details.',
        'Sensitive actions still require Policy Broker decisions and receipts.',
      ],
    },
    setup: {
      title: 'Zavorth Onboarding',
      summary: 'Guided first-run path for daily local use.',
      rows: [
        ['1', 'zavorth setup', 'Create the local profile, workspace defaults and safe runtime files.'],
        ['2', 'zavorth doctor --simple', 'Check provider, sandbox, workspace and dashboard readiness.'],
        ['3', 'zavorth go', 'Start or resume the main /dashboard gateway.'],
      ],
      notes: [
        'Personal mode keeps daily use simple. Governed mode exposes policy details.',
        'Sensitive actions still require Policy Broker decisions and receipts.',
      ],
    },
    providers: {
      title: 'Provider Mesh',
      summary: 'Honest model/provider readiness. Catalog entries are not treated as live until credentials and probes pass.',
      rows: [
        ['OpenAI', 'missing_auth', 'Add a SecretRef/API key, then run provider test.'],
        ['Anthropic', 'missing_auth', 'Add a SecretRef/API key, then run provider test.'],
        ['Gemini', 'needs_probe', 'Credential may exist; run a live probe before marking ready.'],
        ['OpenRouter', 'missing_auth', 'Add key and choose a routed model.'],
        ['Ollama', 'missing_base_url', 'Start local Ollama and set the base URL.'],
        ['OpenAI-compatible', 'missing_base_url', 'Set base URL and API key/SecretRef if required.'],
      ],
      notes: [
        'Use: zavorth providers test <provider>',
        'Fallback is explainable; Zavorth should never silently pretend a provider is ready.',
      ],
    },
    provider: {
      title: 'Provider Mesh',
      summary: 'Honest model/provider readiness. Catalog entries are not treated as live until credentials and probes pass.',
      rows: [
        ['OpenAI', 'missing_auth', 'Add a SecretRef/API key, then run provider test.'],
        ['Anthropic', 'missing_auth', 'Add a SecretRef/API key, then run provider test.'],
        ['Gemini', 'needs_probe', 'Credential may exist; run a live probe before marking ready.'],
        ['OpenRouter', 'missing_auth', 'Add key and choose a routed model.'],
        ['Ollama', 'missing_base_url', 'Start local Ollama and set the base URL.'],
        ['OpenAI-compatible', 'missing_base_url', 'Set base URL and API key/SecretRef if required.'],
      ],
      notes: ['Use: zavorth providers test <provider>'],
    },
    channels: {
      title: 'Channel Mesh',
      summary: 'Surface readiness without letting any channel become a separate agent.',
      rows: [
        ['dashboard', 'ready', 'Main gateway for normal users.'],
        ['cli', 'ready', 'Power-user surface and recovery path.'],
        ['telegram', 'needs_token', 'Configure bot token and approval routing.'],
        ['discord', 'needs_token', 'Configure bot token and component support.'],
        ['whatsapp', 'needs_bridge_or_cloud', 'Choose Cloud API, bridge or QR flow.'],
        ['signal/imessage', 'host_limited', 'Requires host bridge and recipient allowlist.'],
      ],
      notes: [
        'Use: zavorth channels status',
        'No channel should show ready unless transport, auth and policy checks pass.',
      ],
    },
    channel: {
      title: 'Channel Mesh',
      summary: 'Surface readiness without letting any channel become a separate agent.',
      rows: [
        ['dashboard', 'ready', 'Main gateway for normal users.'],
        ['cli', 'ready', 'Power-user surface and recovery path.'],
        ['telegram', 'needs_token', 'Configure bot token and approval routing.'],
        ['discord', 'needs_token', 'Configure bot token and component support.'],
        ['whatsapp', 'needs_bridge_or_cloud', 'Choose Cloud API, bridge or QR flow.'],
      ],
      notes: ['Use: zavorth channels status'],
    },
    missions: {
      title: 'Missions',
      summary: 'Mission-first view: request, preview, risk, approval, execution, artifact and receipt.',
      rows: [
        ['active', 'none', 'No local mission projection is active in this quick view.'],
        ['preview', 'available', 'Use zavorth run "<request>" or pick a template.'],
        ['cancel', 'policy-bound', 'Cancellation goes through the runtime API, not direct UI mutation.'],
      ],
      notes: [
        'Use: zavorth missions --json for machine-readable projection.',
        'The dashboard should display the same mission truth as this CLI surface.',
      ],
    },
    receipts: {
      title: 'Receipts',
      summary: 'Readable evidence for what Zavorth did, blocked or left in preview.',
      rows: [
        ['latest', 'not loaded', 'Start a mission or action to produce a receipt.'],
        ['contents', 'safe', 'Files, tools, approvals, risk, artifacts and rollback status.'],
        ['secrets', 'redacted', 'Raw secrets must never appear in receipt text.'],
      ],
      notes: [
        'Use: zavorth receipts --json for audit export.',
        'Every important action should produce a receipt, including denial and rollback.',
      ],
    },
    receipt: {
      title: 'Receipts',
      summary: 'Readable evidence for what Zavorth did, blocked or left in preview.',
      rows: [
        ['latest', 'not loaded', 'Start a mission or action to produce a receipt.'],
        ['contents', 'safe', 'Files, tools, approvals, risk, artifacts and rollback status.'],
        ['secrets', 'redacted', 'Raw secrets must never appear in receipt text.'],
      ],
      notes: ['Use: zavorth receipts --json for audit export.'],
    },
    schedule: {
      title: 'Scheduler',
      summary: 'Daily autonomy with pre-approved scope, TTL, budget, renewal and kill switch.',
      rows: [
        ['list', 'available', 'Show recurring tasks and next run times.'],
        ['create', 'approval_required', 'Natural schedules become scoped tasks before live execution.'],
        ['pause/resume', 'available', 'Surface command maps to the governed scheduler.'],
        ['revoke', 'available', 'Kill switch remains available from every surface.'],
      ],
      notes: [
        'Scheduled tasks cannot create scheduled tasks.',
        'Every tick still passes through Policy Broker.',
      ],
    },
    scheduler: {
      title: 'Scheduler',
      summary: 'Daily autonomy with pre-approved scope, TTL, budget, renewal and kill switch.',
      rows: [
        ['list', 'available', 'Show recurring tasks and next run times.'],
        ['create', 'approval_required', 'Natural schedules become scoped tasks before live execution.'],
        ['pause/resume', 'available', 'Surface command maps to the governed scheduler.'],
      ],
      notes: ['Every tick still passes through Policy Broker.'],
    },
    skills: {
      title: 'Skills',
      summary: 'Governed skill memory: reusable instructions, not auto-executed code.',
      rows: [
        ['search', 'available', 'Find imported/native skills by intent.'],
        ['absorb', 'preview_first', 'Large libraries are chunked, hashed, attributed and quarantined if risky.'],
        ['use', 'policy_bound', 'Low-risk instruction use can be natural; live tools need approval.'],
        ['learn', 'guarded', 'Only general, deterministic, low/medium-risk patterns become skill candidates.'],
      ],
      notes: [
        'High-risk one-off work becomes a mission, not an automatic skill.',
        'FTS/indexed lookup avoids injecting huge markdown into every prompt.',
      ],
    },
    skill: {
      title: 'Skills',
      summary: 'Governed skill memory: reusable instructions, not auto-executed code.',
      rows: [
        ['search', 'available', 'Find imported/native skills by intent.'],
        ['absorb', 'preview_first', 'Large libraries are chunked, hashed, attributed and quarantined if risky.'],
        ['use', 'policy_bound', 'Low-risk instruction use can be natural; live tools need approval.'],
      ],
      notes: ['High-risk one-off work becomes a mission, not an automatic skill.'],
    },
    agents: {
      title: 'Subagents',
      summary: 'Governed workers for parallel analysis, build, review and QA.',
      rows: [
        ['spawn', 'available', 'Explicit "use subagents" creates scoped workers.'],
        ['auto', 'guarded', 'Auto-subagents can run when parallelism is obvious and safe.'],
        ['wait/summarize', 'available', 'Results return through the parent mission receipt.'],
        ['cancel/list/read', 'available', 'Operator controls stay visible in CLI and dashboard.'],
      ],
      notes: [
        'Budgets cover time, tokens, tools, files, network and spawn depth.',
        'Mutations by subagents still require approval.',
      ],
    },
    agent: {
      title: 'Subagents',
      summary: 'Governed workers for parallel analysis, build, review and QA.',
      rows: [
        ['spawn', 'available', 'Explicit "use subagents" creates scoped workers.'],
        ['wait/summarize', 'available', 'Results return through the parent mission receipt.'],
        ['cancel/list/read', 'available', 'Operator controls stay visible in CLI and dashboard.'],
      ],
      notes: ['Mutations by subagents still require approval.'],
    },
    templates: {
      title: 'Templates',
      summary: 'Guided safe starts for common daily missions.',
      rows: [
        ['dev-repo-review', 'ready', 'Read-only repository review with findings and receipt.'],
        ['pdf-summary', 'ready', 'Document summary with evidence markers.'],
        ['file-organization', 'preview_first', 'Plan file moves before any mutation.'],
        ['daily-assistant', 'ready', 'Lightweight briefing and reminders.'],
        ['safe-audit', 'ready', 'Security-oriented read-only audit path.'],
      ],
      notes: ['Templates are entry points, not bypasses around policy.'],
    },
  };

  const key = command === 'models' ? 'providers' : command;
  const table = tables[key];
  if (!table) return null;

  const text = formatDailyUseCliTable(table.title, table.summary, table.rows, table.notes, normalizedArgs);
  return {
    text,
    json: {
      surface: 'zavorth-cli',
      command,
      args: normalizedArgs,
      title: table.title,
      summary: table.summary,
      rows: table.rows.map(([name, status, detail]) => ({ name, status, detail })),
      notes: table.notes,
      dashboardPath: '/dashboard',
      canExecuteMutations: false,
    },
  };
}

function formatDailyUseCliTable(
  title: string,
  summary: string,
  rows: Array<[string, string, string]>,
  notes: string[],
  args: string,
): string {
  const nameWidth = Math.max(10, ...rows.map(([name]) => name.length));
  const statusWidth = Math.max(8, ...rows.map(([, status]) => status.length));
  const lines = [
    title,
    '-'.repeat(title.length),
    summary,
  ];
  if (args) lines.push(`Args: ${args}`);
  lines.push('', `${'Item'.padEnd(nameWidth)}  ${'Status'.padEnd(statusWidth)}  Next step`);
  lines.push(`${'-'.repeat(nameWidth)}  ${'-'.repeat(statusWidth)}  ${'-'.repeat(36)}`);
  for (const [name, status, detail] of rows) {
    lines.push(`${name.padEnd(nameWidth)}  ${status.padEnd(statusWidth)}  ${detail}`);
  }
  if (notes.length > 0) {
    lines.push('', 'Notes:');
    for (const note of notes) lines.push(`- ${note}`);
  }
  return lines.join('\n');
}

function formatDashboardAccessCli(
  snapshot: DashboardAccessSnapshot | DashboardAccessDoctorSnapshot,
): string {
  if (isDashboardDoctorSnapshot(snapshot)) {
    const source = snapshot.tokenSource === 'env'
      ? 'ZAVORTH_WEB_AUTH_TOKEN'
      : snapshot.tokenSource === 'runtime-file'
        ? 'arquivo de runtime'
        : snapshot.tokenSource === 'generated-runtime-file'
          ? 'arquivo de runtime gerado agora'
          : 'ausente';
    const problems = snapshot.problems.length > 0
      ? snapshot.problems.map((entry: string) => `- ${entry}`).join('\n')
      : '- Nenhum problema de token local detectado.';
    return [
      snapshot.action === 'doctor'
        ? 'Dashboard doctor'
        : snapshot.action === 'repair'
          ? 'Dashboard repair'
          : 'New Dashboard token',
      `- Estado: ${snapshot.status}`,
      `- Painel: ${snapshot.publicUrl}`,
      `- Origem do token: ${source}`,
      `- Arquivo local: ${snapshot.tokenFile}`,
      '',
      'Diagnostico',
      problems,
      '',
      'Recuperacao rapida',
      '- zavorth dashboard: abre uma aba nova ja desbloqueada',
      '- zavorth dashboard url: mostra link local ja desbloqueado',
      '- zavorth dashboard repair: corrige token local ausente/vazio',
      '- zavorth dashboard generate-token: troca o token local quando ele vem de arquivo',
      '',
      ...snapshot.notes.map((entry: string) => `- ${entry}`),
    ].join('\n');
  }

  if (snapshot.action === 'token') {
    return [
      'Token local do Zavorth',
      '- Use este token somente nesta maquina.',
      `- Token: ${snapshot.token}`,
      `- Origem: ${snapshot.tokenSource === 'env' ? '.env' : snapshot.tokenFile}`,
      '',
      'Tip: if you only want to open the panel, use `zavorth dashboard`.',
    ].join('\n');
  }

  if (snapshot.action === 'url') {
    return [
      'Local Dashboard link',
      '- This link unlocks the panel in this tab.',
      '- Do not share this link: it contains the local token.',
      '',
      snapshot.url,
    ].join('\n');
  }

  if (snapshot.action === 'status') {
    return [
      'Dashboard',
      `- Panel: ${snapshot.publicUrl}`,
      `- Access: protected by local token (${snapshot.tokenSource === 'env' ? '.env' : 'runtime file'})`,
      '- Open already unlocked: zavorth dashboard',
      '- Copy the link: zavorth dashboard url',
    ].join('\n');
  }

  return [
    snapshot.opened ? 'Dashboard opened.' : 'Could not open the browser automatically.',
    `- Panel: ${snapshot.publicUrl}`,
    '- Access: unlocked automatically for this launch.',
    '',
    'If the page does not load, run `zavorth start` to start the local runtime and try again.',
    snapshot.opened
      ? 'If the browser did not appear, run `zavorth dashboard url` and paste the link.'
      : 'Run `zavorth dashboard url` and paste the link in the browser.',
  ].join('\n');
}

function isDashboardDoctorSnapshot(
  snapshot: DashboardAccessSnapshot | DashboardAccessDoctorSnapshot,
): snapshot is DashboardAccessDoctorSnapshot {
  return snapshot.action === 'doctor'
    || snapshot.action === 'repair'
    || snapshot.action === 'generate-token';
}
