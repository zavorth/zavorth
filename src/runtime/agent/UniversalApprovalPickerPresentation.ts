/**
 * Pending approval presentation — surface-agnostic.
 *
 * Uses SurfaceProfile + inline_buttons affordance detection (not hard-coded
 * Telegram/Desktop). Surfaces with buttons get Approve/Reject controls;
 * others get slash-command fallback text (/approve, /reject, or /approve N).
 */

import {
  SURFACE_RESPONSE_CONTRACT_VERSION,
  type SurfaceResponse,
  type SurfaceResponseAction,
  type SurfaceRenderTarget,
} from '../../domain/surface/application/surface-response/SurfaceResponseContract.js';
import { renderSurfaceResponseForTarget } from '../../domain/surface/application/surface-response/SurfaceResponseRenderers.js';
import {
  isAffordanceEnabled,
  resolveSurfaceProfileForChannel,
  type SurfaceProfile,
} from '../../domain/surface/application/surface-affordance/index.js';
import {
  projectSemanticCard,
  SEMANTIC_CARD_CONTRACT_VERSION,
  type SemanticCard,
  type ProjectedSurfaceMessage,
} from '../../domain/surface/application/surface-projection/index.js';
import type {
  UniversalApprovalIntentCandidate,
  UniversalApprovalIntentDecisionResult,
  UniversalApprovalIntentResolution,
} from './UniversalApprovalIntentResolver.js';
import { renderUniversalApprovalIntentDecisionResult } from './UniversalApprovalIntentResolver.js';
import type { UniversalAgentRunResult, UniversalApprovalRequest } from './UniversalAgentRuntimeTypes.js';

const MAX_PICKER_ITEMS = 8;

export type SingleApprovalBuildResult = {
  response: SurfaceResponse;
  projected: ProjectedSurfaceMessage;
  usedNativeButtons: boolean;
};

function mapChannelToRenderTarget(channel: string, profile: SurfaceProfile): SurfaceRenderTarget {
  if (profile.renderTarget) return profile.renderTarget;
  const c = String(channel || 'plain').toLowerCase();
  const known: SurfaceRenderTarget[] = [
    'plain',
    'cli',
    'telegram',
    'discord',
    'slack',
    'whatsapp',
    'instagram',
    'teams',
    'email',
    'signal',
    'imessage',
    'web',
  ];
  if ((known as string[]).includes(c)) return c as SurfaceRenderTarget;
  if (c === 'desktop' || c === 'zavorthcontrol' || c === 'api') return 'web';
  return 'plain';
}

