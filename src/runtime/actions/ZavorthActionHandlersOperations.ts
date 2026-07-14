import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { MemoryService } from '../../services/MemoryService.js';
import { GoalLoopService, type GoalLoopLlmRuntime } from '../../services/GoalLoopService.js';
import { GoalLoopWorkerService, type GoalLoopAgentRunner } from '../../services/GoalLoopWorkerService.js';
import { GoalPlaneService } from '../../services/GoalPlaneService.js';
import { ChannelProgressSurfaceService } from '../../services/ChannelProgressSurfaceService.js';
import { IntegrationConnectorMeshService } from '../../services/IntegrationConnectorMeshService.js';
import { TaskBoardPlaneService } from '../../services/TaskBoardPlaneService.js';
import { TaskPlaneService } from '../../services/TaskPlaneService.js';
import { VoiceWakeRuntimeService } from '../../services/VoiceWakeRuntimeService.js';
import { ZavorthBackgroundTaskService } from '../../services/ZavorthBackgroundTaskService.js';
import { ZavorthHomePathService } from '../../services/ZavorthHomePathService.js';
import { ZavorthMnemosQueryService } from '../../services/ZavorthMnemosQueryService.js';
import { ZavorthOperationalStateDbService } from '../../services/ZavorthOperationalStateDbService.js';
import { SessionContinuumService, resolveSessionContinuumStorePath } from '../../services/SessionContinuumService.js';
import { bindAutonomySchedulePlane } from '../../services/AutonomySchedulePlane.js';
import { ZavorthXaiRuntimeService } from '../../services/ZavorthXaiRuntimeService.js';
import { ZavorthCapabilityActionExposureService } from '../../services/ZavorthCapabilityActionExposureService.js';
import { ZavorthCapabilityAtlasService } from '../../services/ZavorthCapabilityAtlasService.js';
import { ZavorthDailyProductQuietAutonomyService } from '../../services/ZavorthDailyProductQuietAutonomyService.js';
import { type ZavorthActionDefinition, type ZavorthActionHandlerInput, type ZavorthActionLookupResult, type ZavorthActionResult } from './ZavorthActionContracts.js';
import {
  createCapabilitySpineActionModule,
  createGovernedOpsActionModule,
  createNativeExtendedToolsActionModule,
  createNativePowerPacksActionModule,
  createPowerFabricActionModule,
  createProductFabricActionModule,
  createProductizationPacksActionModule,
  createReachFabricActionModule,
  createWebBrowserActionModule,
  createWorkspaceFilesActionModule,
} from './modules/index.js';
import { asErrorLike } from '../../utils/errorLike.js';

import { normalizeText, stateDir, redactSecrets, appendJsonArray, idWithTime, result, resolveHome, listJsonFiles, taskPlaneForRoot } from './ZavorthActionHandlersCore.js';
export async function xaiHandler(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const service = new ZavorthXaiRuntimeService({ env: process.env });
  const wantsLive = input.args.live === true || input.args.live === 'true';
  if (input.actionId === 'providers.xai.doctor' || input.operation === 'action.status') {
    const snapshot = wantsLive ? await service.liveDoctor() : service.doctor();
    return result({
      ok: snapshot.status === 'ready',
      actionId: input.actionId,
      operation: input.operation,
      status: snapshot.status === 'ready' ? 'ok' : 'blocked',
      summary: snapshot.configured ? 'xAI provider route is configured.' : 'xAI provider route is missing XAI_API_KEY.',
      lines: [
        `Configured: ${snapshot.configured ? 'yes' : 'no'}`,
        `Model: ${snapshot.model}`,
        `Native search: ${snapshot.capabilities.nativeSearch ? 'yes' : 'no'}`,
        wantsLive ? `Live ready: ${snapshot.liveReady ? 'yes' : 'no'}` : 'Live check: skipped',
      ],
      data: { snapshot },
    });
  }
  const query = normalizeText(input.args.query || input.args.q || input.args.text);
  if (!query) {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: 'xAI search needs a query.',
      lines: ['Provide args.query.'],
    });
  }
  if (input.operation === 'action.preview') {
    const snapshot = await service.search({ query, live: false });
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'preview',
      summary: 'Preview xAI native search.',
      lines: snapshot.lines,
      data: { snapshot },
    });
  }
  const snapshot = await service.search({ query, live: wantsLive && input.trustedOperatorConfirmation });
  return result({
    ok: snapshot.status === 'ready' || snapshot.status === 'preview',
    actionId: input.actionId,
    operation: input.operation,
    status: snapshot.status === 'ready' ? 'ok' : snapshot.status === 'preview' ? 'preview' : 'blocked',
    summary: `xAI search ${snapshot.status}.`,
    lines: snapshot.lines,
    data: { snapshot },
  });
}

