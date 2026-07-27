import type {
  RemoteMeshNotebookScopedMcpServerConfig,
  RemoteMeshNotebookScopedMcpServerConfigSnapshot,
  RemoteMeshNotebookScopedMcpServerGuard,
  RemoteMeshNotebookScopedMcpServerStatus,
  RemoteMeshNotebookScopedMcpSelfTest,
  RemoteMeshNotebookScopedMcpToolName,
} from '../contracts/RemoteMeshNotebookScopedMcpServerContract.js';
import { guard, isLocalInterface } from './RemoteMeshNotebookScopedMcpServerHelpers.js';

export function buildNotebookScopedMcpGuards(input: {
  config: Required<RemoteMeshNotebookScopedMcpServerConfig>;
  exposedTools: RemoteMeshNotebookScopedMcpToolName[];
}): RemoteMeshNotebookScopedMcpServerGuard[] {
  const { config, exposedTools } = input;
  const bindSafe = isSafeBindHost(config.host, config.allowPrivateBind);
      const guards: RemoteMeshNotebookScopedMcpServerGuard[] = [
        guard(
          'bind-host-safe',
          bindSafe ? 'passed' : 'blocked',
          bindSafe ? `Bind host ${config.host} is allowed.`
            : `Bind host ${config.host} requires explicit private bind allowance.`,
          'Use 127.0.0.1 for local testing or pass --allow-private-bind intentionally for a tailnet/private interface.',
        ),
        guard(
          'port-valid',
          Number.isInteger(config.port) && config.port >= 0 && config.port <= 65535 ? 'passed' : 'blocked',
          `Port is ${config.port}.`,
          'Use a valid TCP port between 0 and 65535.',
        ),
        guard(
          'auth-token-configured',
          config.authToken ? 'passed' : 'waiting',
          config.authToken ? `Auth token configured from ${config.tokenSource}.` : 'No auth token configured.',
          'Set ZAVORTH_NOTEBOOK_MCP_TOKEN or pass --token for local testing.',
        ),
        guard(
          'auth-token-min-length',
          !config.authToken ? 'waiting' : config.authToken.length >= 16 ? 'passed' : 'blocked',
          !config.authToken ? 'Token length cannot be checked until a token is configured.'
            : `Token length is ${config.authToken.length}.`,
          'Use a scoped random token with at least 16 characters.',
        ),
        guard(
          'auth-header-only',
          'passed',
          `Auth is accepted only through ${config.authHeaderName}.`,
          null,
        ),
        guard(
          'mcp-path-locked',
          'passed',
          'Only POST /mcp is served.',
          null,
        ),
        guard(
          'post-only',
          'passed',
          'Non-POST requests are rejected.',
          null,
        ),
        guard(
          'tool-list-scoped',
          'passed',
          `tools/list exposes only ${exposedTools.join(', ')}.`,
          null,
        ),
        guard(
          'tool-call-locked',
          'passed',
          config.enableDockerObservability ? 'tools/call accepts status and read-only Docker observability tools with schema validation.'
            : 'tools/call accepts only notebook.get_status with empty arguments.',
          null,
        ),
        guard(
          'docker-observability-opt-in',
          'passed',
          config.enableDockerObservability ? 'Docker observability is explicitly enabled.'
            : 'Docker observability is disabled by default.',
          null,
        ),
        guard(
          'docker-container-allowlist',
          !config.enableDockerObservability || config.allowedDockerContainers.length > 0 ? 'passed' : 'blocked',
          !config.enableDockerObservability ? 'No Docker container allowlist is required while Docker observability is disabled.'
            : config.allowedDockerContainers.length > 0
              ? `${config.allowedDockerContainers.length} Docker container(s) are allowlisted.`
              : 'Docker observability requires at least one allowlisted container.',
          'Pass --allow-docker-container <name> or set ZAVORTH_NOTEBOOK_DOCKER_CONTAINERS.',
        ),
        guard(
          'docker-log-line-limit',
          !config.enableDockerObservability || (config.maxDockerLogLines >= 1 && config.maxDockerLogLines <= 500) ? 'passed'
            : 'blocked',
          `Docker log line limit is ${config.maxDockerLogLines}.`,
          'Use a max Docker log line limit between 1 and 500.',
        ),
        guard(
          'no-docker-mutation-tool',
          'passed',
          config.enableDockerControl ? 'Docker lifecycle control is available only through preview, approval, and receipt tools.'
            : 'No Docker start, stop, restart, remove, exec, build, pull, push, or compose control tool is registered.',
          null,
        ),
        guard(
          'docker-control-opt-in',
          'passed',
          config.enableDockerControl ? 'Docker control is explicitly enabled.'
            : 'Docker control is disabled by default.',
          null,
        ),
        guard(
          'docker-control-action-allowlist',
          !config.enableDockerControl || config.allowedDockerControlActions.length > 0 ? 'passed' : 'blocked',
          !config.enableDockerControl ? 'No Docker control action allowlist is required while Docker control is disabled.'
            : config.allowedDockerControlActions.length > 0
              ? `${config.allowedDockerControlActions.length} Docker control action(s) are allowlisted.`
              : 'Docker control requires at least one allowlisted action.',
          'Pass --allow-docker-action <start|stop|restart> or set ZAVORTH_NOTEBOOK_DOCKER_ACTIONS.',
        ),
        guard(
          'docker-control-approval-required',
          'passed',
          'Docker control apply requires a live preview approval id and exact approval phrase.',
          null,
        ),
        guard(
          'docker-control-receipts-enabled',
          'passed',
          'Docker control apply emits a structured receipt with action, container, approval id, and mutation flags.',
          null,
        ),
        guard(
          'no-docker-raw-control',
          'passed',
          'Docker control never accepts raw command strings, compose files, exec payloads, or image names.',
          null,
        ),
        guard(
          'project-file-read-opt-in',
          'passed',
          config.enableProjectFileRead ? 'Project file reads are explicitly enabled.'
            : 'Project file reads are disabled by default.',
          null,
        ),
        guard(
          'project-file-root-allowlist',
          !config.enableProjectFileRead || config.allowedProjectFileRoots.length > 0 ? 'passed' : 'blocked',
          !config.enableProjectFileRead ? 'No project file root allowlist is required while project file reads are disabled.'
            : config.allowedProjectFileRoots.length > 0
              ? `${config.allowedProjectFileRoots.length} project file root(s) are allowlisted.`
              : 'Project file reads require at least one allowlisted project root.',
          'Pass --allow-project-root <name=path> or set ZAVORTH_NOTEBOOK_PROJECT_ROOTS.',
        ),
        guard(
          'project-file-size-limit',
          !config.enableProjectFileRead || (config.projectFileReadMaxBytes >= 1 && config.projectFileReadMaxBytes <= 262_144) ? 'passed'
            : 'blocked',
          `Project file read max bytes is ${config.projectFileReadMaxBytes}.`,
          'Use a project file read limit between 1 and 262144 bytes.',
        ),
        guard(
          'project-file-read-approval-required',
          'passed',
          'Project file reads require preview approval id and exact approval phrase before content is returned.',
          null,
        ),
        guard(
          'no-project-file-write-tool',
          'passed',
          'No project file write, delete, edit, patch, chmod, or rename tool is registered.',
          null,
        ),
        guard(
          'no-shell-tool',
          'passed',
          'No shell, command, sudo, or terminal tool is registered.',
          null,
        ),
        guard(
          'no-filesystem-mutation',
          'passed',
          'The server does not register write/delete/edit tools.',
          null,
        ),
      ];
      return guards;
}

