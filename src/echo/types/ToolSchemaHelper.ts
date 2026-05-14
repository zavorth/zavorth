import { z } from 'zod';
import type { ToolDefinition, ToolParameter } from '../../providers/ILlmProvider';
import type { IZavorthTool } from './IZavorthTool';

/**
 * ToolSchemaHelper — Converte schemas Zod de IZavorthTool em ToolDefinition (JSON Schema)
 * compatíveis com a API de Function Calling do OpenAI/Ollama.
 *
 * Isso elimina o hardcode por nome de ferramenta no ZavorthEchoOrchestrator
 * e permite que qualquer nova tool seja automaticamente serializada.
 */
export class ToolSchemaHelper {
  /**
   * Converte um IZavorthTool completo em ToolDefinition (formato OpenAI).
   */
  public static toToolDefinition(tool: IZavorthTool): ToolDefinition {
    const properties: Record<string, ToolParameter> = {};
    const required: string[] = [];

    try {
      const shape = this.extractShape(tool.schema);
      for (const [key, fieldSchema] of Object.entries(shape)) {
        const param = this.zodFieldToParameter(fieldSchema as z.ZodTypeAny);
        properties[key] = param;

        // Verifica se o campo é obrigatório (não é optional nem tem default)
        if (!this.isOptionalField(fieldSchema as z.ZodTypeAny)) {
          required.push(key);
        }
      }
    } catch {
      // Se o schema não for ZodObject, retorna vazio (fallback seguro)
    }

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
   * Converte um array de tools para ToolDefinition[].
   */
  public static toToolDefinitions(tools: IZavorthTool[]): ToolDefinition[] {
    return tools.map((tool) => this.toToolDefinition(tool));
  }

  /**
   * Extrai o shape de um ZodObject (ou unwrap de ZodEffects/ZodDefault/etc).
   */
  private static extractShape(schema: z.ZodTypeAny): Record<string, z.ZodTypeAny> {
    let current = schema;

    // Unwrap ZodEffects, ZodOptional, ZodDefault até chegar no ZodObject
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
   * Converte um campo Zod individual para ToolParameter (JSON Schema simplificado).
   */
  private static zodFieldToParameter(field: z.ZodTypeAny): ToolParameter {
    const description = field.description || '';
    const unwrapped = this.unwrapField(field);

    // ZodEnum
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

    // ZodArray
    if (unwrapped instanceof z.ZodArray) {
      return {
        type: 'array',
        description,
      };
    }

    // ZodNumber
    if (unwrapped instanceof z.ZodNumber) {
      return {
        type: 'number',
        description,
      };
    }

    // ZodBoolean
    if (unwrapped instanceof z.ZodBoolean) {
      return {
        type: 'boolean',
        description,
      };
    }

    // ZodRecord / ZodObject aninhado
    if (unwrapped instanceof z.ZodRecord || unwrapped instanceof z.ZodObject) {
      return {
        type: 'object',
        description,
      };
    }

    // Fallback: string
    return {
      type: 'string',
      description,
    };
  }

  /**
   * Remove wrappers como ZodOptional, ZodDefault, ZodNullable para chegar ao tipo base.
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
   * Verifica se um campo é opcional (ZodOptional ou ZodDefault).
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
