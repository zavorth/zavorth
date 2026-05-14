import { execFileSync, spawn, type ChildProcess, type ExecFileSyncOptions, type SpawnOptions } from 'child_process';

function quoteWindowsArg(value: string): string {
  const normalized = String(value ?? '');
  if (!normalized) {
    return '""';
  }

  if (!/[\s"&()<>^|%!]/.test(normalized)) {
    return normalized;
  }

  const escaped = normalized.replace(/(["^&|<>()%!])/g, '^$1');
  return `"${escaped}"`;
}

export function spawnCommand(command: string, args: string[], options: SpawnOptions = {}): ChildProcess {
  if (process.platform !== 'win32') {
    return spawn(command, args, {
      ...options,
      shell: false,
    });
  }

  const commandLine = [command, ...args].map(quoteWindowsArg).join(' ');
  return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', commandLine], {
    ...options,
    shell: false,
  });
}

export function spawnNativeCommand(
  command: string,
  args: string[],
  options: SpawnOptions = {},
): ChildProcess {
  return spawn(command, args, {
    ...options,
    shell: false,
  });
}

export function spawnShellCommand(commandLine: string, options: SpawnOptions = {}): ChildProcess {
  if (process.platform === 'win32') {
    return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', commandLine], {
      ...options,
      shell: false,
    });
  }

  return spawn('/bin/sh', ['-lc', commandLine], {
    ...options,
    shell: false,
  });
}

export function execCommandSync(command: string, args: string[], options: ExecFileSyncOptions = {}): string | Buffer {
  if (process.platform !== 'win32') {
    return execFileSync(command, args, {
      ...options,
      shell: false,
    });
  }

  const commandLine = [command, ...args].map(quoteWindowsArg).join(' ');
  return execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', commandLine], {
    ...options,
    shell: false,
  });
}

export function execNativeCommandSync(
  command: string,
  args: string[],
  options: ExecFileSyncOptions = {},
): string | Buffer {
  return execFileSync(command, args, {
    ...options,
    shell: false,
  });
}
