import { z } from 'zod';

export const userModelSourceWeightsSchema = z.object({
  explicit: z.number().min(0).max(1).default(1.0),
  userCorrection: z.number().min(0).max(1).default(0.85),
  behavioralPattern: z.number().min(0).max(1).default(0.8),
  llmInference: z.number().min(0).max(1).default(0.6),
  migration: z.number().min(0).max(1).default(0.5),
});

export type UserModelSourceWeights = z.infer<typeof userModelSourceWeightsSchema>;

export const userModelConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxInjectionTokens: z.number().int().positive().default(300),
  decayHalfLifeDays: z.number().positive().default(30),
  activationConfidenceThreshold: z.number().min(0).max(1).default(0.7),
  proceduralPromotionThreshold: z.number().min(0).max(1).default(0.85),
  sourceAuthorityWeights: userModelSourceWeightsSchema.default({
    explicit: 1.0,
    userCorrection: 0.85,
    behavioralPattern: 0.8,
    llmInference: 0.6,
    migration: 0.5,
  }),
});

export type UserModelConfig = z.infer<typeof userModelConfigSchema>;

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const lower = value.trim().toLowerCase();
  if (lower === 'true' || lower === '1') return true;
  if (lower === 'false' || lower === '0') return false;
  return undefined;
}

export function resolveUserModelConfig(overrides?: Partial<UserModelConfig>): UserModelConfig {
  const envConfig: Partial<UserModelConfig> = {
    enabled: parseOptionalBoolean(process.env.ZAVORTH_USER_MODEL_ENABLED),
    maxInjectionTokens: parseOptionalNumber(process.env.ZAVORTH_USER_MODEL_TOKEN_BUDGET),
    decayHalfLifeDays: parseOptionalNumber(process.env.ZAVORTH_USER_MODEL_DECAY_DAYS),
    activationConfidenceThreshold: parseOptionalNumber(process.env.ZAVORTH_USER_MODEL_ACTIVATION_THRESHOLD),
    proceduralPromotionThreshold: parseOptionalNumber(process.env.ZAVORTH_USER_MODEL_PROCEDURAL_THRESHOLD),
    sourceAuthorityWeights: {
      explicit: parseOptionalNumber(process.env.ZAVORTH_USER_MODEL_WEIGHT_EXPLICIT) ?? 1.0,
      userCorrection: parseOptionalNumber(process.env.ZAVORTH_USER_MODEL_WEIGHT_CORRECTION) ?? 0.85,
      behavioralPattern: 0.8,
      llmInference: parseOptionalNumber(process.env.ZAVORTH_USER_MODEL_WEIGHT_LLM) ?? 0.6,
      migration: 0.5,
    },
  };

  const merged = {
    enabled: overrides?.enabled ?? envConfig.enabled ?? true,
    maxInjectionTokens: overrides?.maxInjectionTokens ?? envConfig.maxInjectionTokens ?? 300,
    decayHalfLifeDays: overrides?.decayHalfLifeDays ?? envConfig.decayHalfLifeDays ?? 30,
    activationConfidenceThreshold:
      overrides?.activationConfidenceThreshold ?? envConfig.activationConfidenceThreshold ?? 0.7,
    proceduralPromotionThreshold:
      overrides?.proceduralPromotionThreshold ?? envConfig.proceduralPromotionThreshold ?? 0.85,
    sourceAuthorityWeights: {
      explicit: overrides?.sourceAuthorityWeights?.explicit ?? envConfig.sourceAuthorityWeights?.explicit ?? 1.0,
      userCorrection:
        overrides?.sourceAuthorityWeights?.userCorrection ?? envConfig.sourceAuthorityWeights?.userCorrection ?? 0.85,
      behavioralPattern:
        overrides?.sourceAuthorityWeights?.behavioralPattern ?? envConfig.sourceAuthorityWeights?.behavioralPattern ?? 0.8,
      llmInference:
        overrides?.sourceAuthorityWeights?.llmInference ?? envConfig.sourceAuthorityWeights?.llmInference ?? 0.6,
      migration: overrides?.sourceAuthorityWeights?.migration ?? envConfig.sourceAuthorityWeights?.migration ?? 0.5,
    },
  };

  return userModelConfigSchema.parse(merged);
}
