import { z } from 'zod';
import type { IZavorthTool, ToolCategory, ToolDangerLevel, ToolExecutionResult } from '../../types/IZavorthTool.js';
import type { ZavorthActionDefinition, ZavorthActionResult, ZavorthActionSchema } from '../../../runtime/actions/ZavorthActionContracts.js';
import type { ZavorthActionGateway } from '../../../runtime/actions/ZavorthActionGateway.js';
import { asErrorLike } from '../../../utils/errorLike.js';

/**
 * ActionHarnessToolAdapter
 *
 * Wraps a ZavorthActionDefinition from the Action Harness as an IZavorthTool,
 * allowing the LLM tool-calling loop (EchoExecutionLoop) to discover and invoke
 * Action Harness actions natively via function calling.
 *
 * The LLM sees these as regular tools "on the table" — it decides when to use them
 * based on the user's intent, not via keyword matching or heuristic rules.
 */
export class ActionHarnessToolAdapter implements IZavorthTool {
  public readonly name: string;
  public readonly description: string;
  public readonly schema: z.ZodType<any, any, any>;
  public readonly category: ToolCategory;
  public readonly dangerLevel: ToolDangerLevel;
  public readonly requiresPermission: boolean;

  private readonly actionId: string;
  private readonly gateway: ZavorthActionGateway;
  private readonly actionRequiresApproval: boolean;

  constructor(definition: ZavorthActionDefinition, gateway: ZavorthActionGateway) {
    this.actionId = definition.id;
    this.name = toProviderSafeToolName(definition.id);
    this.description = definition.description;
    this.schema = buildZodSchemaFromActionSchema(definition.inputSchema);
    this.category = mapActionToToolCategory(definition);
    this.dangerLevel = mapRiskToDangerLevel(definition.risk);
    this.requiresPermission = definition.requiresApproval;
    this.actionRequiresApproval = definition.requiresApproval;
    this.gateway = gateway;
  }

  public async execute(
    params: Record<string, any>,
    context?: Record<string, any>,
  ): Promise<ToolExecutionResult> {
    try {
      const result: ZavorthActionResult = await this.gateway.apply(this.actionId, params, {
        trustedOperatorConfirmation: !this.actionRequiresApproval,
        sourceSurface: 'llm',
        actorId: context?.traceId || context?.sessionId || null,
      });

      if (result.ok) {
        return {
          success: true,
          message: result.summary,
          data: scrubLlmToolData(result.data),
        };
      }

      if (result.status === 'blocked') {
        return {
          success: false,
          error: result.summary,
          data: scrubLlmToolData(result.data),
        };
      }

      if (result.status === 'approval_required') {
        return {
          success: false,
          error: `Action "${this.actionId}" requires user approval before execution. ${result.summary}`,
          data: scrubLlmToolData(result.data),
        };
      }

      return {
        success: false,
        error: result.summary || `Action "${this.actionId}" returned a non-ok result.`,
        data: scrubLlmToolData(result.data),
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : String(error);
      return {
        success: false,
        error: `Action "${this.actionId}" threw an error: ${message}`,
      };
    }
  }
}

export function toProviderSafeToolName(actionId: string): string {
  return actionId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function scrubLlmToolData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => scrubLlmToolData(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const scrubbed: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (key.toLowerCase() === 'raw') {
      continue;
    }
    scrubbed[key] = scrubLlmToolData(item);
  }
  return scrubbed;
}

/**
 * Maps an ActionHarness inputSchema (JSON-Schema-like) into a Zod schema
 * that ToolSchemaHelper can serialize for the LLM.
 */
function buildZodSchemaFromActionSchema(schema: ZavorthActionSchema): z.ZodType<any, any, any> {
  const shape: Record<string, z.ZodTypeAny> = {};
  const requiredFields = new Set(schema.required || []);

  for (const [key, rawDef] of Object.entries(schema.properties)) {
    const def = rawDef as Record<string, unknown>;
    let field = jsonSchemaFieldToZod(def);

    if (!requiredFields.has(key)) {
      field = field.optional();
    }

    shape[key] = field;
  }

  return z.object(shape);
}

function jsonSchemaFieldToZod(def: Record<string, unknown>): z.ZodTypeAny {
  const type = def.type as string | undefined;
  const description = (def.description as string) || '';
  const enumValues = def.enum as string[] | undefined;

  if (enumValues && Array.isArray(enumValues) && enumValues.length > 0) {
    return z.enum(enumValues as [string, ...string[]]).describe(description);
  }

  switch (type) {
    case 'number':
      return z.number().describe(description);
    case 'boolean':
      return z.boolean().describe(description);
    case 'array':
      return z.array(z.unknown()).describe(description);
    case 'object':
      return z.record(z.string(), z.unknown()).describe(description);
    case 'string':
    default:
      return z.string().describe(description);
  }
}

function mapRiskToDangerLevel(risk: ZavorthActionDefinition['risk']): ToolDangerLevel {
  switch (risk) {
    case 'safe':
      return 'safe';
    case 'attention':
      return 'moderate';
    case 'danger':
    case 'unknown':
      return 'dangerous';
    default:
      return 'moderate';
  }
}

function mapActionToToolCategory(definition: ZavorthActionDefinition): ToolCategory {
  const domains = definition.domains.map((domain) => domain.toLowerCase());
  const id = definition.id.toLowerCase();
  if (domains.includes('web') || domains.includes('browser') || id.startsWith('web_') || id.startsWith('web.') || id.startsWith('browser.')) {
    return 'WEB';
  }
  return 'INTERNAL';
}
