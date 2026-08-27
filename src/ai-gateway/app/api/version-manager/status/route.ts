import { NextResponse } from "next/server";
"use server";


import { getVersionManagerStatus } from "@/lib/versionManager";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from "@/shared/utils/logger";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const status = await getVersionManagerStatus();
    return NextResponse.json(status);
  } catch (error: unknown) {logger.error("[version-manager] status error:", error);
    return NextResponse.json({ error: "Failed to get status" }, { status: 500 });
  }
}
