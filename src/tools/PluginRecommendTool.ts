import path from 'node:path';

import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { PluginRouterService } from '../services/PluginRouterService.js';
import { CapabilityMissService } from '../services/CapabilityMissService.js';
import { config as runtimeConfig } from '../config/index.js';

/**
 * Agent-facing Plugin OS router. Recommends plugins for a natural-language
 * intent. Supports structured missingTool for capability-miss. Never auto-enables.
 */
export class PluginRecommendTool extends BaseTool {
  public readonly name = 'plugin_recommend';

  public readonly description =
    'Recommend Zavorth Plugin OS packages / skills for a natural-language intent ' +
    'or a structured missingTool. Never enables plugins.';

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
        description: 'Exact tool name that is missing (structured capability-miss).',
      },
      missingCapability: {
        type: 'string',
        description: 'Capability id when known.',
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
  private readonly capabilityMiss: CapabilityMissService;
  private readonly projectRoot: string;

  constructor(
    options: {
      router?: PluginRouterService;
      capabilityMiss?: CapabilityMissService;
      projectRoot?: string;
    } = {},
  ) {
    super();
    this.router = options.router || new PluginRouterService();
    this.projectRoot = path.resolve(
      options.projectRoot ||
        (runtimeConfig as { projectRoot?: string } | undefined)?.projectRoot ||
        process.env.ZAVORTH_PROJECT_ROOT ||
        process.cwd(),
    );
    this.capabilityMiss =
      options.capabilityMiss ||
      new CapabilityMissService({
        projectRoot: this.projectRoot,
      });
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const explainId = String(args.explainPluginId || args.pluginId || '').trim();
    if (explainId) {
      const explained = this.router.explain({
        root: this.projectRoot,
        pluginId: explainId,
      });
      return JSON.stringify(
        {
          ok: explained.ok,
          mode: 'explain',
          pluginId: explained.pluginId,
          found: explained.found,
          candidate: explained.candidate,
          reasons: explained.reasons,
          autoEnable: false,
          autoInstall: false,
          text: explained.formatText(),
        },
        null,
        2,
      );
    }

    const missingTool = String(args.missingTool || args.tool || '').trim();
    const missingCapability = String(args.missingCapability || args.capability || '').trim();
    const intent = String(args.intent || args.query || args.text || '').trim();
    const limit = Math.max(1, Math.min(20, Number(args.limit) || 5));

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
            missingTool: miss.input.missingTool,
            missingCapability: miss.input.missingCapability,
            intent: intent || null,
            installSuggestions: miss.suggestions,
            primary: miss.primary,
            text: miss.formatText(),
            note: 'Structured miss path — never auto-enables. Preview then consent.',
          },
          null,
          2,
        );
      } catch (error: unknown) {
        return JSON.stringify(
          {
            ok: false,
            mode: 'capability_miss',
            autoEnable: false,
            autoInstall: false,
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
          reason: 'intent_required',
          message: 'Provide missingTool (preferred) or intent describing the capability needed.',
          autoEnable: false,
          autoInstall: false,
          setup: [
            'Example: plugin_recommend missingTool="web_search"',
            'Example: plugin_recommend intent="search the web for release notes"',
            'Example: plugin_recommend explainPluginId="web-search"',
            'Enable: zavorth plugins enable <id> --yes',
          ],
        },
        null,
        2,
      );
    }

    const useLlm = args.useLlm === true || args.llm === true;

    try {
      const result = await this.router.recommend({
        root: this.projectRoot,
        intent,
        limit,
        useLlm,
      });

      let installSuggestions: ReturnType<CapabilityMissService['resolve']>['suggestions'] = [];
      try {
        installSuggestions = this.capabilityMiss.resolve({
          intentHint: intent,
          limit,
          root: this.projectRoot,
        }).suggestions;
      } catch {
        /* soft */
      }

      return JSON.stringify(
        {
          ok: result.ok,
          mode: 'recommend',
          intent: result.intent,
          usedLlm: result.usedLlm,
          autoEnable: false,
          autoInstall: false,
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
          installSuggestions,
          text: result.formatText(),
          note: 'Recommendations only — never auto-enables plugins. Free-text does not enable.',
        },
        null,
        2,
      );
    } catch (error: unknown) {
      return JSON.stringify(
        {
          ok: false,
          mode: 'recommend',
          intent,
          autoEnable: false,
          autoInstall: false,
          message: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      );
    }
  }
}
