import { z, type ZodType } from 'zod';
import type { ToolCategory } from '../echo/types/IZavorthTool.js';

const optionalText = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() || undefined : value),
  z.string().min(1).optional(),
);

const requiredPromptText = z.string().trim().min(1);

const toolCategorySchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
  z.enum(['OS', 'IOT', 'WEB', 'INTERNAL']).optional(),
);

const requestedToolsSchema = z.array(z.string().trim().min(1)).optional().default([]);
const metadataSchema = z.record(z.string(), z.unknown()).optional();

export const EchoExecuteRequestSchema = z.object({
  prompt: requiredPromptText,
  category: toolCategorySchema,
  sessionId: optionalText,
  requestedBy: optionalText,
  surface: optionalText,
}).passthrough();

export const NexusExecuteRequestSchema = EchoExecuteRequestSchema.extend({
  requestId: optionalText,
  traceId: optionalText,
  userId: optionalText,
  workspace: optionalText,
  requestedTools: requestedToolsSchema,
  metadata: metadataSchema,
}).passthrough();

export const EchoSpeechRequestSchema = z.object({
  input: requiredPromptText,
  surface: optionalText,
  requestedBy: optionalText,
  sessionId: optionalText,
  model: optionalText,
  voice: optionalText,
  voiceName: optionalText,
  languageCode: optionalText,
}).passthrough();

export const EchoPermissionResolveRequestSchema = z.object({
  id: requiredPromptText,
  approved: z.boolean(),
  sessionId: optionalText,
  surface: optionalText,
  requestedBy: optionalText,
  channel: optionalText,
  chatId: optionalText,
  threadId: optionalText,
  userId: optionalText,
}).passthrough();

export type EchoExecuteRequestDto = z.output<typeof EchoExecuteRequestSchema> & {
  category?: ToolCategory;
};

export type NexusExecuteRequestDto = z.output<typeof NexusExecuteRequestSchema> & {
  category?: ToolCategory;
};

export type EchoSpeechRequestDto = z.output<typeof EchoSpeechRequestSchema>;
export type EchoPermissionResolveRequestDto = z.output<typeof EchoPermissionResolveRequestSchema>;

export type DashboardRouteParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function parseDashboardRouteBody<T>(
  schema: ZodType<T>,
  body: unknown,
  fallbackError: string,
): DashboardRouteParseResult<T> {
  const result = schema.safeParse(body);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return {
    ok: false,
    error: resolveValidationMessage(result.error.issues[0]?.path?.[0], fallbackError),
  };
}

function resolveValidationMessage(field: unknown, fallbackError: string): string {
  if (field === 'prompt') {
    return 'Campo "prompt" e obrigatorio.';
  }
  if (field === 'input') {
    return 'Campo "input" e obrigatorio.';
  }
  if (field === 'id' || field === 'approved') {
    return 'Campos "id" (string) e "approved" (boolean) obrigatorios.';
  }
  return fallbackError;
}
