import { z } from "zod";
import { isForbiddenUpstreamHeaderName } from "@/shared/constants/upstreamHeaders";
import { logger } from '@/shared/utils/logger';

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error: any) { const err = error; const e = error; logger.warn('[schema-provider] network request failed', error); return false; }
}

export const jsonObjectSchema = z.record(z.string(), z.unknown());

export const createProviderSchema = z.object({
  provider: z.string().min(1).max(100),
  apiKey: z.string().min(1).max(10000),
  name: z.string().min(1).max(200),
  priority: z.number().int().min(1).max(100).optional(),
  globalPriority: z.number().int().min(1).max(100).nullable().optional(),
  defaultModel: z.string().max(200).nullable().optional(),
  testStatus: z.string().max(50).optional(),
  providerSpecificData: z
    .record(z.string(), z.unknown())
    .optional()
    .superRefine((data, ctx) => {
      if (!data) return;
      const baseUrl = data.baseUrl;
      if (baseUrl !== undefined && (typeof baseUrl !== "string" || !isHttpUrl(baseUrl))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "providerSpecificData.baseUrl must be a valid http(s) URL",
          path: ["baseUrl"],
        });
      }
      const customUserAgent = data.customUserAgent;
      if (
        customUserAgent !== undefined &&
        customUserAgent !== null &&
        (typeof customUserAgent !== "string" || customUserAgent.length > 500)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "providerSpecificData.customUserAgent must be a string up to 500 chars",
          path: ["customUserAgent"],
        });
      }
    }),
});

export const createKeySchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  noLog: z.boolean().optional(),
});

const fallbackChainEntrySchema = z
  .object({
    provider: z.string().trim().min(1, "provider is required"),
    priority: z.number().int().min(1).max(100).optional(),
    enabled: z.boolean().optional(),
  })
  .catchall(z.unknown());

export const registerFallbackSchema = z.object({
  model: z.string().trim().min(1, "Model is required").max(200),
  chain: z.array(fallbackChainEntrySchema).min(1, "chain must contain at least one provider"),
});

export const removeFallbackSchema = z.object({
  model: z.string().trim().min(1, "Model is required").max(200),
});

export const updateModelAliasSchema = z.object({
  model: z.string().trim().min(1, "Model is required").max(200),
  alias: z.string().trim().min(1, "Alias is required").max(200),
});

export const clearModelAvailabilitySchema = z.object({
  provider: z.string().trim().min(1, "provider is required").max(120),
  model: z.string().trim().min(1, "Model is required").max(200),
});

const upstreamHeaderNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .refine((s) => !/[\r\n\0]/.test(s), { message: "header name cannot contain control characters" })
  .refine((s) => !/\s/.test(s), { message: "header name cannot contain whitespace" })
  .refine((s) => !s.includes(":"), { message: "header name cannot contain ':'" })
  .refine((s) => !isForbiddenUpstreamHeaderName(s), { message: "header name is not allowed" });

const upstreamHeaderValueSchema = z
  .string()
  .max(4096)
  .refine((s) => !/[\r\n]/.test(s), { message: "header value cannot contain line breaks" });

const upstreamHeadersRecordSchema = z
  .record(upstreamHeaderNameSchema, upstreamHeaderValueSchema)
  .refine((rec) => Object.keys(rec).length <= 16, { message: "at most 16 custom headers" })
  .refine((rec) => !Object.keys(rec).some((k) => isForbiddenUpstreamHeaderName(k)), {
    message: "forbidden header name in record",
  });

const modelCompatPerProtocolSchema = z
  .object({
    normalizeToolCallId: z.boolean().optional(),
    preserveOpenAIDeveloperRole: z.boolean().optional(),
    upstreamHeaders: upstreamHeadersRecordSchema.optional(),
  })
  .strict();

