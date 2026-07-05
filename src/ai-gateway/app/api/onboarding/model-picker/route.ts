import type { ModelCapabilityKind } from "../../../../../services/providers/catalog/ProviderCatalogContracts.js";
import { ProviderMeshOnboardingProductService } from "../../../../../services/providers/catalog/ProviderMeshOnboardingProductService.js";
import { logger } from '@/shared/utils/logger';

function readFlag(value: string | null): boolean {
  return String(value || "").trim().toLowerCase() === "true";
}

function readCapability(value: string | null): ModelCapabilityKind | null {
  const capability = String(value || "").trim();
  return capability ? capability as ModelCapabilityKind : null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const product = new ProviderMeshOnboardingProductService().buildProduct({
      includeAdvanced: readFlag(url.searchParams.get("includeAdvanced")),
      selectedFamilyId: url.searchParams.get("family"),
      selectedRouteId: url.searchParams.get("route"),
      selectedModelId: url.searchParams.get("model"),
      requestedCapability: readCapability(url.searchParams.get("capability")),
    });
    return Response.json({
      picker: product.picker,
      providerMeshOnboarding: product.providerMeshOnboarding,
    });
  } catch (error) {
    logger.warn('[route] search failed', error);
    return Response.json(
      {
        error: {
          message: error instanceof Error ? error.message : "Model picker failed",
          type: "model_picker_failed",
        },
      },
      { status: 500 }
    );
  }
}
