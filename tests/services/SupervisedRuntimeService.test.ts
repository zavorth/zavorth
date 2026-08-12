import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index';
import { SupervisedRuntimeService } from '../../src/services/SupervisedRuntimeService';

describe('SupervisedRuntimeService', () => {
  const originalConfig = {
    projectRoot: config.projectRoot,
    hostSupervisorLockFile: config.hostSupervisorLockFile,
    telegramProcessLockFile: config.telegramProcessLockFile,
    supervisedReloadReportFile: config.supervisedReloadReportFile,
  };
  const tempDirs: string[] = [];

  afterEach(() => {
    (config as any).projectRoot = originalConfig.projectRoot;
    (config as any).hostSupervisorLockFile = originalConfig.hostSupervisorLockFile;
    (config as any).telegramProcessLockFile = originalConfig.telegramProcessLockFile;
    (config as any).supervisedReloadReportFile = originalConfig.supervisedReloadReportFile;
    jest.restoreAllMocks();

    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('summarizes git state, build freshness and the latest reload report', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-supervised-runtime-'));
    tempDirs.push(root);

    fs.mkdirSync(path.join(root, '.git'));
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
    fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), '{"name":"zavorth"}', 'utf8');
    fs.writeFileSync(path.join(root, 'package-lock.json'), '{}', 'utf8');
    fs.writeFileSync(path.join(root, 'tsconfig.json'), '{}', 'utf8');
    fs.writeFileSync(path.join(root, 'src', 'index.ts'), 'console.log("src");', 'utf8');
    fs.writeFileSync(path.join(root, 'src', 'host.ts'), 'console.log("host");', 'utf8');
    fs.writeFileSync(path.join(root, 'dist', 'index.js'), 'console.log("dist");', 'utf8');
    fs.writeFileSync(path.join(root, 'dist', 'host.js'), 'console.log("dist-host");', 'utf8');
    fs.writeFileSync(path.join(root, 'node_modules', '.package-lock.json'), '{}', 'utf8');

    const srcFile = path.join(root, 'src', 'index.ts');
    const distFile = path.join(root, 'dist', 'index.js');
    const distHostFile = path.join(root, 'dist', 'host.js');
    const installStamp = path.join(root, 'node_modules', '.package-lock.json');
    const older = new Date('2026-03-29T10:00:00.000Z');
    const newer = new Date('2026-03-31T10:00:00.000Z');

    fs.utimesSync(distFile, older, older);
    fs.utimesSync(distHostFile, older, older);
    fs.utimesSync(installStamp, older, older);
    fs.utimesSync(srcFile, newer, newer);
    fs.utimesSync(path.join(root, 'package-lock.json'), newer, newer);

    const hostLockFile = path.join(root, 'host.lock.json');
    const workerLockFile = path.join(root, 'worker.lock.json');
    const reloadReportFile = path.join(root, 'reload-report.json');

    fs.writeFileSync(hostLockFile, JSON.stringify({ pid: 7001, owner: 'host-supervisor' }), 'utf8');
    fs.writeFileSync(workerLockFile, JSON.stringify({ pid: 7002, owner: 'telegram-worker' }), 'utf8');
    fs.writeFileSync(
      reloadReportFile,
      JSON.stringify({
        status: 'success',
        finishedAt: '2026-03-31T15:20:00.000Z',
        actions: ['npm-install', 'build', 'boot-success-attempt-1'],
      }),
      'utf8',
    );

    (config as any).projectRoot = root;
    (config as any).hostSupervisorLockFile = hostLockFile;
    (config as any).telegramProcessLockFile = workerLockFile;
    (config as any).supervisedReloadReportFile = reloadReportFile;

    const service = new SupervisedRuntimeService({
      execCommandSync: jest.fn((command: string, args: string[]) => {
        if (command === 'git' && args[0] === 'status') {
          return '## main...origin/main\nM  src/index.ts\n M src/host.ts\n?? scripts/new-script.ps1';
        }
        if (command === 'git' && args[0] === 'log') {
          return 'abc123\t2 hours ago\tfeat: supervised reload\nfff111\t1 day ago\tfix: launcher boot';
        }
        throw new Error('unexpected git command');
      }) as any,
      kill: (pid: number) => {
        if (pid !== 7001 && pid !== 7002) {
          const error = Object.assign(new Error('missing pid'), { code: 'ESRCH' });
          throw error;
        }
      },
    });

    const summary = service.summarizeRecentChanges();

    expect(summary).toContain('Branch atual: main.');
    expect(summary).toContain('Git local: 1 staged | 1 modificados | 1 novos.');
    expect(summary).toContain('Dependencias: precisam de npm install.');
    expect(summary).toContain('Build: desatualizado, precisa recompilar.');
    expect(summary).toContain('Ultimo reload supervisionado: success em 2026-03-31T15:20:00.000Z.');
    expect(summary).toContain('novo scripts/new-script.ps1');
  });

  it('does not flag npm install when only package scripts changed after the last install stamp', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-supervised-runtime-fingerprint-'));
    tempDirs.push(root);

    fs.mkdirSync(path.join(root, '.git'));
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
    fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify(
        {
          name: 'zavorth',
          scripts: {
            build: 'tsc --pretty false',
          },
          dependencies: {
            grammy: '^1.35.0',
          },
        },
        null,
        2,
      ),
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'package-lock.json'),
      JSON.stringify(
        {
          name: 'zavorth',
          lockfileVersion: 3,
          packages: {
            '': {
              dependencies: {
                grammy: '^1.35.0',
              },
            },
          },
        },
        null,
        2,
      ),
      'utf8',
    );
    fs.writeFileSync(path.join(root, 'tsconfig.json'), '{}', 'utf8');
    fs.writeFileSync(path.join(root, 'src', 'index.ts'), 'console.log("src");', 'utf8');
    fs.writeFileSync(path.join(root, 'src', 'host.ts'), 'console.log("host");', 'utf8');
    fs.writeFileSync(path.join(root, 'dist', 'index.js'), 'console.log("dist");', 'utf8');
    fs.writeFileSync(path.join(root, 'dist', 'host.js'), 'console.log("dist-host");', 'utf8');
    fs.writeFileSync(path.join(root, 'node_modules', '.package-lock.json'), '{}', 'utf8');

    const packageJsonPath = path.join(root, 'package.json');
    const packageLockPath = path.join(root, 'package-lock.json');
    const installStamp = path.join(root, 'node_modules', '.package-lock.json');
    const older = new Date('2026-03-30T10:00:00.000Z');
    const newer = new Date('2026-03-31T10:00:00.000Z');
    fs.utimesSync(installStamp, older, older);
    fs.utimesSync(packageLockPath, older, older);
    fs.utimesSync(packageJsonPath, newer, newer);

    (config as any).projectRoot = root;

    const service = new SupervisedRuntimeService({
      execCommandSync: jest.fn((command: string, args: string[]) => {
        if (command === 'git' && args[0] === 'status') {
          return '## main...origin/main';
        }
        if (command === 'git' && args[0] === 'log') {
          return '';
        }
        throw new Error('unexpected git command');
      }) as any,
      kill: () => undefined,
    });

    const inspection = service.inspect();

    expect(inspection.installRequired).toBe(false);
  });

  it('requests a host-supervised reload through IPC', async () => {
    let messageHandler: ((message: any) => void) | null = null;
    const processRef = {
      pid: 5050,
      env: { ZAVORTH_SUPERVISED: 'true' },
      send: jest.fn((message: any) => {
        setTimeout(() => {
          messageHandler?.({
            type: 'handoff_reload_ack',
            requestId: message.requestId,
            accepted: true,
            summary: 'Handoff aceito pelo host.',
          });
        }, 0);
        return true;
      }),
      on: jest.fn((event: string, handler: (message: any) => void) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      }),
      removeListener: jest.fn(),
    } as any;

    const service = new SupervisedRuntimeService({
      processRef,
    });

    const result = await service.requestReload({
      reason: 'Reload via teste.',
      requestedBy: '42',
      notifyChatId: '99',
      forceRestart: true,
    });

    expect(processRef.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'handoff_reload',
        payload: expect.objectContaining({
          reason: 'Reload via teste.',
          requestedBy: '42',
          notifyChatId: '99',
          forceRestart: true,
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        accepted: true,
        summary: 'Handoff aceito pelo host.',
      }),
    );
  });

  it('skips a non-forced reload when the runtime already looks healthy', async () => {
    const processRef = {
      pid: 5050,
      env: { ZAVORTH_SUPERVISED: 'true' },
      send: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn(),
    } as any;

    const service = new SupervisedRuntimeService({
      processRef,
      execCommandSync: jest.fn((command: string, args: string[]) => {
        if (command === 'git' && args[0] === 'status') {
          return '## main...origin/main';
        }
        if (command === 'git' && args[0] === 'log') {
          return '';
        }
        throw new Error('unexpected git command');
      }) as any,
    });
    jest.spyOn(service, 'inspect').mockReturnValue({
      projectRoot: originalConfig.projectRoot,
      gitAvailable: true,
      branch: 'main',
      modifiedFiles: [],
      stagedFiles: [],
      untrackedFiles: [],
      recentCommits: [],
      installRequired: false,
      buildRequired: false,
      hostSupervisor: {
        active: true,
        pid: 7001,
        owner: 'host-supervisor',
        startedAt: '2026-04-01T12:00:00.000Z',
        alive: true,
      },
      telegramWorker: {
        active: true,
        pid: 7002,
        owner: 'telegram-worker',
        startedAt: '2026-04-01T12:00:00.000Z',
        alive: true,
      },
      accessReadiness: {
        checkedAt: '2026-04-01T12:00:00.000Z',
        runtime: {
          hostSupervisor: {
            active: true,
            pid: 7001,
            owner: 'host-supervisor',
            startedAt: '2026-04-01T12:00:00.000Z',
            alive: true,
          },
          telegramWorker: {
            active: true,
            pid: 7002,
            owner: 'telegram-worker',
            startedAt: '2026-04-01T12:00:00.000Z',
            alive: true,
          },
          dashboard: null,
          hostAuthorized: true,
          firstRun: false,
        },
        auth: {
          enabled: true,
          source: 'env',
          tokenFile: '',
        },
        local: {
          baseUrl: 'http://127.0.0.1:33333',
          dashboardUrl: 'http://127.0.0.1:33333/',
          appUrl: 'http://127.0.0.1:33333/app',
          ready: true,
          issues: [],
        },
        remote: {
          baseUrl: null,
          appUrl: null,
          ready: false,
          issues: ['sem URL publica'],
        },
        recommendations: [],
        nextSteps: [],
        summary: 'ok',
      },
      lastReloadReport: { status: 'success' },
    } as any);

    const result = await service.requestReload({
      reason: 'Teste de no-op.',
      requestedBy: '42',
      forceRestart: false,
    });

    expect(result.accepted).toBe(false);
    expect(result.summary).toContain('ja parece saudavel');
    expect(processRef.send).not.toHaveBeenCalled();
  });
});
