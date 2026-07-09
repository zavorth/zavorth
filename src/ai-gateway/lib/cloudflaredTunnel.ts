import { spawn } from "child_process";
import {
  buildCloudflaredChildEnv,
  extractCloudflaredErrorMessage,
  extractTryCloudflareUrl,
  getCloudflaredStartArgs,
  getGenericExitError,
  getDefaultCloudflaredCertEnv,
  isSpecificCloudflaredError,
} from "./cloudflared-tunnel/cloudflaredTunnelEnv";
import {
  ensureBinary,
  getCloudflaredAssetSpec,
  resolveBinary,
} from "./cloudflared-tunnel/cloudflaredTunnelInstall";
import {
  ensureTunnelDir,
  ensureTunnelRuntimeDirs,
  getLocalTargetUrl,
  getLogFilePath,
  getTunnelApiUrl,
} from "./cloudflared-tunnel/cloudflaredTunnelPaths";
import {
  appendTunnelLog,
  buildStoppedState,
  clearPidFile,
  hasTransientRuntimeState,
  isProcessAlive,
  isStateOwnedByCurrentProcess,
  readPidFile,
  readStateFile,
  updateStateFile,
  writePidFile,
  writeStateFile,
} from "./cloudflared-tunnel/cloudflaredTunnelState";
import {
  START_TIMEOUT_MS,
  STOP_TIMEOUT_MS,
  type CloudflaredTunnelStatus,
} from "./cloudflared-tunnel/cloudflaredTunnelTypes";

export type { CloudflaredTunnelStatus } from "./cloudflared-tunnel/cloudflaredTunnelTypes";
export { getCloudflaredRuntimeDirs } from "./cloudflared-tunnel/cloudflaredTunnelPaths";
export {
  extractTryCloudflareUrl,
  extractCloudflaredErrorMessage,
  getDefaultCloudflaredCertEnv,
  buildCloudflaredChildEnv,
  getCloudflaredStartArgs,
} from "./cloudflared-tunnel/cloudflaredTunnelEnv";
export { getCloudflaredAssetSpec } from "./cloudflared-tunnel/cloudflaredTunnelInstall";

let tunnelProcess: ReturnType<typeof spawn> | null = null;
let tunnelPid: number | null = null;
const installPromiseRef: { current: Promise<string> | null } = { current: null };
let startPromise: Promise<CloudflaredTunnelStatus> | null = null;

async function finalizeProcessExit(code: number | null, signal: NodeJS.Signals | null) {
  const currentState = await readStateFile();
  const lastError =
    code === 0 || signal === "SIGTERM" || signal === "SIGINT"
      ? null
      : isSpecificCloudflaredError(currentState.lastError)
        ? currentState.lastError
        : getGenericExitError(code, signal);

  tunnelProcess = null;
  tunnelPid = null;
  await clearPidFile();
  await writeStateFile({
    ...currentState,
    pid: null,
    publicUrl: null,
    apiUrl: null,
    status: lastError ? "error" : "stopped",
    lastError,
  });
}

