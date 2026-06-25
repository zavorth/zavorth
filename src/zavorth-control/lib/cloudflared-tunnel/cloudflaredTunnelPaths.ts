import fs from "fs/promises";
import path from "path";
import { resolveDataDir } from "../dataPaths";
import { getRuntimePorts } from "../runtime/ports";
import type { CloudflaredRuntimeDirs } from "./cloudflaredTunnelTypes";

export function getTunnelDir() {
  return path.join(resolveDataDir(), "cloudflared");
}

export function getManagedBinaryPath(platform = process.platform) {
  return path.join(getTunnelDir(), "bin", platform === "win32" ? "cloudflared.exe" : "cloudflared");
}

export function getStateFilePath() {
  return path.join(getTunnelDir(), "quick-tunnel-state.json");
}

export function getPidFilePath() {
  return path.join(getTunnelDir(), ".quick-tunnel.pid");
}

export function getLogFilePath() {
  return path.join(getTunnelDir(), "quick-tunnel.log");
}

export function getCloudflaredRuntimeDirs(): CloudflaredRuntimeDirs {
  const runtimeRoot = path.join(getTunnelDir(), "runtime");
  const homeDir = path.join(runtimeRoot, "home");
  const userProfileDir = path.join(runtimeRoot, "userprofile");

  return {
    runtimeRoot,
    homeDir,
    configDir: path.join(runtimeRoot, "config"),
    cacheDir: path.join(runtimeRoot, "cache"),
    dataDir: path.join(runtimeRoot, "data"),
    tempDir: path.join(runtimeRoot, "tmp"),
    userProfileDir,
    appDataDir: path.join(userProfileDir, "AppData", "Roaming"),
    localAppDataDir: path.join(userProfileDir, "AppData", "Local"),
  };
}

export function getLocalTargetUrl() {
  const { apiPort } = getRuntimePorts();
  return `http://127.0.0.1:${apiPort}`;
}

export function getTunnelApiUrl(publicUrl: string | null) {
  return publicUrl ? `${publicUrl.replace(/\/$/, "")}/v1` : null;
}

export async function ensureTunnelDir() {
  await fs.mkdir(path.join(getTunnelDir(), "bin"), { recursive: true });
}

export async function ensureTunnelRuntimeDirs() {
  const runtimeDirs = getCloudflaredRuntimeDirs();
  await Promise.all(
    Object.values(runtimeDirs).map((dirPath) => fs.mkdir(dirPath, { recursive: true }))
  );
}
