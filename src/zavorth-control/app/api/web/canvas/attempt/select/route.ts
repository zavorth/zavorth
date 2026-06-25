import { NextResponse } from "next/server";
import {
  getRuntimeEngineApiState,
  isUnsafeCrossSiteMutation,
  readJsonBody,
} from "../../../runtime-engine-state";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (isUnsafeCrossSiteMutation(request)) {
    return NextResponse.json({
      ok: false,
      error: "cross-site mutation requests are blocked",
    }, { status: 403 });
  }
  const body = await readJsonBody(request);
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const attemptId = typeof body.attemptId === "string" ? body.attemptId : "";
  if (!sessionId || !attemptId) {
    return NextResponse.json({
      ok: false,
      error: "sessionId and attemptId are required",
    }, { status: 400 });
  }

  const { canvasSessions } = getRuntimeEngineApiState();
  const session = await canvasSessions.selectAttempt(sessionId, attemptId);
  return NextResponse.json({
    ok: Boolean(session),
    session,
  }, { status: session ? 200 : 404 });
}
