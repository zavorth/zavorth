import {
  formatRoleSurfaceLabel,
  normalizeRoleSurface,
  resolveLlmRoleScopeId,
  type LlmRoleBinding,
  type LlmRoleName,
} from '../../contracts/runtime/LlmRoleRoutingContract.js';
import { ProviderFactory } from '../../providers/ProviderFactory.js';
import { LlmRoleRoutingService } from './LlmRoleRoutingService.js';

export type LlmRoleSurfaceCommandContext = {
  userId?: string | null;
  /** Active surface for this turn — any current or future channel id. */
  surface?: string | null;
  roleScopeId?: string | null;
  isProviderUsable: (name: string) => boolean;
  defaultModelForProvider?: (provider: string) => string;
  resolveSelection?: (target: string) => {
    effectiveProviderName?: string | null;
    modelName?: string | null;
    replyLabel?: string | null;
    selectionKind?: string | null;
  } | null;
  usageTargets?: () => string[];
};

/**
 * Surface-agnostic role slash/text command helpers.
 * Any gateway (Telegram, Discord, WhatsApp, desktop, CLI, future) can call these
 * and deliver the returned text on its own transport.
 */
export class LlmRoleSurfaceCommands {
  constructor(private readonly roles = new LlmRoleRoutingService()) {}

  public resolveScope(ctx: LlmRoleSurfaceCommandContext): string {
    if (ctx.roleScopeId && String(ctx.roleScopeId).trim()) {
      return String(ctx.roleScopeId).trim();
    }
    return resolveLlmRoleScopeId({
      userId: ctx.userId,
      surface: normalizeRoleSurface(ctx.surface),
    });
  }

  public formatStatus(ctx: LlmRoleSurfaceCommandContext): string {
    const scopeId = this.resolveScope(ctx);
    const cfg = this.roles.getConfig(scopeId);
    const health = this.roles.healthCheck(scopeId, ctx.isProviderUsable);
    const base = this.roles.formatStatusText(cfg);
    const surface = formatRoleSurfaceLabel(ctx.surface);
    const healthLines = health.length
      ? ['', 'Health:', ...health.map((issue) => `- ${issue.severity}: ${issue.message}`)]
      : [];
    return [
      base,
      `surface: ${surface}`,
      `scope: ${scopeId}`,
      `telemetry: default=${cfg.telemetry.turnsDefault} strong=${cfg.telemetry.turnsStrong} prompts=${cfg.telemetry.setupPromptsShown} completed=${cfg.telemetry.setupCompleted}`,
      ...healthLines,
      '',
      'Commands: /model setup | /model default <provider/model> | /model strong <provider/model> | /strong on|off',
    ].join('\n');
  }

  public promptSetup(
    ctx: LlmRoleSurfaceCommandContext,
    force = false,
  ): {
    shouldPrompt: boolean;
    reason: string;
    text: string | null;
  } {
    const scopeId = this.resolveScope(ctx);
    const surface = normalizeRoleSurface(ctx.surface);
    const decision = this.roles.shouldPromptSetup(scopeId, ctx.isProviderUsable, {
      force,
      calmTurn: true,
      surface,
    });
    if (!decision.shouldPrompt && !force) {
      return { shouldPrompt: false, reason: decision.reason, text: null };
    }
    const text = this.roles.buildSurfaceSetupPrompt(scopeId, surface, ctx.isProviderUsable);
    return { shouldPrompt: true, reason: decision.reason, text };
  }

  public setForceStrong(ctx: LlmRoleSurfaceCommandContext, enabled: boolean): string {
    const scopeId = this.resolveScope(ctx);
    const cfg = this.roles.getConfig(scopeId);
    if (enabled && !cfg.strong && !cfg.default) {
      return 'No strong role configured yet. Use /model setup or /model strong <provider/model>.';
    }
    this.roles.setForceStrong(scopeId, enabled);
    if (!enabled) {
      return 'Back to the default role for upcoming turns.';
    }
    const binding = cfg.strong || cfg.default;
    return `Strong role active for upcoming turns: ${binding?.provider || 'default'}/${binding?.model || ''}. Use /strong off to stop.`;
  }

