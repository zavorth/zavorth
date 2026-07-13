/**
 * Surface-agnostic approval prompt: once | session | always | deny.
 * Surfaces that support clickable controls get native buttons via SurfaceResponse renderers.
 * Chat/CLI get the same actions as slash commands in the text body.
 *
 * F2: semantic card + ProjectionPolicy projection while keeping callback formats stable.
 */

import {
  SURFACE_RESPONSE_CONTRACT_VERSION,
  type SurfaceResponse,
  type SurfaceResponseAction,
  type SurfaceRenderTarget,
} from '../../domain/surface/application/surface-response/SurfaceResponseContract.js';
import { renderSurfaceResponseForTarget } from '../../domain/surface/application/surface-response/SurfaceResponseRenderers.js';
import {
  resolveSurfaceProfileForChannel,
  type SurfaceProfile,
} from '../../domain/surface/application/surface-affordance/index.js';
import {
  SEMANTIC_CARD_CONTRACT_VERSION,
  projectSemanticCard,
  type ProjectedSurfaceMessage,
  type SemanticCard,
} from '../../domain/surface/application/surface-projection/index.js';
import {
  AGENT_PERMISSION_CHOICES,
  type AgentPermissionChoice,
} from '../../contracts/permission/AgentPermissionContract.js';

export type AgentPermissionApprovalPromptInput = {
  approvalId: string;
  title?: string | null;
  summary?: string | null;
  riskLabel?: string | null;
  /** Prefer short ids if needed; callback stays under Telegram 64-byte limit. */
  callbackPrefix?: string;
};

const CHOICE_LABELS: Record<AgentPermissionChoice, string> = {
  once: 'Run once',
  session: 'Session',
  always: 'Always',
  deny: 'Deny',
};

const CHOICE_STYLES: Record<
  AgentPermissionChoice,
  SurfaceResponseAction['style']
> = {
  once: 'success',
  session: 'primary',
  always: 'secondary',
  deny: 'danger',
};

/** Map SurfaceRenderTarget → channel id for profile resolution. */
export function mapSurfaceTargetToChannel(target: SurfaceRenderTarget | string): string {
  const t = String(target || '').trim().toLowerCase();
  switch (t) {
    case 'telegram':
    case 'discord':
    case 'cli':
    case 'plain':
    case 'web':
    case 'slack':
    case 'signal':
    case 'whatsapp':
    case 'instagram':
    case 'imessage':
    case 'teams':
    case 'email':
    case 'desktop':
      return t;
    case 'terminal':
      return 'cli';
    default:
      return t || 'plain';
  }
}

/** callback_data safe for Telegram (≤64 bytes with uuid). */
export function buildAgentPermissionCallbackData(
  choice: AgentPermissionChoice,
  approvalId: string,
  prefix = 'task',
): string {
  const id = String(approvalId || '').trim().slice(0, 48);
  // task:once:<id> | task:session:<id> | task:always:<id> | task:deny:<id>
  return `${prefix}:${choice}:${id}`.slice(0, 64);
}

export function buildAgentPermissionSlashHints(approvalId: string): string[] {
  const id = String(approvalId || '').trim();
  return [
    `/approve ${id} once`,
    `/approve ${id} session`,
    `/approve ${id} always`,
    `/reject ${id}`,
  ];
}

export function buildAgentPermissionActions(
  approvalId: string,
  prefix = 'task',
): SurfaceResponseAction[] {
  return AGENT_PERMISSION_CHOICES.map((choice) => ({
    id: `agent-perm-${choice}`,
    label: CHOICE_LABELS[choice],
    kind: 'callback' as const,
    style: CHOICE_STYLES[choice],
    callbackData: buildAgentPermissionCallbackData(choice, approvalId, prefix),
    command: choice === 'deny' ? `/reject ${approvalId}` : `/approve ${approvalId} ${choice}`,
    description: null,
  }));
}

/**
 * Semantic card for agent permission approval (F2).
 * choice_group with once / session / always / deny — same callbacks as legacy actions.
 */
