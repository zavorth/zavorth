import { NextRequest, NextResponse } from "next/server";
import { getPromptCache } from "@/lib/cacheLayer";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';
export async function GET(req: NextRequest) {
  const authError = await requireManagementAuth(req);
  if (authError) return authError;

  try {
    const cache = getPromptCache();
    const stats = (cache as unknown as Record<string, unknown>).getStats();
    return NextResponse.json(stats);
  } catch (error: unknown) {logger.warn('[route] cache operation failed', error);
    return NextResponse.json({ error: (error as unknown as Record<string, unknown>).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authError = await requireManagementAuth(req);
  if (authError) return authError;

  try {
    const cache = getPromptCache();
    (cache as unknown as Record<string, unknown>).clear();
    return NextResponse.json({ success: true, message: "Cache cleared" });
  } catch (error: unknown) {logger.warn('[route] cache operation failed', error);
    return NextResponse.json({ error: (error as unknown as Record<string, unknown>).message }, { status: 500 });
  }
}
