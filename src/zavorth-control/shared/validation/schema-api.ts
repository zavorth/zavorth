import { z } from "zod";
import { jsonObjectSchema } from "./schema-provider";

const modelIdSchema = z.string().trim().min(1, "Model is required").max(200);
const nonEmptyStringSchema = z.string().trim().min(1, "Field is required");
const embeddingTokenArraySchema = z
  .array(z.number().int().min(0))
  .min(1, "input token array must contain at least one item");
const embeddingInputSchema = z.union([
  nonEmptyStringSchema,
  z.array(nonEmptyStringSchema).min(1, "input must contain at least one item"),
  embeddingTokenArraySchema,
  z.array(embeddingTokenArraySchema).min(1, "input must contain at least one item"),
]);
const chatMessageSchema = z
  .object({
    role: z.string().trim().min(1, "messages[].role is required"),
    content: z.union([nonEmptyStringSchema, z.array(z.unknown()).min(1), z.null()]).optional(),
  })
  .catchall(z.unknown());
const countTokensMessageSchema = z
  .object({
    content: z.union([
      nonEmptyStringSchema,
      z
        .array(
          z
            .object({
              type: z.string().optional(),
              text: z.string().optional(),
            })
            .catchall(z.unknown())
        )
        .min(1, "messages[].content must contain at least one item"),
    ]),
  })
  .catchall(z.unknown());

export const v1EmbeddingsSchema = z
  .object({
    model: modelIdSchema,
    input: embeddingInputSchema,
    dimensions: z.coerce.number().int().positive().optional(),
    encoding_format: z.enum(["float", "base64"]).optional(),
  })
  .catchall(z.unknown());

export const v1ImageGenerationSchema = z
  .object({
    model: modelIdSchema,
    prompt: nonEmptyStringSchema,
  })
  .catchall(z.unknown());

export const v1AudioSpeechSchema = z
  .object({
    model: modelIdSchema,
    input: nonEmptyStringSchema,
  })
  .catchall(z.unknown());

export const v1ModerationSchema = z
  .object({
    model: modelIdSchema.optional(),
    input: z.unknown().refine((value) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string") return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    }, "Input is required"),
  })
  .catchall(z.unknown());

export const v1RerankSchema = z
  .object({
    model: modelIdSchema,
    query: nonEmptyStringSchema,
    documents: z.array(z.unknown()).min(1, "documents must contain at least one item"),
  })
  .catchall(z.unknown());

export const providerChatCompletionSchema = z
  .object({
    model: modelIdSchema,
    messages: z.array(chatMessageSchema).min(1).optional(),
    input: z.union([nonEmptyStringSchema, z.array(z.unknown()).min(1)]).optional(),
    prompt: nonEmptyStringSchema.optional(),
  })
  .catchall(z.unknown())
  .superRefine((value, ctx) => {
    if (value.messages === undefined && value.input === undefined && value.prompt === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "messages, input or prompt is required",
        path: [],
      });
    }
  });

export const v1CountTokensSchema = z
  .object({
    messages: z.array(countTokensMessageSchema).min(1, "messages must contain at least one item"),
  })
  .catchall(z.unknown());

export const setBudgetSchema = z.object({
  apiKeyId: z.string().trim().min(1, "apiKeyId is required"),
  dailyLimitUsd: z.coerce.number().positive("dailyLimitUsd must be greater than zero"),
  monthlyLimitUsd: z.coerce
    .number()
    .positive("monthlyLimitUsd must be greater than zero")
    .optional(),
  warningThreshold: z.coerce.number().min(0).max(1).optional(),
});

