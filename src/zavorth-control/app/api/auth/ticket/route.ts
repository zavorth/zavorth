import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json({
    ok: true,
    ticket: "",
    mode: "http-snapshot",
    detail: "Live gateway streaming is optional for the native Control shell.",
  });
}
