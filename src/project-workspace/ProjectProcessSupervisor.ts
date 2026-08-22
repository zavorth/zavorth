import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import {
  type ProjectManifestProcess,
  type ProjectProcessResolution,
  type ResolvedProjectManifest,
} from './ProjectManifestContract.js';
import { ProjectManifestLoader } from './ProjectManifestLoader.js';

import {
  PROJECT_PROCESS_DEFAULT_LOG_LIMIT,
  PROJECT_PROCESS_DEFAULT_RESTART_BACKOFF_MS,
  PROJECT_PROCESS_DEFAULT_RESTART_LIMIT,
  type ProjectProcessLogEntry,
  type ProjectProcessLogStream,
  type ProjectProcessOwner,
  type ProjectProcessReadLogsInput,
  type ProjectProcessRecord,
  type ProjectProcessRuntimeHandle,
  type ProjectProcessStartProjectInput,
  type ProjectProcessStopInput,
  type ProjectProcessSupervisorSnapshot,
} from './ProjectProcessContract.js';
import type { SessionRegistryService } from '../runtime/sessions/v2/SessionRegistryService.js';
export type ProjectProcessSpawn = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio,
) => ChildProcessWithoutNullStreams;

export type ProjectProcessSupervisorOptions = {
  loader?: ProjectManifestLoader;
  spawnProcess?: ProjectProcessSpawn;
  sessionRegistry?: SessionRegistryService | null;
  now?: () => Date;
  idFactory?: (prefix: string) => string;
  restartLimit?: number;
  restartBackoffMs?: number;
  maxLogs?: number;
  shell?: boolean;
  env?: NodeJS.ProcessEnv;
};

type ManagedProjectProcess = {
  resolved: ResolvedProjectManifest;
  manifestProcess: ProjectManifestProcess;
  resolution: ProjectProcessResolution;
  record: ProjectProcessRecord;
  runtime: ProjectProcessRuntimeHandle;
};

export class ProjectProcessSupervisorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectProcessSupervisorError';
  }
}

export class ProjectProcessOwnershipError extends ProjectProcessSupervisorError {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectProcessOwnershipError';
  }
}

export class ProjectProcessSupervisor extends EventEmitter {
  private readonly loader: ProjectManifestLoader;
  private readonly spawnProcess: ProjectProcessSpawn;
  private readonly sessionRegistry: SessionRegistryService | null;
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private readonly restartLimit: number;
  private readonly restartBackoffMs: number;
  private readonly maxLogs: number;
  private readonly shell: boolean;
  private readonly env: NodeJS.ProcessEnv;
  private readonly processes = new Map<string, ManagedProjectProcess>();
  private logSequence = 0;

