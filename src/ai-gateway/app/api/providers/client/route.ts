import { NextResponse } from "next/server";
import { getProviderConnections } from "@/lib/localDb";
import { requireStrictManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from "@/shared/utils/logger";// GET /api/providers/client - List all connections for client (includes sensitive fields for sync)
export async function GET(request: Request) {
  const authError = await requireStrictManagementAuth(request);
  if (authError) return authError;

  try {
    const connections = await getProviderConnections();

    // Include sensitive fields for sync to cloud (only accessible from same origin)
    const clientConnections = connections.map((c) => ({
      ...c,
      // Don't hide sensitive fields here since this is for internal sync
    }));

    return NextResponse.json({ connections: clientConnections });
  } catch (error: unknown) {logger.info("Error fetching providers for client:", error);
    return NextResponse.json({ error: "Failed to fetch providers" }, { status: 500 });
  }
}
