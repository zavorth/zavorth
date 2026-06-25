import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: {
      status: "ready",
      channels: [],
      inbound: [],
    },
  });
}

