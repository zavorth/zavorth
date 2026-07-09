import { NextResponse } from "next/server";
import { skillRegistry } from "@/lib/skills/registry";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../utils/errorLike';

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    await skillRegistry.loadFromDatabase();
    const skills = skillRegistry.list();
    return NextResponse.json({ skills });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[route] load operation failed', error);
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
