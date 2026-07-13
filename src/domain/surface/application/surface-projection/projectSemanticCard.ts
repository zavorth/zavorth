import {
  SURFACE_RESPONSE_CONTRACT_VERSION,
  type SurfaceResponse,
  type SurfaceResponseAction,
  type SurfaceResponseActionStyle,
  type SurfaceResponseIntent,
} from '../surface-response/SurfaceResponseContract.js';
import {
  resolveSurfaceProfileForChannel,
  type SurfaceProfile,
} from '../surface-affordance/index.js';
import {
  resolveProjectionMode,
  type ProjectionMode,
} from './ProjectionPolicy.js';
import type {
  SemanticCard,
  SemanticChoiceOption,
  SemanticControl,
  SemanticControlStyle,
} from './SemanticControlContract.js';
import { SEMANTIC_CARD_CONTRACT_VERSION } from './SemanticControlContract.js';

export type ProjectedSurfaceAction = {
  id: string;
  label: string;
  kind?: 'command' | 'callback' | 'url' | 'submit';
  style?: string;
  command?: string | null;
  callbackData?: string | null;
  href?: string | null;
  description?: string | null;
};

export type ProjectedSurfaceMessage = {
  mode: 'native_actions' | 'text_fallback' | 'mixed';
  text: string;
  actions: ProjectedSurfaceAction[];
  projection: Array<{ controlId: string; mode: ProjectionMode }>;
  surfaceResponse: SurfaceResponse;
  profileId?: string;
  usedNativeButtons: boolean;
  /** F5d: option ids in display order for numbered reply parsing. */
  numberedOptionIds?: string[];
};

function mapStyle(style?: SemanticControlStyle | null): SurfaceResponseActionStyle | undefined {
  if (!style) return undefined;
  return style;
}

function optionToAction(option: SemanticChoiceOption, controlId: string): SurfaceResponseAction {
  const hasCallback = Boolean(option.callbackData);
  const hasCommand = Boolean(option.command);
  const hasHref = false;
  let kind: SurfaceResponseAction['kind'] = 'callback';
  if (hasCallback) kind = 'callback';
  else if (hasCommand) kind = 'command';
  else if (hasHref) kind = 'url';
  else kind = 'callback';

  return {
    id: option.id || `${controlId}:${option.label}`,
    label: option.label,
    kind,
    style: mapStyle(option.style),
    command: option.command ?? null,
    callbackData: option.callbackData ?? null,
    href: null,
    description: option.description ?? null,
  };
}

function confirmToActions(control: Extract<SemanticControl, { kind: 'confirm' }>): SurfaceResponseAction[] {
  return [
    {
      id: `${control.id}:confirm`,
      label: control.confirmLabel,
      kind: control.confirmCallbackData ? 'callback' : 'command',
      style: 'success',
      command: control.confirmCommand ?? null,
      callbackData: control.confirmCallbackData ?? null,
      href: null,
    },
    {
      id: `${control.id}:cancel`,
      label: control.cancelLabel,
      kind: control.cancelCallbackData ? 'callback' : 'command',
      style: 'danger',
      command: control.cancelCommand ?? null,
      callbackData: control.cancelCallbackData ?? null,
      href: null,
    },
  ];
}

function formatNumberedOptions(options: SemanticChoiceOption[]): string[] {
  return options.map((opt, index) => {
    const n = index + 1;
    const cmd = opt.command ? ` — ${opt.command}` : '';
    return `${n}. ${opt.label}${cmd}`;
  });
}

function formatSlashHints(options: SemanticChoiceOption[]): string[] {
  return options
    .map((opt) => opt.command)
    .filter((cmd): cmd is string => Boolean(cmd && String(cmd).trim()));
}

/**
 * Project a semantic card onto a concrete surface profile.
 * Always preserves every option (especially deny/critical) in actions and/or text.
 */