  constructor(options: ProjectProcessSupervisorOptions = {}) {
    super();
    this.loader = options.loader || new ProjectManifestLoader();
    this.spawnProcess = options.spawnProcess || spawn;
    this.sessionRegistry = options.sessionRegistry || null;
    this.now = options.now || (() => new Date());
    this.idFactory = options.idFactory || ((prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    this.restartLimit = Math.max(0, options.restartLimit ?? PROJECT_PROCESS_DEFAULT_RESTART_LIMIT);
    this.restartBackoffMs = Math.max(0, options.restartBackoffMs ?? PROJECT_PROCESS_DEFAULT_RESTART_BACKOFF_MS);
    this.maxLogs = Math.max(1, options.maxLogs ?? PROJECT_PROCESS_DEFAULT_LOG_LIMIT);
    this.shell = options.shell ?? false;
    this.env = {
      ...process.env,
      ...(options.env || {}),
    };
  }

  public startProject(input: ProjectProcessStartProjectInput = {}): ProjectProcessSupervisorSnapshot {
    const resolved = input.resolved || this.loader.load({
      cwd: input.cwd || undefined,
      manifestPath: input.manifestPath || undefined,
    });
    const selectedIds = this.resolveSelectedProcessIds(input.processIds);

    for (const manifestProcess of resolved.manifest.processes) {
      if (selectedIds && !selectedIds.has(manifestProcess.id)) {
        continue;
      }
      this.startManifestProcess(resolved, manifestProcess, input);
    }

    return this.buildSnapshot(resolved);
  }

  public startProcess(
    resolved: ResolvedProjectManifest,
    processId: string,
    input: Omit<ProjectProcessStartProjectInput, 'resolved' | 'manifestPath' | 'cwd' | 'processIds'> = {},
  ): ProjectProcessRecord {
    const manifestProcess = resolved.manifest.processes.find((entry) => entry.id === processId);
    if (!manifestProcess) {
      throw new ProjectProcessSupervisorError(`Process "${processId}" does not exist in the manifest.`);
    }
    return this.startManifestProcess(resolved, manifestProcess, input);
  }

  public stopProcess(input: ProjectProcessStopInput): ProjectProcessRecord {
    const entry = this.requireProcess(input.processId);
    this.assertOwnership(entry, input.ownerRef);
    this.clearRestartTimer(entry);

    entry.runtime.intentionalStop = true;
    entry.record.status = entry.runtime.child ? 'stopping' : 'exited';
    this.appendLog(entry, 'system', `[process:stop] ${normalizeText(input.reason, 'operator_stop')}`);

    if (!entry.runtime.child) {
      entry.record.stoppedAt = entry.record.stoppedAt || this.nowIso();
      this.releaseOwnership(entry, normalizeText(input.reason, 'operator_stop'));
      return this.cloneRecord(entry.record);
    }

    try {
      entry.runtime.child.kill((input.signal || 'SIGTERM') as NodeJS.Signals);
    } catch (error: unknown) {entry.record.status = 'failed';
      entry.record.lastError = errorMessage(error);
      this.appendLog(entry, 'system', `[process:stop:error] ${entry.record.lastError}`);
    }

    return this.cloneRecord(entry.record);
  }

  public restartProcess(input: ProjectProcessStopInput): ProjectProcessRecord {
    const entry = this.requireProcess(input.processId);
    this.assertOwnership(entry, input.ownerRef);
    this.stopProcess({
      ...input,
      reason: input.reason || 'operator_restart',
    });
    if (entry.runtime.child) {
      entry.runtime.child.once('exit', () => {
        this.spawnEntry(entry, { restart: true });
      });
      return this.cloneRecord(entry.record);
    }
    this.spawnEntry(entry, { restart: true });
    return this.cloneRecord(entry.record);
  }

  public listProcesses(): ProjectProcessRecord[] {
    return Array.from(this.processes.values())
      .map((entry) => this.cloneRecord(entry.record))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  public readLogs(input: ProjectProcessReadLogsInput = {}): ProjectProcessLogEntry[] {
    const limit = Math.max(1, Number(input.limit || this.maxLogs));
    const processId = normalizeText(input.processId);
    const logs = processId
      ? this.requireProcess(processId).record.logs
      : Array.from(this.processes.values()).flatMap((entry) => entry.record.logs);
    return logs
      .slice(-limit)
      .map((entry) => ({ ...entry }));
  }

  public cleanupExited(maxAgeMs = 0): number {
    const cutoff = this.now().getTime() - Math.max(0, maxAgeMs);
    let removed = 0;

    for (const [processId, entry] of this.processes.entries()) {
      if (entry.runtime.child || entry.runtime.restartTimer) {
        continue;
      }
      if (entry.record.status !== 'exited' && entry.record.status !== 'failed') {
        continue;
      }
      const stoppedAtMs = entry.record.stoppedAt ? new Date(entry.record.stoppedAt).getTime() : 0;
      if (Number.isNaN(stoppedAtMs) || stoppedAtMs > cutoff) {
        continue;
      }
      this.processes.delete(processId);
      removed += 1;
    }

    return removed;
  }

  public buildSnapshot(resolved?: ResolvedProjectManifest | null): ProjectProcessSupervisorSnapshot {
    const first = resolved || Array.from(this.processes.values())[0]?.resolved || null;
    return {
      projectName: first?.manifest.project.name || '',
      projectRoot: first?.projectRoot || '',
      manifestPath: first?.manifestPath || '',
      generatedAt: this.nowIso(),
      processes: this.listProcesses(),
    };
  }

  public dispose(): void {
    for (const entry of this.processes.values()) {
      this.clearRestartTimer(entry);
      entry.runtime.intentionalStop = true;
      if (entry.runtime.child) {
        try {
          entry.runtime.child.kill('SIGTERM');
        } catch (error: unknown) {// Best-effort cleanup for tests and short-lived CLI callers.
        }
        entry.runtime.child = null;
      }
      this.releaseOwnership(entry, 'supervisor_dispose');
    }
    this.processes.clear();
  }

  private startManifestProcess(
    resolved: ResolvedProjectManifest,
    manifestProcess: ProjectManifestProcess,
    input: Omit<ProjectProcessStartProjectInput, 'resolved' | 'manifestPath' | 'cwd' | 'processIds'>,
  ): ProjectProcessRecord {
    const resolution = this.resolveProcessResolution(resolved, manifestProcess);
    this.assertProcessBoundary(resolved, manifestProcess, resolution);
    const existing = this.processes.get(manifestProcess.id);
    if (existing?.runtime.child || existing?.runtime.restartTimer) {
      return this.cloneRecord(existing.record);
    }

    const entry = existing || this.createManagedProcess(resolved, manifestProcess, resolution, input);
    this.processes.set(manifestProcess.id, entry);
    this.spawnEntry(entry, { restart: false });
    return this.cloneRecord(entry.record);
  }

  private spawnEntry(entry: ManagedProjectProcess, options: { restart: boolean }): void {
    this.clearRestartTimer(entry);
    entry.runtime.intentionalStop = false;
    entry.record.status = 'starting';
    entry.record.pid = null;
    entry.record.exitCode = null;
    entry.record.signal = null;
    entry.record.stoppedAt = null;
    entry.record.lastError = null;
    entry.record.startedAt = this.nowIso();
    if (options.restart) {
      this.appendLog(entry, 'system', `[process:restart] ${entry.record.redactedCommand}`);
    } else {
      this.appendLog(entry, 'system', `[process:start] ${entry.record.redactedCommand}`);
    }

    try {
      const plan = this.buildSpawnPlan(entry.manifestProcess);
      const child = this.spawnProcess(plan.command, plan.args, {
        cwd: entry.record.cwd,
        env: this.env,
        shell: plan.shell,
        windowsHide: true,
      });
      entry.runtime.child = child;
      entry.record.pid = child.pid || null;
      entry.record.status = 'running';
      this.registerOwnership(entry);
      this.bindChild(entry, child);
    } catch (error: unknown) {entry.runtime.child = null;
      entry.record.status = 'failed';
      entry.record.lastError = errorMessage(error);
      entry.record.stoppedAt = this.nowIso();
      this.appendLog(entry, 'system', `[process:start:error] ${entry.record.lastError}`);
      this.releaseOwnership(entry, 'start_error');
      this.emit('process:error', this.cloneRecord(entry.record));
    }
  }

  private bindChild(entry: ManagedProjectProcess, child: ChildProcessWithoutNullStreams): void {
    child.stdout.on('data', (data: Buffer) => {
      this.appendLog(entry, 'stdout', data.toString());
      this.touchOwnership(entry);
    });

    child.stderr.on('data', (data: Buffer) => {
      this.appendLog(entry, 'stderr', data.toString());
      this.touchOwnership(entry);
    });

    child.on('error', (error: Error) => {
      entry.record.status = 'failed';
      entry.record.lastError = error.message;
      this.appendLog(entry, 'system', `[process:error] ${error.message}`);
      this.emit('process:error', this.cloneRecord(entry.record));
    });

    child.on('exit', (code, signal) => {
      if (entry.runtime.child !== child) {
        return;
      }
      entry.runtime.child = null;
      entry.record.exitCode = typeof code === 'number' ? code : null;
      entry.record.signal = signal || null;
      entry.record.stoppedAt = this.nowIso();
      entry.record.pid = null;
      entry.record.status = code === 0 || entry.runtime.intentionalStop ? 'exited' : 'failed';
      this.appendLog(entry, 'system', `[process:exit] code=${entry.record.exitCode ?? 'null'} signal=${entry.record.signal ?? 'null'}`);
      this.releaseOwnership(entry, entry.runtime.intentionalStop ? 'operator_stop' : 'process_exit');
      this.emit('process:exit', this.cloneRecord(entry.record));
      this.scheduleRestartIfNeeded(entry);
    });
  }

  private scheduleRestartIfNeeded(entry: ManagedProjectProcess): void {
    if (entry.runtime.intentionalStop) {
      return;
    }
    const exitFailed = entry.record.exitCode !== 0;
    const shouldRestart = entry.record.restart === 'always'
      || (entry.record.restart === 'on-failure' && exitFailed);
    if (!shouldRestart) {
      return;
    }
    if (entry.record.restartCount >= entry.record.restartLimit) {
      this.appendLog(entry, 'system', '[process:restart:limit] restart limit reached');
      return;
    }

    entry.record.restartCount += 1;
    entry.record.nextRestartAt = new Date(this.now().getTime() + entry.record.restartBackoffMs).toISOString();
    this.appendLog(entry, 'system', `[process:restart:scheduled] attempt=${entry.record.restartCount}`);
    entry.runtime.restartTimer = setTimeout(() => {
      entry.runtime.restartTimer = null;
      entry.record.nextRestartAt = null;
      this.spawnEntry(entry, { restart: true });
    }, entry.record.restartBackoffMs);
  }

  private createManagedProcess(
    resolved: ResolvedProjectManifest,
    manifestProcess: ProjectManifestProcess,
    resolution: ProjectProcessResolution,
    input: Omit<ProjectProcessStartProjectInput, 'resolved' | 'manifestPath' | 'cwd' | 'processIds'>,
  ): ManagedProjectProcess {
    const owner = this.buildOwner(resolved, manifestProcess, input);
    const redactedCommand = redactCommand(manifestProcess.command);
    return {
      resolved,
      manifestProcess,
      resolution,
      record: {
        id: manifestProcess.id,
        name: manifestProcess.name,
        status: 'idle',
        owner,
        command: redactedCommand,
        redactedCommand,
        cwd: resolution.resolvedCwd,
        pid: null,
        startedAt: null,
        stoppedAt: null,
        exitCode: null,
        signal: null,
        restart: manifestProcess.restart,
        restartCount: 0,
        restartLimit: this.restartLimit,
        restartBackoffMs: this.restartBackoffMs,
        nextRestartAt: null,
        health: manifestProcess.health,
        logs: [],
        lastError: null,
      },
      runtime: {
        child: null,
        restartTimer: null,
        intentionalStop: false,
      },
    };
  }

  private buildOwner(
    resolved: ResolvedProjectManifest,
    manifestProcess: ProjectManifestProcess,
    input: Omit<ProjectProcessStartProjectInput, 'resolved' | 'manifestPath' | 'cwd' | 'processIds'>,
  ): ProjectProcessOwner {
    const runId = normalizeNullable(input.runId);
    const projectName = resolved.manifest.project.name;
    const ownerRef = runId ? `project:${projectName}:${manifestProcess.id}:run:${runId}`
      : `project:${projectName}:${manifestProcess.id}`;
    return {
      projectName,
      projectRoot: resolved.projectRoot,
      manifestPath: resolved.manifestPath,
      processId: manifestProcess.id,
      ownerRef,
      runId,
      requestedBy: normalizeNullable(input.requestedBy),
      surface: normalizeText(input.surface, 'project-workspace'),
    };
  }

  private resolveProcessResolution(
    resolved: ResolvedProjectManifest,
    manifestProcess: ProjectManifestProcess,
  ): ProjectProcessResolution {
    const resolution = resolved.processResolutions.find((entry) => entry.id === manifestProcess.id);
    if (resolution) {
      return resolution;
    }
    const resolvedCwd = path.resolve(resolved.projectRoot, manifestProcess.cwd);
    return {
      id: manifestProcess.id,
      cwd: manifestProcess.cwd,
      resolvedCwd,
      outsideProject: !isInsidePath(resolved.projectRoot, resolvedCwd),
    };
  }

  private assertProcessBoundary(
    resolved: ResolvedProjectManifest,
    manifestProcess: ProjectManifestProcess,
    resolution: ProjectProcessResolution,
  ): void {
    if (!resolution.outsideProject || manifestProcess.allowOutsideProject === true) {
      return;
    }
    throw new ProjectProcessSupervisorError(
      `Process "${manifestProcess.id}" tentaria run outside de project.root (${resolved.projectRoot}).`,
    );
  }

  private resolveSelectedProcessIds(processIds?: string[] | null): Set<string> | null {
    if (!Array.isArray(processIds) || processIds.length === 0) {
      return null;
    }
    return new Set(processIds.map((entry) => normalizeText(entry)).filter(Boolean));
  }

  private requireProcess(processId: string): ManagedProjectProcess {
    const entry = this.processes.get(normalizeText(processId));
    if (!entry) {
      throw new ProjectProcessSupervisorError(`Process "${processId}" is not under this supervisor.`);
    }
    return entry;
  }

  private assertOwnership(entry: ManagedProjectProcess, ownerRef?: string | null): void {
    const normalizedOwner = normalizeText(ownerRef);
    if (!normalizedOwner) {
      return;
    }
    if (normalizedOwner !== entry.record.owner.ownerRef) {
      throw new ProjectProcessOwnershipError(
        `Owner "${normalizedOwner}" cannot control "${entry.record.id}".`,
      );
    }
  }

  private appendLog(entry: ManagedProjectProcess, stream: ProjectProcessLogStream, text: string): void {
    const normalized = String(text || '');
    if (!normalized) {
      return;
    }
    const log: ProjectProcessLogEntry = {
      id: this.idFactory('project-process-log'),
      sequence: ++this.logSequence,
      processId: entry.record.id,
      stream,
      text: stream === 'system' ? redactCommand(normalized) : normalized,
      timestamp: this.nowIso(),
    };
    entry.record.logs.push(log);
    if (entry.record.logs.length > this.maxLogs) {
      entry.record.logs.splice(0, entry.record.logs.length - this.maxLogs);
    }
    this.emit('process:log', { ...log });
  }

  private registerOwnership(entry: ManagedProjectProcess): void {
    this.sessionRegistry?.registerSession({
      sessionId: this.sessionIdFor(entry),
      kind: 'project_process',
      surface: entry.record.owner.surface,
      runId: entry.record.owner.runId,
      taskId: entry.record.id,
      ownerRef: entry.record.owner.ownerRef,
      metadata: {
        projectName: entry.record.owner.projectName,
        projectRoot: entry.record.owner.projectRoot,
        manifestPath: entry.record.owner.manifestPath,
        cwd: entry.record.cwd,
        command: entry.record.redactedCommand,
        pid: entry.record.pid,
      },
    });
  }

  private touchOwnership(entry: ManagedProjectProcess): void {
    this.sessionRegistry?.touchSession(this.sessionIdFor(entry), this.now());
  }

  private releaseOwnership(entry: ManagedProjectProcess, reason: string): void {
    this.sessionRegistry?.releaseSession(this.sessionIdFor(entry), reason, this.now());
  }

  private sessionIdFor(entry: ManagedProjectProcess): string {
    return `project-process:${entry.record.owner.projectName}:${entry.record.id}`;
  }

  private buildSpawnPlan(manifestProcess: ProjectManifestProcess): { command: string; args: string[]; shell: boolean } {
    const commandLine = manifestProcess.command;
    if (manifestProcess.shell === true || this.shell) {
      return {
        command: commandLine,
        args: [],
        shell: true,
      };
    }

    const tokens = tokenizeCommandLine(commandLine);
    if (tokens.length === 0) {
      throw new ProjectProcessSupervisorError('Process command is empty.');
    }
    return {
      command: tokens[0],
      args: tokens.slice(1),
      shell: false,
    };
  }

  private clearRestartTimer(entry: ManagedProjectProcess): void {
    if (!entry.runtime.restartTimer) {
      return;
    }
    clearTimeout(entry.runtime.restartTimer);
    entry.runtime.restartTimer = null;
    entry.record.nextRestartAt = null;
  }

  private nowIso(): string {
    return this.now().toISOString();
  }

  private cloneRecord(record: ProjectProcessRecord): ProjectProcessRecord {
    return {
      ...record,
      owner: { ...record.owner },
      health: { ...record.health },
      logs: record.logs.map((log) => ({ ...log })),
    };
  }
}

export function redactCommand(command: string): string {
  const normalized = String(command || '');
  return normalized
    .replace(/\b((?:[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|APIKEY|AUTHORIZATION)[A-Z0-9_]*)\s*=\s*)(?:"[^"]*"|'[^']*'|\S+)/gi, '$1[REDACTED]')
    .replace(/(--(?:token|secret|password|passwd|api-key|apikey|authorization)(?:=|\s+))(?:"[^"]*"|'[^']*'|\S+)/gi, '$1[REDACTED]')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[REDACTED]');
}

function tokenizeCommandLine(commandLine: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < commandLine.length; index += 1) {
    const char = commandLine[index];
    if (quote) {
      if (char === '\\' && quote === '"' && index + 1 < commandLine.length) {
        index += 1;
        current += commandLine[index];
        continue;
      }
      if (char === quote) {
        quote = null;
        continue;
      }
      current += char;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }

  if (current) {
    tokens.push(current);
  }
  return tokens;
}

function isInsidePath(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function normalizeText(value: unknown, fallback = ''): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function normalizeNullable(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized || null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'unknown error');
}