export async function taskBoardHandler(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const home = resolveHome(input.root);
  const service = new TaskBoardPlaneService({
    storePath: path.join(home.resolvedPaths.runtimeDir, 'task-board.json'),
    taskPlane: taskPlaneForRoot(input.root),
    stateDbPath: home.resolvedPaths.dbPath,
  });
  if (input.operation === 'action.status' || input.actionId === 'tasks.board.status') {
    const snapshot = service.snapshot();
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'ok',
      summary: `${snapshot.summary.boards} board(s), ${snapshot.summary.tasks} board task(s).`,
      lines: [`Boards: ${snapshot.summary.boards}`, `Ready: ${snapshot.summary.ready}`, `Running: ${snapshot.summary.running}`, `Review: ${snapshot.summary.review}`, `Blocked: ${snapshot.summary.blocked}`],
      data: { snapshot },
    });
  }
  const objective = normalizeText(input.args.objective || input.args.query || input.args.title || input.args.text);
  if (!objective) {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: 'Task board operation needs an objective or title.',
      lines: ['Provide args.objective or args.title.'],
    });
  }
  if (input.operation === 'action.preview') {
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'preview',
      summary: 'Preview TaskBoard operation.',
      lines: [`Objective: ${objective.slice(0, 240)}`, input.actionId === 'tasks.board.decompose' ? 'Will create planner/worker/verifier cards backed by Task Plane.' : 'Will create one board card backed by Task Plane.'],
      data: { objective, taskPlaneBacked: true },
    });
  }
  if (input.actionId === 'tasks.board.decompose') {
    const tasks = service.decompose({
      boardId: normalizeText(input.args.boardId || input.args.board_id) || null,
      objective,
      includeReview: input.args.includeReview !== false,
      actor: input.actorId || 'operator',
    });
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'applied',
      summary: `Created ${tasks.length} board task(s).`,
      lines: tasks.map((task) => `${task.id}: ${task.title}`),
      data: { tasks },
    });
  }
  const task = service.triage({
    boardId: normalizeText(input.args.boardId || input.args.board_id) || null,
    title: objective,
    body: normalizeText(input.args.body || input.args.description) || null,
    actor: input.actorId || 'operator',
  });
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'applied',
    summary: `Created board task ${task.id}.`,
    lines: [`Created board task: ${task.id}`, `Lane: ${String(task.payload.lane || 'backlog')}`],
    data: { task },
  });
}

export function memorySearchHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const query = normalizeText(input.args.query || input.args.q || input.args.text);
  if (!query) {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: 'Memory search needs a query.',
      lines: ['Provide args.query for memory.search.'],
    });
  }
  try {
    const snapshot = new ZavorthMnemosQueryService({ projectRoot: input.root }).query({ query, topK: Number(input.args.topK || 5) });
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'ok',
      summary: `Memory search returned ${snapshot.summary.returned} hit(s).`,
      lines: snapshot.hits.length ? snapshot.hits.map((hit) => `${hit.pageId}: ${hit.title} (${hit.score.toFixed(3)})`) : ['No memory hits.'],
      data: { snapshot },
    });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'ok',
      summary: 'Memory search is empty or not indexed yet.',
      lines: ['No Mnemos wiki/index was available for this workspace.'],
      data: { error: error instanceof Error ? err.message : String(error) },
    });
  }
}

export async function memoryForgetHandler(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const key = normalizeText(input.args.key || input.args.query || input.args.id);
  const userId = normalizeText(input.args.userId || input.args.user_id || 'default');
  if (input.operation === 'action.status' || input.operation === 'action.preview') {
    return result({
      ok: Boolean(key),
      actionId: input.actionId,
      operation: input.operation,
      status: key ? 'preview' : 'blocked',
      summary: key ? `Preview memory forget for key/id ${key}.` : 'Memory forget needs a key or id.',
      lines: key ? [`Target: ${key}`, `User: ${userId}`, 'Apply is approval-gated and uses the native MemoryService forget contract.'] : ['Provide args.key or args.id.'],
      data: { key, userId, durableMutation: false },
    });
  }
  const service = new MemoryService();
  const ok = await service.forget(userId, key);
  const receipt = {
    id: idWithTime('memory-forget'),
    actionId: input.actionId,
    operation: input.operation,
    status: ok ? ('applied' as const) : ('failed' as const),
    createdAt: new Date().toISOString(),
    sourceSurface: input.sourceSurface || null,
    actorId: input.actorId || null,
    summary: ok ? `Forgot memory ${key}.` : `Memory ${key} was not found.`,
    data: { key, userId },
  };
  await appendJsonArray(path.join(stateDir(input.root), 'receipts', 'memory-forget.json'), receipt);
  return {
    ok,
    actionId: input.actionId,
    operation: input.operation,
    status: ok ? 'applied' : 'blocked',
    summary: receipt.summary,
    lines: [receipt.summary],
    data: { key, userId, forgotten: ok },
    receipt,
  };
}

