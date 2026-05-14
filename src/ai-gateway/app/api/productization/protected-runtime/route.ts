import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  ZavorthProductizationProtectedRuntimeService,
  type ZavorthProductizationProtectedRuntimeView,
} from "../../../../../services/ZavorthProductizationProtectedRuntimeService";

function resolveView(value: string | null): ZavorthProductizationProtectedRuntimeView {
  if (value === "journey" || value === "templates" || value === "missions" || value === "receipts" || value === "sandbox") {
    return value;
  }
  return "all";
}

function selectView(
  snapshot: ReturnType<ZavorthProductizationProtectedRuntimeService["buildSnapshot"]>,
  view: ZavorthProductizationProtectedRuntimeView,
): unknown {
  if (view === "journey") return snapshot.firstRun;
  if (view === "templates") return snapshot.templates;
  if (view === "missions") return snapshot.mission;
  if (view === "receipts") return snapshot.receipt;
  if (view === "sandbox") return snapshot.sandbox;
  return snapshot;
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const view = resolveView(url.searchParams.get("view"));
    const service = new ZavorthProductizationProtectedRuntimeService();
    const snapshot = service.buildSnapshot({
      dailyMode: url.searchParams.get("mode"),
      detailMode: url.searchParams.get("detail"),
      selectedTemplateId: url.searchParams.get("template"),
      request: url.searchParams.get("request"),
      source: "web",
    });
    return NextResponse.json(selectView(snapshot, view));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build protected runtime projection" },
      { status: 500 },
    );
  }
}
