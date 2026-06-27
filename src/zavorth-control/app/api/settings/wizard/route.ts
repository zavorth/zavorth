import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { findProjectRoot } from "../../../../../config/configHelpers";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  describeWizardSecret,
  normalizeWizardUpdates,
  serializeEnvValue,
  type WizardSettingsResponse,
} from "@/lib/api/wizardSettings";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const response: WizardSettingsResponse = {
    fields: {
      AISTUDIO_API_KEY: describeWizardSecret(process.env.AISTUDIO_API_KEY || process.env.GEMINI_API_KEY),
      TELEGRAM_BOT_TOKEN: describeWizardSecret(process.env.TELEGRAM_BOT_TOKEN),
      TELEGRAM_DEFAULT_CHAT_ID: describeWizardSecret(process.env.TELEGRAM_DEFAULT_CHAT_ID),
    },
  };

  return NextResponse.json(response);
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const requestedUpdates = normalizeWizardUpdates(body);

    const projectRoot = findProjectRoot();
    const envPath = path.join(projectRoot, ".env");

    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf8");
    }

    const lines = envContent ? envContent.split(/\r?\n/) : [];
    const updates: Record<string, string> = {};
    if (requestedUpdates.AISTUDIO_API_KEY) {
      updates.AISTUDIO_API_KEY = requestedUpdates.AISTUDIO_API_KEY;
      updates.GEMINI_API_KEY = requestedUpdates.AISTUDIO_API_KEY;
    }
    if (requestedUpdates.TELEGRAM_BOT_TOKEN) {
      updates.TELEGRAM_BOT_TOKEN = requestedUpdates.TELEGRAM_BOT_TOKEN;
    }
    if (Object.prototype.hasOwnProperty.call(requestedUpdates, "TELEGRAM_DEFAULT_CHAT_ID")) {
      updates.TELEGRAM_DEFAULT_CHAT_ID = requestedUpdates.TELEGRAM_DEFAULT_CHAT_ID;
    }

    for (const [key, val] of Object.entries(updates)) {
      process.env[key] = val;
      const index = lines.findIndex((line) => line.trim().startsWith(`${key}=`));
      const serialized = `${key}=${serializeEnvValue(val)}`;
      if (index !== -1) {
        lines[index] = serialized;
      } else {
        lines.push(serialized);
      }
    }

    fs.writeFileSync(envPath, lines.join("\n"), "utf8");

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const status = error?.code === "invalid_wizard_settings" ? 400 : 500;
    return NextResponse.json({ error: status === 400 ? error.message : "Failed to save settings." }, { status });
  }
}
