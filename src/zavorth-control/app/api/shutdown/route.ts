import { NextResponse } from "next/server";
import { requireStrictManagementAuth } from "@/lib/api/requireManagementAuth";

export async function POST(request: Request) {
  const authError = await requireStrictManagementAuth(request);
  if (authError) return authError;

  const response = NextResponse.json({ success: true, message: "Shutting down..." });

  setTimeout(() => {
    process.kill(process.pid, "SIGTERM");
  }, 500);

  return response;
}