async function killPid(pid: number) {
  process.kill(pid, "SIGTERM");
  const start = Date.now();
  while (Date.now() - start < STOP_TIMEOUT_MS) {
    if (!isProcessAlive(pid)) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  if (isProcessAlive(pid)) {
    process.kill(pid, "SIGKILL");
  }
}

async function stopExistingTunnel() {
  if (tunnelProcess && tunnelPid && !tunnelProcess.killed) {
    const pid = tunnelPid;
    tunnelProcess.kill("SIGTERM");
    await killPid(pid);
    return;
  }

  const state = await readStateFile();
  if (!isStateOwnedByCurrentProcess(state)) {
    await clearPidFile();
    return;
  }

  const pid = await readPidFile();
  if (pid && isProcessAlive(pid)) {
    await killPid(pid);
  }
}

export async function getCloudflaredTunnelStatus(): Promise<CloudflaredTunnelStatus> {
  const state = await readStateFile();
  const resolved = await resolveBinary();
  const pidFromState =
    tunnelPid || (isStateOwnedByCurrentProcess(state) ? state.pid || (await readPidFile()) : null);
  const running = isProcessAlive(pidFromState);
  const needsColdStartReset =
    !running && !isStateOwnedByCurrentProcess(state) && hasTransientRuntimeState(state);
  const effectiveState = needsColdStartReset
    ? buildStoppedState(state, !!resolved.binaryPath, getLocalTargetUrl())
    : state;

  if (needsColdStartReset) {
    await writeStateFile(effectiveState);
  }

  const publicUrl = running ? effectiveState.publicUrl || null : null;
  const phase =
    !getCloudflaredAssetSpec() && !resolved.binaryPath
      ? "unsupported"
      : running
        ? publicUrl
          ? "running"
          : "starting"
        : resolved.binaryPath
          ? effectiveState.lastError
            ? "error"
            : "stopped"
          : "not_installed";

  if (!running && state.pid) {
    await clearPidFile();
  }

  return {
    supported: !!(getCloudflaredAssetSpec() || resolved.binaryPath),
    installed: !!resolved.binaryPath,
    managedInstall: resolved.managed,
    installSource: resolved.source,
    binaryPath: resolved.binaryPath,
    running,
    pid: running ? pidFromState : null,
    publicUrl,
    apiUrl: publicUrl ? getTunnelApiUrl(publicUrl) : null,
    targetUrl: effectiveState.targetUrl || getLocalTargetUrl(),
    phase,
    lastError: running ? null : effectiveState.lastError || null,
    logPath: getLogFilePath(),
  };
}

export async function startCloudflaredTunnel(): Promise<CloudflaredTunnelStatus> {
  const current = await getCloudflaredTunnelStatus();
  if (current.running) return current;
  if (startPromise) return startPromise;

  startPromise = (async () => {
    const spec = getCloudflaredAssetSpec();
    if (!spec && !(await resolveBinary()).binaryPath) {
      throw new Error(
        `Unsupported platform for cloudflared tunnel: ${process.platform}/${process.arch}`
      );
    }

    const binary = await ensureBinary({
      installPromiseRef,
      updateStateFile,
    });
    const targetUrl = getLocalTargetUrl();

    await stopExistingTunnel();
    await ensureTunnelDir();
    await ensureTunnelRuntimeDirs();
    await writeStateFile({
      binaryPath: binary.binaryPath,
      installSource: binary.source,
      ownerPid: process.pid,
      pid: null,
      publicUrl: null,
      apiUrl: null,
      targetUrl,
      status: "starting",
      lastError: null,
      startedAt: new Date().toISOString(),
    });

    const child = spawn(binary.binaryPath as string, getCloudflaredStartArgs(targetUrl), {
      stdio: ["ignore", "pipe", "pipe"],
      env: buildCloudflaredChildEnv(),
    });

    tunnelProcess = child;
    tunnelPid = child.pid ?? null;

    if (!child.pid) {
      throw new Error("cloudflared failed to start");
    }

    await writePidFile(child.pid);
    await updateStateFile({ pid: child.pid, status: "starting" });

    const ready = await new Promise<CloudflaredTunnelStatus>((resolve, reject) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | null = null;

      const settle = (handler: () => void) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        handler();
      };

      const handleOutput = async (source: "stdout" | "stderr", chunk: Buffer) => {
        const text = chunk.toString("utf8").trim();
        if (!text) return;

        await appendTunnelLog(source, text);
        const errorMessage = source === "stderr" ? extractCloudflaredErrorMessage(text) : null;
        if (errorMessage) {
          await updateStateFile({
            ownerPid: process.pid,
            pid: child.pid,
            status: "error",
            lastError: errorMessage,
          });
        }

        const url = extractTryCloudflareUrl(text);
        if (!url) return;

        const apiUrl = getTunnelApiUrl(url);
        await updateStateFile({
          ownerPid: process.pid,
          pid: child.pid,
          publicUrl: url,
          apiUrl,
          status: "running",
          lastError: null,
        });

        const status = await getCloudflaredTunnelStatus();
        settle(() => resolve(status));
      };

      child.stdout.on("data", (chunk: Buffer) => {
        void handleOutput("stdout", chunk);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        void handleOutput("stderr", chunk);
      });

      child.once("exit", (code, signal) => {
        void finalizeProcessExit(code, signal);
        settle(() =>
          reject(
            new Error(
              `cloudflared exited before tunnel URL was ready (${code ?? "signal"}${signal ? `/${signal}` : ""})`
            )
          )
        );
      });

      timeout = setTimeout(async () => {
        await stopExistingTunnel();
        settle(() => reject(new Error("Timed out while waiting for Cloudflare tunnel URL")));
      }, START_TIMEOUT_MS);
    });

    return ready;
  })();

  try {
    return await startPromise;
  } catch (error: any) { const err = error; const e = error;
    const currentState = await readStateFile();
    const message = isSpecificCloudflaredError(currentState.lastError)
      ? currentState.lastError
      : error instanceof Error
        ? error.message
        : "Failed to start cloudflared tunnel";

    await updateStateFile({
      ownerPid: process.pid,
      status: "error",
      lastError: message,
    });
    throw new Error(message);
  } finally {
    startPromise = null;
  }
}

export async function stopCloudflaredTunnel() {
  await stopExistingTunnel();
  const current = await readStateFile();
  await writeStateFile({
    ...buildStoppedState(current, !!(await resolveBinary()).binaryPath, getLocalTargetUrl()),
    ownerPid: null,
  });
  tunnelProcess = null;
  tunnelPid = null;
  await clearPidFile();
  return getCloudflaredTunnelStatus();
}
