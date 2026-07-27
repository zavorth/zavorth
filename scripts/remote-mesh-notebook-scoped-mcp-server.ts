#!/usr/bin/env node
import process from 'node:process';

import type {
  RemoteMeshNotebookDockerControlAction,
  RemoteMeshNotebookScopedMcpServerSnapshot,
} from '../src/contracts/RemoteMeshNotebookScopedMcpServerContract.js';
import type {
  RemoteMeshNotebookDockerObservabilityProvider,
  RemoteMeshNotebookProjectFileReadProvider,
} from '@zavorth/mesh/RemoteMeshNotebookScopedMcpServerService.js';
import { RemoteMeshNotebookScopedMcpServerService } from '@zavorth/mesh/RemoteMeshNotebookScopedMcpServerService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const requirePass = args.includes('--require-pass');
const serve = args.includes('--serve');
const runSelfTest = args.includes('--self-test');
const includeDockerSelfTest = args.includes('--docker-self-test');
const includeDockerControlSelfTest = args.includes('--docker-control-self-test');
const includeProjectFileReadSelfTest = args.includes('--project-file-read-self-test');
const includeR7ClientSmoke = args.includes('--r7-client-smoke');
const useGeneratedToken = args.includes('--use-generated-token');
const enableDockerObservability = args.includes('--enable-docker-observability') || process.env.ZAVORTH_NOTEBOOK_DOCKER_OBSERVABILITY === '1';
const enableDockerControl = args.includes('--enable-docker-control') || process.env.ZAVORTH_NOTEBOOK_DOCKER_CONTROL === '1';
const enableProjectFileRead = args.includes('--enable-project-file-read') || process.env.ZAVORTH_NOTEBOOK_PROJECT_FILE_READ === '1';
const useDockerTestProvider = args.includes('--use-docker-test-provider');
const useProjectFileTestProvider = args.includes('--use-project-file-test-provider');
const allowPrivateBind = args.includes('--allow-private-bind') || process.env.ZAVORTH_NOTEBOOK_MCP_ALLOW_PRIVATE_BIND === '1';
const authHeaderName = args.includes('--x-zavorth-token') ? 'X-Zavorth-Remote-Token' as const
  : 'Authorization' as const;
