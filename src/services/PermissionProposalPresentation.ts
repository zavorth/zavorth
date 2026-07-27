/**
 * Permission proposal-time card — surface-agnostic.
 * Buttons when SurfaceProfile has inline_buttons; else slash ordinals.
 * Prefer /perm approve 1 (not long UUID) as the primary slash path.
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
import type { PermissionRequest } from '../contracts/PermissionRequest.js';

export type PermissionProposalCardInput = {
  permission: Pick<
    PermissionRequest,
    | 'permission_id'
    | 'executor'
    | 'kind'
    | 'reason'
    | 'status'
    | 'scope'
    | 'workspace'
    | 'requested_value'
    | 'resolved_value'
  >;
  channel?: string | null;
  /** 1-based list ordinal (newest pending first). Defaults to 1 for fresh openers. */
  ordinal?: number | null;
};

export type PermissionProposalPresentation = {
  text: string;
  surfaceResponse: SurfaceResponse;
  usedNativeButtons: boolean;
};

function channelOf(input: PermissionProposalCardInput): string {
  return (
    String(input.channel || 'plain')
      .trim()
      .toLowerCase() || 'plain'
  );
}

function shortPermissionRef(permissionId: string): string {
  const id = String(permissionId || '').trim();
  if (!id) return 'n/a';
  if (id.length <= 10) return id;
  return id.slice(0, 8);
}

/**
 * Build a pending permission card at proposal/show time.
 * Commands use ordinals (/perm approve 1) — no long permission id as primary.
 * Native callbacks keep stable perm:approve:/perm:reject: ids for Telegram routers.
 */
export function buildPermissionPendingCard(input: PermissionProposalCardInput): PermissionProposalPresentation {
  const ch = channelOf(input);
  const profile = resolveSurfaceProfileForChannel(ch);
  const buttons = isAffordanceEnabled(profile, 'inline_buttons');
  const perm = input.permission;
  const shortId = shortPermissionRef(perm.permission_id);
  const ordinal =
    Number.isFinite(Number(input.ordinal)) && Number(input.ordinal) >= 1 ? Math.floor(Number(input.ordinal)) : 1;
  const approveCmd = `/perm approve ${ordinal}`;
  const rejectCmd = `/perm reject ${ordinal}`;
  const subject = `${perm.executor}/${perm.kind}`;
  const reason = String(perm.reason || '').trim();

  const body = [
    'Permission approval needed',
    '',
    `Item #${ordinal} · ${subject}`,
    reason ? reason.slice(0, 280) : null,
    perm.workspace ? `Workspace: ${perm.workspace}` : null,
    perm.requested_value ? `Request: ${String(perm.requested_value).slice(0, 160)}` : null,
    perm.resolved_value ? `Suggestion: ${String(perm.resolved_value).slice(0, 160)}` : null,
    `Scope: ${perm.scope || 'once'} · status: ${perm.status || 'pending'}`,
    `Ref: ${shortId}`,
    '',
    buttons ? `Use the buttons below (or ${approveCmd} · ${rejectCmd}).`
      : [
          'This surface has no clickable buttons. Reply with:',
          `  ${approveCmd}`,
          `  ${rejectCmd}`,
          '  /perm list pending',
        ].join('\n'),
  ]
    .filter((line) => line !== null && line !== undefined)
    .join('\n');

  // Prefer slash-command callbacks (ModeEscalation style) so SharedSurface callback
  // policy routes them on any channel. Telegram still understands /perm approve 1.
  // Native perm:approve short-id callbacks remain on buildPermissionKeyboard.
  const actions: SurfaceResponseAction[] = buttons
    ? [
        {
          id: `perm-approve-${shortId}-once`,
          label: '✓ Approve',
          kind: 'command',
          style: 'success',
          command: approveCmd,
          callbackData: approveCmd,
        },
        {
          id: `perm-reject-${shortId}`,
          label: '✗ Reject',
          kind: 'command',
          style: 'danger',
          command: rejectCmd,
          callbackData: rejectCmd,
        },
      ]
    : [];

  const surfaceResponse: SurfaceResponse = {
    version: SURFACE_RESPONSE_CONTRACT_VERSION,
    id: `permission-proposal:${shortId}`,
    intent: 'approval',
    title: 'Permission approval',
    summary: subject,
    tone: 'warning',
    blocks: [
      { kind: 'text', text: body },
      ...(actions.length ? [{ kind: 'actions' as const, title: 'Decide', actions }] : []),
    ],
    actions,
    metadata: {
      permissionProposalCard: true,
      usedNativeButtons: buttons && actions.length > 0,
      permissionId: perm.permission_id,
      shortId,
      ordinal,
      profileId: profile.id,
      approvalId: perm.permission_id,
    },
  };

  return {
    text: body,
    surfaceResponse,
    usedNativeButtons: Boolean(buttons && actions.length > 0),
  };
}
