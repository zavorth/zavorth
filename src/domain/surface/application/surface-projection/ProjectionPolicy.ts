import {
  isSurfaceAffordanceEnabled,
  type SurfaceAffordanceId,
  type SurfaceProfile,
} from '../surface-affordance/index.js';
import type { SemanticControl } from './SemanticControlContract.js';

export type ProjectionMode =
  | 'inline_buttons'
  | 'select_menu'
  | 'slash_commands'
  | 'numbered_text'
  | 'link'
  | 'text_only';

export type ProjectionProfileInput =
  | SurfaceProfile
  | {
      affordances: Record<string, unknown>;
      fallbackOrder?: string[];
      id?: string;
      channel?: string;
    };

function asProfileLike(profile: ProjectionProfileInput): {
  affordances: Record<string, unknown>;
  fallbackOrder?: string[];
} {
  return {
    affordances: (profile.affordances || {}) as Record<string, unknown>,
    fallbackOrder: profile.fallbackOrder as string[] | undefined,
  };
}

export function pickFirstEnabled(
  profile: ProjectionProfileInput,
  candidates: SurfaceAffordanceId[],
): SurfaceAffordanceId | null {
  const like = asProfileLike(profile);
  for (const id of candidates) {
    if (isSurfaceAffordanceEnabled(like, id)) {
      return id;
    }
  }
  return null;
}

const NUMBERED_FIRST_CHANNELS = new Set([
  'whatsapp',
  'signal',
  'imessage',
  'instagram',
  'sms',
]);

function profileChannel(profile: ProjectionProfileInput): string {
  return String((profile as SurfaceProfile).channel || (profile as { id?: string }).id || '')
    .trim()
    .toLowerCase();
}

function fallbackPrefers(
  profile: ProjectionProfileInput,
  preferred: SurfaceAffordanceId | 'numbered_text',
): boolean {
  const order = asProfileLike(profile).fallbackOrder || [];
  if (order.length === 0) return false;
  // numbered_text is a projection mode; map from text/list_picker/quick_replies
  if (preferred === 'numbered_text') {
    const first = String(order[0] || '');
    return first === 'text' || first === 'list_picker' || first === 'quick_replies';
  }
  return String(order[0] || '') === preferred;
}

/**
 * Choose projection mode for a semantic control given surface capabilities (v1 + F5 rules).
 */
export function resolveProjectionMode(
  control: SemanticControl,
  profile: ProjectionProfileInput,
): ProjectionMode {
  const like = asProfileLike(profile);
  const has = (id: SurfaceAffordanceId) => isSurfaceAffordanceEnabled(like, id);
  const channel = profileChannel(profile);
  const order = like.fallbackOrder || [];

  switch (control.kind) {
    case 'choice_group': {
      const count = Array.isArray(control.options) ? control.options.length : 0;

      // F5b: long lists prefer select_menu when available (also when fallbackOrder leads with it).
      if (
        count > 4 &&
        has('select_menu') &&
        (order[0] === 'select_menu' || !has('inline_buttons') || count > 4)
      ) {
        return 'select_menu';
      }
      if (count > 4 && has('select_menu')) {
        return 'select_menu';
      }

      if (count <= 4 && has('inline_buttons')) {
        return 'inline_buttons';
      }
      if (count > 4 && has('inline_buttons') && !has('select_menu')) {
        // Paginated/truncated button rows still better than nothing
        return 'inline_buttons';
      }

      // F5d: messaging channels without buttons → numbered reply first
      if (
        !has('inline_buttons') &&
        (NUMBERED_FIRST_CHANNELS.has(channel) ||
          has('list_picker') ||
          has('quick_replies') ||
          fallbackPrefers(profile, 'numbered_text'))
      ) {
        return 'numbered_text';
      }

      if (has('slash_commands')) {
        return 'slash_commands';
      }
      return 'numbered_text';
    }
    case 'confirm': {
      if (has('inline_buttons')) {
        return 'inline_buttons';
      }
      if (has('slash_commands')) {
        return 'slash_commands';
      }
      return 'numbered_text';
    }
    case 'link_out': {
      if (has('url_button') || has('inline_buttons')) {
        return 'link';
      }
      return 'text_only';
    }
    case 'command_hint': {
      if (has('slash_commands')) {
        return 'slash_commands';
      }
      return 'text_only';
    }
    default:
      return 'text_only';
  }
}
