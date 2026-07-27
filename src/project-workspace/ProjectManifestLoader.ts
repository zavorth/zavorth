import * as fs from 'fs';
import * as path from 'path';
import { load as loadYaml } from 'js-yaml';
import {
  DEFAULT_PROJECT_MANIFEST_POLICY,
  PROJECT_MANIFEST_VERSION,
  type ProjectManifest,
  type ProjectManifestAgent,
  type ProjectManifestHealthCheck,
  type ProjectManifestHook,
  type ProjectManifestIssue,
  type ProjectManifestMcpServer,
  type ProjectManifestMode,
  type ProjectManifestPolicy,
  type ProjectManifestProcess,
  type ProjectManifestRestartPolicy,
  type ResolvedProjectManifest,
} from './ProjectManifestContract.js';
import { asErrorLike } from '../utils/errorLike.js';

export type ProjectManifestLoaderOptions = {
  cwd?: string | null;
  manifestPath?: string | null;
};

export class ProjectManifestError extends Error {
  public readonly issues: ProjectManifestIssue[];

  constructor(issues: ProjectManifestIssue[]) {
    super(`Invalid zavorth.yml: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`);
    this.name = 'ProjectManifestError';
    this.issues = issues;
  }
}

export class ProjectManifestLoader {
  public load(options: ProjectManifestLoaderOptions = {}): ResolvedProjectManifest {
    const manifestPath = options.manifestPath
      ? path.resolve(String(options.manifestPath))
      : this.findManifestPath(options.cwd || process.cwd());
    if (!manifestPath) {
      throw new ProjectManifestError([{
        path: 'zavorth.yml',
        message: 'manifest not found in this project root',
      }]);
    }

    return this.loadFromFile(manifestPath);
  }

  public loadFromFile(manifestPath: string): ResolvedProjectManifest {
    const resolvedManifestPath = path.resolve(manifestPath);
    let parsed: unknown;
    try {
      parsed = loadYaml(fs.readFileSync(resolvedManifestPath, 'utf8'));
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : String(error);
      throw new ProjectManifestError([{
        path: resolvedManifestPath,
        message: `could not read or parse YAML (${message})`,
      }]);
    }

    return this.loadFromObject(parsed, {
      manifestPath: resolvedManifestPath,
      manifestDir: path.dirname(resolvedManifestPath),
    });
  }

  public loadFromObject(
    rawManifest: unknown,
    input: { manifestPath?: string | null; manifestDir?: string | null } = {},
  ): ResolvedProjectManifest {
    const manifestPath = path.resolve(input.manifestPath || path.join(input.manifestDir || process.cwd(), 'zavorth.yml'));
    const manifestDir = path.resolve(input.manifestDir || path.dirname(manifestPath));
    const issues: ProjectManifestIssue[] = [];
    const root = asRecord(rawManifest);
    if (!root) {
      throw new ProjectManifestError([{
        path: 'manifest',
        message: 'expected a YAML object',
      }]);
    }

    const version = Number(root.version);
    if (version !== PROJECT_MANIFEST_VERSION) {
      issues.push({
        path: 'version',
        message: `expected ${PROJECT_MANIFEST_VERSION}`,
      });
    }

    const projectRecord = asRecord(root.project);
    const projectName = readRequiredString(projectRecord, 'name', 'project.name', issues);
    const projectRootInput = readString(projectRecord?.root, '.', 'project.root', issues);
    const projectDescription = readString(projectRecord?.description, '', 'project.description', issues);
    const projectRoot = path.resolve(manifestDir, projectRootInput);

    const policy = this.readPolicy(root.policy, issues);
    const processes = this.readProcesses(root.processes, projectRoot, issues);
    const processIds = new Set(processes.map((process) => process.id));
    const mcpServers = this.readMcpServers(root.mcp, issues);
    const agents = this.readAgents(root.agents, processIds, policy.defaultMode, issues);
    const hooks = this.readHooks(root.hooks, processIds, policy.defaultMode, issues);

    if (issues.length > 0) {
      throw new ProjectManifestError(issues);
    }

    const manifest: ProjectManifest = {
      version: PROJECT_MANIFEST_VERSION,
      project: {
        name: projectName,
        root: projectRootInput,
        description: projectDescription,
      },
      processes,
      mcp: {
        servers: mcpServers,
      },
      agents,
      hooks,
      policy,
    };

    return {
      manifestPath,
      manifestDir,
      projectRoot,
      manifest,
      processResolutions: processes.map((process) => {
        const resolvedCwd = path.resolve(projectRoot, process.cwd);
        return {
          id: process.id,
          cwd: process.cwd,
          resolvedCwd,
          outsideProject: !isInsidePath(projectRoot, resolvedCwd),
        };
      }),
      sideEffects: 'none',
    };
  }

  private findManifestPath(startCwd: string): string | null {
    let current = path.resolve(startCwd);
    for (;;) {
      for (const candidate of ['zavorth.yml', 'zavorth.yaml']) {
        const manifestPath = path.join(current, candidate);
        if (fs.existsSync(manifestPath)) {
          return manifestPath;
        }
      }

      const parent = path.dirname(current);
      if (parent === current) {
        return null;
      }
      current = parent;
    }
  }

