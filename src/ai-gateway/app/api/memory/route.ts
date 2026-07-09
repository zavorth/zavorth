import { NextResponse } from "next/server";
import { listMemories, createMemory } from "@/lib/memory/store";
import { MemoryType } from "@/lib/memory/types";
import { z } from "zod";
import { validateBody, isValidationFailure } from "@/shared/validation/helpers";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { safeParseInt } from "@/shared/utils/safeParseInt";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../utils/errorLike';

const createMemorySchema = z.object({
  content: z.string().min(1),
  key: z.string().min(1),
  type: z.nativeEnum(MemoryType).default(MemoryType.FACTUAL),
  sessionId: z.string().default(""),
  apiKeyId: z.string().default(""),
  metadata: z.record(z.string(), z.unknown()).default({}),
  expiresAt: z.coerce.date().nullable().default(null),
});

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const apiKeyId = searchParams.get("apiKeyId") || undefined;
    const type = (searchParams.get("type") as any) || undefined;
    const sessionId = searchParams.get("sessionId") || undefined;
    const limitParams = searchParams.get("limit");
    const offsetParams = searchParams.get("offset");

    const memories = await listMemories({
      apiKeyId,
      type,
      sessionId,
      limit: limitParams ? safeParseInt(limitParams, 50) : undefined,
      offset: offsetParams ? safeParseInt(offsetParams, 0) : undefined,
    });
    const stats = {
      total: memories.length,
      byType: memories.reduce(
        (acc, m) => {
          acc[m.type] = (acc[m.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    };
    return NextResponse.json({ memories, stats });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[route] parsing failed', error);
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const rawBody = await request.json();
    const validation = validateBody(createMemorySchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json(validation.error, { status: 400 });
    }
    const memoryId = await createMemory(validation.data);
    return NextResponse.json({ success: true, id: memoryId });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[route] validation failed', error);
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error }, { status: 400 });
  }
}
