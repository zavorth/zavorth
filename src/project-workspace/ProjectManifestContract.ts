export const PROJECT_MANIFEST_VERSION = 1 as const;

export type ProjectManifestMode = 'observe' | 'suggest' | 'apply' | 'manual';

export type ProjectManifestRestartPolicy = 'never' | 'on-failure' | 'always';

export type ProjectManifestHealthCheck =
  | { type: 'none' }
  | { type: 'http'; url: string }
  | { type: 'command'; command: string };

export type ProjectManifestProject = {
  name: string;
  root: string;
  description: string;
};

export type ProjectManifestProcess = {
  id: string;
  name: string;
  command: string;
  cwd: string;
  restart: ProjectManifestRestartPolicy;
  health: ProjectManifestHealthCheck;
  shell?: boolean;
  allowOutsideProject?: boolean;
};

export type ProjectManifestMcpServer = {
  id: string;
  command?: string;
  url?: string;
  env?: Record<string, string>;
};

export type ProjectManifestAgent = {
  id: string;
  role: string;
  watches: string[];
  mode: ProjectManifestMode;
};

export type ProjectManifestHook = {
  id: string;
  when: {
    process: string;
    pattern: string;
  };
  action: {
    type: 'agent-run';
    mode: ProjectManifestMode;
    prompt: string;
  };
};

export type ProjectManifestPolicy = {
  defaultMode: ProjectManifestMode;
  requireApprovalFor: string[];
};

export type ProjectManifest = {
  version: typeof PROJECT_MANIFEST_VERSION;
  project: ProjectManifestProject;
  processes: ProjectManifestProcess[];
  mcp: {
    servers: ProjectManifestMcpServer[];
  };
  agents: ProjectManifestAgent[];
  hooks: ProjectManifestHook[];
  policy: ProjectManifestPolicy;
};

export type ProjectManifestIssue = {
  path: string;
  message: string;
};

export type ProjectProcessResolution = {
  id: string;
  cwd: string;
  resolvedCwd: string;
  outsideProject: boolean;
};

export type ResolvedProjectManifest = {
  manifestPath: string;
  manifestDir: string;
  projectRoot: string;
  manifest: ProjectManifest;
  processResolutions: ProjectProcessResolution[];
  sideEffects: 'none';
};

export const DEFAULT_PROJECT_MANIFEST_POLICY: ProjectManifestPolicy = {
  defaultMode: 'suggest',
  requireApprovalFor: [
    'filesystem.write',
    'process.kill',
    'network.public',
    'selfmod.apply',
  ],
};
