import { Content, SchemaType, type FunctionDeclaration } from '@google/generative-ai';
import type { ChatMessage, ToolDefinition } from '../ILlmProvider.js';

type GeminiSchemaNode = {
  type: SchemaType;
  description?: string;
  enum?: unknown[];
  items?: GeminiSchemaNode;
  properties?: Record<string, GeminiSchemaNode>;
  required?: string[];
};

export function convertGeminiTool(tool: ToolDefinition): FunctionDeclaration {
  const properties: Record<string, GeminiSchemaNode> = {};
  for (const [key, param] of Object.entries(tool.parameters.properties)) {
    properties[key] = convertSchema(param as unknown as Record<string, unknown>);
  }
  return {
    name: tool.name,
    description: tool.description,
    // The Gemini SDK models schemas as a closed discriminated union; our generic JSON-schema
    // projection is structurally valid but not narrowable to a single union member.
    parameters: {
      type: SchemaType.OBJECT,
      properties,
      required: tool.parameters.required || [],
    } as unknown as FunctionDeclaration['parameters'],
  };
}

function convertSchema(schema: Record<string, unknown>): GeminiSchemaNode {
  const type = String(schema.type || 'string');
  const converted: GeminiSchemaNode = { type: mapSchemaType(type) };

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

export function convertGeminiMessages(messages: ChatMessage[]): Content[] {
  const contents: Content[] = [];
  const toolCallNames = new Map<string, string>();

  for (const message of messages) {
    if (message.role === 'tool') {
      const toolName = message.toolName
        || (message.toolCallId ? toolCallNames.get(message.toolCallId) : '')
        || 'unknown_tool';
      contents.push({
        role: 'function',
        parts: [
          {
            functionResponse: {
              name: toolName,
              response: { result: message.content },
            },
          },
        ],
      });
      if (message.inlineData && message.inlineData.length > 0) {
        const visionParts: Content['parts'] = [
          { text: '[Image captured by the tool for visual analysis]' },
        ];
        for (const media of message.inlineData) {
          visionParts.push({
            inlineData: {
              mimeType: media.mimeType,
              data: media.data,
            },
          });
        }
        contents.push({ role: 'user', parts: visionParts });
      }
      continue;
    }

    const role = message.role === 'assistant' ? 'model' : 'user';
    const parts: Content['parts'] = [];

    if (message.content) {
      parts.push({ text: message.content });
    }

    if (message.inlineData && message.inlineData.length > 0) {
      for (const media of message.inlineData) {
        parts.push({
          inlineData: {
            mimeType: media.mimeType,
            data: media.data,
          },
        });
      }
    }

    if (message.toolCalls && message.toolCalls.length > 0) {
      for (const toolCall of message.toolCalls) {
        toolCallNames.set(toolCall.id, toolCall.name);
        parts.push({
          functionCall: {
            name: toolCall.name,
            args: toolCall.arguments,
          },
        });
      }
    }

    contents.push({ role, parts });
  }

  return contents;
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