const host = valueFor('--host') || process.env.ZAVORTH_NOTEBOOK_MCP_HOST || '127.0.0.1';
const port = Number(valueFor('--port') || process.env.ZAVORTH_NOTEBOOK_MCP_PORT || '8787');
const allowedDockerContainers = [
  ...valuesFor('--allow-docker-container'),
  ...(process.env.ZAVORTH_NOTEBOOK_DOCKER_CONTAINERS || '').split(','),
].map((value) => value.trim()).filter(Boolean);
const maxDockerLogLines = Number(valueFor('--max-docker-log-lines') || process.env.ZAVORTH_NOTEBOOK_DOCKER_MAX_LOG_LINES || '120');
const allowedDockerControlActions = [
  ...valuesFor('--allow-docker-action'),
  ...(process.env.ZAVORTH_NOTEBOOK_DOCKER_ACTIONS || '').split(','),
].map((value) => value.trim()).filter(isDockerControlAction);
const dockerControlApprovalTtlMs = Number(valueFor('--docker-control-approval-ttl-ms') || process.env.ZAVORTH_NOTEBOOK_DOCKER_CONTROL_APPROVAL_TTL_MS || '120000');
const allowedProjectFileRoots = [
  ...valuesFor('--allow-project-root'),
  ...(process.env.ZAVORTH_NOTEBOOK_PROJECT_ROOTS || '').split(';'),
].map(parseProjectRoot).filter((entry): entry is { name: string; rootPath: string } => Boolean(entry));
const projectFileReadMaxBytes = Number(valueFor('--project-file-read-max-bytes') || process.env.ZAVORTH_NOTEBOOK_PROJECT_FILE_READ_MAX_BYTES || '65536');
const projectFileReadApprovalTtlMs = Number(valueFor('--project-file-read-approval-ttl-ms') || process.env.ZAVORTH_NOTEBOOK_PROJECT_FILE_READ_APPROVAL_TTL_MS || '120000');
const dockerCliPath = valueFor('--docker-cli') || process.env.ZAVORTH_NOTEBOOK_DOCKER_CLI || 'docker';
const explicitToken = valueFor('--token') || process.env.ZAVORTH_NOTEBOOK_MCP_TOKEN || process.env.ZAVORTH_REMOTE_MESH_MCP_TOKEN || null;
const authToken = explicitToken || (useGeneratedToken ? RemoteMeshNotebookScopedMcpServerService.generatedSelfTestToken() : null);
const tokenSource = explicitToken ? 'env' as const
  : useGeneratedToken ? 'generated-test' as const
    : 'none' as const;

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  if (includeDockerControlSelfTest && !useDockerTestProvider && !args.includes('--allow-live-docker-control-self-test')) {
    process.stderr.write('R9 docker control self-test would mutate Docker state. Use --use-docker-test-provider for QA or pass --allow-live-docker-control-self-test intentionally.\n');
    process.exitCode = 1;
    return;
  }

  const service = new RemoteMeshNotebookScopedMcpServerService({
    host,
    port,
    authToken,
    tokenSource,
    authHeaderName,
    allowPrivateBind,
    enableDockerObservability,
    allowedDockerContainers,
    maxDockerLogLines,
    dockerCliPath,
    enableDockerControl,
    allowedDockerControlActions,
    dockerControlApprovalTtlMs,
    enableProjectFileRead,
    allowedProjectFileRoots,
    projectFileReadMaxBytes,
    projectFileReadApprovalTtlMs,
  }, {
    dockerProvider: useDockerTestProvider ? testDockerProvider() : undefined,
    projectFileProvider: useProjectFileTestProvider ? testProjectFileProvider() : undefined,
  });

  if (serve) {
    const snapshot = await service.buildSnapshot();
    const failures = validateSnapshot(snapshot, { serving: true });
    if (failures.length > 0) {
      write(snapshot, failures);
      process.exitCode = 1;
      return;
    }
    const started = await service.start();
    const lines = [
      `Zavorth Notebook Scoped MCP Server listening at ${started.url}`,
      `Tools: ${snapshot.config.exposedTools.join(', ')}`,
      'Stop with Ctrl+C.',
      '',
    ];
    process.stdout.write(lines.join('\n'));
    const shutdown = async () => {
      await new Promise<void>((resolve) => started.server.close(() => resolve()));
      process.exit(0);
    };
    process.once('SIGINT', () => { void shutdown(); });
    process.once('SIGTERM', () => { void shutdown(); });
    return;
  }

  const snapshot = await service.buildSnapshot({
    runSelfTest,
    includeDockerSelfTest,
    includeDockerControlSelfTest,
    includeProjectFileReadSelfTest,
    includeR7ClientSmoke,
  });
  const failures = validateSnapshot(snapshot, { serving: false });
  write(snapshot, failures);

  if (requirePass && failures.length > 0) {
    process.exitCode = 1;
  }
}

function write(snapshot: RemoteMeshNotebookScopedMcpServerSnapshot, failures: string[]): void {
  if (json) {
    process.stdout.write(`${JSON.stringify({ ...snapshot, validation: { failures } }, null, 2)}\n`);
  } else {
    process.stdout.write(render(snapshot, failures));
  }
}

