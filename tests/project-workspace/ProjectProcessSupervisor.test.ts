import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { EventEmitter } from 'events';
import type { ProjectManifestProcess, ResolvedProjectManifest } from '../../src/project-workspace/index.js';
import {
  ProjectProcessOwnershipError,
  ProjectProcessSupervisor,
  ProjectProcessSupervisorError,
  ProjectPtySessionFactory,
  redactCommand,
} from '../../src/project-workspace/index.js';
import { SessionRegistryService } from '../../src/runtime/sessions/v2/SessionRegistryService.js';

function createTempProject(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-project-process-'));
}

function nodeCommand(source: string): string {
  return `${JSON.stringify(process.execPath)} -e ${JSON.stringify(source)}`;
}

function createResolved(root: string, processes: ProjectManifestProcess[]): ResolvedProjectManifest {
  return {
    manifestPath: path.join(root, 'zavorth.yml'),
    manifestDir: root,
    projectRoot: root,
    manifest: {
      version: 1,
      project: {
        name: 'demo',
        root: '.',
        description: 'Demo project.',
      },
      processes,
      mcp: {
        servers: [],
      },
      agents: [],
      hooks: [],
      policy: {
        defaultMode: 'suggest',
        requireApprovalFor: [],
      },
    },
    processResolutions: processes.map((entry) => {
      const resolvedCwd = path.resolve(root, entry.cwd);
      const relative = path.relative(root, resolvedCwd);
      return {
        id: entry.id,
        cwd: entry.cwd,
        resolvedCwd,
        outsideProject: relative.startsWith('..') || path.isAbsolute(relative),
      };
    }),
    sideEffects: 'none',
  };
}

function processFixture(input: Partial<ProjectManifestProcess> & Pick<ProjectManifestProcess, 'id' | 'command'>): ProjectManifestProcess {
  return {
    name: input.id,
    cwd: '.',
    restart: 'never',
    health: { type: 'none' },
    ...input,
  };
}

function createFakeChild() {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.pid = 12345;
  child.kill = jest.fn(() => true);
  return child;
}

