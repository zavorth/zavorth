export type PathSafeProcessLaunchPlan = {
  executable: string;
  args: string[];
  displayCommand: string;
};

export class PathSafeProcessLauncherService {
  public buildPlan(input: {
    executable: string;
    args?: string[];
  }): PathSafeProcessLaunchPlan {
    const executable = String(input.executable || '').trim();
    if (!executable) {
      throw new Error('Executable obrigatorio para montar um launch plan seguro.');
    }

    const args = Array.isArray(input.args)
      ? input.args.map((entry) => String(entry ?? ''))
      : [];

    return {
      executable,
      args,
      displayCommand: [executable, ...args].map((entry) => this.quoteIfNeeded(entry)).join(' '),
    };
  }

  public buildPowerShellFilePlan(input: {
    powershellExecutable?: string;
    scriptPath: string;
    scriptArgs?: string[];
  }): PathSafeProcessLaunchPlan {
    const executable = String(
      input.powershellExecutable
      || (process.platform === 'win32'
        ? `${process.env.SystemRoot || 'C:\\Windows'}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
        : 'pwsh'),
    ).trim();
    const scriptPath = String(input.scriptPath || '').trim();
    if (!scriptPath) {
      throw new Error('scriptPath obrigatorio para o launch plan do PowerShell.');
    }

    return this.buildPlan({
      executable,
      args: [
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
        ...(input.scriptArgs || []).map((entry) => String(entry ?? '')),
      ],
    });
  }

  private quoteIfNeeded(value: string): string {
    if (!/[ \t"]/u.test(value)) {
      return value;
    }
    return `"${value.replace(/(["`\\$])/g, '\\$1')}"`;
  }
}
