import { spawn } from "child_process";

export const isWindows = () => process.platform === "win32";

const quoteWindowsArg = (value: string): string => {
  const text = String(value ?? "");
  if (!text) return '""';
  if (!/[\s"&()<>^|%!]/.test(text)) return text;
  return `"${text.replace(/(["^&|<>()%!])/g, "^$1")}"`;
};

const resolveSpawn = (command: string, args: string[]) => {
  if (!isWindows()) {
    return { command, args };
  }
  const commandLine = [command, ...args].map(quoteWindowsArg).join(" ");
  return {
    command: process.env.ComSpec || "cmd.exe",
    args: ["/d", "/s", "/c", commandLine],
  };
};

export const runProcess = (
  command: string,
  args: string[],
  { env, timeoutMs = 3000 }: { env?: Record<string, string | undefined>; timeoutMs?: number } = {}
): Promise<unknown> =>
  new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const spawnTarget = resolveSpawn(command, args);

    const child = spawn(spawnTarget.command, spawnTarget.args, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    const done = (result: unknown) => {
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
