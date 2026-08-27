import { NextResponse } from "next/server";
"use server";


import { checkForUpdates } from "@/lib/versionManager";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from "@/shared/utils/logger";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const tool = searchParams.get("tool") || "cliproxyapi";
    const result = await checkForUpdates(tool);
    return NextResponse.json(result);
  } catch (error: unknown) {logger.error("[version-manager] check-update error:", error);
    return NextResponse.json({ error: "Failed to check for updates" }, { status: 500 });
  }
}
