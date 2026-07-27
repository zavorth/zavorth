/**
 * F0 — Multi-surface projection baseline / non-regression goldens.
 *
 * Invariants that F1–F2 (and later phases) must never break:
 * - Same permission semantic card works on every built-in channel
 * - Four choices always present (once|session|always|deny)
 * - Deny never dropped in actions or text fallback
 * - Telegram callback_data ≤ 64 bytes
 * - Native buttons only where affordances allow
 * - No Telegram privileging in the profile registry (builtins are preset-driven)
 */

import {
  listSurfaceProfiles,
  resolveSurfaceProfileForChannel,
  isAffordanceEnabled,
  SURFACE_AFFORDANCE_CONTRACT_VERSION,
  type SurfaceChannelId,
} from '../../../src/domain/surface/application/surface-affordance/index.js';
import {
  projectSemanticCard,
  SEMANTIC_CARD_CONTRACT_VERSION,
} from '../../../src/domain/surface/application/surface-projection/index.js';
import {
  buildAgentPermissionCallbackData,
  buildAgentPermissionSemanticCard,
  parseAgentPermissionTaskCallback,
  renderAgentPermissionApprovalForSurface,
} from '../../../src/services/permission/AgentPermissionApprovalPresentation.js';
import { renderSurfaceResponseForTarget } from '../../../src/domain/surface/application/surface-response/index.js';
import type { SurfaceRenderTarget } from '../../../src/domain/surface/application/surface-response/SurfaceResponseContract.js';

const TASK_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const RENDER_TARGETS: SurfaceRenderTarget[] = [
  'telegram',
  'discord',
  'cli',
  'plain',
  'web',
  'slack',
  'signal',
  'whatsapp',
  'imessage',
];

const REQUIRED_CHOICES = ['once', 'session', 'always', 'deny'] as const;

