import { RuntimeBootstrapRepairService } from '../../src/services/RuntimeBootstrapRepairService';

describe('RuntimeBootstrapRepairService', () => {
  function buildBaseReport() {
    return {
      checkedAt: '2026-03-31T15:00:00.000Z',
      projectRoot: 'C:/tmp/zavorth',
      env: {
        envFilePresent: true,
        llmProvider: 'gemini',
        llmCredentialReady: true,
        issues: [],
      },
      dependencies: {
        installRequired: false,
        buildRequired: false,
      },
      platforms: [],
      supervisedRuntime: {
        projectRoot: 'C:/tmp/zavorth',
        gitAvailable: true,
        branch: 'main',
        modifiedFiles: [],
        stagedFiles: [],
        untrackedFiles: [],
        recentCommits: [],
        installRequired: false,
        buildRequired: false,
        hostSupervisor: { active: true, pid: 3001, owner: 'host-supervisor', startedAt: '2026-03-31T10:00:00.000Z', alive: true },
        telegramWorker: { active: true, pid: 3002, owner: 'telegram-worker', startedAt: '2026-03-31T10:00:02.000Z', alive: true },
        accessReadiness: {
          checkedAt: '2026-03-31T10:05:00.000Z',
          runtime: {
            hostSupervisor: { active: true, pid: 3001, owner: 'host-supervisor', startedAt: '2026-03-31T10:00:00.000Z', alive: true },
            telegramWorker: { active: true, pid: 3002, owner: 'telegram-worker', startedAt: '2026-03-31T10:00:02.000Z', alive: true },
            hostAuthorized: true,
            firstRun: false,
          },
          auth: { enabled: true, source: 'env', tokenFile: 'token.txt' },
          local: { baseUrl: 'http://127.0.0.1:33333', dashboardUrl: 'http://127.0.0.1:33333/', appUrl: 'http://127.0.0.1:33333/app', ready: true, issues: [] },
          remote: { baseUrl: 'https://zavorth.example.com', appUrl: 'https://zavorth.example.com/app', ready: true, issues: [] },
          recommendations: [],
          nextSteps: [],
          summary: 'Zavorth pronto para uso local e remoto.',
        },
        lastReloadReport: null,
      },
      actions: [],
      summary: 'Bootstrap fechado: Zavorth pronto para uso local e remoto.',
    };
  }

  it('runs safe repair steps and returns the refreshed report', () => {
    const pendingReport = {
      ...buildBaseReport(),
      dependencies: {
        installRequired: true,
        buildRequired: true,
      },
      actions: [
        {
          id: 'install-dependencies',
          title: 'Instalar dependencias',
          command: 'npm install',
          reason: 'Dependencias pendentes.',
          blocking: true,
          autoFixCommand: {
            command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
            args: ['install'],
            cwd: 'C:/tmp/zavorth',
          },
        },
        {
          id: 'build-runtime',
          title: 'Gerar build do runtime',
          command: 'npm run build',
          reason: 'Build pendente.',
          blocking: false,
          autoFixCommand: {
            command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
            args: ['run', 'build'],
            cwd: 'C:/tmp/zavorth',
          },
        },
      ],
      summary: 'Bootstrap ainda pendente: Dependencias pendentes.',
    };
    const finalReport = buildBaseReport();
    const inspect = jest
      .fn()
      .mockReturnValueOnce(pendingReport)
      .mockReturnValueOnce(finalReport);
    const runCommand = jest
      .fn()
      .mockReturnValueOnce('installed')
      .mockReturnValueOnce('built');

    const repair = new RuntimeBootstrapRepairService({
      bootstrapService: { inspect },
      runCommand,
      now: (() => {
        const ticks = [
          new Date('2026-03-31T15:00:00.000Z'),
          new Date('2026-03-31T15:00:00.010Z'),
          new Date('2026-03-31T15:00:00.040Z'),
          new Date('2026-03-31T15:00:00.050Z'),
          new Date('2026-03-31T15:00:00.090Z'),
          new Date('2026-03-31T15:00:00.100Z'),
        ];
        let index = 0;
        return () => ticks[Math.min(index++, ticks.length - 1)];
      })(),
    });

    const report = repair.repair();

    expect(runCommand).toHaveBeenCalledTimes(2);
    expect(report.steps.map((step) => step.status)).toEqual(['executed', 'executed']);
    expect(report.final.summary).toBe('Bootstrap fechado: Zavorth pronto para uso local e remoto.');
    expect(report.summary).toBe('Correcoes seguras aplicadas. Bootstrap fechado: Zavorth pronto para uso local e remoto.');
  });

  it('returns a no-op report when no safe repair is available', () => {
    const stableReport = buildBaseReport();
    const inspect = jest.fn().mockReturnValue(stableReport);

    const repair = new RuntimeBootstrapRepairService({
      bootstrapService: { inspect },
    });

    const report = repair.repair();

    expect(report.steps).toHaveLength(0);
    expect(report.summary).toBe('Nenhuma correcao segura disponivel para execucao automatica no momento.');
  });

  it('stops on blocking failure and reports the error clearly', () => {
    const pendingReport = {
      ...buildBaseReport(),
      dependencies: {
        installRequired: true,
        buildRequired: true,
      },
      actions: [
        {
          id: 'install-dependencies',
          title: 'Instalar dependencias',
          command: 'npm install',
          reason: 'Dependencias pendentes.',
          blocking: true,
          autoFixCommand: {
            command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
            args: ['install'],
            cwd: 'C:/tmp/zavorth',
          },
        },
        {
          id: 'build-runtime',
          title: 'Gerar build do runtime',
          command: 'npm run build',
          reason: 'Build pendente.',
          blocking: false,
          autoFixCommand: {
            command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
            args: ['run', 'build'],
            cwd: 'C:/tmp/zavorth',
          },
        },
      ],
      summary: 'Bootstrap ainda pendente: Dependencias pendentes.',
    };
    const inspect = jest
      .fn()
      .mockReturnValueOnce(pendingReport)
      .mockReturnValueOnce(pendingReport);
    const runCommand = jest.fn().mockImplementation(() => {
      const error = Object.assign(new Error('npm install failed'), {
        stderr: 'network failure',
      });
      throw error;
    });

    const repair = new RuntimeBootstrapRepairService({
      bootstrapService: { inspect },
      runCommand,
    });

    const report = repair.repair();

    expect(runCommand).toHaveBeenCalledTimes(1);
    expect(report.steps).toHaveLength(1);
    expect(report.steps[0]?.status).toBe('failed');
    expect(report.summary).toBe('Falha ao aplicar a correcao segura "Instalar dependencias". network failure');
  });

  it('supports dry-run without executing commands', () => {
    const pendingReport = {
      ...buildBaseReport(),
      actions: [
        {
          id: 'build-runtime',
          title: 'Gerar build do runtime',
          command: 'npm run build',
          reason: 'Build pendente.',
          blocking: false,
          autoFixCommand: {
            command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
            args: ['run', 'build'],
            cwd: 'C:/tmp/zavorth',
          },
        },
      ],
      summary: 'Bootstrap ainda pendente: Build pendente.',
    };
    const inspect = jest.fn().mockReturnValue(pendingReport);
    const runCommand = jest.fn();

    const repair = new RuntimeBootstrapRepairService({
      bootstrapService: { inspect },
      runCommand,
    });

    const report = repair.repair({ dryRun: true });

    expect(runCommand).not.toHaveBeenCalled();
    expect(report.steps[0]?.status).toBe('skipped');
    expect(report.summary).toBe('Plano de correcao gerado com 1 acao(oes) segura(s).');
  });

  it('can refresh the final report through inspectLive after repairs', async () => {
    const pendingReport = {
      ...buildBaseReport(),
      dependencies: {
        installRequired: true,
        buildRequired: false,
      },
      actions: [
        {
          id: 'install-dependencies',
          title: 'Instalar dependencias',
          command: 'npm install',
          reason: 'Dependencias pendentes.',
          blocking: true,
          autoFixCommand: {
            command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
            args: ['install'],
            cwd: 'C:/tmp/zavorth',
          },
        },
      ],
      summary: 'Bootstrap ainda pendente: Dependencias pendentes.',
    };
    const finalReport = buildBaseReport();
    const inspect = jest.fn().mockReturnValue(pendingReport);
    const inspectLive = jest
      .fn()
      .mockResolvedValueOnce(pendingReport)
      .mockResolvedValueOnce(finalReport);
    const runCommand = jest.fn().mockReturnValueOnce('installed');

    const repair = new RuntimeBootstrapRepairService({
      bootstrapService: { inspect, inspectLive } as any,
      runCommand,
    });

    const report = await repair.repairLive();

    expect(runCommand).toHaveBeenCalledTimes(1);
    expect(inspectLive).toHaveBeenCalledTimes(2);
    expect(report.final.summary).toBe('Bootstrap fechado: Zavorth pronto para uso local e remoto.');
  });
});
