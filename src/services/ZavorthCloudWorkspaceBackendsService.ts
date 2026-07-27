import { spawnSync } from 'node:child_process';

import {
  ZAVORTH_CLOUD_WORKSPACE_BACKENDS_CONTRACT_VERSION,
  type ZavorthCloudWorkspaceBackend,
  type ZavorthCloudWorkspaceBackendId,
  type ZavorthCloudWorkspaceBackendProbe,
  type ZavorthCloudWorkspaceBackendsSnapshot,
} from '../contracts/ZavorthCloudWorkspaceBackendsContract.js';

type Runtime = {
  now?: () => Date;
  env?: Record<string, string | undefined>;
  commandExists?: (command: string) => boolean;
};

const LIVE_FLAG = 'ZAVORTH_CLOUD_WORKSPACE_ALLOW_LIVE_IO';

type BackendManifest = {
  id: ZavorthCloudWorkspaceBackendId;
  label: string;
  isolation: ZavorthCloudWorkspaceBackend['isolation'];
  commandEnv: string;
  commandFallback: string;
  credentialEnv: string[];
  credentialEnvGroups?: string[][];
  defaultCommand: string;
};

const MANIFESTS: BackendManifest[] = [
  {
    id: 'cloud-function',
    label: 'Cloud function workspace',
    isolation: 'serverless-container',
    commandEnv: 'ZAVORTH_CLOUD_FUNCTION_COMMAND',
    commandFallback: 'zavorth-cloud-function',
    credentialEnv: ['ZAVORTH_CLOUD_FUNCTION_TOKEN'],
    defaultCommand: 'zavorth-cloud-function run <workload>',
  },
  {
    id: 'managed-workspace',
    label: 'Managed workspace',
    isolation: 'managed-dev-workspace',
    commandEnv: 'ZAVORTH_MANAGED_WORKSPACE_COMMAND',
    commandFallback: 'zavorth-managed-workspace',
    credentialEnv: ['ZAVORTH_MANAGED_WORKSPACE_TOKEN'],
    defaultCommand: 'zavorth-managed-workspace run <workload>',
  },
  {
    id: 'custom-remote-workspace',
    label: 'Custom remote workspace',
    isolation: 'remote-workspace',
    commandEnv: 'ZAVORTH_REMOTE_WORKSPACE_COMMAND',
    commandFallback: 'ssh',
    credentialEnv: ['ZAVORTH_REMOTE_WORKSPACE_ENDPOINT'],
    defaultCommand: 'zavorth remote-workspace run <workload>',
  },
  {
    id: 'modal',
    label: 'Modal cloud function',
    isolation: 'cloud-function',
    commandEnv: 'ZAVORTH_MODAL_COMMAND',
    commandFallback: 'modal',
    credentialEnv: ['MODAL_TOKEN_ID', 'MODAL_TOKEN_SECRET', 'ZAVORTH_MODAL_TOKEN'],
    credentialEnvGroups: [['MODAL_TOKEN_ID', 'MODAL_TOKEN_SECRET'], ['ZAVORTH_MODAL_TOKEN']],
    defaultCommand: 'modal run <function> --command <workload>',
  },
  {
    id: 'daytona',
    label: 'Daytona workspace',
    isolation: 'cloud-dev-workspace',
    commandEnv: 'ZAVORTH_DAYTONA_COMMAND',
    commandFallback: 'daytona',
    credentialEnv: ['DAYTONA_API_KEY', 'ZAVORTH_DAYTONA_API_KEY', 'ZAVORTH_DAYTONA_WORKSPACE'],
    credentialEnvGroups: [['DAYTONA_API_KEY', 'ZAVORTH_DAYTONA_WORKSPACE'], ['ZAVORTH_DAYTONA_API_KEY', 'ZAVORTH_DAYTONA_WORKSPACE']],
    defaultCommand: 'daytona workspace exec <workspace> -- <workload>',
  },
];

