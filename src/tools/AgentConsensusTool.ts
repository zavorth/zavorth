/**
 * Agent-facing multi-model consensus tool.
 *
 * User-owned: never invents product-default models.
 * The user chooses when to run and which reviewers (explicit call, saved profile,
 * or their own provider selection stack: primary + secondary + fallbacks).
 *
 * Actions:
 *  - preview  → show panel that would run (no LLM calls)
 *  - run      → deliberate with resolved panel
 *  - status   → selection + profile + stack snapshot
 *  - save_profile → persist user reviewers for later strategy=profile
 */

import { BaseTool } from './BaseTool.js';
import { AgentConsensusEngine } from '../agents/AgentConsensusEngine.js';
import { ConsensusWithFallback } from '../agents/ConsensusWithFallback.js';
import { createLlmRuntimeChatPort } from '../agents/LlmChatPort.js';
import { LlmRuntimeService } from '../services/llm/LlmRuntimeService.js';
import {
  resolveConsensusPanel,
  resolveUserFallbackCandidates,
  writeConsensusProfile,
  readConsensusProfile,
  type ConsensusReviewerSpec,
} from '../services/ConsensusPanelResolver.js';
import { asErrorLike } from '../utils/errorLike.js';

export type AgentConsensusToolDeps = {
  llmRuntime?: LlmRuntimeService;
  projectRoot?: string;
};

