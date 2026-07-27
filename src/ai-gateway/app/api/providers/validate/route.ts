import { NextResponse } from "next/server";
import { getProviderNodeById } from "@/models";
import {
  isClaudeCodeCompatibleProvider,
  isOpenAICompatibleProvider,
  isAnthropicCompatibleProvider,
} from "@/shared/constants/providers";
import { validateProviderApiKey } from "@/lib/providers/validation";

import { getProxyForLevel } from "@/lib/localDb";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { validateProviderApiKeySchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { runWithProxyContext } from "@ZavorthGateway/open-sse/utils/proxyFetch.ts";
import { logger } from '@/shared/utils/logger';
import {
AccessRouteResolutionService,
  type AccessRouteConfiguredProvider,
} from "../../../../../services/providers/catalog/AccessRouteResolutionService.js";function resolveValidationAccessRoute(input: {
  provider: string;
  apiKey: string;
  baseUrl?: string | null;
  valid: boolean;
  error?: string | null;
}) {
  const configured: AccessRouteConfiguredProvider = {
    credentialReady: Boolean(input.apiKey),
    baseUrl: input.baseUrl || null,
    healthReady: input.valid,
    healthStatus: input.valid ? "healthy" : "unhealthy",
    healthMessage: input.valid ? null : input.error || "Validation failed",
    checkedAt: new Date().toISOString(),
  };
  const provider = String(input.provider || "").trim();
  const customRouteKey = isOpenAICompatibleProvider(provider) ? "custom-openai-compatible"
    : isAnthropicCompatibleProvider(provider) ? "anthropic"
      : provider;
  const resolution = new AccessRouteResolutionService().resolveRoutes({
    includeAdvanced: true,
    configuredProviders: {
      [provider]: configured,
      [customRouteKey]: configured,
    },
  });
  const normalizedProvider = provider.toLowerCase();
  return resolution.routes.find((route) => {
    return route.id.toLowerCase() === normalizedProvider
      || route.providerId.toLowerCase() === normalizedProvider
      || route.providerName.toLowerCase() === normalizedProvider
      || route.aliases.map((alias) => alias.toLowerCase()).includes(normalizedProvider)
      || route.id.toLowerCase() === customRouteKey.toLowerCase();
  }) || null;
}

// POST /api/providers/validate - Validate API key with provider
export async function POST(request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch (error: unknown) {logger.warn('[route] validation failed', error);
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
    const validation = validateBody(validateProviderApiKeySchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { provider, apiKey, validationModelId, customUserAgent, baseUrl: bodyBaseUrl } = validation.data;

    let providerSpecificData: any = { validationModelId };
    if (customUserAgent) {
      providerSpecificData.customUserAgent = customUserAgent;
    }

    if (isOpenAICompatibleProvider(provider) || isAnthropicCompatibleProvider(provider)) {
      const node: any = await getProviderNodeById(provider);
      if (!node) {
        const typeName = isOpenAICompatibleProvider(provider) ? "OpenAI"
          : isClaudeCodeCompatibleProvider(provider) ? "CC"
            : "Anthropic";
        return NextResponse.json(
          { error: `${typeName} Compatible node not found` },
          { status: 404 }
        );
      }
      providerSpecificData = {
        ...providerSpecificData,
        baseUrl: bodyBaseUrl || node.baseUrl,
        apiType: node.apiType,
        chatPath: node.chatPath,
        modelsPath: node.modelsPath,
      };
    }

    const providerProxy = await getProxyForLevel("provider", provider);
    const globalProxy = providerProxy ? null : await getProxyForLevel("global");

    const result = await runWithProxyContext(providerProxy || globalProxy || null, () =>
      validateProviderApiKey({
        provider,
        apiKey,
        providerSpecificData,
      })
    );

    if (result.unsupported) {
      return NextResponse.json({ error: "Provider validation not supported" }, { status: 400 });
    }

    const error = result.valid ? null : result.error || "Invalid API key";

    return NextResponse.json({
      valid: !!result.valid,
      error,
      warning: result.warning || null,
      method: result.method || null,
      accessRoute: resolveValidationAccessRoute({
        provider,
        apiKey,
        baseUrl: providerSpecificData.baseUrl || bodyBaseUrl || null,
        valid: !!result.valid,
        error,
      }),
    });
  } catch (error: unknown) {console.log("Error validating API key:", error);
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
