import { RuntimeRemoteAccessService } from '../../src/runtime/access/RuntimeRemoteAccessService.js';

describe('RuntimeRemoteAccessService', () => {
  it('prefers the official path when the remote app is already validated', async () => {
    const service = new RuntimeRemoteAccessService({
      officialAccessService: {
        prepare: jest.fn().mockResolvedValue({
          nextSteps: [],
          manifest: {
            remote: {
              appUrl: 'https://zavorth.example.com/app',
              baseUrl: 'https://zavorth.example.com',
            },
            commands: {
              remote: 'npm run ops:remote:official',
            },
          },
          remote: {
            ready: true,
            appUrl: 'https://zavorth.example.com/app',
            appProbe: { ok: true, targetUrl: 'https://zavorth.example.com/app', statusCode: 200, error: null },
            authProbe: {
              ok: true,
              targetUrl: 'https://zavorth.example.com/api/auth/validate',
              statusCode: 200,
              error: null,
            },
          },
        }),
      } as any,
      localCloudflareRolloutService: {
        inspect: jest.fn().mockReturnValue({
          readyForPlanB: false,
          summary: 'pending',
          steps: [],
        }),
      } as any,
      oracleCloudflareRolloutService: {
        inspect: jest.fn().mockReturnValue({
          readyForRemoteRollout: false,
          summary: 'pending',
          steps: [],
        }),
      } as any,
      platform: 'win32',
    });

    const report = await service.inspect();

    expect(report.recommendedPathId).toBe('official');
    expect(report.summary).toContain('Acesso remoto oficial ready');
    expect(report.paths.find((path) => path.id === 'official')?.status).toBe('ready');
  });

  it('recommends the Windows local + Cloudflare path when official remote is still pending', async () => {
    const service = new RuntimeRemoteAccessService({
      officialAccessService: {
        prepare: jest.fn().mockResolvedValue({
          nextSteps: ['Validate the public URL and web token with npm run ops:remote:official.'],
          manifest: {
            remote: {
              appUrl: 'https://zavorth.example.com/app',
              baseUrl: 'https://zavorth.example.com',
            },
            commands: {
              remote: 'npm run ops:remote:official',
            },
          },
          remote: {
            ready: false,
            appUrl: 'https://zavorth.example.com/app',
            appProbe: { ok: false, targetUrl: 'https://zavorth.example.com/app', statusCode: null, error: 'timeout' },
            authProbe: { ok: false, targetUrl: 'https://zavorth.example.com/api/auth/validate', statusCode: null, error: 'timeout' },
          },
        }),
      } as any,
      localCloudflareRolloutService: {
        inspect: jest.fn().mockReturnValue({
          readyForPlanB: true,
          summary: 'Plan B local com Cloudflare e Gemini/Gemma ready para rollout.',
          steps: [
            {
              id: 'validate-runtime',
              title: 'Validate fallback path',
              status: 'pending',
              detail: 'After configuring Tunnel and Gateway, validate the local supervised runtime.',
              command: 'npm run build && npm run ops:access && npm run ops:local-cloudflare',
            },
          ],
        }),
      } as any,
      oracleCloudflareRolloutService: {
        inspect: jest.fn().mockReturnValue({
          readyForRemoteRollout: false,
          summary: 'Rollout Oracle ainda pendente.',
          steps: [],
        }),
      } as any,
      platform: 'win32',
    });

    const report = await service.inspect();

    expect(report.recommendedPathId).toBe('windows-local-cloudflare');
    expect(report.recommendedPathReason).toContain('Cloudflare');
    expect(report.nextSteps).toEqual(
        expect.arrayContaining([
        expect.stringContaining('npm run ops:remote:official'),
      ]),
    );
    expect(report.paths.find((path) => path.id === 'windows-local-cloudflare')?.status).toBe('rollout-ready');
  });
});


