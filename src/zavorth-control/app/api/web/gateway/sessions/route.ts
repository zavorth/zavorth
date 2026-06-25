import { NextResponse } from "next/server";
import { buildControlSessionState } from "../../zavorthControl/zavorthControlApiSnapshot";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId") || "main";
  return NextResponse.json(buildControlSessionState(sessionId));
}

