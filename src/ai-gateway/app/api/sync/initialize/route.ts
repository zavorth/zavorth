import { NextResponse } from "next/server";
import initializeCloudSync from "@/shared/services/initializeCloudSync";
import { startModelSyncScheduler } from "@/shared/services/modelSyncScheduler";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { resolveZavorthGatewayBaseUrl } from "@/shared/utils/resolveGatewayBaseUrl";
import { logger } from "@/shared/utils/logger";let syncInitialized = false;
let modelSyncInitialized = false;

// POST /api/sync/initialize - Initialize cloud sync scheduler
export async function POST(request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    if (syncInitialized) {
      return NextResponse.json({
        message: "Cloud sync already initialized",
      });
    }

    await initializeCloudSync();
    syncInitialized = true;

    // (#488) Start model auto-sync scheduler (24h, configurable via MODEL_SYNC_INTERVAL_HOURS)
    if (!modelSyncInitialized) {
      const origin = resolveZavorthGatewayBaseUrl();
      startModelSyncScheduler(origin);
      modelSyncInitialized = true;
    }

    return NextResponse.json({
      success: true,
      message: "Cloud sync initialized successfully",
      modelSyncEnabled: true,
    });
  } catch (error: unknown) {logger.info("Error initializing cloud sync:", error);
    return NextResponse.json(
      {
        error: "Failed to initialize cloud sync",
      },
      { status: 500 }
    );
  }
}

// GET /api/sync/status - Check sync initialization status
export async function GET(_request) {
  }
