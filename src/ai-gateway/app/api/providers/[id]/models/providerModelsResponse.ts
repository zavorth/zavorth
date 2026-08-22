import { NextResponse } from "next/server";
import { getModelIsHidden } from "@/lib/localDb";

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export function createModelsResponseBuilder(provider: string, excludeHidden: boolean) {
  return (payload: unknown, statusConfig?: ResponseInit) => {
    if (excludeHidden && payload.models && Array.isArray(payload.models)) {
      payload.models = payload.models.filter((model: unknown) => !getModelIsHidden(provider, model.id));
    }
    return NextResponse.json(payload, statusConfig);
  };
}
