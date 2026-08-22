import { z } from 'zod';

/**
 * Echo tool categories.
 * OS = operating system control
 * IOT = IoT devices and home automation
 * WEB = HTTP requests, browser actions, and search
 * INTERNAL = internal Zavorth tools such as memory and session utilities
 */
export type ToolCategory = 'OS' | 'IOT' | 'WEB' | 'INTERNAL';

/**
 * Tool danger level.
 * safe = no destructive effects
 * moderate = may affect external state
 * dangerous = may damage the system or user data
 */
export type ToolDangerLevel = 'safe' | 'moderate' | 'dangerous';

/**
 * Standardized tool execution result.
 */
export interface ToolExecutionResult {
  success: boolean;
  message?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  error?: string;
}

/**
 * Base contract for all Zavorth Echo tools.
 * Each tool declares its Zod schema, category, danger level,
 * and whether it requires user approval before execution.
 */
export interface IZavorthTool {
  name: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodType<any, any, any>;
  category: ToolCategory;
  dangerLevel: ToolDangerLevel;
  requiresPermission: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute(params: Record<string, any>, context?: Record<string, any>): Promise<ToolExecutionResult>;
}
