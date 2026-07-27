import type { ILlmProvider, ChatMessage } from '../../providers/ILlmProvider.js';
import { ProviderFactory } from '../../providers/ProviderFactory.js';
import {
  formatRoleSurfaceLabel,
  normalizeRoleSurface,
  type LlmRoleBinding,
  type LlmRoleHealthIssue,
  type LlmRoleName,
  type LlmRoleResolveRequest,
  type LlmRoleResolveResult,
  type LlmRoleRoutingConfig,
  type LlmRoleSetupParseResult,
} from '../../contracts/runtime/LlmRoleRoutingContract.js';
import { tService } from '../../i18n/services.js';
import { LlmRoleCatalogService } from './LlmRoleCatalogService.js';
import { LlmRoleStoreService } from './LlmRoleStoreService.js';

const PROMPT_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const SWITCH_WINDOW_MS = 48 * 60 * 60 * 1000;
const SWITCH_THRESHOLD = 2;
const FORCE_STRONG_DEFAULT_MS = 2 * 60 * 60 * 1000;

export type LlmRolePromptDecision = {
  shouldPrompt: boolean;
  reason: string;
};

export class LlmRoleRoutingService {
  private readonly store: LlmRoleStoreService;
  private readonly catalog: LlmRoleCatalogService;

  constructor(options?: { store?: LlmRoleStoreService; catalog?: LlmRoleCatalogService }) {
    this.store = options?.store || new LlmRoleStoreService();
    this.catalog = options?.catalog || new LlmRoleCatalogService();
  }

  public getConfig(scopeId: string): LlmRoleRoutingConfig {
    return this.store.load(scopeId);
  }

  public resolveBindingHint(
    providerHint: string | null | undefined,
    modelHint: string | null | undefined,
    isProviderUsable: (name: string) => boolean,
    preferredTier: 'fast' | 'balanced' | 'strong' = 'balanced',
  ) {
    return this.catalog.resolveBinding(providerHint, modelHint, isProviderUsable, preferredTier);
  }

  public recordModelSwitch(
    scopeId: string,
    provider: string,
    model: string,
    surface?: string | null,
  ): LlmRoleRoutingConfig {
    const cfg = this.store.load(scopeId);
    const family = this.catalog.detectFamily(`${provider} ${model}`) || ProviderFactory.normalizeProviderName(provider);
    const event = {
      at: new Date().toISOString(),
      provider: ProviderFactory.normalizeProviderName(provider),
      model: String(model || '').trim(),
      family: family || 'unknown',
      surface: surface || null,
    };
    cfg.modelSwitchEvents = [...(cfg.modelSwitchEvents || []), event].slice(-40);
    return this.store.save(scopeId, cfg);
  }

  public noteUsableProviders(
    scopeId: string,
    isProviderUsable: (name: string) => boolean,
  ): { crossedToMultiple: boolean; providers: string[] } {
    const cfg = this.store.load(scopeId);
    const providers = Array.from(
      new Set(this.catalog.listUsableModels(isProviderUsable).map((entry) => entry.provider)),
    ).sort();
    const previous = cfg.lastUsableProviders || [];
    const crossedToMultiple = previous.length < 2 && providers.length >= 2;
    cfg.lastUsableProviders = providers;
    this.store.save(scopeId, cfg);
    return { crossedToMultiple, providers };
  }

  public setForceStrong(scopeId: string, enabled: boolean, durationMs = FORCE_STRONG_DEFAULT_MS): LlmRoleRoutingConfig {
    const cfg = this.store.load(scopeId);
    cfg.forceStrongUntil = enabled ? new Date(Date.now() + Math.max(60_000, durationMs)).toISOString() : null;
    return this.store.save(scopeId, cfg);
  }

  public isForceStrongActive(scopeId: string): boolean {
    const cfg = this.store.load(scopeId);
    if (!cfg.forceStrongUntil) return false;
    const until = Date.parse(cfg.forceStrongUntil);
    if (!Number.isFinite(until) || until <= Date.now()) {
      if (cfg.forceStrongUntil) {
        cfg.forceStrongUntil = null;
        this.store.save(scopeId, cfg);
      }
      return false;
    }
    return true;
  }

