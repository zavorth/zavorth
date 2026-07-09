import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getTaskManager } from "@/lib/a2a/taskManager";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../../../../utils/errorLike.js';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const tm = getTaskManager();
    const task = tm.cancelTask(id);
    return NextResponse.json({ task: { id: task.id, state: task.state } });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[route] filesystem check failed', error);
    const message = error instanceof Error ? err.message : "Failed to cancel A2A task";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
