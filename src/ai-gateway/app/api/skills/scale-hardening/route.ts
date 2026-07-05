import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  UniversalSkillApprovedZavorthControlCanaryService,
  type UniversalSkillApprovedZavorthControlCanaryInput,
} from "../../../../../services/UniversalSkillApprovedZavorthControlCanaryService.js";
import type { ZavorthUniversalSkillZavorthControlCanaryMode } from "../../../../../contracts/ZavorthUniversalSkillApprovedZavorthControlCanaryContract.js";
import { logger } from '@/shared/utils/logger';

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const service = new UniversalSkillApprovedZavorthControlCanaryService();
    const snapshot = await service.buildSnapshot({
      discover: url.searchParams.get("discover") !== "false",
      canaryMode: normalizeCanaryMode(url.searchParams.get("canary")),
      selectedBatchId: url.searchParams.get("batch"),
      approvalId: url.searchParams.get("approvalId"),
      persistHistory: false,
      persistReport: false,
      persistScaleReport: false,
      persistCanaryReport: false,
    });
    return NextResponse.json(snapshot);
  } catch (error) {
    logger.warn('[route] validation failed', error);
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({})) as Partial<UniversalSkillApprovedZavorthControlCanaryInput>;
    const service = new UniversalSkillApprovedZavorthControlCanaryService();
    const snapshot = await service.buildSnapshot({
      ...body,
      canaryMode: normalizeCanaryMode(body.canaryMode),
      persistHistory: false,
      persistReport: false,
      persistScaleReport: false,
      persistCanaryReport: false,
    });
    return NextResponse.json(snapshot);
  } catch (error) {
    logger.warn('[route] creation failed', error);
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error }, { status: 500 });
  }
}

function normalizeCanaryMode(value: unknown): ZavorthUniversalSkillZavorthControlCanaryMode {
  return value === "dry-run" || value === "live" || value === "zavorthControl-only"
    ? value
    : "zavorthControl-only";
}