  public shouldPromptSetup(
    scopeId: string,
    isProviderUsable: (name: string) => boolean,
    options?: { force?: boolean; calmTurn?: boolean; surface?: string | null },
  ): LlmRolePromptDecision {
    if (options?.calmTurn === false) {
      return { shouldPrompt: false, reason: 'turn_not_calm' };
    }

    const cfg = this.store.load(scopeId);
    // Business state first so diagnostics stay accurate under any surface/env.
    if (cfg.rolesConfigured) {
      return { shouldPrompt: false, reason: 'already_configured' };
    }
    if (cfg.awaitingSetup || cfg.pendingConfirmation) {
      return { shouldPrompt: false, reason: 'already_awaiting_reply' };
    }
    if (cfg.promptDismissedAt) {
      const dismissedAt = Date.parse(cfg.promptDismissedAt);
      if (Number.isFinite(dismissedAt) && Date.now() - dismissedAt < PROMPT_COOLDOWN_MS) {
        return { shouldPrompt: false, reason: 'dismissed_cooldown' };
      }
    }
    if (cfg.lastPromptedAt && !options?.force) {
      const last = Date.parse(cfg.lastPromptedAt);
      if (Number.isFinite(last) && Date.now() - last < 24 * 60 * 60 * 1000) {
        return { shouldPrompt: false, reason: 'recently_prompted' };
      }
    }

    if (process.env.NODE_ENV === 'test' && process.env.ZAVORTH_LLM_ROLE_AUTOPROMPT !== '1' && !options?.force) {
      return { shouldPrompt: false, reason: 'test_env' };
    }

    const usable = this.catalog.listUsableModels(isProviderUsable);
    const providers = new Set(usable.map((entry) => entry.provider));
    const familiesWithMulti = this.countMultiModelFamilies(usable);
    const noted = this.noteUsableProviders(scopeId, isProviderUsable);

    if (usable.length < 2 && providers.size < 2) {
      return { shouldPrompt: false, reason: 'insufficient_options' };
    }

    const recentSwitches = (cfg.modelSwitchEvents || []).filter((event) => {
      const at = Date.parse(event.at);
      return Number.isFinite(at) && Date.now() - at <= SWITCH_WINDOW_MS;
    });
    const multiFamilySwitch = this.hasRepeatedFamilySwitch(recentSwitches);

    if (options?.force) {
      return { shouldPrompt: true, reason: 'forced' };
    }
    if (noted.crossedToMultiple) {
      return { shouldPrompt: true, reason: 'crossed_to_multiple_providers' };
    }
    if (providers.size >= 2) {
      return { shouldPrompt: true, reason: 'multiple_providers_ready' };
    }
    if (familiesWithMulti >= 1 && multiFamilySwitch) {
      return { shouldPrompt: true, reason: 'repeated_family_model_switches' };
    }
    if (familiesWithMulti >= 1 && recentSwitches.length >= SWITCH_THRESHOLD) {
      return { shouldPrompt: true, reason: 'repeated_model_switches' };
    }

    return { shouldPrompt: false, reason: 'no_trigger' };
  }

  public markPrompted(scopeId: string, surface?: string | null): LlmRoleRoutingConfig {
    const cfg = this.store.load(scopeId);
    cfg.lastPromptedAt = new Date().toISOString();
    cfg.lastPromptSurface = surface ? normalizeRoleSurface(surface) : null;
    cfg.awaitingSetup = true;
    cfg.telemetry.setupPromptsShown = Number(cfg.telemetry.setupPromptsShown || 0) + 1;
    return this.store.save(scopeId, cfg);
  }

  public dismissPrompt(scopeId: string): LlmRoleRoutingConfig {
    const cfg = this.store.load(scopeId);
    cfg.promptDismissedAt = new Date().toISOString();
    cfg.pendingConfirmation = null;
    cfg.awaitingSetup = false;
    cfg.telemetry.setupDeferred = Number(cfg.telemetry.setupDeferred || 0) + 1;
    return this.store.save(scopeId, cfg);
  }

