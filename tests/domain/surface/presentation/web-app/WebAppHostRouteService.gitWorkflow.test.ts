import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { config } from '../../../../../src/config/index.js';
import { WebAppHostRouteService } from '../../../../../src/domain/surface/presentation/web-app/WebAppHostRouteService.js';
import { ZavorthGitWorkflowService, type ZavorthGitWorkflowCommandRunner } from '../../../../../src/services/ZavorthGitWorkflowService.js';

describe('WebAppHostRouteService git workflow routes', () => {
  const originalWorkspaceRoot = config.workspaceRoot;
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-git-workflow-'));
    config.workspaceRoot = os.tmpdir();
  });

  afterEach(() => {
    config.workspaceRoot = originalWorkspaceRoot;
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('exposes /api/web/git/branch as a real governed workflow preview', async () => {
    const service = new WebAppHostRouteService();
    const runner: ZavorthGitWorkflowCommandRunner = async (command, args) => {
      const text = `${command} ${args.join(' ')}`;
      if (text === 'git branch --show-current') return { command, args, stdout: 'main\n', stderr: '', exitCode: 0 };
      if (text === 'git status --short --branch') return { command, args, stdout: '## main\n M src/a.ts\n', stderr: '', exitCode: 0 };
      return { command, args, stdout: '', stderr: `Unexpected ${text}`, exitCode: 1 };
    };
    (service as any).gitWorkflow = new ZavorthGitWorkflowService({ runner });

    let response: { status: number; payload: any } | null = null;
    const deps = {
      runtime: { webUserId: 'route-test' },
      readJsonBody: jest.fn(async () => ({
        workspaceRoot,
        args: 'feature/web-route',
      })),
      writeJson: jest.fn((_res: unknown, payload: any, status: number) => {
        response = { status, payload };
      }),
    } as any;

    await service.handleRequest(
      { method: 'POST' } as any,
      {} as any,
      new URL('http://zavorth.local/api/web/git/branch'),
      '/api/web/git/branch',
      deps,
    );

    expect(response?.status).toBe(200);
    expect(response?.payload.snapshot).toEqual(expect.objectContaining({
      source: 'ZavorthGitWorkflowService',
      action: 'branch',
      status: 'preview',
      branch: 'main',
    }));
    expect(response?.payload.snapshot.plannedCommands[0]).toEqual({
      command: 'git',
      args: ['switch', '-c', 'feature/web-route'],
      mutates: true,
    });
  });

  it('exposes /api/web/review through the Agent Review service', async () => {
    const service = new WebAppHostRouteService();
    (service as any).agentReview = {
      run: jest.fn(async () => ({
        surface: 'zavorth-agent-review',
        status: 'completed',
        target: 'workspace-diff',
        review: { reviewId: 'review-route-1', status: 'completed' },
        summary: 'route review completed',
      })),
    };

    let response: { status: number; payload: any } | null = null;
    const deps = {
      runtime: { webUserId: 'route-test' },
      readJsonBody: jest.fn(async () => ({
        workspaceRoot,
        args: 'review current branch',
      })),
      writeJson: jest.fn((_res: unknown, payload: any, status: number) => {
        response = { status, payload };
      }),
    } as any;

    await service.handleRequest(
      { method: 'POST' } as any,
      {} as any,
      new URL('http://zavorth.local/api/web/review'),
      '/api/web/review',
      deps,
    );

    expect(response?.status).toBe(200);
    expect(response?.payload.snapshot).toEqual(expect.objectContaining({
      surface: 'zavorth-agent-review',
      status: 'completed',
    }));
    expect((service as any).agentReview.run).toHaveBeenCalledWith(expect.objectContaining({
      objective: 'review current branch',
      workspace: workspaceRoot,
      userId: 'route-test',
    }));
  });
});
