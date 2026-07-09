import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getTaskManager } from "@/lib/a2a/taskManager";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../../../utils/errorLike.js';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const tm = getTaskManager();
    const task = tm.getTask(id);
    if (!task) {
      return NextResponse.json({ error: `Task not found: ${id}` }, { status: 404 });
    }
    return NextResponse.json({ task });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[route] filesystem check failed', error);
    const message = error instanceof Error ? err.message : "Failed to load A2A task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
