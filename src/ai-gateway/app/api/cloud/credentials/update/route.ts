import { NextResponse } from "next/server";
import { validateApiKey, getProviderConnections, updateProviderConnection } from "@/models";
import { cloudCredentialUpdateSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { requireStrictManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';

// Update provider credentials (for cloud token refresh)
export async function PUT(request: Request) {
  const authError = await requireStrictManagementAuth(request);
  if (authError) return authError;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch (error: any) { const err = error; const e = error;
    logger.warn('[route] validation failed', error);
    return NextResponse.json(
      { error: { message: "Invalid request", details: [{ field: "body", message: "Invalid JSON body" }] } },
      { status: 400 }
    );
  }

  try {
    const authHeader = request.headers.get("Authorization");
    const apiKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const usesApiKey = apiKey.length > 0;
    const allowApiKeyCredentialUpdate =
      process.env.ZAVORTH_ALLOW_API_KEY_CLOUD_CREDENTIAL_UPDATE === "true";
    if (usesApiKey && !allowApiKeyCredentialUpdate) {
      return NextResponse.json(
        { error: "Cloud credential updates by API key are disabled" },
        { status: 403 }
      );
    }

    const validation = validateBody(cloudCredentialUpdateSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { provider, credentials } = validation.data;

    if (usesApiKey) {
      const isValid = await validateApiKey(apiKey);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
      }
    }

    // Find active connection for provider
    const connections = await getProviderConnections({ provider, isActive: true });
    const connection = connections[0];

    if (!connection) {
      return NextResponse.json(
        { error: `No active connection found for provider: ${provider}` },
        { status: 404 }
      );
    }

    // Update credentials
    const updateData: Record<string, unknown> = {};
    if (credentials.accessToken) {
      updateData.accessToken = credentials.accessToken;
    }
    if (credentials.refreshToken) {
      updateData.refreshToken = credentials.refreshToken;
    }
    if (credentials.expiresIn) {
      updateData.expiresAt = new Date(Date.now() + credentials.expiresIn * 1000).toISOString();
    }

    const connectionId = typeof connection.id === "string" ? connection.id : null;
    if (!connectionId) {
      return NextResponse.json({ error: "Invalid provider connection ID" }, { status: 500 });
    }
    await updateProviderConnection(connectionId, updateData);

    return NextResponse.json({
      success: true,
      message: `Credentials updated for provider: ${provider}`,
    });
  } catch (error: any) { const err = error; const e = error;
    console.log("Update credentials error:", error);
    return NextResponse.json({ error: "Failed to update credentials" }, { status: 500 });
  }
}
