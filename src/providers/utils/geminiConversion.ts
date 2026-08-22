import { SchemaType, type FunctionDeclaration } from '@google/generative-ai';
import type { ToolDefinition } from '../ILlmProvider.js';

export function convertGeminiTool(tool: ToolDefinition): FunctionDeclaration {
  const properties: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const [key, param] of Object.entries(tool.parameters.properties)) {
    properties[key] = convertSchema(param as unknown as Record<string, unknown>);
  }
  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: SchemaType.OBJECT,
      properties,
      required: tool.parameters.required || [],
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertSchema(schema: Record<string, unknown>): any {
  const type = String(schema.type || 'string');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const converted: any = { type: mapSchemaType(type) };

  if (typeof schema.description === 'string' && schema.description.trim()) {
    converted.description = schema.description;
  }
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    converted.enum = schema.enum;
  }
  if (type.toLowerCase() === 'array') {
    const itemSchema = schema.items && typeof schema.items === 'object'
      ? convertSchema(schema.items as Record<string, unknown>)
      : { type: SchemaType.STRING };
    converted.items = itemSchema;
  }
  if (type.toLowerCase() === 'object') {
    const nestedProperties = schema.properties && typeof schema.properties === 'object'
      ? Object.fromEntries(
          Object.entries(schema.properties as Record<string, unknown>).map(([key, value]) => [
            key,
            convertSchema(value as Record<string, unknown>),
          ]),
        )
      : {};
    converted.properties = nestedProperties;
    if (Array.isArray(schema.required) && schema.required.length > 0) {
      converted.required = schema.required;
    }
  }

  return converted;
}

function mapSchemaType(type: string): SchemaType {
  switch (type.toLowerCase()) {
    case 'string': return SchemaType.STRING;
    case 'number': return SchemaType.NUMBER;
    case 'integer': return SchemaType.INTEGER;
    case 'boolean': return SchemaType.BOOLEAN;
    case 'array': return SchemaType.ARRAY;
    default: return SchemaType.STRING;
  }
}