  public assignRole(
    ctx: LlmRoleSurfaceCommandContext,
    role: LlmRoleName,
    target: string,
  ): { ok: boolean; text: string; needsConfirmation?: boolean } {
    const scopeId = this.resolveScope(ctx);
    const rawTarget = String(target || '').trim();
    if (!rawTarget) {
      return { ok: false, text: `Usage: /model ${role} <provider|model>` };
    }

    const selection = ctx.resolveSelection?.(rawTarget) || null;
    const provider =
      selection?.effectiveProviderName || ProviderFactory.normalizeProviderName(rawTarget.split(/[/\s]/)[0] || '');
    const model =
      selection?.modelName ||
      rawTarget.split(/[/\s]/).slice(1).join(' ') ||
      ctx.defaultModelForProvider?.(provider) ||
      '';

    const resolved = this.roles.resolveBindingHint(
      provider,
      model,
      ctx.isProviderUsable,
      role === 'strong' ? 'strong' : role === 'background' ? 'fast' : 'balanced',
    );

    if (!resolved.binding && resolved.nearest) {
      const cfg = this.roles.getConfig(scopeId);
      const proposed = {
        default: role === 'default' ? resolved.nearest : cfg.default,
        strong: role === 'strong' ? resolved.nearest : cfg.strong,
        background: role === 'background' ? resolved.nearest : cfg.background,
      };
      this.roles.setPendingConfirmation(scopeId, 'nearest_match', proposed, rawTarget);
      return {
        ok: true,
        needsConfirmation: true,
        text: [
          'I could not match your wording exactly. Closest available:',
          `- default: \`${proposed.default ? `${proposed.default.provider}/${proposed.default.model}` : '—'}\``,
          `- strong: \`${proposed.strong ? `${proposed.strong.provider}/${proposed.strong.model}` : '—'}\``,
          'Reply yes to confirm or no to cancel.',
        ].join('\n'),
      };
    }

    if (!resolved.binding) {
      const targets = ctx.usageTargets?.() || [];
      return {
        ok: false,
        text: `I did not recognize this provider/model: ${rawTarget}.${targets.length ? ` Try: ${targets.join(', ')}` : ''}`,
      };
    }

    const patch: {
      default?: LlmRoleBinding | null;
      strong?: LlmRoleBinding | null;
      background?: LlmRoleBinding | null;
      source: 'slash';
    } = { source: 'slash' };
    patch[role] = resolved.binding;
    this.roles.setRoles(scopeId, patch);
    this.roles.recordModelSwitch(
      scopeId,
      resolved.binding.provider,
      resolved.binding.model,
      normalizeRoleSurface(ctx.surface),
    );
    return { ok: true, text: this.formatStatus(ctx) };
  }

  /**
   * Parse deterministic slash body after `/model` (shared by any surface).
   * Free-text natural-language setup remains on ConversationalAgent.
   */
  public handleModelArgs(
    ctx: LlmRoleSurfaceCommandContext,
    args: string,
  ): {
    handled: boolean;
    text: string | null;
  } {
    const raw = String(args || '').trim();
    const lower = raw.toLowerCase();

    if (!raw || lower === 'status' || lower === 'show') {
      return { handled: true, text: this.formatStatus(ctx) };
    }
    if (lower === 'setup' || lower === 'roles') {
      const prompt = this.promptSetup(ctx, true);
      return { handled: true, text: prompt.text || this.formatStatus(ctx) };
    }
    if (lower.startsWith('default ') || lower.startsWith('strong ') || lower.startsWith('background ')) {
      const role = lower.split(/\s+/)[0] as LlmRoleName;
      const target = raw.slice(role.length).trim();
      const result = this.assignRole(ctx, role, target);
      return { handled: true, text: result.text };
    }
    if (lower === 'clear strong' || lower === 'clearstrong') {
      const scopeId = this.resolveScope(ctx);
      const cfg = this.roles.getConfig(scopeId);
      this.roles.setRoles(scopeId, { strong: cfg.default, source: 'slash' });
      return { handled: true, text: 'Strong role now mirrors the default role.' };
    }
    if (lower === 'fallback on' || lower === 'strong-on-fail on') {
      this.roles.setRoles(this.resolveScope(ctx), { strongOnDefaultFailure: true, source: 'slash' });
      return {
        handled: true,
        text: 'If the default model fails (rate limit/outage), Zavorth may use the strong role.',
      };
    }
    if (lower === 'fallback off' || lower === 'strong-on-fail off') {
      this.roles.setRoles(this.resolveScope(ctx), { strongOnDefaultFailure: false, source: 'slash' });
      return { handled: true, text: 'Strong-on-failure fallback disabled.' };
    }
    return { handled: false, text: null };
  }
}
