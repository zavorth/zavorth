import { NextResponse } from "next/server";
import { STARTUP_EPOCH } from "@/lib/gracefulShutdown";
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { epoch } = body;

    if (typeof epoch !== "number") {
      return NextResponse.json(
        { error: "Invalid payload: epoch is required as a number" },
        { status: 400 }
      );
    }

    if (epoch !== STARTUP_EPOCH) {
      console.warn(`[Drain API] Rejected drain request due to epoch mismatch. Expected: ${STARTUP_EPOCH}, received: ${epoch}`);
      return NextResponse.json(
        { error: "Epoch mismatch", expected: STARTUP_EPOCH, received: epoch },
        { status: 400 }
      );
    }

    console.log(`[Drain API] Epoch ${epoch} matched STARTUP_EPOCH. Triggering graceful shutdown...`);

    // Trigger process termination asynchronously to allow response completion
    setTimeout(() => {
      process.kill(process.pid, "SIGTERM");
    }, 500);

    return NextResponse.json({ success: true, message: "Draining shutdown initiated." });
  } catch (error: unknown) {
    console.error("[Drain API] Error processing request:", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
