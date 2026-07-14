import * as fs from 'fs';
import * as path from 'path';
import type { CliExecutionResult, CliWriter, ZavorthCliFlags, ZavorthCliRuntime } from './ZavorthCliContract.js';
import {
  ProjectManifestError,
  ProjectManifestLoader,
  ProjectProcessSupervisor,
  type ResolvedProjectManifest,
} from '../project-workspace/index.js';
import { DeveloperWorkspaceSurfaceService } from '../domain/surface/application/developer-workspace/index.js';

import { config } from '../config/index.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';
type WorkspaceCliAction =
  | 'help'
  | 'init'
  | 'up'
  | 'status'
  | 'stop'
  | 'restart'
  | 'doctor';

type WorkspaceCliCommand = {
  action: WorkspaceCliAction;
  cwd: string | null;
  manifestPath: string | null;
  processId: string | null;
  template: WorkspaceTemplateId;
  dryRun: boolean;
  force: boolean;
  approve: boolean;
  all: boolean;
};

type WorkspaceTemplateId = 'default' | 'node-web' | 'python-api' | 'fullstack';

type WorkspaceRuntimeBundle = {
  loader: ProjectManifestLoader;
  supervisor: ProjectProcessSupervisor;
  surface: DeveloperWorkspaceSurfaceService;
};

type WorkspaceCliPayload = {
  ok: boolean;
  mode: 'developer_workspace_cli';
  action: WorkspaceCliAction;
  generatedAt: string;
  message: string;
  cwd: string;
  manifestPath: string | null;
  dryRun: boolean;
  approvalRequired: boolean;
  approvalSatisfied: boolean;
  errors: string[];
  warnings: string[];
  snapshot?: Record<string, unknown>;
  result?: Record<string, unknown>;
  plan?: Record<string, unknown>;
  doctor?: Record<string, unknown>;
};

type RegistryCommandParams = {
  runtime: ZavorthCliRuntime;
  effectiveFlags: ZavorthCliFlags;
  commandName: string | null;
  args: string;
  writer: CliWriter;
};

const WORKSPACE_RUNTIME_BUNDLES = new Map<string, WorkspaceRuntimeBundle>();

export async function handleZavorthCliRegistryWorkspaceCommand(
  params: RegistryCommandParams,
): Promise<CliExecutionResult | null> {
  if (params.commandName !== 'workspace') {
    return null;
  }

  const command = parseWorkspaceCliCommand(params.args);
  const payload = await executeWorkspaceCliCommand(command, params.effectiveFlags);
  const body = params.effectiveFlags.json
    ? JSON.stringify(payload, null, 2)
    : formatWorkspaceCliPayload(payload);
  if (payload.ok) {
    params.writer.line(body);
  } else {
    params.writer.error(body);
  }
  return {
    ok: payload.ok,
    handled: true,
    output: payload.ok ? [body] : [],
    error: payload.ok ? null : payload.message,
  };
}

async function executeWorkspaceCliCommand(
  command: WorkspaceCliCommand,
  flags: ZavorthCliFlags,
): Promise<WorkspaceCliPayload> {
  if (command.action === 'help') {
    return buildPayload(command, {
      ok: true,
      message: 'Developer Workspace commands are ready.',
      plan: {
        commands: workspaceCommandReference(),
      },
    });
  }

  if (command.action === 'init') {
    return executeWorkspaceInit(command);
  }

  if (command.action === 'doctor') {
    return executeWorkspaceDoctor(command);
  }

  const resolved = loadWorkspaceManifest(command);
  if (resolved.ok === false) {
    return buildPayload(command, {
      ok: false,
      message: 'Developer Workspace did not find a valid manifest.',
      errors: [resolved.error.message],
      doctor: describeManifestError(resolved.error),
    });
  }

  if (command.action === 'status') {
    const bundle = getWorkspaceRuntimeBundle(resolved.resolved);
    const snapshot = bundle.surface.buildSnapshot({ resolved: resolved.resolved });
    return buildPayload(command, {
      ok: true,
      message: 'Developer Workspace status lido sem iniciar processos.',
      manifestPath: resolved.resolved.manifestPath,
      snapshot: snapshot as unknown as Record<string, unknown>,
      warnings: snapshot.warnings,
    });
  }

  if (command.dryRun) {
    return buildPayload(command, {
      ok: true,
      message: `Plano workspace ${command.action} criado sem executar processos.`,
      manifestPath: resolved.resolved.manifestPath,
      approvalRequired: true,
      plan: buildWorkspaceActionPlan(command, resolved.resolved),
    });
  }

  if (command.action === 'up') {
    return executeWorkspaceSurfaceAction(command, resolved.resolved, flags, 'start');
  }

  if (command.action === 'stop') {
    return executeWorkspaceStop(command, resolved.resolved, flags);
  }

  if (command.action === 'restart') {
    if (!command.processId) {
      return buildPayload(command, {
        ok: false,
        message: 'Uso: workspace restart <processId> [--approve].',
        manifestPath: resolved.resolved.manifestPath,
        errors: ['processId is required for restart'],
      });
    }
    return executeWorkspaceSurfaceAction(command, resolved.resolved, flags, 'restart');
  }

  return buildPayload(command, {
    ok: false,
    message: 'Workspace command not supported.',
    errors: [`workspace ${command.action}`],
  });
}

