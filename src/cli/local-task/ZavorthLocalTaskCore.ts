import { spawnSync, type SpawnSyncReturns } from 'child_process';

export type ZavorthLocalTaskId = 'install' | 'build' | 'check';

export type ZavorthLocalTaskResult = {
  task: ZavorthLocalTaskId;
  ok: boolean;
  command: string;
  durationMs: number;
  exitCode: number | null;
  summary: string;
  outputTail: string[];
  nextActions: string[];
};

export type ZavorthLocalTaskRunner = (command: string, args: string[]) => SpawnSyncReturns<string>;

export const ZAVORTH_LOCAL_TASKS: Record<ZavorthLocalTaskId, {
  title: string;
  command: string;
  args: string[];
  summary: string;
  next: string[];
}> = {
  install: {
    title: 'Install dependencies',
    command: npmCommand(),
    args: ['install', '--no-audit', '--fund=false'],
    summary: 'Dependencies are installed and ready for local Zavorth commands.',
    next: ['zavorth build', 'zavorth setup', 'zavorth inspect'],
  },
  build: {
    title: 'Build Zavorth',
    command: npmCommand(),
    args: ['run', 'build', '--silent'],
    summary: 'Zavorth was built and local launchers are ready.',
    next: ['zavorth inspect', 'zavorth -p "what can you do..."', 'zavorth open'],
  },
  check: {
    title: 'Run premium QA',
    command: npmCommand(),
    args: ['run', 'premium-distribution:qa', '--silent'],
    summary: 'Premium distribution and terminal UX gates passed.',
    next: ['zavorth inspect', 'zavorth doctor', 'zavorth open'],
  },
};

export function runLocalTask(taskId: ZavorthLocalTaskId, runner: ZavorthLocalTaskRunner = defaultRunner): ZavorthLocalTaskResult {
  const task = ZAVORTH_LOCAL_TASKS[taskId];
  const started = Date.now();
  const execution = runner(task.command, task.args);
  const durationMs = Date.now() - started;
  const combined = `${execution.stdout || ''}\n${execution.stderr || ''}`;
  const ok = execution.status === 0;
  return {
    task: taskId,
    ok,
    command: [task.command, ...task.args].join(' '),
    durationMs,
    exitCode: execution.status,
    summary: ok ? task.summary : `${task.title} failed. Review the output tail below.`,
    outputTail: ok ? [] : tailLines(combined, 10),
    nextActions: ok ? task.next : [`Run ${[task.command, ...task.args].join(' ')} for full raw output.`, 'Fix the first failing line, then retry.'],
  };
}

export function defaultRunner(command: string, args: string[]): SpawnSyncReturns<string> {
  const isWindowsCmd = process.platform === 'win32' && /\.cmd$/i.test(command);
  return spawnSync(isWindowsCmd ? 'cmd.exe' : command, isWindowsCmd ? ['/d', '/c', command, ...args] : args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

function tailLines(value: string, limit: number): string[] {
  return String(value || '')
    .split(/\r...\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(-limit);
}

function npmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}
