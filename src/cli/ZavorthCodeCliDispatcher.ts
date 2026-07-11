import { spawn, type ChildProcess, type SpawnOptions } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

export type ZavorthCodeCliLaunchPlan =
  | {
      kind: 'spawn';
      command: string;
      args: string[];
      cwd: string;
      env?: NodeJS.ProcessEnv;
      label: string;
    }
  | {
      kind: 'missing';
      message: string;
      hints: string[];
    };

export type ResolveZavorthCodeCliLaunchOptions = {
  projectRoot: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  whichCommand?: (name: string) => string | null;
  cwd?: string;
};

export type RunZavorthCodeCliOptions = {
  projectRoot: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  whichCommand?: (name: string) => string | null;
  cwd?: string;
  spawnFn?: (
    command: string,
    args: string[],
    options: SpawnOptions,
  ) => ChildProcess;
};

const BUN_WIN_CANDIDATES = [
  'bun.cmd',
  'bun.exe',
  'bun',
];

const BUN_POSIX_CANDIDATES = ['bun',
];

function isNonEmpty(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function splitPathEnv(pathEnv: string | undefined, platform: NodeJS.Platform): string[] {
  if (!pathEnv) {
    return [];
  }
  const delimiter = platform === 'win32' ? ';' : ':';
  return pathEnv.split(delimiter).map((entry) => entry.trim()).filter(Boolean);
}

function fileExists(candidate: string): boolean {
  try {
    return existsSync(candidate);
  } catch {
    return false;
  }
}

function lookInDir(dir: string, names: string[]): string | null {
  for (const name of names) {
    const candidate = path.join(dir, name);
    if (fileExists(candidate)) {
      return candidate;
    }
  }
  return null;
}

function defaultWhichCommand(
  name: string,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
): string | null {
  const pathDirs = splitPathEnv(env.PATH || env.Path, platform);
  const names =
    platform === 'win32'
      ? name.toLowerCase().endsWith('.cmd') || name.toLowerCase().endsWith('.exe')
        ? [name]
        : [`${name}.cmd`, `${name}.exe`, name]
      : [name];

  for (const dir of pathDirs) {
    const found = lookInDir(dir, names);
    if (found) {
      return found;
    }
  }
  return null;
}

function resolveBunCommand(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  whichCommand: (name: string) => string | null,
): string | null {
  const names = platform === 'win32' ? BUN_WIN_CANDIDATES : BUN_POSIX_CANDIDATES;

  for (const name of names) {
    const fromWhich = whichCommand(name);
    if (fromWhich) {
      return fromWhich;
    }
  }

  const home = env.USERPROFILE || env.HOME || '';
  const commonDirs: string[] = [];
  if (home) {
    commonDirs.push(path.join(home, '.bun', 'bin'));
  }
  if (platform === 'win32') {
    if (env.USERPROFILE) {
      commonDirs.push(path.join(env.USERPROFILE, '.bun', 'bin'));
    }
    if (env.LOCALAPPDATA) {
      commonDirs.push(path.join(env.LOCALAPPDATA, 'bun'));
    }
    if (env.APPDATA) {
      commonDirs.push(path.join(env.APPDATA, 'npm'));
    }
    if (env.ProgramFiles) {
      commonDirs.push(path.join(env.ProgramFiles, 'bun'));
    }
  } else {
    commonDirs.push('/usr/local/bin', '/opt/homebrew/bin', '/usr/bin');
  }

  for (const dir of commonDirs) {
    const found = lookInDir(dir, names);
    if (found) {
      return found;
    }
  }

  return null;
}

function tryResolveBunBare(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  whichCommand: (name: string) => string | null,
): string | null {
  const resolved = resolveBunCommand(env, platform, whichCommand);
  if (resolved) {
    return resolved;
  }

  // Last-chance: allow bare command when whichCommand reports presence without full path.
  const bareNames = platform === 'win32' ? ['bun.cmd', 'bun'] : ['bun',
];
  for (const name of bareNames) {
    const hit = whichCommand(name);
    if (hit) {
      return hit;
    }
  }
  return null;
}

function resolvePathExecutable(
  baseName: string,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  whichCommand: (name: string) => string | null,
): string | null {
  if (platform === 'win32') {
    for (const name of [`${baseName}.cmd`, `${baseName}.exe`, baseName]) {
      const hit = whichCommand(name);
      if (hit && fileExists(hit)) {
        return hit;
      }
      // which may return a path even if we want bare
      if (hit) {
        return hit;
      }
    }
    return null;
  }

  const hit = whichCommand(baseName);
  return hit || null;
}

function monorepoCodeCliRoot(projectRoot: string): string {
  return path.join(projectRoot, 'packages', 'zavorth-code', 'cli');
}

function monorepoCodeIndex(projectRoot: string): string {
  return path.join(monorepoCodeCliRoot(projectRoot), 'src', 'index.ts');
}

function monorepoCodeBin(projectRoot: string): string {
  return path.join(monorepoCodeCliRoot(projectRoot), 'bin', 'zavorth');
}

function monorepoCodePackagePresent(projectRoot: string): boolean {
  return fileExists(path.join(projectRoot, 'packages', 'zavorth-code', 'package.json'));
}

function buildMissingPlan(projectRoot: string): ZavorthCodeCliLaunchPlan {
  const codePresent = monorepoCodePackagePresent(projectRoot);
  const indexPresent = fileExists(monorepoCodeIndex(projectRoot));

  const hints: string[] = [
    'Coding CLI binary name is `zavorth-code` (agent CLI is bare `zavorth`).',
    'Optional override: set ZAVORTH_CODE_BIN to an absolute path of the coding CLI entry.',
  ];

  if (!codePresent) {
    hints.unshift('Run `npm run code:sync` to bring packages/code into this monorepo.');
  } else {
    hints.unshift('Run `npm run code:install` to install Bun workspace deps for packages/code.');
    if (!indexPresent) {
      hints.unshift('packages/code looks incomplete — re-run `npm run code:sync`.');
    }
  }

  hints.push('Alternative: `npm run code:dev` to start the coding CLI directly with Bun.');
  hints.push('Install Bun if missing: https://bun.sh (required for monorepo dev entry).');

  return {
    kind: 'missing',
    message:
      'Zavorth Code coding CLI was not found. Install Bun, sync packages/code, or set ZAVORTH_CODE_BIN.',
    hints,
  };
}

/**
 * Pure resolver for `zavorth code …` → coding CLI launch plan.
 * Inject env / platform / whichCommand for unit tests.
 */
export function resolveZavorthCodeCliLaunch(
  options: ResolveZavorthCodeCliLaunchOptions,
): ZavorthCodeCliLaunchPlan {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const userArgs = Array.isArray(options.args) ? options.args : [];
  const launchCwd = options.cwd || process.cwd();
  const whichCommand =
    options.whichCommand ||
    ((name: string) => defaultWhichCommand(name, env, platform));

  // 1) Explicit override
  const override = env.ZAVORTH_CODE_BIN;
  if (isNonEmpty(override)) {
    const command = override.trim();
    return {
      kind: 'spawn',
      command,
      args: [...userArgs],
      cwd: launchCwd,
      env,
      label: `zavorth-code via ZAVORTH_CODE_BIN (${command})`,
    };
  }

  // 2) Monorepo Bun entry: packages/code/cli/src/index.ts
  const indexTs = monorepoCodeIndex(options.projectRoot);
  const cliCwd = monorepoCodeCliRoot(options.projectRoot);
  if (fileExists(indexTs)) {
    const bun = tryResolveBunBare(env, platform, whichCommand);
    if (bun) {
      return {
        kind: 'spawn',
        command: bun,
        args: ['run', '--conditions=browser', 'src/index.ts', ...userArgs],
        cwd: cliCwd,
        env,
        label: `zavorth-code via Bun monorepo (${path.relative(options.projectRoot, indexTs) || indexTs})`,
      };
    }

    // 3) Fallback monorepo bin wrapper when Bun is unavailable
    const binPath = monorepoCodeBin(options.projectRoot);
    if (fileExists(binPath)) {
      // Node CJS wrapper — prefer node so Windows does not need shebang.
      return {
        kind: 'spawn',
        command: process.execPath,
        args: [binPath, ...userArgs],
        cwd: launchCwd,
        env,
        label: `zavorth-code via monorepo bin (${binPath})`,
      };
    }
  } else {
    // Bin without index is still usable if present
    const binPath = monorepoCodeBin(options.projectRoot);
    if (fileExists(binPath)) {
      return {
        kind: 'spawn',
        command: process.execPath,
        args: [binPath, ...userArgs],
        cwd: launchCwd,
        env,
        label: `zavorth-code via monorepo bin (${binPath})`,
      };
    }
  }

  // 4) PATH executable zavorth-code
  const pathBin = resolvePathExecutable('zavorth-code', env, platform, whichCommand);
  if (pathBin) {
    return {
      kind: 'spawn',
      command: pathBin,
      args: [...userArgs],
      cwd: launchCwd,
      env,
      label: `zavorth-code via PATH (${pathBin})`,
    };
  }

  // 5) Missing
  return buildMissingPlan(options.projectRoot);
}

function defaultSpawn(
  command: string,
  args: string[],
  options: SpawnOptions,
): ChildProcess {
  return spawn(command, args, options);
}

/**
 * Resolve and run the coding CLI. Returns process exit code (1 on missing/error).
 */
export async function runZavorthCodeCli(options: RunZavorthCodeCliOptions): Promise<number> {
  const plan = resolveZavorthCodeCliLaunch({
    projectRoot: options.projectRoot,
    args: options.args,
    env: options.env,
    platform: options.platform,
    whichCommand: options.whichCommand,
    cwd: options.cwd,
  });

  if (plan.kind === 'missing') {
    process.stderr.write(`${plan.message}\n`);
    for (const hint of plan.hints) {
      process.stderr.write(`  • ${hint}\n`);
    }
    return 1;
  }

  const spawnFn = options.spawnFn || defaultSpawn;
  const childEnv: NodeJS.ProcessEnv = {
    ...(plan.env || options.env || process.env),
    ZAVORTH_CODE_FROM_AGENT: '1',
  };

  return new Promise<number>((resolve) => {
    let settled = false;
    const finish = (code: number) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(code);
    };

    try {
      const child = spawnFn(plan.command, plan.args, {
        cwd: plan.cwd,
        env: childEnv,
        stdio: 'inherit',
        windowsHide: false,
      });

      child.on('error', (error: NodeJS.ErrnoException) => {
        process.stderr.write(
          `Failed to start Zavorth Code (${plan.command}): ${error.message}\n`,
        );
        if (error.code === 'ENOENT') {
          process.stderr.write(
            '  • Ensure Bun is installed, or set ZAVORTH_CODE_BIN, or run `npm run code:install`.\n',
          );
        }
        finish(1);
      });

      child.on('exit', (code, signal) => {
        if (signal) {
          finish(1);
          return;
        }
        finish(typeof code === 'number' ? code : 0);
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Failed to launch Zavorth Code: ${message}\n`);
      finish(1);
    }
  });
}
