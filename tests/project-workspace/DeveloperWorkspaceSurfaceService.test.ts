import * as fs from 'fs';
import { resolve } from 'node:path';
import * as os from 'os';
import * as path from 'path';
import type { ProjectManifestProcess, ResolvedProjectManifest } from '../../src/project-workspace/index.js';
import { ProjectProcessSupervisor } from '../../src/project-workspace/index.js';
import {
  DEVELOPER_WORKSPACE_SURFACE_CONTRACT_VERSION,
  DeveloperWorkspaceSurfaceService,
} from '../../src/domain/surface/application/developer-workspace/index.js';

function createTempProject(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-developer-workspace-'));
}

function nodeCommand(source: string): string {
  return `${JSON.stringify(process.execPath)} -e ${JSON.stringify(source)}`;
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

function createResolved(root: string, processes: ProjectManifestProcess[]): ResolvedProjectManifest {
  return {
    manifestPath: path.join(root, 'zavorth.yml'),
    manifestDir: root,
    projectRoot: root,
    manifest: {
      version: 1,
      project: {
        name: 'demo-workspace',
        root: '.',
        description: 'Demo Developer Workspace.',
      },
      processes,
      mcp: {
        servers: [],
      },
      agents: [
        {
          id: 'maintainer',
          role: 'project-maintainer',
          watches: processes.map((entry) => entry.id),
          mode: 'suggest',
        },
      ],
      hooks: [
        {
          id: 'app-error',
          when: {
            process: processes[0]?.id || 'app',
            pattern: 'Error',
          },
          action: {
            type: 'agent-run',
            mode: 'suggest',
            prompt: 'Diagnose the error.',
          },
        },
      ],
      policy: {
        defaultMode: 'suggest',
        requireApprovalFor: ['process.kill', 'filesystem.write'],
      },
    },
    processResolutions: processes.map((entry) => ({
      id: entry.id,
      cwd: entry.cwd,
      resolvedCwd: resolve(root, entry.cwd),
      outsideProject: false,
    })),
    sideEffects: 'none',
  };
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

describe('DeveloperWorkspaceSurfaceService', () => {
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

  it('projects the manifest and process supervisor into an official surface snapshot', () => {
    const root = createTempProject();
    tempRoots.push(root);
    const resolved = createResolved(root, [
      processFixture({
        id: 'app',
        command: 'npm run dev --token secret-value',
        restart: 'on-failure',
        health: { type: 'http', url: 'http://127.0.0.1:3000' },
      }),
    ]);
    const service = new DeveloperWorkspaceSurfaceService();

    const snapshot = service.buildSnapshot({ resolved });

    expect(snapshot).toEqual(expect.objectContaining({
      ok: true,
      contractVersion: DEVELOPER_WORKSPACE_SURFACE_CONTRACT_VERSION,
      source: 'ProjectWorkspaceService+ProjectProcessSupervisor',
      project: expect.objectContaining({
        name: 'demo-workspace',
      }),
      summary: expect.objectContaining({
        processes: 1,
        hooks: 1,
        agents: 1,
      }),
    }));
    expect(snapshot.processes[0]).toEqual(expect.objectContaining({
      id: 'app',
      status: 'idle',
      command: 'npm run dev --token [REDACTED]',
      ownerRef: null,
    }));
    expect(snapshot.ptyProfiles[0]).toEqual(expect.objectContaining({
      processId: 'app',
      command: 'npm run dev --token [REDACTED]',
      inputPolicy: 'operator-only',
    }));
    expect(snapshot.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'start',
        requiresApproval: true,
      }),
      expect.objectContaining({
        id: 'stop',
        approvalScope: 'process.kill',
      }),
    ]));
  });

  it('requires approval before process actions and keeps the snapshot read-only', () => {
    const root = createTempProject();
    tempRoots.push(root);
    const resolved = createResolved(root, [
      processFixture({
        id: 'app',
        command: nodeCommand('console.log("hello")'),
      }),
    ]);
    const supervisor = new ProjectProcessSupervisor({ shell: false });
    supervisors.push(supervisor);
    const service = new DeveloperWorkspaceSurfaceService({ processSupervisor: supervisor });

    const result = service.executeAction({
      resolved,
      action: 'start',
      processId: 'app',
      requestedBy: 'test',
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      httpStatus: 403,
      status: 'approval_required',
      message: expect.stringContaining('requires approval'),
    }));
    expect(supervisor.listProcesses()).toHaveLength(0);
  });

  it('executes an approved start and exposes live process logs through the surface', async () => {
    const root = createTempProject();
    tempRoots.push(root);
    const resolved = createResolved(root, [
      processFixture({
        id: 'app',
        command: nodeCommand('console.log("workspace online")'),
      }),
    ]);
    const supervisor = new ProjectProcessSupervisor({ shell: false });
    supervisors.push(supervisor);
    const service = new DeveloperWorkspaceSurfaceService({ processSupervisor: supervisor });

    const result = service.executeAction({
      resolved,
      action: 'start',
      processId: 'app',
      approval: {
        approved: true,
        approvalId: 'approval-1',
        approvedBy: 'operator@test',
      },
    });

    expect(result.ok).toBe(true);
    await waitUntil(() => service.buildSnapshot({ resolved }).processes[0].logs.some((log) => (
      log.stream === 'stdout' && log.text.includes('workspace online')
    )));
    await waitUntil(() => service.buildSnapshot({ resolved }).processes[0].status === 'exited');
    const snapshot = service.buildSnapshot({ resolved });
    expect(snapshot.processes[0]).toEqual(expect.objectContaining({
      id: 'app',
      ownerRef: 'project:demo-workspace:app',
    }));
    expect(snapshot.processes[0].logs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        stream: 'stdout',
        text: expect.stringContaining('workspace online'),
      }),
    ]));
  });

  it('projects log watch hook events into the Developer Workspace surface', async () => {
    const root = createTempProject();
    tempRoots.push(root);
    const resolved = createResolved(root, [
      processFixture({
        id: 'app',
        command: nodeCommand('console.error("Error: workspace failed")'),
      }),
    ]);
    const supervisor = new ProjectProcessSupervisor({ shell: false });
    supervisors.push(supervisor);
    const service = new DeveloperWorkspaceSurfaceService({ processSupervisor: supervisor });

    const result = service.executeAction({
      resolved,
      action: 'start',
      processId: 'app',
      approval: {
        approved: true,
        approvalId: 'approval-2',
        approvedBy: 'operator@test',
      },
    });

    expect(result.ok).toBe(true);
    await waitUntil(() => service.buildSnapshot({ resolved }).logWatch.summary.events > 0);
    await waitUntil(() => service.buildSnapshot({ resolved }).processes[0].status === 'exited');
    const snapshot = service.buildSnapshot({ resolved });

    expect(snapshot.summary.logWatchEvents).toBe(1);
    expect(snapshot.logWatch.events[0]).toEqual(expect.objectContaining({
      hookId: 'app-error',
      processId: 'app',
      status: 'agent_run_unavailable',
      category: 'test_failure',
    }));
  });
});
