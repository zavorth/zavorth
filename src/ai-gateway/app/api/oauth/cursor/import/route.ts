import { NextResponse } from "next/server";
import { CursorService } from "@/lib/oauth/services/cursor";
import { createProviderConnection, isCloudEnabled, resolveProxyForProvider } from "@/models";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { syncToCloud } from "@/lib/cloudSync";
import { cursorImportSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { runWithProxyContext } from "@zavorth/ai-gateway/open-sse/utils/proxyFetch.ts";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../../../utils/errorLike.js';

/**
 * POST /api/oauth/cursor/import
 * Import and validate access token from Cursor IDE's local SQLite database
 *
 * Request body:
 * - accessToken: string - Access token from cursorAuth/accessToken
 * - machineId: string - Machine ID from storage.serviceMachineId
 */
export async function POST(request: any) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch (error: unknown) {logger.warn('[route] filesystem check failed', error);
    return NextResponse.json(
      {
        error: {
          message: "Invalid request",
          details: [{ field: "body", message: "Invalid JSON body" }],
        },
      },
      { status: 400 }
    );
  }

  try {
    const validation = validateBody(cursorImportSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { accessToken, machineId } = validation.data;

    const cursorService = new CursorService();

    // Resolve proxy for this provider (provider-level → global → direct)
    const proxy = await resolveProxyForProvider("cursor");

    // Validate token by making API call (through proxy if configured)
    const tokenData = await runWithProxyContext(proxy, () =>
      cursorService.validateImportToken(accessToken.trim(), machineId.trim())
    );

    // Try to extract user info from token
    const userInfo = cursorService.extractUserInfo(tokenData.accessToken);

    // Save to database
    const connection: any = await createProviderConnection({
      provider: "cursor",
      authType: "oauth",
      accessToken: tokenData.accessToken,
      refreshToken: null, // Cursor doesn't have public refresh endpoint
      expiresAt: new Date(Date.now() + tokenData.expiresIn * 1000).toISOString(),
      email: userInfo?.email || null,
      providerSpecificData: {
        machineId: tokenData.machineId,
        authMethod: "imported",
        provider: "Imported",
        userId: userInfo?.userId,
      },
      testStatus: "active",
    });

    // Auto sync to Cloud if enabled
    await syncToCloudIfEnabled();

    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        provider: connection.provider,
        email: connection.email,
      },
    });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    console.log("Cursor import token error:", error);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * GET /api/oauth/cursor/import
 * Get instructions for importing Cursor token
 */
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const cursorService = new CursorService();
  const instructions = cursorService.getTokenStorageInstructions();

  return NextResponse.json({
    provider: "cursor",
    method: "import_token",
    instructions,
    requiredFields: [
      {
        name: "accessToken",
        label: "Access Token",
        description: "From cursorAuth/accessToken in state.vscdb",
        type: "textarea",
      },
      {
        name: "machineId",
        label: "Machine ID",
        description: "From storage.serviceMachineId in state.vscdb",
        type: "text",
      },
    ],
  });
}

/**
 * Sync to Cloud if enabled
 */
async function syncToCloudIfEnabled() {
  try {
    const cloudEnabled = await isCloudEnabled();
    if (!cloudEnabled) return;

    const machineId = await getConsistentMachineId();
    await syncToCloud(machineId);
  } catch (error: unknown) {console.log("Error syncing to cloud after Cursor import:", error);
  }
}
