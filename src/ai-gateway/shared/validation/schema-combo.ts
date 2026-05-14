import { z } from "zod";

const comboModelEntry = z.union([
  z.string(),
  z.object({
    model: z.string().min(1),
    weight: z.number().min(0).max(100).default(0),
  }),
]);

const comboStrategySchema = z.enum([
  "priority",
  "weighted",
  "round-robin",
  "context-relay",
  "random",
  "least-used",
  "cost-optimized",
  "strict-random",
  "auto",
  "fill-first",
  "p2c",
  "auto",
  "lkgp",
  "context-optimized",
]);

const scoringWeightsSchema = z
  .object({
    quota: z.number().min(0).max(1),
    health: z.number().min(0).max(1),
    costInv: z.number().min(0).max(1),
    latencyInv: z.number().min(0).max(1),
    taskFit: z.number().min(0).max(1),
    stability: z.number().min(0).max(1),
    tierPriority: z.number().min(0).max(1).optional().default(0.05),
  })
  .optional();

const comboRuntimeConfigSchema = z
  .object({
    strategy: comboStrategySchema.optional(),
    maxRetries: z.coerce.number().int().min(0).max(10).optional(),
    retryDelayMs: z.coerce.number().int().min(0).max(60000).optional(),
    timeoutMs: z.coerce.number().int().min(1000).max(600000).optional(),
    concurrencyPerModel: z.coerce.number().int().min(1).max(20).optional(),
    queueTimeoutMs: z.coerce.number().int().min(1000).max(120000).optional(),
    healthCheckEnabled: z.boolean().optional(),
    healthCheckTimeoutMs: z.coerce.number().int().min(100).max(30000).optional(),
    handoffThreshold: z.coerce.number().min(0.5).max(0.94).optional(),
    handoffModel: z.string().trim().max(200).optional(),
    handoffProviders: z.array(z.string().trim().min(1).max(100)).max(10).optional(),
    maxMessagesForSummary: z.coerce.number().int().min(5).max(100).optional(),
    maxComboDepth: z.coerce.number().int().min(1).max(10).optional(),
    trackMetrics: z.boolean().optional(),
    candidatePool: z.array(z.string().min(1)).optional(),
    weights: scoringWeightsSchema.optional(),
    modePack: z.string().max(100).optional(),
    budgetCap: z.number().positive().optional(),
    explorationRate: z.number().min(0).max(1).optional(),
    routerStrategy: z.string().optional(),
  })
  .strict();

export const createComboSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100)
    .regex(/^[a-zA-Z0-9_/.-]+$/, "Name can only contain letters, numbers, -, _, / and ."),
  models: z.array(comboModelEntry).optional().default([]),
  strategy: comboStrategySchema.optional().default("priority"),
  config: comboRuntimeConfigSchema.optional(),
  allowedProviders: z.array(z.string().max(200)).optional(),
  system_message: z.string().max(50000).optional(),
  tool_filter_regex: z.string().max(1000).optional(),
  context_cache_protection: z.boolean().optional(),
  context_length: z.number().int().min(1000).max(2000000).optional(),
});

export const createAutoComboSchema = z.object({
  id: z.string().trim().min(1, "id is required").max(100),
  name: z.string().trim().min(1, "name is required").max(200),
  candidatePool: z.array(z.string().min(1)).optional().default([]),
  weights: scoringWeightsSchema,
  modePack: z.string().max(100).optional(),
  budgetCap: z.number().positive().optional(),
  explorationRate: z.number().min(0).max(1).optional().default(0.05),
});

export const updateComboDefaultsSchema = z
  .object({
    comboDefaults: comboRuntimeConfigSchema.optional(),
    providerOverrides: z.record(z.string().trim().min(1), comboRuntimeConfigSchema).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.comboDefaults && !value.providerOverrides) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Nothing to update",
        path: [],
      });
    }
  });

export const updateComboSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name is required")
      .max(100)
      .regex(/^[a-zA-Z0-9_/.-]+$/, "Name can only contain letters, numbers, -, _, / and .")
      .optional(),
    models: z.array(comboModelEntry).optional(),
    strategy: comboStrategySchema.optional(),
    config: comboRuntimeConfigSchema.optional(),
    isActive: z.boolean().optional(),
    allowedProviders: z.array(z.string().max(200)).optional(),
    system_message: z.string().max(50000).optional(),
    tool_filter_regex: z.string().max(1000).optional(),
    context_cache_protection: z.boolean().optional(),
    context_length: z.number().int().min(1000).max(2000000).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.name === undefined &&
      value.models === undefined &&
      value.strategy === undefined &&
      value.config === undefined &&
      value.isActive === undefined &&
      value.allowedProviders === undefined &&
      value.system_message === undefined &&
      value.tool_filter_regex === undefined &&
      value.context_cache_protection === undefined &&
      value.context_length === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No valid fields to update",
        path: [],
      });
    }
  });

export const reorderCombosSchema = z
  .object({
    comboIds: z.array(z.string().trim().min(1).max(200)).min(1).max(1000),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.comboIds).size !== value.comboIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "comboIds must be unique",
        path: ["comboIds"],
      });
    }
  });

export const testComboSchema = z.object({
  comboName: z.string().trim().min(1, "comboName is required"),
});
