import { RuntimeOfficialAccessService } from '../../src/runtime/access/RuntimeOfficialAccessService.js';

describe('RuntimeOfficialAccessService', () => {
  it('can auto-trust the local host and validate the official remote access path', async () => {
    const initialReadiness = {
      checkedAt: '2026-04-06T10:00:00.000Z',
      runtime: {
        hostSupervisor: {
          active: true,
          pid: 100,
          owner: 'dev',
          startedAt: '2026-04-06T09:59:00.000Z',
          alive: true,
        },
        hostAuthorized: false,
      },
      local: {
        ready: true,
        baseUrl: 'http://127.0.0.1:33333',
        appUrl: 'http://127.0.0.1:33333/dashboard',
      },
      remote: {
        ready: false,
        baseUrl: 'https://zavorth.example.com',
        appUrl: 'https://zavorth.example.com/zavorthControl',
      },
      nextSteps: [],
      summary: 'Zavorth pronto para uso local.',
    } as any;
    const refreshedReadiness = {
      ...initialReadiness,
      runtime: {
        ...initialReadiness.runtime,
        hostAuthorized: true,
      },
      remote: {
        ready: true,
        baseUrl: 'https://zavorth.example.com',
        appUrl: 'https://zavorth.example.com/zavorthControl',
      },
      summary: 'Zavorth pronto para uso local e remoto.',
    } as any;
    const initialManifest = {
      local: {
        ready: true,
        appUrl: 'http://127.0.0.1:33333/dashboard',
        baseUrl: 'http://127.0.0.1:33333',
      },
      remote: {
        ready: false,
        baseUrl: 'https://zavorth.example.com',
        appUrl: 'https://zavorth.example.com/zavorthControl',
      },
      auth: {
        authorizedHost: false,
      },
      commands: {
        start: 'npm run ops:start',
        remote: 'npm run ops:remote:official',
      },
      summary: 'Zavorth pronto para uso local.',
    } as any;
    const refreshedManifest = {
      ...initialManifest,
      remote: {
        ready: true,
        baseUrl: 'https://zavorth.example.com',
        appUrl: 'https://zavorth.example.com/zavorthControl',
      },
      auth: {
        authorizedHost: true,
      },
      summary: 'Zavorth pronto para uso local e remoto.',
    } as any;

    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

    const service = new RuntimeOfficialAccessService({
      installJourneyService: {
        run: jest.fn().mockResolvedValue({
          summary: 'journey ok',
          manifest: initialManifest,
          startup: {
            readiness: initialReadiness,
          },
          bootstrapRepair: {
            final: {
              supervisedRuntime: {
                accessReadiness: initialReadiness,
              },
            },
          },
        }),
      } as any,
      accessReadinessService: {
        inspectLive: jest.fn().mockResolvedValue(refreshedReadiness),
      } as any,
      accessManifestService: {
        buildManifestFromReadiness: jest.fn().mockReturnValue(refreshedManifest),
      } as any,
      fetchImpl: fetchImpl as any,
      webAuthToken: 'test-web-token',
    });

    const report = await service.prepare({
      autoTrustLocal: true,
    });

    expect(report.local.trust).toEqual(
      expect.objectContaining({
        attempted: true,
        applied: true,
        statusCode: 200,
      }),
    );
    expect(report.remote.ready).toBe(true);
    expect(report.remote.appProbe).toEqual(
      expect.objectContaining({
        ok: true,
        targetUrl: 'https://zavorth.example.com/zavorthControl',
      }),
    );
    expect(report.remote.authProbe).toEqual(
      expect.objectContaining({
        ok: true,
        targetUrl: 'https://zavorth.example.com/api/auth/validate',
      }),
    );
    expect(report.remote.issues).toEqual([]);
    expect(report.summary).toContain('caminho oficial');
    expect(report.tokenSource).toBe('env');
    expect(report.nextSteps[0] || '').not.toContain('ops:remote:official');
  });

  it('keeps the next steps explicit when remote access is not configured yet', async () => {
    const readiness = {
      checkedAt: '2026-04-06T10:00:00.000Z',
      runtime: {
        hostAuthorized: false,
      },
      local: {
        ready: false,
        baseUrl: 'http://127.0.0.1:33333',
        appUrl: 'http://127.0.0.1:33333/dashboard',
      },
      remote: {
        ready: false,
        baseUrl: null,
        appUrl: null,
      },
      nextSteps: [],
      summary: 'Bootstrap ainda pendente.',
    } as any;
    const manifest = {
      local: {
        ready: false,
        appUrl: 'http://127.0.0.1:33333/dashboard',
      },
      remote: {
        ready: false,
        baseUrl: null,
        appUrl: null,
      },
      auth: {
        authorizedHost: false,
      },
      commands: {
        start: 'npm run ops:start',
        remote: 'npm run ops:remote:official',
      },
      summary: 'Bootstrap ainda pendente.',
    } as any;

    const service = new RuntimeOfficialAccessService({
      installJourneyService: {
        run: jest.fn().mockResolvedValue({
          summary: 'journey pending',
          manifest,
          startup: {
            readiness,
          },
          bootstrapRepair: {
            final: {
              supervisedRuntime: {
                accessReadiness: readiness,
              },
            },
          },
        }),
      } as any,
      accessReadinessService: {
        inspectLive: jest.fn().mockResolvedValue(readiness),
      } as any,
      accessManifestService: {
        buildManifestFromReadiness: jest.fn().mockReturnValue(manifest),
      } as any,
      fetchImpl: jest.fn() as any,
      webAuthToken: '',
      webAuthTokenFile: '',
    });

    const report = await service.prepare();

    expect(report.remote.ready).toBe(false);
    expect(report.remote.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ZAVORTH_WEB_AUTH_TOKEN'),
        expect.stringContaining('ZAVORTH_PUBLIC_BASE_URL'),
      ]),
    );
    expect(report.tokenSource).toBe('missing');
    expect(report.nextSteps).toEqual(
      expect.arrayContaining([
        expect.stringContaining('zavorth go'),
        expect.stringContaining('/hostauth trust'),
        expect.stringContaining('ZAVORTH_WEB_AUTH_TOKEN'),
        expect.stringContaining('ZAVORTH_PUBLIC_BASE_URL'),
      ]),
    );
    expect(report.nextSteps.join('\n')).not.toContain('npm run ops:');
  });

  it('uses the one-command remote path as the main follow-up when a public URL exists but is not ready', async () => {
    const readiness = {
      checkedAt: '2026-04-06T10:00:00.000Z',
      runtime: {
        hostAuthorized: true,
      },
      local: {
        ready: true,
        baseUrl: 'http://127.0.0.1:33333',
        appUrl: 'http://127.0.0.1:33333/dashboard',
      },
      remote: {
        ready: false,
        baseUrl: 'https://zavorth.example.com',
        appUrl: 'https://zavorth.example.com/zavorthControl',
      },
      nextSteps: [],
      summary: 'Zavorth pronto para uso local.',
    } as any;
    const manifest = {
      local: {
        ready: true,
        appUrl: 'http://127.0.0.1:33333/dashboard',
      },
      remote: {
        ready: false,
        baseUrl: 'https://zavorth.example.com',
        appUrl: 'https://zavorth.example.com/zavorthControl',
        requiresHttps: false,
      },
      auth: {
        authorizedHost: true,
      },
      commands: {
        start: 'npm run ops:start',
        remote: 'npm run ops:remote:official',
        remoteGo: 'npm run ops:remote:go',
      },
      summary: 'Zavorth pronto para uso local.',
    } as any;

    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

    const service = new RuntimeOfficialAccessService({
      installJourneyService: {
        run: jest.fn().mockResolvedValue({
          summary: 'journey ok',
          manifest,
          startup: {
            readiness,
          },
          bootstrapRepair: {
            final: {
              supervisedRuntime: {
                accessReadiness: readiness,
              },
            },
          },
        }),
      } as any,
      accessReadinessService: {
        inspectLive: jest.fn().mockResolvedValue(readiness),
      } as any,
      accessManifestService: {
        buildManifestFromReadiness: jest.fn().mockReturnValue(manifest),
      } as any,
      fetchImpl: fetchImpl as any,
      webAuthToken: 'test-web-token',
    });

    const report = await service.prepare();

    expect(report.nextSteps).toEqual(
      expect.arrayContaining([
        expect.stringContaining('zavorth go'),
      ]),
    );
    expect(report.nextSteps.join('\n')).not.toContain('npm run ops:remote:go');
  });

  it('explains probe failures when the public app or auth endpoint is not reachable', async () => {
    const readiness = {
      checkedAt: '2026-04-06T10:00:00.000Z',
      runtime: {
        hostAuthorized: true,
      },
      local: {
        ready: true,
        baseUrl: 'http://127.0.0.1:33333',
        appUrl: 'http://127.0.0.1:33333/dashboard',
      },
      remote: {
        ready: false,
        baseUrl: 'https://zavorth.example.com',
        appUrl: 'https://zavorth.example.com/zavorthControl',
      },
      nextSteps: [],
      summary: 'Zavorth pronto para uso local.',
    } as any;
    const manifest = {
      local: {
        ready: true,
        appUrl: 'http://127.0.0.1:33333/dashboard',
        baseUrl: 'http://127.0.0.1:33333',
      },
      remote: {
        ready: false,
        baseUrl: 'https://zavorth.example.com',
        appUrl: 'https://zavorth.example.com/zavorthControl',
        requiresHttps: false,
      },
      auth: {
        authorizedHost: true,
      },
      commands: {
        start: 'npm run ops:start',
        remote: 'npm run ops:remote:official',
      },
      summary: 'Zavorth pronto para uso local.',
    } as any;

    const fetchImpl = jest
      .fn()
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

    const service = new RuntimeOfficialAccessService({
      installJourneyService: {
        run: jest.fn().mockResolvedValue({
          summary: 'journey ok',
          manifest,
          startup: {
            readiness,
          },
          bootstrapRepair: {
            final: {
              supervisedRuntime: {
                accessReadiness: readiness,
              },
            },
          },
        }),
      } as any,
      accessReadinessService: {
        inspectLive: jest.fn().mockResolvedValue(readiness),
      } as any,
      accessManifestService: {
        buildManifestFromReadiness: jest.fn().mockReturnValue(manifest),
      } as any,
      fetchImpl: fetchImpl as any,
      webAuthToken: 'test-web-token',
    });

    const report = await service.prepare();

    expect(report.remote.ready).toBe(false);
    expect(report.remote.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Home remoto falhou'),
        expect.stringContaining('/api/auth/validate'),
      ]),
    );
  });

  it('treats remote probe failures as inconclusive when readiness already validated the remote app', async () => {
    const readiness = {
      checkedAt: '2026-04-06T10:00:00.000Z',
      runtime: {
        hostAuthorized: true,
      },
      local: {
        ready: true,
        baseUrl: 'http://127.0.0.1:33333',
        appUrl: 'http://127.0.0.1:33333/dashboard',
      },
      remote: {
        ready: true,
        baseUrl: 'https://zavorth.example.com',
        appUrl: 'https://zavorth.example.com/zavorthControl',
      },
      nextSteps: [],
      summary: 'Zavorth pronto para uso local e remoto.',
    } as any;
    const manifest = {
      local: {
        ready: true,
        appUrl: 'http://127.0.0.1:33333/dashboard',
        baseUrl: 'http://127.0.0.1:33333',
      },
      remote: {
        ready: true,
        baseUrl: 'https://zavorth.example.com',
        appUrl: 'https://zavorth.example.com/zavorthControl',
        requiresHttps: false,
      },
      auth: {
        authorizedHost: true,
      },
      commands: {
        start: 'npm run ops:start',
        remote: 'npm run ops:remote:official',
        remoteGo: 'npm run ops:remote:go',
      },
      summary: 'Zavorth pronto para uso local e remoto.',
    } as any;

    const fetchImpl = jest
      .fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockRejectedValueOnce(new Error('fetch failed'));

    const service = new RuntimeOfficialAccessService({
      installJourneyService: {
        run: jest.fn().mockResolvedValue({
          summary: 'journey ok',
          manifest,
          startup: {
            readiness,
          },
          bootstrapRepair: {
            final: {
              supervisedRuntime: {
                accessReadiness: readiness,
              },
            },
          },
        }),
      } as any,
      accessReadinessService: {
        inspectLive: jest.fn().mockResolvedValue(readiness),
      } as any,
      accessManifestService: {
        buildManifestFromReadiness: jest.fn().mockReturnValue(manifest),
      } as any,
      fetchImpl: fetchImpl as any,
      webAuthToken: 'test-web-token',
    });

    const report = await service.prepare();

    expect(report.remote.ready).toBe(true);
    expect(report.remote.issues).toEqual([]);
    expect(report.summary).toContain('local e remoto');
    expect(report.nextSteps[0] || '').not.toContain('ops:remote:go');
  });
});


