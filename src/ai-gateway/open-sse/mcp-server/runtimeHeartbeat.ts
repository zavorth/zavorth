import * as fs from "fs";
import * as path from "path";
import { resolveDataDir } from "@/lib/dataPaths";

export interface McpHeartbeat {
  pid: number;
  startedAt: string;
  lastHeartbeatAt: string;
  version?: string;
  transport?: string;
}

export interface HeartbeatLivenessOptions {
  requireLivePid?: boolean;
  staleAfterMs?: number;
}

const HEARTBEAT_FILE_NAME = "mcp-server-heartbeat.json";
const DEFAULT_STALE_AFTER_MS = 30_000;

export function resolveMcpHeartbeatPath(): string {
  return path.join(resolveDataDir(), HEARTBEAT_FILE_NAME);
}

export function readMcpHeartbeat(): McpHeartbeat | null {
  try {
    const raw = fs.readFileSync(resolveMcpHeartbeatPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<McpHeartbeat>;
    if (typeof parsed.pid !== "number" || typeof parsed.startedAt !== "string") {
      return null;
    }
    return {
      pid: parsed.pid,
      startedAt: parsed.startedAt,
      lastHeartbeatAt: typeof parsed.lastHeartbeatAt === "string" ? parsed.lastHeartbeatAt : parsed.startedAt,
      version: typeof parsed.version === "string" ? parsed.version : undefined,
      transport: typeof parsed.transport === "string" ? parsed.transport : undefined,
    };
  } catch (error: unknown) {
    return null;
  }
}

export function isProcessAlive(pid: number | null | undefined): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    return false;
  }
}

export function isMcpHeartbeatOnline(
  heartbeat: McpHeartbeat | null,
  options: HeartbeatLivenessOptions = {}
): boolean {
  if (!heartbeat) return false;

  const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  const lastBeatAt = new Date(heartbeat.lastHeartbeatAt).getTime();
  if (!Number.isFinite(lastBeatAt)) return false;

  const ageMs = Date.now() - lastBeatAt;
  if (ageMs < 0 || ageMs > staleAfterMs) return false;

  if (options.requireLivePid && !isProcessAlive(heartbeat.pid)) return false;

  return true;
}
