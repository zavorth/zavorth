import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    runtimeGuidedFixes: {
      status: "ready",
      fixes: [],
      nextAction: "No guided runtime fix is required.",
    },
  });
}
