import { getSettings } from "@/lib/localDb";
// Zavorth model plane with localDb integration.
import {
  getModelAliases,
  getComboByName,
  getProviderNodes,
  getCustomModels,
  getProviderConnections,
  getPricing,
} from "@/lib/localDb";

import { logger } from '@/shared/utils/logger';
import {
parseModel,
  resolveModelAliasFromMap,
  getModelInfoCore,
} from "../compat/openSseCompat";

export { parseModel };

interface CustomModel {
  id: string;
  apiFormat?: string;
}

interface ProviderConnection {
  isActive?: boolean;
  provider?: string;
  defaultModel?: string;
  model?: string;
  id?: string;
}

interface ComboModel {
  priority?: number;
}

interface ComboStrategy {
  strategy?: string;
  config?: Record<string, unknown>;
}

interface PricingData {
  [provider: string]: {
    [model: string]: {
      inputCostPer1M?: number;
      input?: number;
    };
  };
}

interface ResolveComboForModelResult {
  models?: unknown[];
}

/**
 * Resolve model alias from localDb
 */
export async function resolveModelAlias(alias: string) {
  const aliases = (await getModelAliases()) as Record<string, string>;
  return resolveModelAliasFromMap(alias, aliases);
}

/**
 * Look up the apiFormat for a custom model from the DB.
 * Returns "responses" if the model is configured for the Responses API, otherwise undefined.
 */
async function lookupCustomModelApiFormat(
  providerId: string,
  modelId: string
): Promise<string | undefined> {
  try {
    const models = await getCustomModels(providerId);
    if (!Array.isArray(models)) return undefined;
    const match = (models as CustomModel[]).find((m) => m.id === modelId);
    return match?.apiFormat === "responses" ? "responses" : undefined;
  } catch (error: unknown) { logger.warn('[model] operation failed', error); return undefined; }
}

/**
 * Get full model info (parse or resolve)
 */
export async function getModelInfo(modelStr: string) {
  const parsed = parseModel(modelStr);
  const { extendedContext } = parsed;

  // Check custom provider nodes first (for both alias and non-alias formats)
  if (parsed.providerAlias || parsed.provider) {
    // Ensure prefixToCheck is always a concise identifier, not a full model string
    const prefixToCheck = parsed.providerAlias || parsed.provider;

    // Check OpenAI Compatible nodes
    const openaiNodes = await getProviderNodes({ type: "openai-compatible" });
    const matchedOpenAI = openaiNodes.find((node) => node.prefix === prefixToCheck);
    if (matchedOpenAI) {
      const apiFormat = await lookupCustomModelApiFormat(
        matchedOpenAI.id as string,
        parsed.model as string
      );
      return {
        provider: matchedOpenAI.id as string,
        model: parsed.model,
        extendedContext,
        ...(apiFormat && { apiFormat }),
      };
    }

    // Check Anthropic Compatible nodes
    const anthropicNodes = await getProviderNodes({ type: "anthropic-compatible" });
    const matchedAnthropic = anthropicNodes.find((node) => node.prefix === prefixToCheck);
    if (matchedAnthropic) {
      const apiFormat = await lookupCustomModelApiFormat(
        matchedAnthropic.id as string,
        parsed.model as string
      );
      return {
        provider: matchedAnthropic.id as string,
        model: parsed.model,
        extendedContext,
        ...(apiFormat && { apiFormat }),
      };
    }

    // stripModelPrefix: if enabled, strip provider prefix and re-resolve
    // the bare model name using existing heuristics (claude-* → anthropic, etc.)
    try {
      const settings = await getSettings();
      if (settings.stripModelPrefix === true) {
        return { ...getModelInfoCore(parsed.model), extendedContext };
      }
    } catch (error: unknown) {
      // If settings read fails, fall through to normal resolution
      logger.warn('[model] parsing failed', error);
    }
  }

  return getModelInfoCore(modelStr);
}

/**
 * Check if model is a combo and return the full combo object
 * @returns {Promise<Object|null>} Full combo object or null if not a combo
 */
