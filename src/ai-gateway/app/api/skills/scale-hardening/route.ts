import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  UniversalSkillApprovedDashboardCanaryService,
  type UniversalSkillApprovedDashboardCanaryInput,
} from "../../../../../services/UniversalSkillApprovedDashboardCanaryService.js";
import type { ZavorthUniversalSkillCanaryMode } from "../../../../../contracts/ZavorthUniversalSkillApprovedDashboardCanaryContract.js";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const service = new UniversalSkillApprovedDashboardCanaryService();
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
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({})) as Partial<UniversalSkillApprovedDashboardCanaryInput>;
    const service = new UniversalSkillApprovedDashboardCanaryService();
    const snapshot = await service.buildSnapshot({
      ...body,
      canaryMode: normalizeCanaryMode(body.canaryMode),
      persistHistory: false,
      persistReport: false,
      persistScaleReport: false,
      persistCanaryReport: false,
    });
    return NextResponse.json(snapshot);
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error }, { status: 500 });
  }
}

function normalizeCanaryMode(value: unknown): ZavorthUniversalSkillCanaryMode {
  return value === "dry-run" || value === "live" || value === "dashboard-only"
    ? value
    : "dashboard-only";
}
