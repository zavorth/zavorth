import { NextResponse } from "next/server";
import { getDiversityReport } from "../../../../../open-sse/services/autoCombo/providerDiversity";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const report = getDiversityReport();
    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
