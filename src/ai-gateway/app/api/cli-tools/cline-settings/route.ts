import { NextResponse } from "next/server";

"use server";

import fs from "fs/promises";
import path from "path";
import os from "os";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { ensureCliConfigWriteAllowed, getCliRuntimeStatus } from "@/shared/services/cliRuntime";
import { createBackup } from "@/shared/services/backupService";
import { saveCliToolLastConfigured, deleteCliToolLastConfigured } from "@/lib/db/cliToolState";
import { cliModelConfigSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { getApiKeyById } from "@/lib/localDb";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../../utils/errorLike.js';

const CLINE_DATA_DIR = path.join(os.homedir(), ".cline", "data");
const GLOBAL_STATE_PATH = path.join(CLINE_DATA_DIR, "globalState.json");
const SECRETS_PATH = path.join(CLINE_DATA_DIR, "secrets.json");

// Read globalState.json
const readGlobalState = async () => {
  try {
    const content = await fs.readFile(GLOBAL_STATE_PATH, "utf-8");
    return JSON.parse(content);
  } catch (error: unknown) {
    const err = asErrorLike(error);
    if (err.code === "ENOENT") return null;
    throw error;
  }
};

// Check if ZavorthGateway is configured as OpenAI-compatible provider
const hasZavorthGatewayConfig = (globalState: unknown) => {
  if (!globalState) return false;
  const isOpenAi =
    globalState.actModeApiProvider === "openai" || globalState.planModeApiProvider === "openai";
  const baseUrl = globalState.openAiBaseUrl || "";
  return (
    isOpenAi &&
    (baseUrl.includes("localhost") ||
      baseUrl.includes("127.0.0.1") ||
      baseUrl.includes("ZavorthGateway"))
  );
};

// GET - Check cline CLI and read current settings
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const runtime = await getCliRuntimeStatus("cline");

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
          runtime.installed && !runtime.runnable ? "Cline CLI is installed but not runnable"
            : "Cline CLI is not installed",
      });
    }

    const globalState = await readGlobalState();

    return NextResponse.json({
      installed: runtime.installed,
      runnable: runtime.runnable,
      command: runtime.command,
      commandPath: runtime.commandPath,
      runtimeMode: runtime.runtimeMode,
      reason: runtime.reason,
      settings: {
        actModeApiProvider: globalState?.actModeApiProvider,
        planModeApiProvider: globalState?.planModeApiProvider,
        openAiBaseUrl: globalState?.openAiBaseUrl,
        openAiModelId: globalState?.openAiModelId,
        planModeOpenAiModelId: globalState?.planModeOpenAiModelId,
      },
      hasZavorthGateway: hasZavorthGatewayConfig(globalState),
      globalStatePath: GLOBAL_STATE_PATH,
      secretsPath: SECRETS_PATH,
    });
  } catch (error: unknown) {logger.info("Error checking cline settings:", error);
    return NextResponse.json({ error: "Failed to check cline settings" }, { status: 500 });
  }
}