function executeWorkspaceInit(command: WorkspaceCliCommand): WorkspaceCliPayload {
  const cwd = path.resolve(command.cwd || process.cwd());
  const manifestPath = path.resolve(command.manifestPath || path.join(cwd, 'zavorth.yml'));
  const template = buildWorkspaceManifestTemplate(command.template, cwd);
  const exists = fs.existsSync(manifestPath);

  if (exists && !command.force && !command.dryRun) {
    return buildPayload(command, {
      ok: false,
      message: 'zavorth.yml ja existe. Use --force para sobrescrever ou --dry-run para visualizar.',
      manifestPath,
      errors: ['manifest already exists'],
    });
  }

  if (!command.dryRun) {
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, template, 'utf8');
  }

  return buildPayload(command, {
    ok: true,
    message: command.dryRun
      ? 'zavorth.yml preview generated without writing a file.'
      : 'zavorth.yml criado para o Developer Workspace.',
    manifestPath,
    plan: {
      written: !command.dryRun,
      template: command.template,
      content: command.dryRun ? template : undefined,
      next: [
        `zavorth workspace doctor --manifest "${manifestPath}"`,
        `zavorth workspace status --manifest "${manifestPath}"`,
      ],
    },
  });
}

function executeWorkspaceDoctor(command: WorkspaceCliCommand): WorkspaceCliPayload {
  const resolved = loadWorkspaceManifest(command);
  const examples = validateWorkspaceExamples();
  if (resolved.ok === false) {
    return buildPayload(command, {
      ok: false,
      message: 'Developer Workspace doctor encontrou bloqueio no manifesto.',
      errors: [resolved.error.message],
      doctor: {
        status: 'blocked',
        manifest: describeManifestError(resolved.error),
        examples,
        nextCommand: 'zavorth workspace init',
      },
    });
  }

  const issues: string[] = [];
  const warnings: string[] = [];
  if (resolved.resolved.manifest.processes.length === 0) {
    issues.push('manifest has no processes');
  }
  if (resolved.resolved.manifest.hooks.length === 0) {
    warnings.push('manifest has no log hooks');
  }
  if (resolved.resolved.manifest.policy.requireApprovalFor.length === 0) {
    warnings.push('policy.requireApprovalFor is empty; auto-healing may be too permissive');
  }

  return buildPayload(command, {
    ok: issues.length === 0 && examples.invalid === 0,
    message: issues.length === 0
      ? 'Developer Workspace doctor passou nos checks principais.'
      : 'Developer Workspace doctor found required adjustments.',
    manifestPath: resolved.resolved.manifestPath,
    errors: issues,
    warnings,
    doctor: {
      status: issues.length === 0 ? 'ready' : 'blocked',
      projectName: resolved.resolved.manifest.project.name,
      processes: resolved.resolved.manifest.processes.length,
      hooks: resolved.resolved.manifest.hooks.length,
      agents: resolved.resolved.manifest.agents.length,
      examples,
      nextCommand: issues.length === 0
        ? `zavorth workspace status --manifest "${resolved.resolved.manifestPath}"`
        : 'corrigir zavorth.yml e repetir workspace doctor',
    },
  });
}

