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

import { normalizeText, normalizePositiveNumber, stateDir, envFile, redactSecrets, result, resolveHome, stateDbForHome, readJsonFile } from './ZavorthActionHandlersCore.js';
export function sandboxStatusHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const receipts = readJsonFile(path.join(stateDir(input.root), 'logs', 'sandbox.json'), []);
  const dockerHint = Boolean(process.env.DOCKER_HOST || fs.existsSync('/var/run/docker.sock'));
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: dockerHint ? 'Sandbox has Docker configuration hints.' : 'Sandbox is available as preview/policy surface; strong backend not detected by env.',
    lines: [`Docker hint: ${dockerHint ? 'yes' : 'no'}`, `Receipts: ${Array.isArray(receipts) ? receipts.length : 0}`],
    data: { dockerHint, receipts: Array.isArray(receipts) ? receipts.slice(-10).map(redactSecrets) : [] },
  });
}

export function capabilityAtlasHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const snapshot = new ZavorthCapabilityAtlasService({
    projectRoot: input.root,
  }).buildSnapshot({
    query: normalizeText(input.args.query) || null,
    category: typeof input.args.category === 'string' ? (input.args.category as any) : null,
    limit: normalizePositiveNumber(input.args.limit),
  });
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: snapshot.status === 'missing' ? 'blocked' : 'ok',
    summary: `Capability Atlas mapped ${snapshot.summary.total} Zavorth capability surface(s).`,
    lines: [
      `Status: ${snapshot.status}`,
      `Total: ${snapshot.summary.total}`,
      `Visible to LLM: ${snapshot.summary.llmVisible}`,
      `Action-backed: ${snapshot.summary.actionHarnessBacked}`,
      ...snapshot.entries.slice(0, 12).map((entry) => `- ${entry.id} [${entry.status}] ${entry.title} :: ${entry.dailyUse}`),
    ],
    data: { atlas: snapshot },
  });
}

export function dailyProductHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const snapshot = new ZavorthDailyProductQuietAutonomyService().buildSnapshot({
    profileId: normalizeText(input.args.profileId || input.args.profile || input.args.query) || null,
  });
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: snapshot.status === 'blocked' ? 'blocked' : 'ok',
    summary: `Daily product is ${snapshot.status}; active profile ${snapshot.activeProfileId} uses ${snapshot.quietAutonomy.activePolicy.mode}.`,
    lines: [
      `Status: ${snapshot.status}`,
      `Primary surface: ${snapshot.dailyProduct.primarySurface}`,
      `Tabs: ${snapshot.dailyProduct.visibleTabs.map((tab) => tab.label).join(', ')}`,
      `Quiet: ${snapshot.quietAutonomy.activePolicy.mode}`,
      `Silent: ${snapshot.quietAutonomy.activePolicy.silentLanes.map((lane) => lane.lane).join(', ') || 'none'}`,
      `Approval: ${snapshot.quietAutonomy.activePolicy.approvalLanes.map((lane) => lane.lane).join(', ') || 'none'}`,
    ],
    data: { dailyProduct: snapshot },
  });
}

export function gitReviewHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const hasGit = fs.existsSync(path.join(input.root, '.git'));
  return result({
    ok: hasGit,
    actionId: input.actionId,
    operation: input.operation,
    status: hasGit ? 'ok' : 'blocked',
    summary: hasGit ? 'Git repository detected for governed review.' : 'No .git directory detected in this root.',
    lines: hasGit ? ['Git review can run through the governed review command surface.'] : ['No git repository was found for this workspace root.'],
    data: { hasGit, root: input.root },
  });
}

export function setupStatusHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const progress = readJsonFile(path.join(stateDir(input.root), 'setup-progress.json'), null);
  const envExists = fs.existsSync(envFile(input.root));
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: progress ? 'Setup progress exists.' : 'No setup progress file found.',
    lines: [`Setup progress: ${progress ? 'present' : 'missing'}`, `.env: ${envExists ? 'present' : 'missing'}`],
    data: { progress: redactSecrets(progress), envExists },
  });
}

export function configStatusHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const envExists = fs.existsSync(envFile(input.root));
  const stateExists = fs.existsSync(stateDir(input.root));
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `Config state: .env ${envExists ? 'present' : 'missing'}, .zavorth ${stateExists ? 'present' : 'missing'}.`,
    lines: [`.env: ${envExists ? 'present' : 'missing'}`, `.zavorth: ${stateExists ? 'present' : 'missing'}`],
    data: { envExists, stateExists, root: input.root },
  });
}

