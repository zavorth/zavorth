import { LoopEngineeringService } from '../services/LoopEngineeringService.js';
import { globalSpinner } from './presentation/TerminalSpinner.js';
import type { IMessageContext } from '../contracts/IMessageBroker.js';
import type {
  ZavorthCliFlags,
  ZavorthCliRuntime,
  CliWriter,
  CliExecutionResult,
} from './ZavorthCliContract.js';
import {
  applyInlineCliFlags,
  executeCliLegacyUnifiedConversation,
  executeCliUniversalAgentRuntime,
  executeCliUniversalApprovalDecision,
  executeCliWorkflowQueueCommand,
  executeCliTaskDispatch,
  formatCliSharedSurfaceProductOutput} from './ZavorthCliFlowHelpers.js';
import {
  buildCliContextSnapshot,
  buildCliHelpSnapshot,
  formatCliContextSnapshot,
  formatCliHelp,
  resolveCliHelpTopic} from './ZavorthCliNativeRenderers.js';
import { formatZavorthSelfHealingProjection } from './ZavorthCliSelfHealingRenderer.js';
import {
  buildCliRuntimeFromOverrides as buildCliRuntimeFromOverridesImpl,
  parseZavorthCliArgs as parseZavorthCliArgsImpl,
  parseZavorthCliFlags as parseZavorthCliFlagsImpl,
  resolveCliExecutionInput} from './ZavorthCliCommandHelpers.js';
import { handleZavorthCliRegistryNodesCommand } from './ZavorthCliRegistryNodes.js';







import { handleZavorthCliRegistryKanbanCommand } from './ZavorthCliRegistryKanban.js';


import {
  createInternalSurfaceCommandApi} from '../api/internal/InternalSurfaceApiCompat.js';


import { formatCliChatAssistantMessage } from './ZavorthCliChatRenderers.js';
import {
  formatExperienceCommandResult,
  formatExperienceHome,
} from './ZavorthCliExperienceRenderer.js';

import { ZavorthSelfHealingUxService } from '../services/ZavorthSelfHealingUxService.js';
import { ZavorthSmartCommandSurfaceService } from '../services/ZavorthSmartCommandSurfaceService.js';
import {
  formatCliChatReplyEventCard,
  formatCliSuccessEventCard} from './ZavorthCliEventCards.js';