function executeWorkspaceStop(
  command: WorkspaceCliCommand,
  resolved: ResolvedProjectManifest,
  flags: ZavorthCliFlags,
): WorkspaceCliPayload {
  const processIds = command.processId
    ? [command.processId]
    : resolved.manifest.processes.map((process) => process.id);
  if (!command.approve) {
    return buildPayload(command, {
      ok: false,
      message: 'workspace stop requer --approve para controlar processos.',
      manifestPath: resolved.manifestPath,
      approvalRequired: true,
      plan: {
        action: 'stop',
        targets: processIds,
        next: `zavorth workspace stop ${command.processId || '--all'} --approve`,
      },
    });
  }

  const results = processIds.map((processId) => executeWorkspaceSurfaceAction(
    { ...command, processId, approve: true },
    resolved,
    flags,
    'stop',
  ));
  const failures = results.filter((result) => !result.ok);
  return buildPayload(command, {
    ok: failures.length === 0,
    message: failures.length === 0
      ? 'Developer Workspace enviou stop para os processos selecionados.'
      : 'Developer Workspace tried to stop processes, but some failed.',
    manifestPath: resolved.manifestPath,
    approvalRequired: true,
    approvalSatisfied: true,
    result: {
      action: 'stop',
      targets: processIds,
      results,
    },
    errors: failures.flatMap((failure) => failure.errors),
  });
}

function executeWorkspaceSurfaceAction(
  command: WorkspaceCliCommand,
  resolved: ResolvedProjectManifest,
  flags: ZavorthCliFlags,
  action: 'start' | 'stop' | 'restart',
): WorkspaceCliPayload {
  const bundle = getWorkspaceRuntimeBundle(resolved);
  const result = bundle.surface.executeAction({
    resolved,
    action,
    processId: command.processId,
    requestedBy: flags.userId,
    approval: command.approve
      ? {
          approved: true,
          approvedBy: flags.userId,
          reason: `zavorth workspace ${command.action}`,
        }
      : null,
  });
  return buildPayload(command, {
    ok: result.ok,
    message: result.message,
    manifestPath: resolved.manifestPath,
    approvalRequired: result.approval.required,
    approvalSatisfied: result.approval.satisfied,
    result: result as unknown as Record<string, unknown>,
    snapshot: result.snapshot as unknown as Record<string, unknown>,
    errors: result.errors,
  });
}

function getWorkspaceRuntimeBundle(resolved: ResolvedProjectManifest): WorkspaceRuntimeBundle {
  const key = resolved.manifestPath;
  const existing = WORKSPACE_RUNTIME_BUNDLES.get(key);
  if (existing) {
    return existing;
  }

  const loader = new ProjectManifestLoader();
  const supervisor = new ProjectProcessSupervisor({ loader });
  const surface = new DeveloperWorkspaceSurfaceService({
    loader,
    processSupervisor: supervisor,
  });
  const bundle = { loader, supervisor, surface };
  WORKSPACE_RUNTIME_BUNDLES.set(key, bundle);
  return bundle;
}

function loadWorkspaceManifest(command: WorkspaceCliCommand): (
  | { ok: true; resolved: ResolvedProjectManifest }
  | { ok: false; error: Error }
) {
  const loader = new ProjectManifestLoader();
  try {
    return {
      ok: true,
      resolved: loader.load({
        cwd: command.cwd || undefined,
        manifestPath: command.manifestPath || undefined,
      }),
    };
  } catch (error: unknown) {
  const err = asErrorLike(error);logger.warn('[Zavorth Cli Registry Workspace] load operation failed', error);
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error || 'unknown manifest error')),
    };
  }
}

function parseWorkspaceCliCommand(rawArgs: string): WorkspaceCliCommand {
  const tokens = tokenizeArgs(rawArgs);
  const actionToken = normalizeToken(tokens[0]);
  const action = toWorkspaceAction(actionToken);
  const rest = actionToken ? tokens.slice(1) : tokens;
  let cwd: string | null = null;
  let manifestPath: string | null = null;
  let processId: string | null = null;
  let template: WorkspaceTemplateId = 'default';
  let dryRun = false;
  let force = false;
  let approve = false;
  let all = false;

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    const normalized = normalizeToken(token);
    if (normalized === '--cwd' && rest[index + 1]) {
      cwd = rest[++index];
      continue;
    }
    if ((normalized === '--manifest' || normalized === '--manifest-path') && rest[index + 1]) {
      manifestPath = rest[++index];
      continue;
    }
    if ((normalized === '--process' || normalized === '--process-id') && rest[index + 1]) {
      processId = rest[++index];
      continue;
    }
    if (normalized === '--template' && rest[index + 1]) {
      template = toWorkspaceTemplate(rest[++index]);
      continue;
    }
    if (normalized === '--dry-run' || normalized === 'dryrun') {
      dryRun = true;
      continue;
    }
    if (normalized === '--force') {
      force = true;
      continue;
    }
    if (normalized === '--approve' || normalized === '--yes' || normalized === '-y') {
      approve = true;
      continue;
    }
    if (normalized === '--all' || normalized === 'all') {
      all = true;
      continue;
    }
    if (!token.startsWith('-') && !processId && (action === 'stop' || action === 'restart' || action === 'up')) {
      processId = token;
    }
  }

  return {
    action,
    cwd,
    manifestPath,
    processId: all ? null : processId,
    template,
    dryRun,
    force,
    approve,
    all,
  };
}