export class AgentConsensusTool extends BaseTool {
  public readonly name = 'agent_consensus_engine';
  public readonly description =
    'Multi-model consensus using ONLY models the user configured or passes in this call. '
    + 'Does not invent gpt-4o/claude defaults. '
    + 'Actions: preview (see panel), run (deliberate), status, save_profile. '
    + 'User chooses when to use it and how (explicit reviewers, saved profile, or user_stack from primary/secondary/fallbacks).';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['preview', 'run', 'status', 'save_profile'],
        description:
          'preview|status = free inspect; run = deliberate; save_profile = save your reviewers. '
          + 'On chat, users usually skip this: a bare question becomes run automatically.',
      },
      query: {
        type: 'string',
        description: 'Question to deliberate. If set without action, treated as run.',
      },
      strategy: {
        type: 'string',
        enum: ['auto', 'explicit', 'profile', 'user_stack'],
        description:
          'How to pick reviewers: explicit (args only), profile (saved), user_stack (your selection), auto (explicit→profile→user_stack). Default auto.',
      },
      mode: {
        type: 'string',
        enum: ['plain', 'fallback'],
        description: 'plain = fixed reviewers; fallback = retry via your fallback stack only. Default from profile or plain.',
      },
      reviewers: {
        type: 'string',
        description: 'JSON array of user-chosen reviewers: [{provider, model}]. Preferred over any auto pick.',
      },
      synthesizer: {
        type: 'string',
        description: 'JSON object for synthesizer {provider, model}. Defaults to first reviewer if omitted.',
      },
      sessionId: {
        type: 'string',
        description: 'Optional session id to include session model route in user_stack diversity.',
      },
      systemPrompt: {
        type: 'string',
        description: 'Optional system instruction for reviewers/synthesizer.',
      },
      maxConcurrent: {
        type: 'number',
        description: 'Max concurrent reviewer calls (default 3).',
      },
      timeoutMs: {
        type: 'number',
        description: 'Per-call timeout ms (default 60000).',
      },
      enableCache: {
        type: 'boolean',
        description: 'Cache identical queries (plain mode). Default true.',
      },
      // save_profile fields
      enabled: {
        type: 'boolean',
        description: 'For save_profile: whether auto strategy may use this profile (default true).',
      },
      defaultMode: {
        type: 'string',
        enum: ['plain', 'fallback'],
        description: 'For save_profile: preferred mode.',
      },
      minReviewers: {
        type: 'number',
        description: 'For save_profile: minimum distinct reviewers required to run (default 2).',
      },
    },
    required: [],
  };

  private readonly llmRuntime: LlmRuntimeService;
  private readonly projectRoot: string;

  constructor(deps: AgentConsensusToolDeps = {}) {
    super();
    this.llmRuntime = deps.llmRuntime || new LlmRuntimeService();
    this.projectRoot = deps.projectRoot || process.cwd();
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const query = String(args.query || '').trim();
      // User chooses when to spend LLM cost: ambiguous calls default to preview.
      const action = resolveAction(args);

      if (action === 'status') {
        return this.status();
      }
      if (action === 'save_profile') {
        return this.saveProfile(args);
      }
      if (action === 'preview') {
        return this.preview(args);
      }
      // run — only when action=run was explicit (or clearly intended)
      return await this.run(args, query);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      return JSON.stringify({
        ok: false,
        error: error instanceof Error ? err.message : String(error),
      });
    }
  }

  private status(): string {
    const panel = this.resolvePanel({ strategy: 'auto', previewOnly: true });
    const profile = readConsensusProfile(this.projectRoot);
    return JSON.stringify({
      ok: true,
      action: 'status',
      userSelection: {
        configured: panel.userSelection.configured,
        providerId: panel.userSelection.providerId,
        modelId: panel.userSelection.modelId,
        secondaryModelId: panel.userSelection.secondaryModelId,
        fallbackProviderIds: panel.userSelection.fallbackProviderIds,
        source: panel.userSelection.source,
      },
      profile,
      availableFromUserStack: panel.availableFromUserStack,
      wouldRun: panel.ok,
      reason: panel.reason,
      guidance: panel.guidance,
    }, null, 2);
  }

  private preview(args: Record<string, unknown>): string {
    const panel = this.resolvePanel({
      strategy: args.strategy,
      explicitReviewers: args.reviewers,
      explicitSynthesizer: args.synthesizer,
      sessionId: args.sessionId,
      previewOnly: true,
    });
    return JSON.stringify({
      ok: panel.ok,
      action: 'preview',
      strategy: panel.strategy,
      modeDefault: panel.modeDefault,
      reviewers: panel.reviewers,
      synthesizer: panel.synthesizer,
      availableFromUserStack: panel.availableFromUserStack,
      reason: panel.reason,
      guidance: panel.guidance,
      note: 'No LLM calls were made. Call action=run with the same args to deliberate.',
    }, null, 2);
  }

  private saveProfile(args: Record<string, unknown>): string {
    const reviewers = Array.isArray(args.reviewers) ? args.reviewers : null;
    if (!reviewers || reviewers.length < 2) {
      return JSON.stringify({
        ok: false,
        action: 'save_profile',
        error: 'save_profile requires reviewers array with at least 2 {provider, model} entries that you choose.',
        guidance: [
          'Example: action=save_profile reviewers=[{provider:"ollama",model:"llama3.2"},{provider:"deepseek",model:"deepseek-chat"}] enabled=true',
        ],
      }, null, 2);
    }

    const cleaned = reviewers
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const rec = item as Record<string, unknown>;
        const provider = String(rec.provider || '').trim();
        const model = String(rec.model || '').trim();
        if (!provider || !model) return null;
        const temperature = Number(rec.temperature);
        return {
          provider,
          model,
          ...(Number.isFinite(temperature) ? { temperature } : {}),
        };
      })
      .filter(Boolean) as Array<{ provider: string; model: string; temperature?: number }>;

    if (cleaned.length < 2) {
      return JSON.stringify({
        ok: false,
        action: 'save_profile',
        error: 'Need at least 2 valid {provider, model} pairs.',
      });
    }

    let synthesizer: { provider: string; model: string } | null = null;
    if (args.synthesizer && typeof args.synthesizer === 'object') {
      const s = args.synthesizer as Record<string, unknown>;
      const provider = String(s.provider || '').trim();
      const model = String(s.model || '').trim();
      if (provider && model) synthesizer = { provider, model };
    }

    const profile = writeConsensusProfile({
      enabled: args.enabled !== false,
      defaultMode: String(args.defaultMode || 'plain').toLowerCase() === 'fallback' ? 'fallback' : 'plain',
      reviewers: cleaned,
      synthesizer,
      minReviewers: Math.max(2, Number(args.minReviewers) || 2),
    }, this.projectRoot);

    return JSON.stringify({
      ok: true,
      action: 'save_profile',
      profile,
      note: 'Profile saved. Use action=run strategy=profile (or auto) when you want consensus with these reviewers.',
    }, null, 2);
  }

  private async run(args: Record<string, unknown>, query: string): Promise<string> {
    if (!query) {
      return JSON.stringify({
        ok: false,
        action: 'run',
        error: 'query is required for action=run. Use action=preview to inspect the panel without cost.',
      });
    }

    const panel = this.resolvePanel({
      strategy: args.strategy,
      explicitReviewers: args.reviewers,
      explicitSynthesizer: args.synthesizer,
      sessionId: args.sessionId,
      previewOnly: false,
    });

    if (!panel.ok || panel.reviewers.length < 2 || !panel.synthesizer) {
      return JSON.stringify({
        ok: false,
        action: 'run',
        error: panel.reason,
        guidance: panel.guidance,
        availableFromUserStack: panel.availableFromUserStack,
        userSelection: {
          configured: panel.userSelection.configured,
          providerId: panel.userSelection.providerId,
          modelId: panel.userSelection.modelId,
          secondaryModelId: panel.userSelection.secondaryModelId,
          fallbackProviderIds: panel.userSelection.fallbackProviderIds,
        },
      }, null, 2);
    }

    const modeRaw = String(args.mode || panel.modeDefault || 'plain').trim().toLowerCase();
    const mode = modeRaw === 'fallback' ? 'fallback' : 'plain';
    const systemPrompt = optionalString(args.systemPrompt);
    const maxConcurrent = optionalNumber(args.maxConcurrent, 3);
    const timeoutMs = optionalNumber(args.timeoutMs, 60_000);
    const enableCache = args.enableCache !== false;
    const llm = createLlmRuntimeChatPort(this.llmRuntime);
    const reviewers = panel.reviewers.map(toEngineSpec);
    const synthesizer = toEngineSpec(panel.synthesizer);

    if (mode === 'fallback') {
      const fallbacksFor = (primary: { provider: string; model: string }) =>
        resolveUserFallbackCandidates({
          projectRoot: this.projectRoot,
          exclude: primary,
          isProviderAvailable: (name) => this.llmRuntime.isProviderAvailable(name),
          resolveDefaultModel: (name) => this.safeDefaultModel(name),
        });

      const engine = new ConsensusWithFallback(llm, { resolveFallbacks: fallbacksFor });
      const result = await engine.deliberate({
        query,
        reviewers,
        synthesizer,
        systemPrompt,
        maxConcurrent,
        timeoutMs,
      });
      return JSON.stringify({
        ok: true,
        action: 'run',
        mode: 'fallback',
        strategy: panel.strategy,
        panel: {
          reviewers: panel.reviewers,
          synthesizer: panel.synthesizer,
        },
        synthesis: result.synthesis,
        reviewersUsed: result.reviewersUsed,
        reviewersFailed: result.reviewersFailed,
        synthesizerLatencyMs: result.synthesizerLatencyMs,
        totalLatencyMs: result.totalLatencyMs,
        synthesizerProvider: result.synthesizerProvider,
        synthesizerModel: result.synthesizerModel,
        assessments: result.assessments.map(summarizeAssessment),
      }, null, 2);
    }

    const engine = new AgentConsensusEngine({
      reviewers,
      synthesizer,
      maxConcurrent,
      timeoutMs,
      enableCache,
      llm,
    });
    const result = await engine.deliberate(query, { systemPrompt });
    return JSON.stringify({
      ok: true,
      action: 'run',
      mode: 'plain',
      strategy: panel.strategy,
      panel: {
        reviewers: panel.reviewers,
        synthesizer: panel.synthesizer,
      },
      synthesis: result.synthesis,
      cacheHit: result.cacheHit,
      reviewersUsed: result.reviewersUsed,
      reviewersFailed: result.reviewersFailed,
      synthesizerLatencyMs: result.synthesizerLatencyMs,
      totalLatencyMs: result.totalLatencyMs,
      assessments: result.assessments.map(summarizeAssessment),
      stats: engine.getStats(),
    }, null, 2);
  }

  private resolvePanel(input: {
    strategy?: unknown;
    explicitReviewers?: unknown;
    explicitSynthesizer?: unknown;
    sessionId?: unknown;
    previewOnly: boolean;
  }) {
    return resolveConsensusPanel({
      projectRoot: this.projectRoot,
      strategy: input.strategy as string | undefined,
      explicitReviewers: input.explicitReviewers,
      explicitSynthesizer: input.explicitSynthesizer,
      sessionId: input.sessionId ? String(input.sessionId) : null,
      previewOnly: input.previewOnly,
      isProviderAvailable: (name) => {
        try {
          return this.llmRuntime.isProviderAvailable(name);
        } catch {
          return false;
        }
      },
      resolveDefaultModel: (name) => this.safeDefaultModel(name),
    });
  }

  private safeDefaultModel(providerName: string): string | null {
    try {
      // Only use runtime-configured default for THAT provider — never a product catalog.
      const anyRuntime = this.llmRuntime as unknown as {
        getProviderFactoryDefaultModel?: (n: string) => string;
      };
      // Prefer not calling private APIs; model must come from user selection when possible.
      void anyRuntime;
      void providerName;
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * Alias: always mode=fallback, same user-owned panel rules.
 */
export class ConsensusWithFallbackTool extends BaseTool {
  public readonly name = 'consensus_with_fallback';
  public readonly description =
    'User-owned multi-model consensus with fallback only across the user\'s own secondary/fallback providers. '
    + 'Same actions as agent_consensus_engine; run always uses mode=fallback. Never invents product models.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        description: 'preview | run | status | save_profile',
        enum: ['preview', 'run', 'status', 'save_profile'],
      },
      query: { type: 'string', description: 'Question or task for consensus reviewers.' },
      strategy: {
        type: 'string',
        description: 'auto | explicit | profile | user_stack',
        enum: ['auto', 'explicit', 'profile', 'user_stack'],
      },
      reviewers: {
        type: 'string',
        description: 'JSON array of {provider, model} reviewers (or use structured args when supported).',
      },
      synthesizer: {
        type: 'string',
        description: 'JSON object {provider, model} for synthesizer.',
      },
      sessionId: { type: 'string', description: 'Optional session id.' },
      systemPrompt: { type: 'string', description: 'Optional system prompt for reviewers.' },
      maxConcurrent: { type: 'number', description: 'Max concurrent reviewers.' },
      timeoutMs: { type: 'number', description: 'Per-reviewer timeout in ms.' },
      enabled: { type: 'boolean', description: 'Whether the saved profile is enabled.' },
      defaultMode: {
        type: 'string',
        description: 'plain or fallback',
        enum: ['plain', 'fallback'],
      },
      minReviewers: { type: 'number', description: 'Minimum reviewers required.' },
    },
    required: [] as string[],
  };

  private readonly inner: AgentConsensusTool;

  constructor(deps: AgentConsensusToolDeps = {}) {
    super();
    this.inner = new AgentConsensusTool(deps);
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    return this.inner.execute({ ...args, mode: 'fallback' });
  }
}

