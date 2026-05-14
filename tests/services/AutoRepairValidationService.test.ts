import fs from 'fs';
import os from 'os';
import path from 'path';
import { AutoRepairValidationService } from '../../src/services/autorepair/AutoRepairValidationService.js';

describe('AutoRepairValidationService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('runs build, related telegram tests and contextual external smokes for a telegram target', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-autorepair-validation-'));
    tempDirs.push(root);
    fs.mkdirSync(path.join(root, 'src', 'telegram', 'controllers'), { recursive: true });
    fs.mkdirSync(path.join(root, 'tests', 'telegram', 'controllers'), { recursive: true });
    fs.mkdirSync(path.join(root, 'tests', 'telegram'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'telegram', 'controllers', 'TelegramOpsController.ts'), 'export {};\n');
    fs.writeFileSync(path.join(root, 'tests', 'telegram', 'controllers', 'TelegramOpsController.test.ts'), 'test("ok", () => {});\n');
    fs.writeFileSync(path.join(root, 'tests', 'telegram', 'CommandParser.test.ts'), 'test("ok", () => {});\n');
    fs.writeFileSync(path.join(root, 'tests', 'telegram', 'AuthGuard.test.ts'), 'test("ok", () => {});\n');

    const execCommandSync = jest.fn().mockReturnValue('ok');
    const externalSmokeService = {
      run: jest.fn().mockResolvedValue([
        {
          label: 'AIGateway-smoke',
          command: 'GET /models no AIGateway',
          status: 'passed',
          startedAt: '2026-04-16T12:00:00.000Z',
          finishedAt: '2026-04-16T12:00:01.000Z',
          durationMs: 1000,
          output: 'AIGateway respondeu com HTTP 200.',
        },
      ]),
    };
    const service = new AutoRepairValidationService({
      projectRoot: root,
      safeModificationService: {
        validateCandidate: jest.fn().mockReturnValue({ passes: true, output: '' }),
      } as any,
      externalSmokeService: externalSmokeService as any,
      execCommandSync: execCommandSync as any,
      now: () => new Date('2026-04-16T12:00:00.000Z'),
    });

    const steps = await service.runValidationSuite('src/telegram/controllers/TelegramOpsController.ts', []);

    expect(steps.map((step) => step.label)).toEqual(['build', 'tests', 'AIGateway-smoke']);
    expect(execCommandSync).toHaveBeenCalledWith(
      expect.stringContaining('npm'),
      expect.arrayContaining(['run', 'build']),
      expect.any(Object),
    );
    expect(execCommandSync).toHaveBeenCalledWith(
      expect.stringContaining('npm'),
      expect.arrayContaining([
        'test',
        '--',
        '--runInBand',
        'tests/telegram/controllers/TelegramOpsController.test.ts',
        'tests/telegram/CommandParser.test.ts',
        'tests/telegram/AuthGuard.test.ts',
      ]),
      expect.objectContaining({ cwd: root }),
    );
    expect(externalSmokeService.run).toHaveBeenCalledWith(
      expect.objectContaining({
        targetFile: 'src/telegram/controllers/TelegramOpsController.ts',
        domains: ['telegram'],
      }),
    );
  });

  it('keeps target safety and candidate discovery centralized', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-autorepair-targets-'));
    tempDirs.push(root);
    const service = new AutoRepairValidationService({
      projectRoot: root,
      safeModificationService: {
        validateCandidate: jest.fn(),
      } as any,
      externalSmokeService: {
        run: jest.fn(),
      } as any,
    });

    expect(service.validateTarget('src/services/FixService.ts')).toEqual(
      expect.objectContaining({
        allowed: true,
        normalizedRelativePath: 'src/services/FixService.ts',
      }),
    );
    expect(service.validateTarget('../outside.ts')).toEqual(
      expect.objectContaining({
        allowed: false,
        normalizedRelativePath: null,
      }),
    );
    expect(service.collectCandidateFiles([
      'Falha em src/services/FixService.ts e em C:/tmp/unsafe.ts.',
      'Tambem verificar tests/services/FixService.test.ts.',
    ])).toEqual([
      'src/services/FixService.ts',
      'tests/services/FixService.test.ts',
    ]);
    expect(service.inferValidationDomains('scripts/launch-zavorth-supervised.ps1', [])).toEqual(
      expect.arrayContaining(['launcher', 'host']),
    );
  });
});
