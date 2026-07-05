import { getProviderConnections, getAllCustomModels } from "@/lib/localDb";
import { PROVIDER_MODELS, PROVIDER_ID_TO_ALIAS } from "@/shared/constants/models";
import { getAllEmbeddingModels } from "@ZavorthGateway/open-sse/config/embeddingRegistry.ts";
import { getAllImageModels } from "@ZavorthGateway/open-sse/config/imageRegistry.ts";
import { AI_PROVIDERS, ALIAS_TO_ID } from "@/shared/constants/providers";
import {
  ModelCatalogAggregationService,
  type ModelCatalogProviderInput,
} from "../../../../../services/providers/catalog/ModelCatalogAggregationService.js";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';

/**
 * GET /api/models/catalog
 * Returns all models grouped by provider, with metadata (type, custom flag)
 */
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const connections = await getProviderConnections();
    const activeProviders = new Set(connections.map((c) => c.provider));
    const customModelsMap = await getAllCustomModels().catch(() => ({}));
    const providerCatalogs: ModelCatalogProviderInput[] = Object.entries(PROVIDER_MODELS).map(([alias, models]) => {
      const providerId = ALIAS_TO_ID[alias] || alias;
      return {
        providerId,
        alias,
        label: AI_PROVIDERS[providerId]?.name || alias,
        active: activeProviders.has(providerId),
        source: "provider_catalog",
        models: (models as any[]).map((model) => ({
          id: model.id,
          name: model.name || model.id,
          type: "chat",
          source: "provider_catalog",
        })),
      };
    });

    const localCatalogs: ModelCatalogProviderInput[] = [
      ...getAllEmbeddingModels().map((emb: any) => {
        const provAlias = String(emb.id || "").split("/")[0] || emb.provider || "embedding";
        return {
          providerId: emb.provider || provAlias,
          alias: provAlias,
          label: AI_PROVIDERS[emb.provider]?.name || provAlias,
          active: activeProviders.has(emb.provider || provAlias),
          source: "local_catalog" as const,
          models: [{
            id: String(emb.id || "").includes("/") ? String(emb.id).split("/").slice(1).join("/") : emb.id,
            name: emb.name || emb.id,
            type: "embedding" as const,
            dimensions: emb.dimensions,
            source: "local_catalog" as const,
          }],
        };
      }),
      ...getAllImageModels().map((img: any) => ({
        providerId: img.provider,
        alias: img.provider,
        label: AI_PROVIDERS[img.provider]?.name || img.provider,
        active: activeProviders.has(img.provider),
        source: "local_catalog" as const,
        models: [{
          id: String(img.id || "").startsWith(`${img.provider}/`)
            ? String(img.id).slice(String(img.provider).length + 1)
            : img.id,
          name: img.name || img.id,
          type: "image" as const,
          supportedSizes: img.supportedSizes,
          source: "local_catalog" as const,
        }],
      })),
    ];

    const customCatalogs: ModelCatalogProviderInput[] = Object.entries(customModelsMap).map(([providerId, models]) => {
      const alias = PROVIDER_ID_TO_ALIAS[providerId] || providerId;
      return {
        providerId,
        alias,
        label: AI_PROVIDERS[providerId]?.name || alias,
        active: activeProviders.has(providerId),
        source: "custom_model",
        models: (models as any[]).map((model) => ({
          id: model.id,
          name: model.name || model.id,
          type: "chat",
          custom: model.source !== "imported",
          imported: model.source === "imported",
          source: model.source === "imported" ? "imported_model" : "custom_model",
        })),
      };
    });

    const aggregationService = new ModelCatalogAggregationService();
    const aggregation = aggregationService.aggregate({
      includeRegistryModels: false,
      activeProviderIds: Array.from(activeProviders),
      providerCatalogs,
      localCatalogs,
      customCatalogs,
    });
    const catalog = aggregationService.toLegacyModelsCatalog(aggregation);

    return Response.json({ catalog });
  } catch (error) {
    logger.warn('[route] operation failed', error);
    return Response.json(
      { error: { message: (error as any).message, type: "server_error" } },
      { status: 500 }
    );
  }
}
