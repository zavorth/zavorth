import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    activation: {
      status: "ready",
      activeProvider: null,
      nextAction: "Configure a provider when you are ready.",
    },
  });
}

