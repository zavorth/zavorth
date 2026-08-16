/**
 * Zavorth LLM Adapter Configuration Schema.
 * Defines strictly-typed settings for agnostic model providers.
 */

import { z } from 'zod';

export const LLMProviderTypeSchema = z.enum([
  'openai',
  'anthropic',
  'ollama',
  'lmstudio',
  'xai',
  'gemini',
  'custom'
]);
export type LLMProviderType = z.infer<typeof LLMProviderTypeSchema>;

export const LLMAdapterConfigSchema = z.object({
  provider: LLMProviderTypeSchema,
  model: z.string(),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  organizationId: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  timeoutMs: z.number().int().positive().default(60_000),
  headers: z.record(z.string(), z.string()).optional(),
  extraOptions: z.record(z.string(), z.unknown()).optional(),
});
export type LLMAdapterConfig = z.infer<typeof LLMAdapterConfigSchema>;

export const LLMSectionConfigSchema = z.object({
  defaultAdapter: z.string().default('openai'),
  adapters: z.record(z.string(), LLMAdapterConfigSchema).default({}),
});
export type LLMSectionConfig = z.infer<typeof LLMSectionConfigSchema>;