export function approvalsStatusHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const plans = listJsonFiles(path.join(stateDir(input.root), 'mutation-plans'));
  const pending = plans.filter((plan) => plan.status === 'waiting_approval' || (plan.approval as { status?: unknown } | undefined)?.status === 'pending');
  const approved = plans.filter((plan) => plan.status === 'approved' || (plan.approval as { status?: unknown } | undefined)?.status === 'approved');
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `${pending.length} pending approval(s).`,
    lines: [`Pending: ${pending.length}`, `Approved: ${approved.length}`, `Plans: ${plans.length}`],
    data: { pending: pending.length, approved: approved.length, plans: plans.slice(-20).map(redactSecrets) },
  });
}

export function channelsReadinessHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const channels = [
    ['telegram', ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_DEFAULT_CHAT_ID']],
    ['discord', ['DISCORD_WEBHOOK_URL']],
    ['slack', ['SLACK_WEBHOOK_URL']],
    ['whatsapp', ['WHATSAPP_BRIDGE_URL', 'WHATSAPP_WEBHOOK_URL', 'WHATSAPP_OUTBOX_DIR']],
    ['signal', ['SIGNAL_JSONRPC_URL', 'SIGNAL_CLI_PATH']],
    ['teams', ['TEAMS_WEBHOOK_URL', 'MSTEAMS_WEBHOOK_URL']],
    ['email', ['SMTP_HOST', 'RESEND_API_KEY']],
  ].map(([id, envs]) => {
    const envList = envs as string[];
    return { id, ready: envList.some((key) => Boolean(process.env[key])), env: envList };
  });
  const ready = channels.filter((channel) => channel.ready).length;
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `${ready} channel adapter(s) have configuration hints.`,
    lines: channels.map((channel) => `${channel.id}: ${channel.ready ? 'configured' : 'missing env'}`),
    data: { channels, ready },
  });
}

export async function channelProgressHandler(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const service = new ChannelProgressSurfaceService({
    stateFile: path.join(stateDir(input.root), 'channel-progress-surface.json'),
  });
  if (input.operation === 'action.status') {
    const snapshot = service.snapshot();
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'ok',
      summary: `${snapshot.sessions.length} channel progress session(s).`,
      lines: [`Sessions: ${snapshot.sessions.length}`, `Receipts: ${snapshot.receipts.length}`, ...snapshot.capabilities.map((capability) => `${capability.channel}: ${capability.canEdit ? 'edit' : 'send'} progress`)],
      data: { snapshot },
    });
  }

  const event = {
    runId: normalizeText(input.args.runId || input.args.run_id || input.args.id || 'preview-run'),
    channel: normalizeText(input.args.channel || 'telegram') as any,
    chatId: normalizeText(input.args.chatId || input.args.chat_id || 'preview-chat'),
    messageId: normalizeText(input.args.messageId || input.args.message_id) || null,
    stage: normalizeText(input.args.stage || 'tool_progress') as any,
    title: normalizeText(input.args.title || input.args.query || 'Zavorth status update'),
    detail: normalizeText(input.args.detail || input.args.text || input.args.query || 'The run is making progress.'),
    toolName: normalizeText(input.args.toolName || input.args.tool_name) || null,
    actionId: normalizeText(input.args.targetActionId || input.args.target_action_id) || null,
    integrationId: normalizeText(input.args.integrationId || input.args.integration_id) || null,
    link: normalizeText(input.args.link) || null,
    finalText: normalizeText(input.args.finalText || input.args.final_text) || null,
  };
  const rendered = service.render(event);

  if (input.operation === 'action.preview') {
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'preview',
      summary: `Preview channel progress update for ${event.channel}.`,
      lines: rendered.split('\n'),
      data: {
        rendered,
        capability: service.capabilityFor(event.channel),
        progressNotTranscript: true,
        outboundPolicyRequired: true,
      },
    });
  }

  if (input.operation !== 'action.apply') {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: `Unsupported operation for ${input.actionId}.`,
      lines: [`Unsupported operation: ${input.operation}`],
    });
  }

  const receipt = await service.publish(event);
  await appendJsonArray(path.join(stateDir(input.root), 'receipts', 'channel-progress.json'), receipt);
  const applied = receipt.status !== 'failed' && receipt.transport !== 'off';
  return {
    ok: applied,
    actionId: input.actionId,
    operation: input.operation,
    status: applied ? 'applied' : 'blocked',
    summary: receipt.summary,
    lines: [`${receipt.channel}: ${receipt.status} via ${receipt.transport}`, `Stage: ${receipt.stage}`, `Message: ${receipt.messageId || 'none'}`],
    data: { receipt },
    receipt: {
      id: receipt.id,
      actionId: input.actionId,
      operation: input.operation,
      status: receipt.status === 'failed' ? 'failed' : 'applied',
      createdAt: receipt.createdAt,
      sourceSurface: input.sourceSurface || null,
      actorId: input.actorId || null,
      summary: receipt.summary,
      data: redactSecrets({ receipt }) as Record<string, unknown>,
    },
  };
}

