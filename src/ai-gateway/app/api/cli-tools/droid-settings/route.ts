import { NextResponse } from "next/server";
import { createBackup } from "@/shared/services/backupService";

"use server";

import fs from "fs/promises";
import path from "path";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  ensureCliConfigWriteAllowed,
  getCliPrimaryConfigPath,
  getCliRuntimeStatus,
} from "@/shared/services/cliRuntime";

import { saveCliToolLastConfigured, deleteCliToolLastConfigured } from "@/lib/db/cliToolState";
import { cliModelConfigSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { getApiKeyById } from "@/lib/localDb";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../../utils/errorLike.js';

const getDroidSettingsPath = () => getCliPrimaryConfigPath("droid");
const getDroidDir = () => path.dirname(getDroidSettingsPath());

// Read current settings.json
const readSettings = async () => {
  try {
    const settingsPath = getDroidSettingsPath();
    const content = await fs.readFile(settingsPath, "utf-8");
    return JSON.parse(content);
  } catch (error: unknown) {
    const err = asErrorLike(error);
    if (err.code === "ENOENT") return null;
    throw error;
  }
};

// Check if settings has ZavorthGateway customModels
const hasZavorthGatewayConfig = (settings: any) => {
  if (!settings || !settings.customModels) return false;
  return settings.customModels.some((m) => m.id === "custom:ZavorthGateway-0");
};

const redactDroidSettings = (settings: any) => {
  if (!settings?.customModels || !Array.isArray(settings.customModels)) {
    return settings;
  }
  return {
    ...settings,
    customModels: settings.customModels.map((model: any) => ({
      ...model,
      apiKey: model?.apiKey ? "[redacted]" : model?.apiKey,
    })),
  };
};

// GET - Check droid CLI and read current settings
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const runtime = await getCliRuntimeStatus("droid");

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
          runtime.installed && !runtime.runnable ? "Factory Droid CLI is installed but not runnable"
            : "Factory Droid CLI is not installed",
      });
    }

    const settings = await readSettings();

    return NextResponse.json({
      installed: runtime.installed,
      runnable: runtime.runnable,
      command: runtime.command,
      commandPath: runtime.commandPath,
      runtimeMode: runtime.runtimeMode,
      reason: runtime.reason,
      settings: redactDroidSettings(settings),
      hasZavorthGateway: hasZavorthGatewayConfig(settings),
      settingsPath: getDroidSettingsPath(),
    });
  } catch (error: unknown) {console.log("Error checking droid settings:", error);
    return NextResponse.json({ error: "Failed to check droid settings" }, { status: 500 });
  }
}

// POST - Update ZavorthGateway customModels (merge with existing settings)
export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch (error: unknown) {logger.warn('[route] filesystem check failed', error);
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

    const validation = validateBody(cliModelConfigSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { baseUrl, model } = validation.data;
    let { apiKey } = validation.data;

    // (#549) Resolve real key from DB if keyId was provided.
    const keyId = typeof rawBody?.keyId === "string" ? rawBody.keyId.trim() : null;
    if (keyId) {
      try {
        const keyRecord = await getApiKeyById(keyId);
        if (keyRecord?.key) {
          apiKey = keyRecord.key as string;
        }
      } catch (error: unknown) {// Non-critical: fall back to whatever value was in apiKey
      logger.warn('[route] validation failed', error);
    }
    }

    const droidDir = getDroidDir();
    const settingsPath = getDroidSettingsPath();

    // Ensure directory exists
    await fs.mkdir(droidDir, { recursive: true });

    // Backup current settings before modifying
    await createBackup("droid", settingsPath);

    // Read existing settings or create new
    let settings: Record<string, any> = {};
    try {
      const existingSettings = await fs.readFile(settingsPath, "utf-8");
      settings = JSON.parse(existingSettings);
    } catch (error: unknown) {/* No existing settings */ logger.warn('[route] JSON parse failed', error); }

    // Ensure customModels array exists
    if (!settings.customModels) {
      settings.customModels = [];
    }

    // Remove existing ZavorthGateway config if any
    settings.customModels = settings.customModels.filter((m) => m.id !== "custom:ZavorthGateway-0");

    // Normalize baseUrl to ensure /v1 suffix
    const normalizedBaseUrl = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;

    // Add new ZavorthGateway config
    const customModel = {
      model: model,
      id: "custom:ZavorthGateway-0",
      index: 0,
      baseUrl: normalizedBaseUrl,
      apiKey: apiKey || "your_api_key",
      displayName: model,
      maxOutputTokens: 131072,
      noImageSupport: false,
      provider: "openai",
    };

    settings.customModels.unshift(customModel);

    // Write settings
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));

    // Persist last-configured timestamp
    try {
      saveCliToolLastConfigured("droid");
    } catch (error: unknown) {/* non-critical */ logger.warn('[route] filesystem operation failed', error); }

    return NextResponse.json({
      success: true,
      message: "Factory Droid settings applied successfully!",
      settingsPath,
    });
  } catch (error: unknown) {console.log("Error updating droid settings:", error);
    return NextResponse.json({ error: "Failed to update droid settings" }, { status: 500 });
  }
}

// DELETE - Remove ZavorthGateway customModels only (keep other settings)
export async function DELETE(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const writeGuard = ensureCliConfigWriteAllowed();
    if (writeGuard) {
      return NextResponse.json({ error: writeGuard }, { status: 403 });
    }

    const settingsPath = getDroidSettingsPath();

    // Backup current settings before resetting
    await createBackup("droid", settingsPath);

    // Read existing settings
    let settings: Record<string, any> = {};
    try {
      const existingSettings = await fs.readFile(settingsPath, "utf-8");
      settings = JSON.parse(existingSettings);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      if (err.code === "ENOENT") {
        return NextResponse.json({
          success: true,
          message: "No settings file to reset",
        });
      }
      throw error;
    }

    // Remove ZavorthGateway customModels
    if (settings.customModels) {
      settings.customModels = settings.customModels.filter((m) => m.id !== "custom:ZavorthGateway-0");

      // Remove customModels array if empty
      if (settings.customModels.length === 0) {
        delete settings.customModels;
      }
    }

    // Write updated settings
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));

    // Clear last-configured timestamp
    try {
      deleteCliToolLastConfigured("droid");
    } catch (error: unknown) {/* non-critical */ logger.warn('[route] filesystem operation failed', error); }

    return NextResponse.json({
      success: true,
      message: "ZavorthGateway settings removed successfully",
    });
  } catch (error: unknown) {console.log("Error resetting droid settings:", error);
    return NextResponse.json({ error: "Failed to reset droid settings" }, { status: 500 });
  }
}