  private readPolicy(rawPolicy: unknown, issues: ProjectManifestIssue[]): ProjectManifestPolicy {
    const record = asRecord(rawPolicy) || {};
    return {
      defaultMode: readMode(record.defaultMode, 'policy.defaultMode', issues, DEFAULT_PROJECT_MANIFEST_POLICY.defaultMode),
      requireApprovalFor: readStringArray(
        record.requireApprovalFor,
        'policy.requireApprovalFor',
        issues,
        DEFAULT_PROJECT_MANIFEST_POLICY.requireApprovalFor,
      ),
    };
  }

  private readProcesses(
    rawProcesses: unknown,
    projectRoot: string,
    issues: ProjectManifestIssue[],
  ): ProjectManifestProcess[] {
    if (rawProcesses == null) {
      return [];
    }
    if (!Array.isArray(rawProcesses)) {
      issues.push({ path: 'processes', message: 'expected a list' });
      return [];
    }

    return rawProcesses.map((rawProcess, index) => {
      const itemPath = `processes[${index}]`;
      const record = asRecord(rawProcess);
      if (!record) {
        issues.push({ path: itemPath, message: 'expected an object' });
        return this.emptyProcess(index);
      }

      const id = readRequiredString(record, 'id', `${itemPath}.id`, issues);
      const cwd = readString(record.cwd, '.', `${itemPath}.cwd`, issues);
      const resolvedCwd = path.resolve(projectRoot, cwd);
      const allowOutsideProject = record.allowOutsideProject === true;
      if (!allowOutsideProject && !isInsidePath(projectRoot, resolvedCwd)) {
        issues.push({
          path: `${itemPath}.cwd`,
          message: 'must stay inside project.root unless allowOutsideProject is true',
        });
      }

      return {
        id,
        name: readString(record.name, id || `process-${index + 1}`, `${itemPath}.name`, issues),
        command: readRequiredString(record, 'command', `${itemPath}.command`, issues),
        cwd,
        restart: readRestart(record.restart, `${itemPath}.restart`, issues, 'never'),
        health: readHealth(record.health, `${itemPath}.health`, issues),
        ...(record.shell === true ? { shell: true } : {}),
        ...(allowOutsideProject ? { allowOutsideProject: true } : {}),
      };
    });
  }

  private readMcpServers(rawMcp: unknown, issues: ProjectManifestIssue[]): ProjectManifestMcpServer[] {
    const mcpRecord = asRecord(rawMcp);
    const rawServers = mcpRecord?.servers;
    if (rawServers == null) {
      return [];
    }
    if (!Array.isArray(rawServers)) {
      issues.push({ path: 'mcp.servers', message: 'expected a list' });
      return [];
    }

    return rawServers.map((rawServer, index) => {
      const itemPath = `mcp.servers[${index}]`;
      const record = asRecord(rawServer);
      if (!record) {
        issues.push({ path: itemPath, message: 'expected an object' });
        return { id: `mcp-${index + 1}` };
      }

      return {
        id: readRequiredString(record, 'id', `${itemPath}.id`, issues),
        ...(typeof record.command === 'string' ? { command: record.command.trim() } : {}),
        ...(typeof record.url === 'string' ? { url: record.url.trim() } : {}),
        ...(asStringRecord(record.env) ? { env: asStringRecord(record.env) as Record<string, string> } : {}),
      };
    });
  }

  private readAgents(
    rawAgents: unknown,
    processIds: Set<string>,
    defaultMode: ProjectManifestMode,
    issues: ProjectManifestIssue[],
  ): ProjectManifestAgent[] {
    if (rawAgents == null) {
      return [];
    }
    if (!Array.isArray(rawAgents)) {
      issues.push({ path: 'agents', message: 'expected a list' });
      return [];
    }

    return rawAgents.map((rawAgent, index) => {
      const itemPath = `agents[${index}]`;
      const record = asRecord(rawAgent);
      if (!record) {
        issues.push({ path: itemPath, message: 'expected an object' });
        return { id: `agent-${index + 1}`, role: 'project-maintainer', watches: [], mode: defaultMode };
      }
      const watches = readStringArray(record.watches, `${itemPath}.watches`, issues, []);
      for (const watchId of watches) {
        if (!processIds.has(watchId)) {
          issues.push({
            path: `${itemPath}.watches`,
            message: `unknown process "${watchId}"`,
          });
        }
      }

      return {
        id: readRequiredString(record, 'id', `${itemPath}.id`, issues),
        role: readString(record.role, 'project-maintainer', `${itemPath}.role`, issues),
        watches,
        mode: readMode(record.mode, `${itemPath}.mode`, issues, defaultMode),
      };
    });
  }

