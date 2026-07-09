import {
  ProjectManifestError,
  ProjectManifestLoader,
  ProjectLogWatchService,
  ProjectProcessSupervisor,
  ProjectPtySessionFactory,
  ProjectWorkspaceService,
  redactCommand,
  type ProjectLogWatchEvent,
  type ProjectProcessRecord,
  type ResolvedProjectManifest,
} from '../../../../project-workspace/index.js';
import { logger } from '../../../../logger';
import {
DEVELOPER_WORKSPACE_SURFACE_CONTRACT_VERSION,
  type DeveloperWorkspaceSurfaceActionInput,
  type DeveloperWorkspaceSurfaceActionResult,
  type DeveloperWorkspaceSurfaceAgent,
  type DeveloperWorkspaceSurfaceHook,
  type DeveloperWorkspaceSurfaceLogWatchEvent,
  type DeveloperWorkspaceSurfaceLogEntry,
  type DeveloperWorkspaceSurfaceOperation,
  type DeveloperWorkspaceSurfaceOperationContract,
  type DeveloperWorkspaceSurfaceProcess,
  type DeveloperWorkspaceSurfaceSnapshot,
} from './DeveloperWorkspaceSurfaceContract.js';

export type DeveloperWorkspaceSurfaceOptions = {
  loader?: ProjectManifestLoader;
  workspaceService?: ProjectWorkspaceService;
  processSupervisor?: ProjectProcessSupervisor;
  ptySessionFactory?: ProjectPtySessionFactory;
  logWatchService?: ProjectLogWatchService;
  now?: () => Date;
};

export type DeveloperWorkspaceSurfaceSnapshotInput = {
  cwd?: string | null;
  manifestPath?: string | null;
  resolved?: ResolvedProjectManifest | null;
};

export const DEVELOPER_WORKSPACE_OPERATION_CONTRACTS: readonly DeveloperWorkspaceSurfaceOperationContract[] = [
  {
    id: 'start',
    label: 'Start process',
    method: 'POST',
    publicPath: '/api/developer-workspace',
    requiresApproval: true,
    approvalScope: 'process.start',
    risk: 'write',
    status: 'available',
  },
  {
    id: 'stop',
    label: 'Stop process',
    method: 'POST',
    publicPath: '/api/developer-workspace',
    requiresApproval: true,
    approvalScope: 'process.kill',
    risk: 'sensitive',
    status: 'available',
  },
  {
    id: 'restart',
    label: 'Restart process',
    method: 'POST',
    publicPath: '/api/developer-workspace',
    requiresApproval: true,
    approvalScope: 'process.kill',
    risk: 'sensitive',
    status: 'available',
  },
];

export class DeveloperWorkspaceSurfaceService {
  private readonly loader: ProjectManifestLoader;
  private readonly workspaceService: ProjectWorkspaceService;
  private readonly processSupervisor: ProjectProcessSupervisor;
  private readonly ptySessionFactory: ProjectPtySessionFactory;
  private readonly logWatchService: ProjectLogWatchService;
  private readonly now: () => Date;

  constructor(options: DeveloperWorkspaceSurfaceOptions = {}) {
    this.now = options.now || (() => new Date());
    this.loader = options.loader || new ProjectManifestLoader();
    this.workspaceService = options.workspaceService || new ProjectWorkspaceService(this.loader);
    this.processSupervisor = options.processSupervisor || new ProjectProcessSupervisor({ loader: this.loader });
    this.ptySessionFactory = options.ptySessionFactory || new ProjectPtySessionFactory();
    this.logWatchService = options.logWatchService || new ProjectLogWatchService({ now: this.now });
  }