export function buildAgentPermissionSemanticCard(
  input: AgentPermissionApprovalPromptInput,
): SemanticCard {
  const approvalId = String(input.approvalId || '').trim();
  const title = String(input.title || 'Approval needed').trim() || 'Approval needed';
  const summary = String(input.summary || '').trim();
  const risk = String(input.riskLabel || '').trim();
  const prefix = String(input.callbackPrefix || 'task').trim() || 'task';
  const slash = buildAgentPermissionSlashHints(approvalId);

  const bodyLines = [
    risk ? `Risk: ${risk}` : null,
    'Choose how to allow this action:',
    '• Run once — this time only',
    '• Session — remember for this session',
    '• Always — remember for this tool/pattern',
    '• Deny — block',
  ].filter(Boolean);

  return {
    version: SEMANTIC_CARD_CONTRACT_VERSION,
    id: `agent-perm-approval:${approvalId}`,
    intent: 'approval',
    title,
    summary: summary || null,
    tone: risk && /high|danger|critical/i.test(risk) ? 'warning' : 'info',
    bodyText: bodyLines.join('\n'),
    controls: [
      {
        kind: 'choice_group',
        id: 'agent-permission-choices',
        purpose: 'approval',
        required: true,
        options: AGENT_PERMISSION_CHOICES.map((choice) => ({
          id: `agent-perm-${choice}`,
          label: CHOICE_LABELS[choice],
          style: CHOICE_STYLES[choice],
          callbackData: buildAgentPermissionCallbackData(choice, approvalId, prefix),
          command:
            choice === 'deny' ? `/reject ${approvalId}` : `/approve ${approvalId} ${choice}`,
          description: null,
        })),
      },
      {
        kind: 'command_hint',
        id: 'agent-permission-slash-hints',
        commands: slash,
      },
    ],
    metadata: {
      approvalId,
      permissionChoices: [...AGENT_PERMISSION_CHOICES],
      surfaceAgnostic: true,
      callbackPrefix: prefix,
    },
  };
}

/**
 * Build SurfaceResponse for approval. When profile is known, attaches
 * metadata.semanticCard + metadata.projection from projectSemanticCard.
 * Backward compatible: same action ids/callbacks/commands as before.
 */
export function buildAgentPermissionApprovalResponse(
  input: AgentPermissionApprovalPromptInput,
  profile?: SurfaceProfile | null,
): SurfaceResponse {
  const approvalId = String(input.approvalId || '').trim();
  const semanticCard = buildAgentPermissionSemanticCard(input);

  if (profile) {
    const projected = projectSemanticCard(semanticCard, profile);
    // Ensure slash hints still appear when native buttons are used (legacy text parity).
    const slash = buildAgentPermissionSlashHints(approvalId);
    const risk = String(input.riskLabel || '').trim();
    const legacyBody = [
      risk ? `Risk: ${risk}` : null,
      'Choose how to allow this action:',
      '• Run once — this time only',
      '• Session — remember for this session',
      '• Always — remember for this tool/pattern',
      '• Deny — block',
      '',
      'If buttons are not available on this surface, use:',
      ...slash.map((line) => `  ${line}`),
    ]
      .filter((line) => line !== null)
      .join('\n');

    const actions = projected.actions.length
      ? projected.actions.map((a) => ({
          id: a.id,
          label: a.label,
          kind: a.kind,
          style: a.style as SurfaceResponseAction['style'],
          command: a.command ?? null,
          callbackData: a.callbackData ?? null,
          href: a.href ?? null,
          description: a.description ?? null,
        }))
      : buildAgentPermissionActions(approvalId, String(input.callbackPrefix || 'task').trim() || 'task');

    return {
      version: SURFACE_RESPONSE_CONTRACT_VERSION,
      id: semanticCard.id,
      intent: 'approval',
      title: semanticCard.title,
      summary: semanticCard.summary ?? null,
      tone: semanticCard.tone || 'info',
      blocks: [
        {
          kind: 'text',
          text: legacyBody,
        },
        {
          kind: 'actions',
          title: 'Permission',
          actions,
        },
      ],
      actions,
      metadata: {
        approvalId,
        permissionChoices: [...AGENT_PERMISSION_CHOICES],
        surfaceAgnostic: true,
        semanticCard,
        projection: projected.projection,
        profileId: projected.profileId,
        usedNativeButtons: projected.usedNativeButtons,
        projectionMode: projected.mode,
      },
    };
  }

  // Legacy path (no profile): identical structure to pre-F2 builder.
  const title = String(input.title || 'Approval needed').trim() || 'Approval needed';
  const summary = String(input.summary || '').trim();
  const risk = String(input.riskLabel || '').trim();
  const prefix = String(input.callbackPrefix || 'task').trim() || 'task';
  const actions = buildAgentPermissionActions(approvalId, prefix);
  const slash = buildAgentPermissionSlashHints(approvalId);

  return {
    version: SURFACE_RESPONSE_CONTRACT_VERSION,
    id: `agent-perm-approval:${approvalId}`,
    intent: 'approval',
    title,
    summary: summary || null,
    tone: risk && /high|danger|critical/i.test(risk) ? 'warning' : 'info',
    blocks: [
      {
        kind: 'text',
        text: [
          risk ? `Risk: ${risk}` : null,
          'Choose how to allow this action:',
          '• Run once — this time only',
          '• Session — remember for this session',
          '• Always — remember for this tool/pattern',
          '• Deny — block',
          '',
          'If buttons are not available on this surface, use:',
          ...slash.map((line) => `  ${line}`),
        ]
          .filter(Boolean)
          .join('\n'),
      },
      {
        kind: 'actions',
        title: 'Permission',
        actions,
      },
    ],
    actions,
    metadata: {
      approvalId,
      permissionChoices: [...AGENT_PERMISSION_CHOICES],
      surfaceAgnostic: true,
      semanticCard,
    },
  };
}

