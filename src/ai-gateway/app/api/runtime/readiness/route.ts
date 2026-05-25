import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    runtimeReadinessUx: {
      status: "ready",
      title: "Runtime ready",
      summary: "Dashboard runtime projection is available.",
      actions: [],
    },
  });
}
