import fs from 'fs';
import { RuntimeOfficialRemoteAccessService } from '../../src/runtime/access/RuntimeOfficialRemoteAccessService.js';

describe('RuntimeOfficialRemoteAccessService', () => {
  it('prefers the most advanced rollout when remote access is not ready', async () => {
    const service = new RuntimeOfficialRemoteAccessService({
      officialAccessService: {
        prepare: jest.fn().mockResolvedValue({
          remote: {
            ready: false,
            configured: true,
            appUrl: 'https://zavorth.example.com/dashboard',
            issues: ['O probe do /dashboard remoto falhou.'],
          },
  nextSteps: ['Valide a URL publica e o token web com npm run ops:remote:official.'],
        }),
      } as any,
      localCloudflareRolloutService: {
        inspect: jest.fn().mockReturnValue({
          readyForPlanB: true,
          summary: 'Plano B local com Cloudflare e Gemini/Gemma pronto para rollout.',
          helpers: {
            guide: 'C:/repo/docs/runtime-readiness.md',
          },
          steps: [
            { id: 'launcher', title: 'Launcher', status: 'done', detail: 'ok', command: 'cmd-a' },
            { id: 'startup', title: 'Startup', status: 'done', detail: 'ok', command: 'cmd-b' },
          ],
        }),
      } as any,
      oracleCloudflareRolloutService: {
        inspect: jest.fn().mockReturnValue({
          readyForRemoteRollout: false,
          summary: 'Rollout Oracle ainda pendente.',
          templates: {
            oracleSystemd: 'C:/repo/config/deploy/zavorth-oracle.service.example',
          },
          steps: [
            { id: 'oracle', title: 'Oracle', status: 'done', detail: 'ok', command: 'cmd-c' },
            { id: 'cloudflare', title: 'Cloudflare', status: 'pending', detail: 'faltando hostname', command: 'cmd-d' },
          ],
        }),
      } as any,
      existsSync: jest.fn(() => false),
      readFileSync: jest.fn(),
    });

    const report = await service.prepare();

    expect(report.rollout.recommendedId).toBe('local-cloudflare');
    expect(report.summary).toContain('melhor caminho agora');
    expect(report.nextSteps).toEqual(
      expect.arrayContaining([
        expect.stringContaining('npm run ops:remote:go'),
        expect.stringContaining('npm run ops:local-cloudflare'),
        expect.stringContaining('35-windows-cloudflare-gemma.md'),
      ]),
    );
  });

  it('keeps the remote report clean when the official path is already ready', async () => {
    const service = new RuntimeOfficialRemoteAccessService({
      officialAccessService: {
        prepare: jest.fn().mockResolvedValue({
          remote: {
            ready: true,
            configured: true,
            appUrl: 'https://zavorth.example.com/dashboard',
            issues: [],
          },
          nextSteps: ['Abra o app oficial.'],
        }),
      } as any,
      localCloudflareRolloutService: {
        inspect: jest.fn().mockReturnValue({
          readyForPlanB: false,
          summary: 'Plano B local pendente.',
          helpers: {
            guide: 'C:/repo/docs/runtime-readiness.md',
          },
          steps: [],
        }),
      } as any,
      oracleCloudflareRolloutService: {
        inspect: jest.fn().mockReturnValue({
          readyForRemoteRollout: false,
          summary: 'Oracle pendente.',
          templates: {
            oracleSystemd: 'C:/repo/config/deploy/zavorth-oracle.service.example',
          },
          steps: [],
        }),
      } as any,
    });

    const report = await service.prepare();

    expect(report.remote.ready).toBe(true);
    expect(report.rollout.recommendedId).toBeNull();
    expect(report.summary).toContain('pronto');
  });

  it('persists the selected provider when applying the guided remote rollout', async () => {
    let persisted = '';
    const service = new RuntimeOfficialRemoteAccessService({
      officialAccessService: {
        prepare: jest.fn().mockResolvedValue({
          manifest: {
            remote: {
              baseUrl: 'https://zavorth.example.com',
              appUrl: 'https://zavorth.example.com/dashboard',
            },
          },
          remote: {
            ready: false,
            configured: true,
            appUrl: 'https://zavorth.example.com/dashboard',
            issues: ['Probe remoto pendente.'],
          },
    nextSteps: ['Validar a URL publica e o token web com npm run ops:remote:official.'],
        }),
      } as any,
      localCloudflareRolloutService: {
        inspect: jest.fn().mockReturnValue({
          readyForPlanB: true,
          summary: 'Plano B local com Cloudflare e Gemini/Gemma pronto para rollout.',
          helpers: {
            guide: 'C:/repo/docs/runtime-readiness.md',
          },
          steps: [
            { id: 'launcher', title: 'Launcher', status: 'done', detail: 'ok', command: 'cmd-a' },
          ],
        }),
      } as any,
      oracleCloudflareRolloutService: {
        inspect: jest.fn().mockReturnValue({
          readyForRemoteRollout: false,
          summary: 'Rollout Oracle ainda pendente.',
          templates: {
            oracleSystemd: 'C:/repo/config/deploy/zavorth-oracle.service.example',
          },
          steps: [],
        }),
      } as any,
      stateFilePath: 'C:/repo/data/runtime/official-remote-access.json',
      existsSync: jest.fn(() => false),
      readFileSync: jest.fn(),
      mkdirSync: jest.fn(),
      writeFileSync: jest.fn((target: fs.PathOrFileDescriptor, content: string | NodeJS.ArrayBufferView) => {
        persisted = String(content);
      }) as any,
    });

    const report = await service.apply({ provider: 'local-cloudflare' });

    expect(report.rollout.activeId).toBe('local-cloudflare');
    expect(report.state.provider).toBe('local-cloudflare');
    expect(report.state.lastAction).toBe('apply');
    expect(persisted).toContain('"provider": "local-cloudflare"');
  });

  it('can close the guided remote path in one action', async () => {
    let persisted = '';
    const service = new RuntimeOfficialRemoteAccessService({
      officialAccessService: {
        prepare: jest.fn().mockResolvedValue({
          manifest: {
            commands: {
              remoteGo: 'npm run ops:remote:go',
            },
            remote: {
              baseUrl: 'https://zavorth.example.com',
              appUrl: 'https://zavorth.example.com/dashboard',
            },
          },
          remote: {
            ready: false,
            configured: true,
            appUrl: 'https://zavorth.example.com/dashboard',
            issues: ['Probe remoto pendente.'],
          },
          nextSteps: ['Feche o remoto oficial em um comando com npm run ops:remote:go.'],
        }),
      } as any,
      localCloudflareRolloutService: {
        inspect: jest.fn().mockReturnValue({
          readyForPlanB: true,
          summary: 'Plano B local com Cloudflare e Gemini/Gemma pronto para rollout.',
          helpers: {
            guide: 'C:/repo/docs/runtime-readiness.md',
          },
          steps: [
            { id: 'launcher', title: 'Launcher', status: 'done', detail: 'ok', command: 'cmd-a' },
          ],
        }),
      } as any,
      oracleCloudflareRolloutService: {
        inspect: jest.fn().mockReturnValue({
          readyForRemoteRollout: false,
          summary: 'Rollout Oracle ainda pendente.',
          templates: {
            oracleSystemd: 'C:/repo/config/deploy/zavorth-oracle.service.example',
          },
          steps: [],
        }),
      } as any,
      stateFilePath: 'C:/repo/data/runtime/official-remote-access.json',
      existsSync: jest.fn(() => false),
      readFileSync: jest.fn(),
      mkdirSync: jest.fn(),
      writeFileSync: jest.fn((target: fs.PathOrFileDescriptor, content: string | NodeJS.ArrayBufferView) => {
        persisted = String(content);
      }) as any,
    });

    const report = await service.go();

    expect(report.actions.canGo).toBe(true);
    expect(report.actions.recommendedAction).toBe('go');
    expect(report.state.provider).toBe('local-cloudflare');
    expect(report.state.lastAction).toBe('go');
    expect(persisted).toContain('"lastAction": "go"');
  });

  it('keeps rollback manual in effect by clearing the guided provider selection', async () => {
    let persisted = JSON.stringify({
      provider: 'local-cloudflare',
      lastAction: 'apply',
      lastActionAt: '2026-04-06T12:00:00.000Z',
      status: 'provisioning',
    });
    const service = new RuntimeOfficialRemoteAccessService({
      officialAccessService: {
        prepare: jest.fn().mockResolvedValue({
          manifest: {
            remote: {
              baseUrl: '',
              appUrl: null,
            },
          },
          remote: {
            ready: false,
            configured: false,
            appUrl: null,
            issues: ['ZAVORTH_PUBLIC_BASE_URL ainda nao foi configurada.'],
          },
          nextSteps: ['Defina ZAVORTH_PUBLIC_BASE_URL para expor o runtime por HTTPS.'],
        }),
      } as any,
      localCloudflareRolloutService: {
        inspect: jest.fn().mockReturnValue({
          readyForPlanB: false,
          summary: 'Plano B local pendente.',
          helpers: {
            guide: 'C:/repo/docs/runtime-readiness.md',
          },
          steps: [],
        }),
      } as any,
      oracleCloudflareRolloutService: {
        inspect: jest.fn().mockReturnValue({
          readyForRemoteRollout: false,
          summary: 'Oracle pendente.',
          templates: {
            oracleSystemd: 'C:/repo/config/deploy/zavorth-oracle.service.example',
          },
          steps: [],
        }),
      } as any,
      stateFilePath: 'C:/repo/data/runtime/official-remote-access.json',
      existsSync: jest.fn(() => true),
      readFileSync: jest.fn(() => persisted) as any,
      mkdirSync: jest.fn(),
      writeFileSync: jest.fn((target: fs.PathOrFileDescriptor, content: string | NodeJS.ArrayBufferView) => {
        persisted = String(content);
      }) as any,
    });

    const report = await service.rollback();

    expect(report.state.provider).toBeNull();
    expect(report.state.lastAction).toBe('rollback');
    expect(persisted).toContain('"provider": null');
  });
});



