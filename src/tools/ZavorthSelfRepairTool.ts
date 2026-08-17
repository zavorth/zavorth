/**
 * Zavorth Self-Repair Tool.
 * Exposes automated error trace parsing, self-healing diagnostic loops,
 * and repair receipts via ToolRegistry and Cognitive Firewall.
 * Strictly typed (Zero any) and EN-First.
 */

import { BaseTool } from './BaseTool.js';
import { ErrorTraceParser, SelfHealingPipeline } from '../autonomy/repair/index.js';

export interface ZavorthSelfRepairInput {
  action: 'diagnose' | 'repair_run' | 'history';
  rawOutput?: string;
  command?: string;
  cwd?: string;
  maxAttempts?: number;
}

export class ZavorthSelfRepairTool extends BaseTool {
  public static readonly name = 'zavorth_self_repair';
  public static readonly description =
    'Parses compilation/test error traces and executes autonomous self-healing repair loops to diagnose, patch, and re-verify broken builds or tests.';

  public static readonly schema = {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['diagnose', 'repair_run', 'history'],
        description: 'Action to perform for self-healing repair.',
      },
      rawOutput: {
        type: 'string',
        description: 'Raw error output, stack trace, or compiler log to parse (when action is diagnose).',
      },
      command: {
        type: 'string',
        description: 'Validation shell command to execute and self-heal (when action is repair_run).',
      },
      cwd: {
        type: 'string',
        description: 'Working directory for command execution.',
      },
      maxAttempts: {
        type: 'number',
        description: 'Maximum repair iterations (default: 3).',
      },
    },
    required: ['action'] as string[],
  };

  private static globalPipeline: SelfHealingPipeline | null = null;

  public static getPipeline(): SelfHealingPipeline {
    if (!this.globalPipeline) {
      this.globalPipeline = new SelfHealingPipeline();
    }
    return this.globalPipeline;
  }

  readonly name = ZavorthSelfRepairTool.name;
  readonly description = ZavorthSelfRepairTool.description;
  readonly parameters = ZavorthSelfRepairTool.schema;

  public async execute(args: Record<string, unknown>): Promise<string> {
    return ZavorthSelfRepairTool.execute(args as unknown as ZavorthSelfRepairInput);
  }

  public static async execute(input: ZavorthSelfRepairInput): Promise<string> {
    const pipeline = this.getPipeline();

    switch (input.action) {
      case 'diagnose': {
        if (!input.rawOutput) {
          return JSON.stringify({
            status: 'error',
            message: 'rawOutput is required to parse diagnostics.',
          });
        }

        const findings = ErrorTraceParser.parse(input.rawOutput);
        return JSON.stringify({
          status: 'success',
          action: 'diagnose',
          totalFindings: findings.length,
          findings,
        });
      }

      case 'repair_run': {
        if (!input.command) {
          return JSON.stringify({
            status: 'error',
            message: 'command is required to execute self-healing repair run.',
          });
        }

        const receipt = await pipeline.executeRepair({
          id: `target_${Date.now()}`,
          command: input.command,
          cwd: input.cwd,
          maxAttempts: input.maxAttempts || 3,
        });

        return JSON.stringify({
          status: receipt.status === 'resolved' ? 'success' : 'failed',
          action: 'repair_run',
          receipt,
        });
      }

      case 'history': {
        const receipts = pipeline.getReceipts();
        return JSON.stringify({
          status: 'success',
          action: 'history',
          total: receipts.length,
          receipts,
        });
      }

      default:
        return JSON.stringify({
          status: 'error',
          message: `Unknown action: ${String(input.action)}`,
        });
    }
  }
}
