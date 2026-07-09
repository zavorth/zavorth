import { CORS_ORIGIN } from "@/shared/utils/cors";
import { PROVIDER_MODELS, PROVIDER_ID_TO_ALIAS } from "@/shared/constants/models";
import { AI_PROVIDERS } from "@/shared/constants/providers";
import {
  getProviderConnections,
  getCombos,
  getAllCustomModels,
  getSettings,
  getProviderNodes,
  getModelIsHidden,
} from "@/lib/localDb";
import { isAuthenticated } from "@/shared/utils/apiAuth";
import { enforceApiKeyPolicy } from "@/shared/utils/apiKeyPolicy";
import { getAllEmbeddingModels } from "@ZavorthGateway/open-sse/config/embeddingRegistry.ts";
import { getAllImageModels } from "@ZavorthGateway/open-sse/config/imageRegistry.ts";
import { getAllRerankModels } from "@ZavorthGateway/open-sse/config/rerankRegistry.ts";
import { getAllAudioModels } from "@ZavorthGateway/open-sse/config/audioRegistry.ts";
import { getAllModerationModels } from "@ZavorthGateway/open-sse/config/moderationRegistry.ts";
import { getAllVideoModels } from "@ZavorthGateway/open-sse/config/videoRegistry.ts";
import { getAllMusicModels } from "@ZavorthGateway/open-sse/config/musicRegistry.ts";
import { REGISTRY } from "@ZavorthGateway/open-sse/config/providerRegistry.ts";
import { getSyncedAvailableModels } from "@/lib/db/models";
import { getCompatibleFallbackModels } from "@/lib/providers/managedAvailableModels";
import {
  ModelCatalogAggregationService,
  type ModelCatalogProviderInput,
} from "../../../../../services/providers/catalog/ModelCatalogAggregationService.js";
import type { ProviderModel } from "@ZavorthGateway/open-sse/config/providerModels.ts";
import type { SyncedAvailableModel } from "@/lib/db/models";

interface LocalRegistryModel {
  provider: string;
  id: string;
  name: string;
  dimensions?: number;
  supportedSizes?: string[];
  subtype?: string;
}

interface FallbackModel {
  id: string;
  name?: string;
  contextLength?: number;
  inputTokenLimit?: number;
}

const FALLBACK_ALIAS_TO_PROVIDER = {
  ag: "zavorthBridge",
  cc: "claude",
  cl: "cline",
  cu: "cursor",
  cx: "codex",
  gc: "gemini-cli",
  gh: "github",
  if: "iflow",
  kc: "kilocode",
  kmc: "kimi-coding",
  kr: "kiro",
  qw: "qwen",
};

const VISION_MODEL_KEYWORDS = [
  "gpt-4o",
  "gpt-4.1",
  "gpt-4-vision",
  "gpt-4-turbo",
  "claude-3",
  "claude-3.5",
  "claude-3-5",
  "claude-4",
  "claude-opus",
  "claude-sonnet",
  "claude-haiku",
  "gemini",
  "gemma",
  "llava",
  "bakllava",
  "pixtral",
  "mistral-pixtral",
  "qwen-vl",
  "qvq",
  "glm-4.6v",
  "glm-4.5v",
  "vision",
  "multimodal",
];

