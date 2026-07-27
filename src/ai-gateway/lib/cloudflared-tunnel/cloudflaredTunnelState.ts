import fs from "fs/promises";
import type { PersistedTunnelState } from "./cloudflaredTunnelTypes";
import { logger } from '@/shared/utils/logger';
import {
ensureTunnelDir,
  getCloudflaredRuntimeDirs,
  getLogFilePath,
  getPidFilePath,
  getStateFilePath,
} from "./cloudflaredTunnelPaths";export async function readStateFile(): Promise<PersistedTunnelState> {
  try {
    const content = await fs.readFile(getStateFilePath(), "utf8");
    return JSON.parse(content) as PersistedTunnelState;
  } catch (error: unknown) {logger.warn('[cloudflared Tunnel State] JSON parse failed', error); return {}; }
}

export async function writeStateFile(state: PersistedTunnelState) {
  await ensureTunnelDir();
  await fs.writeFile(getStateFilePath(), JSON.stringify(state, null, 2) + "\n", "utf8");
}

export async function updateStateFile(patch: PersistedTunnelState) {
  const current = await readStateFile();
  await writeStateFile({ ...current, ...patch });
}

export async function clearPidFile() {
  try {
    await fs.unlink(getPidFilePath());
  } catch (error: unknown) {// Ignore missing/stale pid files.
      logger.warn('[cloudflared Tunnel State] file cleanup failed', error);
    }
}

export async function writePidFile(pid: number) {
  await ensureTunnelDir();
  await fs.writeFile(getPidFilePath(), String(pid), "utf8");
}

export async function readPidFile() {
  try {
    const content = await fs.readFile(getPidFilePath(), "utf8");
    const pid = Number.parseInt(content.trim(), 10);
    return Number.isFinite(pid) ? pid : null;
  } catch (error: unknown) {logger.warn('[cloudflared Tunnel State] filesystem operation failed', error); return null; }
}

export function isProcessAlive(pid: number | null) {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {logger.warn('[cloudflared Tunnel State] filesystem operation failed', error); return false; }
}

export async function appendTunnelLog(source: "stdout" | "stderr", message: string) {
  await ensureTunnelDir();
  const timestamp = new Date().toISOString();
  await fs.appendFile(getLogFilePath(), `[${timestamp}] [${source}] ${message}\n`, "utf8");
}

export function isStateOwnedByCurrentProcess(state: PersistedTunnelState) {
  return !!state.ownerPid && state.ownerPid === process.pid;
}

export function hasTransientRuntimeState(state: PersistedTunnelState) {
  return !!(
    state.ownerPid ||
    state.pid ||
    state.publicUrl ||
    state.apiUrl ||
    state.startedAt ||
    state.status === "running" ||
    state.status === "starting" ||
    state.status === "error"
  );
}

export function buildStoppedState(
  state: PersistedTunnelState,
  binaryResolved: boolean,
  targetUrl: string
): PersistedTunnelState {
  return {
    ...state,
    ownerPid: null,
    pid: null,
    publicUrl: null,
    apiUrl: null,
    targetUrl,
    status: binaryResolved ? "stopped" : "not_installed",
    lastError: null,
    startedAt: null,
  };
}

export function getDefaultRuntimeDirs() {
  return getCloudflaredRuntimeDirs();
}
