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
import { formatCliChatWelcome } from './ZavorthCliSurfaceHelpers.js';

async function readCliReplQuestion(
  rl: ReturnType<CliReadlineFactory>,
  prompt: string,
): Promise<string | null> {
  try {
    return await rl.question(prompt);
  } catch (error: any) {
    const message = String(error?.message || error || '');
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
}): Promise<number> {
  const { flags, readlineFactory, writer, runOnce } = params;
  const rl = readlineFactory();
  writer.line(formatCliChatWelcome());

  if ('history' in rl && Array.isArray((rl as any).history)) {
    (rl as any).history = loadCliReplHistory();
  }

  try {
    let currentFlags = { ...flags };
    while (true) {
      const line = await readCliReplQuestion(rl, formatCliReplPrompt(currentFlags));
      if (line === null) {
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

      const result = await runOnce(normalized, {
        ...currentFlags,
        repl: true,
      });
      if ((normalized === 'quit' || normalized === 'exit') && result.ok) {
        return 0;
      }
    }
  } finally {
    try {
      rl.close();
    } catch {
      // A piped/non-interactive stdin can close before the REPL loop asks again.
    }
  }
}