// POST - Configure Cline to use ZavorthGateway as OpenAI-compatible provider
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
    const { baseUrl, apiKey, model } = validation.data;

    // (#526) Resolve real key from DB if keyId was provided
    const keyId = typeof rawBody?.keyId === "string" ? rawBody.keyId.trim() : null;
    if (keyId) {
      try {
        const keyRecord = await getApiKeyById(keyId);
        if (keyRecord?.key) apiKey = keyRecord.key as string;
      } catch (error: unknown) {/* non-critical */ logger.warn('[route] validation failed', error); }
    }

    // Ensure directory exists
    await fs.mkdir(CLINE_DATA_DIR, { recursive: true });

    // Backup current files before modifying
    await createBackup("cline", GLOBAL_STATE_PATH);
    await createBackup("cline", SECRETS_PATH);

    // Read existing globalState or create new
    let globalState: Record<string, unknown> = {};
    try {
      const existing = await fs.readFile(GLOBAL_STATE_PATH, "utf-8");
      globalState = JSON.parse(existing);
    } catch (error: unknown) {/* No existing config */ logger.warn('[route] JSON parse failed', error); }

    // Normalize baseUrl - Cline expects the base without /v1
    const normalizedBaseUrl = baseUrl.endsWith("/v1") ? baseUrl.slice(0, -3) : baseUrl;

    // Set OpenAI-compatible provider for both act and plan modes
    globalState.actModeApiProvider = "openai";
    globalState.planModeApiProvider = "openai";
    globalState.openAiBaseUrl = normalizedBaseUrl;
    globalState.openAiModelId = model;
    globalState.planModeOpenAiModelId = model;

    // Write globalState
    await fs.writeFile(GLOBAL_STATE_PATH, JSON.stringify(globalState, null, 2));

    // Write API key to secrets
    let secrets: Record<string, unknown> = {};
    try {
      const existing = await fs.readFile(SECRETS_PATH, "utf-8");
      secrets = JSON.parse(existing);
    } catch (error: unknown) {/* No existing secrets */ logger.warn('[route] JSON parse failed', error); }

    secrets.openAiApiKey = apiKey || "sk_ZavorthGateway";

    await fs.writeFile(SECRETS_PATH, JSON.stringify(secrets, null, 2));

    // Persist last-configured timestamp
    try {
      saveCliToolLastConfigured("cline");
    } catch (error: unknown) {/* non-critical */ logger.warn('[route] JSON parse failed', error); }

    return NextResponse.json({
      success: true,
      message: "Cline settings applied successfully!",
      globalStatePath: GLOBAL_STATE_PATH,
    });
  } catch (error: unknown) {logger.info("Error updating cline settings:", error);
    return NextResponse.json({ error: "Failed to update cline settings" }, { status: 500 });
  }
}

// DELETE - Remove ZavorthGateway OpenAI-compatible provider config
export async function DELETE(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const writeGuard = ensureCliConfigWriteAllowed();
    if (writeGuard) {
      return NextResponse.json({ error: writeGuard }, { status: 403 });
    }

    // Backup before reset
    await createBackup("cline", GLOBAL_STATE_PATH);
    await createBackup("cline", SECRETS_PATH);

    // Read existing state
    let globalState: Record<string, unknown> = {};
    try {
      const existing = await fs.readFile(GLOBAL_STATE_PATH, "utf-8");
      globalState = JSON.parse(existing);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      if (err.code === "ENOENT") {
        return NextResponse.json({ success: true, message: "No settings file to reset" });
      }
      throw error;
    }

    // Only reset if currently set to openai mode with our config
    if (globalState.actModeApiProvider === "openai") {
      delete globalState.openAiBaseUrl;
      delete globalState.openAiModelId;
      delete globalState.planModeOpenAiModelId;
      // Reset provider to default (cline)
      globalState.actModeApiProvider = "cline";
      globalState.planModeApiProvider = "cline";
    }

    await fs.writeFile(GLOBAL_STATE_PATH, JSON.stringify(globalState, null, 2));

    // Remove API key from secrets
    let secrets: Record<string, unknown> = {};
    try {
      const existing = await fs.readFile(SECRETS_PATH, "utf-8");
      secrets = JSON.parse(existing);
    } catch (error: unknown) {/* ignore */ logger.warn('[route] JSON parse failed', error); }

    delete secrets.openAiApiKey;
    await fs.writeFile(SECRETS_PATH, JSON.stringify(secrets, null, 2));

    // Clear last-configured timestamp
    try {
      deleteCliToolLastConfigured("cline");
    } catch (error: unknown) {/* non-critical */ logger.warn('[route] JSON parse failed', error); }

    return NextResponse.json({
      success: true,
      message: "ZavorthGateway settings removed from Cline",
    });
  } catch (error: unknown) {logger.info("Error resetting cline settings:", error);
    return NextResponse.json({ error: "Failed to reset cline settings" }, { status: 500 });
  }
}
