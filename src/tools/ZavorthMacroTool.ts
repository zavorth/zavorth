/**
 * Zavorth Macro Tool.
 * Enables LLM agents and operators to record, run, list, and delete multi-step workflow macros via natural language.
 */

import { BaseTool } from './BaseTool.js';
import { WorkflowMacroService } from '../services/workflow/WorkflowMacroService.js';
import { logger } from '../logger.js';

export class ZavorthMacroTool extends BaseTool {
  readonly name = 'zavorth_macro';
  readonly description = 'Records, replays, lists, and manages multi-step workflow macros for automation.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        description: "Action to perform: 'record', 'stop', 'run', 'list', 'delete'.",
      },
      name: {
        type: 'string',
        description: 'Name of the macro (for record, run, delete).',
      },
      description: {
        type: 'string',
        description: 'Optional human-readable description for the macro.',
      },
      steps: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional array of command/action steps when creating a macro directly.',
      },
    },
    required: ['action'] as string[],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '').toLowerCase();
    const name = String(args.name || '').trim();

    try {
      switch (action) {
        case 'record': {
          if (!name) return JSON.stringify({ error: 'Macro name is required to start recording.' });
          const desc = typeof args.description === 'string' ? args.description : undefined;
          const macro = WorkflowMacroService.startRecording(name, desc);
          return JSON.stringify({ success: true, message: `Started recording macro "${name}".`, macro });
        }

        case 'stop': {
          const macro = WorkflowMacroService.stopRecording();
          if (!macro) {
            return JSON.stringify({ error: 'No active macro recording found.' });
          }
          return JSON.stringify({ success: true, message: `Stopped and saved macro "${macro.name}".`, macro });
        }

        case 'run': {
          if (!name) return JSON.stringify({ error: 'Macro name is required to run.' });
          const results = await WorkflowMacroService.runMacro(name);
          return JSON.stringify({ success: true, macro: name, results });
        }

        case 'list': {
          const macros = WorkflowMacroService.listMacros();
          return JSON.stringify({ success: true, total: macros.length, macros });
        }

        case 'delete': {
          if (!name) return JSON.stringify({ error: 'Macro name is required to delete.' });
          const deleted = WorkflowMacroService.deleteMacro(name);
          return JSON.stringify({ success: deleted, message: deleted ? `Macro "${name}" deleted.` : `Macro "${name}" not found.` });
        }

        default:
          return JSON.stringify({ error: `Invalid action "${action}". Valid: record, stop, run, list, delete.` });
      }
    } catch (err: unknown) {
      logger.warn('[ZavorthMacroTool] execution failed', err);
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  }
}