export function projectSemanticCard(
  card: SemanticCard,
  profile: SurfaceProfile,
): ProjectedSurfaceMessage {
  const projection: Array<{ controlId: string; mode: ProjectionMode }> = [];
  const actions: SurfaceResponseAction[] = [];
  const textLines: string[] = [];
  let usedNativeButtons = false;
  let anyNative = false;
  let anyTextFallback = false;

  const title = String(card.title || '').trim();
  const summary = card.summary != null ? String(card.summary).trim() : '';
  const bodyText = card.bodyText != null ? String(card.bodyText).trim() : '';

  if (title) textLines.push(title);
  if (summary) textLines.push(summary);
  if (bodyText) textLines.push(bodyText);

  for (const control of card.controls || []) {
    const mode = resolveProjectionMode(control, profile);
    projection.push({ controlId: control.id, mode });

    switch (control.kind) {
      case 'choice_group': {
        const options = Array.isArray(control.options) ? control.options : [];
        // Never drop options — always materialize actions for web/desktop consumers.
        const optionActions = options.map((opt) => optionToAction(opt, control.id));
        actions.push(...optionActions);

        if (mode === 'inline_buttons') {
          anyNative = true;
          usedNativeButtons = true;
        } else if (mode === 'select_menu') {
          anyNative = true;
          usedNativeButtons = true;
          // Select menus still surface a readable list for text channels / logs.
          textLines.push('');
          textLines.push('Options:');
          textLines.push(...formatNumberedOptions(options));
          anyTextFallback = true;
        } else if (mode === 'slash_commands') {
          anyTextFallback = true;
          const hints = formatSlashHints(options);
          if (hints.length > 0) {
            textLines.push('');
            textLines.push('If buttons are not available on this surface, use:');
            for (const hint of hints) {
              textLines.push(`  ${hint}`);
            }
          } else {
            textLines.push('');
            textLines.push('Options:');
            textLines.push(...formatNumberedOptions(options));
          }
        } else {
          // numbered_text (F5d — WhatsApp/Signal/etc.)
          anyTextFallback = true;
          textLines.push('');
          textLines.push(`Reply with a number (1-${options.length}):`);
          textLines.push(...formatNumberedOptions(options));
          const hints = formatSlashHints(options);
          if (hints.length > 0) {
            textLines.push('');
            textLines.push('Or use:');
            for (const hint of hints) {
              textLines.push(`  ${hint}`);
            }
          }
        }
        break;
      }
      case 'confirm': {
        const confirmActions = confirmToActions(control);
        actions.push(...confirmActions);
        if (mode === 'inline_buttons') {
          anyNative = true;
          usedNativeButtons = true;
        } else {
          anyTextFallback = true;
          textLines.push('');
          textLines.push(
            `Confirm: ${control.confirmLabel}${control.confirmCommand ? ` (${control.confirmCommand})` : ''}`,
          );
          textLines.push(
            `Cancel: ${control.cancelLabel}${control.cancelCommand ? ` (${control.cancelCommand})` : ''}`,
          );
        }
        break;
      }
      case 'command_hint': {
        // Hints always contribute text. When native buttons already cover the same
        // choices, skip duplicate command blocks to keep TG/Discord messages clean.
        const cmds = (control.commands || []).filter(Boolean);
        if (cmds.length > 0 && !usedNativeButtons) {
          anyTextFallback = true;
          textLines.push('');
          textLines.push('Commands:');
          for (const cmd of cmds) {
            textLines.push(`  ${cmd}`);
          }
        }
        break;
      }
      case 'link_out': {
        if (mode === 'link') {
          anyNative = true;
          usedNativeButtons = true;
          actions.push({
            id: control.id,
            label: control.label,
            kind: 'url',
            style: 'primary',
            href: control.href,
            command: null,
            callbackData: null,
          });
        } else {
          anyTextFallback = true;
          textLines.push('');
          textLines.push(`${control.label}: ${control.href}`);
          // Still expose as action for non-button consumers.
          actions.push({
            id: control.id,
            label: control.label,
            kind: 'url',
            href: control.href,
            command: null,
            callbackData: null,
          });
        }
        break;
      }
      default:
        break;
    }
  }

  // Deny/critical options are always in actions; native-only cards keep text as title/body.

  const text = textLines.filter((line, idx, arr) => {
    // collapse excessive blank lines
    if (line === '' && (idx === 0 || arr[idx - 1] === '')) return false;
    return true;
  }).join('\n').trim();

  let mode: ProjectedSurfaceMessage['mode'] = 'text_fallback';
  if (anyNative && anyTextFallback) mode = 'mixed';
  else if (anyNative && !anyTextFallback) mode = 'native_actions';
  else mode = 'text_fallback';

  if (!anyNative) {
    usedNativeButtons = false;
  }

  const intent = (card.intent || 'generic') as SurfaceResponseIntent;
  const surfaceResponse: SurfaceResponse = {
    version: SURFACE_RESPONSE_CONTRACT_VERSION,
    id: card.id,
    intent,
    title: title || card.id,
    summary: summary || null,
    tone: card.tone || 'neutral',
    blocks: [
      {
        kind: 'text',
        text: text || title || card.id,
      },
      ...(actions.length > 0
        ? [
            {
              kind: 'actions' as const,
              title: intent === 'approval' ? 'Permission' : 'Actions',
              actions: [...actions],
            },
          ]
        : []),
    ],
    actions: [...actions],
    metadata: {
      ...(card.metadata || {}),
      semanticCardVersion: SEMANTIC_CARD_CONTRACT_VERSION,
      semanticCard: card,
      projection,
      profileId: profile.id,
      usedNativeButtons,
      projectionMode: mode,
    },
  };

  const numberedOptionIds = actions.map((a) => a.id);

  return {
    mode,
    text,
    actions: actions.map((a) => ({
      id: a.id,
      label: a.label,
      kind: a.kind,
      style: a.style,
      command: a.command ?? null,
      callbackData: a.callbackData ?? null,
      href: a.href ?? null,
      description: a.description ?? null,
    })),
    projection,
    surfaceResponse,
    profileId: profile.id,
    usedNativeButtons,
    /** F5d: option ids in display order for numbered reply parsing. */
    numberedOptionIds,
  };
}

export function projectSemanticCardForChannel(
  card: SemanticCard,
  channel: string,
): ProjectedSurfaceMessage {
  const profile = resolveSurfaceProfileForChannel(channel);
  return projectSemanticCard(card, profile);
}