export function isSafeBindHost(hostValue: string, allowPrivateBind: boolean): boolean {
  if (hostValue === '127.0.0.1' || hostValue === 'localhost' || hostValue === '::1') {
    return true;
  }
  if (!allowPrivateBind) {
    return false;
  }
  return hostValue === '0.0.0.0' || hostValue === '::' || isLocalInterface(hostValue);
}

export function buildNotebookScopedMcpConfigSnapshot(input: {
  config: Required<RemoteMeshNotebookScopedMcpServerConfig>;
  exposedTools: RemoteMeshNotebookScopedMcpToolName[];
}): RemoteMeshNotebookScopedMcpServerConfigSnapshot {
  const { config, exposedTools } = input;
    return {
      host: config.host,
      port: config.port,
      bindLabel: bindLabelForHost(config.host),
      authHeaderName: config.authHeaderName,
      authTokenConfigured: Boolean(config.authToken),
      tokenSource: config.authToken ? config.tokenSource : 'none',
      allowPrivateBind: config.allowPrivateBind,
      exposedPath: '/mcp',
      exposedTools: exposedTools,
      dockerObservabilityEnabled: config.enableDockerObservability,
      allowedDockerContainers: config.allowedDockerContainers,
      maxDockerLogLines: config.maxDockerLogLines,
      dockerCliPathLabel: config.dockerCliPath === 'docker' ? 'docker' : 'custom-docker-cli-path',
      dockerControlEnabled: config.enableDockerControl,
      allowedDockerControlActions: config.allowedDockerControlActions,
      dockerControlApprovalTtlMs: config.dockerControlApprovalTtlMs,
      projectFileReadEnabled: config.enableProjectFileRead,
      allowedProjectFileRoots: config.allowedProjectFileRoots.map((rootEntry) => rootEntry.name),
      projectFileReadMaxBytes: config.projectFileReadMaxBytes,
      projectFileReadApprovalTtlMs: config.projectFileReadApprovalTtlMs,
      rawTokenSerialized: false,
      rawCommandSerialized: false,
      secretValuesSerialized: false,
    };
  }

export function bindLabelForHost(host: string): string {
    if (host === '0.0.0.0' || host === '::') {
      return 'all-interfaces';
    }
    if (isLoopbackHost(host)) {
      return 'loopback';
    }
    return isLocalInterface(host) ? 'local-interface' : 'custom-host';
  }

export function isLoopbackHost(hostValue: string): boolean {
    return hostValue === '127.0.0.1' || hostValue === 'localhost' || hostValue === '::1';
  }

export function hostForUrl(hostValue: string): string {
    if (hostValue === '0.0.0.0' || hostValue === '::') {
      return '127.0.0.1';
    }
    return hostValue === '::1' ? '[::1]' : hostValue;
  }

export function resolveNotebookScopedMcpStatus(input: {
    guards: RemoteMeshNotebookScopedMcpServerGuard[];
    selfTest: RemoteMeshNotebookScopedMcpSelfTest;
    readyToServe: boolean;
  }): RemoteMeshNotebookScopedMcpServerStatus {
    if (input.guards.some((guardItem) => guardItem.status === 'blocked')) {
      return 'blocked';
    }
    if (!input.readyToServe) {
      return 'not-configured';
    }
    if (input.selfTest.requested && input.selfTest.passed) {
      return 'self-test-passed';
    }
    if (input.selfTest.requested && !input.selfTest.passed) {
      return 'failed';
    }
    return 'ready';
  }
