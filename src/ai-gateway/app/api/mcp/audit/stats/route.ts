import { NextResponse } from "next/server";
import { getAuditStats } from "@ZavorthGateway/open-sse/mcp-server/audit";
import { requireStrictManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../../../utils/errorLike.js';

export async function GET(request: Request) {
  const authError = await requireStrictManagementAuth(request);
  if (authError) return authError;

  try {
    const stats = await getAuditStats();
    return NextResponse.json(stats);
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[route] filesystem check failed', error);
    const message = error instanceof Error ? err.message : "Failed to load MCP audit stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
