import { z } from 'zod';
import type { ToolDefinition, ToolParameter } from '../../providers/ILlmProvider';
import type { IZavorthTool } from './IZavorthTool';
import { logger } from '../../logger.js';

/**
 * ToolSchemaHelper converts IZavorthTool Zod schemas into OpenAI/Ollama-compatible
 * function-calling ToolDefinition JSON Schema objects.
 *
 * This removes tool-name hardcoding from ZavorthEchoOrchestrator and lets new
 * tools be serialized automatically.
 */
export class ToolSchemaHelper {
  /**
   * Converts a full IZavorthTool into an OpenAI-style ToolDefinition.
   */
  public static toToolDefinition(tool: IZavorthTool): ToolDefinition {
    const properties: Record<string, ToolParameter> = {};
    const required: string[] = [];

    try {
      const shape = this.extractShape(tool.schema);
      for (const [key, fieldSchema] of Object.entries(shape)) {
        const param = this.zodFieldToParameter(fieldSchema as z.ZodTypeAny);
        properties[key] = param;

        if (!this.isOptionalField(fieldSchema as z.ZodTypeAny)) {
          required.push(key);
        }
      }
    } catch (error) { // If the schema is not a ZodObject, return an empty safe fallback. logger.warn('[Schema Helper] operation failed', error); }

    return {
      name: tool.name,
      description: tool.description,
      category: tool.category,
      dangerLevel: tool.dangerLevel,
      requiresPermission: tool.requiresPermission,
      parameters: {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      },
    };
  }

  /**
   * Converts an array of tools into ToolDefinition[].
   */
  public static toToolDefinitions(tools: IZavorthTool[]): ToolDefinition[] {
    return tools.map((tool) => this.toToolDefinition(tool));
  }

  /**
   * Extracts the shape from a ZodObject, unwrapping ZodEffects/ZodDefault/etc.
   */
  private static extractShape(schema: z.ZodTypeAny): Record<string, z.ZodTypeAny> {
    let current = schema;

    while (current) {
      if (current instanceof z.ZodObject) {
        return current.shape;
      }
      if ('_def' in current) {
        const def = (current as any)._def;
        if (def.innerType) {
          current = def.innerType;
          continue;
        }
        if (def.schema) {
          current = def.schema;
          continue;
        }
      }
      break;
    }

    return {};
  }

  /**
   * Converts one Zod field into a simplified JSON Schema ToolParameter.
   */
  private static zodFieldToParameter(field: z.ZodTypeAny): ToolParameter {
    const description = field.description || '';
    const unwrapped = this.unwrapField(field);

    if (unwrapped instanceof z.ZodEnum) {
      const def = (unwrapped as any)._def;
      const enumValues = def.entries
        ? Object.keys(def.entries)
        : (def.values as string[] | undefined) || [];
      return {
        type: 'string',
        description,
        enum: enumValues,
      };
    }

    if (unwrapped instanceof z.ZodArray) {
      return {
        type: 'array',
        description,
      };
    }

    if (unwrapped instanceof z.ZodNumber) {
      return {
        type: 'number',
        description,
      };
    }

    if (unwrapped instanceof z.ZodBoolean) {
      return {
        type: 'boolean',
        description,
      };
    }

    if (unwrapped instanceof z.ZodRecord || unwrapped instanceof z.ZodObject) {
      return {
        type: 'object',
        description,
      };
    }

    return {
      type: 'string',
      description,
    };
  }

  /**
   * Removes wrappers such as ZodOptional, ZodDefault, and ZodNullable.
   */
  private static unwrapField(field: z.ZodTypeAny): z.ZodTypeAny {
    let current = field;
    while (current) {
      if (current instanceof z.ZodOptional || current instanceof z.ZodNullable) {
        current = (current as any)._def.innerType;
        continue;
      }
      if (current instanceof z.ZodDefault) {
        current = (current as any)._def.innerType;
        continue;
      }
      break;
    }
    return current;
  }

  /**
   * Checks whether a field is optional.
   */
  private static isOptionalField(field: z.ZodTypeAny): boolean {
    if (field instanceof z.ZodOptional) return true;
    if (field instanceof z.ZodDefault) return true;
    if ('_def' in field && (field as any)._def.innerType) {
      return this.isOptionalField((field as any)._def.innerType);
    }
    return false;
  }
}
