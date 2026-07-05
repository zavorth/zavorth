"use server";

import { NextResponse } from "next/server";
import fs from "fs/promises";
import {
  getCliRuntimeStatus,
  CLI_TOOL_IDS,
  getCliPrimaryConfigPath,
} from "@/shared/services/cliRuntime";
import { getAllCliToolLastConfigured } from "@/lib/db/cliToolState";
import { getRuntimePorts } from "@/lib/runtime/ports";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';

const { apiPort } = getRuntimePorts();

// Check if a tool has ZavorthGateway configured by reading its config file directly
// This replaces the expensive self-referential HTTP calls to /api/cli-tools/*-settings
async function checkToolConfigStatus(toolId: string): Promise<string> {
  try {
    const configPath = getCliPrimaryConfigPath(toolId);
    if (!configPath) return "unknown";

    const content = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(content);

    // Each tool stores ZavorthGateway config differently
    switch (toolId) {
      case "claude":
        return config?.env?.ANTHROPIC_BASE_URL ? "configured" : "not_configured";
      case "codex":
        return config?.providers?.ZavorthGateway || config?.providers?.["openai-compatible"]
          ? "configured"
          : "not_configured";
      case "droid":
      case "external-executor":
      case "cline":
      case "kilo":
        // Generic check: look for ZavorthGateway-specific markers in the config
        const configStr = JSON.stringify(config).toLowerCase();
        return configStr.includes("ZavorthGateway") ||
          configStr.includes("sk_ZavorthGateway") ||
          configStr.includes(`localhost:${apiPort}`) ||
          configStr.includes(`127.0.0.1:${apiPort}`)
          ? "configured"
          : "not_configured";
      default:
        return "unknown";
    }
  } catch (error) { logger.warn('[route] serialization failed', error); return "not_configured"; }
}

/**
 * GET /api/cli-tools/status
 * Returns runtime + config status for all CLI tools in one batch call.
 * Used by the CLI Tools page to show status badges in collapsed state.
 */
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const statuses = {};

    // Run all runtime checks in parallel with individual timeouts
    const RUNTIME_CHECK_TIMEOUT = 5000; // 5s per tool max
    await Promise.all(
      CLI_TOOL_IDS.map(async (toolId) => {
        try {
          const runtime = (await Promise.race([
            getCliRuntimeStatus(toolId),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Timeout")), RUNTIME_CHECK_TIMEOUT)
            ),
          ])) as {
            installed: boolean;
            runnable: boolean;
            command?: string;
            commandPath?: string;
            reason?: string;
          };
          statuses[toolId] = {
            installed: runtime.installed,
            runnable: runtime.runnable,
            command: runtime.command,
            commandPath: runtime.commandPath,
            reason: runtime.reason || null,
          };
        } catch (error) {
          statuses[toolId] = {
            installed: false,
            runnable: false,
            reason: error.message || "Check failed",
          };
        }
      })
    );

    // Check config status for installed+runnable tools via direct file reads
    const settingsTools = ["claude", "codex", "droid", "external-executor", "cline", "kilo"];

    await Promise.all(
      settingsTools.map(async (toolId) => {
        if (!statuses[toolId]) {
          return;
        }
        if (!statuses[toolId].installed || !statuses[toolId].runnable) {
          statuses[toolId].configStatus = "not_installed";
          return;
        }
        statuses[toolId].configStatus = await checkToolConfigStatus(toolId);
      })
    );

    // Merge last-configured timestamps from SQLite
    try {
      const lastConfigured = getAllCliToolLastConfigured();
      for (const [toolId, timestamp] of Object.entries(lastConfigured)) {
        if (statuses[toolId]) {
          statuses[toolId].lastConfiguredAt = timestamp;
        }
      }
    } catch (error) { /* non-critical */ logger.warn('[route] operation failed', error); }

    return NextResponse.json(statuses);
  } catch (error) {
    console.log("Error fetching CLI tool statuses:", error);
    return NextResponse.json({ error: "Failed to fetch statuses" }, { status: 500 });
  }
}
