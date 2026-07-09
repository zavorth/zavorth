import type { ZavorthCliFlags, CliExecutionResult, CliReadlineFactory, CliWriter } from './ZavorthCliContract.js';
import {
  createCliReplConversationFlags,
  createCliReplSwitchConversationFlags,
  formatCliNewConversationMessage,
  formatCliReplPrompt,
  formatCliSwitchedConversationMessage,
  isCliReplNewConversationCommand,
  loadCliReplHistory,
  normalizeCliInput,
  parseCliReplSwitchConversationTarget,
  persistCliReplHistory,
} from './ZavorthCliFlowHelpers.js';
import { formatCliChatHelp, isCliChatHelpCommand } from './ZavorthCliChatHelp.js';
import { logger } from '../logger.js';

import { formatCliChatWelcome } from './ZavorthCliSurfaceHelpers.js';
import { globalSpinner } from './presentation/TerminalSpinner.js';
import {
  buildTerminalShellSnapshot,
  formatTerminalShellScreen,
} from './ZavorthCliTerminalShell.js';
import { errorMessage } from '../utils/errorLike.js';

import {
runZavorthCliTerminalShellInk,
  type ZavorthTerminalShellRunResult,
  type ZavorthTerminalShellRunnerParams,
} from './ZavorthCliTerminalShellInkApp.js';
async function readCliReplQuestion(
  rl: ReturnType<CliReadlineFactory>,
  prompt: string,
): Promise<string | null> {
  try {
    return await rl.question(prompt);
  } catch (error: unknown) {const message = String(errorMessage(error) || '');
    if (/readline was closed|readline closed|closed/i.test(message)) {
      return null;
    }
    throw error;
  }
}

export async function runZavorthCliRepl(params: {
  flags: ZavorthCliFlags;
  readlineFactory: CliReadlineFactory;
  writer: CliWriter;
  runOnce: (rawInput: string, flags: ZavorthCliFlags) => Promise<CliExecutionResult>;
  welcomeText?: string | null;
  terminalShellRunner?: (params: ZavorthTerminalShellRunnerParams) => Promise<ZavorthTerminalShellRunResult>;
  forceTerminalShell?: boolean;
  steerActiveRun?: ZavorthTerminalShellRunnerParams['steerActiveRun'];
}): Promise<number> {
  const { flags, readlineFactory, writer, runOnce } = params;
  if (!flags.json) {
    const initialText = formatTerminalShellScreen(buildTerminalShellSnapshot({
      sessionId: flags.sessionId,
      profileId: flags.userId || 'operator',
      messages: [{
        role: 'assistant',
        text: params.welcomeText || 'Ready for a new request.',
      }],
    }));
    const shellRunner = params.terminalShellRunner || runZavorthCliTerminalShellInk;
    const shellResult = await shellRunner({
      flags,
      runOnce,
      initialText,
      welcomeText: params.welcomeText || null,
      force: params.forceTerminalShell,
      steerActiveRun: params.steerActiveRun,
    });
    if (shellResult.rendered) {
      return shellResult.exitCode;
    }
  }
  const rl = readlineFactory();
  let interrupted = false;
  if (typeof (rl as { on?: unknown }).on === 'function') {
    rl.on('SIGINT', () => {
      interrupted = true;
      try {
        rl.close();
      } catch (error: unknown) {
        // readline may already be closing after Ctrl+C.
        logger.warn('[Zavorth Cli Repl Lifecycle] resource cleanup failed', error);
      }
    });
  }
  writer.line(params.welcomeText || formatCliChatWelcome());

  const promptRl = rl as unknown as { history?: string[] };
  if (Array.isArray(promptRl.history)) {
    promptRl.history = loadCliReplHistory();
  }

  try {
    let currentFlags = { ...flags };
    while (true) {
      const line = await readCliReplQuestion(rl, formatCliReplPrompt(currentFlags));
      if (line === null) {
        if (interrupted) {
          writer.line('\nSession closed. Nothing was changed.');
        }
        return 0;
      }
      const normalized = normalizeCliInput(line);
      if (!normalized) {
        continue;
      }

      if (isCliChatHelpCommand(normalized)) {
        writer.line(formatCliChatHelp());
        continue;
      }

      persistCliReplHistory(normalized);

      if (isCliReplNewConversationCommand(normalized)) {
        currentFlags = createCliReplConversationFlags(currentFlags);
        writer.line(formatCliNewConversationMessage(currentFlags));
        continue;
      }

      const switchTarget = parseCliReplSwitchConversationTarget(normalized);
      if (switchTarget) {
        currentFlags = createCliReplSwitchConversationFlags(currentFlags, switchTarget);
        writer.line(formatCliSwitchedConversationMessage(currentFlags));
        continue;
      }

      const showSpinner = Boolean(process.stdout?.isTTY && !currentFlags.json);
      if (showSpinner) {
        globalSpinner.start('Zavorth is thinking...');
      }
      let result: CliExecutionResult;
      try {
        result = await runOnce(normalized, {
          ...currentFlags,
          repl: true,
        });
        if (showSpinner) {
          globalSpinner.succeed(result.ok ? 'Done' : 'Needs attention');
        }
      } catch (error: unknown) {if (showSpinner) {
          globalSpinner.fail('Could not finish');
        }
        throw error;
      }
      if ((normalized === 'quit' || normalized === 'exit') && result.ok) {
        writer.line('Session closed. Nothing was changed.');
        return 0;
      }
    }
  } finally {
    try {
      rl.close();
    } catch (error: unknown) {// A piped/non-interactive stdin can close before the REPL loop asks again.
      logger.warn('[Zavorth Cli Repl Lifecycle] resource cleanup failed', error);
    }
  }
}
