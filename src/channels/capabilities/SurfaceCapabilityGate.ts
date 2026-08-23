import type { ChannelFeatureSet } from '../../contracts/ChannelMeshContract.js';
import {
  getAffordanceLimits,
  isAffordanceEnabled,
  resolveSurfaceProfileForChannel,
} from '../../domain/surface/application/surface-affordance/index.js';
import {
  formatChannelApprovalString,
  type ChannelApprovalMessageKey,
} from '../../services/localization/channelApprovalStrings.js';

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

const NUMBERED_TEXT_HINT_KEY: ChannelApprovalMessageKey = 'prompt.hint';

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
  preferredLanguageCode?: string | null,
): string | null {
  if (!presentation || presentation.mode === 'none' || entries.length === 0) {
    return null;
  }
  const multiple = entries.length > 1;
  const lines = entries.map((entry, index) => {
    const ordinalPrefix = multiple ? `${index + 1}. ` : '';
    return formatChannelApprovalString(
      'prompt.entry',
      {
        ordinal: ordinalPrefix,
        risk: entry.risk,
        label: entry.label,
        ref: entry.ref,
      },
      preferredLanguageCode,
    );
  });
  lines.push(formatChannelApprovalString(NUMBERED_TEXT_HINT_KEY, {}, preferredLanguageCode));
  return lines.join('\n');
}

/**
 * Whether a surface can update an approval card it already sent. Only native
 * interactive-card surfaces own editable messages; numbered-text fallback
 * surfaces receive follow-up receipts instead of in-place edits.
 */
export function supportsSurfacePromptCardEdits(input: SurfaceCapabilityInput): boolean {
  return resolveSurfaceCapabilityPresentation(input).mode === 'interactive-cards';
}

export function renderApprovalDecisionReceiptForSurface(
  presentation: SurfaceApprovalPresentation | null,
  parts: ApprovalDecisionReceiptParts,
  preferredLanguageCode?: string | null,
): string | null {
  if (!presentation || presentation.mode === 'none') {
    return null;
  }
  if (!parts.found) {
    return formatChannelApprovalString('receipt.notFound', { ref: parts.ref }, preferredLanguageCode);
  }
  if (parts.action === 'deny') {
    return formatChannelApprovalString('receipt.denied', { ref: parts.ref }, preferredLanguageCode);
  }
  return formatChannelApprovalString(
    'receipt.approved',
    {
      ref: parts.ref,
      choice: String(parts.choice || 'once'),
    },
    preferredLanguageCode,
  );
}
