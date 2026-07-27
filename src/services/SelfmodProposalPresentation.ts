/**
 * Selfmod proposal-time card — surface-agnostic.
 * Buttons when SurfaceProfile has inline_buttons; else slash apply/reject hints.
 * Prefer short slash paths — never tell users to free-text "Approve".
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

export type SelfmodProposalCardInput = {
  previewId: string;
  summary?: string | null;
  relativePath?: string | null;
  mode?: 'file' | 'goal' | string | null;
  changeCount?: number | null;
  resourceImpact?: string | null;
  diffSummary?: string | null;
  success?: boolean;
  channel?: string | null;
};

export type SelfmodProposalPresentation = {
  text: string;
  surfaceResponse: SurfaceResponse;
  usedNativeButtons: boolean;
};

function channelOf(input: SelfmodProposalCardInput): string {
  return (
    String(input.channel || 'plain')
      .trim()
      .toLowerCase() || 'plain'
  );
}

function shortPreviewRef(previewId: string): string {
  const id = String(previewId || '').trim();
  if (!id) return 'n/a';
  if (id.length <= 12) return id;
  return id.slice(0, 8);
}

/**
 * Build a selfmod preview proposal card at creation/show time.
 * Apply uses the full preview id in the slash command (apply needs the real id);
 * primary UX is still buttons when the surface supports them.
 */
export function buildSelfmodProposalPendingCard(input: SelfmodProposalCardInput): SelfmodProposalPresentation {
  const ch = channelOf(input);
  const profile = resolveSurfaceProfileForChannel(ch);
  const buttons = isAffordanceEnabled(profile, 'inline_buttons');
  const previewId = String(input.previewId || '').trim();
  const shortId = shortPreviewRef(previewId);
  const applyCmd = previewId ? `/selfmod apply ${previewId}` : '/selfmod';
  const mode = String(input.mode || 'file').trim() || 'file';
  const success = input.success !== false;

  const body = [
    success ? 'Selfmod proposal ready' : 'Selfmod proposal blocked',
    '',
    String(input.summary || '').trim() || null,
    previewId ? `Preview ref: ${shortId}` : null,
    input.relativePath ? `File: ${input.relativePath}` : null,
    mode === 'goal' && input.changeCount ? `Planned changes: ${input.changeCount}` : null,
    input.resourceImpact ? `Impact: ${input.resourceImpact}` : null,
    input.diffSummary ? ['', 'Diff summary:', String(input.diffSummary).slice(0, 800)].join('\n') : null,
    '',
    !success ? 'Fix the blocker, then re-run /selfmod preview or /selfmod goal.'
      : buttons ? 'Use the buttons below (or /selfmod apply · /selfmod — no free-text "Approve").'
        : [
            'This surface has no clickable buttons. Reply with:',
            `  ${applyCmd}`,
            '  (or ignore to leave the preview unused)',
          ].join('\n'),
  ]
    .filter((line) => line !== null && line !== undefined)
    .join('\n');

  // Slash-command callbacks route via SharedSurfaceCallbackCommandPolicy.
  // selfmod:apply: prefix also handled by GatewayCallbackRouter as a belt-and-suspenders path.
  const actions: SurfaceResponseAction[] =
    buttons && success && previewId
      ? [
          {
            id: `selfmod-apply-${shortId}`,
            label: '✓ Apply',
            kind: 'command',
            style: 'success',
            command: applyCmd,
            callbackData: applyCmd.slice(0, 64),
          },
          {
            id: `selfmod-reject-${shortId}`,
            label: '✗ Reject',
            kind: 'command',
            style: 'danger',
            command: '/selfmod',
            callbackData: '/selfmod',
          },
        ]
      : [];

  const surfaceResponse: SurfaceResponse = {
    version: SURFACE_RESPONSE_CONTRACT_VERSION,
    id: `selfmod-proposal:${shortId}`,
    intent: 'approval',
    title: 'Selfmod proposal',
    summary: String(input.summary || shortId).slice(0, 120),
    tone: success ? 'warning' : 'danger',
    blocks: [
      { kind: 'text', text: body },
      ...(actions.length ? [{ kind: 'actions' as const, title: 'Decide', actions }] : []),
    ],
    actions,
    metadata: {
      selfmodProposalCard: true,
      usedNativeButtons: buttons && actions.length > 0,
      previewId,
      shortId,
      mode,
      profileId: profile.id,
    },
  };

  return {
    text: body,
    surfaceResponse,
    usedNativeButtons: Boolean(buttons && actions.length > 0),
  };
}