function toWorkspaceAction(value: string): WorkspaceCliAction {
  if (
    value === 'init'
    || value === 'up'
    || value === 'status'
    || value === 'stop'
    || value === 'restart'
    || value === 'doctor'
  ) {
    return value;
  }
  return value ? 'help' : 'help';
}

function toWorkspaceTemplate(value: string): WorkspaceTemplateId {
  const normalized = normalizeToken(value);
  if (normalized === 'node-web' || normalized === 'python-api' || normalized === 'fullstack') {
    return normalized;
  }
  return 'default';
}

function buildWorkspaceManifestTemplate(template: WorkspaceTemplateId, cwd: string): string {
  const projectName = normalizeProjectName(path.basename(cwd) || 'my-project');
  const processBlocks = (template === 'python-api'
    ? [
        workspaceProcessBlock('api', 'Python API', 'python -m uvicorn app:app --reload', 'http://127.0.0.1:8000/health'),
        workspaceProcessBlock('tests', 'Python Tests', 'pytest', null),
      ]
    : template === 'fullstack'
      ? [
          workspaceProcessBlock('web', 'Web App', 'npm run dev', 'http://127.0.0.1:3000'),
          workspaceProcessBlock('api', 'API', 'npm run api:dev', 'http://127.0.0.1:4000/health'),
          workspaceProcessBlock('tests', 'Tests', 'npm test', null),
        ]
      : [
          workspaceProcessBlock('app', 'Web App', 'npm run dev', 'http://127.0.0.1:3000'),
          workspaceProcessBlock('tests', 'Tests', 'npm test', null),
        ]).flat();
  const watched = template === 'fullstack' ? ['web', 'api', 'tests'] : template === 'python-api' ? ['api', 'tests'] : ['app', 'tests'];
  const hookProcess = template === 'python-api' ? 'api' : template === 'fullstack' ? 'web' : 'app';
  return [
    'version: 1',
    '',
    'project:',
    `  name: ${projectName}`,
    '  root: .',
    '  description: Local project operated by Zavorth Developer Workspace.',
    '',
    'processes:',
    ...processBlocks,
    '',
    'mcp:',
    '  servers: []',
    '',
    'agents:',
    '  - id: maintainer',
    '    role: project-maintainer',
    '    watches:',
    ...watched.map((id) => `      - ${id}`),
    '    mode: suggest',
    '',
    'hooks:',
    '  - id: app-error',
    '    when:',
    `      process: ${hookProcess}`,
    '      pattern: "(FAIL|FAILED|Error|Exception|EADDRINUSE|Traceback)"',
    '    action:',
    '      type: agent-run',
    '      mode: suggest',
    '      prompt: Diagnose the failure and propose the smallest safe fix.',
    '',
    'policy:',
    '  defaultMode: suggest',
    '  requireApprovalFor:',
    '    - filesystem.write',
    '    - process.kill',
    '    - network.public',
    '    - selfmod.apply',
    '',
  ].join('\n');
}

function workspaceProcessBlock(
  id: string,
  name: string,
  command: string,
  healthUrl: string | null,
): string[] {
  const lines = [
    `  - id: ${id}`,
    `    name: ${name}`,
    `    command: ${command}`,
    '    cwd: .',
    id === 'tests' ? '    restart: never' : '    restart: on-failure',
  ];
  if (healthUrl) {
    lines.push('    health:', '      type: http', `      url: ${healthUrl}`);
  } else {
    lines.push('    health:', '      type: none');
  }
  return lines;
}

function buildWorkspaceActionPlan(
  command: WorkspaceCliCommand,
  resolved: ResolvedProjectManifest,
): Record<string, unknown> {
  return {
    action: command.action,
    processId: command.processId,
    all: command.all || !command.processId,
    approvalRequired: command.action !== 'status',
    manifestPath: resolved.manifestPath,
    projectName: resolved.manifest.project.name,
    targets: command.processId
      ? [command.processId]
      : resolved.manifest.processes.map((process) => process.id),
  };
}

