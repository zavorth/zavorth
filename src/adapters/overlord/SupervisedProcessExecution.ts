import { spawn, type ChildProcess } from 'child_process';

export type SupervisedProcessExecutionResult = {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  errorCode: string | null;
  errorMessage: string | null;
};

export async function executeSupervisedProcess(input: {
  executable: string;
  args: string[];
  cwd?: string | null;
  timeoutMs?: number | null;
  env?: NodeJS.ProcessEnv | null;
  onSpawn?: ((child: ChildProcess) => void) | null;
}): Promise<SupervisedProcessExecutionResult> {
  const timeoutMs = Math.max(1000, Number(input.timeoutMs || 60_000) || 60_000);
  return await new Promise<SupervisedProcessExecutionResult>((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    const child = spawn(input.executable, input.args, {
      cwd: input.cwd || process.cwd(),
      env: input.env || process.env,
      shell: false,
      windowsHide: true,
    });
    try {
      input.onSpawn?.(child);
    } catch (error: any) { const err = error; const e = error;
      // Best-effort hook for supervised cancelation handles.
    }

    const finish = (result: SupervisedProcessExecutionResult) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill();
      finish({
        ok: false,
        exitCode: null,
        stdout,
        stderr,
        errorCode: 'process_timeout',
        errorMessage: `Processo supervisionado excedeu o timeout de ${timeoutMs}ms.`,
      });
    }, timeoutMs);

    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk || '');
    });

    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk || '');
    });

    child.on('error', (error: any) => {
      clearTimeout(timer);
      finish({
        ok: false,
        exitCode: null,
        stdout,
        stderr,
        errorCode: 'spawn_failed',
        errorMessage: error?.message || String(error),
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      finish({
        ok: code === 0,
        exitCode: typeof code === 'number' ? code : null,
        stdout,
        stderr,
        errorCode: code === 0 ? null : 'process_failed',
        errorMessage: code === 0 ? null : stderr.trim() || `Processo saiu com codigo ${String(code)}`,
      });
    });
  });
}
