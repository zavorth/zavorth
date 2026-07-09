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

const KILO_DATA_DIR = path.join(os.homedir(), ".local", "share", "kilo");
const AUTH_PATH = path.join(KILO_DATA_DIR, "auth.json");
const KILO_CONFIG_DIR = path.join(os.homedir(), ".config", "kilo");

// Read auth.json
const readAuth = async () => {
  try {
    const content = await fs.readFile(AUTH_PATH, "utf-8");
    return JSON.parse(content);
  } catch (error: unknown) {
    const err = asErrorLike(error);
    if (err.code === "ENOENT") return null;
    throw error;
  }
};

// Check if ZavorthGateway OpenAI-compatible provider is configured
const hasZavorthGatewayConfig = (auth) => {
  if (!auth) return false;
  const routerEntry = auth["openai-compatible"] || auth["ZavorthGateway"];
  if (!routerEntry) return false;
  const baseUrl = routerEntry.baseUrl || routerEntry.baseURL || "";
  return (
    baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1") || baseUrl.includes("ZavorthGateway")
  );
};

// GET - Check kilo CLI and read current settings
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const runtime = await getCliRuntimeStatus("kilo");

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
            ? "Kilo Code CLI is installed but not runnable"
            : "Kilo Code CLI is not installed",
      });
    }

    const auth = await readAuth();

    // Read kilo VS Code extension settings if available
    let extensionSettings = null;
    try {
      const vscodeSettingsPath = path.join(
        os.homedir(),
        ".config",
        "Code",
        "User",
        "settings.json"
      );
      const raw = await fs.readFile(vscodeSettingsPath, "utf-8");
      const allSettings = JSON.parse(raw);
      // Extract kilo-related settings
      extensionSettings = {};
      for (const [key, value] of Object.entries(allSettings)) {
        if (
          key.startsWith("kilocode.") ||
          key.startsWith("kilo-code.") ||
          key.startsWith("kilo.")
        ) {
          extensionSettings[key] = value;
        }
      }
    } catch (error: unknown) {/* VS Code settings not available */ logger.warn('[route] JSON parse failed', error); }

    return NextResponse.json({
      installed: runtime.installed,
      runnable: runtime.runnable,
      command: runtime.command,
      commandPath: runtime.commandPath,
      runtimeMode: runtime.runtimeMode,
      reason: runtime.reason,
      settings: {
        auth: auth ? Object.keys(auth) : [],
        extensionSettings,
      },
      hasZavorthGateway: hasZavorthGatewayConfig(auth),
      authPath: AUTH_PATH,
    });
  } catch (error: unknown) {console.log("Error checking kilo settings:", error);
    return NextResponse.json({ error: "Failed to check kilo settings" }, { status: 500 });
  }
}

// POST - Configure Kilo Code to use ZavorthGateway as OpenAI-compatible provider
export async function POST(request) {
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

    // Ensure directories exist
    await fs.mkdir(KILO_DATA_DIR, { recursive: true });

    // Backup auth before modifying
    await createBackup("kilo", AUTH_PATH);

    // Read existing auth
    let auth = {};
    try {
      const existing = await fs.readFile(AUTH_PATH, "utf-8");
      auth = JSON.parse(existing);
    } catch (error: unknown) {/* No existing auth */ logger.warn('[route] JSON parse failed', error); }

    // Normalize baseUrl
    const normalizedBaseUrl = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;

    // Add/update ZavorthGateway as openai-compatible provider
    auth["openai-compatible"] = {
      type: "api-key",
      apiKey: apiKey || "sk_ZavorthGateway",
      baseUrl: normalizedBaseUrl,
      model: model,
    };

    await fs.writeFile(AUTH_PATH, JSON.stringify(auth, null, 2));

    // Also try to update VS Code extension settings if available
    try {
      const vscodeSettingsPath = path.join(
        os.homedir(),
        ".config",
        "Code",
        "User",
        "settings.json"
      );
      let vscodeSettings = {};
      try {
        const raw = await fs.readFile(vscodeSettingsPath, "utf-8");
        vscodeSettings = JSON.parse(raw);
      } catch (error: unknown) {/* no existing settings */ logger.warn('[route] JSON parse failed', error); }

      // Set custom provider config for the extension
      vscodeSettings["kilocode.customProvider"] = {
        name: "ZavorthGateway",
        baseURL: normalizedBaseUrl,
        apiKey: apiKey || "sk_ZavorthGateway",
      };
      vscodeSettings["kilocode.defaultModel"] = model;

      await fs.writeFile(vscodeSettingsPath, JSON.stringify(vscodeSettings, null, 2));
    } catch (error: unknown) {// VS Code settings not writable — not a problem for CLI
      logger.warn('[route] filesystem operation failed', error);
    }

    // Persist last-configured timestamp
    try {
      saveCliToolLastConfigured("kilo");
    } catch (error: unknown) {/* non-critical */ logger.warn('[route] filesystem operation failed', error); }

    return NextResponse.json({
      success: true,
      message: "Kilo Code settings applied successfully!",
      authPath: AUTH_PATH,
    });
  } catch (error: unknown) {console.log("Error updating kilo settings:", error);
    return NextResponse.json({ error: "Failed to update kilo settings" }, { status: 500 });
  }
}

// DELETE - Remove ZavorthGateway config from Kilo
export async function DELETE(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const writeGuard = ensureCliConfigWriteAllowed();
    if (writeGuard) {
      return NextResponse.json({ error: writeGuard }, { status: 403 });
    }

    // Backup before reset
    await createBackup("kilo", AUTH_PATH);

    // Read existing auth
    let auth = {};
    try {
      const existing = await fs.readFile(AUTH_PATH, "utf-8");
      auth = JSON.parse(existing);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      if (err.code === "ENOENT") {
        return NextResponse.json({ success: true, message: "No settings file to reset" });
      }
      throw error;
    }

    // Remove ZavorthGateway provider
    delete auth["openai-compatible"];
    delete auth["ZavorthGateway"];

    await fs.writeFile(AUTH_PATH, JSON.stringify(auth, null, 2));

    // Also clean up VS Code extension settings
    try {
      const vscodeSettingsPath = path.join(
        os.homedir(),
        ".config",
        "Code",
        "User",
        "settings.json"
      );
      const raw = await fs.readFile(vscodeSettingsPath, "utf-8");
      const vscodeSettings = JSON.parse(raw);
      delete vscodeSettings["kilocode.customProvider"];
      delete vscodeSettings["kilocode.defaultModel"];
      await fs.writeFile(vscodeSettingsPath, JSON.stringify(vscodeSettings, null, 2));
    } catch (error: unknown) {/* ignore */ logger.warn('[route] JSON parse failed', error); }

    // Clear last-configured timestamp
    try {
      deleteCliToolLastConfigured("kilo");
    } catch (error: unknown) {/* non-critical */ logger.warn('[route] JSON parse failed', error); }

    return NextResponse.json({
      success: true,
      message: "ZavorthGateway settings removed from Kilo Code",
    });
  } catch (error: unknown) {console.log("Error resetting kilo settings:", error);
    return NextResponse.json({ error: "Failed to reset kilo settings" }, { status: 500 });
  }
}