export class ZavorthCloudWorkspaceBackendsService {
  private readonly now: () => Date;
  private readonly env: Record<string, string | undefined>;
  private readonly commandExists: (command: string) => boolean;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.env = runtime.env || process.env;
    this.commandExists = runtime.commandExists || defaultCommandExists;
  }

  public buildSnapshot(): ZavorthCloudWorkspaceBackendsSnapshot {
    const backends = MANIFESTS.map((manifest) => this.backend(manifest));
    const summary = {
      total: backends.length,
      ready: backends.filter((backend) => backend.status === 'ready').length,
      missingConfig: backends.filter((backend) => backend.status === 'missing-config').length,
      liveDisabled: backends.filter((backend) => backend.status === 'live-disabled').length,
    };
    return {
      contractVersion: ZAVORTH_CLOUD_WORKSPACE_BACKENDS_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      source: 'ZavorthCloudWorkspaceBackendsService',
      status: summary.ready === backends.length ? 'ready'
        : summary.ready > 0 || summary.liveDisabled > 0
          ? 'partial'
          : 'missing-config',
      summary,
      backends,
      safety: {
        doctorDoesNotExecuteWorkload: true,
        liveIoRequiresExplicitFlag: true,
        noSecretValuesSerialized: true,
        neutralZavorthBackendNames: true,
      },
      commands: {
        doctor: 'zavorth cloud-workspace doctor',
        check: 'npm run zavorth:cloud-workspace-backends:check',
      },
    };
  }

  private backend(manifest: BackendManifest): ZavorthCloudWorkspaceBackend {
    const command = String(this.env[manifest.commandEnv] || manifest.commandFallback).trim();
    const executableReady = this.commandExists(command);
    const credentialsReady = credentialsConfigured(this.env, manifest);
    const liveIoAllowed = isTruthy(this.env[LIVE_FLAG]);
    const missing = [
      ...(!executableReady ? [`command:${manifest.commandEnv}`] : []),
      ...(!credentialsReady ? missingCredentialRefs(manifest).map((name) => `env:${name}`) : []),
      ...(!liveIoAllowed ? [`env:${LIVE_FLAG}`] : []),
    ];
    const probe: ZavorthCloudWorkspaceBackendProbe = {
      configured: executableReady && credentialsReady,
      executableReady,
      credentialsReady,
      liveIoAllowed,
      missing,
    };
    const status = probe.configured
      ? probe.liveIoAllowed ? 'ready' : 'live-disabled'
      : 'missing-config';
    return {
      id: manifest.id,
      label: manifest.label,
      status,
      isolation: manifest.isolation,
      adapterMode: status === 'ready' ? 'cli-live-ready' : 'doctor-only',
      defaultCommand: manifest.defaultCommand,
      envRefs: [...manifest.credentialEnv, manifest.commandEnv, LIVE_FLAG],
      probe,
      nextAction: nextAction(manifest, probe),
    };
  }
}

function nextAction(manifest: BackendManifest, probe: ZavorthCloudWorkspaceBackendProbe): string {
  if (!probe.executableReady) return `Configure ${manifest.commandEnv} or install the backend CLI.`;
  if (!probe.credentialsReady) return `Configure credential reference(s): ${missingCredentialRefs(manifest).join(', ')}.`;
  if (!probe.liveIoAllowed) return `Set ${LIVE_FLAG}=true only when you want live remote probes.`;
  return 'Backend is ready for governed live probes through approval-gated workload runners.';
}

function credentialsConfigured(env: Record<string, string | undefined>, manifest: BackendManifest): boolean {
  const groups = manifest.credentialEnvGroups && manifest.credentialEnvGroups.length > 0
    ? manifest.credentialEnvGroups
    : [manifest.credentialEnv];
  return groups.some((group) => group.every((name) => Boolean(String(env[name] || '').trim())));
}

function missingCredentialRefs(manifest: BackendManifest): string[] {
  const groups = manifest.credentialEnvGroups && manifest.credentialEnvGroups.length > 0
    ? manifest.credentialEnvGroups
    : [manifest.credentialEnv];
  if (groups.length === 1) return groups[0] || [];
  return groups.map((group) => group.join(' + '));
}

function defaultCommandExists(command: string): boolean {
  const executable = command.split(/\s+/u)[0] || command;
  const result = process.platform === 'win32'
    ? spawnSync('where.exe', [executable], {
      encoding: 'utf8',
      windowsHide: true,
    })
    : spawnSync('sh', ['-lc', `command -v ${JSON.stringify(executable)}`], {
    encoding: 'utf8',
    windowsHide: true,
  });
  return result.status === 0;
}

function isTruthy(value: unknown): boolean {
  return /^(1|true|yes|on)$/iu.test(String(value || '').trim());
}
