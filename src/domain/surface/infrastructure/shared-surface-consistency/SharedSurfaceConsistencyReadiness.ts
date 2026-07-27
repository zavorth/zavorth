import { config } from '../../../../config/index.js';
import { isWeakZavorthControlToken } from '../../../../services/ZavorthControlTokenService.js';
import type { SharedSurfaceConsistencyOptions, SurfaceConsistencyDiscordReadiness } from './SharedSurfaceConsistencyTypes.js';

export function buildWebReadiness(
  surfaceReadiness: SharedSurfaceConsistencyOptions['surfaceReadiness'],
): { ready: boolean; summary: string } {
  const override = surfaceReadiness?.web;
  const ready = override?.ready ?? Boolean(config.zavorthWebPort);
  const summary = String(override?.summary || '').trim();
  if (summary) {
    return { ready, summary };
  }

  if (!ready) {
    return {
      ready,
      summary: 'The web surface has not been initialized on this host yet.',
    };
  }

  return {
    ready,
    summary: config.zavorthWebAuthToken && !isWeakZavorthControlToken(config.zavorthWebAuthToken) ? 'Web chat ready with authentication, approvals, workflows and runtime operation.'
      : 'Web chat ready without required token; activating authentication is recommended for shared use.',
  };
}

export function buildTelegramReadiness(
  surfaceReadiness: SharedSurfaceConsistencyOptions['surfaceReadiness'],
): { ready: boolean; summary: string } {
  const override = surfaceReadiness?.telegram;
  const ready = override?.ready ?? Boolean(config.telegramBotToken && config.allowedUserIds.length > 0);
  const summary = String(override?.summary || '').trim();
  if (summary) {
    return { ready, summary };
  }

  if (!config.telegramBotToken) {
    return {
      ready,
      summary: 'Telegram still pending: configure TELEGRAM_BOT_TOKEN to expose conversation, approvals and resumption on this surface.',
    };
  }

  if (config.allowedUserIds.length === 0) {
    return {
      ready,
      summary: 'Telegram with token present, but no operational user allowlist yet.',
    };
  }

  return {
    ready,
    summary: 'Telegram ready for direct conversation, approvals, workflows and shared resumption.',
  };
}

export function buildDiscordReadiness(
  surfaceReadiness: SharedSurfaceConsistencyOptions['surfaceReadiness'],
): SurfaceConsistencyDiscordReadiness {
  const override = surfaceReadiness?.discord;
  const enabled = override?.enabled ?? (config.discordBridgeEnabled || Boolean(config.discordBotToken));
  const commandExposure = override?.commandExposure || config.discordCommandExposure;
  const publicServerMode = override?.publicServerMode ?? config.discordPublicServerMode;
  const summaryOverride = String(override?.summary || '').trim();

  return {
    enabled,
    commandExposure,
    publicServerMode,
    summary: (slashReadyCount: number) => {
      if (summaryOverride) {
        return summaryOverride;
      }
      if (!enabled) {
        return 'Discord has not been enabled on this host yet.';
      }
      if (slashReadyCount > 0) {
        return `Discord with ${slashReadyCount} shared slash command(s) exposed in ${commandExposure} mode.`;
      }
      return 'Discord enabled, but no shared slash commands exposed on this host yet.';
    },
  };
}
