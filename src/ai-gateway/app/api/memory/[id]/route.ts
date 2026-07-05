import { NextResponse } from "next/server";
import { deleteMemory, getMemory } from "@/lib/memory/store";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { id } = await props.params;
    const success = await deleteMemory(id);
    if (!success) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.warn('[route] delete operation failed', error);
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error }, { status: 500 });
  }
}

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { id } = await props.params;
    const memory = await getMemory(id);
    if (!memory) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ memory });
  } catch (error) {
    logger.warn('[route] filesystem check failed', error);
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
