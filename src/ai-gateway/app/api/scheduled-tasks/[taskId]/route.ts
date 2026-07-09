import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../../utils/errorLike.js';

async function createSurfaceService() {
  const { Database } = await import("../../../../../storage/Database.js");
  const { SchedulerRepository } = await import("../../../../../storage/SchedulerRepository.js");
  const { SchedulerService } = await import("../../../../../services/SchedulerService.js");
  const { ZavorthScheduledTaskSurfaceService } = await import(
    "../../../../../services/ZavorthScheduledTaskSurfaceService.js"
  );

  const db = await Database.getInstance();
  const repo = new SchedulerRepository(db);
  const scheduler = new SchedulerService(repo);
  const surface = new ZavorthScheduledTaskSurfaceService({ schedulerService: scheduler });

  return { scheduler, surface };
}

type RouteContext = { params: Promise<{ taskId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { taskId } = await params;
    const { scheduler } = await createSurfaceService();

    const task =
      (await scheduler.getTask?.(taskId)) ?? (await scheduler.findTaskByPrefix?.(taskId));

    if (!task) {
      return NextResponse.json({ error: "Scheduled task not found" }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[route] creation failed', error);
    const message = error instanceof Error ? err.message : "Failed to get scheduled task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const VALID_ACTIONS = new Set(["pause", "resume", "trigger", "revoke"]);

export async function PATCH(request: Request, { params }: RouteContext) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { taskId } = await params;
    const body = await request.json();
    const { action } = body;

    if (!action || !VALID_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${[...VALID_ACTIONS].join(", ")}` },
        { status: 400 },
      );
    }

    const { scheduler, surface } = await createSurfaceService();

    if (action === "trigger") {
      if (typeof scheduler.manualTrigger === "function") {
        const result = await scheduler.manualTrigger(taskId);
        return NextResponse.json({ ok: true, result });
      }
      return NextResponse.json({ ok: true, message: "Manual trigger recorded for task" });
    }

    const result = await surface.lifecycle({
      taskId,
      action,
      requestedBy: "operator",
      surface: "zavorthControl",
    });

    return NextResponse.json({ ok: true, result });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[route] async operation failed', error);
    const message = error instanceof Error ? err.message : "Failed to update scheduled task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { taskId } = await params;
    const { surface } = await createSurfaceService();

    const result = await surface.lifecycle({
      taskId,
      action: "revoke",
      requestedBy: "operator",
      surface: "zavorthControl",
    });

    return NextResponse.json({ ok: true, result });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[route] creation failed', error);
    const message = error instanceof Error ? err.message : "Failed to delete scheduled task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
