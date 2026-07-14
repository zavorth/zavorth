import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'crypto';
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { spawnCommandLine } from '../security/SafeProcessExec.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import { formatZavorthCertificationHelp } from './ZavorthCliCertificationCommands.js';
import { ZavorthOperationalReadinessService } from '../services/ZavorthOperationalReadinessService.js';
import { ZavorthNativeCapabilityCertificationService } from '../services/ZavorthNativeCapabilityCertificationService.js';
import { ZavorthProductExcellenceService } from '../services/ZavorthProductExcellenceService.js';
import { AutonomySchedulePlane, bindAutonomySchedulePlane } from '../services/AutonomySchedulePlane.js';
import { GoalLoopService } from '../services/GoalLoopService.js';
import { GoalLoopDaemonService } from '../services/GoalLoopDaemonService.js';
import { GoalLoopWorkerService } from '../services/GoalLoopWorkerService.js';
import { GoalPlaneService } from '../services/GoalPlaneService.js';
import { TaskBoardPlaneService } from '../services/TaskBoardPlaneService.js';
import { TaskPlaneService } from '../services/TaskPlaneService.js';
import { ZavorthHomePathService } from '../services/ZavorthHomePathService.js';
import { ZavorthBackgroundTaskService } from '../services/ZavorthBackgroundTaskService.js';
import { ZavorthCapabilityLifecycleService } from '../services/ZavorthCapabilityLifecycleService.js';
import { ZavorthCapabilityUsageSignalsService } from '../services/ZavorthCapabilityUsageSignalsService.js';
import { ZavorthCapabilityAtlasService } from '../services/ZavorthCapabilityAtlasService.js';
import { ZavorthDailyProductQuietAutonomyService } from '../services/ZavorthDailyProductQuietAutonomyService.js';
import { ZavorthActionGateway, type ZavorthActionOperation } from '../runtime/actions/index.js';
import { SessionContinuumService, resolveSessionContinuumStorePath } from '../services/SessionContinuumService.js';
import { ZavorthXaiRuntimeService } from '../services/ZavorthXaiRuntimeService.js';
import { ZavorthOperationalStateDbService } from '../services/ZavorthOperationalStateDbService.js';
import { LlmRuntimeService } from '../services/llm/LlmRuntimeService.js';
import { SkillCuratorPlaneService } from '../skills/SkillCuratorPlaneService.js';
import { runSkills as runSkillsNamespace } from './skills/ZavorthCliSkillsNamespace.js';
import { runPlugins as runPluginsNamespace } from './plugins/ZavorthCliPluginsNamespace.js';
import { AgentRunService } from '../runtime/agent/AgentRunService.js';
import { TerminalPanel } from './presentation/TerminalPanel.js';
import { ChannelGatewayFactory } from '../gateways/ChannelGatewayFactory.js';
import { runCertify } from './certify/ZavorthCliCertifyNamespace.js';
import { runSandbox } from './sandbox/ZavorthCliSandboxNamespace.js';
import {
  firstArg,
  readFlag,
  readFlags,
  readNumberFlag,
  stateDir,
  ensureDir,
  readJson,
  readArray,
  writeJson,
  appendJsonArray,
  listJsonFiles,
  listAnyFiles,
  walkFiles,
  idWithTime,
  safeString,
  isInside,
  runProcess,
  sha256,
  render,
  normalizeRenderLines,
  resolvePanelType,
  terminalPanelWidth,
  text,
  splitList,
  getEnv,
  quoteEnv,
  mergeSingleEnvValue,
} from './ZavorthCliSharedHelpers.js';
import type { ZavorthCapabilityUsageEventKind, ZavorthCapabilityUsageSurface } from '../contracts/ZavorthCapabilityUsageSignalsContract.js';
import type { ZavorthCapabilityAtlasCategory } from '../contracts/ZavorthCapabilityAtlasContract.js';
import type { ZavorthAppsSatelliteAction, ZavorthAppsSatelliteNodeKind } from '../contracts/ZavorthAppsSatelliteNodesContract.js';
import type { ZavorthTerminalBackendId } from '../contracts/runtime/ZavorthTerminalBackendsContract.js';
import type { SwarmScaleExecutionMode, SwarmScaleExecutionBackendId } from '../domain/execution/infrastructure/SwarmScalePlaneService.js';
import { logger } from '../logger.js';
import { asErrorLike, errorMessage } from '../utils/errorLike.js';

type JsonObject = Record<string, unknown>;
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export function getPath(obj: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => (acc && typeof acc === 'object' ? (acc as JsonObject)[part] : undefined), obj);
}

export function setPath(obj: JsonObject, key: string, value: unknown): void {
  const parts = key.split('.');
  let cursor = obj;
  for (const part of parts.slice(0, -1)) {
    if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {};
    cursor = cursor[part] as JsonObject;
  }
  cursor[parts.at(-1) || key] = value;
}

export function unsetPath(obj: JsonObject, key: string): void {
  const parts = key.split('.');
  let cursor: JsonObject | undefined = obj;
  for (const part of parts.slice(0, -1)) {
    const next: unknown = cursor[part];
    cursor = next && typeof next === 'object' ? (next as JsonObject) : undefined;
    if (!cursor) return;
  }
  delete cursor[parts.at(-1) || key];
}

export function redact(value: string): string {
  return value.length <= 8 ? '***' : `${value.slice(0, 4)}...${value.slice(-2)}`;
}

export function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.username) url.username = '***';
    if (url.password) url.password = '***';
    for (const key of Array.from(url.searchParams.keys())) {
      if (/token|key|secret|auth|sig/iu.test(key)) url.searchParams.set(key, '***');
    }
    return url.toString();
  } catch (error: unknown) {
    logger.warn('[Zavorth Cli Live Namespaces] search failed', error);
    return redact(value);
  }
}

export function sanitizeMessageRecord(value: unknown): JsonObject {
  const item = { ...((value || {}) as JsonObject) };
  if (item.message) item.message = redact(String(item.message));
  if (Array.isArray(item.attachments)) item.attachments = item.attachments.map((entry) => path.basename(String(entry)));
  if (item.delivery && typeof item.delivery === 'object') item.delivery = sanitizeDelivery(item.delivery as JsonObject);
  return item;
}

export function sanitizeDelivery(value: JsonObject): JsonObject {
  const copy = { ...value };
  if (Array.isArray(copy.receipts)) {
    copy.receipts = copy.receipts.map((receipt) => {
      const item = { ...((receipt || {}) as JsonObject) };
      if (item.target) item.target = redact(String(item.target));
      return item;
    });
  }
  return copy;
}

export function formatMessageReceipt(value: unknown): string {
  const item = value as JsonObject;
  return `- ${String(item.id)} | ${String(item.channel)} | ${String(item.status)} | targets ${Array.isArray(item.targets) ? item.targets.length : 0}`;
}
