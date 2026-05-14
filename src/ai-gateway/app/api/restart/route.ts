import { NextResponse } from "next/server";
import { requireStrictManagementAuth } from "@/lib/api/requireManagementAuth";

export async function POST(request: Request) {
  const authError = await requireStrictManagementAuth(request);
  if (authError) return authError;

  // Graceful restart: SIGTERM flows through the shutdown handler before the process manager restarts
  setTimeout(() => {
    process.kill(process.pid, "SIGTERM");
  }, 500);

  return NextResponse.json({ status: "restarting" });
}
