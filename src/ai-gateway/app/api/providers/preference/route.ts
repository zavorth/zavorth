import { NextRequest, NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export async function GET(request: NextRequest) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { ZavorthProviderPreferencePersistenceService } = await import(
      "../../../../../services/ZavorthProviderPreferencePersistenceService.js"
    );
    const service = new ZavorthProviderPreferencePersistenceService();
    const preference = await service.readPreference();

    return NextResponse.json({ preference });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    const { providerId, modelId, routeId, confirm, dryRun } = body;

    if (!providerId) {
      return NextResponse.json({ error: "providerId is required" }, { status: 400 });
    }

    const { ZavorthProviderPreferencePersistenceService } = await import(
      "../../../../../services/ZavorthProviderPreferencePersistenceService.js"
    );
    const service = new ZavorthProviderPreferencePersistenceService();

    let result;
    const input = { providerId, modelId, routeId, confirm, dryRun } as any;
    if (dryRun === true || !confirm) {
      result = await service.preview(input);
    } else {
      result = await service.apply(input);
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