function validateSnapshot(snapshot: RemoteMeshNotebookScopedMcpServerSnapshot, options: { serving: boolean }): string[] {
  const failures: string[] = [];

  if (snapshot.summary.rawCommandSerialized !== false) {
    failures.push('R7.5 must not serialize raw commands');
  }
  if (snapshot.summary.secretValuesSerialized !== false) {
    failures.push('R7.5 must not serialize secrets');
  }
  if (snapshot.phase === 'R7.5' && snapshot.summary.remoteProcessSpawned !== false) {
    failures.push('R7.5 must not spawn remote processes');
  }
  if (snapshot.summary.filesystemMutationPerformed !== false) {
    failures.push(`${snapshot.phase} must not mutate filesystems`);
  }
  if (snapshot.phase !== 'R9' && snapshot.summary.mutationPerformed !== false) {
    failures.push(`${snapshot.phase} must not perform mutations`);
  }
  if (snapshot.phase === 'R9' && snapshot.summary.mutationPerformed !== snapshot.summary.dockerMutationPerformed) {
    failures.push('R9 mutation summary must match approved Docker mutation summary');
  }
  if (snapshot.phase !== 'R9' && snapshot.summary.dockerMutationPerformed !== false) {
    failures.push(`${snapshot.phase} must not mutate Docker state`);
  }
  if (snapshot.phase === 'R9' && snapshot.summary.dockerMutationPerformed && !snapshot.dockerControlSelfTest.passed) {
    failures.push('R9 Docker mutation is only allowed through a passed control self-test or live approved tool call');
  }
  const expectedTools = ['notebook.get_status'];
  if (snapshot.config.dockerObservabilityEnabled) {
    expectedTools.push('notebook.docker.list_containers', 'notebook.docker.get_logs');
  }
  if (snapshot.config.dockerControlEnabled) {
    expectedTools.push('notebook.docker.preview_control', 'notebook.docker.apply_control');
  }
  if (snapshot.config.projectFileReadEnabled) {
    expectedTools.push('notebook.project_files.preview_read', 'notebook.project_files.apply_read');
  }
  if (JSON.stringify(snapshot.config.exposedTools) !== JSON.stringify(expectedTools)) {
    failures.push(`${snapshot.phase} exposes unexpected tools: ${snapshot.config.exposedTools.join(', ')}`);
  }
  if (snapshot.guards.some((guard) => guard.status === 'blocked')) {
    failures.push('R7.5 server is blocked by unsafe configuration');
  }
  if (options.serving && !snapshot.summary.readyToServe) {
    failures.push('R7.5 cannot serve until it is ready');
  }
  if (snapshot.selfTest.requested && !snapshot.selfTest.passed) {
    failures.push(`R7.5 self-test failed: ${snapshot.selfTest.errors.join('; ')}`);
  }
  if (snapshot.selfTest.requested && !snapshot.selfTest.serverClosed) {
    failures.push('R7.5 self-test server was not closed');
  }
  if (snapshot.dockerSelfTest.requested && !snapshot.dockerSelfTest.passed) {
    failures.push(`R8 Docker self-test failed: ${snapshot.dockerSelfTest.errors.join('; ')}`);
  }
  if (snapshot.dockerSelfTest.requested && !snapshot.dockerSelfTest.serverClosed) {
    failures.push('R8 Docker self-test server was not closed');
  }
  if (snapshot.dockerControlSelfTest.requested && !snapshot.dockerControlSelfTest.passed) {
    failures.push(`R9 Docker control self-test failed: ${snapshot.dockerControlSelfTest.errors.join('; ')}`);
  }
  if (snapshot.dockerControlSelfTest.requested && !snapshot.dockerControlSelfTest.serverClosed) {
    failures.push('R9 Docker control self-test server was not closed');
  }
  if (snapshot.projectFileReadSelfTest.requested && !snapshot.projectFileReadSelfTest.passed) {
    failures.push(`R10 project file read self-test failed: ${snapshot.projectFileReadSelfTest.errors.join('; ')}`);
  }
  if (snapshot.projectFileReadSelfTest.requested && !snapshot.projectFileReadSelfTest.serverClosed) {
    failures.push('R10 project file read self-test server was not closed');
  }
  if (snapshot.r7ClientSmoke && snapshot.r7ClientSmoke.status !== 'executed') {
    failures.push(`R7 client smoke did not execute: ${snapshot.r7ClientSmoke.status}`);
  }

  const serialized = JSON.stringify(snapshot);
  if (/sk-[A-Za-z0-9_-]{12,}/.test(serialized) || /xox[baprs]-[A-Za-z0-9-]{12,}/.test(serialized)) {
    failures.push('snapshot contains secret-looking values');
  }

  return failures;
}

