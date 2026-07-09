import { z } from 'zod';

export const resolveTaskMandateSchema = z.object({
  workspaceId: z.string().min(1),
  approved: z.boolean(),
});

export const revokeTaskMandateSchema = z.object({
  workspaceId: z.string().min(1),
});

export const resolveTempDirTrustSchema = z.object({
  workspaceId: z.string().min(1),
  trustId: z.string().min(1),
  approved: z.boolean(),
});

export const revokeTempDirTrustSchema = z.object({
  workspaceId: z.string().min(1),
  trustId: z.string().min(1),
});

export const resolvePtySessionSchema = z.object({
  workspaceId: z.string().min(1),
  sessionId: z.string().min(1),
  approve: z.boolean(),
});

export const resolvePtyInputSchema = z.object({
  workspaceId: z.string().min(1),
  operationId: z.string().min(1),
  sessionId: z.string().min(1),
  approve: z.boolean(),
  strongConfirmationInput: z.string().optional(),
});

export const terminatePtySessionSchema = z.object({
  workspaceId: z.string().min(1),
  sessionId: z.string().min(1),
});

export const providerConfigSchema = z.object({
  providerId: z.string().optional(),
  type: z.enum(['openai', 'anthropic', 'google', 'openrouter', 'ollama', 'openai-compatible']).optional(),
  displayName: z.string().min(1).optional(),
  baseUrl: z.string().optional(),
  defaultModel: z.string().optional(),
  enabled: z.boolean().optional(),
  requiresApiKey: z.boolean().optional(),
  apiKey: z.string().optional(),
});

export const testConnectionSchema = z.object({
  providerId: z.string().min(1),
});

export const resolveWriteApprovalSchema = z.object({
  operationId: z.string().min(1),
  decision: z.enum(['approve', 'deny']),
});

export const sessionGrantSchema = z.object({
  workspaceId: z.string().min(1),
  active: z.boolean().optional(),
  durationMinutes: z.union([z.number(), z.string()]).optional(),
  allowRiskUpTo: z.enum(['LOW', 'MEDIUM']).optional(),
  allowPackageInstall: z.boolean().optional(),
  allowNetwork: z.boolean().optional(),
});

export const resolveWorkspaceTrustSchema = z.object({
  workspaceId: z.string().min(1),
  rootPath: z.string().min(1),
  trusted: z.boolean(),
  allowRiskUpTo: z.enum(['LOW', 'MEDIUM']).optional(),
  allowPackageInstall: z.boolean().optional(),
  allowNetwork: z.boolean().optional(),
});

export const resolveCommandApprovalSchema = z.object({
  operationId: z.string().min(1),
  decision: z.enum(['approve', 'deny']),
});

export const agentConfigSchema = z.object({
  workspaceId: z.string().optional(),
  config: z.record(z.string(), z.any()).optional(),
});

export const agentConfigPreviewSchema = z.object({
  workspaceId: z.string().optional(),
  config: z.record(z.string(), z.any()).optional(),
});

export const enableHostPowerSchema = z.object({
  workspaceId: z.string().min(1),
  durationMinutes: z.number(),
});

export const disableHostPowerSchema = z.object({
  workspaceId: z.string().min(1),
});

export const resolveHostCommandSchema = z.object({
  operationId: z.string().min(1),
  decision: z.enum(['approve', 'deny']),
  strongConfirmationInput: z.string().optional(),
});

export const executeHostCommandSchema = z.object({
  operationId: z.string().min(1),
});

export const revokeHostCommandSchema = z.object({
  operationId: z.string().min(1),
});

/** Coerce legacy form/query string booleans ("true"/"false") for resolve routes. */
const coerceBoolean = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return value;
}, z.boolean());

export const resolvePermissionSchema = z.object({
  id: z.string().min(1),
  approved: coerceBoolean,
  sessionId: z.string().optional(),
  surface: z.string().optional(),
  requestedBy: z.string().optional(),
  channel: z.string().optional(),
  chatId: z.string().optional(),
  threadId: z.string().optional(),
  userId: z.string().optional(),
});