function isVisionModelId(modelId: string): boolean {
  const normalized = String(modelId || "").toLowerCase();
  if (!normalized) return false;
  return VISION_MODEL_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function getVisionCapabilityFields(modelId: string) {
  if (!isVisionModelId(modelId)) return null;
  return {
    capabilities: { vision: true },
    input_modalities: ["text", "image"],
    output_modalities: ["text"],
  };
}

function buildAliasMaps() {
  const aliasToProviderId: Record<string, string> = {};
  const providerIdToAlias: Record<string, string> = {};

  // Canonical source for ID/alias pairs used across zavorthControl/provider config.
  for (const provider of Object.values(AI_PROVIDERS)) {
    const providerId = provider?.id;
    const alias = provider?.alias || providerId;
    if (!providerId) continue;
    aliasToProviderId[providerId] = providerId;
    aliasToProviderId[alias] = providerId;
    if (!providerIdToAlias[providerId]) {
      providerIdToAlias[providerId] = alias;
    }
  }

  for (const [left, right] of Object.entries(PROVIDER_ID_TO_ALIAS)) {
    // Handle both possible directions:
    // - providerId -> alias
    // - alias -> providerId
    if (PROVIDER_MODELS[left]) {
      aliasToProviderId[left] = aliasToProviderId[left] || right;
      continue;
    }
    if (PROVIDER_MODELS[right]) {
      aliasToProviderId[right] = aliasToProviderId[right] || left;
      continue;
    }
    aliasToProviderId[right] = aliasToProviderId[right] || left;
  }

  for (const alias of Object.keys(PROVIDER_MODELS)) {
    if (!aliasToProviderId[alias]) {
      aliasToProviderId[alias] = alias;
    }
  }

  for (const [alias, providerId] of Object.entries(aliasToProviderId)) {
    if (!providerIdToAlias[providerId]) {
      providerIdToAlias[providerId] = alias;
    }
  }

  // Safety net for environments where alias maps are partially loaded during
  // module initialization/circular imports.
  for (const [alias, providerId] of Object.entries(FALLBACK_ALIAS_TO_PROVIDER)) {
    if (!aliasToProviderId[alias]) aliasToProviderId[alias] = providerId;
    if (!aliasToProviderId[providerId]) aliasToProviderId[providerId] = providerId;
    if (!providerIdToAlias[providerId]) providerIdToAlias[providerId] = alias;
  }

  return { aliasToProviderId, providerIdToAlias };
}

/**
 * Build unified OpenAI-compatible model catalog response.
 * Reused by `/api/v1/models` and `/api/v1` to avoid semantic drift (T09).
 */
export async function getUnifiedModelsResponse(
  request: Request,
  corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": CORS_ORIGIN,
  }
) {
  try {
    const accessPolicy = await enforceApiKeyPolicy(request, null);
    if (accessPolicy.rejection) return accessPolicy.rejection;

    // Issue #100: Optionally require authentication for /models (security hardening)
    // When enabled, unauthenticated requests get 401 with proper error response.
    // Supports API key (Bearer token) for external clients and JWT cookie for zavorthControl.
    let settings: Record<string, unknown> = {};
    try {
      settings = await getSettings();
    } catch (e: any) { const error = e; const err = e; console.warn('[catalog] Failed to fetch settings for auth check:', e); }
    if (settings.requireAuthForModels === true) {
      if (!(await isAuthenticated(request))) {
        return Response.json(
          {
            error: {
              message: "Authentication required",
              type: "invalid_request_error",
              code: "invalid_api_key",
            },
          },
          { status: 401 }
        );
      }
    }

    const { aliasToProviderId, providerIdToAlias } = buildAliasMaps();

    // Issue #96: Allow blocking specific providers from the models list
    const blockedProviders: Set<string> = new Set(
      Array.isArray(settings.blockedProviders) ? settings.blockedProviders : []
    );

    // Get active provider connections
    let connections = [];
    let totalConnectionCount = 0; // Track if DB has ANY connections (even disabled)
    try {
      connections = await getProviderConnections();
      totalConnectionCount = connections.length;
      // Filter to only active connections
      connections = connections.filter((c) => c.isActive !== false);
    } catch (e: any) { const error = e; const err = e;
      // If database not available, show no provider models (safe default)
      console.log("[catalog] Could not fetch providers:", e);
    }

    // Get provider nodes (for compatible providers with custom prefixes)
    let providerNodes = [];
    try {
      providerNodes = await getProviderNodes();
    } catch (e: any) { const error = e; const err = e;
      console.log("Could not fetch provider nodes");
    }

    // Build map of provider node ID to prefix and type for compatible providers
    const providerIdToPrefix: Record<string, string> = {};
    const nodeIdToProviderType: Record<string, string> = {};
    for (const node of providerNodes) {
      if (node.prefix) {
        providerIdToPrefix[node.id] = node.prefix;
      }
      if (node.type) {
        nodeIdToProviderType[node.id] = node.type;
      }
    }

    // Get combos
    let combos = [];
    try {
      combos = await getCombos();
    } catch (e: any) { const error = e; const err = e;
      console.log("Could not fetch combos");
    }

    // Build set of active provider aliases
    const activeAliases = new Set();
    for (const conn of connections) {
      const alias = providerIdToAlias[conn.provider] || conn.provider;
      activeAliases.add(alias);
      activeAliases.add(conn.provider);
    }

    // Collect models from active providers (or all if none active)
    const models = [];
    const timestamp = Math.floor(Date.now() / 1000);

    // Add combos first (they appear at the top) — only active ones
    for (const combo of combos) {
      if (combo.isActive === false || combo.isHidden === true) continue;
      models.push({
        id: combo.name,
        object: "model",
        created: timestamp,
        owned_by: "combo",
        permission: [],
        root: combo.name,
        parent: null,
        ...(combo.context_length ? { context_length: combo.context_length } : {}),
      });
    }

    const useCanonicalModelCatalog = true;
    if (useCanonicalModelCatalog) {
      const activeProviderIds = Array.from(activeAliases).map(String);
      const providerCatalogs: ModelCatalogProviderInput[] = Object.entries(PROVIDER_MODELS).map(([alias, providerModels]) => {
        const providerId = aliasToProviderId[alias] || alias;
        const canonicalProviderId = FALLBACK_ALIAS_TO_PROVIDER[alias] || providerId;
        const registryEntry = REGISTRY[alias] || REGISTRY[canonicalProviderId];
        const defaultContextLength = registryEntry?.defaultContextLength;
        return {
          providerId: canonicalProviderId,
          alias,
          label: AI_PROVIDERS[canonicalProviderId]?.name || AI_PROVIDERS[providerId]?.name || alias,
          active: activeAliases.has(alias) || activeAliases.has(canonicalProviderId),
          source: "provider_catalog",
          models: (providerModels as ProviderModel[])
            .filter((model) => !getModelIsHidden(canonicalProviderId, model.id))
            .map((model) => {
              const visionFields = getVisionCapabilityFields(`${alias}/${model.id}`) || getVisionCapabilityFields(model.id);
              return {
                id: model.id,
                name: model.name || model.id,
                type: "chat",
                contextLength: model.contextLength || defaultContextLength,
                capabilities: visionFields?.capabilities,
                modalities: visionFields?.input_modalities,
                source: "provider_catalog",
              };
            }),
        };
      });

      const liveCatalogs: ModelCatalogProviderInput[] = [];
      if (activeAliases.has("gemini") && !blockedProviders.has("gemini")) {
        try {
          const syncedModels = await getSyncedAvailableModels("gemini");
          liveCatalogs.push({
            providerId: "gemini",
            alias: "gemini",
            label: AI_PROVIDERS.gemini?.name || "Gemini",
            active: true,
            source: "live_api",
            models: syncedModels
              .filter((sm: SyncedAvailableModel) => !getModelIsHidden("gemini", sm.id))
              .flatMap((sm: SyncedAvailableModel) => {
                const endpoints = Array.isArray(sm.supportedEndpoints) ? sm.supportedEndpoints : ["chat"];
                let modelType: "chat" | "embedding" | "image" | "audio" = "chat";
                if (endpoints.includes("embeddings")) modelType = "embedding";
                else if (endpoints.includes("images")) modelType = "image";
                else if (endpoints.includes("audio")) modelType = "audio";
                const baseModel = {
                  id: sm.id,
                  name: sm.name || sm.id,
                  type: modelType,
                  subtype: modelType === "audio" ? "transcription" : null,
                  contextLength: sm.inputTokenLimit,
                  supportedEndpoints: endpoints,
                  source: "live_api" as const,
                };
                return modelType === "audio" ? [baseModel, { ...baseModel, subtype: "speech" }] : [baseModel];
              }),
          });
        } catch (err: any) { const error = err; const e = err;
          console.error("[catalog] Error fetching synced Gemini models:", err);
        }
      }

      const isProviderActive = (provider: string) => {
        if (activeAliases.size === 0) return false;
        const alias = providerIdToAlias[provider] || provider;
        return activeAliases.has(alias) || activeAliases.has(provider);
      };
      const localCatalogs: ModelCatalogProviderInput[] = [
        ...getAllEmbeddingModels().map((model: LocalRegistryModel) => ({
          providerId: model.provider,
          alias: providerIdToAlias[model.provider] || model.provider,
          label: AI_PROVIDERS[model.provider]?.name || model.provider,
          active: isProviderActive(model.provider),
          source: "local_catalog" as const,
          models: [{
            id: String(model.id || "").startsWith(`${model.provider}/`) ? String(model.id).slice(String(model.provider).length + 1) : model.id,
            name: model.name || model.id,
            type: "embedding" as const,
            dimensions: model.dimensions,
            source: "local_catalog" as const,
          }],
        })),
        ...getAllImageModels().map((model: LocalRegistryModel) => ({
          providerId: model.provider,
          alias: providerIdToAlias[model.provider] || model.provider,
          label: AI_PROVIDERS[model.provider]?.name || model.provider,
          active: isProviderActive(model.provider),
          source: "local_catalog" as const,
          models: [{
            id: String(model.id || "").startsWith(`${model.provider}/`) ? String(model.id).slice(String(model.provider).length + 1) : model.id,
            name: model.name || model.id,
            type: "image" as const,
            supportedSizes: model.supportedSizes,
            source: "local_catalog" as const,
          }],
        })),
        ...getAllRerankModels().map((model: LocalRegistryModel) => ({
          providerId: model.provider,
          alias: providerIdToAlias[model.provider] || model.provider,
          label: AI_PROVIDERS[model.provider]?.name || model.provider,
          active: isProviderActive(model.provider),
          source: "local_catalog" as const,
          models: [{ id: model.id, name: model.name || model.id, type: "rerank" as const, source: "local_catalog" as const }],
        })),
        ...getAllAudioModels().map((model: LocalRegistryModel) => ({
          providerId: model.provider,
          alias: providerIdToAlias[model.provider] || model.provider,
          label: AI_PROVIDERS[model.provider]?.name || model.provider,
          active: isProviderActive(model.provider),
          source: "local_catalog" as const,
          models: [{ id: model.id, name: model.name || model.id, type: "audio" as const, subtype: model.subtype, source: "local_catalog" as const }],
        })),
        ...getAllModerationModels().map((model: LocalRegistryModel) => ({
          providerId: model.provider,
          alias: providerIdToAlias[model.provider] || model.provider,
          label: AI_PROVIDERS[model.provider]?.name || model.provider,
          active: isProviderActive(model.provider),
          source: "local_catalog" as const,
          models: [{ id: model.id, name: model.name || model.id, type: "moderation" as const, source: "local_catalog" as const }],
        })),
        ...getAllVideoModels().map((model: LocalRegistryModel) => ({
          providerId: model.provider,
          alias: providerIdToAlias[model.provider] || model.provider,
          label: AI_PROVIDERS[model.provider]?.name || model.provider,
          active: isProviderActive(model.provider),
          source: "local_catalog" as const,
          models: [{ id: model.id, name: model.name || model.id, type: "video" as const, source: "local_catalog" as const }],
        })),
        ...getAllMusicModels().map((model: LocalRegistryModel) => ({
          providerId: model.provider,
          alias: providerIdToAlias[model.provider] || model.provider,
          label: AI_PROVIDERS[model.provider]?.name || model.provider,
          active: isProviderActive(model.provider),
          source: "local_catalog" as const,
          models: [{ id: model.id, name: model.name || model.id, type: "music" as const, source: "local_catalog" as const }],
        })),
      ];

      const customCatalogs: ModelCatalogProviderInput[] = [];
      try {
        const customModelsMap = (await getAllCustomModels()) as Record<string, unknown>;
        for (const [providerId, rawProviderCustomModels] of Object.entries(customModelsMap)) {
          if (providerId === "gemini") continue;
          const providerCustomModels = Array.isArray(rawProviderCustomModels)
            ? rawProviderCustomModels.filter((model): model is Record<string, unknown> => !!model && typeof model === "object" && !Array.isArray(model))
            : [];
          const prefix = providerIdToPrefix[providerId];
          const alias = prefix || providerIdToAlias[providerId] || providerId;
          const canonicalProviderId = FALLBACK_ALIAS_TO_PROVIDER[alias] || providerId;
          const parentProviderType = nodeIdToProviderType[providerId];
          const active = activeAliases.has(alias)
            || activeAliases.has(canonicalProviderId)
            || activeAliases.has(providerId)
            || Boolean(parentProviderType && activeAliases.has(parentProviderType));
          customCatalogs.push({
            providerId: canonicalProviderId,
            alias,
            label: AI_PROVIDERS[canonicalProviderId]?.name || alias,
            active,
            source: "custom_model",
            models: providerCustomModels
              .filter((model) => typeof model.id === "string" && model.isHidden !== true)
              .map((model) => {
                const modelId = String(model.id);
                const endpoints = Array.isArray(model.supportedEndpoints) ? model.supportedEndpoints as string[] : ["chat"];
                const apiFormat = typeof model.apiFormat === "string" ? model.apiFormat : "chat-completions";
                let modelType: "chat" | "embedding" | "image" | "audio" = "chat";
                if (endpoints.includes("embeddings")) modelType = "embedding";
                else if (endpoints.includes("images")) modelType = "image";
                else if (endpoints.includes("audio")) modelType = "audio";
                const visionFields = modelType === "chat" ? getVisionCapabilityFields(`${alias}/${modelId}`) || getVisionCapabilityFields(modelId) : null;
                return {
                  id: modelId,
                  name: String(model.name || modelId),
                  type: modelType,
                  custom: true,
                  supportedEndpoints: endpoints,
                  apiFormat,
                  contextLength: typeof model.inputTokenLimit === "number" ? model.inputTokenLimit : null,
                  capabilities: visionFields?.capabilities,
                  modalities: visionFields?.input_modalities,
                  source: "custom_model" as const,
                };
              }),
          });
        }
      } catch (e: any) { const error = e; const err = e;
        console.log("Could not fetch custom models");
      }

      const fallbackCatalogs: ModelCatalogProviderInput[] = connections.flatMap((conn) => {
        const providerId = typeof conn.provider === "string" ? conn.provider : null;
        if (!providerId || blockedProviders.has(providerId)) return [];
        const fallbackModels = getCompatibleFallbackModels(providerId);
        if (!Array.isArray(fallbackModels) || fallbackModels.length === 0) return [];
        const prefix = providerIdToPrefix[providerId];
        const alias = prefix || providerIdToAlias[providerId] || providerId;
        return [{
          providerId,
          alias,
          label: AI_PROVIDERS[providerId]?.name || alias,
          active: true,
          source: "fallback_catalog" as const,
          models: (fallbackModels as FallbackModel[])
            .filter((model) => typeof model.id === "string" && !getModelIsHidden(providerId, model.id))
            .map((model) => {
              const visionFields = getVisionCapabilityFields(`${alias}/${model.id}`) || getVisionCapabilityFields(model.id);
              return {
                id: model.id,
                name: model.name || model.id,
                type: "chat" as const,
                contextLength: typeof model.contextLength === "number" ? model.contextLength : null,
                capabilities: visionFields?.capabilities,
                modalities: visionFields?.input_modalities,
                source: "fallback_catalog" as const,
              };
            }),
        }];
      });

      const aggregationService = new ModelCatalogAggregationService();
      const aggregation = aggregationService.aggregate({
        includeRegistryModels: false,
        activeProviderIds,
        blockedProviderIds: Array.from(blockedProviders).map(String),
        providerCatalogs,
        liveCatalogs,
        localCatalogs,
        customCatalogs,
        fallbackCatalogs,
      });
      models.push(...aggregationService.toOpenAIModelsList(aggregation, { timestamp, activeOnly: true }));
    } else {
    // Add provider models (chat)
    for (const [alias, providerModels] of Object.entries(PROVIDER_MODELS)) {
      const providerId = aliasToProviderId[alias] || alias;
      const canonicalProviderId = FALLBACK_ALIAS_TO_PROVIDER[alias] || providerId;

      // Skip blocked providers (Issue #96)
      if (blockedProviders.has(alias) || blockedProviders.has(canonicalProviderId)) continue;

      // Only include models from providers with active connections
      if (!activeAliases.has(alias) && !activeAliases.has(canonicalProviderId)) {
        continue;
      }

      // Get default context length from registry (provider-level default)
      const registryEntry = REGISTRY[alias] || REGISTRY[canonicalProviderId];
      const defaultContextLength = registryEntry?.defaultContextLength;

      for (const model of providerModels) {
        const aliasId = `${alias}/${model.id}`;
        if (getModelIsHidden(canonicalProviderId, model.id)) continue;

        const visionFields =
          getVisionCapabilityFields(aliasId) || getVisionCapabilityFields(model.id);
        // Model-level context length overrides provider default
        const contextLength = model.contextLength || defaultContextLength;

        models.push({
          id: aliasId,
          object: "model",
          created: timestamp,
          owned_by: canonicalProviderId,
          permission: [],
          root: model.id,
          parent: null,
          ...(contextLength ? { context_length: contextLength } : {}),
          ...(visionFields || {}),
        });

        // Add provider-id prefix in addition to short alias (ex: kiro/model + kr/model).
        // This improves compatibility for clients that expect full provider names.
        if (canonicalProviderId !== alias) {
          const providerIdModel = `${canonicalProviderId}/${model.id}`;
          const providerVisionFields =
            getVisionCapabilityFields(providerIdModel) || getVisionCapabilityFields(model.id);
          models.push({
            id: providerIdModel,
            object: "model",
            created: timestamp,
            owned_by: canonicalProviderId,
            permission: [],
            root: model.id,
            parent: aliasId,
            ...(contextLength ? { context_length: contextLength } : {}),
            ...(providerVisionFields || {}),
          });
        }
      }
    }

    // Gemini: synced API models exclusively (outside PROVIDER_MODELS loop since registry is empty)
    if (activeAliases.has("gemini") && !blockedProviders.has("gemini")) {
      try {
        const syncedModels = await getSyncedAvailableModels("gemini");
        for (const sm of syncedModels) {
          const aliasId = `gemini/${sm.id}`;
          if (getModelIsHidden("gemini", sm.id)) continue;

          // Convert supportedEndpoints to type/subtype for endpoint categorization
          const endpoints = Array.isArray(sm.supportedEndpoints) ? sm.supportedEndpoints : ["chat"];
          let modelType: string | undefined;
          if (endpoints.includes("embeddings")) modelType = "embedding";
          else if (endpoints.includes("images")) modelType = "image";
          else if (endpoints.includes("audio")) modelType = "audio";

          models.push({
            id: aliasId,
            object: "model",
            created: timestamp,
            owned_by: "gemini",
            permission: [],
            root: sm.id,
            parent: null,
            ...(modelType ? { type: modelType } : {}),
            ...(modelType === "audio" ? { subtype: "transcription" } : {}),
            ...(sm.inputTokenLimit ? { context_length: sm.inputTokenLimit } : {}),
            ...(endpoints.length > 1 || !endpoints.includes("chat")
              ? { supported_endpoints: endpoints }
              : {}),
          });

          // For audio models, also add a speech variant so they appear in both sections
          if (modelType === "audio") {
            models.push({
              id: aliasId,
              object: "model",
              created: timestamp,
              owned_by: "gemini",
              permission: [],
              root: sm.id,
              parent: null,
              type: "audio",
              subtype: "speech",
              ...(sm.inputTokenLimit ? { context_length: sm.inputTokenLimit } : {}),
              ...(endpoints.length > 1 || !endpoints.includes("chat")
                ? { supported_endpoints: endpoints }
                : {}),
            });
          }
        }
      } catch (err: any) { const error = err; const e = err;
        console.error("[catalog] Error fetching synced Gemini models:", err);
      }
    }

    // Helper: check if a provider is active (by provider id or alias)
    const isProviderActive = (provider: string) => {
      if (activeAliases.size === 0) return false; // No active connections = show nothing
      const alias = providerIdToAlias[provider] || provider;
      return activeAliases.has(alias) || activeAliases.has(provider);
    };

    // Add embedding models (filtered by active providers)
    for (const embModel of getAllEmbeddingModels()) {
      if (!isProviderActive(embModel.provider)) continue;
      models.push({
        id: embModel.id,
        object: "model",
        created: timestamp,
        owned_by: embModel.provider,
        type: "embedding",
        dimensions: embModel.dimensions,
      });
    }

    // Add image models (filtered by active providers)
    for (const imgModel of getAllImageModels()) {
      if (!isProviderActive(imgModel.provider)) continue;
      models.push({
        id: imgModel.id,
        object: "model",
        created: timestamp,
        owned_by: imgModel.provider,
        type: "image",
        supported_sizes: imgModel.supportedSizes,
      });
    }

    // Add rerank models (filtered by active providers)
    for (const rerankModel of getAllRerankModels()) {
      if (!isProviderActive(rerankModel.provider)) continue;
      models.push({
        id: rerankModel.id,
        object: "model",
        created: timestamp,
        owned_by: rerankModel.provider,
        type: "rerank",
      });
    }

    // Add audio models (filtered by active providers)
    for (const audioModel of getAllAudioModels()) {
      if (!isProviderActive(audioModel.provider)) continue;
      models.push({
        id: audioModel.id,
        object: "model",
        created: timestamp,
        owned_by: audioModel.provider,
        type: "audio",
        subtype: audioModel.subtype,
      });
    }

    // Add moderation models (filtered by active providers)
    for (const modModel of getAllModerationModels()) {
      if (!isProviderActive(modModel.provider)) continue;
      models.push({
        id: modModel.id,
        object: "model",
        created: timestamp,
        owned_by: modModel.provider,
        type: "moderation",
      });
    }

    // Add video models (filtered by active providers)
    for (const videoModel of getAllVideoModels()) {
      if (!isProviderActive(videoModel.provider)) continue;
      models.push({
        id: videoModel.id,
        object: "model",
        created: timestamp,
        owned_by: videoModel.provider,
        type: "video",
      });
    }

    // Add music models (filtered by active providers)
    for (const musicModel of getAllMusicModels()) {
      if (!isProviderActive(musicModel.provider)) continue;
      models.push({
        id: musicModel.id,
        object: "model",
        created: timestamp,
        owned_by: musicModel.provider,
        type: "music",
      });
    }

    // Add custom models (user-defined)
    try {
      const customModelsMap = (await getAllCustomModels()) as Record<string, unknown>;
      for (const [providerId, rawProviderCustomModels] of Object.entries(customModelsMap)) {
        // Skip Gemini — handled by syncedAvailableModels above
        if (providerId === "gemini") continue;
        const providerCustomModels = Array.isArray(rawProviderCustomModels)
          ? rawProviderCustomModels.filter(
              (model): model is Record<string, unknown> =>
                !!model && typeof model === "object" && !Array.isArray(model)
            )
          : [];
        // For compatible providers, use the prefix from provider nodes
        const prefix = providerIdToPrefix[providerId];
        const alias = prefix || providerIdToAlias[providerId] || providerId;
        const canonicalProviderId = FALLBACK_ALIAS_TO_PROVIDER[alias] || providerId;

        // Only include if provider is active — check alias, canonical ID, raw providerId,
        // or the parent provider type (for compatible providers whose node ID is a UUID)
        const parentProviderType = nodeIdToProviderType[providerId];
        if (
          !activeAliases.has(alias) &&
          !activeAliases.has(canonicalProviderId) &&
          !activeAliases.has(providerId) &&
          !(parentProviderType && activeAliases.has(parentProviderType))
        )
          continue;

        for (const model of providerCustomModels) {
          const modelId = typeof model.id === "string" ? model.id : null;
          if (!modelId) continue;
          if (model.isHidden === true) continue;

          // Skip if already added as built-in
          const aliasId = `${alias}/${modelId}`;
          if (models.some((m) => m.id === aliasId)) continue;

          // Determine type from supportedEndpoints
          const endpoints = Array.isArray(model.supportedEndpoints)
            ? model.supportedEndpoints
            : ["chat"];
          const apiFormat =
            typeof model.apiFormat === "string" ? model.apiFormat : "chat-completions";
          let modelType: string | undefined;
          if (endpoints.includes("embeddings")) modelType = "embedding";
          else if (endpoints.includes("images")) modelType = "image";
          else if (endpoints.includes("audio")) modelType = "audio";
          const visionFields =
            modelType === "chat"
              ? getVisionCapabilityFields(aliasId) || getVisionCapabilityFields(modelId)
              : null;

          models.push({
            id: aliasId,
            object: "model",
            created: timestamp,
            owned_by: canonicalProviderId,
            permission: [],
            root: modelId,
            parent: null,
            custom: true,
            ...(modelType ? { type: modelType } : {}),
            ...(apiFormat !== "chat-completions" ? { api_format: apiFormat } : {}),
            ...(endpoints.length > 1 || !endpoints.includes("chat")
              ? { supported_endpoints: endpoints }
              : {}),
            ...(typeof (model as Record<string, unknown>).inputTokenLimit === "number"
              ? { context_length: (model as Record<string, unknown>).inputTokenLimit }
              : {}),
            ...(visionFields || {}),
          });

          // Only add provider-prefixed version if different from alias
          if (canonicalProviderId !== alias && !prefix) {
            const providerPrefixedId = `${canonicalProviderId}/${modelId}`;
            if (models.some((m) => m.id === providerPrefixedId)) continue;
            const providerVisionFields =
              modelType === "chat"
                ? getVisionCapabilityFields(providerPrefixedId) ||
                  getVisionCapabilityFields(modelId)
                : null;
            models.push({
              id: providerPrefixedId,
              object: "model",
              created: timestamp,
              owned_by: canonicalProviderId,
              permission: [],
              root: modelId,
              parent: aliasId,
              custom: true,
              ...(modelType ? { type: modelType } : {}),
              ...(typeof (model as Record<string, unknown>).inputTokenLimit === "number"
                ? { context_length: (model as Record<string, unknown>).inputTokenLimit }
                : {}),
              ...(providerVisionFields || {}),
            });
          }
        }
      }
    } catch (e: any) { const error = e; const err = e;
      console.log("Could not fetch custom models");
    }

    // Add managed fallback models for compatible providers that don't import a model list.
    for (const conn of connections) {
      const providerId = typeof conn.provider === "string" ? conn.provider : null;
      if (!providerId) continue;
      if (blockedProviders.has(providerId)) continue;

      const fallbackModels = getCompatibleFallbackModels(providerId);
      if (!Array.isArray(fallbackModels) || fallbackModels.length === 0) continue;
      const typedFallbackModels = fallbackModels as FallbackModel[];

      const prefix = providerIdToPrefix[providerId];
      const alias = prefix || providerIdToAlias[providerId] || providerId;

      for (const model of typedFallbackModels) {
        const modelId = typeof model.id === "string" ? model.id : null;
        if (!modelId) continue;
        if (getModelIsHidden(providerId, modelId)) continue;

        const aliasId = `${alias}/${modelId}`;
        if (models.some((m) => m.id === aliasId)) continue;

        const visionFields =
          getVisionCapabilityFields(aliasId) || getVisionCapabilityFields(modelId);
        const contextLength =
          typeof model.contextLength === "number"
            ? model.contextLength
            : undefined;

        models.push({
          id: aliasId,
          object: "model",
          created: timestamp,
          owned_by: providerId,
          permission: [],
          root: modelId,
          parent: null,
          ...(contextLength ? { context_length: contextLength } : {}),
          ...(visionFields || {}),
        });
      }
    }

    }

    // Filter by API key permissions if requested
    const authHeader = request.headers.get("authorization");
    let finalModels = models;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const apiKey = authHeader.slice(7);
      const { isModelAllowedForKey } = await import("@/lib/db/apiKeys");

      const filtered = [];
      for (const m of models) {
        // m.id is the full identifier (e.g. openai/gpt-4o), m.root is the raw model string
        // check either one as the config could use either patterns
        if (
          (await isModelAllowedForKey(apiKey, m.id)) ||
          (await isModelAllowedForKey(apiKey, m.root))
        ) {
          filtered.push(m);
        }
      }
      finalModels = filtered;
    }

    return Response.json(
      {
        object: "list",
        data: finalModels,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error: any) { const err = error; const e = error;
    console.log("Error fetching models:", error);
    return Response.json(
      { error: { message: error instanceof Error ? error.message : "Unknown error", type: "server_error" } },
      { status: 500 }
    );
  }
}
