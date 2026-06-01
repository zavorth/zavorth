import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebAppHostRouteService } from '../../../../../src/domain/surface/presentation/web-app/WebAppHostRouteService.js';
import { ZavorthExternalAgentGatewayService } from '../../../../../src/services/ZavorthExternalAgentGatewayService.js';

describe('WebAppHostRouteService external agent dashboard routes', () => {
  const now = () => new Date('2026-05-31T15:00:00.000Z');
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-external-agents-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('exposes registry, registration and invocation through governed host routes', async () => {
    const service = new WebAppHostRouteService();
    (service as any).externalAgentGateway = new ZavorthExternalAgentGatewayService({
      now,
      projectRoot: root,
      registryFile: path.join(root, 'profiles.json'),
      spawnSync: jest.fn().mockReturnValue({
        status: 0,
        stdout: 'external-route-ok',
        stderr: '',
        signal: null,
      }) as any,
    });
    const responses: Array<{ status: number; payload: any }> = [];
    const deps = {
      runtime: { webUserId: 'route-test' },
      readJsonBody: jest.fn(),
      writeJson: jest.fn((_res: unknown, payload: any, status: number) => {
        responses.push({ status, payload });
      }),
    } as any;

    await service.handleRequest(
      { method: 'GET' } as any,
      {} as any,
      new URL('http://zavorth.local/api/web/external-agents'),
      '/api/web/external-agents',
      deps,
    );

    deps.readJsonBody.mockResolvedValueOnce({
      id: 'route-cli',
      label: 'Route CLI',
      adapter: 'cli',
      command: process.execPath,
      args: ['-e', 'console.log("should-not-run-on-registration")'],
      enableLive: true,
      approveRegistration: true,
    });
    await service.handleRequest(
      { method: 'POST' } as any,
      {} as any,
      new URL('http://zavorth.local/api/web/external-agents/register'),
      '/api/web/external-agents/register',
      deps,
    );

    deps.readJsonBody.mockResolvedValueOnce({
      profileId: 'route-cli',
      prompt: 'route prompt',
    });
    await service.handleRequest(
      { method: 'POST' } as any,
      {} as any,
      new URL('http://zavorth.local/api/web/external-agents/invoke'),
      '/api/web/external-agents/invoke',
      deps,
    );

    deps.readJsonBody.mockResolvedValueOnce({
      profileId: 'route-cli',
      prompt: 'route prompt',
      approveExternalExecution: true,
    });
    await service.handleRequest(
      { method: 'POST' } as any,
      {} as any,
      new URL('http://zavorth.local/api/web/external-agents/invoke'),
      '/api/web/external-agents/invoke',
      deps,
    );

    expect(responses[0]).toEqual(expect.objectContaining({
      status: 200,
      payload: expect.objectContaining({
        ok: true,
        snapshot: expect.objectContaining({
          surface: 'external-agent-dashboard',
          summary: expect.objectContaining({ profiles: 0 }),
        }),
      }),
    }));
    expect(responses[1]).toEqual(expect.objectContaining({
      status: 200,
      payload: expect.objectContaining({
        ok: true,
        receipt: expect.objectContaining({ status: 'registered' }),
        snapshot: expect.objectContaining({
          summary: expect.objectContaining({ profiles: 1, liveEnabled: 1 }),
        }),
      }),
    }));
    expect(responses[2]).toEqual(expect.objectContaining({
      status: 202,
      payload: expect.objectContaining({
        ok: true,
        receipt: expect.objectContaining({
          status: 'approval-required',
          execution: expect.objectContaining({ adapterInvoked: false }),
        }),
      }),
    }));
    expect(responses[3]).toEqual(expect.objectContaining({
      status: 200,
      payload: expect.objectContaining({
        ok: true,
        receipt: expect.objectContaining({
          status: 'completed',
          execution: expect.objectContaining({
            adapterInvoked: true,
            liveExecutionPerformed: true,
          }),
        }),
        snapshot: expect.objectContaining({
          latestReceipt: expect.objectContaining({ status: 'completed' }),
        }),
      }),
    }));
  });
});