  private readHooks(
    rawHooks: unknown,
    processIds: Set<string>,
    defaultMode: ProjectManifestMode,
    issues: ProjectManifestIssue[],
  ): ProjectManifestHook[] {
    if (rawHooks == null) {
      return [];
    }
    if (!Array.isArray(rawHooks)) {
      issues.push({ path: 'hooks', message: 'expected a list' });
      return [];
    }

    return rawHooks.map((rawHook, index) => {
      const itemPath = `hooks[${index}]`;
      const record = asRecord(rawHook);
      const when = asRecord(record?.when);
      const action = asRecord(record?.action);
      if (!record || !when || !action) {
        issues.push({ path: itemPath, message: 'expected when/action objects' });
      }
      const processId = readRequiredString(when, 'process', `${itemPath}.when.process`, issues);
      if (processId && !processIds.has(processId)) {
        issues.push({
          path: `${itemPath}.when.process`,
          message: `unknown process "${processId}"`,
        });
      }
      const actionType = readString(action?.type, 'agent-run', `${itemPath}.action.type`, issues);
      if (actionType !== 'agent-run') {
        issues.push({
          path: `${itemPath}.action.type`,
          message: 'only agent-run is supported in agent-run-only',
        });
      }

      return {
        id: readRequiredString(record, 'id', `${itemPath}.id`, issues),
        when: {
          process: processId,
          pattern: readRequiredString(when, 'pattern', `${itemPath}.when.pattern`, issues),
        },
        action: {
          type: 'agent-run',
          mode: readMode(action?.mode, `${itemPath}.action.mode`, issues, defaultMode),
          prompt: readRequiredString(action, 'prompt', `${itemPath}.action.prompt`, issues),
        },
      };
    });
  }

  private emptyProcess(index: number): ProjectManifestProcess {
    return {
      id: `process-${index + 1}`,
      name: `Process ${index + 1}`,
      command: '',
      cwd: '.',
      restart: 'never',
      health: { type: 'none' },
    };
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asStringRecord(value: unknown): Record<string, string> | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const next: Record<string, string> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry !== 'string') {
      return null;
    }
    next[key] = entry;
  }
  return next;
}

function readRequiredString(
  record: Record<string, unknown> | null | undefined,
  key: string,
  issuePath: string,
  issues: ProjectManifestIssue[],
): string {
  const value = record?.[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push({
      path: issuePath,
      message: 'required non-empty string',
    });
    return '';
  }
  return value.trim();
}

function readString(
  value: unknown,
  fallback: string,
  issuePath: string,
  issues: ProjectManifestIssue[],
): string {
  if (value == null) {
    return fallback;
  }
  if (typeof value !== 'string') {
    issues.push({
      path: issuePath,
      message: 'expected string',
    });
    return fallback;
  }
  return value.trim() || fallback;
}

function readStringArray(
  value: unknown,
  issuePath: string,
  issues: ProjectManifestIssue[],
  fallback: string[],
): string[] {
  if (value == null) {
    return [...fallback];
  }
  if (!Array.isArray(value)) {
    issues.push({
      path: issuePath,
      message: 'expected a list of strings',
    });
    return [...fallback];
  }
  const values: string[] = [];
  value.forEach((entry, index) => {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      issues.push({
        path: `${issuePath}[${index}]`,
        message: 'expected non-empty string',
      });
      return;
    }
    values.push(entry.trim());
  });
  return values;
}

function readMode(
  value: unknown,
  issuePath: string,
  issues: ProjectManifestIssue[],
  fallback: ProjectManifestMode,
): ProjectManifestMode {
  if (value == null) {
    return fallback;
  }
  const normalized = String(value || '').trim();
  if (normalized === 'observe' || normalized === 'suggest' || normalized === 'apply' || normalized === 'manual') {
    return normalized;
  }
  issues.push({
    path: issuePath,
    message: 'expected observe, suggest, apply or manual',
  });
  return fallback;
}

function readRestart(
  value: unknown,
  issuePath: string,
  issues: ProjectManifestIssue[],
  fallback: ProjectManifestRestartPolicy,
): ProjectManifestRestartPolicy {
  if (value == null) {
    return fallback;
  }
  const normalized = String(value || '').trim();
  if (normalized === 'never' || normalized === 'on-failure' || normalized === 'always') {
    return normalized;
  }
  issues.push({
    path: issuePath,
    message: 'expected never, on-failure or always',
  });
  return fallback;
}

function readHealth(
  value: unknown,
  issuePath: string,
  issues: ProjectManifestIssue[],
): ProjectManifestHealthCheck {
  if (value == null) {
    return { type: 'none' };
  }
  const record = asRecord(value);
  if (!record) {
    issues.push({
      path: issuePath,
      message: 'expected an object',
    });
    return { type: 'none' };
  }
  const type = String(record.type || 'none').trim();
  if (type === 'none') {
    return { type: 'none' };
  }
  if (type === 'http') {
    return {
      type: 'http',
      url: readRequiredString(record, 'url', `${issuePath}.url`, issues),
    };
  }
  if (type === 'command') {
    return {
      type: 'command',
      command: readRequiredString(record, 'command', `${issuePath}.command`, issues),
    };
  }
  issues.push({
    path: `${issuePath}.type`,
    message: 'expected none, http or command',
  });
  return { type: 'none' };
}

function isInsidePath(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
