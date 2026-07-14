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
import {
  type ZavorthActionDefinition,
  type ZavorthActionHandlerInput,
  type ZavorthActionLookupResult,
  type ZavorthActionResult,
} from './ZavorthActionContracts.js';
import { createCapabilitySpineActionModule, createGovernedOpsActionModule, createNativeExtendedToolsActionModule, createNativePowerPacksActionModule, createPowerFabricActionModule, createProductFabricActionModule, createProductizationPacksActionModule, createReachFabricActionModule, createWebBrowserActionModule, createWorkspaceFilesActionModule } from './modules/index.js';
import { asErrorLike } from '../../utils/errorLike.js';

const SKILL_GOVERNANCE_ENV_KEY = 'ZAVORTH_SKILLS_GOVERNANCE_MODE';

import { normalizeText, result, resolveHome, taskPlaneForRoot } from './ZavorthActionHandlersCore.js';
import type { ZavorthActionCatalogRuntime } from './ZavorthActionCatalog.js';
export async function goalLoopHandler(
  input: ZavorthActionHandlerInput,
  runtime: ZavorthActionCatalogRuntime = {},
): Promise<ZavorthActionResult> {
  const home = resolveHome(input.root);
  const taskPlane = taskPlaneForRoot(input.root);
  const goalPlane = new GoalPlaneService({
    storePath: path.join(home.resolvedPaths.runtimeDir, 'goal-plane.json'),
    taskPlane,
    stateDbPath: home.resolvedPaths.dbPath,
  });
  const goalId = normalizeText(input.args.goalId || input.args.goal_id || input.args.id);
  if (!goalId) {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: 'Goal loop needs a goal id.',
      lines: ['Provide args.goalId or args.id.'],
    });
  }
  const goal = goalPlane.snapshot().goals.find((entry) => entry.id === goalId) || null;
  if (input.operation === 'action.status' || input.operation === 'action.preview') {
    return result({
      ok: Boolean(goal),
      actionId: input.actionId,
      operation: input.operation,
      status: goal ? (input.operation === 'action.preview' ? 'preview' : 'ok') : 'blocked',
      summary: goal ? `Preview Goal Loop step for ${goal.id}.` : `Goal not found: ${goalId}.`,
      lines: goal
        ? [
          `Goal: ${goal.id}`,
          `Status: ${goal.status}`,
          `Turns: ${goal.turnsUsed}/${goal.maxTurns}`,
          'Apply will evaluate the goal and may queue a continuation task; it will not execute work directly.',
        ]
        : [`No goal found for id: ${goalId}`],
      data: {
        goal,
        noSilentExecution: true,
        continuationQueuedNotExecuted: true,
      },
    });
  }
  const loop = new GoalLoopService({
    goalPlane,
    taskPlane,
    stateDbPath: home.resolvedPaths.dbPath,
    llmRuntime: runtime.goalLoopLlmRuntime || null,
  });
  const snapshot = await loop.evaluate({
    goalId,
    turnSummary: normalizeText(input.args.summary || input.args.detail || input.args.result) || null,
    lastAssistantText: normalizeText(input.args.lastAssistantText || input.args.last_assistant) || null,
    userIntervened: input.args.userIntervened === true || input.args.user_intervened === true,
    force: input.args.force === true,
    actor: input.actorId || 'action-harness',
    sourceSurface: input.sourceSurface || 'action-harness',
  });
  return result({
    ok: snapshot.verdict.status !== 'blocked',
    actionId: input.actionId,
    operation: input.operation,
    status: snapshot.verdict.status === 'blocked' ? 'blocked' : 'applied',
    summary: `Goal loop ${snapshot.verdict.status}: ${snapshot.verdict.reason}`,
    lines: [
      `Goal: ${snapshot.goal?.id || goalId}`,
      `Verdict: ${snapshot.verdict.status}`,
      `Judge: ${snapshot.verdict.judge}`,
      `Reason: ${snapshot.verdict.reason}`,
      snapshot.continuationTask ? `Queued continuation: ${snapshot.continuationTask.id}` : 'Queued continuation: none',
      snapshot.receipt ? `Receipt: ${snapshot.receipt.id}` : 'Receipt: none',
    ],
    data: { snapshot },
  });
}

