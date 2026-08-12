import {
  pickFirstEnabled,
  projectSemanticCard,
  projectSemanticCardForChannel,
  resolveProjectionMode,
  SEMANTIC_CARD_CONTRACT_VERSION,
  type SemanticCard,
} from '../../../src/domain/surface/application/surface-projection/index.js';
import {
  CLI_SURFACE_PROFILE,
  DISCORD_SURFACE_PROFILE,
  RICH_SELECT_SURFACE_PROFILE,
  SIGNAL_SURFACE_PROFILE,
  TELEGRAM_SURFACE_PROFILE,
  resolveSurfaceProfileForChannel,
} from '../../../src/domain/surface/application/surface-affordance/index.js';
import {
  buildAgentPermissionSemanticCard,
  buildAgentPermissionCallbackData,
  renderAgentPermissionApprovalForProfile,
  renderAgentPermissionApprovalForSurface,
} from '../../../src/services/permission/AgentPermissionApprovalPresentation.js';

describe('SurfaceProjectionPolicy / projectSemanticCard (F2)', () => {
  const taskId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  function permissionCard(): SemanticCard {
    return buildAgentPermissionSemanticCard({
      approvalId: taskId,
      title: 'Approval needed',
      summary: 'Run shell?',
      riskLabel: 'high',
    });
  }

  it('permission card + telegram profile → usedNativeButtons true, 4 actions, callbacks once/session/always/deny', () => {
    const card = permissionCard();
    const projected = projectSemanticCard(card, TELEGRAM_SURFACE_PROFILE);

    expect(projected.usedNativeButtons).toBe(true);
    expect(projected.actions).toHaveLength(4);
    expect(projected.profileId).toBe('telegram');

    const callbacks = projected.actions.map((a) => a.callbackData || '');
    expect(callbacks.some((c) => c.includes(':once:'))).toBe(true);
    expect(callbacks.some((c) => c.includes(':session:'))).toBe(true);
    expect(callbacks.some((c) => c.includes(':always:'))).toBe(true);
    expect(callbacks.some((c) => c.includes(':deny:'))).toBe(true);

    const choiceProj = projected.projection.find((p) => p.controlId === 'agent-permission-choices');
    expect(choiceProj?.mode).toBe('inline_buttons');
  });

  it('permission card + signal/cli profile → usedNativeButtons false, text contains /approve and once', () => {
    for (const profile of [SIGNAL_SURFACE_PROFILE, CLI_SURFACE_PROFILE]) {
      const projected = projectSemanticCard(permissionCard(), profile);
      expect(projected.usedNativeButtons).toBe(false);
      expect(projected.text).toMatch(/\/approve/);
      expect(projected.text).toMatch(/once/i);
      // Actions still present for web/desktop consumers
      expect(projected.actions.length).toBeGreaterThanOrEqual(4);
      expect(projected.actions.some((a) => /deny/i.test(a.label) || a.id.includes('deny'))).toBe(
        true,
      );
    }
  });

  it('deny option never missing', () => {
    for (const profile of [
      TELEGRAM_SURFACE_PROFILE,
      CLI_SURFACE_PROFILE,
      SIGNAL_SURFACE_PROFILE,
      DISCORD_SURFACE_PROFILE,
    ]) {
      const projected = projectSemanticCard(permissionCard(), profile);
      const denyAction = projected.actions.find(
        (a) => a.id.includes('deny') || /deny/i.test(a.label),
      );
      expect(denyAction).toBeDefined();
      expect(denyAction?.callbackData).toContain(':deny:');
      // Text path also keeps deny via slash or label somewhere when not pure native-only
      if (!projected.usedNativeButtons) {
        expect(
          projected.text.toLowerCase().includes('deny') ||
            projected.text.includes('/reject') ||
            projected.actions.some((a) => a.id.includes('deny')),
        ).toBe(true);
      }
    }
  });

  it('choice_group >4 with select_menu profile prefers select_menu mode in projection trace', () => {
    const card: SemanticCard = {
      version: SEMANTIC_CARD_CONTRACT_VERSION,
      id: 'many-options',
      intent: 'configuration',
      title: 'Pick a model',
      controls: [
        {
          kind: 'choice_group',
          id: 'models',
          purpose: 'configuration',
          options: [
            { id: 'm1', label: 'One', command: '/model 1' },
            { id: 'm2', label: 'Two', command: '/model 2' },
            { id: 'm3', label: 'Three', command: '/model 3' },
            { id: 'm4', label: 'Four', command: '/model 4' },
            { id: 'm5', label: 'Five', command: '/model 5' },
          ],
        },
      ],
    };

    const mode = resolveProjectionMode(card.controls[0], RICH_SELECT_SURFACE_PROFILE);
    expect(mode).toBe('select_menu');

    const projected = projectSemanticCard(card, RICH_SELECT_SURFACE_PROFILE);
    expect(projected.projection.find((p) => p.controlId === 'models')?.mode).toBe('select_menu');
    expect(projected.actions).toHaveLength(5);
    expect(projected.usedNativeButtons).toBe(true);
  });

  it("projectSemanticCardForChannel('telegram') works", () => {
    const projected = projectSemanticCardForChannel(permissionCard(), 'telegram');
    expect(projected.usedNativeButtons).toBe(true);
    expect(projected.profileId).toBe('telegram');
    expect(projected.surfaceResponse.intent).toBe('approval');
    expect(projected.surfaceResponse.actions?.length).toBe(4);
  });

  it('callback data length ≤64 for uuid-like ids', () => {
    for (const choice of ['once', 'session', 'always', 'deny'] as const) {
      const data = buildAgentPermissionCallbackData(choice, taskId);
      expect(data.length).toBeLessThanOrEqual(64);
      expect(data).toBe(`task:${choice}:${taskId}`);
    }
    const projected = projectSemanticCard(permissionCard(), TELEGRAM_SURFACE_PROFILE);
    for (const action of projected.actions) {
      expect(String(action.callbackData || '').length).toBeLessThanOrEqual(64);
    }
  });

  it('pickFirstEnabled respects affordance flags', () => {
    expect(
      pickFirstEnabled(TELEGRAM_SURFACE_PROFILE, ['select_menu', 'inline_buttons', 'slash_commands']),
    ).toBe('inline_buttons');
    expect(
      pickFirstEnabled(CLI_SURFACE_PROFILE, ['inline_buttons', 'select_menu', 'slash_commands']),
    ).toBe('slash_commands');
    expect(pickFirstEnabled(CLI_SURFACE_PROFILE, ['inline_buttons', 'select_menu'])).toBeNull();
  });

  it('renderAgentPermissionApprovalForProfile / ForSurface keep callbacks stable', () => {
    const { projected, response, rendered } = renderAgentPermissionApprovalForProfile(
      TELEGRAM_SURFACE_PROFILE,
      { approvalId: taskId, title: 'Approval needed' },
    );
    expect(projected.usedNativeButtons).toBe(true);
    expect(response.metadata?.semanticCard).toBeDefined();
    expect(response.metadata?.projection).toBeDefined();
    expect(rendered.native).toBeTruthy();

    const surface = renderAgentPermissionApprovalForSurface('cli', {
      approvalId: taskId,
      title: 'Approval needed',
    });
    expect(surface.projected.usedNativeButtons).toBe(false);
    expect(surface.rendered.text).toMatch(/\/approve/);
    expect(surface.response.actions?.some((a) => a.callbackData?.includes('task:once:'))).toBe(
      true,
    );
  });

  it('resolveSurfaceProfileForChannel aliases work', () => {
    expect(resolveSurfaceProfileForChannel('tg').id).toBe('telegram');
    expect(resolveSurfaceProfileForChannel('terminal').id).toBe('cli');
  });
});
