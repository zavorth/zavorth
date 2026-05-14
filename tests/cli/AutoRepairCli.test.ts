const runMock = jest.fn();

jest.mock('../../src/services/AutoRepairService', () => {
  return {
    AutoRepairService: jest.fn().mockImplementation(() => ({
      run: runMock,
    })),
  };
});

import { parseAutoRepairCliFlags, runAutoRepairCli } from '../../src/cli/AutoRepairCli';

describe('AutoRepairCli', () => {
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    logSpy.mockRestore();
  });

  it('parses the main autorepair flags in a compact form', () => {
    const flags = parseAutoRepairCliFlags([
      '--reason',
      'Falha de boot',
      '--requested-by',
      'launcher',
      '--force',
      '--repair',
      '--json',
    ]);

    expect(flags.reason).toBe('Falha de boot');
    expect(flags.requestedBy).toBe('launcher');
    expect(flags.force).toBe(true);
    expect(flags.goal).toBe('repair');
    expect(flags.json).toBe(true);
  });

  it('runs the autorepair service and returns an exit code derived from success', async () => {
    runMock.mockResolvedValue({
      success: true,
      summary: 'Autoreparo concluido.',
      report: { status: 'reloaded' },
    });

    const exitCode = await runAutoRepairCli([
      '--reason',
      'Corrigir e religar',
      '--requested-by',
      '42',
      '--dry-run',
      '--improve',
    ]);

    expect(exitCode).toBe(0);
    expect(runMock).toHaveBeenCalledWith({
      reason: 'Corrigir e religar',
      requestedBy: '42',
      dryRun: true,
      force: false,
      goal: 'improve',
    });
    expect(logSpy).toHaveBeenCalledWith('Autoreparo concluido.');
  });
});