function render(snapshot: RemoteMeshNotebookScopedMcpServerSnapshot, failures: string[]): string {
  const lines = [
    `Zavorth Remote Mesh ${snapshot.phase} Notebook MCP Server: ${snapshot.status}`,
    `host=${snapshot.config.host} port=${snapshot.config.port} ready=${snapshot.summary.readyToServe} selfTest=${snapshot.summary.selfTestPassed}`,
    `tools=${snapshot.config.exposedTools.join(', ')} liveNetwork=${snapshot.summary.liveNetworkCallPerformed}`,
    '',
  ];

  for (const guard of snapshot.guards) {
    lines.push(`[${guard.status}] ${guard.id}: ${guard.evidence}`);
    if (guard.remediation) {
      lines.push(`  next: ${guard.remediation}`);
    }
  }

  if (snapshot.selfTest.requested) {
    lines.push('', `Self-test: passed=${snapshot.selfTest.passed} status=${snapshot.selfTest.httpStatus} closed=${snapshot.selfTest.serverClosed}`);
  }
  if (snapshot.dockerSelfTest.requested) {
    lines.push(`Docker self-test: passed=${snapshot.dockerSelfTest.passed} status=${snapshot.dockerSelfTest.httpStatus} closed=${snapshot.dockerSelfTest.serverClosed}`);
  }
  if (snapshot.dockerControlSelfTest.requested) {
    lines.push(`Docker control self-test: passed=${snapshot.dockerControlSelfTest.passed} status=${snapshot.dockerControlSelfTest.httpStatus} closed=${snapshot.dockerControlSelfTest.serverClosed}`);
  }
  if (snapshot.projectFileReadSelfTest.requested) {
    lines.push(`Project file read self-test: passed=${snapshot.projectFileReadSelfTest.passed} status=${snapshot.projectFileReadSelfTest.httpStatus} closed=${snapshot.projectFileReadSelfTest.serverClosed}`);
  }
  if (snapshot.r7ClientSmoke) {
    lines.push(`R7 client smoke: ${snapshot.r7ClientSmoke.status}`);
  }

  if (failures.length > 0) {
    lines.push('', 'Failures:');
    failures.forEach((failure) => lines.push(`- ${failure}`));
  } else {
    lines.push('', 'Validation: passed');
  }

  return `${lines.join('\n')}\n`;
}

function valueFor(flag: string): string | null {
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return args[index + 1] || null;
}

function valuesFor(flag: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && args[index + 1]) {
      values.push(args[index + 1]);
    }
  }
  return values;
}

function testDockerProvider(): RemoteMeshNotebookDockerObservabilityProvider {
  return {
    async listContainers() {
      return {
        processSpawned: false,
        containers: [
          {
            id: 'r8test001',
            name: allowedDockerContainers[0] || 'zavorth-r8-test',
            image: 'zavorth/test:local',
            state: 'running',
            status: 'Up 1 minute',
            ports: null,
          },
        ],
      };
    },
    async getLogs(input) {
      return {
        processSpawned: false,
        logs: [
          `container=${input.container}`,
          `lines=${input.lines}`,
          'zavorth-r8-read-only-log',
        ].join('\n'),
      };
    },
    async controlContainer(input) {
      return {
        processSpawned: false,
        dockerMutationPerformed: input.action === 'start' || input.action === 'stop' || input.action === 'restart',
      };
    },
  };
}

function testProjectFileProvider(): RemoteMeshNotebookProjectFileReadProvider {
  const content = [
    '# Zavorth R10 Test',
    '',
    'This is a scoped project file read fixture.',
  ].join('\n');
  return {
    async statFile() {
      return {
        sizeBytes: Buffer.byteLength(content, 'utf8'),
        isFile: true,
      };
    },
    async readFileUtf8() {
      return {
        content,
        sizeBytes: Buffer.byteLength(content, 'utf8'),
        truncated: false,
      };
    },
  };
}

function isDockerControlAction(value: string): value is RemoteMeshNotebookDockerControlAction {
  return value === 'start' || value === 'stop' || value === 'restart';
}

function parseProjectRoot(value: string): { name: string; rootPath: string } | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const separatorIndex = trimmed.indexOf('=');
  if (separatorIndex <= 0) {
    return null;
  }
  const name = trimmed.slice(0, separatorIndex).trim();
  const rootPath = trimmed.slice(separatorIndex + 1).trim();
  if (!name || !rootPath) {
    return null;
  }
  return {
    name,
    rootPath,
  };
}