/**
 * Project + build using an explicit SurfaceProfile.
 */
export function renderAgentPermissionApprovalForProfile(
  profile: SurfaceProfile,
  input: AgentPermissionApprovalPromptInput,
): {
  response: SurfaceResponse;
  projected: ProjectedSurfaceMessage;
  rendered: ReturnType<typeof renderSurfaceResponseForTarget>;
} {
  const semanticCard = buildAgentPermissionSemanticCard(input);
  const projected = projectSemanticCard(semanticCard, profile);
  const response = buildAgentPermissionApprovalResponse(input, profile);
  const target = mapProfileToRenderTarget(profile);
  const rendered = renderSurfaceResponseForTarget(target, response, { maxActionsPerRow: 2 });
  return { response, projected, rendered };
}

/**
 * Render for a concrete surface. Telegram/Discord get native buttons;
 * CLI/plain get text action list.
 */
export function renderAgentPermissionApprovalForSurface(
  target: SurfaceRenderTarget,
  input: AgentPermissionApprovalPromptInput,
) {
  const channel = mapSurfaceTargetToChannel(target);
  const profile = resolveSurfaceProfileForChannel(channel);
  const response = buildAgentPermissionApprovalResponse(input, profile);
  return {
    response,
    projected: projectSemanticCard(buildAgentPermissionSemanticCard(input), profile),
    rendered: renderSurfaceResponseForTarget(target, response, { maxActionsPerRow: 2 }),
  };
}

function mapProfileToRenderTarget(profile: SurfaceProfile): SurfaceRenderTarget {
  if (profile.renderTarget) {
    return profile.renderTarget;
  }
  const channel = String(profile.channel || profile.id || 'plain').toLowerCase();
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
  if ((known as string[]).includes(channel)) {
    return channel as SurfaceRenderTarget;
  }
  return 'plain';
}

export function parseAgentPermissionTaskCallback(
  data: string,
): { choice: AgentPermissionChoice; taskId: string } | null {
  const raw = String(data || '').trim();
  // task:once|session|always|deny:<id>
  // also accept legacy task:approve|reject:<id>
  const modern = /^task:(once|session|always|deny):([^:\s]{1,160})$/i.exec(raw);
  if (modern) {
    return {
      choice: modern[1].toLowerCase() as AgentPermissionChoice,
      taskId: modern[2],
    };
  }
  const legacy = /^task:(approve|reject):([^:\s]{1,160})$/i.exec(raw);
  if (legacy) {
    return {
      choice: legacy[1].toLowerCase() === 'reject' ? 'deny' : 'once',
      taskId: legacy[2],
    };
  }
  return null;
}
