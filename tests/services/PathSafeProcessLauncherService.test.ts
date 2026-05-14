import { PathSafeProcessLauncherService } from '../../src/services/PathSafeProcessLauncherService';

describe('PathSafeProcessLauncherService', () => {
  it('quotes executables and args with spaces for display output', () => {
    const service = new PathSafeProcessLauncherService();

    const plan = service.buildPlan({
      executable: 'C:\\Program Files\\nodejs\\npm.cmd',
      args: ['run', 'ops:start', '--workspace', 'C:\\TESTES DEV\\zavorth-core\\Zavorth'],
    });

    expect(plan.displayCommand).toContain('"C:\\\\Program Files\\\\nodejs\\\\npm.cmd"');
    expect(plan.displayCommand).toContain('"C:\\\\TESTES DEV\\\\zavorth-core\\\\Zavorth"');
  });

  it('builds a PowerShell file launch plan safely on Windows-style paths', () => {
    const service = new PathSafeProcessLauncherService();

    const plan = service.buildPowerShellFilePlan({
      powershellExecutable: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      scriptPath: 'C:\\TESTES DEV\\zavorth-core\\Zavorth\\scripts\\repair-runtime.ps1',
      scriptArgs: ['-Mode', 'repair'],
    });

    expect(plan.displayCommand).toContain('-ExecutionPolicy Bypass -File');
    expect(plan.displayCommand).toContain('"C:\\\\TESTES DEV\\\\zavorth-core\\\\Zavorth\\\\scripts\\\\repair-runtime.ps1"');
  });
});
