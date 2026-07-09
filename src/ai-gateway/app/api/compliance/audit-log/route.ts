import { NextResponse } from "next/server";
import { getAuditLog, logAuditEvent } from "@/lib/compliance/index";
import { requireStrictManagementAuth } from "@/lib/api/requireManagementAuth";
import { safeParseInt } from "@/shared/utils/safeParseInt";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../../utils/errorLike.js';

export async function GET(request) {
  const authError = await requireStrictManagementAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || undefined;
    const actor = searchParams.get("actor") || undefined;
    const limit = safeParseInt(searchParams.get("limit"), 50);
    const offset = safeParseInt(searchParams.get("offset"), 0);

    const logs = getAuditLog({ action, actor, limit, offset });
    return NextResponse.json(logs);
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[route] parsing failed', error);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
