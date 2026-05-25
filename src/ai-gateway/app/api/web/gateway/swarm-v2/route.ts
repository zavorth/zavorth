import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    swarms: [],
    summary: {
      active: 0,
      pending: 0,
      failed: 0,
    },
  });
}
