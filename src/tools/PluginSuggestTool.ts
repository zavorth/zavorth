import path from 'node:path';

import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { PluginOsSuggestService } from '../services/PluginOsSuggestService.js';
import { CapabilityMissService } from '../services/CapabilityMissService.js';
import { config as runtimeConfig } from '../config/index.js';

/**
 * Daily agent tool: suggest a plugin for the user's need with Enable vs Recommend-only.
 * Never auto-enables. Prefer structured missingTool for capability-miss loop.
 */
export class PluginSuggestTool extends BaseTool {
  public readonly name = 'plugin_suggest';

  public readonly description =
    'When the user needs a capability that may come from a Plugin OS package or skill, ' +
    'suggest install/enable paths with Enable vs Recommend-only actions. ' +
    'Prefer missingTool when a named tool failed. Never enables plugins automatically.';

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
      missingTool: {
        type: 'string',
        description: 'Exact tool name that is missing or failed (preferred structured signal).',
      },
      missingCapability: {
        type: 'string',
        description: 'Capability id when known (structured).',
      },
      limit: {
        type: 'number',
        description: 'Max suggestions (default 5).',
      },
    },
    required: [],
  };

  private readonly suggest: PluginOsSuggestService;
  private readonly capabilityMiss: CapabilityMissService;
  private readonly projectRoot: string;

  constructor(
    options: {
      suggest?: PluginOsSuggestService;
      capabilityMiss?: CapabilityMissService;
      projectRoot?: string;
    } = {},
  ) {
    super();
    this.projectRoot = path.resolve(
      options.projectRoot ||
        (runtimeConfig as { projectRoot?: string } | undefined)?.projectRoot ||
        process.env.ZAVORTH_PROJECT_ROOT ||
        process.cwd(),
    );
    this.suggest =
      options.suggest ||
      new PluginOsSuggestService({
        projectRoot: this.projectRoot,
      });
    this.capabilityMiss =
      options.capabilityMiss ||
      new CapabilityMissService({
        projectRoot: this.projectRoot,
      });
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const missingTool = String(args.missingTool || args.tool || '').trim();
    const missingCapability = String(args.missingCapability || args.capability || '').trim();
    const intent = String(args.intent || args.query || args.text || '').trim();
    const limit = Number(args.limit) || 5;

    // Structured capability-miss path (preferred when tool/capability known).
    if (missingTool || missingCapability) {
      try {
        const miss = this.capabilityMiss.resolve({
          missingTool: missingTool || null,
          missingCapability: missingCapability || null,
          intentHint: intent || null,
          limit,
          root: this.projectRoot,
        });
        return JSON.stringify(
          {
            ok: miss.ok,
            mode: 'capability_miss',
            autoEnable: false,
            autoInstall: false,
            intent: intent || null,
            missingTool: miss.input.missingTool,
            missingCapability: miss.input.missingCapability,
            message: miss.message,
            primary: miss.primary,
            installSuggestions: miss.suggestions,
            text: miss.formatText(),
            note: 'Never auto-enables or auto-installs. Preview first; consent required to install/enable.',
          },
          null,
          2,
        );
      } catch (error) {
        return JSON.stringify(
          {
            ok: false,
            mode: 'capability_miss',
            autoEnable: false,
            autoInstall: false,
            missingTool: missingTool || null,
            message: error instanceof Error ? error.message : String(error),
          },
          null,
          2,
        );
      }
    }

    if (!intent) {
      return JSON.stringify(
        {
          ok: false,
          autoEnable: false,
          autoInstall: false,
          message: 'Provide missingTool (preferred) or intent (what the user wants to do).',
          setup: [
            'Example: plugin_suggest missingTool="web_search"',
            'Example: plugin_suggest intent="search the web for release notes"',
            'Example: plugin_suggest intent="draft an email"',
          ],
        },
        null,
        2,
      );
    }

    try {
      const result = await this.suggest.suggest({
        intent,
        root: this.projectRoot,
        limit,
        useLlm: args.useLlm === true,
      });

      // Soft-enrich free-text path with capability-miss search (still never auto-enables).
      let installSuggestions: ReturnType<CapabilityMissService['resolve']>['suggestions'] = [];
      try {
        const miss = this.capabilityMiss.resolve({
          intentHint: intent,
          limit,
          root: this.projectRoot,
        });
        installSuggestions = miss.suggestions;
      } catch {
        /* soft */
      }

      return JSON.stringify(
        {
          ok: result.ok,
          mode: 'intent_suggest',
          autoEnable: false,
          autoInstall: false,
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
          installSuggestions,
          ui: result.ui,
          text: result.formatText(),
          note: 'Never auto-enables. Present Enable vs Recommend-only to the user. Free-text does not enable plugins.',
        },
        null,
        2,
      );
    } catch (error) {
      return JSON.stringify(
        {
          ok: false,
          mode: 'intent_suggest',
          autoEnable: false,
          autoInstall: false,
          intent,
          message: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      );
    }
  }
}
