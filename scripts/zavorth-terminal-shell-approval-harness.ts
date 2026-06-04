import { runZavorthCliTerminalShellInk } from '../src/cli/ZavorthCliTerminalShellInkApp.js';
import type { ZavorthCliFlags } from '../src/cli/ZavorthCliContract.js';

const flags: ZavorthCliFlags = {
  command: null,
  repl: true,
  json: false,
  live: false,
  userId: 'operator',
  platform: 'cli',
  chatId: 'terminal-approval-harness',
  sessionId: 'approval-harness',
  workspaceHint: null,
  commandText: null,
  headless: false,
  approvalMode: null,
};

async function main(): Promise<void> {
  const result = await runZavorthCliTerminalShellInk({
    flags,
    force: true,
    initialText: '',
    welcomeText: 'Approval harness ready.',
    initialCards: [
      {
        kind: 'approval',
        title: 'Apply safe patch',
        status: 'waiting',
        body: 'Plan: plan-terminal-pty',
        command: 'zavorth approve plan-terminal-pty --yes',
      },
    ],
    runOnce: async (rawInput) => {
      console.log(`RUN_ONCE:${rawInput}`);
      return {
        ok: rawInput === 'hud --action approve --plan plan-terminal-pty --yes',
        handled: true,
        output: rawInput === 'hud --action approve --plan plan-terminal-pty --yes'
          ? ['Approval captured by PTY harness.']
          : [`Unexpected command: ${rawInput}`],
        error: rawInput === 'hud --action approve --plan plan-terminal-pty --yes'
          ? null
          : 'unexpected-command',
      };
    },
  });

  process.exit(result.exitCode);
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exit(1);
});