  public setRoles(
    scopeId: string,
    input: {
      default?: LlmRoleBinding | null;
      strong?: LlmRoleBinding | null;
      background?: LlmRoleBinding | null;
      taskStrong?: LlmRoleRoutingConfig['taskStrong'];
      strongOnDefaultFailure?: boolean;
      source?: LlmRoleRoutingConfig['source'];
    },
  ): LlmRoleRoutingConfig {
    const cfg = this.store.load(scopeId);
    if (input.default !== undefined) cfg.default = input.default;
    if (input.strong !== undefined) cfg.strong = input.strong;
    if (input.background !== undefined) cfg.background = input.background;
    if (input.taskStrong) cfg.taskStrong = { ...cfg.taskStrong, ...input.taskStrong };
    if (typeof input.strongOnDefaultFailure === 'boolean') {
      cfg.strongOnDefaultFailure = input.strongOnDefaultFailure;
    }
    cfg.rolesConfigured = Boolean(cfg.default || cfg.strong || cfg.background);
    cfg.pendingConfirmation = null;
    cfg.awaitingSetup = false;
    cfg.source = input.source || cfg.source || 'system';
    if (cfg.rolesConfigured) {
      cfg.telemetry.setupCompleted = Number(cfg.telemetry.setupCompleted || 0) + 1;
    }
    return this.store.save(scopeId, cfg);
  }

  public recordRoleTurn(scopeId: string, role: LlmRoleName): void {
    const cfg = this.store.load(scopeId);
    if (role === 'strong') cfg.telemetry.turnsStrong += 1;
    else if (role === 'background') cfg.telemetry.turnsBackground += 1;
    else cfg.telemetry.turnsDefault += 1;
    this.store.save(scopeId, cfg);
  }

  public healthCheck(scopeId: string, isProviderUsable: (name: string) => boolean): LlmRoleHealthIssue[] {
    const cfg = this.store.load(scopeId);
    const issues: LlmRoleHealthIssue[] = [];
    const usable = new Set(this.catalog.listUsableModels(isProviderUsable).map((e) => `${e.provider}::${e.model}`));

    const check = (label: string, binding: LlmRoleBinding | null) => {
      if (!binding) return;
      const key = `${ProviderFactory.normalizeProviderName(binding.provider)}::${binding.model}`;
      if (!isProviderUsable(binding.provider)) {
        issues.push({
          code: `${label}_provider_unusable`,
          severity: 'warn',
          message: `${label} provider "${binding.provider}" is not usable right now.`,
        });
        return;
      }
      if (!usable.has(key)) {
        issues.push({
          code: `${label}_model_missing`,
          severity: 'warn',
          message: `${label} model "${binding.provider}/${binding.model}" is not in the known usable catalog. Reconfigure with /model setup.`,
        });
      }
    };

    check('default', cfg.default);
    check('strong', cfg.strong);
    check('background', cfg.background);
    if (cfg.rolesConfigured && !cfg.strong) {
      issues.push({
        code: 'strong_unset',
        severity: 'info',
        message: 'Roles configured without a distinct strong binding (strong mirrors default unless set).',
      });
    }
    return issues;
  }

  public buildSurfaceSetupPrompt(
    scopeId: string,
    surface: string,
    isProviderUsable: (name: string) => boolean,
  ): string {
    const surfaceKey = normalizeRoleSurface(surface);
    const surfaceLabel = formatRoleSurfaceLabel(surfaceKey);
    const { proposal, usableSummary } = this.buildSetupQuestion(isProviderUsable);
    this.markPrompted(scopeId, surfaceKey);
    const def = proposal.default ? `${proposal.default.provider}/${proposal.default.model}` : '—';
    const strong = proposal.strong ? `${proposal.strong.provider}/${proposal.strong.model}` : '—';
    const usable = usableSummary || 'several models';
    return [
      '',
      '---',
      tService('llm_roles.setup_prompt_surface', { surface: surfaceLabel, usable }),
      tService('llm_roles.setup_prompt_body'),
      tService('llm_roles.setup_prompt_suggestion', { default: def, strong }),
      tService('llm_roles.setup_prompt_reply_hint'),
    ].join('\n');
  }