export const updateTaskRoutingSchema = z
  .object({
    enabled: z.boolean().optional(),
    taskModelMap: z
      .object({
        coding: z.string().max(200).optional(),
        creative: z.string().max(200).optional(),
        analysis: z.string().max(200).optional(),
        vision: z.string().max(200).optional(),
        summarization: z.string().max(200).optional(),
        background: z.string().max(200).optional(),
        chat: z.string().max(200).optional(),
      })
      .strict()
      .optional(),
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

export const resetStatsActionSchema = z.object({
  action: z.literal("reset-stats"),
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

export const translatorDetectSchema = z.object({
  body: z.record(z.string(), z.unknown()).refine(
    (value) => Object.keys(value).length > 0,
    "Body must be a non-empty object"
  ),
});

const translatorLogFileSchema = z.enum([
  "1_req_client.json",
  "3_req_openai.json",
  "4_req_target.json",
  "5_res_provider.txt",
]);

export const translatorSaveSchema = z.object({
  file: translatorLogFileSchema,
  content: z.string().min(1, "Content is required").max(1_000_000, "Content is too large"),
});

export const translatorSendSchema = z.object({
  provider: z.string().trim().min(1, "Provider is required"),
  body: z.record(z.string(), z.unknown()).refine(
    (value) => Object.keys(value).length > 0,
    "Body must be a non-empty object"
  ),
});

export const translatorTranslateSchema = z
  .object({
    step: z.union([z.number().int().min(1).max(4), z.literal("direct")]),
    provider: z.string().trim().min(1).optional(),
    body: z.record(z.string(), z.unknown()).refine(
      (value) => Object.keys(value).length > 0,
      "Body must be a non-empty object"
    ),
    sourceFormat: z.string().optional(),
    targetFormat: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.step !== "direct" && !value.provider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Step and provider are required",
        path: ["provider"],
      });
    }
  });

export const oauthExchangeSchema = z.object({
  code: z.string().trim().min(1),
  redirectUri: z.string().trim().min(1),
  codeVerifier: z.string().trim().min(1).optional(),
  state: z.string().nullable().optional(),
});

export const oauthPollSchema = z.object({
  deviceCode: z.string().trim().min(1),
  codeVerifier: z.string().optional(),
  extraData: z.unknown().optional(),
});

export const cursorImportSchema = z.object({
  accessToken: z.string().trim().min(1, "Access token is required"),
  machineId: z.string().trim().min(1, "Machine ID is required"),
});

export const kiroImportSchema = z.object({
  refreshToken: z.string().trim().min(1, "Refresh token is required"),
});

export const kiroSocialExchangeSchema = z.object({
  code: z.string().trim().min(1, "Code is required"),
  codeVerifier: z.string().trim().min(1, "Code verifier is required"),
  provider: z.enum(["google", "github"]),
});

export const cloudCredentialUpdateSchema = z.object({
  provider: z.string().trim().min(1, "Provider is required"),
  credentials: z
    .object({
      accessToken: z.string().optional(),
      refreshToken: z.string().optional(),
      expiresIn: z.coerce.number().positive().optional(),
    })
    .strict()
    .superRefine((value, ctx) => {
      if (
        value.accessToken === undefined &&
        value.refreshToken === undefined &&
        value.expiresIn === undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one credential field must be provided",
          path: [],
        });
      }
    }),
});

export const cloudResolveAliasSchema = z.object({
  alias: z.string().trim().min(1, "Missing alias"),
});

export const cloudModelAliasUpdateSchema = z.object({
  model: z.string().trim().min(1, "Model and alias required"),
  alias: z.string().trim().min(1, "Model and alias required"),
});

export const cloudSyncActionSchema = z.object({
  action: z.enum(["enable", "sync", "disable"]),
});

export const cliMitmStartSchema = z.object({
  apiKey: z.string().trim().min(1, "Missing apiKey"),
  sudoPassword: z.string().optional(),
});

export const cliMitmStopSchema = z.object({
  sudoPassword: z.string().optional(),
});

export const cliMitmAliasUpdateSchema = z.object({
  tool: z.string().trim().min(1, "tool and mappings required"),
  mappings: z.record(z.string(), z.string().optional()),
});