  public buildSnapshot(input: DeveloperWorkspaceSurfaceSnapshotInput = {}): DeveloperWorkspaceSurfaceSnapshot {
    const resolvedResult = this.resolveManifest(input);
    if (resolvedResult.ok === false) {
      return this.emptySnapshot(resolvedResult.error);
    }

    const resolved = resolvedResult.resolved;
    const workspace = this.workspaceService.buildSnapshot(resolved);
    const supervised = new Map(
      this.processSupervisor.listProcesses()
        .filter((process) => process.owner.manifestPath === resolved.manifestPath)
        .map((process) => [process.id, process]),
    );
    const processes = workspace.processes.map((process) => {
      const record = supervised.get(process.id);
      return record
        ? mapSupervisedProcess(record)
        : {
            id: process.id,
            name: process.name,
            status: 'idle',
            command: redactCommand(process.command),
            cwd: process.resolvedCwd,
            restart: process.restart,
            restartCount: 0,
            restartLimit: 0,
            pid: null,
            startedAt: null,
            stoppedAt: null,
            exitCode: null,
            health: process.health,
            ownerRef: null,
            logs: [],
          } satisfies DeveloperWorkspaceSurfaceProcess;
    });
    const ptyProfiles = resolved.manifest.processes.map((process) => {
      const profile = this.ptySessionFactory.createProfile(resolved, {
        processId: process.id,
        surface: 'developer-workspace',
      });
      return {
        sessionId: profile.sessionId,
        processId: profile.processId,
        cwd: profile.cwd,
        command: profile.redactedCommand,
        ownerRef: profile.ownership?.ownerRef || null,
        inputPolicy: profile.policy.input,
        recording: profile.policy.recording,
      };
    });
    const logs = processes.flatMap((process) => process.logs);
    const logWatch = this.logWatchService.buildSnapshot({ resolved });

    return {
      ok: true,
      contractVersion: DEVELOPER_WORKSPACE_SURFACE_CONTRACT_VERSION,
      generatedAt: this.nowIso(),
      source: 'ProjectWorkspaceService+ProjectProcessSupervisor',
      manifestPath: workspace.manifestPath,
      projectRoot: workspace.projectRoot,
      project: {
        name: workspace.project.name,
        description: workspace.project.description,
      },
      policy: {
        defaultMode: workspace.policy.defaultMode,
        requireApprovalFor: [...workspace.policy.requireApprovalFor],
      },
      summary: {
        processes: processes.length,
        running: processes.filter((process) => process.status === 'running' || process.status === 'starting').length,
        failed: processes.filter((process) => process.status === 'failed').length,
        idle: processes.filter((process) => process.status === 'idle' || process.status === 'exited').length,
        hooks: workspace.hooks.length,
        agents: workspace.agents.length,
        logs: logs.length,
        logWatchEvents: logWatch.summary.events,
      },
      processes,
      hooks: workspace.hooks.map((hook): DeveloperWorkspaceSurfaceHook => ({
        id: hook.id,
        processId: hook.process,
        pattern: hook.pattern,
        mode: hook.mode,
        prompt: hook.prompt,
      })),
      agents: workspace.agents.map((agent): DeveloperWorkspaceSurfaceAgent => ({
        id: agent.id,
        role: agent.role,
        mode: agent.mode,
        watches: [...agent.watches],
      })),
      ptyProfiles,
      logWatch: {
        generatedAt: logWatch.generatedAt,
        summary: { ...logWatch.summary },
        events: logWatch.events.map(mapLogWatchEvent),
      },
      operations: [...DEVELOPER_WORKSPACE_OPERATION_CONTRACTS],
      warnings: [],
      error: null,
    };
  }

  public executeAction(input: DeveloperWorkspaceSurfaceActionInput): DeveloperWorkspaceSurfaceActionResult {
    const action = normalizeOperation(input.action);
    const operation = action ? describeDeveloperWorkspaceOperation(action) : null;
    const errors: string[] = [];
    const processId = normalizeText(input.processId);
    if (!action) {
      errors.push('action must be start, stop or restart');
    }
    if ((action === 'stop' || action === 'restart') && !processId) {
      errors.push('processId is required for stop/restart');
    }

    if (errors.length > 0 || !operation || !action) {
      const snapshot = this.buildSnapshot(input);
      return this.actionResult({
        ok: false,
        httpStatus: 400,
        status: 'invalid',
        operation,
        input,
        errors,
        snapshot,
        message: 'Developer Workspace recusou a acao antes de tocar processos.',
      });
    }

    const approved = input.approval?.approved === true;
    if (!approved) {
      const snapshot = this.buildSnapshot(input);
      return this.actionResult({
        ok: false,
        httpStatus: 403,
        status: 'approval_required',
        operation,
        input,
        errors: [],
        snapshot,
        message: 'A acao do Developer Workspace requer approval antes de executar.',
      });
    }

    try {
      const resolved = this.resolveManifest(input);
      if (resolved.ok === false) {
        throw resolved.error;
      }
      this.logWatchService.bindSupervisor(this.processSupervisor, resolved.resolved);
      if (action === 'start') {
        this.processSupervisor.startProject({
          resolved: resolved.resolved,
          processIds: processId ? [processId] : null,
          runId: input.runId,
          requestedBy: input.requestedBy,
          surface: 'developer-workspace',
        });
      } else if (action === 'stop') {
        this.processSupervisor.stopProcess({
          processId,
          reason: 'developer_workspace_action',
        });
      } else {
        this.processSupervisor.restartProcess({
          processId,
          reason: 'developer_workspace_action',
        });
      }

      const snapshot = this.buildSnapshot({ resolved: resolved.resolved });
      return this.actionResult({
        ok: true,
        httpStatus: 200,
        status: 'executed',
        operation,
        input,
        errors: [],
        snapshot,
        message: `Developer Workspace executou ${action}.`,
      });
    } catch (error: any) { const err = error; const e = error;
      const snapshot = this.buildSnapshot(input);
      return this.actionResult({
        ok: false,
        httpStatus: 500,
        status: 'failed',
        operation,
        input,
        errors: [errorMessage(error)],
        snapshot,
        message: 'Developer Workspace nao conseguiu executar a acao solicitada.',
      });
    }
  }

