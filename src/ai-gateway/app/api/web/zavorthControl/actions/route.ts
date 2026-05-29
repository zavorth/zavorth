import { NextResponse } from "next/server";
import { isUnsafeCrossSiteMutation } from "../../runtime-engine-state";
import { nowIso } from "../zavorthControlApiSnapshot";

export async function POST(request: Request) {
  if (isUnsafeCrossSiteMutation(request)) {
    return NextResponse.json({
      ok: false,
      error: "cross-site mutation requests are blocked",
    }, { status: 403 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  return NextResponse.json({
    ok: true,
    status: "recorded",
    action: body.action || null,
    receipt: {
      id: `control-action-${Date.now()}`,
      createdAt: nowIso(),
      surface: "zavorth-control",
    },
  });
}
