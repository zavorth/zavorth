import path from 'path';

import {
  normalizeUrl,
  parseTelegramUserRoles,
  readJsonStringField,
} from '../configHelpers';

export function buildSurfaceConfig(projectRoot: string, publicTunnelStateFileFallback: string) {
  const allowedUserIds = (process.env.TELEGRAM_ALLOWED_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  return {
    // Telegram
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    allowedUserIds,
    telegramUserRoles: parseTelegramUserRoles(
      process.env.TELEGRAM_USER_ROLES || '',
      allowedUserIds,
    ),
    zavorthPublicBaseUrl: (() => {
      const directValue = normalizeUrl(process.env.ZAVORTH_PUBLIC_BASE_URL || '');
      if (directValue) {
        return directValue;
      }
      const cloudflareHostname = String(process.env.CLOUDFLARE_TUNNEL_PUBLIC_HOSTNAME || '').trim();
      if (cloudflareHostname) {
        return `https://${cloudflareHostname.replace(/^https?:\/\//i, '').replace(/\/+$/, '')}`;
      }
      if (process.env.RENDER_EXTERNAL_URL) {
        return normalizeUrl(process.env.RENDER_EXTERNAL_URL);
      }
      if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
      }
      if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
      }
      const tunnelStateUrl = normalizeUrl(
        readJsonStringField(
          process.env.ZAVORTH_PUBLIC_TUNNEL_STATE_FILE || publicTunnelStateFileFallback,
          ['publicUrl'],
        ),
      );
      if (tunnelStateUrl) {
        return tunnelStateUrl;
      }
      return '';
    })(),
    zavorthExternalWebClientUrl: normalizeUrl(process.env.ZAVORTH_EXTERNAL_WEB_CLIENT_URL || ''),
    zavorthExternalDocsUrl: normalizeUrl(process.env.ZAVORTH_EXTERNAL_DOCS_URL || ''),
    zavorthDocsRepoRoot:
      process.env.ZAVORTH_DOCS_REPO_ROOT ||
      path.resolve(projectRoot, '..', 'zavorth-docs'),
    zavorthWebRepoRoot:
      process.env.ZAVORTH_WEB_REPO_ROOT ||
      path.resolve(projectRoot, '..', 'zavorth-web'),
    zavorthUiSandboxRepoRoot:
      process.env.ZAVORTH_UI_SANDBOX_REPO_ROOT ||
      path.resolve(projectRoot, '..', 'zavorth-ui-sandbox'),
  };
}