  private resolveManifest(input: DeveloperWorkspaceSurfaceSnapshotInput): (
    | { ok: true; resolved: ResolvedProjectManifest }
    | { ok: false; error: Error }
  ) {
    if (input.resolved) {
      return { ok: true, resolved: input.resolved };
    }
    try {
      return {
        ok: true,
        resolved: this.loader.load({
          cwd: input.cwd || undefined,
          manifestPath: input.manifestPath || undefined,
        }),
      };
    } catch (error: any) { const err = error; const e = error;
    logger.warn('[Developer Workspace Surface] load operation failed', error);
    return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error || 'unknown manifest error')),
      };
  }
  }

  private emptySnapshot(error: Error): DeveloperWorkspaceSurfaceSnapshot {
    const warnings = error instanceof ProjectManifestError
      ? error.issues.map((issue) => `${issue.path}: ${issue.message}`)
      : [error.message];
    return {
      ok: false,
      contractVersion: DEVELOPER_WORKSPACE_SURFACE_CONTRACT_VERSION,
      generatedAt: this.nowIso(),
      source: 'ProjectWorkspaceService+ProjectProcessSupervisor',
      manifestPath: null,
      projectRoot: null,
      project: null,
      policy: {
        defaultMode: 'suggest',
        requireApprovalFor: ['process.kill', 'filesystem.write'],
      },
      summary: {
        processes: 0,
        running: 0,
        failed: 0,
        idle: 0,
        hooks: 0,
        agents: 0,
        logs: 0,
        logWatchEvents: 0,
      },
      processes: [],
      hooks: [],
      agents: [],
      ptyProfiles: [],
      logWatch: {
        generatedAt: this.nowIso(),
        summary: {
          events: 0,
          suggestions: 0,
          blocked: 0,
          manualRequired: 0,
          rateLimited: 0,
          lastEventAt: null,
        },
        events: [],
      },
      operations: [...DEVELOPER_WORKSPACE_OPERATION_CONTRACTS],
      warnings,
      error: error.message,
    };
  }

  private actionResult(input: {
    ok: boolean;
    httpStatus: 200 | 400 | 403 | 500;
    status: DeveloperWorkspaceSurfaceActionResult['status'];
    operation: DeveloperWorkspaceSurfaceOperationContract | null;
    input: DeveloperWorkspaceSurfaceActionInput;
    errors: string[];
    snapshot: DeveloperWorkspaceSurfaceSnapshot;
    message: string;
  }): DeveloperWorkspaceSurfaceActionResult {
    return {
      ok: input.ok,
      httpStatus: input.httpStatus,
      status: input.status,
      contractVersion: DEVELOPER_WORKSPACE_SURFACE_CONTRACT_VERSION,
      generatedAt: this.nowIso(),
      operation: input.operation,
      approval: {
        required: true,
        satisfied: input.input.approval?.approved === true,
        approvalId: normalizeNullable(input.input.approval?.approvalId),
        approvedBy: normalizeNullable(input.input.approval?.approvedBy),
        reason: normalizeText(input.input.approval?.reason, 'developer_workspace_policy'),
      },
      processId: normalizeNullable(input.input.processId),
      message: input.message,
      errors: input.errors,
      snapshot: input.snapshot,
    };
  }

  private nowIso(): string {
    return this.now().toISOString();
  }
}

export function describeDeveloperWorkspaceOperation(
  action: DeveloperWorkspaceSurfaceOperation,
): DeveloperWorkspaceSurfaceOperationContract {
  return DEVELOPER_WORKSPACE_OPERATION_CONTRACTS.find((operation) => operation.id === action)
    || DEVELOPER_WORKSPACE_OPERATION_CONTRACTS[0];
}

function mapSupervisedProcess(record: ProjectProcessRecord): DeveloperWorkspaceSurfaceProcess {
  return {
    id: record.id,
    name: record.name,
    status: record.status,
    command: record.redactedCommand,
    cwd: record.cwd,
    restart: record.restart,
    restartCount: record.restartCount,
    restartLimit: record.restartLimit,
    pid: record.pid,
    startedAt: record.startedAt,
    stoppedAt: record.stoppedAt,
    exitCode: record.exitCode,
    health: record.health,
    ownerRef: record.owner.ownerRef,
    logs: record.logs.map((log): DeveloperWorkspaceSurfaceLogEntry => ({
      id: log.id,
      sequence: log.sequence,
      processId: log.processId,
      stream: log.stream,
      text: log.text,
      timestamp: log.timestamp,
    })),
  };
}

function mapLogWatchEvent(event: ProjectLogWatchEvent): DeveloperWorkspaceSurfaceLogWatchEvent {
  return {
    id: event.id,
    hookId: event.hookId,
    processId: event.processId,
    mode: event.mode,
    status: event.status,
    category: event.classification.category,
    severity: event.classification.severity,
    risk: event.classification.risk,
    summary: event.classification.summary,
    reason: event.policyDecision.reason,
    agentRunId: event.agentRunId,
    duplicateCount: event.audit.duplicateCount,
    rateLimited: event.audit.rateLimited,
    createdAt: event.createdAt,
  };
}

function normalizeOperation(value: unknown): DeveloperWorkspaceSurfaceOperation | null {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'start' || normalized === 'stop' || normalized === 'restart') {
    return normalized;
  }
  return null;
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