export const providerModelMutationSchema = z.object({
  provider: z.string().trim().min(1, "provider is required").max(120),
  modelId: z.string().trim().min(1, "modelId is required").max(240),
  modelName: z.string().trim().max(240).optional(),
  source: z.string().trim().max(80).optional(),
  apiFormat: z.enum(["chat-completions", "responses"]).default("chat-completions"),
  supportedEndpoints: z.array(z.enum(["chat", "embeddings", "images", "audio"])).default(["chat"]),
  normalizeToolCallId: z.boolean().optional(),
  preserveOpenAIDeveloperRole: z.boolean().nullable().optional(),
  upstreamHeaders: upstreamHeadersRecordSchema.nullable().optional(),
  compatByProtocol: z
    .partialRecord(z.enum(["openai", "openai-responses", "claude"]), modelCompatPerProtocolSchema)
    .optional(),
});

const pricingFieldsSchema = z
  .object({
    input: z.number().min(0).optional(),
    output: z.number().min(0).optional(),
    cached: z.number().min(0).optional(),
    reasoning: z.number().min(0).optional(),
    cache_creation: z.number().min(0).optional(),
  })
  .strict();

export const updatePricingSchema = z.record(
  z.string().trim().min(1),
  z.record(z.string().trim().min(1), pricingFieldsSchema)
);

export const toggleRateLimitSchema = z.object({
  connectionId: z.string().trim().min(1, "connectionId is required"),
  enabled: z.boolean(),
});

const resilienceProfileSchema = z.object({
  transientCooldown: z.number().min(0),
  rateLimitCooldown: z.number().min(0),
  maxBackoffLevel: z.number().int().min(0),
  circuitBreakerThreshold: z.number().int().min(0),
  circuitBreakerReset: z.number().min(0),
});

const resilienceDefaultsSchema = z
  .object({
    requestsPerMinute: z.number().int().min(1).optional(),
    minTimeBetweenRequests: z.number().int().min(1).optional(),
    concurrentRequests: z.number().int().min(1).optional(),
  })
  .strict();

export const updateResilienceSchema = z
  .object({
    profiles: z
      .object({
        oauth: resilienceProfileSchema.optional(),
        apikey: resilienceProfileSchema.optional(),
      })
      .strict()
      .optional(),
    defaults: resilienceDefaultsSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.profiles && !value.defaults) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must provide profiles or defaults",
        path: [],
      });
    }
  });

export const resetStatsActionSchema = z.object({
  action: z.literal("reset-stats"),
});

const pricingSyncSourceSchema = z.enum(["litellm"]);

export const pricingSyncRequestSchema = z
  .object({
    sources: z.array(pricingSyncSourceSchema).min(1).optional(),
    dryRun: z.boolean().optional(),
  })
  .strict();

const taskRoutingModelMapSchema = z
  .object({
    coding: z.string().max(200).optional(),
    creative: z.string().max(200).optional(),
    analysis: z.string().max(200).optional(),
    vision: z.string().max(200).optional(),
    summarization: z.string().max(200).optional(),
    background: z.string().max(200).optional(),
    chat: z.string().max(200).optional(),
  })
  .strict();

export const updateTaskRoutingSchema = z
  .object({
    enabled: z.boolean().optional(),
    taskModelMap: taskRoutingModelMapSchema.optional(),
    detectionEnabled: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.enabled === undefined &&
      value.taskModelMap === undefined &&
      value.detectionEnabled === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No valid fields to update",
        path: [],
      });
    }
  });

export const taskRoutingActionSchema = z.discriminatedUnion("action", [
  resetStatsActionSchema,
  z
    .object({
      action: z.literal("detect"),
      body: jsonObjectSchema.optional(),
    })
    .strict(),
]);

export const updateModelAliasesSchema = z.object({
  aliases: z.record(z.string().trim().min(1), z.string().trim().min(1)),
});

export const addModelAliasSchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
});

export const removeModelAliasSchema = z.object({
  from: z.string().trim().min(1),
});

