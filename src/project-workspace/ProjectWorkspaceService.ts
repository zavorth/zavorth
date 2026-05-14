import {
  ProjectManifestLoader,
  type ProjectManifestLoaderOptions,
} from './ProjectManifestLoader.js';
import type {
  ProjectManifestHealthCheck,
  ProjectManifestMode,
  ProjectManifestRestartPolicy,
  ResolvedProjectManifest,
} from './ProjectManifestContract.js';

export type ProjectWorkspaceProcessSummary = {
  id: string;
  name: string;
  command: string;
  cwd: string;
  resolvedCwd: string;
  outsideProject: boolean;
  restart: ProjectManifestRestartPolicy;
  health: ProjectManifestHealthCheck;
};

export type ProjectWorkspaceSnapshot = {
  manifestPath: string;
  projectRoot: string;
  project: {
    name: string;
    description: string;
  };
  processes: ProjectWorkspaceProcessSummary[];
  agents: Array<{
    id: string;
    role: string;
    mode: ProjectManifestMode;
    watches: string[];
  }>;
  hooks: Array<{
    id: string;
    process: string;
    pattern: string;
    mode: ProjectManifestMode;
    prompt: string;
  }>;
  policy: {
    defaultMode: ProjectManifestMode;
    requireApprovalFor: string[];
  };
  mcpServerCount: number;
  canonicalAgentLoop: 'ZavorthAgentGateway.handle';
  sideEffects: 'none';
  summary: string;
};

export class ProjectWorkspaceService {
  constructor(private readonly loader = new ProjectManifestLoader()) {}

  public inspect(options: ProjectManifestLoaderOptions = {}): ProjectWorkspaceSnapshot {
    return this.buildSnapshot(this.loader.load(options));
  }

  public buildSnapshot(resolved: ResolvedProjectManifest): ProjectWorkspaceSnapshot {
    const resolutionsById = new Map(
      resolved.processResolutions.map((resolution) => [resolution.id, resolution]),
    );
    const processes = resolved.manifest.processes.map((process) => {
      const resolution = resolutionsById.get(process.id);
      return {
        id: process.id,
        name: process.name,
        command: process.command,
        cwd: process.cwd,
        resolvedCwd: resolution?.resolvedCwd || resolved.projectRoot,
        outsideProject: Boolean(resolution?.outsideProject),
        restart: process.restart,
        health: process.health,
      };
    });

    return {
      manifestPath: resolved.manifestPath,
      projectRoot: resolved.projectRoot,
      project: {
        name: resolved.manifest.project.name,
        description: resolved.manifest.project.description,
      },
      processes,
      agents: resolved.manifest.agents.map((agent) => ({
        id: agent.id,
        role: agent.role,
        mode: agent.mode,
        watches: [...agent.watches],
      })),
      hooks: resolved.manifest.hooks.map((hook) => ({
        id: hook.id,
        process: hook.when.process,
        pattern: hook.when.pattern,
        mode: hook.action.mode,
        prompt: hook.action.prompt,
      })),
      policy: {
        defaultMode: resolved.manifest.policy.defaultMode,
        requireApprovalFor: [...resolved.manifest.policy.requireApprovalFor],
      },
      mcpServerCount: resolved.manifest.mcp.servers.length,
      canonicalAgentLoop: 'ZavorthAgentGateway.handle',
      sideEffects: resolved.sideEffects,
      summary: this.buildSummary(resolved),
    };
  }

  private buildSummary(resolved: ResolvedProjectManifest): string {
    const processCount = resolved.manifest.processes.length;
    const agentCount = resolved.manifest.agents.length;
    const hookCount = resolved.manifest.hooks.length;
    return [
      `${resolved.manifest.project.name} uses zavorth.yml version ${resolved.manifest.version}.`,
      `Project root: ${resolved.projectRoot}.`,
      `Processes: ${processCount}; agents: ${agentCount}; hooks: ${hookCount}.`,
      'Loading the manifest is read-only and does not start processes.',
      'Agent work must enter through ZavorthAgentGateway.handle and existing approval policy.',
    ].join(' ');
  }
}
