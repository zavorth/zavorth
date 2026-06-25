import { NextResponse } from "next/server";
import {
  buildZavorthControlContracts,
  buildZavorthControlRuntimeSnapshot,
} from "./zavorthControlApiSnapshot";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId") || "main";
  return NextResponse.json({
    ok: true,
    snapshot: buildZavorthControlRuntimeSnapshot(sessionId),
    contractsV1: buildZavorthControlContracts(),
  });
}

