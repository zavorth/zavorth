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
import {
  AutonomySchedulePlane,
  bindAutonomySchedulePlane,
} from '../services/AutonomySchedulePlane.js';
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
import {
  SessionContinuumService,
  resolveSessionContinuumStorePath,
} from '../services/SessionContinuumService.js';
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
  mergeSingleEnvValue
} from './ZavorthCliSharedHelpers.js';
import type { ZavorthCapabilityUsageEventKind, ZavorthCapabilityUsageSurface } from '../contracts/ZavorthCapabilityUsageSignalsContract.js';
import type { ZavorthCapabilityAtlasCategory } from '../contracts/ZavorthCapabilityAtlasContract.js';
import type { ZavorthAppsSatelliteAction, ZavorthAppsSatelliteNodeKind } from '../contracts/ZavorthAppsSatelliteNodesContract.js';
import type { ZavorthTerminalBackendId } from '../contracts/runtime/ZavorthTerminalBackendsContract.js';
import type { SwarmScaleExecutionMode, SwarmScaleExecutionBackendId } from '../domain/execution/infrastructure/SwarmScalePlaneService.js';
import { logger } from '../logger.js';
import { asErrorLike, errorMessage } from '../utils/errorLike.js';
import { goalLoopDaemonServiceForCli } from './ZavorthCliLiveNamespaces.js';
import { redactCommand } from './ZavorthCliMcpNamespace.js';
import {
  createPairingDraft,
  formatDirectoryEntry,
  hashPairingCode,
  lookupChannelDirectory,
  mergeDirectoryEntries,
  pairingExpired,
  redactPairingRecord,
} from './ZavorthCliCommunicationNamespace.js';


type JsonObject = Record<string, unknown>;
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export async function runStatusLike(root: string, command: string, args: string[], actions: string[]) {
  return render(args, `Zavorth ${command}`, [
    `state dir: ${stateDir(root)}`,
    `supported actions: ${actions.join(', ')}`,
    'live service control requires configured backend evidence.',
  ], { command, actions, stateDir: stateDir(root) });
}

