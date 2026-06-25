import { z } from "zod";

export const loginSchema = z.object({
  password: z.string().min(1, "Password is required").max(200),
});

export const updateRequireLoginSchema = z
  .object({
    requireLogin: z.boolean().optional(),
    password: z.string().min(4, "Password must be at least 4 characters").optional(),
  })
  .superRefine((value, ctx) => {
    if (value.requireLogin === undefined && !value.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No valid fields to update",
        path: [],
      });
    }
  });

export const updateSystemPromptSchema = z
  .object({
    prompt: z.string().max(50000).optional(),
    enabled: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.prompt === undefined && value.enabled === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No valid fields to update",
        path: [],
      });
    }
  });

export const updateThinkingBudgetSchema = z
  .object({
    mode: z.enum(["passthrough", "auto", "custom", "adaptive"]).optional(),
    customBudget: z.coerce.number().int().min(0).max(131072).optional(),
    effortLevel: z.enum(["none", "low", "medium", "high"]).optional(),
    baseBudget: z.coerce.number().int().min(0).max(131072).optional(),
    complexityMultiplier: z.coerce.number().min(0).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.mode === undefined &&
      value.customBudget === undefined &&
      value.effortLevel === undefined &&
      value.baseBudget === undefined &&
      value.complexityMultiplier === undefined
    ) {
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

export const updateIpFilterSchema = z
  .object({
    enabled: z.boolean().optional(),
    mode: z.enum(["blacklist", "whitelist"]).optional(),
    blacklist: z.array(z.string()).optional(),
    whitelist: z.array(z.string()).optional(),
    addBlacklist: z.string().optional(),
    removeBlacklist: z.string().optional(),
    addWhitelist: z.string().optional(),
    removeWhitelist: z.string().optional(),
    tempBan: z
      .object({
        ip: z.string().trim().min(1),
        durationMs: z.coerce.number().int().min(1).optional(),
        reason: z.string().max(200).optional(),
      })
      .optional(),
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
