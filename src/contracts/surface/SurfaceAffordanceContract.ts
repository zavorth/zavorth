/**
 * Surface affordance catalog contract (F1).
 * Surfaces declare capabilities via presets with optional overrides.
 * Does not replace SurfaceResponse — profiles describe what a surface can render.
 */

import type { SurfaceRenderTarget } from '../../domain/surface/application/surface-response/SurfaceResponseContract.js';

export const SURFACE_AFFORDANCE_CONTRACT_VERSION = 'surface-affordance/v1' as const;

export type SurfaceAffordanceId =
  | 'text'
  | 'inline_buttons'
  | 'button_rows'
  | 'select_menu'
  | 'multi_select'
  | 'modal_form'
  | 'quick_replies'
  | 'list_picker'
  | 'reactions'
  | 'slash_commands'
  | 'threaded_followup'
  | 'rich_embed_card'
  | 'progress_live_edit'
  | 'ephemeral_notice'
  | 'attachment'
  | 'url_button'
  | 'copy_to_clipboard'
  | 'keyboard_shortcuts'
  | 'voice_reply';

export const SURFACE_AFFORDANCE_IDS: readonly SurfaceAffordanceId[] = [
  'text',
  'inline_buttons',
  'button_rows',
  'select_menu',
  'multi_select',
  'modal_form',
  'quick_replies',
  'list_picker',
  'reactions',
  'slash_commands',
  'threaded_followup',
  'rich_embed_card',
  'progress_live_edit',
  'ephemeral_notice',
  'attachment',
  'url_button',
  'copy_to_clipboard',
  'keyboard_shortcuts',
  'voice_reply',
] as const;

export type SurfaceAffordanceLimit = {
  maxPerRow?: number;
  maxTotal?: number;
  callbackBytes?: number;
  maxTextLength?: number;
};

/** false = disabled; true = enabled without special limits; object = enabled with limits */
export type SurfaceAffordanceState = false | true | SurfaceAffordanceLimit;

export type SurfaceAffordanceMap = Partial<Record<SurfaceAffordanceId, SurfaceAffordanceState>>;

export type SurfaceProfilePresetId =
  | 'chat-basic'
  | 'chat-interactive'
  | 'rich-app'
  | 'cli';

export type SurfaceChannelId =
  | 'telegram'
  | 'discord'
  | 'whatsapp'
  | 'signal'
  | 'imessage'
  | 'cli'
  | 'web'
  | 'slack'
  | 'instagram'
  | 'teams'
  | 'email'
  | 'desktop'
  | 'plain';

export type SurfaceProfile = {
  id: string;
  channel: SurfaceChannelId;
  label: string;
  contractVersion: typeof SURFACE_AFFORDANCE_CONTRACT_VERSION;
  preset: SurfaceProfilePresetId;
  affordances: SurfaceAffordanceMap;
  fallbackOrder: SurfaceAffordanceId[];
  renderTarget: SurfaceRenderTarget;
  limits: {
    maxTextLength: number;
    maxActionsPerRow: number;
    maxButtons: number;
  };
  /** Optional display alias used by some projection consumers. */
  displayName?: string | null;
  metadata?: Record<string, unknown>;
};

export type RegisterSurfaceProfileInput = {
  id: string;
  channel?: SurfaceChannelId;
  label?: string;
  preset?: SurfaceProfilePresetId;
  overrides?: Partial<{
    affordances: SurfaceAffordanceMap;
    fallbackOrder: SurfaceAffordanceId[];
    limits: Partial<SurfaceProfile['limits']>;
    renderTarget: SurfaceRenderTarget | string;
  }>;
};

/**
 * Compatibility helper used by F2 ProjectionPolicy.
 * Supports F1 states (`true` | `false` | limit object) and legacy `{ enabled }` shapes.
 */
export function isSurfaceAffordanceEnabled(
  profile: { affordances?: SurfaceAffordanceMap | Record<string, unknown> | null } | null | undefined,
  id: SurfaceAffordanceId | string,
): boolean {
  const raw = profile?.affordances?.[id as SurfaceAffordanceId];
  if (raw === true) return true;
  if (raw === false || raw == null) return false;
  if (typeof raw === 'object' && raw !== null && 'enabled' in raw) {
    return Boolean((raw as { enabled?: unknown }).enabled);
  }
  // SurfaceAffordanceLimit object ⇒ enabled with limits
  if (typeof raw === 'object') return true;
  return Boolean(raw);
}