async function waitUntil(assertion: () => boolean, timeoutMs = 2000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (assertion()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Timed out waiting for condition.');
}

describe('ProjectProcessSupervisor', () => {
  const tempRoots: string[] = [];
  const supervisors: ProjectProcessSupervisor[] = [];

  afterEach(() => {
    for (const supervisor of supervisors.splice(0)) {
      supervisor.dispose();
    }
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('starts a declared project process and captures stdout with ownership', async () => {
    const root = createTempProject();
    tempRoots.push(root);
    const resolved = createResolved(root, [
      processFixture({
        id: 'hello',
        command: nodeCommand('console.log("hello from project")'),
      }),
    ]);
    const registry = new SessionRegistryService();
    const supervisor = new ProjectProcessSupervisor({
      sessionRegistry: registry,
      shell: false,
      restartBackoffMs: 5,
    });
    supervisors.push(supervisor);

    supervisor.startProject({ resolved, runId: 'run-1', requestedBy: 'tester' });

    await waitUntil(() => supervisor.readLogs({ processId: 'hello' }).some((log) => log.text.includes('hello from project')));
    await waitUntil(() => supervisor.listProcesses()[0]?.status === 'exited');
    const record = supervisor.listProcesses()[0];
    expect(record).toEqual(expect.objectContaining({
      id: 'hello',
      redactedCommand: expect.stringContaining(path.basename(process.execPath)),
      owner: expect.objectContaining({
        ownerRef: 'project:demo:hello:run:run-1',
        requestedBy: 'tester',
      }),
    }));
    expect(registry.listSessions()[0]).toEqual(expect.objectContaining({
      kind: 'project_process',
      ownerRef: 'project:demo:hello:run:run-1',
    }));
  });

  it('does not use a shell for manifest process commands by default', () => {
    const root = createTempProject();
    tempRoots.push(root);
    const resolved = createResolved(root, [
      processFixture({
        id: 'safe-default',
        command: nodeCommand('console.log("safe-default")'),
      }),
    ]);
    const calls: Array<{ command: string; args: string[]; options: { shell?: boolean } }> = [];
    const supervisor = new ProjectProcessSupervisor({
      spawnProcess: ((command, args, options) => {
        calls.push({ command, args, options });
        return createFakeChild();
      }) as any,
    });
    supervisors.push(supervisor);

    supervisor.startProject({ resolved });

    expect(calls[0]?.options.shell).toBe(false);
    expect(calls[0]?.command).toBe(process.execPath);
    expect(calls[0]?.args).toEqual(['-e', 'console.log("safe-default")']);
  });

  it('requires explicit shell opt-in for shell process commands', () => {
    const root = createTempProject();
    tempRoots.push(root);
    const resolved = createResolved(root, [
      processFixture({
        id: 'shell-command',
        command: 'echo hello && echo done',
        shell: true,
      }),
    ]);
    const calls: Array<{ command: string; args: string[]; options: { shell?: boolean } }> = [];
    const supervisor = new ProjectProcessSupervisor({
      spawnProcess: ((command, args, options) => {
        calls.push({ command, args, options });
        return createFakeChild();
      }) as any,
    });
    supervisors.push(supervisor);

    supervisor.startProject({ resolved });

    expect(calls[0]).toEqual(expect.objectContaining({
      command: 'echo hello && echo done',
      args: [],
      options: expect.objectContaining({ shell: true }),
    }));
  });

  it('stops only processes owned by this supervisor and rejects wrong owners', async () => {
    const root = createTempProject();
    tempRoots.push(root);
    const resolved = createResolved(root, [
      processFixture({
        id: 'watcher',
        command: nodeCommand('setInterval(() => console.log("tick"), 25)'),
      }),
    ]);
    const supervisor = new ProjectProcessSupervisor({ shell: false });
    supervisors.push(supervisor);

    supervisor.startProject({ resolved });
    await waitUntil(() => supervisor.listProcesses()[0]?.status === 'running');

    expect(() => supervisor.stopProcess({
      processId: 'watcher',
      ownerRef: 'project:demo:someone-else',
    })).toThrow(ProjectProcessOwnershipError);

    supervisor.stopProcess({
      processId: 'watcher',
      ownerRef: 'project:demo:watcher',
    });
    await waitUntil(() => supervisor.listProcesses()[0]?.status === 'exited');
  });

  it('refuses a process cwd outside project.root when it is not explicitly allowed', () => {
    const root = createTempProject();
    tempRoots.push(root);
    const resolved = createResolved(root, [
      processFixture({
        id: 'outside',
        command: nodeCommand('console.log("outside")'),
        cwd: '..',
      }),
    ]);
    const supervisor = new ProjectProcessSupervisor({ shell: false });
    supervisors.push(supervisor);

    expect(() => supervisor.startProject({ resolved })).toThrow(ProjectProcessSupervisorError);
  });

  it('applies restart on failure with a bounded retry count', async () => {
    const root = createTempProject();
    tempRoots.push(root);
    const resolved = createResolved(root, [
      processFixture({
        id: 'flaky',
        command: nodeCommand('console.error("boom"); process.exit(1)'),
        restart: 'on-failure',
      }),
    ]);
    const supervisor = new ProjectProcessSupervisor({
      shell: false,
      restartBackoffMs: 5,
      restartLimit: 2,
    });
    supervisors.push(supervisor);

    supervisor.startProject({ resolved });

    await waitUntil(() => {
      const record = supervisor.listProcesses()[0];
      return record?.restartCount === 2 && record.status === 'failed' && record.nextRestartAt === null;
    }, 3000);
    const record = supervisor.listProcesses()[0];
    expect(record.restartCount).toBe(2);
    expect(supervisor.readLogs({ processId: 'flaky' }).filter((log) => log.stream === 'stderr').length).toBeGreaterThan(0);
    expect(supervisor.readLogs({ processId: 'flaky' }).some((log) => log.text.includes('restart limit'))).toBe(true);
  });

  it('cleans up exited process records', async () => {
    const root = createTempProject();
    tempRoots.push(root);
    const resolved = createResolved(root, [
      processFixture({
        id: 'done',
        command: nodeCommand('process.exit(0)'),
      }),
    ]);
    const supervisor = new ProjectProcessSupervisor({ shell: false });
    supervisors.push(supervisor);

    supervisor.startProject({ resolved });
    await waitUntil(() => supervisor.listProcesses()[0]?.status === 'exited');

    expect(supervisor.cleanupExited(0)).toBe(1);
    expect(supervisor.listProcesses()).toHaveLength(0);
  });

  it('redacts sensitive command material and creates Session V2 compatible PTY profiles', () => {
    const root = createTempProject();
    tempRoots.push(root);
    const resolved = createResolved(root, [
      processFixture({
        id: 'secret',
        command: 'node app.js --token super-secret API_KEY=abc123',
      }),
    ]);

    const profile = new ProjectPtySessionFactory().createProfile(resolved, {
      processId: 'secret',
      runId: 'run-2',
      requestedBy: 'tester',
    });

    expect(redactCommand('node app.js --token super-secret API_KEY=abc123')).toBe(
      'node app.js --token [REDACTED] API_KEY=[REDACTED]',
    );
    expect(profile).toEqual(expect.objectContaining({
      sessionId: 'project-pty-demo-secret',
      cwd: root,
      redactedCommand: 'node app.js --token [REDACTED] API_KEY=[REDACTED]',
      ownership: expect.objectContaining({
        kind: 'pty',
        ownerRef: 'project-pty:demo:secret:run:run-2',
      }),
    }));
  });
});
