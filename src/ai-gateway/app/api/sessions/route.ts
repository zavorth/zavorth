import { NextResponse } from "next/server";
import {
  getActiveSessions,
  getActiveSessionCount,
  getAllActiveSessionCountsByKey,
} from "@ZavorthGateway/open-sse/services/sessionManager.ts";
import { requireStrictManagementAuth } from "@/lib/api/requireManagementAuth";

import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../utils/errorLike.js';
export async function GET(request: Request) {
  const authError = await requireStrictManagementAuth(request);
  if (authError) return authError;

  try {
    const sessions = getActiveSessions();
    const count = getActiveSessionCount();
    const byApiKey = getAllActiveSessionCountsByKey();
    return NextResponse.json({ count, sessions, byApiKey });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[route] operation failed', error);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
