import { TerminalPanel } from '../presentation/TerminalPanel.js';
import { TerminalTheme } from '../presentation/TerminalTheme.js';
import { TerminalTimeline } from '../presentation/TerminalTimeline.js';
import { globalSpinner } from '../presentation/TerminalSpinner.js';
import type { CliExecutionResult, CliWriter, ZavorthCliFlags } from '../ZavorthCliContract.js';
import {
  defaultRunner,
  runLocalTask,
  ZAVORTH_LOCAL_TASKS,
  type ZavorthLocalTaskId,
  type ZavorthLocalTaskResult,
  type ZavorthLocalTaskRunner,
} from './ZavorthLocalTaskCore.js';

export async function handleZavorthLocalTaskCommand(input: {
  commandName: string | null;
  args: string;
  flags: ZavorthCliFlags;
  writer: CliWriter;
  runner?: ZavorthLocalTaskRunner;
}): Promise<CliExecutionResult | null> {
  const taskId = normalizeTask(input.commandName);
  if (!taskId) {
    return null;
  }

  const raw = /\b--raw\b/.test(input.args);
  const task = ZAVORTH_LOCAL_TASKS[taskId];
  const showSpinner = !input.flags.json && !raw && process.stdout.isTTY;
  if (showSpinner) {
    globalSpinner.start(task.title);
  }
  const result = runLocalTask(taskId, input.runner || defaultRunner);
  if (showSpinner) {
    result.ok ? globalSpinner.succeed(task.summary) : globalSpinner.fail(`${task.title} failed`);
  }

  const body = input.flags.json
    ? JSON.stringify(result, null, 2)
    : renderLocalTask(result);
  input.writer.line(body);
  return { ok: result.ok, handled: true, output: [body], error: result.ok ? null : result.summary };
}

function renderLocalTask(result: ZavorthLocalTaskResult): string {
  const timeline = TerminalTimeline.render([
    { title: 'Resolve command', detail: result.command, status: 'success' },
    { title: 'Run task', detail: `${(result.durationMs / 1000).toFixed(1)}s`, status: result.ok ? 'success' : 'error' },
    { title: 'Next step', detail: result.nextActions[0] || 'Done', status: result.ok ? 'pending' : 'error' },
  ]);
  const body = [
    `${TerminalTheme.format.bold(result.summary)}`,
    '',
    timeline,
    '',
    ...(result.outputTail.length
      ? [
          TerminalTheme.colors.primary(TerminalTheme.format.bold('Output tail')),
          result.outputTail.map((line) => `  ${line}`).join('\n'),
          '',
        ]
      : []),
    TerminalTheme.colors.primary(TerminalTheme.format.bold('Next actions')),
    ...result.nextActions.map((action) => `${TerminalTheme.colors.primary('>')} ${action}`),
  ].join('\n');
  return TerminalPanel.render(body, {
    title: result.ok ? `Zavorth ${result.task}` : `Zavorth ${result.task} failed`,
    type: result.ok ? 'success' : 'error',
  });
}

function normalizeTask(commandName: string | null): ZavorthLocalTaskId | null {
  const normalized = String(commandName || '').trim().toLowerCase();
  if (normalized === 'install' || normalized === 'build' || normalized === 'check') {
    return normalized;
  }
  return null;
}
