import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../utils/errorLike.js';

async function createSurfaceService() {
  const { Database } = await import("../../../../storage/Database.js");
  const { SchedulerRepository } = await import("../../../../storage/SchedulerRepository.js");
  const { SchedulerService } = await import("../../../../services/SchedulerService.js");
  const { ZavorthScheduledTaskSurfaceService } = await import(
    "../../../../services/ZavorthScheduledTaskSurfaceService.js"
  );

  const db = await Database.getInstance();
  const repo = new SchedulerRepository(db);
  const scheduler = new SchedulerService(repo);
  const surface = new ZavorthScheduledTaskSurfaceService({ schedulerService: scheduler });

  return { scheduler, surface };
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { surface } = await createSurfaceService();
    const tasks = await surface.list();

    return NextResponse.json({ tasks });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[route] creation failed', error);
    const message = error instanceof Error ? err.message : "Failed to list scheduled tasks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { command, schedule, intent, delivery, deliveryTarget, surface: surfaceField } = body;

    if (!command || !schedule) {
      return NextResponse.json(
        { error: "Missing required fields: command and schedule" },
        { status: 400 },
      );
    }

    const { surface } = await createSurfaceService();

    const result = await surface.register({
      command,
      schedule,
      intent,
      delivery,
      deliveryTarget,
      surface: surfaceField || "zavorthControl",
      requestedBy: "operator",
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[route] creation failed', error);
    const message = error instanceof Error ? err.message : "Failed to create scheduled task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