import { handleZavorthCliRegistryOpsCommand } from './ZavorthCliRegistryOps.js';
import { handleZavorthCliRegistryPlatformCommand } from './ZavorthCliRegistryPlatform.js';
import { handleZavorthCliRegistrySessionsCommand } from './ZavorthCliRegistrySessions.js';
import { handleZavorthCliRegistryTasksCommand } from './ZavorthCliRegistryTasks.js';
import { handleZavorthCliRegistrySupervisorCommand } from './ZavorthCliRegistrySupervisor.js';
import { handleZavorthCliRegistryHealCommand } from './ZavorthCliRegistryHeal.js';
import { handleZavorthCliRegistryReleaseCommand } from './ZavorthCliRegistryRelease.js';
import { handleZavorthCliRegistryWorkspaceCommand } from './ZavorthCliRegistryWorkspace.js';
import { handleZavorthCliRegistryExperienceCommand } from './ZavorthCliRegistryExperience.js';
import { handleZavorthCliRegistryControlCommand } from './ZavorthCliRegistryZavorthControl.js';
import { handleZavorthCliRegistryConnectorsCommand } from './ZavorthCliRegistryConnectors.js';
import { handleZavorthCliRegistryScaffoldCommand } from './ZavorthCliRegistryScaffold.js';
import { handleZavorthCliRegistrySkillsCommand } from './ZavorthCliRegistrySkills.js';
import { handleZavorthCliVoiceCommand } from './ZavorthCliVoiceCommand.js';
import { handleZavorthCompileCommand } from './ZavorthCompileCommand.js';
import { handleZavorthUpdateCommand } from './update/ZavorthUpdateCommand.js';
import { handleZavorthCompletionsCommand } from './completions/ZavorthCompletionsCommand.js';
import { handleZavorthInspectCommand } from './inspect/ZavorthInspectCommand.js';
import { handleZavorthManagedConfigCommand } from './managed-config/ZavorthManagedConfigCommand.js';
import { handleZavorthLocalTaskCommand } from './local-task/ZavorthLocalTaskCommand.js';
import { handleZavorthBotCliCommand } from './commands/ZavorthBotCliCommand.js';
import { errorMessage } from '../utils/errorLike.js';
import { UnifiedSlashCommandHandler } from './commands/UnifiedSlashCommandHandler.js';
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

  if (commandName === 'locale' || commandName === 'i18n' || commandName === 'localization') {
    const { runLocaleCli } = await import('./LocaleCli.js');
    const argv = resolvedInput.args.trim() ? resolvedInput.args.trim().split(/\s+/) : [];
    const lines: string[] = [];
    const code = await runLocaleCli(argv, (line) => {
      lines.push(line);
      writer.line(line);
    });
    return { ok: code === 0, handled: true, output: lines, error: code !== 0 ? 'Locale command failed' : null };
  }

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
    commandName === 'provider-eval' ||
    commandName === 'eval' ||
    commandName === 'benchmark' ||
    commandName === 'arena' ||
    commandName === 'negotiate' ||
    commandName === 'rehearse' ||
    commandName === 'self-config' ||
    commandName === 'self-configuration' ||
    commandName === 'config' ||
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
    commandName === 'integration-showcase' ||
    commandName === 'skill' ||
    commandName === 'skills' ||
    commandName === 'voice' ||
    commandName === 'compile'
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
  } catch (error: unknown) {if (spinnerActive) {
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
      error: errorMessage(error, 'Zavorth command failed.'),
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

  // Fast-path execution for unified slash commands (/models, /config, /skills, /doctor, /clear)
  if (UnifiedSlashCommandHandler.isSlashCommand(rawInput) || UnifiedSlashCommandHandler.isSlashCommand(inline.input)) {
    const runtime = await resolveRuntime();
    const slashResult = await UnifiedSlashCommandHandler.handle(
      rawInput.startsWith('/') ? rawInput : inline.input,
      runtime,
      effectiveFlags,
      writer
    );
    if (slashResult) {
      return slashResult;
    }
  }

  const resolvedInput = resolveCliExecutionInput(inline.input);
  const normalized = resolvedInput.surfaceText;
  const commandName = String(resolvedInput.commandName || '').trim().toLowerCase() || null;
  const args = resolvedInput.args;

  if (commandName === 'locale' || commandName === 'i18n' || commandName === 'localization') {
    const { runLocaleCli } = await import('./LocaleCli.js');
    const argv = args.trim() ? args.trim().split(/\s+/) : [];
    const code = await runLocaleCli(argv);
    return { ok: code === 0, handled: true, output: [], error: code !== 0 ? 'Locale command failed' : null };
  }

  // Intercept state machine and handle loop command
  const sessionId = effectiveFlags.sessionId || 'default';
  const loopService = new LoopEngineeringService();
  const sessionState = await loopService.getSessionState(sessionId);
  const cleanedInput = normalized.trim().toLowerCase();

  if (cleanedInput === 'quit' || cleanedInput === 'exit' || cleanedInput === '/reset' || cleanedInput === 'reset') {
    if (sessionState.status !== 'IDLE') {
      await loopService.clearSessionState(sessionId);
    }
  } else if (sessionState.status === 'WAITING_FOR_LOOP_MODE' || sessionState.status === 'GRILLING') {
    const reply = await loopService.processInput(sessionId, effectiveFlags.userId || 'cli-operator', normalized);
    writer.line(reply);
    return { ok: true, handled: true, output: [reply], error: null };
  }

  if (commandName === 'loop') {
    const isAuto = args.includes('--auto');
    const isGrill = args.includes('--grill');
    const taskDescription = args
      .replace(/--auto/g, '')
      .replace(/--grill/g, '')
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .trim();

    if (!taskDescription) {
      const error = 'The loop command requires a task description. Example: loop "implement calculator"';
      writer.error(error);
      return { ok: false, handled: true, output: [], error };
    }

    const reply = await loopService.initiateLoop(sessionId, taskDescription, {
      auto: isAuto,
      grill: isGrill,
      userId: effectiveFlags.userId,
    });
    writer.line(reply);
    return { ok: true, handled: true, output: [reply], error: null };
  }

  if (!normalized) {
    const runtime = await resolveRuntime();
    const snapshot = runtime.experienceCoreService?.buildHome({
      surface: effectiveFlags.platform,
      userId: effectiveFlags.userId,
      sessionId: effectiveFlags.sessionId,
      workspace: effectiveFlags.workspaceHint || null,
    });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot || { ok: false, error: 'Experience Core unavailable.' }, null, 2)
      : snapshot
        ? formatExperienceHome(snapshot)
        : 'Experience Core unavailable in this runtime.';
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

  if (commandName === 'setup' || commandName === 'init') {
    // Static import path: dynamic import() fails under Jest without --experimental-vm-modules.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { runZavorthSetupStudioCommand } = require('./setup-studio/ZavorthSetupStudioCommand.js') as typeof import('./setup-studio/ZavorthSetupStudioCommand.js');
    const result = await runZavorthSetupStudioCommand({
      projectRoot: process.cwd(),
      args: args.trim() ? args.trim().split(/\s+/) : [],
      json: effectiveFlags.json,
    });
    const body = effectiveFlags.json ? `${JSON.stringify({ applied: result.applied, exitCode: result.exitCode, writtenKeys: result.writtenKeys }, null, 2)}\n`
      : result.output;
    writer.line(body);
    return { ok: result.exitCode === 0, handled: true, output: [body], error: result.exitCode !== 0 ? 'Setup failed.' : null };
  }

  if (commandName === 'locale' || commandName === 'i18n' || commandName === 'localization') {
    const { runLocaleCli } = await import('./LocaleCli.js');
    const argv = args.trim() ? args.trim().split(/\s+/) : [];
    const code = await runLocaleCli(argv);
    return { ok: code === 0, handled: true, output: [], error: code !== 0 ? 'Locale command failed' : null };
  }

  const experienceResult = await handleZavorthCliRegistryExperienceCommand({
    runtime: await resolveRuntime(),
    effectiveFlags,
    commandName,
    normalized,
    args,
    writer,
  });
  if (experienceResult) {
    return experienceResult;
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

  const zavorthControlResult = await handleZavorthCliRegistryControlCommand({
    runtime: await resolveRuntime(),
    effectiveFlags,
    commandName,
    normalized,
    args,
    writer,
  });
  if (zavorthControlResult) {
    return zavorthControlResult;
  }

  const connectorsResult = await handleZavorthCliRegistryConnectorsCommand({
    runtime: await resolveRuntime(),
    effectiveFlags,
    commandName,
    normalized,
    args,
    writer,
  });
  if (connectorsResult) {
    return connectorsResult;
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

  const botResult = await handleZavorthBotCliCommand({
    commandName,
    args,
    flags: effectiveFlags,
    writer,
  });
  if (botResult) {
    return botResult;
  }

  const kanbanResult = await handleZavorthCliRegistryKanbanCommand({
    commandName,
    args,
    writer,
  });
  if (kanbanResult) {
    return kanbanResult;
  }

  if (commandName === '/diagram' || commandName === 'diagram') {
    const { ZavorthDiagramRendererService } = await import('../services/diagram/ZavorthDiagramRendererService.js');
    const diagramService = new ZavorthDiagramRendererService();
    const mermaidInput = String(args || '').trim();
    if (!mermaidInput) {
      writer.error('Usage: /diagram <mermaid syntax>\nExample: /diagram graph TD; A[Client]-->B[Gateway]; B-->C[LLM]');
      return { ok: false, handled: true, output: [], error: 'Missing diagram definition' };
    }
    const graph = diagramService.parseMermaidSyntax(mermaidInput);
    const rendered = diagramService.renderAscii(graph);
    writer.line(rendered.textOutput);
    return { ok: true, handled: true, output: [rendered.textOutput], error: null };
  }

  if (commandName === '/diff' || commandName === 'diff') {
    const { ZavorthDiffPagerService } = await import('../services/diff/ZavorthDiffPagerService.js');
    const { DiffPagerModalRenderer } = await import('./components/DiffPagerModal.js');
    const diffService = new ZavorthDiffPagerService();
    const modalRenderer = new DiffPagerModalRenderer();
    const diffInput = String(args || '').trim();
    if (!diffInput) {
      writer.error('Usage: /diff <unified git diff content>');
      return { ok: false, handled: true, output: [], error: 'Missing diff content' };
    }
    const files = diffService.parseUnifiedDiff(diffInput);
    if (files.length === 0) {
      writer.line('No file diffs detected in input.');
      return { ok: true, handled: true, output: ['No diffs'], error: null };
    }
    const rendered = modalRenderer.render({
      file: files[0],
      topIndex: 0,
      viewportHeight: 20,
      selectedHunkIndex: 0,
    });
    writer.line(rendered);
    return { ok: true, handled: true, output: [rendered], error: null };
  }

  if (commandName === '/steer' || commandName === 'steer') {
    const { ZavorthPromptQueueService } = await import('../services/queue/ZavorthPromptQueueService.js');
    const queue = new ZavorthPromptQueueService();
    const steeringText = String(args || '').trim();
    if (!steeringText) {
      writer.error('Usage: /steer <steering instruction>');
      return { ok: false, handled: true, output: [], error: 'Missing instruction' };
    }
    const item = queue.enqueuePrompt({ content: steeringText, priority: 'STEER_GUIDANCE' });
    writer.line(`\x1b[32m✔ Enqueued live steering directive [${item.id}]: "${steeringText}"\x1b[0m`);
    return { ok: true, handled: true, output: [item.id], error: null };
  }

  if (commandName === '/graph' || commandName === 'graph') {
    const { ZavorthCodebaseGraphService } = await import('../services/graph/ZavorthCodebaseGraphService.js');
    const graphService = new ZavorthCodebaseGraphService();
    const symbolTarget = String(args || '').trim();
    if (!symbolTarget) {
      const all = graphService.getAllSymbols();
      writer.line(`Codebase Graph Symbols indexed: ${all.length}`);
      return { ok: true, handled: true, output: [`${all.length} symbols`], error: null };
    }
    const impact = graphService.getImpactAnalysis(effectiveFlags.workspaceHint || 'src', symbolTarget);
    if (!impact) {
      writer.line(`No caller impact found for "${symbolTarget}".`);
      return { ok: true, handled: true, output: ['No impact'], error: null };
    }
    writer.line(`\x1b[1mSymbol:\x1b[0m ${impact.targetSymbol.name} (${impact.riskRecommendation})`);
    writer.line(`\x1b[90mDependent Callers:\x1b[0m ${impact.dependentFiles.join(', ') || 'None'}`);
    return { ok: true, handled: true, output: [impact.riskRecommendation], error: null };
  }

  if (commandName === '/diagnostics' || commandName === 'diagnostics') {
    const { ZavorthLspBridgeService } = await import('../services/lsp/ZavorthLspBridgeService.js');
    const lsp = new ZavorthLspBridgeService();
    const targetFile = String(args || '').trim() || 'src/index.ts';
    const lang = lsp.detectLanguageForFile(targetFile);
    writer.line(`\x1b[1mLSP Status for "${targetFile}":\x1b[0m ${lang ? `Detected ${lang} language server` : 'No LSP server assigned'}`);
    return { ok: true, handled: true, output: [lang || 'unknown'], error: null };
  }

  if (commandName === '/power' || commandName === 'power') {
    const { ZavorthSystemPowerService } = await import('../services/power/ZavorthSystemPowerService.js');
    const { ZavorthSurfaceMatrixAdapterService } = await import('../services/surface/ZavorthSurfaceMatrixAdapterService.js');
    const power = new ZavorthSystemPowerService();
    const surface = new ZavorthSurfaceMatrixAdapterService();
    const status = power.getPowerStatus();
    const throttle = power.evaluateThrottlePolicy();
    const projection = surface.projectPowerAndTelemetry(status, throttle, 'CLI_TERMINAL');
    writer.line(projection.contentText || 'Power: OK');
    return { ok: true, handled: true, output: [projection.contentText || 'OK'], error: null };
  }

  if (commandName === '/benchmark' || commandName === 'benchmark') {
    const { ZavorthBenchmarkTool } = await import('../tools/ZavorthBenchmarkTool.js');
    const tool = new ZavorthBenchmarkTool();
    writer.line('\x1b[90mRunning Zavorth Autonomy Benchmark Suite...\x1b[0m');
    const res = await tool.execute({ action: 'run_suite' });
    const parsed = JSON.parse(res);
    if (parsed.scorecard) {
      writer.line(parsed.scorecard);
    }
    return { ok: true, handled: true, output: [String(parsed.suiteResult?.autonomyScorePercentage || 100)], error: null };
  }

  if (commandName === '/repair' || commandName === 'repair') {
    const targetFile = String(args || '').trim();
    if (!targetFile) {
      writer.error('Usage: /repair <targetFilePath>');
      return { ok: false, handled: true, output: [], error: 'Missing target file' };
    }
    const { ZavorthAutoRepairTool } = await import('../tools/ZavorthAutoRepairTool.js');
    const tool = new ZavorthAutoRepairTool();
    writer.line(`\x1b[90mExecuting closed-loop auto-repair on "${targetFile}"...\x1b[0m`);
    const res = await tool.execute({
      action: 'repair_file',
      targetFile,
      errorMessage: 'Manual repair invocation from CLI',
    });
    const parsed = JSON.parse(res);
    writer.line(parsed.success ? `\x1b[32m✔ Repaired "${targetFile}" successfully.\x1b[0m` : `\x1b[31m✖ Auto-repair could not resolve issues.\x1b[0m`);
    return { ok: parsed.success, handled: true, output: [parsed.result?.incidentLog || ''], error: null };
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

  const skillsResult = await handleZavorthCliRegistrySkillsCommand(sharedParams);
  if (skillsResult) {
    return skillsResult;
  }

  const voiceResult = await handleZavorthCliVoiceCommand(sharedParams);
  if (voiceResult) {
    return voiceResult;
  }

  const compileResult = await handleZavorthCompileCommand(sharedParams);
  if (compileResult) {
    return compileResult;
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

  const scaffoldResult = await handleZavorthCliRegistryScaffoldCommand({
    effectiveFlags,
    commandName,
    args,
    writer,
  });
  if (scaffoldResult) {
    return scaffoldResult;
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
        title: 'ready',
        body: 'Command handled without textual response.',
      })
      : 'Command handled without textual response.';
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
  if ((command === 'channels' || command === 'channel') && firstArg === 'consistency') {
    return null;
  }
  const tables: Record<string, { title: string; summary: string; rows: Array<[string, string, string]>; notes: string[] }> = {
    onboard: {
      title: 'Zavorth Onboarding',
      summary: 'Guided first-run path for daily local use.',
      rows: [
        ['1', 'zavorth setup', 'Create the local profile, workspace defaults and safe runtime files.'],
        ['2', 'zavorth doctor --simple', 'Check provider, sandbox, workspace and zavorthControl readiness.'],
        ['3', 'zavorth go', 'Start or resume the main /zavorthControl gateway.'],
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
        ['2', 'zavorth doctor --simple', 'Check provider, sandbox, workspace and zavorthControl readiness.'],
        ['3', 'zavorth go', 'Start or resume the main /zavorthControl gateway.'],
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
        ['zavorthControl', 'ready', 'Main gateway for normal users.'],
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
        ['zavorthControl', 'ready', 'Main gateway for normal users.'],
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
        'The zavorthControl should display the same mission truth as this CLI surface.',
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
        ['cancel/list/read', 'available', 'Operator controls stay visible in CLI and zavorthControl.'],
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
        ['cancel/list/read', 'available', 'Operator controls stay visible in CLI and zavorthControl.'],
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
      zavorthControlPath: '/zavorthControl',
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