describe('SurfaceProjectionBaseline (F0 goldens)', () => {
  const card = buildAgentPermissionSemanticCard({
    approvalId: TASK_ID,
    title: 'Approval needed',
    summary: 'Run shell command-',
    riskLabel: 'high',
  });

  it('semantic card contract version and four permission options', () => {
    expect(card.version).toBe(SEMANTIC_CARD_CONTRACT_VERSION);
    expect(card.intent).toBe('approval');
    const choice = card.controls.find((c) => c.kind === 'choice_group');
    expect(choice?.kind).toBe('choice_group');
    if (choice?.kind === 'choice_group') {
      expect(choice.options).toHaveLength(4);
      const labels = choice.options.map((o) => o.label.toLowerCase());
      expect(labels.some((l) => l.includes('once'))).toBe(true);
      expect(labels.some((l) => l.includes('session'))).toBe(true);
      expect(labels.some((l) => l.includes('always'))).toBe(true);
      expect(labels.some((l) => l.includes('deny'))).toBe(true);
    }
  });

  it('callback data under Telegram 64-byte limit for all choices', () => {
    for (const choice of REQUIRED_CHOICES) {
      const data = buildAgentPermissionCallbackData(choice, TASK_ID);
      expect(data.length).toBeLessThanOrEqual(64);
      expect(parseAgentPermissionTaskCallback(data)?.choice).toBe(choice);
    }
    // legacy mapping
    expect(parseAgentPermissionTaskCallback(`task:approve:${TASK_ID}`)?.choice).toBe('once');
    expect(parseAgentPermissionTaskCallback(`task:reject:${TASK_ID}`)?.choice).toBe('deny');
  });

  it('every built-in channel projects the same permission card without dropping deny', () => {
    const profiles = listSurfaceProfiles().filter((p) => p.id !== 'rich-select');
    expect(profiles.length).toBeGreaterThanOrEqual(10);

    for (const profile of profiles) {
      expect(profile.contractVersion).toBe(SURFACE_AFFORDANCE_CONTRACT_VERSION);
      const projected = projectSemanticCard(card, profile);

      expect(projected.actions.length).toBeGreaterThanOrEqual(4);
      const deny = projected.actions.find(
        (a) => a.id.includes('deny') || /deny/i.test(a.label),
      );
      expect(deny).toBeDefined();
      expect(deny?.callbackData || deny?.command).toBeTruthy();

      for (const choice of REQUIRED_CHOICES) {
        const hit = projected.actions.find(
          (a) =>
            a.id.includes(choice) ||
            (a.callbackData || '').includes(`:${choice}:`) ||
            (a.command || '').includes(choice) ||
            (choice === 'deny' && /reject/i.test(a.command || '')),
        );
        expect(hit).toBeDefined();
      }

      // voice_reply is optional affordance (on for interactive/rich, off for text-first)
      if (profile.preset === 'chat-interactive' || profile.preset === 'rich-app') {
        expect(isAffordanceEnabled(profile, 'voice_reply')).toBe(true);
      } else {
        expect(isAffordanceEnabled(profile, 'voice_reply')).toBe(false);
      }
    }
  });

  it('telegram/discord use native buttons; text-first channels do not', () => {
    const telegram = projectSemanticCard(card, resolveSurfaceProfileForChannel('telegram'));
    const discord = projectSemanticCard(card, resolveSurfaceProfileForChannel('discord'));
    const cli = projectSemanticCard(card, resolveSurfaceProfileForChannel('cli'));
    const signal = projectSemanticCard(card, resolveSurfaceProfileForChannel('signal'));
    const whatsapp = projectSemanticCard(card, resolveSurfaceProfileForChannel('whatsapp'));

    expect(telegram.usedNativeButtons).toBe(true);
    expect(discord.usedNativeButtons).toBe(true);
    expect(cli.usedNativeButtons).toBe(false);
    expect(signal.usedNativeButtons).toBe(false);
    expect(whatsapp.usedNativeButtons).toBe(false);

    expect(cli.text).toMatch(/\/approve/);
    expect(signal.text).toMatch(/\/approve/);
  });

  it('renderSurfaceResponseForTarget goldens: telegram keyboard vs cli text', () => {
    for (const target of RENDER_TARGETS) {
      const { response, rendered, projected } = renderAgentPermissionApprovalForSurface(
        target,
        {
          approvalId: TASK_ID,
          title: 'Approval needed',
          summary: 'Run shell-',
          riskLabel: 'high',
        },
      );

      expect(response.intent).toBe('approval');
      expect(response.actions?.length).toBeGreaterThanOrEqual(4);
      expect(rendered.text.length).toBeGreaterThan(0);
      expect(projected.actions.length).toBeGreaterThanOrEqual(4);

      if (target === 'telegram') {
        const kb = (rendered.native as { replyMarkup-: { inline_keyboard-: unknown[][] } } | null)
          ....replyMarkup?.inline_keyboard;
        expect(Array.isArray(kb) && kb.length > 0).toBe(true);
        const flat = kb!.flat() as Array<{ callback_data-: string; text-: string }>;
        expect(flat.some((b) => (b.callback_data || '').includes('once'))).toBe(true);
        expect(flat.some((b) => (b.callback_data || '').includes('deny'))).toBe(true);
        for (const btn of flat) {
          if (btn.callback_data) {
            expect(btn.callback_data.length).toBeLessThanOrEqual(64);
          }
        }
      }

      if (target === 'discord') {
        const components = (rendered.native as { components-: unknown[] } | null)?.components;
        expect(Array.isArray(components) && components.length > 0).toBe(true);
      }

      if (target === 'cli' || target === 'plain' || target === 'signal') {
        expect(rendered.native).toBeNull();
        expect(rendered.text).toMatch(/\/approve/);
      }
    }
  });

  it('no telegram privileging: builtins use presets, not a telegram-only path', () => {
    const telegram = resolveSurfaceProfileForChannel('telegram');
    const discord = resolveSurfaceProfileForChannel('discord');
    expect(telegram.preset).toBe('chat-interactive');
    expect(discord.preset).toBe('chat-interactive');
    // Same semantic card projects for both; only profile limits differ
    const pt = projectSemanticCard(card, telegram);
    const pd = projectSemanticCard(card, discord);
    expect(pt.usedNativeButtons).toBe(true);
    expect(pd.usedNativeButtons).toBe(true);
    expect(pt.actions.map((a) => a.id).sort()).toEqual(pd.actions.map((a) => a.id).sort());
  });

  it('channel presets matrix (documented baseline)', () => {
    const expected: Record<string, string> = {
      telegram: 'chat-interactive',
      discord: 'chat-interactive',
      whatsapp: 'chat-basic',
      signal: 'chat-basic',
      imessage: 'chat-basic',
      cli: 'cli',
      web: 'rich-app',
      desktop: 'rich-app',
      slack: 'chat-basic',
      plain: 'chat-basic',
    };
    for (const [channel, preset] of Object.entries(expected)) {
      const profile = resolveSurfaceProfileForChannel(channel as SurfaceChannelId);
      expect(profile.preset).toBe(preset);
    }
  });

  it('legacy SurfaceResponse path still renders when no profile is forced', () => {
    // Direct renderer without projection metadata still works for any SurfaceResponse-like approval
    const { response } = renderAgentPermissionApprovalForSurface('telegram', {
      approvalId: TASK_ID,
    });
    const again = renderSurfaceResponseForTarget('telegram', response, { maxActionsPerRow: 2 });
    expect(again.native).toBeTruthy();
    expect(
      (again.native as { replyMarkup-: { inline_keyboard-: unknown[] } }).replyMarkup
        ....inline_keyboard?.length,
    ).toBeGreaterThan(0);
  });
});