function shortTitle(title: string, max = 28): string {
  const t = String(title || 'Approval')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function buildCallback(decision: 'approve' | 'reject', approvalId: string): string {
  // Matches UniversalApprovalIntentResolver callback parser:
  // approval:approve:<id> | approval:reject:<id>
  return `approval:${decision}:${String(approvalId).slice(0, 40)}`.slice(0, 64);
}

function mapProjectedActions(projected: ProjectedSurfaceMessage): SurfaceResponseAction[] {
  return projected.actions.map((a) => ({
    id: a.id,
    label: a.label,
    kind: a.kind,
    style: a.style as SurfaceResponseAction['style'],
    command: a.command ?? null,
    callbackData: a.callbackData ?? null,
    href: a.href ?? null,
    description: a.description ?? null,
  }));
}

/**
 * Semantic card: one row of choices per pending approval (Approve + Reject).
 */
export function buildMultiApprovalPickerSemanticCard(
  candidates: UniversalApprovalIntentCandidate[],
  decisionHint: 'approved' | 'rejected' | null,
): SemanticCard {
  const list = candidates.slice(0, MAX_PICKER_ITEMS);
  const preferReject = decisionHint === 'rejected';

  const options = list.flatMap((c, index) => {
    const n = index + 1;
    const title = shortTitle(c.title, 24);
    const approveLabel = `✓ ${n} ${title}`.slice(0, 64);
    const rejectLabel = `✗ ${n}`.slice(0, 64);
    return [
      {
        id: `pick-approve-${n}`,
        label: approveLabel,
        style: 'success' as const,
        callbackData: buildCallback('approve', c.approvalId),
        command: `/approve ${n}`,
        description: c.risk ? `risk=${c.risk}` : null,
      },
      {
        id: `pick-reject-${n}`,
        label: rejectLabel,
        style: 'danger' as const,
        callbackData: buildCallback('reject', c.approvalId),
        command: `/reject ${n}`,
        description: null,
      },
    ];
  });

  const bodyLines = [
    'Several approvals are waiting. Pick one — you do not need a long id.',
    preferReject
      ? 'You asked to reject; choose which item to reject.'
      : 'Choose Approve (✓) or Reject (✗) for the matching item.',
    '',
    ...list.map((c, i) => `${i + 1}. ${shortTitle(c.title, 60)} · risk=${c.risk}`),
  ];

  return {
    version: SEMANTIC_CARD_CONTRACT_VERSION,
    id: `multi-approval-picker:${list
      .map((c) => c.approvalId)
      .join(',')
      .slice(0, 80)}`,
    intent: 'approval',
    title: 'Pick an approval',
    summary: `${list.length} pending`,
    tone: 'warning',
    bodyText: bodyLines.join('\n'),
    controls: [
      {
        kind: 'choice_group',
        id: 'multi-approval-choices',
        purpose: 'approval',
        required: true,
        options,
      },
      {
        kind: 'command_hint',
        id: 'multi-approval-slash',
        commands: list.flatMap((_, i) => {
          const n = i + 1;
          return [`/approve ${n}`, `/reject ${n}`];
        }),
      },
    ],
    metadata: {
      multiApprovalPicker: true,
      candidateCount: list.length,
      surfaceAgnostic: true,
    },
  };
}

export function buildMultiApprovalPickerResponse(
  candidates: UniversalApprovalIntentCandidate[],
  decisionHint: 'approved' | 'rejected' | null,
  profile: SurfaceProfile,
): SingleApprovalBuildResult {
  const semanticCard = buildMultiApprovalPickerSemanticCard(candidates, decisionHint);
  const projected = projectSemanticCard(semanticCard, profile);

  // Prefer projected actions (respects affordance strip). Fallback to explicit callbacks.
  const actions: SurfaceResponseAction[] = projected.actions.length
    ? mapProjectedActions(projected)
    : candidates.slice(0, MAX_PICKER_ITEMS).flatMap((c, index) => {
        const n = index + 1;
        return [
          {
            id: `pick-approve-${n}`,
            label: `✓ ${n} ${shortTitle(c.title, 20)}`.slice(0, 64),
            kind: 'callback' as const,
            style: 'success' as const,
            callbackData: buildCallback('approve', c.approvalId),
            command: `/approve ${n}`,
          },
          {
            id: `pick-reject-${n}`,
            label: `✗ ${n}`,
            kind: 'callback' as const,
            style: 'danger' as const,
            callbackData: buildCallback('reject', c.approvalId),
            command: `/reject ${n}`,
          },
        ];
      });

  // When profile has no inline buttons, keep actions only as slash commands in text.
  const buttonsEnabled = isAffordanceEnabled(profile, 'inline_buttons');
  const surfaceActions = buttonsEnabled ? actions : [];

  const slashLines = candidates.slice(0, MAX_PICKER_ITEMS).flatMap((_, i) => {
    const n = i + 1;
    return [`  /approve ${n}`, `  /reject ${n}`];
  });

  const textBody = buttonsEnabled
    ? [semanticCard.bodyText, '', 'Use the buttons below (or /approve N).'].join('\n')
    : [semanticCard.bodyText, '', 'This surface has no clickable buttons. Use short numbers:', ...slashLines].join(
        '\n',
      );

  const response: SurfaceResponse = {
    version: SURFACE_RESPONSE_CONTRACT_VERSION,
    id: semanticCard.id,
    intent: 'approval',
    title: semanticCard.title,
    summary: semanticCard.summary,
    tone: 'warning',
    blocks: [
      { kind: 'text', text: textBody },
      ...(surfaceActions.length ? [{ kind: 'actions' as const, title: 'Pick one', actions: surfaceActions }] : []),
    ],
    actions: surfaceActions,
    metadata: {
      multiApprovalPicker: true,
      usedNativeButtons: buttonsEnabled && surfaceActions.length > 0,
      profileId: profile.id,
      candidateIds: candidates.slice(0, MAX_PICKER_ITEMS).map((c) => c.approvalId),
      semanticCard,
      projection: projected.projection,
    },
  };

  return {
    response,
    projected,
    usedNativeButtons: Boolean(buttonsEnabled && surfaceActions.length > 0),
  };
}

/**
 * Semantic card for a single pending approval (bare /approve + /reject).
 */
export function buildSingleApprovalSemanticCard(
  candidate: UniversalApprovalIntentCandidate,
  decisionHint: 'approved' | 'rejected' | null,
): SemanticCard {
  const title = shortTitle(candidate.title, 48);
  const preferReject = decisionHint === 'rejected';
  const bodyLines = [
    preferReject
      ? 'Reject this pending approval, or approve it if you changed your mind.'
      : 'One approval is waiting. Approve to continue, or reject to stop.',
    '',
    `${title} · risk=${candidate.risk}`,
    // No full UUID in primary body — buttons / bare /approve are enough.
  ];

  return {
    version: SEMANTIC_CARD_CONTRACT_VERSION,
    id: `single-approval:${String(candidate.approvalId).slice(0, 80)}`,
    intent: 'approval',
    title: title || 'Approval required',
    summary: `risk=${candidate.risk}`,
    tone: candidate.risk === 'danger' ? 'danger' : 'warning',
    bodyText: bodyLines.join('\n'),
    controls: [
      {
        kind: 'choice_group',
        id: 'single-approval-choices',
        purpose: 'approval',
        required: true,
        options: [
          {
            id: 'single-approve',
            label: '✓ Approve',
            style: 'success',
            callbackData: buildCallback('approve', candidate.approvalId),
            command: '/approve',
            description: candidate.risk ? `risk=${candidate.risk}` : null,
          },
          {
            id: 'single-reject',
            label: '✗ Reject',
            style: 'danger',
            callbackData: buildCallback('reject', candidate.approvalId),
            command: '/reject',
            description: null,
          },
        ],
      },
      {
        kind: 'command_hint',
        id: 'single-approval-slash',
        commands: ['/approve', '/reject'],
      },
    ],
    metadata: {
      singleApprovalCard: true,
      candidateCount: 1,
      approvalId: candidate.approvalId,
      surfaceAgnostic: true,
    },
  };
}

/**
 * Single-pending approval SurfaceResponse with Approve/Reject when the
 * profile has `inline_buttons`; otherwise slash-command text only.
 */
export function buildSingleApprovalResponse(
  candidate: UniversalApprovalIntentCandidate,
  decisionHint: 'approved' | 'rejected' | null,
  profile: SurfaceProfile,
): SingleApprovalBuildResult {
  const semanticCard = buildSingleApprovalSemanticCard(candidate, decisionHint);
  const projected = projectSemanticCard(semanticCard, profile);

  const fallbackActions: SurfaceResponseAction[] = [
    {
      id: 'single-approve',
      label: '✓ Approve',
      kind: 'callback',
      style: 'success',
      callbackData: buildCallback('approve', candidate.approvalId),
      command: '/approve',
    },
    {
      id: 'single-reject',
      label: '✗ Reject',
      kind: 'callback',
      style: 'danger',
      callbackData: buildCallback('reject', candidate.approvalId),
      command: '/reject',
    },
  ];

  const actions: SurfaceResponseAction[] = projected.actions.length ? mapProjectedActions(projected) : fallbackActions;

  const buttonsEnabled = isAffordanceEnabled(profile, 'inline_buttons');
  const surfaceActions = buttonsEnabled ? actions : [];

  const textBody = buttonsEnabled
    ? [semanticCard.bodyText, '', 'Use the buttons below (or /approve / /reject).'].join('\n')
    : [semanticCard.bodyText, '', 'This surface has no clickable buttons. Reply with:', '  /approve', '  /reject'].join(
        '\n',
      );

  const response: SurfaceResponse = {
    version: SURFACE_RESPONSE_CONTRACT_VERSION,
    id: semanticCard.id,
    intent: 'approval',
    title: semanticCard.title,
    summary: semanticCard.summary,
    tone: semanticCard.tone || 'warning',
    blocks: [
      { kind: 'text', text: textBody },
      ...(surfaceActions.length ? [{ kind: 'actions' as const, title: 'Decide', actions: surfaceActions }] : []),
    ],
    actions: surfaceActions,
    metadata: {
      singleApprovalCard: true,
      usedNativeButtons: buttonsEnabled && surfaceActions.length > 0,
      profileId: profile.id,
      candidateIds: [candidate.approvalId],
      approvalId: candidate.approvalId,
      semanticCard,
      projection: projected.projection,
    },
  };

  return {
    response,
    projected,
    usedNativeButtons: Boolean(buttonsEnabled && surfaceActions.length > 0),
  };
}

export type UniversalApprovalPresentation = {
  text: string;
  /** Non-null when a single- or multi-approval SurfaceResponse was built. */
  surfaceResponse: SurfaceResponse | null;
  usedNativeButtons: boolean;
  channel: string;
  renderTarget: SurfaceRenderTarget;
  /** Native payload for telegram/discord when applicable. */
  native: unknown;
  actions: SurfaceResponseAction[];
};

function presentBuiltCard(
  built: SingleApprovalBuildResult,
  channel: string,
  profile: SurfaceProfile,
  fallbackText: string,
): UniversalApprovalPresentation {
  const target = mapChannelToRenderTarget(channel, profile);
  const rendered = renderSurfaceResponseForTarget(target, built.response, {
    maxActionsPerRow: 2,
  });
  return {
    text: rendered.text || fallbackText,
    surfaceResponse: built.response,
    usedNativeButtons: built.usedNativeButtons,
    channel,
    renderTarget: target,
    native: rendered.native,
    actions: built.response.actions || [],
  };
}

/**
 * Present any approval-intent result for a channel using SurfaceProfile detection.
 * - ambiguous + 2+ candidates → multi picker (buttons if supported)
 * - ambiguous + 1 candidate (or any non-resolved single candidate) → single card
 * - resolved / not_found / confirmation_required / not_approval_intent → plain text
 */
export function presentUniversalApprovalIntentDecision(
  result: UniversalApprovalIntentDecisionResult,
  channel?: string | null,
): UniversalApprovalPresentation {
  const ch =
    String(channel || result.resolution.channel || 'plain')
      .trim()
      .toLowerCase() || 'plain';
  const profile = resolveSurfaceProfileForChannel(ch);
  const target = mapChannelToRenderTarget(ch, profile);
  const { status, candidates, decision } = result.resolution;

  if (status === 'ambiguous' && candidates.length > 1) {
    return presentBuiltCard(
      buildMultiApprovalPickerResponse(candidates, decision, profile),
      ch,
      profile,
      renderUniversalApprovalIntentDecisionResult(result),
    );
  }

  // Single pending card: rare ambiguous(1), or any not-yet-resolved single candidate.
  // Keep confirmation_required / not_found / resolved / not_approval_intent as text.
  if (
    candidates.length === 1 &&
    status !== 'resolved' &&
    status !== 'not_approval_intent' &&
    status !== 'confirmation_required' &&
    status !== 'not_found'
  ) {
    return presentBuiltCard(
      buildSingleApprovalResponse(candidates[0], decision, profile),
      ch,
      profile,
      renderUniversalApprovalIntentDecisionResult(result),
    );
  }

  return {
    text: renderUniversalApprovalIntentDecisionResult(result),
    surfaceResponse: null,
    usedNativeButtons: false,
    channel: ch,
    renderTarget: target,
    native: null,
    actions: [],
  };
}

/**
 * Proposal-time helper: build a single waiting-approval card for openers that
 * create a pending approval (Natural First fallback, capability negotiation, swarm…).
 */
export function buildWaitingApprovalCard(
  candidate: UniversalApprovalIntentCandidate,
  channel?: string | null,
  decisionHint: 'approved' | 'rejected' | null = null,
): UniversalApprovalPresentation {
  const ch =
    String(channel || candidate.channel || 'plain')
      .trim()
      .toLowerCase() || 'plain';
  const profile = resolveSurfaceProfileForChannel(ch);
  return presentBuiltCard(
    buildSingleApprovalResponse(candidate, decisionHint, profile),
    ch,
    profile,
    [
      shortTitle(candidate.title, 80),
      'One approval is waiting.',
      'Tap Approve/Reject, or reply /approve or /reject.',
    ].join('\n'),
  );
}

/** Convenience: only the multi-picker response when resolution is ambiguous (2+). */
export function tryBuildMultiApprovalPickerFromResolution(
  resolution: UniversalApprovalIntentResolution,
  channel?: string | null,
): ReturnType<typeof buildMultiApprovalPickerResponse> | null {
  if (resolution.status !== 'ambiguous' || resolution.candidates.length < 2) {
    return null;
  }
  const ch =
    String(channel || resolution.channel || 'plain')
      .trim()
      .toLowerCase() || 'plain';
  const profile = resolveSurfaceProfileForChannel(ch);
  return buildMultiApprovalPickerResponse(resolution.candidates, resolution.decision, profile);
}

/** Convenience: single-pending card when resolution has exactly one non-resolved candidate. */
export function tryBuildSingleApprovalFromResolution(
  resolution: UniversalApprovalIntentResolution,
  channel?: string | null,
): ReturnType<typeof buildSingleApprovalResponse> | null {
  if (
    resolution.candidates.length !== 1 ||
    resolution.status === 'resolved' ||
    resolution.status === 'not_approval_intent' ||
    resolution.status === 'confirmation_required' ||
    resolution.status === 'not_found'
  ) {
    return null;
  }
  const ch =
    String(channel || resolution.channel || 'plain')
      .trim()
      .toLowerCase() || 'plain';
  const profile = resolveSurfaceProfileForChannel(ch);
  return buildSingleApprovalResponse(resolution.candidates[0], resolution.decision, profile);
}

/**
 * Attach a single-pending SurfaceResponse (+ slash hints) to the first reply of an
 * opener result. Minimal invasive wiring for capability negotiation / swarm / etc.
 */
export function decorateResultWithWaitingApprovalCard(
  result: UniversalAgentRunResult,
  approval: Pick<UniversalApprovalRequest, 'id' | 'title' | 'risk' | 'createdAt'>,
  channel?: string | null,
): UniversalAgentRunResult {
  if (!result.replies.length) return result;
  const run = result.run;
  const ch =
    String(channel || run.channel || 'plain')
      .trim()
      .toLowerCase() || 'plain';
  const card = buildWaitingApprovalCard(
    {
      runId: run.id,
      approvalId: approval.id,
      userId: run.userId,
      sessionId: run.sessionId,
      channel: run.channel,
      title: approval.title,
      risk: approval.risk,
      createdAt: approval.createdAt,
    },
    ch,
  );
  const first = result.replies[0];
  const alreadyHasHint = /\/approve\b/i.test(first.text);
  const hint = card.usedNativeButtons
    ? '\n\nUse the Approve / Reject buttons (or /approve / /reject).'
    : '\n\nReply with:\n  /approve\n  /reject';
  return {
    ...result,
    replies: [
      {
        ...first,
        text: alreadyHasHint ? first.text : `${first.text}${hint}`,
        metadata: {
          ...(first.metadata || {}),
          surfaceResponse: card.surfaceResponse,
          usedNativeButtons: card.usedNativeButtons,
          approvalActions: card.actions,
          singleApprovalCard: true,
          approvalId: approval.id,
        },
      },
      ...result.replies.slice(1),
    ],
  };
}
