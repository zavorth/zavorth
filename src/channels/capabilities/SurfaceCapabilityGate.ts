import type { ChannelFeatureSet } from '../../contracts/ChannelMeshContract.js';
import {
  getAffordanceLimits,
  isAffordanceEnabled,
  resolveSurfaceProfileForChannel,
} from '../../domain/surface/application/surface-affordance/index.js';

/**
 * Presentation contract enforced from declared capabilities: surfaces either
 * render interactive cards natively, fall back to the numbered-text approval
 * presenter, or must not receive approval prompts at all (for example a
 * channel whose feature set declares approvals:false).
 */
export type SurfaceApprovalPresentationMode = 'interactive-cards' | 'numbered-text' | 'none';

export type SurfaceApprovalPresentation = {
  platform: string;
  mode: SurfaceApprovalPresentationMode;
  supportsInlineButtons: boolean;
  supportsSlashCommands: boolean;
  supportsFreeText: boolean;
  maxButtons: number;
};

export type SurfaceCapabilityInput = {
  platform: string;
  features?: Partial<ChannelFeatureSet> | null;
};

export type ApprovalMenuEntry = {
  label: string;
  risk: string;
  ref: string;
};

export type ApprovalDecisionReceiptParts = {
  action: 'approve' | 'deny';
  ref: string;
  choice?: string | null;
  found: boolean;
};

const NUMBERED_TEXT_HINT =
  'Reply 1 (or the ref) to allow once, approve / approve session / approve always, or reject to deny.';

function disabledPresentation(platform: string): SurfaceApprovalPresentation {
  return {
    platform,
    mode: 'none',
    supportsInlineButtons: false,
    supportsSlashCommands: false,
    supportsFreeText: false,
    maxButtons: 0,
  };
}

export function resolveSurfaceCapabilityPresentation(input: SurfaceCapabilityInput): SurfaceApprovalPresentation {
  const platform = String(input.platform || '').trim();
  const features = input.features ?? null;

  // Enforcement: a channel that declares approvals:false never receives prompts.
  if (features && features.approvals === false) {
    return disabledPresentation(platform);
  }

  const profile = resolveSurfaceProfileForChannel(platform);
  const inlineButtonState = getAffordanceLimits(profile, 'inline_buttons');
  const supportsInlineButtons =
    isAffordanceEnabled(profile, 'inline_buttons') || isAffordanceEnabled(profile, 'button_rows');
  const supportsSlashCommands = isAffordanceEnabled(profile, 'slash_commands');
  const supportsFreeText = isAffordanceEnabled(profile, 'text');

  const mode: SurfaceApprovalPresentationMode = supportsInlineButtons
    ? 'interactive-cards'
    : supportsSlashCommands || supportsFreeText
      ? 'numbered-text'
      : 'none';

  return {
    platform,
    mode,
    supportsInlineButtons,
    supportsSlashCommands,
    supportsFreeText,
    maxButtons: inlineButtonState?.maxTotal ?? profile.limits.maxButtons,
  };
}

/**
 * Renders the text fallback presenter for pending approvals. Surfaces whose
 * resolved mode is 'none' must not receive prompts, so the render returns
 * null and callers skip the guidance block entirely. Native card surfaces
 * still receive the numbered text as the transport-level fallback.
 */
export function renderApprovalPromptForSurface(
  presentation: SurfaceApprovalPresentation | null,
  entries: ApprovalMenuEntry[],
): string | null {
  if (!presentation || presentation.mode === 'none' || entries.length === 0) {
    return null;
  }
  const multiple = entries.length > 1;
  const lines = entries.map((entry, index) => {
    const ordinalPrefix = multiple ? `${index + 1}. ` : '';
    return `${ordinalPrefix}[${entry.risk}] ${entry.label} — ref ${entry.ref}`;
  });
  return [...lines, NUMBERED_TEXT_HINT].join('\n');
}

export function renderApprovalDecisionReceiptForSurface(
  presentation: SurfaceApprovalPresentation | null,
  parts: ApprovalDecisionReceiptParts,
): string | null {
  if (!presentation || presentation.mode === 'none') {
    return null;
  }
  if (!parts.found) {
    return `No pending approval found for ${parts.ref}.`;
  }
  if (parts.action === 'deny') {
    return `Denied approval ${parts.ref}.`;
  }
  const choice = String(parts.choice || 'once');
  return `Approved ${parts.ref} (${choice}).`;
}
