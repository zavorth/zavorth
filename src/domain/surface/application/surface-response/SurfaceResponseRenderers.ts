import type {
  SurfaceRenderedResponse,
  SurfaceRenderOptions,
  SurfaceRenderTarget,
  SurfaceResponse,
} from './SurfaceResponseContract.js';
import {
  buildDeterministicSurfaceId,
  compactSurfaceLine,
  renderSurfaceResponseCore,
  truncateSurfaceText,
} from './SurfaceResponseUtils.js';

export type TelegramInlineKeyboardButton = {
  text: string;
  callback_data?: string;
  url?: string;
};

export type TelegramSurfaceNativePayload = {
  parseMode: null;
  replyMarkup: {
    inline_keyboard: TelegramInlineKeyboardButton[][];
  } | null;
};

export type DiscordButtonComponent = {
  type: 2;
  style: 1 | 2 | 3 | 4 | 5;
  label: string;
  custom_id?: string;
  url?: string;
  disabled?: boolean;
};

export type DiscordActionRowComponent = {
  type: 1;
  components: DiscordButtonComponent[];
};

export type DiscordSurfaceNativePayload = {
  allowedMentions: { parse: [] };
  components: DiscordActionRowComponent[];
};

export function renderPlainSurfaceResponse(
  response: SurfaceResponse,
  options: SurfaceRenderOptions = {},
): SurfaceRenderedResponse<null> {
  const core = renderSurfaceResponseCore(response, {
    maxActionsPerRow: 1,
    ...options,
  });
  return {
    target: 'plain',
    format: 'plain',
    text: core.text,
    actions: core.actionRows,
    native: null,
  };
}

export function renderCliSurfaceResponse(
  response: SurfaceResponse,
  options: SurfaceRenderOptions = {},
): SurfaceRenderedResponse<null> {
  const core = renderSurfaceResponseCore(response, options);
  const title = compactSurfaceLine(response.title);
  const divider = '-'.repeat(Math.max(12, Math.min(title.length, 72)));
  const text = [
    `[${response.intent}] ${title}`,
    divider,
    core.text.split('\n').slice(1).join('\n').trim(),
  ].filter(Boolean).join('\n');

  return {
    target: 'cli',
    format: 'cli',
    text: options.maxTextLength ? truncateSurfaceText(text, options.maxTextLength) : text,
    actions: core.actionRows,
    native: null,
  };
}

export function renderTelegramSurfaceResponse(
  response: SurfaceResponse,
  options: SurfaceRenderOptions = {},
): SurfaceRenderedResponse<TelegramSurfaceNativePayload> {
  const core = renderSurfaceResponseCore(response, {
    maxActionsPerRow: 2,
    maxTextLength: 4096,
    ...options,
  });
  const inlineKeyboard = core.actionRows
    .map((row) => row.actions.filter((action) => !action.confirmationRequired).map((action): TelegramInlineKeyboardButton => {
      const text = truncateSurfaceText(action.label, 64) || action.id;
      if (action.href) {
        return { text, url: action.href };
      }
      const rawCallback = action.callbackData || action.command || action.id;
      return {
        text,
        callback_data: buildDeterministicSurfaceId(rawCallback, `sr:${action.id}`, 64),
      };
    }))
    .filter((row) => row.length > 0);

  return {
    target: 'telegram',
    format: 'telegram-text',
    text: core.text,
    actions: core.actionRows,
    native: {
      parseMode: null,
      replyMarkup: inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : null,
    },
  };
}

export function renderDiscordSurfaceResponse(
  response: SurfaceResponse,
  options: SurfaceRenderOptions = {},
): SurfaceRenderedResponse<DiscordSurfaceNativePayload> {
  const core = renderSurfaceResponseCore(response, {
    maxActionsPerRow: 5,
    maxTextLength: 2000,
    ...options,
  });
  const components = core.actionRows
    .map((row): DiscordActionRowComponent => ({
      type: 1,
      components: row.actions.map((action): DiscordButtonComponent => {
        const label = truncateSurfaceText(action.label, 80) || action.id;
        if (action.href) {
          return {
            type: 2,
            style: 5,
            label,
            url: action.href,
            disabled: action.disabled || undefined,
          };
        }
        return {
          type: 2,
          style: mapDiscordButtonStyle(action.style),
          label,
          custom_id: buildDeterministicSurfaceId(action.callbackData || action.command || action.id, `sr:${action.id}`, 100),
          disabled: action.disabled || action.confirmationRequired || undefined,
        };
      }),
    }))
    .filter((row) => row.components.length > 0);

  return {
    target: 'discord',
    format: 'discord-markdown',
    text: escapeDiscordMentions(core.text),
    actions: core.actionRows,
    native: {
      allowedMentions: { parse: [] },
      components,
    },
  };
}

export function renderFallbackMessagingSurfaceResponse(
  target: Extract<SurfaceRenderTarget, 'slack' | 'whatsapp' | 'instagram' | 'teams' | 'email' | 'signal' | 'imessage' | 'web'>,
  response: SurfaceResponse,
  options: SurfaceRenderOptions = {},
): SurfaceRenderedResponse<null> {
  const core = renderSurfaceResponseCore(response, {
    maxActionsPerRow: 1,
    maxTextLength: resolveFallbackTextLimit(target),
    ...options,
  });

  return {
    target,
    format: 'plain',
    text: core.text,
    actions: core.actionRows,
    native: null,
  };
}

export function renderSurfaceResponseForTarget(
  target: SurfaceRenderTarget,
  response: SurfaceResponse,
  options: SurfaceRenderOptions = {},
): SurfaceRenderedResponse {
  switch (target) {
    case 'cli':
      return renderCliSurfaceResponse(response, options);
    case 'telegram':
      return renderTelegramSurfaceResponse(response, options);
    case 'discord':
      return renderDiscordSurfaceResponse(response, options);
    case 'slack':
    case 'whatsapp':
    case 'instagram':
    case 'teams':
    case 'email':
    case 'signal':
    case 'imessage':
    case 'web':
      return renderFallbackMessagingSurfaceResponse(target, response, options);
    case 'plain':
    default:
      return renderPlainSurfaceResponse(response, options);
  }
}

function resolveFallbackTextLimit(target: SurfaceRenderTarget): number {
  switch (target) {
    case 'slack':
    case 'teams':
      return 3000;
    case 'email':
      return 8000;
    case 'whatsapp':
    case 'instagram':
      return 3500;
    case 'signal':
    case 'imessage':
      return 1800;
    case 'web':
      return 6000;
    default:
      return 2000;
  }
}

function mapDiscordButtonStyle(style: string): 1 | 2 | 3 | 4 {
  switch (style) {
    case 'primary':
      return 1;
    case 'success':
      return 3;
    case 'danger':
      return 4;
    case 'secondary':
    default:
      return 2;
  }
}

function escapeDiscordMentions(text: string): string {
  return text
    .replace(/@everyone/g, '@\u200beveryone')
    .replace(/@here/g, '@\u200bhere')
    .replace(/<@/g, '<@\u200b');
}
