import { spawn } from 'child_process';
import type {
  NodeHostCommandInvocation,
  NodeHostCommandResult,
  NodeHostCommandRunner,
} from './NodeHostCapabilityTypes.js';
import { normalizeTimeout } from './NodeHostCapabilityExecutionHelpers.js';
import { logger } from '../../../../logger.js';
import { asErrorLike } from '../../../../utils/errorLike';

export class ShellNodeHostCommandRunner implements NodeHostCommandRunner {
  public async run(
    command: NodeHostCommandInvocation,
    input: {
      cwd?: string | null;
      timeoutMs?: number;
      env?: NodeJS.ProcessEnv;
    } = {},
  ): Promise<NodeHostCommandResult> {
    const cwd = String(input.cwd || '').trim() || process.cwd();
    const timeoutMs = normalizeTimeout(input.timeoutMs, 120000);

    return await new Promise((resolve) => {
      const child = typeof command === 'string'
        ? spawn(command, {
            cwd,
            env: input.env || process.env,
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
          })
        : spawn(command.file, command.args || [], {
            cwd,
            env: input.env || process.env,
            shell: false,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
          });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const finalize = (result: NodeHostCommandResult): void => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(result);
      };

      const timeout = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch (error: unknown) {
          const err = asErrorLike(error);
          logger.warn("[auto-fix] Empty catch block", err); }

        finalize({
          ok: false,
          stdout: stdout.trim() || null,
          stderr: stderr.trim() || 'process timeout',
          exitCode: null,
        });
      }, timeoutMs);

      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('error', (error) => {
        clearTimeout(timeout);
        finalize({
          ok: false,
          stdout: stdout.trim() || null,
          stderr: stderr.trim() || error.message,
          exitCode: null,
        });
      });
      child.on('exit', (code) => {
        clearTimeout(timeout);
        finalize({
          ok: code === 0,
          stdout: stdout.trim() || null,
          stderr: stderr.trim() || null,
          exitCode: Number.isFinite(code as number) ? Number(code) : null,
        });
      });
    });
  }
}
