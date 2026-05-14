import { NextResponse } from "next/server";
import {
  getActiveSessions,
  getActiveSessionCount,
  getAllActiveSessionCountsByKey,
} from "@ZavorthGateway/open-sse/services/sessionManager.ts";
import { requireStrictManagementAuth } from "@/lib/api/requireManagementAuth";

export async function GET(request: Request) {
  const authError = await requireStrictManagementAuth(request);
  if (authError) return authError;

  try {
    const sessions = getActiveSessions();
    const count = getActiveSessionCount();
    const byApiKey = getAllActiveSessionCountsByKey();
    return NextResponse.json({ count, sessions, byApiKey });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
