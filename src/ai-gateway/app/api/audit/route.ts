import { NextResponse } from "next/server";
import {
  getAuditLog,
  getAuditSummary,
  AuditTarget,
  AuditAction,
  AuditSource,
} from "@/domain/configAudit";
import { requireStrictManagementAuth } from "@/lib/api/requireManagementAuth";

import { safeParseInt } from "@/shared/utils/safeParseInt";
export async function GET(req: Request) {
  const authError = await requireStrictManagementAuth(req);
  if (authError) return authError;

  try {
    const url = new URL(req.url);
    const summary = url.searchParams.get("summary");

    if (summary === "true") {
      return NextResponse.json(getAuditSummary());
    }

    const limit = safeParseInt(url.searchParams.get("limit"), 50);
    const offset = safeParseInt(url.searchParams.get("offset"), 0);
    const target = url.searchParams.get("target") as AuditTarget | null;
    const action = url.searchParams.get("action") as AuditAction | null;
    const source = url.searchParams.get("source") as AuditSource | null;
    const since = url.searchParams.get("since");

    const options: unknown = { limit, offset };
    if (target) options.target = target;
    if (action) options.action = action;
    if (source) options.source = source;
    if (since) options.since = since;

    const result = getAuditLog(options);
    return NextResponse.json(result);
  } catch (error: unknown) {console.error("[API ERROR] /api/audit GET:", error);
    return NextResponse.json({ error: "Failed to fetch audit log." }, { status: 500 });
  }
}
