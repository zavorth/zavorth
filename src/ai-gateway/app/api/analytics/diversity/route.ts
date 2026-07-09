import { NextResponse } from "next/server";
import { getDiversityReport } from "../../../../../open-sse/services/autoCombo/providerDiversity";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../../utils/errorLike.js';

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const report = getDiversityReport();
    return NextResponse.json(report);
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[route] operation failed', error);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
