import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import {
  type ZavorthActionOperation,
  ZavorthActionGateway,
} from '../runtime/actions/index.js';

const OPERATIONS: ZavorthActionOperation[] = [
  'action.schema.lookup',
  'action.status',
  'action.preview',
  'action.apply',
  'action.receipts',
];

function parseArgsJson(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  const text = String(value || '').trim();
  if (!text) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    throw new Error('argsJson must be valid JSON object text.');
  }
}

function normalizeOperation(value: unknown): ZavorthActionOperation {
  const operation = String(value || '').trim() as ZavorthActionOperation;
  if (OPERATIONS.includes(operation)) {
    return operation;
  }
  throw new Error(`Unknown Zavorth action operation: ${String(value || '<missing>')}`);
}

export class ZavorthActionTool extends BaseTool {
  public readonly name = 'zavorth_action';
  public readonly description = [
    'Lookup, preview, apply, status and receipts for first-class Zavorth operational actions.',
    'Use action.schema.lookup first for natural requests. Use action.preview before mutation.',
    'Use action.apply only when the operator provided approval; otherwise the gateway returns approval_required.',
    'Do not invent slash commands or shell commands when a Zavorth action exists.',
  ].join(' ');

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: OPERATIONS,
        description: 'Action gateway operation to run.',
      },
      actionId: {
        type: 'string',
        description: 'Known action id, for example skills.governance.set. Optional for lookup.',
      },
      query: {
        type: 'string',
        description: 'Natural language user intent or legacy command text used for lookup/inference.',
      },
      domain: {
        type: 'string',
        description: 'Optional domain hint, for example skills, providers, home, memory, channels or sandbox.',
      },
      argsJson: {
        type: 'string',
        description: 'JSON object string with action arguments. Secrets are redacted in receipts.',
      },
      approvalId: {
        type: 'string',
        description: 'Approval id supplied by the operator when applying a mutation.',
      },
      root: {
        type: 'string',
        description: 'Optional Zavorth project root. Defaults to current runtime root.',
      },
    },
    required: ['operation'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const operation = normalizeOperation(args.operation);
    const gateway = new ZavorthActionGateway({
      root: String(args.root || process.cwd()),
    });
    const result = await gateway.run({
      operation,
      actionId: String(args.actionId || '').trim() || null,
      query: String(args.query || '').trim() || null,
      domain: String(args.domain || '').trim() || null,
      args: parseArgsJson(args.argsJson),
      approvalId: String(args.approvalId || '').trim() || null,
      actorId: 'llm',
      sourceSurface: 'llm-tool',
      trustedOperatorConfirmation: false,
    });
    return JSON.stringify(result, null, 2);
  }
}