export const cliBackupMutationSchema = z
  .object({
    tool: z.string().trim().min(1).optional(),
    toolId: z.string().trim().min(1).optional(),
    backupId: z.string().trim().min(1, "tool and backupId are required"),
  })
  .superRefine((value, ctx) => {
    if (!value.tool && !value.toolId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "tool and backupId are required",
        path: ["tool"],
      });
    }
  });

const envKeySchema = z
  .string()
  .trim()
  .min(1, "Environment key is required")
  .max(120)
  .regex(/^[A-Z_][A-Z0-9_]*$/, "Invalid environment key format");
const envValueSchema = z
  .union([z.string(), z.number(), z.boolean()])
  .transform((value) => String(value))
  .refine((value) => value.length > 0, "Environment value is required")
  .refine((value) => value.length <= 10_000, "Environment value is too long");

export const cliSettingsEnvSchema = z.object({
  env: z
    .record(envKeySchema, envValueSchema)
    .refine((value) => Object.keys(value).length > 0, "env must contain at least one key"),
});

export const cliModelConfigSchema = z.object({
  baseUrl: z.string().trim().min(1, "baseUrl and model are required"),
  apiKey: z.string().optional(),
  model: z.string().trim().min(1, "baseUrl and model are required"),
});

export const codexProfileNameSchema = z.object({
  name: z.string().trim().min(1, "Profile name is required"),
});

export const codexProfileIdSchema = z.object({
  profileId: z.string().trim().min(1, "profileId is required"),
});

export const guideSettingsSaveSchema = z.object({
  baseUrl: z.string().trim().min(1).optional(),
  apiKey: z.string().optional(),
  model: z.string().trim().min(1, "Model is required"),
});

