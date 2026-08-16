/**
 * Zavorth Core Configuration Schemas.
 * Strict Zod definitions for runtime, agent, logging, security, and LLM options.
 */

import { z } from 'zod';

export const LogLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info');
export type LogLevel = z.infer<typeof LogLevelSchema>;

export const SystemConfigSchema = z.object({
  environment: z.enum(['development', 'production', 'test']).default('development'),
  locale: z.string().default('en'),
  timezone: z.string().default('UTC'),
  dataDirectory: z.string().optional(),
  workspaceRoot: z.string().default(process.cwd()),
});
export type SystemConfig = z.infer<typeof SystemConfigSchema>;

export const LoggingConfigSchema = z.object({
  level: LogLevelSchema,
  format: z.enum(['pretty', 'json', 'compact']).default('pretty'),
  destination: z.enum(['stdout', 'stderr', 'file']).default('stdout'),
  filePath: z.string().optional(),
  telemetryEnabled: z.boolean().default(true),
});
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;

export const AgentConfigSchema = z.object({
  defaultProvider: z.string().default('openai'),
  defaultModel: z.string().default('gpt-4o'),
  maxTurns: z.number().int().positive().default(50),
  timeoutMs: z.number().int().positive().default(120_000),
  reasoningEffort: z.enum(['none', 'low', 'medium', 'high', 'xhigh']).default('medium'),
  allowLocalExecution: z.boolean().default(true),
  autoApproveReadOnly: z.boolean().default(true),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const SecurityConfigSchema = z.object({
  sanitizeEgress: z.boolean().default(true),
  redactSecrets: z.boolean().default(true),
  enforceApprovalGate: z.boolean().default(true),
  allowedCommandPatterns: z.array(z.string()).default([]),
  blockedCommandPatterns: z.array(z.string()).default([
    'rm -rf /',
    'rmdir /s /q c:\\',
    'format c:',
    ':(){ :|:& };:'
  ]),
});
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;

export const ZavorthRootConfigSchema = z.object({
  system: SystemConfigSchema.default({
    environment: 'development',
    locale: 'en',
    timezone: 'UTC',
    workspaceRoot: process.cwd(),
  }),
  logging: LoggingConfigSchema.default({
    level: 'info',
    format: 'pretty',
    destination: 'stdout',
    telemetryEnabled: true,
  }),
  agent: AgentConfigSchema.default({
    defaultProvider: 'openai',
    defaultModel: 'gpt-4o',
    maxTurns: 50,
    timeoutMs: 120_000,
    reasoningEffort: 'medium',
    allowLocalExecution: true,
    autoApproveReadOnly: true,
  }),
  security: SecurityConfigSchema.default({
    sanitizeEgress: true,
    redactSecrets: true,
    enforceApprovalGate: true,
    allowedCommandPatterns: [],
    blockedCommandPatterns: [
      'rm -rf /',
      'rmdir /s /q c:\\',
      'format c:',
      ':(){ :|:& };:'
    ],
  }),
  llm: z.record(z.string(), z.unknown()).default({}),
});
export type ZavorthRootConfig = z.infer<typeof ZavorthRootConfigSchema>;