export async function integrationConnectorsHandler(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const service = new IntegrationConnectorMeshService();
  const connectorId = normalizeText(input.args.connectorId || input.args.connector_id || input.args.id || input.args.query);
  if (input.actionId === 'integration.connectors.status' || input.operation === 'action.status') {
    const snapshot = await service.snapshot();
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'ok',
      summary: `${snapshot.summary.configured}/${snapshot.summary.total} connector broker(s) configured.`,
      lines: snapshot.doctors.map((doctor) => `${doctor.id}: ${doctor.status} | ${doctor.summary}`),
      data: { snapshot },
    });
  }

  if (input.actionId === 'integration.connectors.doctor') {
    if (!connectorId) {
      const snapshot = await service.snapshot();
      return result({
        ok: true,
        actionId: input.actionId,
        operation: input.operation,
        status: input.operation === 'action.preview' ? 'preview' : 'ok',
        summary: `${snapshot.summary.ready} connector broker(s) ready.`,
        lines: snapshot.doctors.map((doctor) => `${doctor.id}: ${doctor.status} | ${doctor.nextAction}`),
        data: { snapshot },
      });
    }
    const doctor = await service.doctor(connectorId);
    return result({
      ok: doctor.status !== 'failed',
      actionId: input.actionId,
      operation: input.operation,
      status: input.operation === 'action.preview' ? 'preview' : 'ok',
      summary: `${doctor.label}: ${doctor.status}.`,
      lines: [`Connector: ${doctor.id}`, `Status: ${doctor.status}`, `Configured: ${doctor.configured ? 'yes' : 'no'}`, `Probe: ${doctor.checkedTarget || 'not configured'}`, `Next: ${doctor.nextAction}`],
      data: { doctor },
    });
  }

  if (input.actionId !== 'integration.connectors.execute') {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: `Unsupported connector action ${input.actionId}.`,
      lines: [`Unsupported action: ${input.actionId}`],
    });
  }

  const toolSlug = normalizeText(input.args.toolSlug || input.args.tool_slug || input.args.tool);
  const toolInput = input.args.input && typeof input.args.input === 'object' && !Array.isArray(input.args.input) ? (input.args.input as Record<string, unknown>) : {};

  if (input.operation === 'action.preview') {
    try {
      const preview = service.buildExecutePreview({ connectorId, toolSlug, input: toolInput });
      return result({
        ok: true,
        actionId: input.actionId,
        operation: input.operation,
        status: 'preview',
        summary: `Preview ${preview.connectorId} tool execution: ${preview.toolSlug}.`,
        lines: [`Connector: ${preview.connectorId}`, `Tool: ${preview.toolSlug}`, `Target: ${preview.target}`, 'External execution requires approval and receipt.'],
        data: { preview },
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      return result({
        ok: false,
        actionId: input.actionId,
        operation: input.operation,
        status: 'blocked',
        summary: error instanceof Error ? err.message : String(error),
        lines: [error instanceof Error ? err.message : String(error)],
      });
    }
  }

  if (input.operation !== 'action.apply') {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: `Unsupported operation for ${input.actionId}.`,
      lines: [`Unsupported operation: ${input.operation}`],
    });
  }

  const execution = await service.executeTool({ connectorId, toolSlug, input: toolInput });
  const connectorReceipt = {
    id: idWithTime('integration-connector'),
    actionId: input.actionId,
    operation: input.operation,
    status: execution.ok ? ('applied' as const) : ('failed' as const),
    createdAt: new Date().toISOString(),
    sourceSurface: input.sourceSurface || null,
    actorId: input.actorId || null,
    summary: execution.summary,
    data: redactSecrets(execution) as Record<string, unknown>,
  };
  await appendJsonArray(path.join(stateDir(input.root), 'receipts', 'integration-connectors.json'), connectorReceipt);
  return {
    ok: execution.ok,
    actionId: input.actionId,
    operation: input.operation,
    status: execution.ok ? 'applied' : 'blocked',
    summary: execution.summary,
    lines: [`Connector: ${execution.connectorId}`, `Tool: ${execution.toolSlug}`, `HTTP: ${execution.httpStatus || 'n/a'}`],
    data: { execution },
    receipt: connectorReceipt,
  };
}
