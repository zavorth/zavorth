import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index';
import { AutoRepairService } from '../../src/services/AutoRepairService';

describe('AutoRepairService', () => {
  const originalAutoRepairReportFile = config.autoRepairReportFile;
  const originalAutoRepairMaxAttempts = config.autoRepairMaxAttempts;
  const tempDirs: string[] = [];

  afterEach(() => {
    config.autoRepairReportFile = originalAutoRepairReportFile;
    config.autoRepairMaxAttempts = originalAutoRepairMaxAttempts;
    jest.restoreAllMocks();

    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  function createInspection(root: string, overrides: Record<string, any> = {}) {
    return {
      projectRoot: root,
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
        pid: 111,
        owner: 'host-supervisor',
        startedAt: '2026-04-01T12:00:00.000Z',
        alive: true,
      },
      telegramWorker: {
        active: true,
        pid: 222,
        owner: 'telegram-worker',
        startedAt: '2026-04-01T12:00:00.000Z',
        alive: true,
      },
      accessReadiness: {
        local: { ready: true },
        remote: { ready: true },
        nextSteps: [],
      },
      lastReloadReport: {
        status: 'success',
        finishedAt: '2026-04-01T12:00:00.000Z',
      },
      ...overrides,
    };
  }

  function createBootstrapRepair(root: string, overrides: Record<string, any> = {}) {
    const finalInspection = createInspection(root, overrides.finalInspection || {});
    return {
      startedAt: '2026-04-01T12:00:00.000Z',
      finishedAt: '2026-04-01T12:00:10.000Z',
      dryRun: false,
      initial: {
        projectRoot: root,
        supervisedRuntime: finalInspection,
        actions: [],
        summary: 'ok',
      },
      steps: [],
      final: {
        projectRoot: root,
        supervisedRuntime: finalInspection,
        actions: [],
        summary: 'ok',
      },
      summary: 'ok',
      ...overrides,
    };
  }

  function createProvider(plan: Record<string, any>) {
    return {
      name: 'test-provider',
      chat: jest.fn().mockResolvedValue({
        content: JSON.stringify(plan),
        toolCalls: [],
        finishReason: 'stop',
      }),
    } as any;
  }

  function createIncidentMemoryMock(summary = 'Historico operacional sintetico do autorepair.') {
    return {
      summarizeForPlanner: jest.fn().mockReturnValue(summary),
      summarizeForStatus: jest.fn().mockReturnValue('Operational memory: synthetic history available.'),
      recordRun: jest.fn(),
    };
  }

  function createExternalSmokeMock(steps: any[] = []) {
    return {
      run: jest.fn().mockResolvedValue(steps),
    };
  }

  it('creates a dry-run plan and persists the report', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-autorepair-dryrun-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'autorepair-last.json');
    config.autoRepairReportFile = reportFile;

    const provider = createProvider({
      needsCodeChange: true,
      targetFile: 'src/services/FixService.ts',
      instruction: 'Add a small safe correction to the target file.',
      summary: 'The best next step is to fix one file.',
      confidence: 0.84,
      warnings: ['Validar build e teste relacionado.'],
      validationHints: ['tests/services/FixService.test.ts'],
    });
    const previewModification = jest.fn();
    const incidentMemoryService = createIncidentMemoryMock('Recent memory: launcher failed twice.');
    const service = new AutoRepairService({
      projectRoot: root,
      provider,
      supervisedRuntimeService: {
        summarizeRecentChanges: jest.fn().mockReturnValue('Changes e estado do Zavorth'),
        inspect: jest.fn().mockReturnValue(
          createInspection(root, {
            buildRequired: true,
            telegramWorker: {
              active: false,
              pid: null,
              owner: 'telegram-worker',
              startedAt: null,
              alive: false,
            },
            accessReadiness: {
              local: { ready: false },
              remote: { ready: true },
              nextSteps: [],
            },
            lastReloadReport: { status: 'failed' },
          }),
        ),
        requestReload: jest.fn(),
      } as any,
      runtimeBootstrapRepairService: {
        repair: jest.fn().mockReturnValue(
          createBootstrapRepair(root, {
            dryRun: true,
            finalInspection: {
              buildRequired: true,
              telegramWorker: {
                active: false,
                pid: null,
                owner: 'telegram-worker',
                startedAt: null,
                alive: false,
              },
              accessReadiness: {
                local: { ready: false },
                remote: { ready: true },
                nextSteps: [],
              },
              lastReloadReport: { status: 'failed' },
            },
          }),
        ),
      } as any,
      selfModificationService: {
        previewModification,
      } as any,
      safeModificationService: {
        validateCandidate: jest.fn(),
        safeApply: jest.fn(),
      } as any,
      incidentMemoryService: incidentMemoryService as any,
      externalSmokeService: createExternalSmokeMock() as any,
    });

    const result = await service.run({
      reason: 'Plan autorepair in dry-run.',
      requestedBy: '42',
      dryRun: true,
    });

    expect(result.status).toBe('dry_run');
    expect(result.summary).toContain('Status final: dry_run.');
    expect(provider.chat).toHaveBeenCalled();
    expect(provider.chat.mock.calls[0]?.[0]?.[1]?.content).toContain('=== MEMORIA OPERACIONAL ===');
    expect(provider.chat.mock.calls[0]?.[0]?.[1]?.content).toContain('Recent memory: launcher failed twice.');
    expect(previewModification).not.toHaveBeenCalled();
    expect(incidentMemoryService.recordRun).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(reportFile)).toBe(true);
    expect(service.summarizeLastRun()).toContain('Operational memory: synthetic history available.');
    expect(service.summarizeLastRun()).toContain('Autoreparo do Zavorth');
  });

  it('adds operational memory to the planner prompt and records the final incident', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-autorepair-memory-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'autorepair-last.json');
    config.autoRepairReportFile = reportFile;

    const provider = createProvider({
      needsCodeChange: true,
      targetFile: 'scripts/launch-zavorth-supervised.ps1',
      instruction: 'Ajustar o launcher de forma conservadora.',
      summary: 'Corrigir o launcher supervisionado.',
      confidence: 0.86,
      warnings: [],
      validationHints: [],
    });
    const incidentMemoryService = {
      summarizeForPlanner: jest
        .fn()
        .mockReturnValue('Historico operacional recente do autorepair\nRegistros: 3.'),
      recordRun: jest.fn(),
    };
    const service = new AutoRepairService({
      projectRoot: root,
      provider,
      incidentMemoryService: incidentMemoryService as any,
      supervisedRuntimeService: {
        summarizeRecentChanges: jest.fn().mockReturnValue('Changes e estado do Zavorth'),
        inspect: jest.fn().mockReturnValue(
          createInspection(root, {
            buildRequired: true,
            lastReloadReport: { status: 'failed' },
          }),
        ),
        requestReload: jest.fn(),
      } as any,
      runtimeBootstrapRepairService: {
        repair: jest.fn().mockReturnValue(
          createBootstrapRepair(root, {
            dryRun: true,
            finalInspection: {
              buildRequired: true,
              lastReloadReport: { status: 'failed' },
            },
          }),
        ),
      } as any,
      selfModificationService: {
        previewModification: jest.fn(),
      } as any,
      safeModificationService: {
        validateCandidate: jest.fn(),
        safeApply: jest.fn(),
      } as any,
    });

    const result = await service.run({
      reason: 'Plan self-repair in dry-run with operational memory.',
      requestedBy: '42',
      dryRun: true,
    });

    expect(result.status).toBe('dry_run');
    const plannerPrompt = String(provider.chat.mock.calls[0]?.[0]?.[1]?.content || '');
    expect(plannerPrompt).toContain('=== MEMORIA OPERACIONAL ===');
    expect(plannerPrompt).toContain('Registros: 3.');
    expect(incidentMemoryService.recordRun).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'dry_run',
      }),
      expect.arrayContaining(['launcher', 'host']),
    );
  });

  it('revalidates Node Mesh during autorepair without forcing a supervised reload', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-autorepair-node-mesh-pass-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'autorepair-last.json');
    config.autoRepairReportFile = reportFile;

    const requestReload = jest.fn();
    const incidentMemoryService = createIncidentMemoryMock();
    const service = new AutoRepairService({
      projectRoot: root,
      supervisedRuntimeService: {
        summarizeRecentChanges: jest.fn().mockReturnValue('Changes e estado do Zavorth'),
        inspect: jest.fn().mockReturnValue(createInspection(root)),
        requestReload,
      } as any,
      runtimeBootstrapRepairService: {
        repair: jest.fn().mockReturnValue(
          createBootstrapRepair(root, {
            steps: [
              {
                actionId: 'validate-node-mesh-smoke',
                title: 'Validar o Node Mesh com smoke real',
                command: 'npm run test:nodes:smoke',
                status: 'executed',
                startedAt: '2026-04-01T12:00:00.000Z',
                finishedAt: '2026-04-01T12:01:00.000Z',
                durationMs: 60000,
                output: 'NODE_MESH_SMOKE_OK',
              },
            ],
          }),
        ),
      } as any,
      selfModificationService: {
        previewModification: jest.fn(),
      } as any,
      safeModificationService: {
        validateCandidate: jest.fn(),
        safeApply: jest.fn(),
      } as any,
      incidentMemoryService: incidentMemoryService as any,
      externalSmokeService: createExternalSmokeMock() as any,
    });

    const result = await service.run({
      reason: 'Revalidar a malthere is do Node Mesh pelo autorepair.',
      requestedBy: '42',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('repaired');
    expect(result.summary).toContain('Node Mesh smoke: revalidated automatically pelo autorepair.');
    expect(requestReload).not.toHaveBeenCalled();
    expect(incidentMemoryService.recordRun).toHaveBeenCalledTimes(1);
  });

  it('fails fast when the automatic Node Mesh revalidation fails during autorepair', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-autorepair-node-mesh-fail-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'autorepair-last.json');
    config.autoRepairReportFile = reportFile;

    const requestReload = jest.fn();
    const incidentMemoryService = createIncidentMemoryMock();
    const service = new AutoRepairService({
      projectRoot: root,
      supervisedRuntimeService: {
        summarizeRecentChanges: jest.fn().mockReturnValue('Changes e estado do Zavorth'),
        inspect: jest.fn().mockReturnValue(createInspection(root)),
        requestReload,
      } as any,
      runtimeBootstrapRepairService: {
        repair: jest.fn().mockReturnValue(
          createBootstrapRepair(root, {
            steps: [
              {
                actionId: 'validate-node-mesh-smoke',
                title: 'Validar o Node Mesh com smoke real',
                command: 'npm run test:nodes:smoke',
                status: 'failed',
                startedAt: '2026-04-01T12:00:00.000Z',
                finishedAt: '2026-04-01T12:00:20.000Z',
                durationMs: 20000,
                error: 'system.run not retornou o marcador esperado.',
              },
            ],
          }),
        ),
      } as any,
      selfModificationService: {
        previewModification: jest.fn(),
      } as any,
      safeModificationService: {
        validateCandidate: jest.fn(),
        safeApply: jest.fn(),
      } as any,
      incidentMemoryService: incidentMemoryService as any,
      externalSmokeService: createExternalSmokeMock() as any,
    });

    const result = await service.run({
      reason: 'Revalidar a malthere is do Node Mesh pelo autorepair.',
      requestedBy: '42',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.summary).toContain('Node Mesh smoke: falhou na revalidaction automatica');
    expect(requestReload).not.toHaveBeenCalled();
    expect(incidentMemoryService.recordRun).toHaveBeenCalledTimes(1);
  });

  it('revalidates native channels during autorepair without forcing a supervised reload', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-autorepair-channel-doctor-pass-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'autorepair-last.json');
    config.autoRepairReportFile = reportFile;

    const requestReload = jest.fn();
    const incidentMemoryService = createIncidentMemoryMock();
    const service = new AutoRepairService({
      projectRoot: root,
      supervisedRuntimeService: {
        summarizeRecentChanges: jest.fn().mockReturnValue('Changes e estado do Zavorth'),
        inspect: jest.fn().mockReturnValue(createInspection(root)),
        requestReload,
      } as any,
      runtimeBootstrapRepairService: {
        repair: jest.fn().mockReturnValue(
          createBootstrapRepair(root, {
            steps: [
              {
                actionId: 'validate-channel-providers',
                title: 'Validar canais nactives',
                command: 'npm run test:channels:smoke',
                status: 'executed',
                startedAt: '2026-04-01T12:00:00.000Z',
                finishedAt: '2026-04-01T12:00:30.000Z',
                durationMs: 30000,
                output: 'CHANNEL_PROVIDER_DOCTOR_OK',
              },
            ],
          }),
        ),
      } as any,
      selfModificationService: {
        previewModification: jest.fn(),
      } as any,
      safeModificationService: {
        validateCandidate: jest.fn(),
        safeApply: jest.fn(),
      } as any,
      incidentMemoryService: incidentMemoryService as any,
      externalSmokeService: createExternalSmokeMock() as any,
    });

    const result = await service.run({
      reason: 'Revalidar Slack native e WhatsApp Cloud API pelo autorepair.',
      requestedBy: '42',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('repaired');
    expect(result.summary).toContain('Canais nactives: revalidateds automatically pelo autorepair.');
    expect(requestReload).not.toHaveBeenCalled();
    expect(incidentMemoryService.recordRun).toHaveBeenCalledTimes(1);
  });

  it('fails fast when the automatic native channel revalidation fails during autorepair', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-autorepair-channel-doctor-fail-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'autorepair-last.json');
    config.autoRepairReportFile = reportFile;

    const requestReload = jest.fn();
    const incidentMemoryService = createIncidentMemoryMock();
    const service = new AutoRepairService({
      projectRoot: root,
      supervisedRuntimeService: {
        summarizeRecentChanges: jest.fn().mockReturnValue('Changes e estado do Zavorth'),
        inspect: jest.fn().mockReturnValue(createInspection(root)),
        requestReload,
      } as any,
      runtimeBootstrapRepairService: {
        repair: jest.fn().mockReturnValue(
          createBootstrapRepair(root, {
            steps: [
              {
                actionId: 'validate-channel-providers',
                title: 'Validar canais nactives',
                command: 'npm run test:channels:smoke',
                status: 'failed',
                startedAt: '2026-04-01T12:00:00.000Z',
                finishedAt: '2026-04-01T12:00:15.000Z',
                durationMs: 15000,
                error: 'Slack native returned an invalid signature in doctor.',
              },
            ],
          }),
        ),
      } as any,
      selfModificationService: {
        previewModification: jest.fn(),
      } as any,
      safeModificationService: {
        validateCandidate: jest.fn(),
        safeApply: jest.fn(),
      } as any,
      incidentMemoryService: incidentMemoryService as any,
      externalSmokeService: createExternalSmokeMock() as any,
    });

    const result = await service.run({
      reason: 'Revalidar Slack native e WhatsApp Cloud API pelo autorepair.',
      requestedBy: '42',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.summary).toContain('Canais nactives: failureram na revalidaction automatica');
    expect(requestReload).not.toHaveBeenCalled();
    expect(incidentMemoryService.recordRun).toHaveBeenCalledTimes(1);
  });

  it('revalidates remote transports during autorepair without forcing a supervised reload', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-autorepair-remote-transport-pass-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'autorepair-last.json');
    config.autoRepairReportFile = reportFile;

    const requestReload = jest.fn();
    const incidentMemoryService = createIncidentMemoryMock();
    const service = new AutoRepairService({
      projectRoot: root,
      supervisedRuntimeService: {
        summarizeRecentChanges: jest.fn().mockReturnValue('Changes e estado do Zavorth'),
        inspect: jest.fn().mockReturnValue(createInspection(root)),
        requestReload,
      } as any,
      runtimeBootstrapRepairService: {
        repair: jest.fn().mockReturnValue(
          createBootstrapRepair(root, {
            steps: [
              {
                actionId: 'validate-remote-transports',
                title: 'Validar transportes remotos',
                command: 'npm run test:transports:smoke',
                status: 'executed',
                startedAt: '2026-04-01T12:00:00.000Z',
                finishedAt: '2026-04-01T12:00:25.000Z',
                durationMs: 25000,
                output: 'REMOTE_TRANSPORT_DOCTOR_OK',
              },
            ],
          }),
        ),
      } as any,
      selfModificationService: {
        previewModification: jest.fn(),
      } as any,
      safeModificationService: {
        validateCandidate: jest.fn(),
        safeApply: jest.fn(),
      } as any,
      incidentMemoryService: incidentMemoryService as any,
      externalSmokeService: createExternalSmokeMock() as any,
    });

    const result = await service.run({
      reason: 'Revalidar transportes remotos pelo autorepair.',
      requestedBy: '42',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('repaired');
    expect(result.summary).toContain('Transportes remotos: revalidateds automatically pelo autorepair.');
    expect(requestReload).not.toHaveBeenCalled();
    expect(incidentMemoryService.recordRun).toHaveBeenCalledTimes(1);
  });

  it('fails fast when the automatic remote transport revalidation fails during autorepair', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-autorepair-remote-transport-fail-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'autorepair-last.json');
    config.autoRepairReportFile = reportFile;

    const requestReload = jest.fn();
    const incidentMemoryService = createIncidentMemoryMock();
    const service = new AutoRepairService({
      projectRoot: root,
      supervisedRuntimeService: {
        summarizeRecentChanges: jest.fn().mockReturnValue('Changes e estado do Zavorth'),
        inspect: jest.fn().mockReturnValue(createInspection(root)),
        requestReload,
      } as any,
      runtimeBootstrapRepairService: {
        repair: jest.fn().mockReturnValue(
          createBootstrapRepair(root, {
            steps: [
              {
                actionId: 'validate-remote-transports',
                title: 'Validar transportes remotos',
                command: 'npm run test:transports:smoke',
                status: 'failed',
                startedAt: '2026-04-01T12:00:00.000Z',
                finishedAt: '2026-04-01T12:00:10.000Z',
                durationMs: 10000,
                error: 'Remote sidecar did not respond to doctor.',
              },
            ],
          }),
        ),
      } as any,
      selfModificationService: {
        previewModification: jest.fn(),
      } as any,
      safeModificationService: {
        validateCandidate: jest.fn(),
        safeApply: jest.fn(),
      } as any,
      incidentMemoryService: incidentMemoryService as any,
      externalSmokeService: createExternalSmokeMock() as any,
    });

    const result = await service.run({
      reason: 'Revalidar transportes remotos pelo autorepair.',
      requestedBy: '42',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.summary).toContain('Transportes remotos: failureram na revalidaction automatica');
    expect(requestReload).not.toHaveBeenCalled();
    expect(incidentMemoryService.recordRun).toHaveBeenCalledTimes(1);
  });

  it('applies a validated repair and requests supervised reload', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-autorepair-success-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'autorepair-last.json');
    config.autoRepairReportFile = reportFile;

    fs.mkdirSync(path.join(root, 'src', 'services'), { recursive: true });
    fs.mkdirSync(path.join(root, 'tests', 'services'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'services', 'FixService.ts'), 'export const value = 1;\n', 'utf8');
    fs.writeFileSync(path.join(root, 'tests', 'services', 'FixService.test.ts'), 'test("ok", () => expect(true).toBe(true));\n', 'utf8');

    const requestReload = jest.fn().mockResolvedValue({
      accepted: true,
      requestId: 'reload-1',
      summary: 'Reload aceito pelo host.',
    });
    const safeApply = jest.fn().mockResolvedValue({
      success: true,
      reason: 'File atualizado com security.',
    });
    const incidentMemoryService = createIncidentMemoryMock();
    const externalSmokeService = createExternalSmokeMock([
      {
        label: 'AIGateway-smoke',
        command: 'GET /models no AIGateway',
        status: 'passed',
        startedAt: '2026-04-01T12:00:00.000Z',
        finishedAt: '2026-04-01T12:00:01.000Z',
        durationMs: 1000,
        output: 'AIGateway responded with HTTP 200.',
      },
    ]);
    const service = new AutoRepairService({
      projectRoot: root,
      provider: createProvider({
        needsCodeChange: true,
        targetFile: 'src/services/FixService.ts',
        instruction: 'Corrigir o servico e manter compatibilidade.',
        summary: 'Corrigir um unico servico e validar o teste relacionado.',
        confidence: 0.88,
        warnings: [],
        validationHints: ['tests/services/FixService.test.ts'],
      }),
      supervisedRuntimeService: {
        summarizeRecentChanges: jest.fn().mockReturnValue('Changes e estado do Zavorth'),
        inspect: jest.fn().mockReturnValue(
          createInspection(root, {
            buildRequired: true,
            lastReloadReport: { status: 'failed' },
          }),
        ),
        requestReload,
      } as any,
      runtimeBootstrapRepairService: {
        repair: jest.fn().mockReturnValue(
          createBootstrapRepair(root, {
            finalInspection: {
              buildRequired: true,
              lastReloadReport: { status: 'failed' },
            },
          }),
        ),
      } as any,
      selfModificationService: {
        previewModification: jest.fn().mockResolvedValue({
          success: true,
          reason: 'Preview gerado com sucesso.',
          filePath: 'src/services/FixService.ts',
          absolutePath: path.join(root, 'src', 'services', 'FixService.ts'),
          isNewFile: false,
          instruction: 'Corrigir o servico e manter compatibilidade.',
          currentContent: 'export const value = 1;\n',
          proposedContent: 'export const value = 2;\n',
          summary: 'Corrige o value exportado.',
          diffPatch: 'patch',
          stats: { insertions: 1, deletions: 1, changedLines: 2 },
          warnings: [],
          modelResponseRaw: '{}',
        }),
      } as any,
      safeModificationService: {
        validateCandidate: jest.fn().mockReturnValue({ passes: true, output: '' }),
        safeApply,
      } as any,
      incidentMemoryService: incidentMemoryService as any,
      externalSmokeService: externalSmokeService as any,
      execCommandSync: jest.fn().mockReturnValue('ok') as any,
    });

    const result = await service.run({
      reason: 'Corrigir e religar o Zavorth.',
      requestedBy: '42',
      notifyChatId: '99',
    });

    expect(result.status).toBe('reloaded');
    expect(result.summary).toContain('Validaction final: 3 ok | 0 failure(s) | 0 pulada(s).');
    expect(result.summary).toContain('Smokes externos: 1 ok | 0 failure(s) | 0 skipped item(s).');
    expect(result.report.attempts[0]?.status).toBe('validated');
    expect(safeApply).toHaveBeenCalledWith(path.join(root, 'src', 'services', 'FixService.ts'), 'export const value = 2;\n');
    expect(externalSmokeService.run).toHaveBeenCalledTimes(1);
    expect(incidentMemoryService.recordRun).toHaveBeenCalledTimes(1);
    expect(service.summarizeLastRun()).toContain('Operational memory: synthetic history available.');
    expect(service.summarizeLastRun()).toContain('Smokes externos: 1 ok | 0 failure(s) | 0 skipped item(s).');
    expect(requestReload).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedBy: '42',
        notifyChatId: '99',
      }),
    );
  });

  it('rolls back the file when validation fails after apply', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-autorepair-rollback-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'autorepair-last.json');
    config.autoRepairReportFile = reportFile;
    config.autoRepairMaxAttempts = 1;

    fs.mkdirSync(path.join(root, 'src', 'services'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'services', 'FixService.ts'), 'export const value = 1;\n', 'utf8');

    const safeApply = jest
      .fn()
      .mockResolvedValue({
        success: true,
        reason: 'Rollback aplicado com security.',
      })
      .mockResolvedValueOnce({
        success: true,
        reason: 'File atualizado com security.',
      })
      .mockResolvedValueOnce({
        success: true,
        reason: 'Rollback aplicado com security.',
      });
    const execCommandSyncMock = jest.fn().mockImplementation(() => {
      throw { stdout: 'src/services/FixService.ts: error TS1005' };
    });
    const incidentMemoryService = createIncidentMemoryMock();
    const service = new AutoRepairService({
      projectRoot: root,
      provider: createProvider({
        needsCodeChange: true,
        targetFile: 'src/services/FixService.ts',
        instruction: 'Corrigir o servico e manter compatibilidade.',
        summary: 'Corrigir um unico servico e validar o teste relacionado.',
        confidence: 0.88,
        warnings: [],
        validationHints: [],
      }),
      supervisedRuntimeService: {
        summarizeRecentChanges: jest.fn().mockReturnValue('Changes e estado do Zavorth'),
        inspect: jest.fn().mockReturnValue(
          createInspection(root, {
            buildRequired: true,
            lastReloadReport: { status: 'failed' },
          }),
        ),
        requestReload: jest.fn(),
      } as any,
      runtimeBootstrapRepairService: {
        repair: jest.fn().mockReturnValue(
          createBootstrapRepair(root, {
            finalInspection: {
              buildRequired: true,
              lastReloadReport: { status: 'failed' },
            },
          }),
        ),
      } as any,
      selfModificationService: {
        previewModification: jest.fn().mockResolvedValue({
          success: true,
          reason: 'Preview gerado com sucesso.',
          filePath: 'src/services/FixService.ts',
          absolutePath: path.join(root, 'src', 'services', 'FixService.ts'),
          isNewFile: false,
          instruction: 'Corrigir o servico e manter compatibilidade.',
          currentContent: 'export const value = 1;\n',
          proposedContent: 'export const value = 2;\n',
          summary: 'Corrige o value exportado.',
          diffPatch: 'patch',
          stats: { insertions: 1, deletions: 1, changedLines: 2 },
          warnings: [],
          modelResponseRaw: '{}',
        }),
      } as any,
      safeModificationService: {
        validateCandidate: jest.fn().mockReturnValue({ passes: true, output: '' }),
        safeApply,
      } as any,
      incidentMemoryService: incidentMemoryService as any,
      externalSmokeService: createExternalSmokeMock() as any,
      execCommandSync: execCommandSyncMock as any,
    });

    const result = await service.run({
      reason: 'Try to repair Zavorth.',
      requestedBy: '42',
    });

    expect(result.status).toBe('failed');
    expect(result.report.attempts[0]?.status).toBe('rolled_back');
    expect(incidentMemoryService.recordRun).toHaveBeenCalledTimes(1);
    expect(safeApply).toHaveBeenNthCalledWith(
      2,
      path.join(root, 'src', 'services', 'FixService.ts'),
      'export const value = 1;\n',
    );
  });

  it('rolls back the file when external smoke fails after local validation', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-autorepair-smoke-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'autorepair-last.json');
    config.autoRepairReportFile = reportFile;
    config.autoRepairMaxAttempts = 1;

    fs.mkdirSync(path.join(root, 'src', 'telegram', 'controllers'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'src', 'telegram', 'controllers', 'TelegramOpsController.ts'),
      'export const telegramOps = 1;\n',
      'utf8',
    );

    const safeApply = jest
      .fn()
      .mockResolvedValueOnce({
        success: true,
        reason: 'File atualizado com security.',
      })
      .mockResolvedValueOnce({
        success: true,
        reason: 'Rollback aplicado com security.',
      });
    const externalSmokeService = {
      run: jest.fn().mockResolvedValue([
        {
          label: 'AIGateway-smoke',
          command: 'GET /models no AIGateway',
          status: 'failed',
          startedAt: '2026-04-01T12:00:00.000Z',
          finishedAt: '2026-04-01T12:00:05.000Z',
          durationMs: 5000,
          output: 'AIGateway responded with HTTP 503.',
        },
      ]),
    };
    const requestReload = jest.fn();
    const service = new AutoRepairService({
      projectRoot: root,
      provider: createProvider({
        needsCodeChange: true,
        targetFile: 'src/telegram/controllers/TelegramOpsController.ts',
        instruction: 'Corrigir o fluxo operacional do Telegram.',
        summary: 'Fix the Telegram domain and validate the bot.',
        confidence: 0.92,
        warnings: [],
        validationHints: [],
      }),
      externalSmokeService: externalSmokeService as any,
      supervisedRuntimeService: {
        summarizeRecentChanges: jest.fn().mockReturnValue('Changes e estado do Zavorth'),
        inspect: jest.fn().mockReturnValue(
          createInspection(root, {
            telegramWorker: {
              active: false,
              pid: null,
              owner: 'telegram-worker',
              startedAt: null,
              alive: false,
            },
            lastReloadReport: { status: 'failed' },
          }),
        ),
        requestReload,
      } as any,
      runtimeBootstrapRepairService: {
        repair: jest.fn().mockReturnValue(
          createBootstrapRepair(root, {
            finalInspection: {
              telegramWorker: {
                active: false,
                pid: null,
                owner: 'telegram-worker',
                startedAt: null,
                alive: false,
              },
              lastReloadReport: { status: 'failed' },
            },
          }),
        ),
      } as any,
      selfModificationService: {
        previewModification: jest.fn().mockResolvedValue({
          success: true,
          reason: 'Preview gerado com sucesso.',
          filePath: 'src/telegram/controllers/TelegramOpsController.ts',
          absolutePath: path.join(root, 'src', 'telegram', 'controllers', 'TelegramOpsController.ts'),
          isNewFile: false,
          instruction: 'Corrigir o fluxo operacional do Telegram.',
          currentContent: 'export const telegramOps = 1;\n',
          proposedContent: 'export const telegramOps = 2;\n',
          summary: 'Atualiza o controller do Telegram.',
          diffPatch: 'patch',
          stats: { insertions: 1, deletions: 1, changedLines: 2 },
          warnings: [],
          modelResponseRaw: '{}',
        }),
      } as any,
      safeModificationService: {
        validateCandidate: jest.fn().mockReturnValue({ passes: true, output: '' }),
        safeApply,
      } as any,
      execCommandSync: jest.fn().mockReturnValue('ok') as any,
    });

    const result = await service.run({
      reason: 'Corrigir o runtime do Telegram com smoke externo.',
      requestedBy: '42',
    });

    expect(result.status).toBe('failed');
    expect(result.report.attempts[0]?.status).toBe('rolled_back');
    expect(result.report.attempts[0]?.error).toContain('AIGateway-smoke');
    expect(externalSmokeService.run).toHaveBeenCalledWith(
      expect.objectContaining({
        targetFile: 'src/telegram/controllers/TelegramOpsController.ts',
        domains: expect.arrayContaining(['telegram']),
      }),
    );
    expect(safeApply).toHaveBeenNthCalledWith(
      2,
      path.join(root, 'src', 'telegram', 'controllers', 'TelegramOpsController.ts'),
      'export const telegramOps = 1;\n',
    );
    expect(requestReload).not.toHaveBeenCalled();
  });

  it('runs PowerShell parse, launcher smoke and launcher domain tests for supervised scripts', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-autorepair-launcher-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'autorepair-last.json');
    config.autoRepairReportFile = reportFile;

    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(root, 'tests', 'services'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'scripts', 'launch-zavorth-supervised.ps1'),
      'Write-Host "old launcher"\n',
      'utf8',
    );
    fs.writeFileSync(path.join(root, 'tests', 'host.test.ts'), 'test("host", () => expect(true).toBe(true));\n', 'utf8');
    fs.writeFileSync(
      path.join(root, 'tests', 'services', 'SupervisedRuntimeService.test.ts'),
      'test("runtime", () => expect(true).toBe(true));\n',
      'utf8',
    );

    const execCommandSyncMock = jest.fn().mockReturnValue('ok');
    const externalSmokeService = createExternalSmokeMock([
      {
        label: 'AIGateway-smoke',
        command: 'GET /models no AIGateway',
        status: 'passed',
        startedAt: '2026-04-01T12:00:00.000Z',
        finishedAt: '2026-04-01T12:00:01.000Z',
        durationMs: 1000,
        output: 'AIGateway responded with HTTP 200.',
      },
      {
        label: 'zavorth-bridge-remote-smoke',
        command: 'doctor do ZavorthBridge remoto',
        status: 'passed',
        startedAt: '2026-04-01T12:00:01.000Z',
        finishedAt: '2026-04-01T12:00:02.000Z',
        durationMs: 1000,
        output: 'ZavorthBridge remoto ready.',
      },
    ]);
    const service = new AutoRepairService({
      projectRoot: root,
      provider: createProvider({
        needsCodeChange: true,
        targetFile: 'scripts/launch-zavorth-supervised.ps1',
        instruction: 'Ajustar o launcher supervisionado sem mudar o fluxo principal.',
        summary: 'Fix the launcher and validate the supervised domain.',
        confidence: 0.91,
        warnings: [],
        validationHints: [],
      }),
      supervisedRuntimeService: {
        summarizeRecentChanges: jest.fn().mockReturnValue('Changes e estado do Zavorth'),
        inspect: jest.fn().mockReturnValue(
          createInspection(root, {
            buildRequired: true,
            lastReloadReport: { status: 'failed' },
          }),
        ),
        requestReload: jest.fn().mockResolvedValue({
          accepted: true,
          requestId: 'reload-launcher',
          summary: 'Reload aceito pelo host.',
        }),
      } as any,
      runtimeBootstrapRepairService: {
        repair: jest.fn().mockReturnValue(
          createBootstrapRepair(root, {
            finalInspection: {
              buildRequired: true,
              lastReloadReport: { status: 'failed' },
            },
          }),
        ),
      } as any,
      selfModificationService: {
        previewModification: jest.fn().mockResolvedValue({
          success: true,
          reason: 'Preview gerado com sucesso.',
          filePath: 'scripts/launch-zavorth-supervised.ps1',
          absolutePath: path.join(root, 'scripts', 'launch-zavorth-supervised.ps1'),
          isNewFile: false,
          instruction: 'Ajustar o launcher supervisionado sem mudar o fluxo principal.',
          currentContent: 'Write-Host "old launcher"\n',
          proposedContent: 'Write-Host "new launcher"\n',
          summary: 'Atualiza o launcher.',
          diffPatch: 'patch',
          stats: { insertions: 1, deletions: 1, changedLines: 2 },
          warnings: [],
          modelResponseRaw: '{}',
        }),
      } as any,
      safeModificationService: {
        validateCandidate: jest.fn().mockReturnValue({ passes: true, output: '' }),
        safeApply: jest.fn().mockResolvedValue({
          success: true,
          reason: 'File atualizado com security.',
        }),
      } as any,
      incidentMemoryService: createIncidentMemoryMock() as any,
      externalSmokeService: externalSmokeService as any,
      execCommandSync: execCommandSyncMock as any,
    });

    const result = await service.run({
      reason: 'Corrigir o launcher supervisionado.',
      requestedBy: '42',
    });

    expect(result.status).toBe('reloaded');
    expect(execCommandSyncMock.mock.calls.some(([command, args]) => {
      const joined = [String(command), ...(args || [])].join(' ');
      return joined.includes('launch-zavorth-supervised.ps1') && joined.includes('-DryRun') && joined.includes('-Headless');
    })).toBe(true);
    expect(execCommandSyncMock.mock.calls.some(([command, args]) => {
      const joined = [String(command), ...(args || [])].join(' ');
      return joined.toLowerCase().includes('powershell') && joined.includes(path.join(root, 'scripts', 'launch-zavorth-supervised.ps1'));
    })).toBe(true);
    expect(execCommandSyncMock.mock.calls.some(([command, args]) => {
      return String(command).includes('npm') &&
        Array.isArray(args) &&
        args.includes('tests/host.test.ts') &&
        args.includes('tests/services/SupervisedRuntimeService.test.ts');
    })).toBe(true);
    expect(externalSmokeService.run).toHaveBeenCalledWith(
      expect.objectContaining({
        targetFile: 'scripts/launch-zavorth-supervised.ps1',
        domains: expect.arrayContaining(['launcher', 'host']),
      }),
    );
  });

  it('runs telegram domain tests when the target file belongs to the telegram runtime', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-autorepair-telegram-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'autorepair-last.json');
    config.autoRepairReportFile = reportFile;

    fs.mkdirSync(path.join(root, 'src', 'telegram', 'controllers'), { recursive: true });
    fs.mkdirSync(path.join(root, 'tests', 'telegram', 'controllers'), { recursive: true });
    fs.mkdirSync(path.join(root, 'tests', 'telegram'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'src', 'telegram', 'controllers', 'TelegramOpsController.ts'),
      'export const telegramOps = 1;\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'tests', 'telegram', 'controllers', 'TelegramOpsController.test.ts'),
      'test("ops", () => expect(true).toBe(true));\n',
      'utf8',
    );
    fs.writeFileSync(path.join(root, 'tests', 'telegram', 'CommandParser.test.ts'), 'test("parser", () => expect(true).toBe(true));\n', 'utf8');
    fs.writeFileSync(path.join(root, 'tests', 'telegram', 'AuthGuard.test.ts'), 'test("auth", () => expect(true).toBe(true));\n', 'utf8');

    const execCommandSyncMock = jest.fn().mockReturnValue('ok');
    const externalSmokeService = createExternalSmokeMock([
      {
        label: 'AIGateway-smoke',
        command: 'GET /models no AIGateway',
        status: 'passed',
        startedAt: '2026-04-01T12:00:00.000Z',
        finishedAt: '2026-04-01T12:00:01.000Z',
        durationMs: 1000,
        output: 'AIGateway responded with HTTP 200.',
      },
    ]);
    const service = new AutoRepairService({
      projectRoot: root,
      provider: createProvider({
        needsCodeChange: true,
        targetFile: 'src/telegram/controllers/TelegramOpsController.ts',
        instruction: 'Corrigir o fluxo operacional do Telegram.',
        summary: 'Fix the Telegram domain and validate the bot tests.',
        confidence: 0.9,
        warnings: [],
        validationHints: [],
      }),
      supervisedRuntimeService: {
        summarizeRecentChanges: jest.fn().mockReturnValue('Changes e estado do Zavorth'),
        inspect: jest.fn().mockReturnValue(
          createInspection(root, {
            telegramWorker: {
              active: false,
              pid: null,
              owner: 'telegram-worker',
              startedAt: null,
              alive: false,
            },
            lastReloadReport: { status: 'failed' },
          }),
        ),
        requestReload: jest.fn().mockResolvedValue({
          accepted: true,
          requestId: 'reload-telegram',
          summary: 'Reload aceito pelo host.',
        }),
      } as any,
      runtimeBootstrapRepairService: {
        repair: jest.fn().mockReturnValue(
          createBootstrapRepair(root, {
            finalInspection: {
              telegramWorker: {
                active: false,
                pid: null,
                owner: 'telegram-worker',
                startedAt: null,
                alive: false,
              },
              lastReloadReport: { status: 'failed' },
            },
          }),
        ),
      } as any,
      selfModificationService: {
        previewModification: jest.fn().mockResolvedValue({
          success: true,
          reason: 'Preview gerado com sucesso.',
          filePath: 'src/telegram/controllers/TelegramOpsController.ts',
          absolutePath: path.join(root, 'src', 'telegram', 'controllers', 'TelegramOpsController.ts'),
          isNewFile: false,
          instruction: 'Corrigir o fluxo operacional do Telegram.',
          currentContent: 'export const telegramOps = 1;\n',
          proposedContent: 'export const telegramOps = 2;\n',
          summary: 'Atualiza o controller do Telegram.',
          diffPatch: 'patch',
          stats: { insertions: 1, deletions: 1, changedLines: 2 },
          warnings: [],
          modelResponseRaw: '{}',
        }),
      } as any,
      safeModificationService: {
        validateCandidate: jest.fn().mockReturnValue({ passes: true, output: '' }),
        safeApply: jest.fn().mockResolvedValue({
          success: true,
          reason: 'File atualizado com security.',
        }),
      } as any,
      incidentMemoryService: createIncidentMemoryMock() as any,
      externalSmokeService: externalSmokeService as any,
      execCommandSync: execCommandSyncMock as any,
    });

    const result = await service.run({
      reason: 'Corrigir o runtime do Telegram.',
      requestedBy: '42',
    });

    expect(result.status).toBe('reloaded');
    expect(execCommandSyncMock.mock.calls.some(([command, args]) => {
      return String(command).includes('npm') &&
        Array.isArray(args) &&
        args.includes('tests/telegram/controllers/TelegramOpsController.test.ts') &&
        args.includes('tests/telegram/CommandParser.test.ts') &&
        args.includes('tests/telegram/AuthGuard.test.ts');
    })).toBe(true);
    expect(externalSmokeService.run).toHaveBeenCalledWith(
      expect.objectContaining({
        targetFile: 'src/telegram/controllers/TelegramOpsController.ts',
        domains: expect.arrayContaining(['telegram']),
      }),
    );
  });

  it('rolls back the file when contextual external smoke fails after local validation', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-autorepair-external-smoke-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'autorepair-last.json');
    config.autoRepairReportFile = reportFile;
    config.autoRepairMaxAttempts = 1;

    fs.mkdirSync(path.join(root, 'src', 'services'), { recursive: true });
    fs.mkdirSync(path.join(root, 'tests', 'services'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'services', 'FixService.ts'), 'export const value = 1;\n', 'utf8');
    fs.writeFileSync(path.join(root, 'tests', 'services', 'FixService.test.ts'), 'test("ok", () => expect(true).toBe(true));\n', 'utf8');

    const safeApply = jest
      .fn()
      .mockResolvedValueOnce({
        success: true,
        reason: 'File atualizado com security.',
      })
      .mockResolvedValueOnce({
        success: true,
        reason: 'Rollback aplicado com security.',
      });
    const externalSmokeService = createExternalSmokeMock([
      {
        label: 'AIGateway-smoke',
        command: 'GET /models no AIGateway',
        status: 'failed',
        startedAt: '2026-04-01T12:00:00.000Z',
        finishedAt: '2026-04-01T12:00:01.000Z',
        durationMs: 1000,
        output: 'AIGateway retornou 503.',
      },
    ]);
    const service = new AutoRepairService({
      projectRoot: root,
      provider: createProvider({
        needsCodeChange: true,
        targetFile: 'src/services/FixService.ts',
        instruction: 'Corrigir o servico e manter compatibilidade.',
        summary: 'Corrigir um unico servico e validar o teste relacionado.',
        confidence: 0.88,
        warnings: [],
        validationHints: ['tests/services/FixService.test.ts'],
      }),
      supervisedRuntimeService: {
        summarizeRecentChanges: jest.fn().mockReturnValue('Changes e estado do Zavorth'),
        inspect: jest.fn().mockReturnValue(
          createInspection(root, {
            buildRequired: true,
            lastReloadReport: { status: 'failed' },
          }),
        ),
        requestReload: jest.fn(),
      } as any,
      runtimeBootstrapRepairService: {
        repair: jest.fn().mockReturnValue(
          createBootstrapRepair(root, {
            finalInspection: {
              buildRequired: true,
              lastReloadReport: { status: 'failed' },
            },
          }),
        ),
      } as any,
      selfModificationService: {
        previewModification: jest.fn().mockResolvedValue({
          success: true,
          reason: 'Preview gerado com sucesso.',
          filePath: 'src/services/FixService.ts',
          absolutePath: path.join(root, 'src', 'services', 'FixService.ts'),
          isNewFile: false,
          instruction: 'Corrigir o servico e manter compatibilidade.',
          currentContent: 'export const value = 1;\n',
          proposedContent: 'export const value = 2;\n',
          summary: 'Corrige o value exportado.',
          diffPatch: 'patch',
          stats: { insertions: 1, deletions: 1, changedLines: 2 },
          warnings: [],
          modelResponseRaw: '{}',
        }),
      } as any,
      safeModificationService: {
        validateCandidate: jest.fn().mockReturnValue({ passes: true, output: '' }),
        safeApply,
      } as any,
      incidentMemoryService: createIncidentMemoryMock() as any,
      externalSmokeService: externalSmokeService as any,
      execCommandSync: jest.fn().mockReturnValue('ok') as any,
    });

    const result = await service.run({
      reason: 'Validar rollback quando o smoke externo failure.',
      requestedBy: '42',
    });

    expect(result.status).toBe('failed');
    expect(result.summary).toContain('Smokes externos: 0 ok | 1 failure(s) | 0 skipped item(s).');
    expect(result.report.attempts[0]?.status).toBe('rolled_back');
    expect(result.report.attempts[0]?.error).toContain('AIGateway-smoke');
    expect(safeApply).toHaveBeenNthCalledWith(
      2,
      path.join(root, 'src', 'services', 'FixService.ts'),
      'export const value = 1;\n',
    );
  });
});
