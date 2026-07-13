import path from 'node:path';

import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { PluginRouterService } from '../services/PluginRouterService.js';
import { config as runtimeConfig } from '../config/index.js';

/**
 * Agent-facing Plugin OS router. Recommends plugins for a natural-language
 * intent. Never auto-enables plugins.
 */
export class PluginRecommendTool extends BaseTool {
  public readonly name = 'plugin_recommend';

  public readonly description =
    'Recommend Zavorth Plugin OS packages for a natural-language intent. '
    + 'Use when the user needs a capability that might come from a plugin '
    + '(search, memory, MCP, calendar, email, forge, etc). Never enables plugins.';

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
        description: 'Max recommendations (default 5, max 20).',
      },
      useLlm: {
        type: 'boolean',
        description: 'Optional LLM re-rank when available (default false).',
      },
      explainPluginId: {
        type: 'string',
        description: 'If set, explain this plugin id instead of recommending.',
      },
    },
    required: [],
  };

  private readonly router: PluginRouterService;
  private readonly projectRoot: string;

  constructor(options: {
    router?: PluginRouterService;
    projectRoot?: string;
  } = {}) {
    super();
    this.router = options.router || new PluginRouterService();
    this.projectRoot = path.resolve(
      options.projectRoot
      || (runtimeConfig as { projectRoot?: string } | undefined)?.projectRoot
      || process.env.ZAVORTH_PROJECT_ROOT
      || process.cwd(),
    );
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const explainId = String(args.explainPluginId || args.pluginId || '').trim();
    if (explainId) {
      const explained = this.router.explain({
        root: this.projectRoot,
        pluginId: explainId,
      });
      return JSON.stringify({
        ok: explained.ok,
        mode: 'explain',
        pluginId: explained.pluginId,
        found: explained.found,
        candidate: explained.candidate,
        reasons: explained.reasons,
        autoEnable: false,
        text: explained.formatText(),
      }, null, 2);
    }

    const intent = String(args.intent || args.query || args.text || '').trim();
    if (!intent) {
      return JSON.stringify({
        ok: false,
        reason: 'intent_required',
        message: 'Provide intent (or query) describing the capability needed.',
        autoEnable: false,
        setup: [
          'Example: plugin_recommend intent="search the web for release notes"',
          'Example: plugin_recommend explainPluginId="web-search"',
          'Enable: zavorth plugins enable <id> --yes',
        ],
      }, null, 2);
    }

    const limit = Math.max(1, Math.min(20, Number(args.limit) || 5));
    const useLlm = args.useLlm === true || args.llm === true;

    try {
      const result = await this.router.recommend({
        root: this.projectRoot,
        intent,
        limit,
        useLlm,
      });

      return JSON.stringify({
        ok: result.ok,
        mode: 'recommend',
        intent: result.intent,
        usedLlm: result.usedLlm,
        autoEnable: false,
        candidatesConsidered: result.candidatesConsidered,
        recommendations: result.recommendations.map((item) => ({
          pluginId: item.pluginId,
          score: item.score,
          reasons: item.reasons,
          capabilities: item.capabilities,
          label: item.label,
          summary: item.summary,
          moduleKind: item.moduleKind,
          enableHint: `zavorth plugins enable ${item.pluginId} --yes`,
        })),
        text: result.formatText(),
        note: 'Recommendations only — never auto-enables plugins.',
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        ok: false,
        mode: 'recommend',
        intent,
        autoEnable: false,
        message: error instanceof Error ? error.message : String(error),
      }, null, 2);
    }
  }
}