  public async handleInboundSetupMessage(
    scopeId: string,
    userText: string,
    llm: Pick<ILlmProvider, 'chat'>,
    isProviderUsable: (name: string) => boolean,
  ): Promise<{ handled: boolean; reply: string | null }> {
    const cfg = this.store.load(scopeId);
    if (!cfg.awaitingSetup && !cfg.pendingConfirmation) {
      return { handled: false, reply: null };
    }

    if (cfg.pendingConfirmation) {
      return {
        handled: true,
        reply: 'A role-routing change is waiting for explicit confirmation. Use the role setup confirmation action to apply or cancel it.',
      };
    }

    const result = await this.parseNaturalSetupReply(userText, llm, isProviderUsable);
    if (result.parse.intent === 'defer') {
      this.dismissPrompt(scopeId);
      return { handled: true, reply: 'Okay — I will not ask again for a while. You can re-open setup anytime.' };
    }
    if (result.parse.intent === 'unclear') {
      return {
        handled: true,
        reply: 'I did not fully understand. Try: default gemini flash, strong gemini pro — or "later".',
      };
    }
    if (result.needsConfirmation && result.confirmationMessage) {
      const proposed = JSON.parse(result.confirmationMessage);
      this.setPendingConfirmation(scopeId, 'nearest_match', proposed, userText);
      return {
        handled: true,
        reply: [
          'I could not match your wording exactly. Closest available:',
          `- default: \`${proposed.default ? `${proposed.default.provider}/${proposed.default.model}` : '—'}\``,
          `- strong: \`${proposed.strong ? `${proposed.strong.provider}/${proposed.strong.model}` : '—'}\``,
          'Reply yes to confirm or no to cancel.',
        ].join('\n'),
      };
    }

    const applied = this.applyParsedSetup(scopeId, result.parse, isProviderUsable);
    return {
      handled: true,
      reply: `Roles updated (${applied.summary}).\n${this.formatStatusText(applied.config)}`,
    };
  }

  public formatStatusText(cfg: LlmRoleRoutingConfig): string {
    const fmt = (b: LlmRoleBinding | null | undefined) => (b ? `${b.provider}/${b.model}` : 'not set');
    return [
      'LLM roles:',
      `- default: ${fmt(cfg.default)}`,
      `- strong: ${fmt(cfg.strong)}`,
      `- background: ${fmt(cfg.background)}`,
      `- strong-on-failure: ${cfg.strongOnDefaultFailure ? 'on' : 'off'}`,
      `- force-strong: ${cfg.forceStrongUntil || 'off'}`,
    ].join('\n');
  }

  public resolveRole(
    scopeId: string,
    request: LlmRoleResolveRequest,
    fallbackProvider: string,
    fallbackModel: string | undefined,
    isProviderUsable: (name: string) => boolean,
  ): LlmRoleResolveResult {
    const cfg = this.store.load(scopeId);
    let role: LlmRoleName = 'default';
    let reason = 'default_role';
    const forceActive = this.isForceStrongActive(scopeId);

    if (request.role === 'background') {
      role = 'background';
      reason = 'explicit_background_role';
    } else if (request.forceStrong || request.role === 'strong' || forceActive) {
      role = 'strong';
      reason =
        forceActive && !request.forceStrong ? 'force_strong_window'
          : request.forceStrong ? 'force_strong'
            : 'explicit_strong_role';
    } else if (request.effortHigh) {
      role = cfg.strong ? 'strong' : 'default';
      reason = cfg.strong ? 'effort_high_uses_strong' : 'effort_high_but_strong_unconfigured';
    } else if (request.defaultFailed && cfg.strongOnDefaultFailure && cfg.strong) {
      role = 'strong';
      reason = 'default_failed_strong_fallback';
    } else if (request.taskKind) {
      const taskBinding = this.taskStrongBinding(cfg, request.taskKind);
      if (taskBinding) {
        return this.materialize(
          role,
          taskBinding,
          'task_specific_strong',
          fallbackProvider,
          fallbackModel,
          isProviderUsable,
        );
      }
    }

    if (role === 'strong' && request.taskKind) {
      const taskBinding = this.taskStrongBinding(cfg, request.taskKind);
      if (taskBinding) {
        return this.materialize(
          role,
          taskBinding,
          'task_specific_strong',
          fallbackProvider,
          fallbackModel,
          isProviderUsable,
        );
      }
    }

    const binding =
      role === 'background'
        ? cfg.background || cfg.default
        : role === 'strong'
          ? cfg.strong || cfg.default
          : cfg.default;

    return this.materialize(role, binding, reason, fallbackProvider, fallbackModel, isProviderUsable);
  }