// ── helpers ──────────────────────────────────────────────────────────

function resolveAction(args: Record<string, unknown>): 'preview' | 'run' | 'status' | 'save_profile' {
  const a = String(args.action || '').trim().toLowerCase();
  if (a === 'preview' || a === 'run' || a === 'status' || a === 'save_profile') return a;
  // Natural: if the user already wrote a question, that is the opt-in to run.
  if (String(args.query || '').trim()) return 'run';
  return 'preview';
}

function optionalString(value: unknown): string | undefined {
  const s = String(value ?? '').trim();
  return s || undefined;
}

function optionalNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function toEngineSpec(spec: ConsensusReviewerSpec): { provider: string; model: string; temperature?: number } {
  return {
    provider: spec.provider,
    model: spec.model,
    ...(spec.temperature !== undefined ? { temperature: spec.temperature } : {}),
  };
}

function summarizeAssessment(a: {
  provider: string;
  model: string;
  effectiveProvider?: string;
  effectiveModel?: string;
  success: boolean;
  latencyMs: number;
  error?: string;
  assessment?: string;
}) {
  return {
    provider: a.provider,
    model: a.model,
    effectiveProvider: a.effectiveProvider,
    effectiveModel: a.effectiveModel,
    success: a.success,
    latencyMs: a.latencyMs,
    error: a.error,
    assessmentPreview: (a.assessment || '').slice(0, 400),
  };
}
