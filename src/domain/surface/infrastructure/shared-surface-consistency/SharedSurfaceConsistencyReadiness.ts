import { config } from '../../../../config/index.js';
import { isWeakDashboardToken } from '../../../../services/DashboardTokenService.js';
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
      summary: 'A superficie web ainda nao foi inicializada neste host.',
    };
  }

  return {
    ready,
    summary: config.zavorthWebAuthToken && !isWeakDashboardToken(config.zavorthWebAuthToken)
      ? 'Chat web pronto com autenticacao, approvals, workflows e operacao do runtime.'
      : 'Chat web pronto sem token exigido; recomenda-se ativar autenticacao para uso compartilhado.',
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
      summary: 'Telegram ainda pendente: configure TELEGRAM_BOT_TOKEN para expor conversa, approvals e retomada nessa superficie.',
    };
  }

  if (config.allowedUserIds.length === 0) {
    return {
      ready,
      summary: 'Telegram com token presente, mas ainda sem allowlist de usuarios operacionais.',
    };
  }

  return {
    ready,
    summary: 'Telegram pronto para conversa direta, approvals, workflows e retomada compartilhada.',
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
        return 'Discord ainda nao foi habilitado neste host.';
      }
      if (slashReadyCount > 0) {
        return `Discord com ${slashReadyCount} slash command(s) exposto(s) no modo ${commandExposure}.`;
      }
      return 'Discord habilitado, mas ainda sem slash commands compartilhados expostos neste host.';
    },
  };
}