  public buildSetupQuestion(isProviderUsable: (name: string) => boolean): {
    proposal: { default: LlmRoleBinding | null; strong: LlmRoleBinding | null };
    usableSummary: string;
  } {
    const proposal = this.catalog.proposeDualRoles(isProviderUsable);
    const usable = this.catalog.listUsableModels(isProviderUsable);
    const usableSummary = usable
      .slice(0, 12)
      .map((entry) => `${entry.provider}/${entry.model}`)
      .join(', ');
    return {
      proposal: {
        default: proposal.default,
        strong: proposal.strong,
      },
      usableSummary,
    };
  }

  public async parseNaturalSetupReply(
    userText: string,
    llm: Pick<ILlmProvider, 'chat'>,
    isProviderUsable: (name: string) => boolean,
  ): Promise<{
    parse: LlmRoleSetupParseResult;
    applied: LlmRoleRoutingConfig | null;
    needsConfirmation: boolean;
    confirmationMessage: string | null;
    userMessage: string;
  }> {
    const parse = await this.classifySetupWithLlm(userText, llm);
    const scopeProbe = 'parse-only';

    if (parse.intent === 'defer') {
      return {
        parse,
        applied: null,
        needsConfirmation: false,
        confirmationMessage: null,
        userMessage: 'ok_deferred',
      };
    }

    if (parse.intent === 'confirm_yes' || parse.intent === 'confirm_no') {
      return {
        parse,
        applied: null,
        needsConfirmation: false,
        confirmationMessage: null,
        userMessage: parse.intent,
      };
    }

    if (parse.intent === 'unclear') {
      return {
        parse,
        applied: null,
        needsConfirmation: false,
        confirmationMessage: null,
        userMessage: 'unclear',
      };
    }

    const defaultResolved = this.catalog.resolveBinding(
      parse.defaultProvider,
      parse.defaultModel,
      isProviderUsable,
      'fast',
    );
    const strongResolved = this.catalog.resolveBinding(
      parse.strongProvider || (parse.intent === 'one_for_both' ? parse.defaultProvider : null),
      parse.strongModel || (parse.intent === 'one_for_both' ? parse.defaultModel : null),
      isProviderUsable,
      'strong',
    );

    if (parse.intent === 'one_for_both') {
      const one =
        defaultResolved.binding || strongResolved.binding || defaultResolved.nearest || strongResolved.nearest;
      if (!one) {
        return {
          parse,
          applied: null,
          needsConfirmation: false,
          confirmationMessage: null,
          userMessage: 'no_usable_models',
        };
      }
      if (!defaultResolved.exact && defaultResolved.nearest) {
        return {
          parse,
          applied: null,
          needsConfirmation: true,
          confirmationMessage: JSON.stringify({ default: one, strong: one }),
          userMessage: 'confirm_nearest',
        };
      }
      return {
        parse,
        applied: null,
        needsConfirmation: false,
        confirmationMessage: null,
        userMessage: 'ready_one_for_both',
        // consumer applies via setRoles
      } as any;
    }

    const defaultBinding = defaultResolved.binding;
    const strongBinding = strongResolved.binding;

    if ((!defaultBinding && defaultResolved.nearest) || (!strongBinding && strongResolved.nearest)) {
      return {
        parse,
        applied: null,
        needsConfirmation: true,
        confirmationMessage: JSON.stringify({
          default: defaultBinding || defaultResolved.nearest,
          strong: strongBinding || strongResolved.nearest,
        }),
        userMessage: 'confirm_nearest',
      };
    }

    if (!defaultBinding && !strongBinding) {
      const proposal = this.catalog.proposeDualRoles(isProviderUsable);
      return {
        parse,
        applied: null,
        needsConfirmation: true,
        confirmationMessage: JSON.stringify(proposal),
        userMessage: 'confirm_proposal',
      };
    }

    void scopeProbe;
    return {
      parse,
      applied: null,
      needsConfirmation: false,
      confirmationMessage: null,
      userMessage: 'ready_set',
    };
  }

