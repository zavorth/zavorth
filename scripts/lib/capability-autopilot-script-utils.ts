import { execFileSync } from 'child_process';

export type ForwardedArgOptions = {
  dropArgs?: string[];
  dropPrefixes?: string[];
};

export function readArg(argv: string[], prefix: string): string | null {
  const found = argv.find((arg) => arg.startsWith(prefix));
  const value = found ? found.slice(prefix.length).trim() : '';
  return value || null;
}

export function readNumberArg(argv: string[], prefix: string, fallback: number): number {
  const value = readOptionalNumberArg(argv, prefix);
  return value === undefined ? fallback : value;
}

export function readOptionalNumberArg(argv: string[], prefix: string): number | undefined {
  const raw = readArg(argv, prefix);
  if (!raw) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function buildForwardedArgs(
  argv: string[],
  options: ForwardedArgOptions,
): string[] {
  const dropArgs = new Set(options.dropArgs || []);
  const dropPrefixes = options.dropPrefixes || [];
  return argv.filter((arg) =>
    !dropArgs.has(arg) &&
    !dropPrefixes.some((prefix) => arg.startsWith(prefix))
  );
}

export function readNestedJsonFromTsxScript<T>(
  scriptPath: string,
  argv: string[],
  options: ForwardedArgOptions,
): T {
  const forwardedArgs = buildForwardedArgs(argv, options);
  const tsxArgs = ['tsx', scriptPath, '--json', ...forwardedArgs];
  const executable = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npx', ...tsxArgs]
    : tsxArgs;
  const output = execFileSync(
    executable,
    args,
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  return JSON.parse(output) as T;
}
