import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { config } from '../../../../../src/config/index.js';
import { WebAppHostRouteService } from '../../../../../src/domain/surface/presentation/web-app/WebAppHostRouteService.js';

describe('WebAppHostRouteService disk mutation gate route', () => {
  const originalWorkspaceRoot = config.workspaceRoot;
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-disk-gate-'));
    config.workspaceRoot = os.tmpdir();
  });

  afterEach(() => {
    config.workspaceRoot = originalWorkspaceRoot;
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('previews and applies disk mutations through the web host route', async () => {
    const service = new WebAppHostRouteService();
    let requestBody: Record<string, unknown> = {};
    let response: { status: number; payload: any } | null = null;
    const deps = {
      runtime: {
        webUserId: 'route-test',
      },
      readJsonBody: jest.fn(async () => requestBody),
      writeJson: jest.fn((_res: unknown, payload: any, status: number) => {
        response = { status, payload };
      }),
    } as any;

    requestBody = {
      workspaceRoot,
      operations: [
        {
          kind: 'write_file',
          path: 'from-route.txt',
          content: 'hello route',
        },
      ],
    };

    await service.handleRequest(
      { method: 'POST' } as any,
      {} as any,
      new URL('http://zavorth.local/api/web/disk-mutation-gate'),
      '/api/web/disk-mutation-gate',
      deps,
    );

    expect(response?.status).toBe(200);
    const preview = response?.payload.preview;
    expect(preview.status).toBe('preview_ready');
    expect(fs.existsSync(path.join(workspaceRoot, 'from-route.txt'))).toBe(false);

    requestBody = {
      workspaceRoot,
      action: 'apply',
      previewId: preview.previewId,
      approvalPhrase: preview.approval.phrase,
    };

    await service.handleRequest(
      { method: 'POST' } as any,
      {} as any,
      new URL('http://zavorth.local/api/web/disk-mutation-gate'),
      '/api/web/disk-mutation-gate',
      deps,
    );

    expect(response?.status).toBe(200);
    expect(response?.payload.result.status).toBe('applied');
    expect(fs.readFileSync(path.join(workspaceRoot, 'from-route.txt'), 'utf8')).toBe('hello route');
  });
});