  public applyParsedSetup(
    scopeId: string,
    parse: LlmRoleSetupParseResult,
    isProviderUsable: (name: string) => boolean,
    proposed?: { default?: LlmRoleBinding | null; strong?: LlmRoleBinding | null },
  ): { config: LlmRoleRoutingConfig; summary: string } {
    if (parse.intent === 'one_for_both') {
      const one =
        this.catalog.resolveBinding(
          parse.defaultProvider || parse.strongProvider,
          parse.defaultModel || parse.strongModel,
          isProviderUsable,
          'balanced',
        ).binding ||
        proposed?.default ||
        proposed?.strong;
      if (!one) {
        return { config: this.store.load(scopeId), summary: 'no_binding' };
      }
      const config = this.setRoles(scopeId, {
        default: one,
        strong: one,
        background: one,
        strongOnDefaultFailure: parse.strongOnDefaultFailure === true,
        source: 'chat',
      });
      return { config, summary: `${one.provider}/${one.model}` };
    }

    const defaultBinding =
      proposed?.default ||
      this.catalog.resolveBinding(parse.defaultProvider, parse.defaultModel, isProviderUsable, 'fast').binding;
    const strongBinding =
      proposed?.strong ||
      this.catalog.resolveBinding(parse.strongProvider, parse.strongModel, isProviderUsable, 'strong').binding;

    const config = this.setRoles(scopeId, {
      default: defaultBinding,
      strong: strongBinding || defaultBinding,
      background: defaultBinding,
      strongOnDefaultFailure: parse.strongOnDefaultFailure === true,
      source: 'chat',
    });
    return {
      config,
      summary: `default=${defaultBinding ? `${defaultBinding.provider}/${defaultBinding.model}` : 'none'}; strong=${strongBinding ? `${strongBinding.provider}/${strongBinding.model}` : 'none'}`,
    };
  }

  public setPendingConfirmation(
    scopeId: string,
    kind: 'nearest_match' | 'family_proposal',
    proposed: LlmRoleRoutingConfig['pendingConfirmation'] extends infer T
      ? T extends { proposed: infer P }
        ? P
        : never
      : never,
    userUtterance: string,
  ): LlmRoleRoutingConfig {
    const cfg = this.store.load(scopeId);
    cfg.pendingConfirmation = {
      kind,
      proposed: proposed as any,
      userUtterance,
      createdAt: new Date().toISOString(),
    };
    return this.store.save(scopeId, cfg);
  }

  public confirmPending(scopeId: string, accept: boolean): LlmRoleRoutingConfig {
    const cfg = this.store.load(scopeId);
    if (!cfg.pendingConfirmation) {
      return cfg;
    }
    if (!accept) {
      cfg.pendingConfirmation = null;
      cfg.awaitingSetup = false;
      return this.store.save(scopeId, cfg);
    }
    const proposed = cfg.pendingConfirmation.proposed;
    cfg.pendingConfirmation = null;
    return this.setRoles(scopeId, {
      default: proposed.default ?? cfg.default,
      strong: proposed.strong ?? cfg.strong,
      background: proposed.background ?? cfg.background,
      source: 'chat',
    });
  }

  public async refreshLiveCatalog(isProviderUsable: (name: string) => boolean): Promise<number> {
    return this.catalog.refreshLiveModels(isProviderUsable);
  }

