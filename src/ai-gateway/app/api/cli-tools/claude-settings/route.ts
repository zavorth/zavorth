"use server";

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  ensureCliConfigWriteAllowed,
  getCliPrimaryConfigPath,
  getCliRuntimeStatus,
} from "@/shared/services/cliRuntime";
import { createBackup } from "@/shared/services/backupService";
import { saveCliToolLastConfigured, deleteCliToolLastConfigured } from "@/lib/db/cliToolState";
import { cliSettingsEnvSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { getApiKeyById } from "@/lib/localDb";
import { logger } from '@/shared/utils/logger';

// Get claude settings path based on OS
const getClaudeSettingsPath = () => getCliPrimaryConfigPath("claude");

// Read current settings
const readSettings = async () => {
  try {
    const settingsPath = getClaudeSettingsPath();
    const content = await fs.readFile(settingsPath, "utf-8");
    return JSON.parse(content);
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

const redactSensitiveEnv = (settings: any) => {
  if (!settings?.env || typeof settings.env !== "object") {
    return settings;
  }
  const redacted = {
    ...settings,
    env: { ...settings.env },
  };
  for (const key of Object.keys(redacted.env)) {
    if (/token|key|secret|password/i.test(key)) {
      redacted.env[key] = "[redacted]";
    }
  }
  return redacted;
};

// GET - Check claude CLI and read current settings
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const runtime = await getCliRuntimeStatus("claude");

    if (!runtime.installed || !runtime.runnable) {
      return NextResponse.json({
        installed: runtime.installed,
        runnable: runtime.runnable,
        command: runtime.command,
        commandPath: runtime.commandPath,
        runtimeMode: runtime.runtimeMode,
        reason: runtime.reason,
        settings: null,
        message:
          runtime.installed && !runtime.runnable
            ? "Claude CLI is installed but not runnable"
            : "Claude CLI is not installed",
      });
    }

    const settings = await readSettings();
    const hasZavorthGateway = !!settings?.env?.ANTHROPIC_BASE_URL;

    return NextResponse.json({
      installed: runtime.installed,
      runnable: runtime.runnable,
      command: runtime.command,
      commandPath: runtime.commandPath,
      runtimeMode: runtime.runtimeMode,
      reason: runtime.reason,
      settings: redactSensitiveEnv(settings),
      hasZavorthGateway: hasZavorthGateway,
      settingsPath: getClaudeSettingsPath(),
    });
  } catch (error) {
    console.log("Error checking claude settings:", error);
    return NextResponse.json({ error: "Failed to check claude settings" }, { status: 500 });
  }
}

// POST - Backup old fields and write new settings
export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch (error) {
    logger.warn('[route] filesystem check failed', error);
    return NextResponse.json(
      {
        error: {
          message: "Invalid request",
          details: [{ field: "body", message: "Invalid JSON body" }],
        },
      },
      { status: 400 }
    );
  }

  try {
    const writeGuard = ensureCliConfigWriteAllowed();
    if (writeGuard) {
      return NextResponse.json({ error: writeGuard }, { status: 403 });
    }

    const validation = validateBody(cliSettingsEnvSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { env } = validation.data;

    // (#523/#526) If a keyId was provided, resolve the real API key from DB.
    // The /api/keys list endpoint returns masked key strings — sending those to
    // disk would save an unusable half-hidden token. Resolving by ID guarantees
    // we always write the full key value to the config file.
    const keyId = typeof rawBody?.keyId === "string" ? rawBody.keyId.trim() : null;
    if (keyId) {
      try {
        const keyRecord = await getApiKeyById(keyId);
        if (keyRecord?.key) {
          env.ANTHROPIC_AUTH_TOKEN = keyRecord.key as string;
        }
      } catch (error) { // Non-critical: fall back to whatever value was in env (e.g. sk_ZavorthGateway) logger.warn('[route] operation failed', error); }
    }

    const settingsPath = getClaudeSettingsPath();
    const claudeDir = path.dirname(settingsPath);

    // Ensure .claude directory exists
    await fs.mkdir(claudeDir, { recursive: true });

    // Backup current settings before modifying
    await createBackup("claude", settingsPath);

    // Read current settings
    let currentSettings: Record<string, any> = {};
    try {
      const content = await fs.readFile(settingsPath, "utf-8");
      currentSettings = JSON.parse(content);
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    // Normalize ANTHROPIC_BASE_URL to ensure /v1 suffix
    if (env.ANTHROPIC_BASE_URL) {
      env.ANTHROPIC_BASE_URL = env.ANTHROPIC_BASE_URL.endsWith("/v1")
        ? env.ANTHROPIC_BASE_URL
        : `${env.ANTHROPIC_BASE_URL}/v1`;
    }

    // Merge new env with existing settings
    const newSettings = {
      ...currentSettings,
      env: {
        ...(currentSettings.env || {}),
        ...env,
      },
    };

    // Write new settings
    await fs.writeFile(settingsPath, JSON.stringify(newSettings, null, 2));

    // Persist last-configured timestamp
    try {
      saveCliToolLastConfigured("claude");
    } catch (error) { /* non-critical */ logger.warn('[route] filesystem operation failed', error); }

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
    });
  } catch (error) {
    console.log("Error updating claude settings:", error);
    return NextResponse.json({ error: "Failed to update claude settings" }, { status: 500 });
  }
}

// Fields to remove when resetting
const RESET_ENV_KEYS = [
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_DEFAULT_OPUS_MODEL",
  "ANTHROPIC_DEFAULT_SONNET_MODEL",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL",
  "API_TIMEOUT_MS",
];

// DELETE - Reset settings (remove env fields)
export async function DELETE(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const writeGuard = ensureCliConfigWriteAllowed();
    if (writeGuard) {
      return NextResponse.json({ error: writeGuard }, { status: 403 });
    }

    const settingsPath = getClaudeSettingsPath();

    // Read current settings
    let currentSettings: Record<string, any> = {};
    try {
      const content = await fs.readFile(settingsPath, "utf-8");
      currentSettings = JSON.parse(content);
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return NextResponse.json({
          success: true,
          message: "No settings file to reset",
        });
      }
      throw error;
    }

    // Backup current settings before resetting
    await createBackup("claude", settingsPath);

    // Remove specified env fields
    if (currentSettings.env) {
      RESET_ENV_KEYS.forEach((key) => {
        delete currentSettings.env[key];
      });

      // Clean up empty env object
      if (Object.keys(currentSettings.env).length === 0) {
        delete currentSettings.env;
      }
    }

    // Write updated settings
    await fs.writeFile(settingsPath, JSON.stringify(currentSettings, null, 2));

    // Clear last-configured timestamp
    try {
      deleteCliToolLastConfigured("claude");
    } catch (error) { /* non-critical */ logger.warn('[route] filesystem operation failed', error); }

    return NextResponse.json({
      success: true,
      message: "Settings reset successfully",
    });
  } catch (error) {
    console.log("Error resetting claude settings:", error);
    return NextResponse.json({ error: "Failed to reset claude settings" }, { status: 500 });
  }
}
