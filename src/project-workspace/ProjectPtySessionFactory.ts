import * as os from 'os';
import * as path from 'path';
import type {
  ProjectManifestProcess,
  ProjectProcessResolution,
  ResolvedProjectManifest,
} from './ProjectManifestContract.js';
import { ProjectProcessSupervisorError, redactCommand } from './ProjectProcessSupervisor.js';
import { SessionManager, type SessionManagerOptions, type SessionManagerProfile } from '../runtime/sessions/v2/SessionManager.js';
import type { RegisterSessionOwnershipInput } from '../runtime/sessions/v2/SessionOwnershipContract.js';

export type ProjectPtySessionPolicy = {
  input: 'blocked' | 'operator-only';
  recording: 'enabled';
};

export type ProjectPtySessionProfile = SessionManagerProfile & {
  processId: string;
  projectName: string;
  projectRoot: string;
  manifestPath: string;
  manifestCommand: string;
  redactedCommand: string;
  policy: ProjectPtySessionPolicy;
};

export type ProjectPtySessionFactoryInput = {
  processId: string;
  sessionId?: string | null;
  runId?: string | null;
  requestedBy?: string | null;
  surface?: string | null;
};

export class ProjectPtySessionFactory {
  public createProfile(
    resolved: ResolvedProjectManifest,
    input: ProjectPtySessionFactoryInput,
  ): ProjectPtySessionProfile {
    const manifestProcess = resolved.manifest.processes.find((entry) => entry.id === input.processId);
    if (!manifestProcess) {
      throw new ProjectProcessSupervisorError(`Processo "${input.processId}" nao existe no manifesto.`);
    }
    const resolution = this.resolveProcessResolution(resolved, manifestProcess);
    if (resolution.outsideProject && manifestProcess.allowOutsideProject !== true) {
      throw new ProjectProcessSupervisorError(
        `Processo "${manifestProcess.id}" tentaria abrir PTY fora de project.root (${resolved.projectRoot}).`,
      );
    }

    const shellPlan = buildShellPlan(manifestProcess.command);
    const sessionId = normalizeText(
      input.sessionId,
      `project-pty-${slug(resolved.manifest.project.name)}-${slug(manifestProcess.id)}`,
    );
    const ownership = this.buildOwnership(resolved, manifestProcess, input);
    return {
      sessionId,
      cwd: resolution.resolvedCwd,
      command: shellPlan.command,
      args: shellPlan.args,
      ownership,
      processId: manifestProcess.id,
      projectName: resolved.manifest.project.name,
      projectRoot: resolved.projectRoot,
      manifestPath: resolved.manifestPath,
      manifestCommand: manifestProcess.command,
      redactedCommand: redactCommand(manifestProcess.command),
      policy: {
        input: 'operator-only',
        recording: 'enabled',
      },
    };
  }

  public createSessionManager(
    profile: ProjectPtySessionProfile,
    options: Omit<SessionManagerOptions, 'ownership'> = {},
  ): SessionManager {
    return SessionManager.fromProfile(profile, options);
  }

  private buildOwnership(
    resolved: ResolvedProjectManifest,
    manifestProcess: ProjectManifestProcess,
    input: ProjectPtySessionFactoryInput,
  ): Omit<RegisterSessionOwnershipInput, 'sessionId'> {
    const runId = normalizeNullable(input.runId);
    return {
      kind: 'pty',
      surface: normalizeText(input.surface, 'project-workspace-pty'),
      runId,
      taskId: manifestProcess.id,
      ownerRef: runId
        ? `project-pty:${resolved.manifest.project.name}:${manifestProcess.id}:run:${runId}`
        : `project-pty:${resolved.manifest.project.name}:${manifestProcess.id}`,
      metadata: {
        projectName: resolved.manifest.project.name,
        projectRoot: resolved.projectRoot,
        manifestPath: resolved.manifestPath,
        processId: manifestProcess.id,
        requestedBy: normalizeNullable(input.requestedBy),
        command: redactCommand(manifestProcess.command),
      },
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
}

function buildShellPlan(commandLine: string): { command: string; args: string[] } {
  if (os.platform() === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', commandLine],
    };
  }
  return {
    command: 'bash',
    args: ['-lc', commandLine],
  };
}

function isInsidePath(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function slug(value: string): string {
  return normalizeText(value, 'workspace')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'workspace';
}

function normalizeText(value: unknown, fallback = ''): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function normalizeNullable(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized || null;
}
