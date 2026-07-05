import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireManagementAuth, requireStrictManagementAuth } from "@/lib/api/requireManagementAuth";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { logger } from '@/shared/utils/logger';
import {
getCloudflaredTunnelStatus,
  startCloudflaredTunnel,
  stopCloudflaredTunnel,
} from "@/lib/cloudflaredTunnel";

export const dynamic = "force-dynamic";

const actionSchema = z.object({
  action: z.enum(["enable", "disable"]),
});

export async function GET(request: NextRequest) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const status = await getCloudflaredTunnelStatus();
    return NextResponse.json(status);
  } catch (error) {
    logger.warn('[route] filesystem check failed', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load cloudflared tunnel status",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireStrictManagementAuth(request);
  if (authError) return authError;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (error) {
    logger.warn('[route] load operation failed', error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(actionSchema, rawBody);
  if (isValidationFailure(validation)) {
    return validation.response;
  }

  const parsed = validation.data;

  try {
    const status =
      parsed.action === "enable" ? await startCloudflaredTunnel() : await stopCloudflaredTunnel();

    return NextResponse.json({
      success: true,
      action: parsed.action,
      status,
    });
  } catch (error) {
    logger.warn('[route] parsing failed', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update cloudflared tunnel",
      },
      { status: 500 }
    );
  }
}
