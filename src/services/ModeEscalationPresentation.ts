/**
 * Mode-escalation pending card — surface-agnostic.
 * Buttons when SurfaceProfile has inline_buttons; else slash ordinals.
 */

import {
  SURFACE_RESPONSE_CONTRACT_VERSION,
  type SurfaceResponse,
  type SurfaceResponseAction,
} from '../domain/surface/application/surface-response/SurfaceResponseContract.js';
import {
  isAffordanceEnabled,
  resolveSurfaceProfileForChannel,
} from '../domain/surface/application/surface-affordance/index.js';
import type { ModeEscalationRequest } from '../contracts/ModeEscalationContract.js';

export type ModeEscalationCardInput = {
  request: Pick<
    ModeEscalationRequest,
    'id' | 'summary' | 'recommendedScope' | 'fallback' | 'reasons' | 'requiredMode' | 'effectiveMode'
  >;
  channel?: string | null;
};

export type ModeEscalationPresentation = {
  text: string;
  surfaceResponse: SurfaceResponse;
  usedNativeButtons: boolean;
};

function channelOf(input: ModeEscalationCardInput): string {
  return (
    String(input.channel || 'plain')
      .trim()
      .toLowerCase() || 'plain'
  );
}

/**
 * Build a pending mode-escalation card.
 * Commands use bare /mode approve [scope] — no long request id.
 */
export function buildModeEscalationPendingCard(input: ModeEscalationCardInput): ModeEscalationPresentation {
  const ch = channelOf(input);
  const profile = resolveSurfaceProfileForChannel(ch);
  const buttons = isAffordanceEnabled(profile, 'inline_buttons');
  const req = input.request;
  const fromMode = String(req.effectiveMode?.id || req.effectiveMode || 'current');
  const toMode = String(req.requiredMode?.id || req.requiredMode || 'elevated');
  const scope = String(req.recommendedScope || 'once');
  const reasons = (req.reasons || []).slice(0, 4).map((r) => `• ${r}`);

  const body = [
    'Mode escalation needed',
    '',
    `From: ${fromMode}  →  To: ${toMode}`,
    String(req.summary || '').trim(),
    '',
    ...(reasons.length ? ['Why:', ...reasons, ''] : []),
    `Suggested scope: ${scope}`,
    req.fallback ? `Light fallback: ${req.fallback}` : null,
    '',
    buttons ? 'Use the buttons below (or /mode approve · /mode reject).'
      : 'This surface has no clickable buttons. Reply with:\n  /mode approve\n  /mode approve once|session|host\n  /mode reject',
  ]
    .filter((line) => line !== null)
    .join('\n');

  const actions: SurfaceResponseAction[] = buttons
    ? [
        {
          id: 'mode-approve-once',
          label: '✓ Once',
          kind: 'command',
          style: 'success',
          command: '/mode approve once',
          callbackData: '/mode approve once',
        },
        {
          id: 'mode-approve-session',
          label: '✓ Session',
          kind: 'command',
          style: 'primary',
          command: '/mode approve session',
          callbackData: '/mode approve session',
        },
        {
          id: 'mode-approve-host',
          label: '✓ Host',
          kind: 'command',
          style: 'secondary',
          command: '/mode approve host',
          callbackData: '/mode approve host',
        },
        {
          id: 'mode-reject',
          label: '✗ Reject',
          kind: 'command',
          style: 'danger',
          command: '/mode reject',
          callbackData: '/mode reject',
        },
      ]
    : [];

  const surfaceResponse: SurfaceResponse = {
    version: SURFACE_RESPONSE_CONTRACT_VERSION,
    id: `mode-escalation:${String(req.id || 'pending').slice(0, 48)}`,
    intent: 'approval',
    title: 'Mode escalation',
    summary: `${fromMode} → ${toMode}`,
    tone: 'warning',
    blocks: [
      { kind: 'text', text: body },
      ...(actions.length ? [{ kind: 'actions' as const, title: 'Decide', actions }] : []),
    ],
    actions,
    metadata: {
      modeEscalationCard: true,
      usedNativeButtons: buttons && actions.length > 0,
      requestId: req.id,
      recommendedScope: scope,
      profileId: profile.id,
    },
  };

  return {
    text: body,
    surfaceResponse,
    usedNativeButtons: Boolean(buttons && actions.length > 0),
  };
}
