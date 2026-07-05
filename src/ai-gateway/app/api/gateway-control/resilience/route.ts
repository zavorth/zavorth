import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  isUnsafeCrossSiteMutation,
  readJsonBody,
} from "../../web/runtime-engine-state";
import { GatewayResilienceControlService } from "../../../../../services/GatewayResilienceControlService.js";
import { logger } from '@/shared/utils/logger';

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const service = new GatewayResilienceControlService();
    return NextResponse.json(await service.buildSnapshot());
  } catch (error) {
    logger.warn('[route] creation failed', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "gateway resilience unavailable",
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  if (isUnsafeCrossSiteMutation(request)) {
    return NextResponse.json({
      ok: false,
      error: "cross-site mutation requests are blocked",
    }, { status: 403 });
  }

  try {
    const service = new GatewayResilienceControlService();
    const body = await readJsonBody(request);
    return NextResponse.json(await service.applyAction(body));
  } catch (error) {
    logger.warn('[route] filesystem check failed', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "gateway resilience action failed",
    }, { status: 400 });
  }
}
