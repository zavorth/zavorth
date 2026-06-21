import fs from 'fs';
import path from 'path';
import { RuntimeBootstrapService } from '../../src/services/RuntimeBootstrapService.js';

describe('RuntimeBootstrapService - Stage 4 Diagnostics', () => {
  const baseSupervisedInspection = {
    projectRoot: 'C:/tmp/zavorth',
    gitAvailable: true,
    branch: 'main',
    modifiedFiles: [],
    stagedFiles: [],
    untrackedFiles: [],
    recentCommits: [],
    installRequired: false,
    buildRequired: false,
    hostSupervisor: { active: false, pid: null, owner: null, startedAt: null, alive: false },
    telegramWorker: { active: false, pid: null, owner: null, startedAt: null, alive: false },
    accessReadiness: {
      checkedAt: '2026-03-31T10:05:00.000Z',
      runtime: {
        hostSupervisor: { active: false, pid: null, owner: null, startedAt: null, alive: false },
        telegramWorker: { active: false, pid: null, owner: null, startedAt: null, alive: false },
        nodeMeshSmoke: { status: 'passed' },
        channelProviderDoctor: { status: 'passed' },
        remoteTransportDoctor: { status: 'passed' },
        hostAuthorized: true,
        firstRun: false,
      },
      auth: { enabled: true, source: 'env', tokenFile: 'token.txt' },
      local: { baseUrl: 'http://127.0.0.1:33333', dashboardUrl: 'http://127.0.0.1:33333/', appUrl: 'http://127.0.0.1:33333/app', ready: true, issues: [] },
      remote: { baseUrl: 'https://zavorth.example.com', appUrl: 'https://zavorth.example.com/app', ready: true, issues: [] },
      recommendations: [],
      nextSteps: [],
      summary: 'Zavorth ready.',
    },
    lastReloadReport: null,
  };

  const mockPlatformService = {
    getCapabilities: () => [
      {
        platform: 'telegram',
        implementationState: 'full',
        readiness: 'ready',
        configured: true,
        transport: 'native',
        envKeys: ['TELEGRAM_BOT_TOKEN'],
      },
    ],
  };

  const mockModelPicker = {
    buildContract: () => ({
      selected: {
        source: 'current-config',
        providerName: 'gemini',
        providerLabel: 'Gemini',
        modelName: 'gemini-3.1-flash',
        modelLabel: 'gemini-3.1-flash',
        readiness: 'ready',
        ready: true,
        explanation: [],
      },
    }),
  };

  it('detects stuck host supervisor and telegram worker process locks', () => {
    const service = new RuntimeBootstrapService({
      existsSync: () => true, // config file exists
      llmProvider: 'gemini',
      llmCredentialReady: true,
      supervisedRuntimeService: {
        inspect: () => ({
          ...baseSupervisedInspection,
          hostSupervisor: { active: true, pid: 3001, owner: 'host-supervisor', startedAt: '2026-03-31T10:00:00.000Z', alive: false }, // stuck!
          telegramWorker: { active: true, pid: 3002, owner: 'telegram-worker', startedAt: '2026-03-31T10:00:02.000Z', alive: false }, // stuck!
        }),
      } as any,
      platformCapabilityService: mockPlatformService as any,
      modelPickerContractService: mockModelPicker as any,
    });

    const report = service.inspect();
    const clearLocksAction = report.actions.find((action) => action.id === 'clear-stuck-locks');

    expect(clearLocksAction).toBeDefined();
    expect(clearLocksAction?.reason).toContain('host supervisor and telegram worker');
    expect(clearLocksAction?.autoFixCommand).toEqual(
      expect.objectContaining({
        args: expect.arrayContaining(['tsx', 'scripts/ops-doctor-repair-helper.ts', 'clear-locks']),
      })
    );
  });

  it('detects missing skill-sources.json configuration file', () => {
    const service = new RuntimeBootstrapService({
      existsSync: (file) => !String(file).endsWith('skill-sources.json'), // skill-sources.json is missing
      llmProvider: 'gemini',
      llmCredentialReady: true,
      supervisedRuntimeService: {
        inspect: () => baseSupervisedInspection,
      } as any,
      platformCapabilityService: mockPlatformService as any,
      modelPickerContractService: mockModelPicker as any,
    });

    const report = service.inspect();
    const repairConfigAction = report.actions.find((action) => action.id === 'repair-skill-sources-config');

    expect(repairConfigAction).toBeDefined();
    expect(repairConfigAction?.reason).toContain('configuration file is missing');
    expect(repairConfigAction?.autoFixCommand).toEqual(
      expect.objectContaining({
        args: expect.arrayContaining(['tsx', 'scripts/ops-doctor-repair-helper.ts', 'repair-skill-sources']),
      })
    );
  });

  it('detects missing local skill source directories when config is healthy', () => {
    const mockConfigContent = JSON.stringify({
      version: 1,
      sources: [
        {
          id: 'test-source',
          enabled: true,
          createIfMissing: true,
          path: 'missing-library-dir',
        },
      ],
    });

    const mockReadFileSync = jest.spyOn(fs, 'readFileSync').mockImplementation((filePath: any) => {
      if (String(filePath).endsWith('skill-sources.json')) {
        return mockReadFileSync; // Wait, we can return the string directly!
      }
      throw new Error('Unexpected read');
    });

    // Mock fs.readFileSync with a real spy
    const originalReadFileSync = fs.readFileSync;
    (fs as any).readFileSync = (filePath: any, encoding: any) => {
      if (String(filePath).replace(/\\/g, '/').endsWith('config/skill-sources.json')) {
        return mockConfigContent;
      }
      return originalReadFileSync(filePath, encoding);
    };

    const service = new RuntimeBootstrapService({
      existsSync: (filePath) => {
        const normalized = String(filePath).replace(/\\/g, '/');
        if (normalized.endsWith('config/skill-sources.json')) {
          return true; // Config file exists
        }
        if (normalized.endsWith('missing-library-dir')) {
          return false; // Directory is missing
        }
        return true;
      },
      llmProvider: 'gemini',
      llmCredentialReady: true,
      supervisedRuntimeService: {
        inspect: () => baseSupervisedInspection,
      } as any,
      platformCapabilityService: mockPlatformService as any,
      modelPickerContractService: mockModelPicker as any,
    });

    try {
      const report = service.inspect();
      const createDirsAction = report.actions.find((action) => action.id === 'create-missing-skill-source-dirs');

      expect(createDirsAction).toBeDefined();
      expect(createDirsAction?.reason).toContain('Missing enabled local skill source directories: missing-library-dir');
      expect(createDirsAction?.autoFixCommand).toEqual(
        expect.objectContaining({
          args: expect.arrayContaining(['tsx', 'scripts/ops-doctor-repair-helper.ts', 'repair-skill-sources']),
        })
      );
    } finally {
      // Restore fs.readFileSync
      fs.readFileSync = originalReadFileSync;
    }
  });
});
