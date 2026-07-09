import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  return NextResponse.json({
    ok: true,
    ticket: "",
    mode: "http-snapshot",
    detail: "Live gateway streaming is optional for the native Control shell.",
  });
}
