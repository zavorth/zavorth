import { parseAutoRepairCliFlags, runAutoRepairCli } from '../../src/cli/AutoRepairCli';
import { logger } from '../../src/logger';
const runMock = jest.fn();

jest.mock('../../src/services/AutoRepairService', () => {
  return {
    AutoRepairService: jest.fn().mockImplementation(() => ({
      run: runMock,
    })),
  };
});


describe('AutoRepairCli', () => {
  const logSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    logSpy.mockRestore();
  });

  it('parses the main autorepair flags in a compact form', () => {
    const flags = parseAutoRepairCliFlags([
      '--reason',
      'Boot failure',
      '--requested-by',
      'launcher',
      '--force',
      '--repair',
      '--json',
    ]);

    expect(flags.reason).toBe('Boot failure');
    expect(flags.requestedBy).toBe('launcher');
    expect(flags.force).toBe(true);
    expect(flags.goal).toBe('repair');
    expect(flags.json).toBe(true);
  });

  it('runs the autorepair service and returns an exit code derived from success', async () => {
    runMock.mockResolvedValue({
      success: true,
      summary: 'Autorepair completed.',
      report: { status: 'reloaded' },
    });

    const exitCode = await runAutoRepairCli([
      '--reason',
      'Fix and reconnect',
      '--requested-by',
      '42',
      '--dry-run',
      '--improve',
    ]);

    expect(exitCode).toBe(0);
    expect(runMock).toHaveBeenCalledWith({
      reason: 'Fix and reconnect',
      requestedBy: '42',
      dryRun: true,
      force: false,
      goal: 'improve',
    });
    expect(logSpy).toHaveBeenCalledWith('Autorepair completed.');
  });
});
