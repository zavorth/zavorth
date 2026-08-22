import { NextResponse } from "next/server";
import { skillExecutor } from "@/lib/skills/executor";
import { asErrorLike } from '../../../../../utils/errorLike';
import { z } from "zod";

export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const executions = skillExecutor.listExecutions();
    return NextResponse.json({ executions });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[route] process execution failed', error);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


import { validateBody, isValidationFailure } from "@/shared/validation/helpers";
import { isAuthenticated } from "@/shared/utils/apiAuth";
import { logger } from '@/shared/utils/logger';

const executionSchema = z.object({
  skillName: z.string().min(1),
  apiKeyId: z.string().min(1),
  input: z.record(z.string(), z.unknown()).optional(),
  sessionId: z.string().optional(),
});

export async function POST(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rawBody = await request.json();
    const validation = validateBody(executionSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json(validation.error, { status: 400 });
    }
    const { skillName, input, apiKeyId, sessionId } = validation.data;

    const execution = await skillExecutor.execute(skillName, input || {}, {
      apiKeyId,
      sessionId,
    });
    return NextResponse.json({ execution });
  } catch (error: unknown) {
    const err = asErrorLike(error); err.message || String(err);
    if (err.message.includes("disabled")) {
      return NextResponse.json({ error }, { status: 503 });
    }
    return NextResponse.json({ error }, { status: 500 });
  }
}
