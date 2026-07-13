import path from 'node:path';

import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { PluginOsSuggestService } from '../services/PluginOsSuggestService.js';
import { config as runtimeConfig } from '../config/index.js';

/**
 * Daily agent tool: suggest a plugin for the user's need with Enable vs Recommend-only.
 * Never auto-enables.
 */
export class PluginSuggestTool extends BaseTool {
  public readonly name = 'plugin_suggest';

  public readonly description =
    'When the user needs a capability that may come from a Plugin OS package, '
    + 'suggest the best plugin with Enable vs Recommend-only actions. '
    + 'Never enables plugins automatically. Prefer this over inventing missing features.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        description: 'What the user wants to accomplish (natural language).',
      },
      query: {
        type: 'string',
        description: 'Alias for intent.',
      },
      limit: {
        type: 'number',
        description: 'Max suggestions (default 5).',
      },
    },
    required: [],
  };

  private readonly suggest: PluginOsSuggestService;
  private readonly projectRoot: string;

  constructor(options: {
    suggest?: PluginOsSuggestService;
    projectRoot?: string;
  } = {}) {
    super();
    this.projectRoot = path.resolve(
      options.projectRoot
      || (runtimeConfig as { projectRoot?: string } | undefined)?.projectRoot
      || process.env.ZAVORTH_PROJECT_ROOT
      || process.cwd(),
    );
    this.suggest = options.suggest || new PluginOsSuggestService({
      projectRoot: this.projectRoot,
    });
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const intent = String(args.intent || args.query || args.text || '').trim();
    if (!intent) {
      return JSON.stringify({
        ok: false,
        autoEnable: false,
        message: 'Provide intent (what the user wants to do).',
        setup: [
          'Example: plugin_suggest intent="search the web for release notes"',
          'Example: plugin_suggest intent="draft an email"',
        ],
      }, null, 2);
    }

    try {
      const result = await this.suggest.suggest({
        intent,
        root: this.projectRoot,
        limit: Number(args.limit) || 5,
        useLlm: args.useLlm === true,
      });

      return JSON.stringify({
        ok: result.ok,
        autoEnable: false,
        intent: result.intent,
        message: result.message,
        primary: result.primary
          ? {
            pluginId: result.primary.pluginId,
            summary: result.primary.summary,
            canEnable: result.primary.canEnable,
            enableHint: result.primary.enableHint,
            needsCredentials: result.primary.needsCredentials,
            risks: result.primary.risks,
          }
          : null,
        suggestions: result.suggestions.map((item) => ({
          pluginId: item.pluginId,
          score: item.score,
          enabled: item.enabled,
          canEnable: item.canEnable,
          summary: item.summary,
          enableHint: item.enableHint,
          recommendOnlyHint: item.recommendOnlyHint,
          needsCredentials: item.needsCredentials,
          risks: item.risks,
        })),
        ui: result.ui,
        text: result.formatText(),
        note: 'Never auto-enables. Present Enable vs Recommend-only to the user.',
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        ok: false,
        autoEnable: false,
        intent,
        message: error instanceof Error ? error.message : String(error),
      }, null, 2);
    }
  }
}
