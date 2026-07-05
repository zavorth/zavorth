import { NextResponse } from "next/server";
import { getSuite } from "@/lib/evals/evalRunner";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';

export async function GET(request, { params }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { suiteId } = await params;
    const suite = getSuite(suiteId);
    if (!suite) {
      return NextResponse.json({ error: `Suite not found: ${suiteId}` }, { status: 404 });
    }
    return NextResponse.json(suite);
  } catch (error) {
    logger.warn('[route] filesystem check failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
