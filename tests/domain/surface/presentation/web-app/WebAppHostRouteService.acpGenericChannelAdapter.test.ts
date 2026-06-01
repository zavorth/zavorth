import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebAppHostRouteService } from '../../../../../src/domain/surface/presentation/web-app/WebAppHostRouteService.js';
import { AcpGenericChannelAdapterService } from '../../../../../src/services/AcpGenericChannelAdapterService.js';

describe('WebAppHostRouteService ACP generic channel adapter routes', () => {
  const now = () => new Date('2026-05-31T12:30:00.000Z');
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-acp-generic-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('exposes status and frame ingestion through real web host routes', async () => {
    const service = new WebAppHostRouteService();
    (service as any).acpGenericChannelAdapter = new AcpGenericChannelAdapterService({
      now,
      projectRoot: root,
    });
    const responses: Array<{ status: number; payload: any }> = [];
    const deps = {
      runtime: { webUserId: 'route-test' },
      readJsonBody: jest.fn(async () => ({
        kind: 'tool_request',
        id: 'route-tool-frame',
        idempotencyKey: 'route-tool-key',
        sessionId: 'route-session',
        tool: { name: 'Bash' },
        payload: {
          text: 'run shell',
          requestedTools: ['Bash'],
        },
      })),
      writeJson: jest.fn((_res: unknown, payload: any, status: number) => {
        responses.push({ status, payload });
      }),
    } as any;

    await service.handleRequest(
      { method: 'GET' } as any,
      {} as any,
      new URL('http://zavorth.local/api/web/acp-generic-channel-adapter'),
      '/api/web/acp-generic-channel-adapter',
      deps,
    );
    await service.handleRequest(
      { method: 'POST' } as any,
      {} as any,
      new URL('http://zavorth.local/api/web/acp-generic-channel-adapter'),
      '/api/web/acp-generic-channel-adapter',
      deps,
    );

    expect(responses[0]).toEqual(expect.objectContaining({
      status: 200,
      payload: expect.objectContaining({
        ok: true,
        snapshot: expect.objectContaining({
          surface: 'acp-generic-channel-adapter',
          adapter: expect.objectContaining({
            conceptualDependency: 'zavorth-native',
          }),
        }),
      }),
    }));
    expect(responses[1]).toEqual(expect.objectContaining({
      status: 202,
      payload: expect.objectContaining({
        ok: true,
        receipt: expect.objectContaining({
          status: 'approval_required',
          surface: 'acp-generic-channel-adapter',
          approvals: expect.arrayContaining([
            expect.objectContaining({
              title: 'ACP tool request: Bash',
            }),
          ]),
        }),
      }),
    }));
  });
});
