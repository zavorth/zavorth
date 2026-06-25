import { NextRequest, NextResponse } from "next/server";
import { getPromptCache } from "@/lib/cacheLayer";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export async function GET(req: NextRequest) {
  const authError = await requireManagementAuth(req);
  if (authError) return authError;

  try {
    const cache = getPromptCache();
    const stats = (cache as any).getStats();
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json({ error: (error as any).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authError = await requireManagementAuth(req);
  if (authError) return authError;

  try {
    const cache = getPromptCache();
    (cache as any).clear();
    return NextResponse.json({ success: true, message: "Cache cleared" });
  } catch (error) {
    return NextResponse.json({ error: (error as any).message }, { status: 500 });
  }
}
