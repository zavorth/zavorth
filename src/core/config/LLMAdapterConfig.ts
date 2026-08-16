/**
 * Zavorth Dynamic Provider Configuration Schema.
 * Aligns with ZavorthUniversalDynamicAdapter and ProviderRegistry.
 */

import { z } from 'zod';

export const DynamicProviderProtocolSchema = z.enum([
  'openai_compatible',
  'gemini_native',
  'claude_native',
  'ollama_native',
  'custom'
]);
export type DynamicProviderProtocol = z.infer<typeof DynamicProviderProtocolSchema>;

export const DynamicProviderConfigSchema = z.object({
  providerId: z.string(),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  protocol: DynamicProviderProtocolSchema.default('openai_compatible'),
  modelOverride: z.string().optional(),
  timeoutMs: z.number().int().positive().default(60_000),
  headers: z.record(z.string(), z.string()).optional(),
  extraOptions: z.record(z.string(), z.unknown()).optional(),
});
export type DynamicProviderConfig = z.infer<typeof DynamicProviderConfigSchema>;
