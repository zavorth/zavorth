import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { findProjectRoot } from "../../../../../config/configHelpers.js";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  return NextResponse.json({
    AISTUDIO_API_KEY: process.env.AISTUDIO_API_KEY || process.env.GEMINI_API_KEY || "",
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
    TELEGRAM_DEFAULT_CHAT_ID: process.env.TELEGRAM_DEFAULT_CHAT_ID || "",
  });
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { AISTUDIO_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_DEFAULT_CHAT_ID } = body;

    const projectRoot = findProjectRoot();
    const envPath = path.join(projectRoot, ".env");

    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf8");
    }

    const lines = envContent.split(/\r?\n/);
    const updates: Record<string, string> = {
      AISTUDIO_API_KEY: AISTUDIO_API_KEY ?? "",
      GEMINI_API_KEY: AISTUDIO_API_KEY ?? "",
      TELEGRAM_BOT_TOKEN: TELEGRAM_BOT_TOKEN ?? "",
      TELEGRAM_DEFAULT_CHAT_ID: TELEGRAM_DEFAULT_CHAT_ID ?? "",
    };

    for (const [key, val] of Object.entries(updates)) {
      process.env[key] = val;
      const index = lines.findIndex(line => line.trim().startsWith(`${key}=`));
      if (index !== -1) {
        lines[index] = `${key}=${val}`;
      } else {
        lines.push(`${key}=${val}`);
      }
    }

    fs.writeFileSync(envPath, lines.join("\n"), "utf8");

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
