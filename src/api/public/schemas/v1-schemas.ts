import { z } from 'zod';

// schemas versionados base (v1)

export const ErrorDetailSchema = z.object({
  code: z.string(),
  message: z.string(),
  target: z.string().optional()
});

export const PublicErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(ErrorDetailSchema).optional(),
    traceId: z.string().optional()
  })
});

// REQUEST SCHEMAS (Entrada de dados)

export const CreateSessionRequestSchema = z.object({
  title: z.string().optional(),
  tenantId: z.string().optional(),
  tags: z.array(z.string()).optional()
});

export const SendMessageRequestSchema = z.object({
  content: z.string().min(1, "O conteúdo não pode estar vazio")
});

export const NodeAuthRequestSchema = z.object({
  pairingCode: z.string(),
  identity: z.object({
    arch: z.string(),
    osRelease: z.string(),
    deviceModel: z.string().optional()
  })
});

// EXPORT MAP
export const PublicSchemas_v1 = {
  requests: {
    CreateSession: CreateSessionRequestSchema,
    SendMessage: SendMessageRequestSchema,
    NodeAuth: NodeAuthRequestSchema
  },
  errors: PublicErrorSchema
};