export async function goalLoopWorkerHandler(
  input: ZavorthActionHandlerInput,
  runtime: ZavorthActionCatalogRuntime = {},
): Promise<ZavorthActionResult> {
  const home = resolveHome(input.root);
  const taskPlane = taskPlaneForRoot(input.root);
  const goalPlane = new GoalPlaneService({
    storePath: path.join(home.resolvedPaths.runtimeDir, 'goal-plane.json'),
    taskPlane,
    stateDbPath: home.resolvedPaths.dbPath,
  });
  const loop = new GoalLoopService({
    goalPlane,
    taskPlane,
    stateDbPath: home.resolvedPaths.dbPath,
    llmRuntime: runtime.goalLoopLlmRuntime || null,
  });
  const previewWorker = runtime.goalLoopAgentRunner
    ? new GoalLoopWorkerService({
      goalPlane,
      taskPlane,
      loop,
      agentRunner: runtime.goalLoopAgentRunner,
      stateDbPath: home.resolvedPaths.dbPath,
    })
    : null;
  if (input.operation === 'action.status' || input.operation === 'action.preview') {
    const preview = previewWorker?.preview({
      taskId: normalizeText(input.args.taskId || input.args.task_id || input.args.id) || null,
      workerId: normalizeText(input.args.workerId || input.args.worker_id) || 'action-goal-loop-worker',
    }) || null;
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: input.operation === 'action.preview' ? 'preview' : 'ok',
      summary: preview?.task
        ? `Goal Loop worker can process ${preview.task.id}.`
        : runtime.goalLoopAgentRunner
          ? 'No queued Goal Loop continuation task is available.'
          : 'Goal Loop worker needs an injected AgentRun runner on this surface.',
      lines: [
        runtime.goalLoopAgentRunner ? 'AgentRun runner: connected' : 'AgentRun runner: missing',
        preview?.task ? `Next task: ${preview.task.id}` : 'Next task: none',
        'Apply claims one task, runs AgentRun, updates status, then re-judges the goal.',
      ],
      data: { preview, runnerConnected: Boolean(runtime.goalLoopAgentRunner) },
    });
  }
  if (!runtime.goalLoopAgentRunner) {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: 'Goal Loop worker is not connected to an AgentRun runner on this surface.',
      lines: [
        'Connect an AgentRunService/runner before applying goals.loop.worker.',
        'CLI uses zavorth goals worker; embedded surfaces should inject goalLoopAgentRunner.',
      ],
    });
  }
  const worker = new GoalLoopWorkerService({
    goalPlane,
    taskPlane,
    loop,
    agentRunner: runtime.goalLoopAgentRunner,
    stateDbPath: home.resolvedPaths.dbPath,
  });
  const snapshot = await worker.drain({
    taskId: normalizeText(input.args.taskId || input.args.task_id || input.args.id) || null,
    workerId: normalizeText(input.args.workerId || input.args.worker_id) || 'action-goal-loop-worker',
    maxItems: Number(input.args.maxItems || input.args.max_items || 1),
    leaseMs: Number(input.args.leaseMs || input.args.lease_ms || 5 * 60 * 1000),
    dryRun: input.args.dryRun === true || input.args.dry_run === true,
  });
  return result({
    ok: snapshot.processed > 0,
    actionId: input.actionId,
    operation: input.operation,
    status: snapshot.processed > 0 ? 'applied' : 'blocked',
    summary: `Goal Loop worker processed ${snapshot.processed}/${snapshot.maxItems} task(s).`,
    lines: [
      `Worker: ${snapshot.workerId}`,
      `Processed: ${snapshot.processed}/${snapshot.maxItems}`,
      ...snapshot.runs.slice(0, 8).map((run) => `${run.task?.id || 'none'} | agent ${run.agentRun?.status || 'not-run'} | verdict ${run.loop?.verdict.status || 'not-judged'}`),
    ],
    data: { snapshot },
  });
}