  private async classifySetupWithLlm(
    userText: string,
    llm: Pick<ILlmProvider, 'chat'>,
  ): Promise<LlmRoleSetupParseResult> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: [
          'Extract LLM role preferences from the user message.',
          'Roles: default (daily/simple), strong (hard tasks), optional background.',
          'Return ONLY JSON:',
          '{"intent":"set|defer|one_for_both|unclear|confirm_yes|confirm_no","defaultProvider":string|null,"defaultModel":string|null,"strongProvider":string|null,"strongModel":string|null,"backgroundProvider":string|null,"backgroundModel":string|null,"strongOnDefaultFailure":boolean|null,"note":string|null}',
          'intent one_for_both when user wants the same stack for both roles and may ask you to choose.',
          'intent defer when user postpones. confirm_yes/confirm_no for confirmation replies.',
          'Providers may be family names (gemini, gpt, claude). Models may be partial.',
        ].join('\n'),
      },
      { role: 'user', content: userText },
    ];
    try {
      const response = await llm.chat(messages);
      const text = String(response.content || '');
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        return { intent: 'unclear' };
      }
      const parsed = JSON.parse(match[0]) as LlmRoleSetupParseResult;
      const intent = String(parsed.intent || 'unclear') as LlmRoleSetupParseResult['intent'];
      const allowed = new Set(['set', 'defer', 'one_for_both', 'unclear', 'confirm_yes', 'confirm_no']);
      return {
        intent: allowed.has(intent) ? intent : 'unclear',
        defaultProvider: parsed.defaultProvider || null,
        defaultModel: parsed.defaultModel || null,
        strongProvider: parsed.strongProvider || null,
        strongModel: parsed.strongModel || null,
        backgroundProvider: parsed.backgroundProvider || null,
        backgroundModel: parsed.backgroundModel || null,
        strongOnDefaultFailure: parsed.strongOnDefaultFailure === true,
        note: parsed.note || null,
      };
    } catch {
      return { intent: 'unclear' };
    }
  }

  private materialize(
    role: LlmRoleName,
    binding: LlmRoleBinding | null | undefined,
    reason: string,
    fallbackProvider: string,
    fallbackModel: string | undefined,
    isProviderUsable: (name: string) => boolean,
  ): LlmRoleResolveResult {
    const providerName = ProviderFactory.normalizeProviderName(binding?.provider || fallbackProvider || '');
    const modelName = String(binding?.model || fallbackModel || '').trim() || undefined;
    if (providerName && !isProviderUsable(providerName)) {
      return {
        role: 'default',
        providerName: ProviderFactory.normalizeProviderName(fallbackProvider),
        modelName: fallbackModel,
        reason: `${reason}_provider_unusable_fallback`,
        binding: null,
      };
    }
    return {
      role,
      providerName: providerName || ProviderFactory.normalizeProviderName(fallbackProvider),
      modelName,
      reason,
      binding: binding || null,
    };
  }

  private taskStrongBinding(cfg: LlmRoleRoutingConfig, taskKind: string): LlmRoleBinding | null {
    const kind = String(taskKind || '').toLowerCase();
    if (kind === 'code' || kind === 'coding') {
      return cfg.taskStrong?.code || null;
    }
    if (kind === 'research') {
      return cfg.taskStrong?.research || null;
    }
    return null;
  }

  private countMultiModelFamilies(usable: { family: string }[]): number {
    const map = new Map<string, number>();
    for (const entry of usable) {
      map.set(entry.family, (map.get(entry.family) || 0) + 1);
    }
    return Array.from(map.values()).filter((count) => count >= 2).length;
  }

  private hasRepeatedFamilySwitch(events: LlmRoleRoutingConfig['modelSwitchEvents']): boolean {
    if (events.length < 2) return false;
    const byFamily = new Map<string, Set<string>>();
    for (const event of events) {
      const set = byFamily.get(event.family) || new Set<string>();
      set.add(event.model);
      byFamily.set(event.family, set);
    }
    return Array.from(byFamily.values()).some((set) => set.size >= 2);
  }
}

export function formatRoleTelemetry(result: LlmRoleResolveResult): string {
  return `role=${result.role} provider=${result.providerName} model=${result.modelName || '(default)'} reason=${result.reason}`;
}