export async function runHostPresence(root: string, args: string[]) {
  const { HostPresenceUnit, renderHostPresenceText } = await import('../host/HostPresenceUnit.js');
  const home = new ZavorthHomePathService({
    projectRoot: root,
    explicitHome: readFlag(args, 'home') || null,
    env: process.env,
  }).resolveSnapshot();
  const unit = new HostPresenceUnit({
    projectRoot: root,
    env: process.env,
    stateDir: path.join(stateDir(root), 'host-presence'),
    stateDbPath: home.resolvedPaths.dbPath,
    readGoalLoopHeartbeat: () => {
      try {
        const daemon = goalLoopDaemonServiceForCli(root, args);
        const snap = daemon.snapshot({
          daemonId: readFlag(args, 'daemon-id') || 'cli-goal-loop-daemon',
        });
        return {
          daemonId: snap.daemonId,
          status: snap.status,
          lastHeartbeatAt: snap.lastHeartbeatAt,
          source: snap.lastHeartbeatAt ? 'state-db' as const : 'none' as const,
          heartbeatRecorded: snap.safety.heartbeatRecorded,
        };
      } catch {
        return null;
      }
    },
    probeGateway: async (baseUrl) => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1800);
        const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/health`, {
          signal: controller.signal,
        }).catch(async () =>
          fetch(`${baseUrl.replace(/\/+$/, '')}/api/health`, {
            signal: controller.signal,
          }),
        );
        clearTimeout(timer);
        const status = response?.status || 0;
        const ok = status >= 200 && status < 500;
        return { ok, summary: ok ? `HTTP ${status}` : `unreachable (${status || 'error'})` };
      } catch (error: unknown) {
        return { ok: false, summary: errorMessage(error) };
      }
    },
  });

  const action = firstArg(args, 'status');
  const dryRun = args.includes('--dry-run');
  const yes = args.includes('--yes') || args.includes('-y');

  if (action === 'install') {
    const result = await unit.install({
      dryRun,
      ensureBinary: !args.includes('--skip-ensure'),
      osService: !args.includes('--no-os-service'),
      command: readFlag(args, 'command') || null,
    });
    return render(args, 'Zavorth host', [result.summary, ...result.snapshot.lines], {
      host: result.snapshot as unknown as JsonObject,
      ok: result.ok,
      dryRun: result.dryRun,
    });
  }
  if (action === 'start') {
    const result = await unit.start({
      dryRun: dryRun || !yes,
      yes,
      command: readFlag(args, 'command') || null,
    });
    return render(args, 'Zavorth host', [result.summary, ...result.snapshot.lines], {
      host: result.snapshot as unknown as JsonObject,
      ok: result.ok,
      dryRun: result.dryRun,
    });
  }
  if (action === 'stop') {
    const result = await unit.stop({
      dryRun: dryRun || !yes,
      yes,
    });
    return render(args, 'Zavorth host', [result.summary, ...result.snapshot.lines], {
      host: result.snapshot as unknown as JsonObject,
      ok: result.ok,
      dryRun: result.dryRun,
    });
  }
  if (action === 'status' || action === 'health') {
    const result = await unit.status();
    return render(args, 'Zavorth host', [result.summary, ...result.snapshot.lines], {
      host: result.snapshot as unknown as JsonObject,
      ok: result.ok,
      text: renderHostPresenceText(result.snapshot),
    });
  }
  return render(args, 'Zavorth host', [
    'HostPresenceUnit controls local host packaging.',
    'Supported: install, start, stop, status',
    '  zavorth host install',
    '  zavorth host start --yes',
    '  zavorth host stop --yes',
    '  zavorth host status',
  ], { ok: true });
}

export async function runServiceCommand(root: string, serviceName: 'daemon' | 'gateway', args: string[]) {
  const action = firstArg(args, 'status');
  const stateFile = path.join(stateDir(root), `${serviceName}.json`);
  const state = await readJson(stateFile, defaultServiceState(serviceName)) as JsonObject;
  if (action === 'install') {
    const command = readFlag(args, 'command') || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ');
    if (!command) return render(args, `Zavorth ${serviceName}`, [`Usage: zavorth ${serviceName} install --command <command>`], { ok: false });
    const next = { ...state, serviceName, command, installed: true, status: 'installed', installedAt: new Date().toISOString() };
    await writeJson(stateFile, next);
    await appendServiceLog(root, serviceName, 'install', 'installed', { command: redactCommand(command) });
    return render(args, `Zavorth ${serviceName}`, [`Installed ${serviceName} service config.`, `Command: ${redactCommand(command)}`], { service: sanitizeServiceState(next) });
  }
  if (action === 'uninstall') {
    if (!args.includes('--yes')) return render(args, `Zavorth ${serviceName}`, [`Uninstall preview: ${serviceName}`, 'Add --yes to remove service config.'], { dryRun: true, service: sanitizeServiceState(state) });
    await fs.rm(stateFile, { force: true });
    await appendServiceLog(root, serviceName, 'uninstall', 'removed', {});
    return render(args, `Zavorth ${serviceName}`, [`Removed ${serviceName} service config.`], { removed: true });
  }
  if (action === 'start') {
    const command = readFlag(args, 'command') || String(state.command || '');
    if (!command) return render(args, `Zavorth ${serviceName}`, [`No command configured. Run: zavorth ${serviceName} install --command <command>`], { ok: false });
    if (!args.includes('--yes')) return render(args, `Zavorth ${serviceName}`, [`Start preview: ${serviceName}`, `Command: ${redactCommand(command)}`, 'Add --yes to spawn the service.'], { dryRun: true, service: sanitizeServiceState({ ...state, command }) });
    let child: ReturnType<typeof spawn>;
    try {
      child = spawnCommandLine(command, { cwd: root, detached: true, stdio: 'ignore', windowsHide: true });
    } catch (error) {
      return render(args, `Zavorth ${serviceName}`, [
        `Refused unsafe service command (S3): ${error instanceof Error ? error.message : String(error)}`,
      ], { ok: false });
    }
    child.unref();
    const next = { ...state, serviceName, command, installed: true, status: 'running', pid: child.pid, startedAt: new Date().toISOString() };
    await writeJson(stateFile, next);
    await appendServiceLog(root, serviceName, 'start', 'running', { pid: child.pid, command: redactCommand(command) });
    return render(args, `Zavorth ${serviceName}`, [`Started ${serviceName}: pid ${child.pid}`], { service: sanitizeServiceState(next) });
  }
  if (action === 'stop') {
    const pid = Number(state.pid || 0);
    if (!pid) return render(args, `Zavorth ${serviceName}`, [`${serviceName} has no recorded PID.`], { ok: false, service: sanitizeServiceState(state) });
    if (!args.includes('--yes')) return render(args, `Zavorth ${serviceName}`, [`Stop preview: pid ${pid}`, 'Add --yes to stop the recorded service process.'], { dryRun: true, pid });
    const stopped = killPid(pid);
    const next: JsonObject = { ...state, status: stopped ? 'stopped' : 'stale', stoppedAt: new Date().toISOString() };
    delete next.pid;
    await writeJson(stateFile, next);
    await appendServiceLog(root, serviceName, 'stop', stopped ? 'stopped' : 'stale', { pid });
    return render(args, `Zavorth ${serviceName}`, [`Stop ${stopped ? 'sent' : 'could not signal'}: ${pid}`], { service: sanitizeServiceState(next) });
  }
  if (action === 'restart') {
    if (!args.includes('--yes')) return render(args, `Zavorth ${serviceName}`, [`Restart preview: ${serviceName}`, 'Add --yes to stop then start the configured service.'], { dryRun: true, service: sanitizeServiceState(state) });
    if (Number(state.pid || 0)) killPid(Number(state.pid));
    const command = String(state.command || '');
    if (!command) return render(args, `Zavorth ${serviceName}`, ['No command configured for restart.'], { ok: false });
    let child: ReturnType<typeof spawn>;
    try {
      child = spawnCommandLine(command, { cwd: root, detached: true, stdio: 'ignore', windowsHide: true });
    } catch (error) {
      return render(args, `Zavorth ${serviceName}`, [
        `Refused unsafe service command (S3): ${error instanceof Error ? error.message : String(error)}`,
      ], { ok: false });
    }
    child.unref();
    const next = { ...state, status: 'running', pid: child.pid, restartedAt: new Date().toISOString() };
    await writeJson(stateFile, next);
    await appendServiceLog(root, serviceName, 'restart', 'running', { pid: child.pid });
    return render(args, `Zavorth ${serviceName}`, [`Restarted ${serviceName}: pid ${child.pid}`], { service: sanitizeServiceState(next) });
  }
  if (action === 'logs') {
    const logs = await readArray(path.join(stateDir(root), 'logs', `${serviceName}.json`));
    return render(args, `Zavorth ${serviceName} logs`, logs.length ? logs.slice(-30).map((entry) => `- ${String((entry as JsonObject).createdAt)} | ${String((entry as JsonObject).action)} | ${String((entry as JsonObject).status)}`) : [`No ${serviceName} logs recorded yet.`], { logs });
  }
  if (action === 'health' || action === 'status') {
    const pid = Number(state.pid || 0);
    const alive = pid ? isPidAlive(pid) : false;
    const next: JsonObject = { ...state, health: alive ? 'alive' : pid ? 'stale' : 'not-running', checkedAt: new Date().toISOString() };
    await writeJson(stateFile, next);
    return render(args, `Zavorth ${serviceName}`, [
      `installed: ${Boolean(next.installed)}`,
      `status: ${String(next.status || 'not-installed')}`,
      `health: ${String(next.health)}`,
      `pid: ${pid || 'none'}`,
      `command: ${next.command ? redactCommand(String(next.command)) : 'not configured'}`,
    ], { service: sanitizeServiceState(next) });
  }
  return render(args, `Zavorth ${serviceName}`, [`Supported: install, uninstall, start, stop, restart, logs, health, status`], { ok: true });
}

export async function runNodeHost(root: string, args: string[]) {
  const action = firstArg(args, 'status');
  if (action === 'host' || action === 'start') {
    const id = readFlag(args, 'id') || idWithTime('node');
    const command = readFlag(args, 'command') || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ') || 'node';
    if (!args.includes('--yes')) return render(args, 'Zavorth node', [`Node host preview: ${id}`, `Command: ${redactCommand(command)}`, 'Add --yes to start a local node host process.'], { dryRun: true, id, command: redactCommand(command) });
    let child: ReturnType<typeof spawn>;
    try {
      child = spawnCommandLine(command, { cwd: root, detached: true, stdio: 'ignore', windowsHide: true });
    } catch (error) {
      return render(args, 'Zavorth node', [
        `Refused unsafe node host command (S3): ${error instanceof Error ? error.message : String(error)}`,
      ], { ok: false });
    }
    child.unref();
    const record = { id, kind: 'node-host', command, pid: child.pid, status: 'running', startedAt: new Date().toISOString() };
    await upsertNodeRecord(root, record);
    await appendServiceLog(root, 'node', 'start', 'running', { nodeId: id, pid: child.pid });
    return render(args, 'Zavorth node', [`Started node host: ${id}`, `pid: ${child.pid}`], { node: sanitizeServiceState(record) });
  }
  if (action === 'stop') {
    const id = args[1] || readFlag(args, 'id') || '';
    const node = await findNodeRecord(root, id);
    if (!node) return render(args, 'Zavorth node', [`No node found: ${id || '<missing>'}`], { ok: false });
    if (!args.includes('--yes')) return render(args, 'Zavorth node', [`Stop node preview: ${id}`, 'Add --yes to stop recorded PID.'], { dryRun: true, node: sanitizeServiceState(node) });
    const stopped = Number(node.pid || 0) ? killPid(Number(node.pid)) : false;
    node.status = stopped ? 'stopped' : 'stale';
    delete node.pid;
    node.stoppedAt = new Date().toISOString();
    await upsertNodeRecord(root, node);
    await appendServiceLog(root, 'node', 'stop', String(node.status), { nodeId: id });
    return render(args, 'Zavorth node', [`Stop ${stopped ? 'sent' : 'could not signal'}: ${id}`], { node: sanitizeServiceState(node) });
  }
  if (action === 'pair') {
    return runNodesCommand(root, ['pair', ...args.slice(1)]);
  }
  if (action === 'logs') {
    const logs = await readArray(path.join(stateDir(root), 'logs', 'node.json'));
    return render(args, 'Zavorth node logs', logs.length ? logs.slice(-30).map((entry) => `- ${String((entry as JsonObject).createdAt)} | ${String((entry as JsonObject).action)} | ${String((entry as JsonObject).status)}`) : ['No node logs recorded yet.'], { logs });
  }
  const nodes = await readArray(path.join(stateDir(root), 'nodes.json'));
  return render(args, 'Zavorth node', nodes.length ? nodes.map((node) => {
    const item = node as JsonObject;
    return `- ${String(item.id)} | ${String(item.status)} | pid ${String(item.pid || 'none')} | health ${Number(item.pid || 0) && isPidAlive(Number(item.pid)) ? 'alive' : 'not-running'}`;
  }) : ['No node hosts recorded yet.'], { nodes: nodes.map(sanitizeServiceState) });
}

export async function runNodesCommand(root: string, args: string[]) {
  const action = firstArg(args, 'list');
  const file = path.join(stateDir(root), 'nodes.json');
  const nodes = await readArray(file);
  if (action === 'pair') {
    const profile = args[1] && !args[1].startsWith('--') ? args[1] : 'headless';
    const label = readFlag(args, 'label') || args.slice(2).filter((arg) => !arg.startsWith('--')).join(' ') || `${profile} node`;
    const draft = await createPairingDraft(root, { channel: 'node', target: label, label, ttlMinutes: readNumberFlag(args, 'ttl-minutes') || 15 });
    const node = { id: readFlag(args, 'id') || idWithTime('node'), profile, label, status: 'pairing', pairingId: draft.id, pairingUri: draft.uri, pairingStatus: 'pending', createdAt: new Date().toISOString(), queue: [] };
    nodes.push(node);
    await writeJson(file, nodes);
    return render(args, 'Zavorth nodes', [`Created node pairing: ${String(node.id)}`, `Pairing URI: ${String(draft.uri)}`, `Code: ${String(draft.code)}`], { node: sanitizeServiceState(node), pairing: redactPairingRecord(draft) });
  }
  if (action === 'claim') {
    const id = args[1] || readFlag(args, 'id') || '';
    const node = nodes.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined;
    if (!node) return render(args, 'Zavorth nodes', [`No node found: ${id || '<missing>'}`], { ok: false });
    node.pairingStatus = 'paired';
    node.status = 'paired';
    node.sharedSecretRef = idWithTime('node-secret-ref');
    node.claimedAt = new Date().toISOString();
    await writeJson(file, nodes);
    await appendServiceLog(root, 'node', 'claim', 'paired', { nodeId: id });
    return render(args, 'Zavorth nodes', [`Node paired: ${id}`], { node: sanitizeServiceState(node) });
  }
  if (action === 'exec' || action === 'run') {
    const id = args[1] || readFlag(args, 'id') || '';
    const command = readFlag(args, 'command') || args.slice(2).join(' ');
    const node = nodes.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined;
    if (!node) return render(args, 'Zavorth nodes', [`No node found: ${id || '<missing>'}`], { ok: false });
    if (!command) return render(args, 'Zavorth nodes', ['Usage: zavorth nodes exec <id> --command <command>'], { ok: false });
    const invocation = { id: idWithTime('node-invoke'), nodeId: id, command, status: args.includes('--yes') ? 'requested' : 'preview', createdAt: new Date().toISOString() };
    const queue = Array.isArray(node.queue) ? node.queue as JsonObject[] : [];
    queue.push({ ...invocation, command: redactCommand(command) });
    node.queue = queue;
    if (!args.includes('--yes')) {
      await writeJson(file, nodes);
      return render(args, 'Zavorth nodes', [`Remote exec preview: ${id}`, `Command: ${redactCommand(command)}`, 'Add --yes to enqueue/execute through the node host policy.'], { invocation });
    }
    let result: JsonObject = { queued: true };
    if (node.pid && isPidAlive(Number(node.pid))) {
      result = await runProcess(command, [], root, readNumberFlag(args, 'timeout-ms') || 30000);
      invocation.status = (result as { exitCode?: number }).exitCode === 0 ? 'completed' : 'failed';
    } else {
      invocation.status = 'queued';
    }
    node.lastInvocation = invocation;
    await writeJson(file, nodes);
    await appendServiceLog(root, 'node', 'exec', String(invocation.status), { nodeId: id, invocationId: invocation.id, command: redactCommand(command) });
    return render(args, 'Zavorth nodes', [`Remote exec ${String(invocation.status)}: ${id}`], { invocation, result });
  }
  if (['revoke', 'remove'].includes(action)) {
    const id = args[1] || readFlag(args, 'id') || '';
    const remaining = nodes.filter((entry) => String((entry as JsonObject).id) !== id);
    if (remaining.length === nodes.length) return render(args, 'Zavorth nodes', [`No node found: ${id || '<missing>'}`], { ok: false });
    if (!args.includes('--yes')) return render(args, 'Zavorth nodes', [`Remove preview: ${id}`, 'Add --yes to remove node record.'], { dryRun: true });
    await writeJson(file, remaining);
    await appendServiceLog(root, 'node', 'remove', 'removed', { nodeId: id });
    return render(args, 'Zavorth nodes', [`Removed node: ${id}`], { removed: id });
  }
  return render(args, 'Zavorth nodes', nodes.length ? nodes.map((node) => {
    const item = node as JsonObject;
    return `- ${String(item.id)} | ${String(item.profile || item.kind || 'node')} | ${String(item.status || 'ready')} | pairing ${String(item.pairingStatus || 'n/a')}`;
  }) : ['No nodes recorded yet.'], { nodes: nodes.map(sanitizeServiceState) });
}

export function defaultServiceState(serviceName: string): JsonObject {
  return { serviceName, installed: false, status: 'not-installed', command: '', pid: null };
}

export async function appendServiceLog(root: string, serviceName: string, action: string, status: string, metadata: JsonObject): Promise<void> {
  await appendJsonArray(path.join(stateDir(root), 'logs', `${serviceName}.json`), {
    id: idWithTime(`${serviceName}-log`),
    action,
    status,
    metadata,
    createdAt: new Date().toISOString(),
  });
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {logger.warn('[Zavorth Cli Live Namespaces] creation failed', error); return false; }
}

export function killPid(pid: number): boolean {
  try {
    process.kill(pid);
    return true;
  } catch (error: unknown) {logger.warn('[Zavorth Cli Live Namespaces] creation failed', error); return false; }
}

export function sanitizeServiceState(value: unknown): JsonObject {
  const item = { ...((value || {}) as JsonObject) };
  if (item.command) item.command = redactCommand(String(item.command));
  if (Array.isArray(item.queue)) {
    item.queue = item.queue.map((entry) => ({ ...((entry || {}) as JsonObject), command: redactCommand(String((entry as JsonObject).command || '')) }));
  }
  return item;
}

export async function findNodeRecord(root: string, id: string): Promise<JsonObject | null> {
  const nodes = await readArray(path.join(stateDir(root), 'nodes.json'));
  return (nodes.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined) || null;
}

export async function upsertNodeRecord(root: string, record: JsonObject): Promise<void> {
  const file = path.join(stateDir(root), 'nodes.json');
  const nodes = await readArray(file);
  const index = nodes.findIndex((entry) => String((entry as JsonObject).id) === String(record.id));
  if (index >= 0) nodes[index] = record;
  else nodes.push(record);
  await writeJson(file, nodes);
}

export async function runDirectory(root: string, args: string[]) {
  const action = firstArg(args, 'list');
  const file = path.join(stateDir(root), 'directory.json');
  const entries = await readArray(file);
  const channel = readFlag(args, 'channel') || 'telegram';
  if (action === 'self') {
    if (args.includes('--live')) {
      if (!args.includes('--yes')) return render(args, 'Zavorth directory', ['Live directory lookup requires --yes.'], { ok: false });
      const result = await lookupChannelDirectory(channel, 'self', args);
      return render(args, 'Zavorth directory', result.lines, result.payload);
    }
    const local = entries.filter((entry) => String((entry as JsonObject).kind) === 'self');
    return render(args, 'Zavorth directory', local.length ? local.map(formatDirectoryEntry) : ['No local self identity recorded yet.'], { entries: local });
  }
  if (action === 'peers' || action === 'groups' || action === 'sync') {
    if (args.includes('--live')) {
      if (!args.includes('--yes')) return render(args, 'Zavorth directory', ['Live directory lookup requires --yes.'], { ok: false });
      const result = await lookupChannelDirectory(channel, action === 'groups' ? 'groups' : 'peers', args);
      if (action === 'sync' && result.entries.length > 0) {
        const merged = mergeDirectoryEntries(entries, result.entries);
        await writeJson(file, merged);
        return render(args, 'Zavorth directory', [`Synced ${result.entries.length} entrie(s) from ${channel}.`, ...result.lines], { entries: merged });
      }
      return render(args, 'Zavorth directory', result.lines, result.payload);
    }
    const kind = action === 'groups' ? 'group' : 'peer';
    const local = entries.filter((entry) => String((entry as JsonObject).kind) === kind);
    return render(args, 'Zavorth directory', local.length ? local.map(formatDirectoryEntry) : [`No local ${kind}s recorded yet.`], { entries: local });
  }
  if (action === 'lookup') {
    const query = args[1] || readFlag(args, 'query') || '';
    const matches = entries.filter((entry) => JSON.stringify(entry).toLowerCase().includes(query.toLowerCase()));
    return render(args, 'Zavorth directory', matches.length ? matches.map(formatDirectoryEntry) : [`No local directory match for: ${query || '<missing>'}`], { query, entries: matches });
  }
  if (action === 'add') {
    const entry = {
      id: idWithTime('directory'),
      channel,
      externalId: readFlag(args, 'id') || readFlag(args, 'external-id') || '',
      label: readFlag(args, 'label') || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ') || 'Directory entry',
      kind: readFlag(args, 'kind') || 'peer',
      status: 'trusted-local',
      createdAt: new Date().toISOString(),
    };
    entries.push(entry);
    await writeJson(file, entries);
    return render(args, 'Zavorth directory', [`Added directory entry: ${entry.id}`], { entry });
  }
  return render(args, 'Zavorth directory', entries.length ? entries.map(formatDirectoryEntry) : ['No directory entries recorded yet.'], { entries });
}

export async function runPairing(root: string, args: string[]) {
  const action = firstArg(args, 'list');
  const file = path.join(stateDir(root), 'pairings.json');
  const pairings = await readArray(file);
  if (['create', 'new', 'request', 'pair'].includes(action)) {
    const channel = readFlag(args, 'channel') || 'device';
    const draft = await createPairingDraft(root, {
      channel,
      target: readFlag(args, 'target') || '',
      label: args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ') || `${channel} pairing`,
      ttlMinutes: readNumberFlag(args, 'ttl-minutes') || 15,
    });
    return render(args, 'Zavorth pairing', [
      `Created pairing request: ${draft.id}`,
      `Code: ${draft.code}`,
      `URI: ${draft.uri}`,
      `Expires: ${draft.expiresAt}`,
      'Approve only after the remote side claims the same code.',
    ], { pairing: redactPairingRecord(draft) });
  }
  if (action === 'claim') {
    const code = readFlag(args, 'code') || args[1] || '';
    const claimedBy = readFlag(args, 'by') || readFlag(args, 'device') || readFlag(args, 'user') || 'unknown';
    const selected = pairings.find((entry) => String((entry as JsonObject).codeHash) === hashPairingCode(code)) as JsonObject | undefined;
    if (!selected) return render(args, 'Zavorth pairing', ['No pending pairing found for that code.'], { ok: false });
    if (pairingExpired(selected)) {
      selected.status = 'expired';
      await writeJson(file, pairings);
      return render(args, 'Zavorth pairing', ['Pairing code expired. Create a new pairing request.'], { ok: false, pairing: redactPairingRecord(selected) });
    }
    selected.status = 'claimed';
    selected.claimedBy = claimedBy;
    selected.claimedAt = new Date().toISOString();
    await writeJson(file, pairings);
    return render(args, 'Zavorth pairing', [`Claim recorded for pairing: ${String(selected.id)}`, 'Run zavorth pairing approve <id> after verifying the source.'], { pairing: redactPairingRecord(selected) });
  }
  if (action === 'approve') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = pairings.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined;
    if (!selected) return render(args, 'Zavorth pairing', [`No pairing found for id: ${id || '<missing>'}`], { ok: false });
    if (pairingExpired(selected)) selected.status = 'expired';
    if (String(selected.status) !== 'claimed') {
      await writeJson(file, pairings);
      return render(args, 'Zavorth pairing', [`Pairing is not claim-ready. Current status: ${String(selected.status)}`], { ok: false, pairing: redactPairingRecord(selected) });
    }
    selected.status = 'approved';
    selected.approvedAt = new Date().toISOString();
    selected.receipt = idWithTime('pairing-receipt');
    await writeJson(file, pairings);
    await appendJsonArray(path.join(stateDir(root), 'receipts', 'pairings.json'), { id: selected.receipt, kind: 'pairing-approved', pairingId: selected.id, channel: selected.channel, createdAt: selected.approvedAt });
    return render(args, 'Zavorth pairing', [`Approved pairing: ${id}`, `Evidence: ${String(selected.receipt)}`], { pairing: redactPairingRecord(selected) });
  }
  if (['revoke', 'reject', 'cancel'].includes(action)) {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = pairings.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined;
    if (!selected) return render(args, 'Zavorth pairing', [`No pairing found for id: ${id || '<missing>'}`], { ok: false });
    selected.status = action === 'revoke' ? 'revoked' : action === 'reject' ? 'rejected' : 'cancelled';
    selected.updatedAt = new Date().toISOString();
    await writeJson(file, pairings);
    return render(args, 'Zavorth pairing', [`${String(selected.status)} pairing: ${id}`], { pairing: redactPairingRecord(selected) });
  }
  return render(args, 'Zavorth pairing', pairings.length ? pairings.map((entry) => {
    const item = entry as JsonObject;
    return `- ${String(item.id)} | ${String(item.channel)} | ${String(item.status)} | expires ${String(item.expiresAt || 'n/a')}`;
  }) : ['No pairing requests recorded yet.'], { pairings: pairings.map(redactPairingRecord) });
}

export async function runSystem(root: string, args: string[]) {
  return render(args, 'Zavorth system', [
    `time: ${new Date().toISOString()}`,
    `cwd: ${root}`,
    `node: ${process.version}`,
  ], { time: new Date().toISOString(), root, node: process.version });
}

export async function runUninstall(root: string, args: string[]) {
  const targets = [stateDir(root)];
  if (!args.includes('--yes')) {
    return render(args, 'Zavorth uninstall', ['Preview only. Add --yes to remove local Zavorth state.', ...targets.map((target) => `- ${target}`)], { dryRun: true, targets });
  }
  await fs.rm(stateDir(root), { recursive: true, force: true });
  return render(args, 'Zavorth uninstall', ['Removed local Zavorth state directory. CLI files were not removed.'], { removed: targets });
}

export function isSkillGovernanceAction(action: string, args: string[]): boolean {
  return action === 'governance'
    || action === 'governance-mode'
    || action === 'policy'
    || action === 'trust'
    || args.some((arg) => arg.startsWith('--governance') || arg.startsWith('--mode='));
}

export function resolveRequestedSkillGovernanceMode(args: string[]): 'casual' | 'governed' | null {
  const explicit = readFlag(args, 'mode')
    || readFlag(args, 'governance')
    || readFlag(args, 'skills-governance')
    || readFlag(args, 'skill-governance');
  const text = String(explicit || '').toLowerCase();
  if (['governed', 'strict', 'enterprise'].includes(text)) {
    return 'governed';
  }
  if (['casual', 'personal'].includes(text)) {
    return 'casual';
  }
  return null;
}

export function normalizeSkillGovernanceMode(value: string): 'casual' | 'governed' {
  return resolveRequestedSkillGovernanceMode([value]) || 'casual';
}

export function firstUsageActionPosition(args: string[]): string {
  const valueFlags = new Set([
    '--action',
    '--action-id',
    '--capability',
    '--title',
    '--event',
    '--kind',
    '--surface',
    '--actor',
    '--status',
    '--duration-ms',
    '--receipt',
  ]);
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (valueFlags.has(arg)) {
      index += 1;
      continue;
    }
    if (arg.startsWith('--')) continue;
    return arg;
  }
  return '';
}