function buildPayload(
  command: WorkspaceCliCommand,
  patch: Partial<WorkspaceCliPayload>,
): WorkspaceCliPayload {
  const cwd = path.resolve(command.cwd || process.cwd());
  return {
    ok: patch.ok ?? false,
    mode: 'developer_workspace_cli',
    action: command.action,
    generatedAt: new Date().toISOString(),
    message: patch.message || 'Developer Workspace CLI executado.',
    cwd,
    manifestPath: patch.manifestPath ?? command.manifestPath,
    dryRun: command.dryRun,
    approvalRequired: patch.approvalRequired ?? false,
    approvalSatisfied: patch.approvalSatisfied ?? command.approve,
    errors: patch.errors || [],
    warnings: patch.warnings || [],
    snapshot: patch.snapshot,
    result: patch.result,
    plan: patch.plan,
    doctor: patch.doctor,
  };
}

function formatWorkspaceCliPayload(payload: WorkspaceCliPayload): string {
  const lines = [
    'Developer Workspace',
    payload.message,
    '',
    `Acao: ${payload.action}`,
    `Manifesto: ${payload.manifestPath || 'not found'}`,
    `Approval: ${payload.approvalRequired ? (payload.approvalSatisfied ? 'satisfeito' : 'necessario') : 'not required'}`,
  ];
  if (payload.snapshot) {
    const summary = asRecord(payload.snapshot.summary);
    lines.push(
      '',
      `Processos: ${summary.processes ?? 0} | running: ${summary.running ?? 0} | failed: ${summary.failed ?? 0}`,
      `Hooks: ${summary.hooks ?? 0} | log-watch: ${summary.logWatchEvents ?? 0}`,
    );
  }
  if (payload.plan) {
    lines.push('', 'Plano:', JSON.stringify(payload.plan, null, 2));
  }
  if (payload.doctor) {
    lines.push('', 'Doctor:', JSON.stringify(payload.doctor, null, 2));
  }
  if (payload.errors.length > 0) {
    lines.push('', 'Erros:', ...payload.errors.map((error) => `- ${error}`));
  }
  if (payload.warnings.length > 0) {
    lines.push('', 'Avisos:', ...payload.warnings.map((warning) => `- ${warning}`));
  }
  return lines.join('\n');
}

function describeManifestError(error: Error): Record<string, unknown> {
  if (error instanceof ProjectManifestError) {
    return {
      kind: 'ProjectManifestError',
      issues: error.issues,
    };
  }
  return {
    kind: error.name || 'Error',
    message: error.message,
  };
}

function validateWorkspaceExamples(): Record<string, unknown> {
  const examplesRoot = path.resolve(config.projectRoot, 'examples', 'workspaces');
  if (!fs.existsSync(examplesRoot)) {
    return {
      root: examplesRoot,
      total: 0,
      valid: 0,
      invalid: 0,
      entries: [],
    };
  }

  const loader = new ProjectManifestLoader();
  const entries = fs.readdirSync(examplesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const manifestPath = path.join(examplesRoot, entry.name, 'zavorth.yml');
      try {
        loader.loadFromFile(manifestPath);
        return {
          id: entry.name,
          manifestPath,
          ok: true,
          error: null,
        };
      } catch (error: unknown) {
        const err = asErrorLike(error);
        logger.warn('[Zavorth Cli Registry Workspace] filesystem operation failed', error);
    return {
          id: entry.name,
          manifestPath,
          ok: false,
          error: error instanceof Error ? err.message : String(error || 'unknown error'),
        };
  }
    });
  return {
    root: examplesRoot,
    total: entries.length,
    valid: entries.filter((entry) => entry.ok).length,
    invalid: entries.filter((entry) => !entry.ok).length,
    entries,
  };
}

function workspaceCommandReference(): string[] {
  return [
    'zavorth workspace init [--cwd <dir>] [--template node-web|python-api|fullstack] [--dry-run] [--force]',
    'zavorth workspace doctor [--manifest <path>] [--json]',
    'zavorth workspace status [--manifest <path>] [--json]',
    'zavorth workspace up [processId] [--approve] [--dry-run]',
    'zavorth workspace stop [processId|--all] [--approve] [--dry-run]',
    'zavorth workspace restart <processId> [--approve] [--dry-run]',
  ];
}

function tokenizeArgs(value: string): string[] {
  const tokens: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? '');
  }
  return tokens.filter(Boolean);
}

function normalizeToken(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeProjectName(value: string): string {
  return String(value || 'my-project')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'my-project';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