export const proxyConfigSchema = z
  .object({
    type: z
      .preprocess(
        (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
        z.enum(["http", "https", "socks5"])
      )
      .optional(),
    host: z.string().trim().min(1).optional(),
    port: z.coerce.number().int().min(1).max(65535).optional(),
    username: z.string().optional(),
    password: z.string().optional(),
  })
  .strict();

export const updateProxyConfigSchema = z
  .object({
    proxy: proxyConfigSchema.nullable().optional(),
    global: proxyConfigSchema.nullable().optional(),
    providers: z.record(z.string().trim().min(1), proxyConfigSchema.nullable()).optional(),
    combos: z.record(z.string().trim().min(1), proxyConfigSchema.nullable()).optional(),
    keys: z.record(z.string().trim().min(1), proxyConfigSchema.nullable()).optional(),
    level: z.enum(["global", "provider", "combo", "key"]).optional(),
    id: z.string().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasPayload =
      value.proxy !== undefined ||
      value.global !== undefined ||
      value.providers !== undefined ||
      value.combos !== undefined ||
      value.keys !== undefined ||
      value.level !== undefined;

    if (!hasPayload) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No valid fields to update",
        path: [],
      });
    }

    if (value.level !== undefined && value.proxy === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "proxy is required when level is provided",
        path: ["proxy"],
      });
    }

    if (value.level && value.level !== "global" && !value.id?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "id is required for provider/combo/key level updates",
        path: ["id"],
      });
    }
  });

export const testProxySchema = z.object({
  proxy: z.object({
    type: z.string().optional(),
    host: z.string().trim().min(1, "proxy.host is required"),
    port: z.union([z.string(), z.number()]),
    username: z.string().optional(),
    password: z.string().optional(),
  }),
});

export const createProxyRegistrySchema = z
  .object({
    name: z.string().trim().min(1, "name is required").max(120),
    type: z
      .preprocess(
        (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
        z.enum(["http", "https", "socks5"])
      )
      .optional()
      .default("http"),
    host: z.string().trim().min(1, "host is required").max(255),
    port: z.coerce.number().int().min(1).max(65535),
    username: z.string().optional(),
    password: z.string().optional(),
    region: z.string().trim().max(64).nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    status: z.enum(["active", "inactive"]).optional().default("active"),
  })
  .strict();

export const updateProxyRegistrySchema = createProxyRegistrySchema.partial().extend({
  id: z.string().trim().min(1, "id is required"),
});

export const proxyAssignmentSchema = z
  .object({
    scope: z.enum(["global", "provider", "account", "combo", "key"]),
    scopeId: z.string().trim().nullable().optional(),
    proxyId: z.string().trim().nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.scope !== "global" && !value.scopeId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scopeId is required for provider/account/combo/key scope",
        path: ["scopeId"],
      });
    }
  });

export const bulkProxyAssignmentSchema = z
  .object({
    scope: z.enum(["global", "provider", "account", "combo", "key"]),
    scopeIds: z.array(z.string().trim().min(1)).optional().default([]),
    proxyId: z.string().trim().nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.scope !== "global" &&
      (!Array.isArray(value.scopeIds) || value.scopeIds.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scopeIds is required for provider/account/combo/key scope",
        path: ["scopeIds"],
      });
    }
  });

const ipFilterModeSchema = z.enum(["blacklist", "whitelist"]);
const tempBanSchema = z.object({
  ip: z.string().trim().min(1),
  durationMs: z.coerce.number().int().min(1).optional(),
  reason: z.string().max(200).optional(),
});

export const updateIpFilterSchema = z
  .object({
    enabled: z.boolean().optional(),
    mode: ipFilterModeSchema.optional(),
    blacklist: z.array(z.string()).optional(),
    whitelist: z.array(z.string()).optional(),
    addBlacklist: z.string().optional(),
    removeBlacklist: z.string().optional(),
    addWhitelist: z.string().optional(),
    removeWhitelist: z.string().optional(),
    tempBan: tempBanSchema.optional(),
    removeBan: z.string().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No valid fields to update",
        path: [],
      });
    }
  });

export const updateCodexServiceTierSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

export const setBudgetSchema = z.object({
  apiKeyId: z.string().trim().min(1, "apiKeyId is required"),
  dailyLimitUsd: z.coerce.number().positive("dailyLimitUsd must be greater than zero"),
  monthlyLimitUsd: z.coerce
    .number()
    .positive("monthlyLimitUsd must be greater than zero")
    .optional(),
  warningThreshold: z.coerce.number().min(0).max(1).optional(),
});

export const policyActionSchema = z
  .object({
    action: z.enum(["unlock"]),
    identifier: z.string().trim().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "unlock" && !value.identifier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "identifier is required for unlock action",
        path: ["identifier"],
      });
    }
  });

