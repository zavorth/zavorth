import type { CliExecutionResult, CliWriter, ZavorthCliFlags } from '../ZavorthCliContract.js';
import { renderCliScreen, type CliVisualPanel } from '../ZavorthCliVisualSystem.js';
import { paintCliTone } from '../ZavorthCliVisualTheme.js';
import {
  defaultRunner,
  runLocalTask,
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

  /\b--raw\b/.test(input.args);
  const result = runLocalTask(taskId, input.runner || defaultRunner);

  const body = input.flags.json
    ? JSON.stringify(result, null, 2)
    : renderLocalTask(result);
  input.writer.line(body);
  return { ok: result.ok, handled: true, output: [body], error: result.ok ? null : result.summary };
}

function renderLocalTask(result: ZavorthLocalTaskResult): string {
  const panels: CliVisualPanel[] = [
    {
      title: 'Timeline',
      tone: result.ok ? 'success' : 'danger',
      lines: [
        `✓ Resolve command: ${result.command}`,
        `${result.ok ? '✓' : '!'} Run task: ${(result.durationMs / 1000).toFixed(1)}s`,
        `› Next step: ${result.nextActions[0] || 'Done'}`,
      ],
    },
    ...(result.outputTail.length
      ? [{
          title: 'Output tail',
          tone: 'muted' as const,
          lines: result.outputTail.map((line) => `  ${line}`),
        }]
      : []),
    {
      title: 'Next actions',
      tone: 'brand',
      lines: result.nextActions.map((action) => `${paintCliTone('>', 'brand')} ${action}`),
    },
  ];
  return renderCliScreen({
    eyebrow: 'Zavorth CLI',
    title: result.ok ? `Zavorth ${result.task}` : `Zavorth ${result.task} failed`,
    summary: result.summary,
    panels,
    mode: 'compact',
  });
}

function normalizeTask(commandName: string | null): ZavorthLocalTaskId | null {
  const normalized = String(commandName || '').trim().toLowerCase();
  if (normalized === 'install' || normalized === 'build' || normalized === 'check') {
    return normalized;
  }
  return null;
}
