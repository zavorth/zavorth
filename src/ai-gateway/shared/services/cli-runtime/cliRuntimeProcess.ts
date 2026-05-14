import { spawn } from "child_process";

export const isWindows = () => process.platform === "win32";

export const runProcess = (
  command: string,
  args: string[],
  { env, timeoutMs = 3000 }: { env?: Record<string, string | undefined>; timeoutMs?: number } = {}
): Promise<any> =>
  new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const child = spawn(command, args, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      ...(isWindows() ? { shell: true } : {}),
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    const done = (result: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      done({
        ok: false,
        code: null,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        timedOut,
        error: error?.message || "spawn_error",
      });
    });

    child.on("close", (code) => {
      done({
        ok: !timedOut && code === 0,
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        timedOut,
        error: timedOut ? "timeout" : null,
      });
    });
  });
