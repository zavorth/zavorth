/**
 * ZavorthToolAdapter.
 * Bridges an IZavorthTool from the Echo tool ecosystem into the BaseTool
 * ecosystem consumed by the bootstrap ToolRegistry and the main
 * conversational agent runtime.
 *
 * Strict Clean Code: English-first, zero `any`, no regex, typed errors.
 */

import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import type { IZavorthTool, ToolExecutionResult } from '../tool-runtime/types/IZavorthTool.js';
import { logger } from '../logger.js';

interface JsonSchemaLike {
  type?: unknown;
  properties?: Record<string, JsonPropertyLike>;
  required?: unknown;
}

interface JsonPropertyLike {
  type?: unknown;
  description?: unknown;
  enum?: unknown;
}

interface JsonSchemaCapable {
  toJSONSchema(): JsonSchemaLike;
}

export class ZavorthToolAdapter extends BaseTool {
  public readonly name: string;
  public readonly description: string;
  public readonly parameters: ToolDefinition['parameters'];
  private readonly inner: IZavorthTool;

  constructor(tool: IZavorthTool) {
    super();
    this.inner = tool;
    this.name = tool.name;
    this.description = tool.description;
    this.parameters = this.buildParameters(tool);
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const result = await this.inner.execute(args);
      return this.formatResult(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`[ZavorthToolAdapter] Tool '${this.name}' execution failed: ${message}`);
      return `Tool '${this.name}' failed: ${message}`;
    }
  }

  private buildParameters(tool: IZavorthTool): ToolDefinition['parameters'] {
    const schemaCapable = tool.schema as unknown as JsonSchemaCapable;
    try {
      const jsonSchema = schemaCapable.toJSONSchema();
      if (jsonSchema.type !== 'object' || !jsonSchema.properties) {
        return { type: 'object', properties: {} };
      }

      const properties: ToolDefinition['parameters']['properties'] = {};
      for (const [key, raw] of Object.entries(jsonSchema.properties)) {
        const property: ToolDefinition['parameters']['properties'][string] = {
          type: typeof raw.type === 'string' ? raw.type : 'string',
          description: typeof raw.description === 'string' ? raw.description : key,
        };
        if (Array.isArray(raw.enum)) {
          const values = raw.enum.filter((entry): entry is string => typeof entry === 'string');
          if (values.length > 0) {
            property.enum = values;
          }
        }
        properties[key] = property;
      }

      return {
        type: 'object',
        properties,
        ...(Array.isArray(jsonSchema.required)
          ? { required: jsonSchema.required.filter((entry): entry is string => typeof entry === 'string') }
          : {}),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`[ZavorthToolAdapter] Could not derive parameters for '${tool.name}': ${message}`);
      return { type: 'object', properties: {} };
    }
  }

  private formatResult(result: ToolExecutionResult): string {
    if (!result.success) {
      return `Tool '${this.name}' failed: ${String(result.error || result.message || 'unknown error').trim()}`;
    }
    const message = String(result.message || 'Tool executed successfully').trim();
    if (result.data === undefined || result.data === null) {
      return message;
    }
    return `${message}\n${JSON.stringify(result.data)}`;
  }
}