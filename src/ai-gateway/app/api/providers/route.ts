import { NextResponse } from "next/server";
import {
  getProviderConnections,
  createProviderConnection,
  getProviderNodeById,
  isCloudEnabled,
} from "@/models";
import { APIKEY_PROVIDERS } from "@/shared/constants/config";
import { getConsistentMachineId } from "@/shared/utils/machineId";

import {
  isClaudeCodeCompatibleProvider,
  isOpenAICompatibleProvider,
  isAnthropicCompatibleProvider,
} from "@/shared/constants/providers";

import { syncToCloud } from "@/lib/cloudSync";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { createProviderSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { normalizeQoderPatProviderData } from "@ZavorthGateway/open-sse/services/qoderCli.ts";type AccessRouteConnectionInput = {
  id: string | null;
  provider: string | null;
  providerName: string | null;
  authType: string | null;
  isActive: boolean;
  apiKey: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  providerSpecificData: Record<string, unknown> | null;
  defaultModel: string | null;
  testStatus: string | null;
  lastError: string | null;
  lastTested: string | null;
};

function toAccessRouteConnectionInput(connection: any): AccessRouteConnectionInput {
  const providerSpecificData =
    connection?.providerSpecificData && typeof connection.providerSpecificData === "object"
      ? connection.providerSpecificData
      : null;
  return {
    id: connection?.id || null,
    provider: connection?.provider || null,
    providerName: connection?.provider || null,
    authType: connection?.authType || null,
    isActive: connection?.isActive !== false,
    apiKey: connection?.apiKey || null,
    accessToken: connection?.accessToken || null,
    refreshToken: connection?.refreshToken || null,
    providerSpecificData,
    defaultModel: connection?.defaultModel || null,
    testStatus: connection?.testStatus || null,
    lastError: connection?.lastError || null,
    lastTested: connection?.lastTested || null,
  };
}

function resolveZavorthControlAccessRoutes(connections: AccessRouteConnectionInput[]) {
  return connections.map((connection) => ({
    id: connection.id || connection.provider || "provider",
    provider: connection.provider,
    providerName: connection.providerName || connection.provider,
    authType: connection.authType,
    defaultModel: connection.defaultModel,
    status: connection.testStatus || (connection.isActive ? "ready" : "disabled"),
    isActive: connection.isActive,
    lastError: connection.lastError,
    lastTested: connection.lastTested,
  }));
}

// GET /api/providers - List all connections
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const connections = await getProviderConnections();

    // Hide sensitive fields
    const safeConnections = connections.map((c) => ({
      ...c,
      apiKey: undefined,
      accessToken: undefined,
      refreshToken: undefined,
      idToken: undefined,
    }));

    const accessRoutes = resolveZavorthControlAccessRoutes(connections.map(toAccessRouteConnectionInput));

    return NextResponse.json({ connections: safeConnections, accessRoutes });
  } catch (error: unknown) {console.log("Error fetching providers:", error);
    return NextResponse.json({ error: "Failed to fetch providers" }, { status: 500 });
  }
}

// POST /api/providers - Create new connection (API Key only, OAuth via separate flow)
export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    // Zod validation
    const validation = validateBody(createProviderSchema, body);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const {
      provider,
      apiKey,
      name,
      priority,
      globalPriority,
      defaultModel,
      testStatus,
      providerSpecificData: incomingPsd,
    } = validation.data;

    // Business validation
    const isValidProvider =
      APIKEY_PROVIDERS[provider] ||
      provider === "qoder" ||
      isOpenAICompatibleProvider(provider) ||
      isAnthropicCompatibleProvider(provider);

    if (!isValidProvider) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    let providerSpecificData = incomingPsd || null;
    const allowMultipleCompatibleConnections =
      process.env.ALLOW_MULTI_CONNECTIONS_PER_COMPAT_NODE === "true";

    if (provider === "qoder") {
      providerSpecificData = normalizeQoderPatProviderData(providerSpecificData || {});
    }

    if (isOpenAICompatibleProvider(provider)) {
      const node: any = await getProviderNodeById(provider);
      if (!node) {
        return NextResponse.json({ error: "OpenAI Compatible node not found" }, { status: 404 });
      }

      const existingConnections = await getProviderConnections({ provider });
      if (!allowMultipleCompatibleConnections && existingConnections.length > 0) {
        return NextResponse.json(
          { error: "Only one connection is allowed for this OpenAI Compatible node" },
          { status: 400 }
        );
      }

      providerSpecificData = {
        ...(providerSpecificData || {}),
        prefix: node.prefix,
        apiType: node.apiType,
        baseUrl: node.baseUrl,
        nodeName: node.name,
        ...(node.chatPath ? { chatPath: node.chatPath } : {}),
        ...(node.modelsPath ? { modelsPath: node.modelsPath } : {}),
      };
    } else if (isAnthropicCompatibleProvider(provider)) {
      const node: any = await getProviderNodeById(provider);
      if (!node) {
        return NextResponse.json(
          {
            error: isClaudeCodeCompatibleProvider(provider)
              ? "CC Compatible node not found"
              : "Anthropic Compatible node not found",
          },
          { status: 404 }
        );
      }

      const existingConnections = await getProviderConnections({ provider });
      if (!allowMultipleCompatibleConnections && existingConnections.length > 0) {
        return NextResponse.json(
          { error: "Only one connection is allowed for this Anthropic Compatible node" },
          { status: 400 }
        );
      }

      providerSpecificData = {
        ...(providerSpecificData || {}),
        prefix: node.prefix,
        baseUrl: node.baseUrl,
        nodeName: node.name,
        ...(node.chatPath ? { chatPath: node.chatPath } : {}),
        ...(node.modelsPath ? { modelsPath: node.modelsPath } : {}),
      };
    }

    const newConnection = await createProviderConnection({
      provider,
      authType: "apikey",
      name,
      apiKey,
      priority: priority || 1,
      globalPriority: globalPriority || null,
      defaultModel: defaultModel || null,
      providerSpecificData,
      isActive: true,
      testStatus: testStatus || "unknown",
    });

    // Note: Gemini model sync is now triggered client-side with progress dialog

    // Hide sensitive fields
    const result: Record<string, any> = { ...newConnection };
    delete result.apiKey;

    // Auto sync to Cloud if enabled
    await syncToCloudIfEnabled();

    return NextResponse.json({ connection: result }, { status: 201 });
  } catch (error: unknown) {console.log("Error creating provider:", error);
    return NextResponse.json({ error: "Failed to create provider" }, { status: 500 });
  }
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
  } catch (error: unknown) {console.log("Error syncing providers to cloud:", error);
  }
}
