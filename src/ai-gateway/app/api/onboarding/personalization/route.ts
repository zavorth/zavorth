import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';
import {
FirstRunPersonalizationService,
  type FirstRunPersonalizationAnswers,
} from "../../../../../services/FirstRunPersonalizationService";

function createService() {
  return new FirstRunPersonalizationService({ projectRoot: process.cwd() });
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    return NextResponse.json(createService().getStatus());
  } catch (error: any) { const err = error; const e = error;
    logger.warn('[route] creation failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to inspect personalization" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    const answers = (body.answers || body) as FirstRunPersonalizationAnswers;
    const completeBootstrap = body.completeBootstrap === true;
    const result = createService().applyAnswers(answers, { completeBootstrap });
    return NextResponse.json(result);
  } catch (error: any) { const err = error; const e = error;
    logger.warn('[route] creation failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save personalization" },
      { status: 500 }
    );
  }
}
