import { NextResponse } from "next/server";
import { getAllExpirations, getExpirationSummary } from "@/domain/providerExpiration";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const list = getAllExpirations();
    const summary = getExpirationSummary();

    return NextResponse.json({
      summary,
      list,
    });
  } catch (error: any) { const err = error; const e = error;
    console.error("[API ERROR] /api/providers/expiration GET:", error);
    return NextResponse.json({ error: "Failed to fetch expiration metadata." }, { status: 500 });
  }
}
