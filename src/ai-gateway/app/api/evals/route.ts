import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { listSuites, runSuite } from "@/lib/evals/evalRunner";
import { evalRunSuiteSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { logger } from '@/shared/utils/logger';

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const suites = listSuites();
    return NextResponse.json(suites);
  } catch (error) {
    logger.warn('[route] validation failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch (error) {
    logger.warn('[route] filesystem check failed', error);
    return NextResponse.json(
      {
        error: {
          message: "Invalid request",
          details: [{ field: "body", message: "Invalid JSON body" }],
        },
      },
      { status: 400 }
    );
  }

  try {
    const validation = validateBody(evalRunSuiteSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { suiteId, outputs } = validation.data;
    const result = runSuite(suiteId, outputs);
    return NextResponse.json(result);
  } catch (error) {
    logger.warn('[route] validation failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