const searchResultSchemaInternal = z.object({
  title: z.string(),
  url: z.string(),
  display_url: z.string().optional(),
  snippet: z.string(),
  position: z.number().int().positive(),
  score: z.number().min(0).max(1).nullable().optional(),
  published_at: z.string().nullable().optional(),
  favicon_url: z.string().nullable().optional(),
  content: z
    .object({
      format: z.enum(["text", "markdown"]).optional(),
      text: z.string().optional(),
      length: z.number().int().optional(),
    })
    .nullable()
    .optional(),
  metadata: z
    .object({
      author: z.string().nullable().optional(),
      language: z.string().nullable().optional(),
      source_type: z
        .enum(["article", "blog", "forum", "video", "academic", "news", "other"])
        .nullable()
        .optional(),
      image_url: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  citation: z.object({
    provider: z.string(),
    retrieved_at: z.string(),
    rank: z.number().int().positive(),
  }),
  provider_raw: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const v1SearchSchema = z
  .object({
    query: z
      .string()
      .trim()
      .min(1, "Query is required")
      .max(500, "Query must be 500 characters or fewer"),
    provider: z
      .enum(["serper-search", "brave-search", "perplexity-search", "exa-search", "tavily-search"])
      .optional(),
    max_results: z.coerce.number().int().min(1).max(100).default(5),
    search_type: z.enum(["web", "news"]).default("web"),
    offset: z.coerce.number().int().min(0).default(0),
    country: z.string().max(2).toUpperCase().optional(),
    language: z.string().min(2).max(5).optional(),
    time_range: z.enum(["any", "day", "week", "month", "year"]).optional(),
    content: z
      .object({
        snippet: z.boolean().default(true),
        full_page: z.boolean().default(false),
        format: z.enum(["text", "markdown"]).default("text"),
        max_characters: z.coerce.number().int().min(100).max(100000).optional(),
      })
      .optional(),
    filters: z
      .object({
        include_domains: z.array(z.string().max(253)).max(20).optional(),
        exclude_domains: z.array(z.string().max(253)).max(20).optional(),
        safe_search: z.enum(["off", "moderate", "strict"]).optional(),
      })
      .optional(),
    synthesis: z
      .object({
        strategy: z.enum(["none", "auto", "provider", "internal"]).default("none"),
        model: z.string().optional(),
        max_tokens: z.coerce.number().int().min(1).max(4000).optional(),
      })
      .optional(),
    provider_options: z.record(z.string(), z.unknown()).optional(),
    strict_filters: z.boolean().default(false),
  })
  .catchall(z.unknown());

export const searchResultSchema = searchResultSchemaInternal;

export const v1SearchResponseSchema = z.object({
  id: z.string(),
  provider: z.string(),
  query: z.string(),
  results: z.array(searchResultSchemaInternal),
  cached: z.boolean(),
  answer: z
    .object({
      source: z.enum(["none", "provider", "internal"]).optional(),
      text: z.string().nullable().optional(),
      model: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  usage: z.object({
    queries_used: z.number().int().min(0),
    search_cost_usd: z.number().min(0),
    llm_tokens: z.number().int().min(0).optional(),
  }),
  metrics: z.object({
    response_time_ms: z.number().int().min(0),
    upstream_latency_ms: z.number().int().min(0).optional(),
    gateway_latency_ms: z.number().int().min(0).optional(),
    total_results_available: z.number().int().nullable(),
  }),
  errors: z
    .array(
      z.object({
        provider: z.string(),
        code: z.string(),
        message: z.string(),
      })
    )
    .optional(),
});

export const updateAutoDisableAccountsSchema = z
  .object({
    enabled: z.boolean(),
    threshold: z.number().int().min(1).max(10).optional(),
  })
  .strict();

export const versionManagerToolSchema = z.object({
  tool: z.string().trim().min(1),
});

export const versionManagerInstallSchema = versionManagerToolSchema.extend({
  version: z.string().trim().optional(),
});

const geminiPartSchema = z
  .object({
    text: z.string().optional(),
  })
  .catchall(z.unknown());

const geminiContentSchema = z
  .object({
    role: z.string().optional(),
    parts: z.array(geminiPartSchema).optional(),
  })
  .catchall(z.unknown());

export const v1betaGeminiGenerateSchema = z
  .object({
    contents: z.array(geminiContentSchema).optional(),
    systemInstruction: z
      .object({
        parts: z.array(geminiPartSchema).optional(),
      })
      .catchall(z.unknown())
      .optional(),
    generationConfig: z
      .object({
        stream: z.boolean().optional(),
        maxOutputTokens: z.coerce.number().int().min(1).optional(),
        temperature: z.coerce.number().optional(),
        topP: z.coerce.number().optional(),
      })
      .catchall(z.unknown())
      .optional(),
  })
  .catchall(z.unknown())
  .superRefine((value, ctx) => {
    if (!value.contents && !value.systemInstruction) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "contents or systemInstruction is required",
        path: [],
      });
    }
  });

export const dbBackupRestoreSchema = z.object({
  backupId: z.string().trim().min(1, "backupId is required"),
});

export const evalRunSuiteSchema = z.object({
  suiteId: z.string().trim().min(1, "suiteId is required"),
  outputs: z.record(z.string(), z.string()),
});

const accessScheduleSchema = z.object({
  enabled: z.boolean(),
  from: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  until: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  days: z.array(z.number().int().min(0).max(6)).min(1, "At least one day is required").max(7),
  tz: z.string().min(1).max(100),
});

export const updateKeyPermissionsSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    allowedModels: z.array(z.string().trim().min(1)).max(1000).optional(),
    allowedConnections: z.array(z.string().uuid()).max(100).optional(),
    noLog: z.boolean().optional(),
    autoResolve: z.boolean().optional(),
    isActive: z.boolean().optional(),
    maxSessions: z.number().int().min(0).max(10000).optional(),
    accessSchedule: z.union([accessScheduleSchema, z.null()]).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.name === undefined &&
      value.allowedModels === undefined &&
      value.allowedConnections === undefined &&
      value.noLog === undefined &&
      value.autoResolve === undefined &&
      value.isActive === undefined &&
      value.maxSessions === undefined &&
      value.accessSchedule === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No valid fields to update",
        path: [],
      });
    }
  });
