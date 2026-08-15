import { NextResponse } from "next/server";
import { requireControlAuth } from "@/lib/api/requireManagementAuth";
import { buildControlSessionState } from "../../zavorthControl/zavorthControlApiSnapshot";

export async function GET(request: Request) {
  const authError = await requireControlAuth(request);
  if (authError) return authError;
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId") || "main";
  return NextResponse.json(buildControlSessionState(sessionId));
}