export async function getCombo(modelStr: string) {
  // Check combo DB first (supports names with /)
  const combo = await getComboByName(modelStr);
  if (combo && Array.isArray(combo.models) && combo.models.length > 0) {
    return combo;
  }
  return null;
}

/**
 * Check if model matches a combo by name OR by model-combo mapping pattern.
 * This augments getCombo() with glob-based model-to-combo resolution (#563).
 *
 * Resolution order:
 * 1. Exact combo name match (existing behavior)
 * 2. Model-combo mapping pattern match (new — glob patterns by priority)
 * 3. null (no combo — single-model request)
 */
export async function getComboForModel(modelStr: string) {
  const normalized = String(modelStr || "").trim().toLowerCase();
  if (["auto", "zavorth-auto", "zavorth/auto", "auto-combo"].includes(normalized)) {
    const autoCombo = await buildZavorthAutoCombo(normalized || "auto");
    if (autoCombo) return autoCombo;
  }

  // 1. Existing behavior — exact combo name match
  const combo = await getCombo(modelStr);
  if (combo) return normalizeZavorthComboStrategy(combo);

  // 2. NEW — check model-combo mappings table (pattern match)
  try {
    const { resolveComboForModel } = await import("@/lib/localDb");
    const mapped = await resolveComboForModel(modelStr);
    if (mapped && (mapped as ResolveComboForModelResult).models?.length > 0) {
      return normalizeZavorthComboStrategy(mapped as ComboStrategy);
    }
  } catch (error: unknown) {
      // If the mappings table doesn't exist yet (pre-migration), continue gracefully
      logger.warn('[model] health check failed', error);
    }

  return null;
}

async function buildZavorthAutoCombo(name: string) {
  try {
    const [connections, pricing] = await Promise.all([
      getProviderConnections({ isActive: true }).catch(() => []),
      getPricing().catch(() => ({})),
    ]);

    const models = connections
      .filter((connection: ProviderConnection) => connection?.isActive !== false && connection?.provider)
      .map((connection: ProviderConnection) => {
        const provider = String(connection.provider || "").trim();
        const model = String(connection.defaultModel || connection.model || "").trim();
        if (!provider || !model) return null;
        const price = Number(
          (pricing as PricingData)?.[provider]?.[model]?.inputCostPer1M ||
          (pricing as PricingData)?.[provider]?.[model]?.input ||
          0
        );
        return {
          model: `${provider}/${model}`,
          weight: 1,
          priority: Number.isFinite(price) && price > 0 ? Math.ceil(price * 1000) : 100,
          costHint: Number.isFinite(price) ? price : null,
        };
      })
      .filter(Boolean)
      .sort((a: ComboModel, b: ComboModel) => (a.priority || 100) - (b.priority || 100))
      .slice(0, 12);
    if (models.length === 0) return null;
    return {
      id: "zavorth-native-auto-combo",
      name,
      models,
      strategy: "cost-optimized",
      config: {
        source: "zavorth-native-auto",
        considers: ["active-provider-connections", "pricing", "availability-gates", "quota-preflight"],
      },
      isHidden: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error: unknown) { logger.warn('[model] connection failed', error); return null; }
}

function normalizeZavorthComboStrategy(combo: ComboStrategy) {
  const strategy = String(combo?.strategy || "priority");
  if (strategy !== "reset-aware") return combo;
  return {
    ...combo,
    strategy: "fill-first",
    config: {
      ...(combo.config || {}),
      zavorthNativeStrategy: "reset-aware",
      resetAware: true,
      execution: "cooldown-and-quota-aware-fill-first",
    },
  };
}

/**
 * Compatibility helper: get combo models as string array.
 * @returns {Promise<string[]|null>}
 */
export async function getComboModels(modelStr: string) {
  const combo = await getCombo(modelStr);
  if (!combo || !Array.isArray(combo.models)) return null;
  return combo.models.map((m) => (typeof m === "string" ? m : (m as { model: string }).model));
}