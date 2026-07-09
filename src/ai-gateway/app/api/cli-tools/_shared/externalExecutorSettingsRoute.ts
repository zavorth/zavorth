"use server";

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import {
  ensureCliConfigWriteAllowed,
  getCliPrimaryConfigPath,
  getCliRuntimeStatus,
} from "@/shared/services/cliRuntime";
import { createBackup } from "@/shared/services/backupService";
import { saveCliToolLastConfigured, deleteCliToolLastConfigured } from "@/lib/db/cliToolState";
import { cliModelConfigSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { getApiKeyById } from "@/lib/localDb";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';

const EXTERNAL_EXECUTOR_TOOL_ID = "external-executor";
const DISPLAY_NAME = "External Executor";

const getExternalExecutorSettingsPath = () =>
  getCliPrimaryConfigPath(EXTERNAL_EXECUTOR_TOOL_ID) as string;
const getExternalExecutorDir = () => path.dirname(getExternalExecutorSettingsPath());

const presentRuntime = (runtime: Record<string, unknown>) => ({
  installed: runtime.installed,
  runnable: runtime.runnable,
  command: runtime.command,
  commandPath: runtime.commandPath,
  runtimeMode: runtime.runtimeMode,
  reason: runtime.reason,
});

const readSettings = async () => {
  try {
    const settingsPath = getExternalExecutorSettingsPath();
    const content = await fs.readFile(settingsPath, "utf-8");
    return JSON.parse(content);
  } catch (error: unknown) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
};

const hasZavorthGatewayConfig = (settings: any) => {
  if (!settings || !settings.models || !settings.models.providers) return false;
  return !!settings.models.providers["ZavorthGateway"];
};

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const runtime = await getCliRuntimeStatus(EXTERNAL_EXECUTOR_TOOL_ID);
    const runtimePayload = presentRuntime(runtime);

    if (!runtime.installed || !runtime.runnable) {
      return NextResponse.json({
        ...runtimePayload,
        settings: null,
        message:
          runtime.installed && !runtime.runnable
            ? `${DISPLAY_NAME} CLI is installed but not runnable`
            : `${DISPLAY_NAME} CLI is not installed`,
      });
    }

    const settings = await readSettings();

    return NextResponse.json({
      ...runtimePayload,
      settings,
      hasZavorthGateway: hasZavorthGatewayConfig(settings),
      settingsPath: getExternalExecutorSettingsPath(),
    });
  } catch (error: unknown) {console.log("Error checking external executor settings:", error);
    return NextResponse.json(
      { error: "Failed to check external executor settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch (error: unknown) {logger.warn('[external Executor Settings] process execution failed', error);
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
    let { baseUrl, apiKey, model } = validation.data;

    const keyId = typeof rawBody?.keyId === "string" ? rawBody.keyId.trim() : null;
    if (keyId) {
      try {
        const keyRecord = await getApiKeyById(keyId);
        if (keyRecord?.key) apiKey = keyRecord.key as string;
      } catch (error: unknown) {/* non-critical */ logger.warn('[external Executor Settings] validation failed', error); }
    }

    const executorDir = getExternalExecutorDir();
    const settingsPath = getExternalExecutorSettingsPath();

    await fs.mkdir(executorDir, { recursive: true });
    await createBackup(EXTERNAL_EXECUTOR_TOOL_ID, settingsPath);

    let settings: Record<string, any> = {};
    try {
      const existingSettings = await fs.readFile(settingsPath, "utf-8");
      settings = JSON.parse(existingSettings);
    } catch (error: unknown) {/* No existing settings */ logger.warn('[external Executor Settings] JSON parse failed', error); }

    if (!settings.agents) settings.agents = {};
    if (!settings.agents.defaults) settings.agents.defaults = {};
    if (!settings.agents.defaults.model) settings.agents.defaults.model = {};
    if (!settings.models) settings.models = {};
    if (!settings.models.providers) settings.models.providers = {};

    const normalizedBaseUrl = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;

    settings.agents.defaults.model.primary = `ZavorthGateway/${model}`;
    settings.models.providers["ZavorthGateway"] = {
      baseUrl: normalizedBaseUrl,
      apiKey: apiKey || "your_api_key",
      api: "openai-completions",
      models: [
        {
          id: model,
          name: model.split("/").pop() || model,
        },
      ],
    };

    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));

    try {
      saveCliToolLastConfigured(EXTERNAL_EXECUTOR_TOOL_ID);
    } catch (error: unknown) {/* non-critical */ logger.warn('[external Executor Settings] filesystem operation failed', error); }

    return NextResponse.json({
      success: true,
      message: `${DISPLAY_NAME} settings applied successfully!`,
      settingsPath,
    });
  } catch (error: unknown) {console.log("Error updating external executor settings:", error);
    return NextResponse.json(
      { error: "Failed to update external executor settings" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const writeGuard = ensureCliConfigWriteAllowed();
    if (writeGuard) {
      return NextResponse.json({ error: writeGuard }, { status: 403 });
    }

    const settingsPath = getExternalExecutorSettingsPath();

    await createBackup(EXTERNAL_EXECUTOR_TOOL_ID, settingsPath);

    let settings: Record<string, any> = {};
    try {
      const existingSettings = await fs.readFile(settingsPath, "utf-8");
      settings = JSON.parse(existingSettings);
    } catch (error: unknown) {
      if (error.code === "ENOENT") {
        return NextResponse.json({
          success: true,
          message: "No settings file to reset",
        });
      }
      throw error;
    }

    if (settings.models && settings.models.providers) {
      delete settings.models.providers["ZavorthGateway"];

      if (Object.keys(settings.models.providers).length === 0) {
        delete settings.models.providers;
      }
    }

    if (settings.agents?.defaults?.model?.primary?.startsWith("ZavorthGateway/")) {
      delete settings.agents.defaults.model.primary;
    }

    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));

    try {
      deleteCliToolLastConfigured(EXTERNAL_EXECUTOR_TOOL_ID);
    } catch (error: unknown) {/* non-critical */ logger.warn('[external Executor Settings] filesystem operation failed', error); }

    return NextResponse.json({
      success: true,
      message: "ZavorthGateway settings removed successfully",
    });
  } catch (error: unknown) {console.log("Error resetting external executor settings:", error);
    return NextResponse.json(
      { error: "Failed to reset external executor settings" },
      { status: 500 }
    );
  }
}
