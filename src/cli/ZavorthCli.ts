import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { executeZavorthCliCommand } from './ZavorthCliRegistry.js';
import { runZavorthCliRepl } from './ZavorthCliReplLifecycle.js';
import type {
  ZavorthCliDeps,
  ZavorthCliFlags,
  ZavorthCliIo,
  ZavorthCliRuntime,
  ZavorthCliServiceOverrides,
  CliExecutionResult,
  CliReadlineFactory,
  CliWriter,
} from './ZavorthCliContract.js';
import { defaultWriter, isCliIo, withCliConsoleSuppressedAsync } from './ZavorthCliFlowHelpers.js';
import { formatCliHelp } from './ZavorthCliSurfaceHelpers.js';
import { formatExperienceHome } from './ZavorthCliExperienceRenderer.js';
import {
  buildCliRuntimeFromOverrides as buildCliRuntimeFromOverridesImpl,
  parseZavorthCliArgs as parseZavorthCliArgsImpl,
  parseZavorthCliFlags as parseZavorthCliFlagsImpl,
} from './ZavorthCliCommandHelpers.js';

export type {
  ZavorthCliDeps,
  ZavorthCliFlags,
  ZavorthCliIo,
  ZavorthCliRuntime,
  ZavorthCliServiceOverrides,
  CliExecutionResult,
  CliReadlineFactory,
  CliRuntimeProfile,
  CliWriter,
} from './ZavorthCliContract.js';

export const parseZavorthCliFlags = parseZavorthCliFlagsImpl;
export const parseZavorthCliArgs = parseZavorthCliArgsImpl;
export const buildCliRuntimeFromOverrides = buildCliRuntimeFromOverridesImpl;

function shouldSuppressCliConsoleForInput(
  rawInput: string | null | undefined,
  flags: Pick<ZavorthCliFlags, 'json' | 'repl'>,
): boolean {
  const normalizedInput = String(rawInput || '').trim();
  if (flags.repl) {
    return true;
  }
  if (flags.json || /\s--json\b/i.test(` ${normalizedInput}`)) {
    return true;
  }
  if (normalizedInput) {
    return true;
  }
  return false;
}

export class ZavorthCli {
  private readonly writer: CliWriter;
  private runtimePromise: Promise<ZavorthCliRuntime> | null = null;
  private readonly readlineFactory: CliReadlineFactory;

  constructor(private readonly deps: ZavorthCliDeps = {}) {
    this.writer = deps.writer || defaultWriter();
    this.readlineFactory =
      deps.readlineFactory ||
      (() =>
        readline.createInterface({
          input,
          output,
        }));
  }

  public async run(argv: string[]): Promise<number> {
    const flags = parseZavorthCliFlags(argv);
    if (flags.commandText) {
      const result = await this.runOnce(flags.commandText, flags);
      return result.ok ? 0 : 1;
    }

    if (!flags.repl && !process.stdin.isTTY) {
      this.writer.line(formatCliHelp());
      return 0;
    }

    return this.runRepl(flags);
  }

  public async runOnce(rawInput: string, flags: ZavorthCliFlags): Promise<CliExecutionResult> {
    const execute = () => executeZavorthCliCommand({
      rawInput,
      flags,
      resolveRuntime: () => this.getRuntime(),
      writer: this.writer,
    });
    return shouldSuppressCliConsoleForInput(rawInput, flags)
      ? withCliConsoleSuppressedAsync(execute)
      : execute();
  }

  public async runRepl(flags: ZavorthCliFlags): Promise<number> {
    const runtime = await this.getRuntime();
    const welcomeText = runtime.experienceCoreService
      ? formatExperienceHome(runtime.experienceCoreService.buildHome({
        surface: flags.platform,
        userId: flags.userId,
        sessionId: flags.sessionId,
        workspace: flags.workspaceHint || null,
      }))
      : null;
    return runZavorthCliRepl({
      flags,
      readlineFactory: this.readlineFactory,
      writer: this.writer,
      runOnce: (rawInput: string, runFlags: ZavorthCliFlags) => this.runOnce(rawInput, runFlags),
      welcomeText,
    });
  }

  private async getRuntime(): Promise<ZavorthCliRuntime> {
    if (this.deps.runtime) {
      return this.deps.runtime;
    }

    if (!this.runtimePromise) {
      this.runtimePromise = buildCliRuntimeFromOverrides();
    }

    return this.runtimePromise;
  }
}

export async function runZavorthCli(
  argv: string[],
  ioOrServices?: ZavorthCliIo | ZavorthCliServiceOverrides,
  servicesArg?: ZavorthCliServiceOverrides,
): Promise<number> {
  const io: ZavorthCliIo | undefined = isCliIo(ioOrServices) ? ioOrServices : undefined;
  const services = (
    servicesArg
    || (isCliIo(ioOrServices) ? undefined : (ioOrServices as ZavorthCliServiceOverrides | undefined))
    || undefined
  ) as ZavorthCliServiceOverrides | undefined;

  const writer: CliWriter = io
    ? {
        line: (text: string) => {
          if (io.write) {
            io.write(text);
            return;
          }
          console.log(text);
        },
        error: (text: string) => {
          if (io.error) {
            io.error(text);
            return;
          }
          console.error(text);
        },
      }
    : defaultWriter();

  if (services) {
    const flags = parseZavorthCliFlags(argv);
    const runtime = shouldSuppressCliConsoleForInput(flags.commandText, flags)
      ? await withCliConsoleSuppressedAsync(() => buildCliRuntimeFromOverrides(services))
      : await buildCliRuntimeFromOverrides(services);
    const cli = new ZavorthCli({
      writer,
      runtime,
    });
    return cli.run(argv);
  }

  const cli = new ZavorthCli({
    writer,
  });
  return cli.run(argv);
}
