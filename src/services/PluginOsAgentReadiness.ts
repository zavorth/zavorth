/**
 * Shared wait handle so agent entrypoints can block until Plugin OS bootstrap
 * has finished wiring capability tools into the ToolRegistry.
 */

let pluginOsReady: Promise<unknown> = Promise.resolve(null);
let resolved = true;

export function setPluginOsReadyPromise(promise: Promise<unknown> | null | undefined): void {
  if (!promise) {
    pluginOsReady = Promise.resolve(null);
    resolved = true;
    return;
  }
  resolved = false;
  pluginOsReady = Promise.resolve(promise).then(
    (value) => {
      resolved = true;
      return value;
    },
    (error) => {
      resolved = true;
      // Soft-fail: agent may still run without plugins.
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    },
  );
}

export function getPluginOsReadyPromise(): Promise<unknown> {
  return pluginOsReady;
}

export function isPluginOsReady(): boolean {
  return resolved;
}

/**
 * Await Plugin OS bootstrap (or timeout). Never throws.
 */
export async function waitForPluginOsReady(options: { timeoutMs?: number } = {}): Promise<{
  ok: boolean;
  timedOut: boolean;
  waitedMs: number;
}> {
  const timeoutMs = Math.max(0, Number(options.timeoutMs ?? process.env.ZAVORTH_PLUGIN_OS_READY_TIMEOUT_MS) || 15000);
  const started = Date.now();
  if (timeoutMs === 0) {
    await pluginOsReady;
    return { ok: true, timedOut: false, waitedMs: Date.now() - started };
  }
  let timedOut = false;
  let timeoutHandle: NodeJS.Timeout | null = null;
  try {
    await Promise.race([
      pluginOsReady,
      new Promise<void>((resolve) => {
        timeoutHandle = setTimeout(() => {
          timeoutHandle = null;
          timedOut = true;
          resolve();
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
  return {
    ok: !timedOut || resolved,
    timedOut,
    waitedMs: Date.now() - started,
  };
}