export const providersBatchTestSchema = z
  .object({
    mode: z.enum(["provider", "oauth", "free", "apikey", "compatible", "all"]),
    providerId: z.string().trim().min(1).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const pid = value.providerId ?? null;
    if (value.mode === "provider" && !pid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "providerId is required when mode=provider",
        path: ["providerId"],
      });
    }
  });

export const validateProviderApiKeySchema = z.object({
  provider: z.string().trim().min(1, "Provider and API key required"),
  apiKey: z.string().trim().min(1, "Provider and API key required"),
  validationModelId: z.string().trim().optional(),
  customUserAgent: z.string().trim().max(500).optional(),
  baseUrl: z.string().trim().url().optional(),
});

export const createProviderNodeSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    prefix: z.string().trim().min(1, "Prefix is required"),
    apiType: z.enum(["chat", "responses"]).optional(),
    baseUrl: z.string().trim().min(1).optional(),
    type: z.enum(["openai-compatible", "anthropic-compatible"]).optional(),
    compatMode: z.enum(["cc"]).optional(),
    chatPath: z.string().trim().startsWith("/").max(500).optional().or(z.literal("")),
    modelsPath: z.string().trim().startsWith("/").max(500).optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    const nodeType = value.type || "openai-compatible";
    if (nodeType === "openai-compatible" && !value.apiType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid OpenAI compatible API type",
        path: ["apiType"],
      });
    }
  });

export const updateProviderNodeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  prefix: z.string().trim().min(1, "Prefix is required"),
  apiType: z.enum(["chat", "responses"]).optional(),
  baseUrl: z.string().trim().min(1, "Base URL is required"),
  chatPath: z.string().trim().startsWith("/").max(500).optional().or(z.literal("")),
  modelsPath: z.string().trim().startsWith("/").max(500).optional().or(z.literal("")),
});

export const providerNodeValidateSchema = z.object({
  baseUrl: z.string().trim().min(1, "Base URL and API key required"),
  apiKey: z.string().trim().min(1, "Base URL and API key required"),
  type: z.enum(["openai-compatible", "anthropic-compatible"]).optional(),
  compatMode: z.enum(["cc"]).optional(),
  chatPath: z.string().trim().startsWith("/").max(500).optional().or(z.literal("")),
  modelsPath: z.string().trim().startsWith("/").max(500).optional().or(z.literal("")),
});

export const updateProviderConnectionSchema = z
  .object({
    name: z.string().max(200).optional(),
    priority: z.coerce.number().int().min(1).max(100).optional(),
    globalPriority: z.union([z.coerce.number().int().min(1).max(100), z.null()]).optional(),
    defaultModel: z.union([z.string().max(200), z.null()]).optional(),
    isActive: z.boolean().optional(),
    apiKey: z.string().max(10000).optional(),
    testStatus: z.string().max(50).optional(),
    lastError: z.union([z.string(), z.null()]).optional(),
    lastErrorAt: z.union([z.string(), z.null()]).optional(),
    lastErrorType: z.union([z.string(), z.null()]).optional(),
    lastErrorSource: z.union([z.string(), z.null()]).optional(),
    errorCode: z.union([z.string(), z.null()]).optional(),
    rateLimitedUntil: z.union([z.string(), z.null()]).optional(),
    lastTested: z.union([z.string(), z.null()]).optional(),
    healthCheckInterval: z.coerce.number().int().min(0).optional(),
    group: z.union([z.string().max(100), z.null()]).optional(),
    providerSpecificData: z
      .record(z.string(), z.unknown())
      .optional()
      .superRefine((data, ctx) => {
        if (!data) return;
        const baseUrl = data.baseUrl;
        if (baseUrl !== undefined && (typeof baseUrl !== "string" || !isHttpUrl(baseUrl))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "providerSpecificData.baseUrl must be a valid http(s) URL",
            path: ["baseUrl"],
          });
        }
        const customUserAgent = data.customUserAgent;
        if (
          customUserAgent !== undefined &&
          customUserAgent !== null &&
          (typeof customUserAgent !== "string" || customUserAgent.length > 500)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "providerSpecificData.customUserAgent must be a string up to 500 chars",
            path: ["customUserAgent"],
          });
        }
      }),
  })
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No valid fields to update",
        path: [],
      });
    }
  });