export function operationalStateStatusHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const home = resolveHome(input.root);
  const stateDb = stateDbForHome(home);
  const snapshot = stateDb.snapshot();
  stateDb.close();
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `Operational StateDB has ${snapshot.counts.events} event(s), ${snapshot.counts.tasks} task(s), ${snapshot.counts.messages} message(s).`,
    lines: [
      `DB: ${snapshot.dbPath}`,
      `Journal: ${snapshot.journalMode}`,
      `FTS: ${snapshot.ftsAvailable ? 'enabled' : 'fallback'}`,
      `Sessions: ${snapshot.counts.sessions}`,
      `Messages: ${snapshot.counts.messages}`,
      `Tasks: ${snapshot.counts.tasks}`,
      `Goals: ${snapshot.counts.goals}`,
      `Boards: ${snapshot.counts.boards}`,
      `Events: ${snapshot.counts.events}`,
    ],
    data: { snapshot },
  });
}

export function capabilityActionExposureService(input: ZavorthActionHandlerInput): ZavorthCapabilityActionExposureService {
  return new ZavorthCapabilityActionExposureService({
    projectRoot: input.root,
    env: process.env,
  });
}

export function verificationIdsFromArgs(args: Record<string, unknown>): string[] {
  const single = normalizeText(args.verificationId || args.verification || args.id);
  const many = Array.isArray(args.verificationIds) ? args.verificationIds.map((value) => normalizeText(value)).filter(Boolean) : [];
  return [...many, single].filter(Boolean);
}

export function capabilityExposureHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const service = capabilityActionExposureService(input);
  if (input.operation === 'action.status' || input.actionId === 'capabilities.verified.status') {
    const snapshot = service.snapshot();
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'ok',
      summary: `${snapshot.summary.exposures} verified capability action candidate(s) exposed.`,
      lines: snapshot.exposures.length ? snapshot.exposures.map((exposure) => `${exposure.actionId}: ${exposure.status} | ${exposure.title}`) : ['No verified capability action candidate has been exposed yet.'],
      data: { snapshot },
    });
  }

  const request = {
    allVerified: input.args.allVerified === true || input.args.all === true || verificationIdsFromArgs(input.args).length === 0,
    verificationIds: verificationIdsFromArgs(input.args),
    actor: input.actorId || 'operator',
  };

  if (input.operation === 'action.preview') {
    const preview = service.preview(request);
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'preview',
      summary: `Preview Action Harness exposure for ${preview.selected} verified capability candidate(s).`,
      lines: [...preview.lines, 'Preview only. No Action Harness exposure store was written.'],
      data: { preview },
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

  const snapshot = service.expose(request);
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'applied',
    summary: `${snapshot.summary.exposures} capability action candidate(s) are exposed through the Action Harness.`,
    lines: snapshot.exposures.length ? snapshot.exposures.map((exposure) => `${exposure.actionId}: ${exposure.status} | ${exposure.title}`) : ['No new exposure was created.'],
    data: { snapshot },
  });
}

export function generatedCapabilityCandidateHandler(exposureActionId: string): ZavorthActionDefinition['handler'] {
  return (input: ZavorthActionHandlerInput): ZavorthActionResult => {
    const service = capabilityActionExposureService(input);
    const exposure = service.snapshot().exposures.find((entry) => entry.actionId === exposureActionId);
    if (!exposure) {
      return result({
        ok: false,
        actionId: input.actionId,
        operation: input.operation,
        status: 'not_found',
        summary: 'Capability action exposure was not found.',
        lines: [`Missing exposed candidate: ${exposureActionId}`],
      });
    }
    if (input.operation === 'action.status' || input.operation === 'action.preview') {
      return result({
        ok: true,
        actionId: input.actionId,
        operation: input.operation,
        status: input.operation === 'action.preview' ? 'preview' : 'ok',
        summary: `Capability action candidate ${exposure.actionId} is exposed but not live-activated.`,
        lines: [`Candidate: ${exposure.title}`, `Verification: ${exposure.verificationId}`, 'Tool execution: disabled', 'Live activation: disabled', 'Visible product surfaces and activation gates are still required before live use.'],
        data: { exposure },
      });
    }
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: `Capability action candidate ${exposure.actionId} cannot execute yet.`,
      lines: ['This candidate is discoverable through the Action Harness, but live execution is intentionally disabled.', 'Complete activation gates before any tool call, network call or live activation.'],
      data: { exposure },
    });
  };
}
